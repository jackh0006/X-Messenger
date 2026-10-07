//! Digital Signature Implementations
//! Ed25519 (Classical) + ML-DSA-65 (FIPS 204)
//!
//! Hybrid signatures for the transition period:
//! - Ed25519: fast, 128-bit classical security
//! - ML-DSA-65: NIST PQC Standard (FIPS 204), category 3
//! ML-DSA keys are stored as 32-byte seeds (preferred serialization).

use core::fmt;

use ed25519_dalek::{Signer as _, Verifier as _};
use ml_dsa::{
    Generate as _, KeyExport as _, KeyInit as _, Keypair as _, SignatureEncoding as _,
    Signer as _, Verifier as _,
};
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::utils::{constant_time_eq, SecureBytes};

/// Signature Algorithms
#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroize)]
pub enum SignatureAlgorithm {
    /// Ed25519 - Fast, 128-bit classical security
    Ed25519,
    /// ML-DSA-65 - NIST PQC Standard (FIPS 204)
    Dilithium3,
    /// Hybrid: Ed25519 + ML-DSA-65
    HybridEd25519Dilithium3,
}

impl SignatureAlgorithm {
    /// Public key size in bytes
    pub const fn public_key_size(&self) -> usize {
        match self {
            SignatureAlgorithm::Ed25519 => 32,
            SignatureAlgorithm::Dilithium3 => 1952,
            SignatureAlgorithm::HybridEd25519Dilithium3 => 32 + 1952,
        }
    }

    /// Secret key size in bytes (seeds: Ed25519 32, ML-DSA 32)
    pub const fn secret_key_size(&self) -> usize {
        match self {
            SignatureAlgorithm::Ed25519 => 32,
            SignatureAlgorithm::Dilithium3 => 32,
            SignatureAlgorithm::HybridEd25519Dilithium3 => 32 + 32,
        }
    }

    /// Signature size in bytes
    pub const fn signature_size(&self) -> usize {
        match self {
            SignatureAlgorithm::Ed25519 => 64,
            SignatureAlgorithm::Dilithium3 => 3309,
            SignatureAlgorithm::HybridEd25519Dilithium3 => 64 + 3309,
        }
    }
}

/// Signature trait
pub trait Signer: Send + Sync {
    /// Algorithm identifier
    fn algorithm(&self) -> SignatureAlgorithm;
    /// Generate a fresh keypair from the OS CSPRNG
    fn generate_keypair(&self) -> Result<(SignaturePublicKey, SignatureSecretKey), SignatureError>;
    /// Sign a message
    fn sign(&self, sk: &SignatureSecretKey, message: &[u8]) -> Result<Signature, SignatureError>;
    /// Verify a signature
    fn verify(
        &self,
        pk: &SignaturePublicKey,
        message: &[u8],
        sig: &Signature,
    ) -> Result<(), SignatureError>;
}

/// Signature Public Key
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SignaturePublicKey {
    bytes: SecureBytes,
    algorithm: SignatureAlgorithm,
}

impl SignaturePublicKey {
    /// Wrap raw bytes
    pub fn new(algorithm: SignatureAlgorithm, bytes: &[u8]) -> Result<Self, SignatureError> {
        if bytes.len() != algorithm.public_key_size() {
            return Err(SignatureError::InvalidPublicKeySize);
        }
        Ok(Self { bytes: SecureBytes::from(bytes), algorithm })
    }

    /// Algorithm identifier
    pub fn algorithm(&self) -> SignatureAlgorithm {
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

impl fmt::Debug for SignaturePublicKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SignaturePublicKey")
            .field("algorithm", &self.algorithm)
            .field("bytes", &hex::encode(&self.bytes.as_slice()[..32.min(self.bytes.len())]))
            .finish()
    }
}

impl PartialEq for SignaturePublicKey {
    fn eq(&self, other: &Self) -> bool {
        self.algorithm == other.algorithm
            && constant_time_eq(self.bytes.as_slice(), other.bytes.as_slice())
    }
}

/// Signature Secret Key (seed form, zeroed on drop)
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SignatureSecretKey {
    bytes: SecureBytes,
    algorithm: SignatureAlgorithm,
}

impl SignatureSecretKey {
    /// Wrap raw bytes
    pub fn new(algorithm: SignatureAlgorithm, bytes: &[u8]) -> Result<Self, SignatureError> {
        if bytes.len() != algorithm.secret_key_size() {
            return Err(SignatureError::InvalidSecretKeySize);
        }
        Ok(Self { bytes: SecureBytes::from(bytes), algorithm })
    }

    /// Algorithm identifier
    pub fn algorithm(&self) -> SignatureAlgorithm {
        self.algorithm
    }

    /// Borrow raw bytes
    pub fn as_bytes(&self) -> &[u8] {
        self.bytes.as_slice()
    }
}

impl fmt::Debug for SignatureSecretKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SignatureSecretKey")
            .field("algorithm", &self.algorithm)
            .field("bytes", &"[REDACTED]")
            .finish()
    }
}

/// Signature
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct Signature {
    bytes: SecureBytes,
    algorithm: SignatureAlgorithm,
}

impl Signature {
    /// Wrap raw bytes
    pub fn new(algorithm: SignatureAlgorithm, bytes: &[u8]) -> Result<Self, SignatureError> {
        if bytes.len() != algorithm.signature_size() {
            return Err(SignatureError::InvalidSignatureSize);
        }
        Ok(Self { bytes: SecureBytes::from(bytes), algorithm })
    }

    /// Algorithm identifier
    pub fn algorithm(&self) -> SignatureAlgorithm {
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

impl fmt::Debug for Signature {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Signature")
            .field("algorithm", &self.algorithm)
            .field("len", &self.bytes.len())
            .finish()
    }
}

/// Signature Key Pair
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SignatureKeyPair {
    /// Public half
    pub public: SignaturePublicKey,
    secret: SignatureSecretKey,
}

impl SignatureKeyPair {
    /// Assemble a pair
    pub fn new(public: SignaturePublicKey, secret: SignatureSecretKey) -> Self {
        Self { public, secret }
    }

    /// Borrow the public half
    pub fn public(&self) -> &SignaturePublicKey {
        &self.public
    }

    /// Borrow the secret half
    pub fn secret(&self) -> &SignatureSecretKey {
        &self.secret
    }

    /// Split into parts (clones; the pair is zeroized on drop)
    pub fn into_parts(self) -> (SignaturePublicKey, SignatureSecretKey) {
        (self.public.clone(), self.secret.clone())
    }
}

/// Signature Errors (deliberately vague)
#[derive(Debug, thiserror::Error)]
pub enum SignatureError {
    /// Bad public key size
    #[error("Invalid public key size")]
    InvalidPublicKeySize,
    /// Bad secret key size
    #[error("Invalid secret key size")]
    InvalidSecretKeySize,
    /// Bad signature size
    #[error("Invalid signature size")]
    InvalidSignatureSize,
    /// Signing failed
    #[error("Signing failed: {0}")]
    SigningFailed(String),
    /// Verification failed (generic: wrong key OR tampered message)
    #[error("Verification failed")]
    VerificationFailed,
    /// Invalid key format
    #[error("Invalid key format")]
    InvalidKeyFormat,
}

fn b32(bytes: &[u8]) -> Result<[u8; 32], SignatureError> {
    bytes.try_into().map_err(|_| SignatureError::InvalidSecretKeySize)
}

/// Ed25519 Implementation
pub struct Ed25519Signer;

impl Signer for Ed25519Signer {
    fn algorithm(&self) -> SignatureAlgorithm {
        SignatureAlgorithm::Ed25519
    }

    fn generate_keypair(&self) -> Result<(SignaturePublicKey, SignatureSecretKey), SignatureError> {
        use rand_core::RngCore;
        let mut seed = [0u8; 32];
        rand_core::OsRng.fill_bytes(&mut seed);
        let signing = ed25519_dalek::SigningKey::from_bytes(&seed);
        let pk = SignaturePublicKey::new(SignatureAlgorithm::Ed25519, &signing.verifying_key().to_bytes())?;
        let sk = SignatureSecretKey::new(SignatureAlgorithm::Ed25519, &signing.to_bytes())?;
        Ok((pk, sk))
    }

    fn sign(&self, sk: &SignatureSecretKey, message: &[u8]) -> Result<Signature, SignatureError> {
        if sk.as_bytes().len() != 32 || sk.algorithm() != SignatureAlgorithm::Ed25519 {
            return Err(SignatureError::InvalidSecretKeySize);
        }
        let signing = ed25519_dalek::SigningKey::from_bytes(&b32(sk.as_bytes())?);
        let sig = signing.sign(message);
        Signature::new(SignatureAlgorithm::Ed25519, &sig.to_bytes())
    }

    fn verify(
        &self,
        pk: &SignaturePublicKey,
        message: &[u8],
        sig: &Signature,
    ) -> Result<(), SignatureError> {
        if pk.as_bytes().len() != 32 {
            return Err(SignatureError::InvalidPublicKeySize);
        }
        if sig.as_bytes().len() != 64 {
            return Err(SignatureError::InvalidSignatureSize);
        }
        let vk = ed25519_dalek::VerifyingKey::from_bytes(&b32(pk.as_bytes())?)
            .map_err(|_| SignatureError::InvalidKeyFormat)?;
        let signature = ed25519_dalek::Signature::from_slice(sig.as_bytes())
            .map_err(|_| SignatureError::InvalidSignatureSize)?;
        vk.verify(message, &signature).map_err(|_| SignatureError::VerificationFailed)
    }
}

/// ML-DSA-65 Implementation (FIPS 204, pure Rust)
pub struct Dilithium3Signer;

impl Signer for Dilithium3Signer {
    fn algorithm(&self) -> SignatureAlgorithm {
        SignatureAlgorithm::Dilithium3
    }

    fn generate_keypair(&self) -> Result<(SignaturePublicKey, SignatureSecretKey), SignatureError> {
        let sk = ml_dsa::SigningKey::<ml_dsa::MlDsa65>::generate();
        let vk = sk.verifying_key();
        let pk =
            SignaturePublicKey::new(SignatureAlgorithm::Dilithium3, vk.encode().as_slice())?;
        let secret =
            SignatureSecretKey::new(SignatureAlgorithm::Dilithium3, sk.to_bytes().as_slice())?;
        Ok((pk, secret))
    }

    fn sign(&self, sk: &SignatureSecretKey, message: &[u8]) -> Result<Signature, SignatureError> {
        if sk.as_bytes().len() != 32 || sk.algorithm() != SignatureAlgorithm::Dilithium3 {
            return Err(SignatureError::InvalidSecretKeySize);
        }
        let seed: ml_dsa::Seed =
            sk.as_bytes().try_into().map_err(|_| SignatureError::InvalidSecretKeySize)?;
        let signing = ml_dsa::SigningKey::<ml_dsa::MlDsa65>::new(&seed);
        let sig = signing.sign(message);
        Signature::new(SignatureAlgorithm::Dilithium3, sig.to_bytes().as_slice())
    }

    fn verify(
        &self,
        pk: &SignaturePublicKey,
        message: &[u8],
        sig: &Signature,
    ) -> Result<(), SignatureError> {
        if pk.as_bytes().len() != 1952 {
            return Err(SignatureError::InvalidPublicKeySize);
        }
        if sig.as_bytes().len() != 3309 {
            return Err(SignatureError::InvalidSignatureSize);
        }
        let vk = ml_dsa::VerifyingKey::<ml_dsa::MlDsa65>::new(
            pk.as_bytes().try_into().map_err(|_| SignatureError::InvalidPublicKeySize)?,
        );
        let signature = ml_dsa::Signature::<ml_dsa::MlDsa65>::try_from(sig.as_bytes())
            .map_err(|_| SignatureError::InvalidSignatureSize)?;
        vk.verify(message, &signature).map_err(|_| SignatureError::VerificationFailed)
    }
}

/// Hybrid Signer: Ed25519 + ML-DSA-65. Both signatures must verify.
pub struct HybridEd25519Dilithium3Signer;

impl Signer for HybridEd25519Dilithium3Signer {
    fn algorithm(&self) -> SignatureAlgorithm {
        SignatureAlgorithm::HybridEd25519Dilithium3
    }

    fn generate_keypair(&self) -> Result<(SignaturePublicKey, SignatureSecretKey), SignatureError> {
        let (ed_pk, ed_sk) = Ed25519Signer.generate_keypair()?;
        let (dsa_pk, dsa_sk) = Dilithium3Signer.generate_keypair()?;
        let mut pk_bytes = alloc::vec::Vec::with_capacity(32 + 1952);
        pk_bytes.extend_from_slice(ed_pk.as_bytes());
        pk_bytes.extend_from_slice(dsa_pk.as_bytes());
        let mut sk_bytes = alloc::vec::Vec::with_capacity(32 + 32);
        sk_bytes.extend_from_slice(ed_sk.as_bytes());
        sk_bytes.extend_from_slice(dsa_sk.as_bytes());
        Ok((
            SignaturePublicKey::new(SignatureAlgorithm::HybridEd25519Dilithium3, &pk_bytes)?,
            SignatureSecretKey::new(SignatureAlgorithm::HybridEd25519Dilithium3, &sk_bytes)?,
        ))
    }

    fn sign(&self, sk: &SignatureSecretKey, message: &[u8]) -> Result<Signature, SignatureError> {
        if sk.as_bytes().len() != 32 + 32 {
            return Err(SignatureError::InvalidSecretKeySize);
        }
        let ed_sk =
            SignatureSecretKey::new(SignatureAlgorithm::Ed25519, &sk.as_bytes()[0..32])?;
        let dsa_sk =
            SignatureSecretKey::new(SignatureAlgorithm::Dilithium3, &sk.as_bytes()[32..])?;
        let ed_sig = Ed25519Signer.sign(&ed_sk, message)?;
        let dsa_sig = Dilithium3Signer.sign(&dsa_sk, message)?;

        let mut sig_bytes = alloc::vec::Vec::with_capacity(64 + 3309);
        sig_bytes.extend_from_slice(ed_sig.as_bytes());
        sig_bytes.extend_from_slice(dsa_sig.as_bytes());
        Signature::new(SignatureAlgorithm::HybridEd25519Dilithium3, &sig_bytes)
    }

    fn verify(
        &self,
        pk: &SignaturePublicKey,
        message: &[u8],
        sig: &Signature,
    ) -> Result<(), SignatureError> {
        if pk.as_bytes().len() != 32 + 1952 {
            return Err(SignatureError::InvalidPublicKeySize);
        }
        if sig.as_bytes().len() != 64 + 3309 {
            return Err(SignatureError::InvalidSignatureSize);
        }
        let ed_pk =
            SignaturePublicKey::new(SignatureAlgorithm::Ed25519, &pk.as_bytes()[0..32])?;
        let ed_sig = Signature::new(SignatureAlgorithm::Ed25519, &sig.as_bytes()[0..64])?;
        Ed25519Signer.verify(&ed_pk, message, &ed_sig)?;

        let dsa_pk =
            SignaturePublicKey::new(SignatureAlgorithm::Dilithium3, &pk.as_bytes()[32..])?;
        let dsa_sig =
            Signature::new(SignatureAlgorithm::Dilithium3, &sig.as_bytes()[64..])?;
        Dilithium3Signer.verify(&dsa_pk, message, &dsa_sig)?;
        Ok(())
    }
}

/// Factory function to get signer
pub fn get_signer(algorithm: SignatureAlgorithm) -> alloc::boxed::Box<dyn Signer> {
    match algorithm {
        SignatureAlgorithm::Ed25519 => alloc::boxed::Box::new(Ed25519Signer),
        SignatureAlgorithm::Dilithium3 => alloc::boxed::Box::new(Dilithium3Signer),
        SignatureAlgorithm::HybridEd25519Dilithium3 => {
            alloc::boxed::Box::new(HybridEd25519Dilithium3Signer)
        }
    }
}

/// Generate hybrid keypair
pub fn generate_keypair() -> Result<(SignaturePublicKey, SignatureSecretKey), SignatureError> {
    let signer = get_signer(SignatureAlgorithm::HybridEd25519Dilithium3);
    signer.generate_keypair()
}

/// Generate Ed25519 keypair
pub fn generate_ed25519_keypair(
) -> Result<(SignaturePublicKey, SignatureSecretKey), SignatureError> {
    Ed25519Signer.generate_keypair()
}

/// Generate ML-DSA-65 keypair
pub fn generate_dilithium3_keypair(
) -> Result<(SignaturePublicKey, SignatureSecretKey), SignatureError> {
    Dilithium3Signer.generate_keypair()
}

/// Generate keypair for algorithm
pub fn generate_keypair_for(
    algorithm: SignatureAlgorithm,
) -> Result<(SignaturePublicKey, SignatureSecretKey), SignatureError> {
    let signer = get_signer(algorithm);
    signer.generate_keypair()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ed25519_keypair() {
        let (pk, sk) = generate_ed25519_keypair().unwrap();
        assert_eq!(pk.as_bytes().len(), 32);
        assert_eq!(sk.as_bytes().len(), 32);
    }

    #[test]
    fn test_ed25519_sign_verify() {
        let (pk, sk) = generate_ed25519_keypair().unwrap();
        let message = b"Hello, World!";
        let signer = Ed25519Signer;
        let sig = signer.sign(&sk, message).unwrap();
        assert!(signer.verify(&pk, message, &sig).is_ok());
    }

    #[test]
    fn test_dilithium3_keypair() {
        let (pk, sk) = generate_dilithium3_keypair().unwrap();
        assert_eq!(pk.as_bytes().len(), 1952);
        assert_eq!(sk.as_bytes().len(), 32);
    }

    #[test]
    fn test_dilithium3_sign_verify() {
        let (pk, sk) = generate_dilithium3_keypair().unwrap();
        let message = b"Test message";
        let signer = Dilithium3Signer;
        let sig = signer.sign(&sk, message).unwrap();
        assert!(signer.verify(&pk, message, &sig).is_ok());
    }

    #[test]
    fn test_hybrid_keypair() {
        let (pk, sk) = generate_keypair_for(SignatureAlgorithm::HybridEd25519Dilithium3).unwrap();
        assert_eq!(pk.as_bytes().len(), 32 + 1952);
        assert_eq!(sk.as_bytes().len(), 32 + 32);
    }

    #[test]
    fn test_hybrid_sign_verify() {
        let (pk, sk) = generate_keypair_for(SignatureAlgorithm::HybridEd25519Dilithium3).unwrap();
        let message = b"Test message for hybrid signature";
        let signer = HybridEd25519Dilithium3Signer;
        let sig = signer.sign(&sk, message).unwrap();
        assert!(signer.verify(&pk, message, &sig).is_ok());
    }

    #[test]
    fn test_wrong_message_fails() {
        let (pk, sk) = generate_ed25519_keypair().unwrap();
        let signer = Ed25519Signer;
        let sig = signer.sign(&sk, b"Message 1").unwrap();
        assert!(signer.verify(&pk, b"Message 2", &sig).is_err());
    }

    #[test]
    fn test_tampered_signature_fails() {
        let (pk, sk) = generate_ed25519_keypair().unwrap();
        let message = b"Hello";
        let signer = Ed25519Signer;
        let sig = signer.sign(&sk, message).unwrap();
        let mut sig_bytes = sig.as_bytes().to_vec();
        sig_bytes[0] ^= 0xFF;
        let tampered = Signature::new(SignatureAlgorithm::Ed25519, &sig_bytes).unwrap();
        assert!(signer.verify(&pk, message, &tampered).is_err());
    }
}
