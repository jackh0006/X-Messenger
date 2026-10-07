//! Key Encapsulation Mechanism (KEM) Implementation
//! Hybrid KEM: X25519 (Classical) + ML-KEM-768 (FIPS 203)
//!
//! Combined security: an attacker must break BOTH mechanisms.
//! ML-KEM secret keys are stored in 64-byte seed form (preferred serialization).

use core::fmt;

use kem::{
    Decapsulate as _, Encapsulate as _, Kem as KemCore, KeyExport as _, KeyInit as _,
    TryKeyInit as _,
};
use ml_kem::{Ciphertext as MlKemCt, DecapsulationKey768, EncapsulationKey768, MlKem768};
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::utils::{constant_time_eq, SecureBytes};

/// KEM Algorithms supported
#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroize)]
pub enum KemAlgorithm {
    /// X25519 - Classical elliptic curve Diffie-Hellman (128-bit classical)
    X25519,
    /// ML-KEM-768 (FIPS 203) - Module-Lattice KEM (~192-bit quantum)
    MlKem768,
    /// Hybrid: X25519 + ML-KEM-768 (Combined security)
    HybridX25519MlKem768,
}

impl KemAlgorithm {
    /// Public key size in bytes
    pub const fn public_key_size(&self) -> usize {
        match self {
            KemAlgorithm::X25519 => 32,
            KemAlgorithm::MlKem768 => 1184,
            KemAlgorithm::HybridX25519MlKem768 => 32 + 1184,
        }
    }

    /// Secret key size in bytes (ML-KEM stored as 64-byte seed)
    pub const fn secret_key_size(&self) -> usize {
        match self {
            KemAlgorithm::X25519 => 32,
            KemAlgorithm::MlKem768 => 64,
            KemAlgorithm::HybridX25519MlKem768 => 32 + 64,
        }
    }

    /// Ciphertext size in bytes
    pub const fn ciphertext_size(&self) -> usize {
        match self {
            KemAlgorithm::X25519 => 32,
            KemAlgorithm::MlKem768 => 1088,
            KemAlgorithm::HybridX25519MlKem768 => 32 + 1088,
        }
    }

    /// Shared secret size in bytes
    pub const fn shared_secret_size(&self) -> usize {
        match self {
            KemAlgorithm::X25519 => 32,
            KemAlgorithm::MlKem768 => 32,
            KemAlgorithm::HybridX25519MlKem768 => 64, // 32 + 32 concatenated
        }
    }
}

/// KEM trait for unified interface
pub trait Kem: Send + Sync {
    /// Algorithm identifier
    fn algorithm(&self) -> KemAlgorithm;
    /// Generate a fresh keypair from the OS CSPRNG
    fn generate_keypair(&self) -> Result<(KemPublicKey, KemSecretKey), KemError>;
    /// Encapsulate to a public key
    fn encapsulate(&self, pk: &KemPublicKey) -> Result<(KemCiphertext, SharedSecret), KemError>;
    /// Decapsulate with a secret key
    fn decapsulate(&self, sk: &KemSecretKey, ct: &KemCiphertext) -> Result<SharedSecret, KemError>;
}

/// KEM Public Key
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct KemPublicKey {
    bytes: SecureBytes,
    algorithm: KemAlgorithm,
}

impl KemPublicKey {
    /// Wrap raw bytes
    pub fn new(algorithm: KemAlgorithm, bytes: &[u8]) -> Result<Self, KemError> {
        if bytes.len() != algorithm.public_key_size() {
            return Err(KemError::InvalidPublicKeySize);
        }
        Ok(Self { bytes: SecureBytes::from(bytes), algorithm })
    }

    /// Algorithm identifier
    pub fn algorithm(&self) -> KemAlgorithm {
        self.algorithm
    }

    /// Borrow raw bytes
    pub fn as_bytes(&self) -> &[u8] {
        self.bytes.as_slice()
    }

    /// Length in bytes
    pub fn len(&self) -> usize {
        self.bytes.len()
    }
}

impl fmt::Debug for KemPublicKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("KemPublicKey")
            .field("algorithm", &self.algorithm)
            .field("bytes", &hex::encode(&self.bytes.as_slice()[..32.min(self.bytes.len())]))
            .finish()
    }
}

impl PartialEq for KemPublicKey {
    fn eq(&self, other: &Self) -> bool {
        self.algorithm == other.algorithm
            && constant_time_eq(self.bytes.as_slice(), other.bytes.as_slice())
    }
}

/// KEM Secret Key
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct KemSecretKey {
    bytes: SecureBytes,
    algorithm: KemAlgorithm,
}

impl KemSecretKey {
    /// Wrap raw bytes
    pub fn new(algorithm: KemAlgorithm, bytes: &[u8]) -> Result<Self, KemError> {
        if bytes.len() != algorithm.secret_key_size() {
            return Err(KemError::InvalidSecretKeySize);
        }
        Ok(Self { bytes: SecureBytes::from(bytes), algorithm })
    }

    /// Algorithm identifier
    pub fn algorithm(&self) -> KemAlgorithm {
        self.algorithm
    }

    /// Borrow raw bytes
    pub fn as_bytes(&self) -> &[u8] {
        self.bytes.as_slice()
    }
}

impl fmt::Debug for KemSecretKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("KemSecretKey")
            .field("algorithm", &self.algorithm)
            .field("bytes", &"[REDACTED]")
            .finish()
    }
}

/// KEM Ciphertext
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct KemCiphertext {
    bytes: SecureBytes,
    algorithm: KemAlgorithm,
}

impl KemCiphertext {
    /// Wrap raw bytes
    pub fn new(algorithm: KemAlgorithm, bytes: &[u8]) -> Result<Self, KemError> {
        if bytes.len() != algorithm.ciphertext_size() {
            return Err(KemError::InvalidCiphertextSize);
        }
        Ok(Self { bytes: SecureBytes::from(bytes), algorithm })
    }

    /// Algorithm identifier
    pub fn algorithm(&self) -> KemAlgorithm {
        self.algorithm
    }

    /// Borrow raw bytes
    pub fn as_bytes(&self) -> &[u8] {
        self.bytes.as_slice()
    }

    /// Length in bytes
    pub fn len(&self) -> usize {
        self.bytes.len()
    }
}

impl fmt::Debug for KemCiphertext {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("KemCiphertext")
            .field("algorithm", &self.algorithm)
            .field("len", &self.bytes.len())
            .finish()
    }
}

/// Shared Secret from KEM
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SharedSecret {
    bytes: SecureBytes,
}

impl SharedSecret {
    /// Wrap raw bytes (32 or 64 bytes)
    pub fn new(bytes: &[u8]) -> Result<Self, KemError> {
        if bytes.len() != 32 && bytes.len() != 64 {
            return Err(KemError::InvalidSharedSecretSize);
        }
        Ok(Self { bytes: SecureBytes::from(bytes) })
    }

    /// Borrow raw bytes
    pub fn as_bytes(&self) -> &[u8] {
        self.bytes.as_slice()
    }

    /// Length in bytes
    pub fn len(&self) -> usize {
        self.bytes.len()
    }
}

impl fmt::Debug for SharedSecret {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SharedSecret").field("len", &self.bytes.len()).finish()
    }
}

/// KEM Errors (deliberately vague: no oracle details)
#[derive(Debug, thiserror::Error)]
pub enum KemError {
    /// Bad public key size
    #[error("Invalid public key size")]
    InvalidPublicKeySize,
    /// Bad secret key size
    #[error("Invalid secret key size")]
    InvalidSecretKeySize,
    /// Bad ciphertext size
    #[error("Invalid ciphertext size")]
    InvalidCiphertextSize,
    /// Bad shared secret size
    #[error("Invalid shared secret size")]
    InvalidSharedSecretSize,
    /// Key generation failed
    #[error("Key generation failed: {0}")]
    KeyGenFailed(String),
    /// Encapsulation failed
    #[error("Encapsulation failed: {0}")]
    EncapsulationFailed(String),
    /// Decapsulation failed (generic: may be wrong key OR tampered ct)
    #[error("Decapsulation failed: {0}")]
    DecapsulationFailed(String),
    /// Invalid key format
    #[error("Invalid key format")]
    InvalidKeyFormat,
}

fn b32(bytes: &[u8]) -> Result<[u8; 32], KemError> {
    bytes.try_into().map_err(|_| KemError::InvalidPublicKeySize)
}

/// X25519 Implementation (Classical ECDH)
pub struct X25519Kem;

impl Kem for X25519Kem {
    fn algorithm(&self) -> KemAlgorithm {
        KemAlgorithm::X25519
    }

    fn generate_keypair(&self) -> Result<(KemPublicKey, KemSecretKey), KemError> {
        use rand_core::OsRng;
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = PublicKey::from(&secret);
        let pk = KemPublicKey::new(KemAlgorithm::X25519, public.as_bytes())?;
        let sk = KemSecretKey::new(KemAlgorithm::X25519, secret.as_bytes())?;
        Ok((pk, sk))
    }

    fn encapsulate(&self, pk: &KemPublicKey) -> Result<(KemCiphertext, SharedSecret), KemError> {
        use rand_core::OsRng;
        if pk.as_bytes().len() != 32 || pk.algorithm() != KemAlgorithm::X25519 {
            return Err(KemError::InvalidPublicKeySize);
        }
        let ephemeral_sk = StaticSecret::random_from_rng(OsRng);
        let peer_pk = PublicKey::from(b32(pk.as_bytes())?);
        let shared = ephemeral_sk.diffie_hellman(&peer_pk);
        let ephemeral_pk = PublicKey::from(&ephemeral_sk);
        let ct = KemCiphertext::new(KemAlgorithm::X25519, ephemeral_pk.as_bytes())?;
        let ss = SharedSecret::new(shared.as_bytes())?;
        Ok((ct, ss))
    }

    fn decapsulate(&self, sk: &KemSecretKey, ct: &KemCiphertext) -> Result<SharedSecret, KemError> {
        if ct.as_bytes().len() != 32 {
            return Err(KemError::InvalidCiphertextSize);
        }
        if sk.as_bytes().len() != 32 {
            return Err(KemError::InvalidSecretKeySize);
        }
        let sk_arr: [u8; 32] =
            sk.as_bytes().try_into().map_err(|_| KemError::InvalidSecretKeySize)?;
        let ct_arr: [u8; 32] =
            ct.as_bytes().try_into().map_err(|_| KemError::InvalidCiphertextSize)?;
        let sk = StaticSecret::from(sk_arr);
        let ct_pk = PublicKey::from(ct_arr);
        let shared = sk.diffie_hellman(&ct_pk);
        SharedSecret::new(shared.as_bytes())
    }
}

/// ML-KEM-768 Implementation (FIPS 203, pure Rust).
pub struct MlKem768Kem;

impl Kem for MlKem768Kem {
    fn algorithm(&self) -> KemAlgorithm {
        KemAlgorithm::MlKem768
    }

    fn generate_keypair(&self) -> Result<(KemPublicKey, KemSecretKey), KemError> {
        let (dk, ek) = MlKem768::generate_keypair();
        let pk = KemPublicKey::new(KemAlgorithm::MlKem768, ek.to_bytes().as_slice())?;
        let sk = KemSecretKey::new(KemAlgorithm::MlKem768, dk.to_bytes().as_slice())?;
        Ok((pk, sk))
    }

    fn encapsulate(&self, pk: &KemPublicKey) -> Result<(KemCiphertext, SharedSecret), KemError> {
        if pk.as_bytes().len() != 1184 || pk.algorithm() != KemAlgorithm::MlKem768 {
            return Err(KemError::InvalidPublicKeySize);
        }
        let ek = EncapsulationKey768::new_from_slice(pk.as_bytes())
            .map_err(|_| KemError::InvalidPublicKeySize)?;
        let (ct, ss) = ek.encapsulate();
        let ct = KemCiphertext::new(KemAlgorithm::MlKem768, ct.as_slice())?;
        let ss = SharedSecret::new(ss.as_slice())?;
        Ok((ct, ss))
    }

    fn decapsulate(&self, sk: &KemSecretKey, ct: &KemCiphertext) -> Result<SharedSecret, KemError> {
        if sk.as_bytes().len() != 64 {
            return Err(KemError::InvalidSecretKeySize);
        }
        if ct.as_bytes().len() != 1088 {
            return Err(KemError::InvalidCiphertextSize);
        }
        let seed = sk
            .as_bytes()
            .try_into()
            .map_err(|_| KemError::InvalidSecretKeySize)?;
        let dk = DecapsulationKey768::new(&seed);
        let ct_arr: MlKemCt<MlKem768> =
            ct.as_bytes().try_into().map_err(|_| KemError::InvalidCiphertextSize)?;
        let ss = dk.decapsulate(&ct_arr);
        SharedSecret::new(ss.as_slice())
    }
}

/// Hybrid KEM: X25519 + ML-KEM-768. Both must break for compromise.
pub struct HybridX25519MlKem768Kem;

impl Kem for HybridX25519MlKem768Kem {
    fn algorithm(&self) -> KemAlgorithm {
        KemAlgorithm::HybridX25519MlKem768
    }

    fn generate_keypair(&self) -> Result<(KemPublicKey, KemSecretKey), KemError> {
        let x25519_kem = X25519Kem;
        let (x25519_pk, x25519_sk) = x25519_kem.generate_keypair()?;
        let mlkem_kem = MlKem768Kem;
        let (mlkem_pk, mlkem_sk) = mlkem_kem.generate_keypair()?;

        let mut pk_bytes = alloc::vec::Vec::with_capacity(32 + 1184);
        pk_bytes.extend_from_slice(x25519_pk.as_bytes());
        pk_bytes.extend_from_slice(mlkem_pk.as_bytes());
        let pk = KemPublicKey::new(KemAlgorithm::HybridX25519MlKem768, &pk_bytes)?;

        let mut sk_bytes = alloc::vec::Vec::with_capacity(32 + 64);
        sk_bytes.extend_from_slice(x25519_sk.as_bytes());
        sk_bytes.extend_from_slice(mlkem_sk.as_bytes());
        let sk = KemSecretKey::new(KemAlgorithm::HybridX25519MlKem768, &sk_bytes)?;

        Ok((pk, sk))
    }

    fn encapsulate(&self, pk: &KemPublicKey) -> Result<(KemCiphertext, SharedSecret), KemError> {
        if pk.as_bytes().len() != 32 + 1184 || pk.algorithm() != KemAlgorithm::HybridX25519MlKem768
        {
            return Err(KemError::InvalidPublicKeySize);
        }
        let pk_bytes = pk.as_bytes();
        let x25519_pk = KemPublicKey::new(KemAlgorithm::X25519, &pk_bytes[0..32])?;
        let mlkem_pk = KemPublicKey::new(KemAlgorithm::MlKem768, &pk_bytes[32..])?;

        let x25519_kem = X25519Kem;
        let (x25519_ct, x25519_ss) = x25519_kem.encapsulate(&x25519_pk)?;
        let mlkem_kem = MlKem768Kem;
        let (mlkem_ct, mlkem_ss) = mlkem_kem.encapsulate(&mlkem_pk)?;

        let mut ct_bytes = alloc::vec::Vec::with_capacity(32 + 1088);
        ct_bytes.extend_from_slice(x25519_ct.as_bytes());
        ct_bytes.extend_from_slice(mlkem_ct.as_bytes());
        let ct = KemCiphertext::new(KemAlgorithm::HybridX25519MlKem768, &ct_bytes)?;

        let mut ss_bytes = alloc::vec::Vec::with_capacity(64);
        ss_bytes.extend_from_slice(x25519_ss.as_bytes());
        ss_bytes.extend_from_slice(mlkem_ss.as_bytes());
        let ss = SharedSecret::new(&ss_bytes)?;

        Ok((ct, ss))
    }

    fn decapsulate(&self, sk: &KemSecretKey, ct: &KemCiphertext) -> Result<SharedSecret, KemError> {
        if sk.as_bytes().len() != 32 + 64 {
            return Err(KemError::InvalidSecretKeySize);
        }
        if ct.as_bytes().len() != 32 + 1088 {
            return Err(KemError::InvalidCiphertextSize);
        }
        let sk_bytes = sk.as_bytes();
        let ct_bytes = ct.as_bytes();

        let x25519_kem = X25519Kem;
        let x25519_sk_obj = KemSecretKey::new(KemAlgorithm::X25519, &sk_bytes[0..32])?;
        let x25519_ct_obj = KemCiphertext::new(KemAlgorithm::X25519, &ct_bytes[0..32])?;
        let x25519_ss = x25519_kem.decapsulate(&x25519_sk_obj, &x25519_ct_obj)?;

        let mlkem_kem = MlKem768Kem;
        let mlkem_sk_obj = KemSecretKey::new(KemAlgorithm::MlKem768, &sk_bytes[32..])?;
        let mlkem_ct_obj = KemCiphertext::new(KemAlgorithm::MlKem768, &ct_bytes[32..])?;
        let mlkem_ss = mlkem_kem.decapsulate(&mlkem_sk_obj, &mlkem_ct_obj)?;

        let mut ss_bytes = alloc::vec::Vec::with_capacity(64);
        ss_bytes.extend_from_slice(x25519_ss.as_bytes());
        ss_bytes.extend_from_slice(mlkem_ss.as_bytes());
        SharedSecret::new(&ss_bytes)
    }
}

/// Factory function to get KEM implementation
pub fn get_kem(algorithm: KemAlgorithm) -> alloc::boxed::Box<dyn Kem> {
    match algorithm {
        KemAlgorithm::X25519 => alloc::boxed::Box::new(X25519Kem),
        KemAlgorithm::MlKem768 => alloc::boxed::Box::new(MlKem768Kem),
        KemAlgorithm::HybridX25519MlKem768 => alloc::boxed::Box::new(HybridX25519MlKem768Kem),
    }
}

/// Hybrid key exchange for QR code exchange
pub fn hybrid_key_exchange() -> Result<(KemPublicKey, KemSecretKey), KemError> {
    get_kem(KemAlgorithm::HybridX25519MlKem768).generate_keypair()
}

/// Derive session keys from hybrid shared secret
pub fn derive_session_keys(shared: &[u8]) -> Result<SessionKeys, crate::cipher::CipherError> {
    use crate::hkdf::{Hkdf, HkdfAlgorithm};

    if shared.len() != 64 {
        return Err(crate::cipher::CipherError::InvalidKeySize);
    }

    let hkdf = Hkdf::new(HkdfAlgorithm::Sha3_512, b"OAM1-hybrid-salt");
    let prk = hkdf
        .extract(b"OAM1-RATCHET-v1", shared)
        .map_err(|e| crate::cipher::CipherError::EncryptionFailed(e.to_string()))?;

    let mut okm = [0u8; 128];
    hkdf.expand(&prk, b"OAM1-SESSION-KEYS", &mut okm)
        .map_err(|e| crate::cipher::CipherError::EncryptionFailed(e.to_string()))?;

    Ok(SessionKeys {
        cipher_key: SecureBytes::from(&okm[0..32]),
        mac_key: SecureBytes::from(&okm[32..64]),
        ratchet_key: SecureBytes::from(&okm[64..96]),
        auth_key: SecureBytes::from(&okm[96..128]),
    })
}

/// Session keys derived from shared secret
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SessionKeys {
    /// AEAD message key
    pub cipher_key: SecureBytes,
    /// Header MAC key
    pub mac_key: SecureBytes,
    /// Ratchet chain key
    pub ratchet_key: SecureBytes,
    /// Identity auth key
    pub auth_key: SecureBytes,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_x25519_keypair() {
        let kem = X25519Kem;
        let (pk, sk) = kem.generate_keypair().unwrap();
        assert_eq!(pk.as_bytes().len(), 32);
        assert_eq!(sk.as_bytes().len(), 32);
    }

    #[test]
    fn test_x25519_encapsulate_decapsulate() {
        let kem = X25519Kem;
        let (pk, sk) = kem.generate_keypair().unwrap();
        let (ct, ss1) = kem.encapsulate(&pk).unwrap();
        let ss2 = kem.decapsulate(&sk, &ct).unwrap();
        assert_eq!(ss1.as_bytes(), ss2.as_bytes());
    }

    #[test]
    fn test_mlkem768_keypair() {
        let kem = MlKem768Kem;
        let (pk, sk) = kem.generate_keypair().unwrap();
        assert_eq!(pk.as_bytes().len(), 1184);
        assert_eq!(sk.as_bytes().len(), 64);
    }

    #[test]
    fn test_mlkem768_encapsulate_decapsulate() {
        let kem = MlKem768Kem;
        let (pk, sk) = kem.generate_keypair().unwrap();
        let (ct, ss1) = kem.encapsulate(&pk).unwrap();
        let ss2 = kem.decapsulate(&sk, &ct).unwrap();
        assert_eq!(ss1.as_bytes(), ss2.as_bytes());
    }

    #[test]
    fn test_hybrid_keypair() {
        let kem = HybridX25519MlKem768Kem;
        let (pk, sk) = kem.generate_keypair().unwrap();
        assert_eq!(pk.as_bytes().len(), 32 + 1184);
        assert_eq!(sk.as_bytes().len(), 32 + 64);
    }

    #[test]
    fn test_hybrid_encapsulate_decapsulate() {
        let kem = HybridX25519MlKem768Kem;
        let (pk, sk) = kem.generate_keypair().unwrap();
        let (ct, ss1) = kem.encapsulate(&pk).unwrap();
        let ss2 = kem.decapsulate(&sk, &ct).unwrap();
        assert_eq!(ss1.as_bytes(), ss2.as_bytes());
        assert_eq!(ss1.len(), 64);
    }
}
