//! Identity keys and pre-key bundles for offline contact exchange.
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::kem::{KemAlgorithm, KemPublicKey, KemSecretKey};
use crate::signatures::{SignatureAlgorithm, SignaturePublicKey, SignatureSecretKey};
use crate::utils::SecureBytes;

/// Long-term identity public part (shared once via QR).
#[derive(Clone)]
pub struct IdentityPublicKey {
    /// Display name (not authenticated; SAS words authenticate keys)
    pub name: alloc::string::String,
    /// Ed25519 identity key
    pub sig: SignaturePublicKey,
    /// X25519 DH key
    pub dh: KemPublicKey,
    /// ML-KEM-768 key
    pub kem: KemPublicKey,
}

/// Long-term identity key pair (kept in the encrypted store).
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct IdentityKeyPair {
    /// Display name
    pub name: alloc::string::String,
    sig_pub: SecureBytes,
    sig_sec: SecureBytes,
    dh_pub: SecureBytes,
    dh_sec: SecureBytes,
    kem_pub: SecureBytes,
    kem_sec: SecureBytes,
}

impl IdentityKeyPair {
    /// Assemble from raw parts.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        name: alloc::string::String,
        sig_pub: &[u8], sig_sec: &[u8],
        dh_pub: &[u8], dh_sec: &[u8],
        kem_pub: &[u8], kem_sec: &[u8],
    ) -> Self {
        Self {
            name,
            sig_pub: SecureBytes::from(sig_pub),
            sig_sec: SecureBytes::from(sig_sec),
            dh_pub: SecureBytes::from(dh_pub),
            dh_sec: SecureBytes::from(dh_sec),
            kem_pub: SecureBytes::from(kem_pub),
            kem_sec: SecureBytes::from(kem_sec),
        }
    }

    /// Public view for QR exchange.
    pub fn public(&self) -> Result<IdentityPublicKey, crate::signatures::SignatureError> {
        Ok(IdentityPublicKey {
            name: self.name.clone(),
            sig: SignaturePublicKey::new(SignatureAlgorithm::Ed25519, self.sig_pub.as_slice())?,
            dh: KemPublicKey::new(KemAlgorithm::X25519, self.dh_pub.as_slice())
                .map_err(|_| crate::signatures::SignatureError::InvalidPublicKeySize)?,
            kem: KemPublicKey::new(KemAlgorithm::MlKem768, self.kem_pub.as_slice())
                .map_err(|_| crate::signatures::SignatureError::InvalidPublicKeySize)?,
        })
    }

    /// Borrow secret parts (for encaps/decaps/sign only).
    pub fn secrets(
        &self,
    ) -> (SignatureSecretKey, KemSecretKey, KemSecretKey) {
        let sig = SignatureSecretKey::new(SignatureAlgorithm::Ed25519, self.sig_sec.as_slice())
            .expect("identity sig key");
        let dh = KemSecretKey::new(KemAlgorithm::X25519, self.dh_sec.as_slice())
            .expect("identity dh key");
        let kem = KemSecretKey::new(KemAlgorithm::MlKem768, self.kem_sec.as_slice())
            .expect("identity kem key");
        (sig, dh, kem)
    }
}

/// One signed pre-key (for future async use; v1 is fully offline).
#[derive(Clone)]
pub struct SignedPreKey {
    /// Key id
    pub id: u32,
    /// DH public key
    pub dh: KemPublicKey,
    /// KEM public key
    pub kem: KemPublicKey,
    /// Signature over id||dh||kem
    pub signature: crate::signatures::Signature,
}

/// Bundle scanned from a contact QR.
#[derive(Clone)]
pub struct PreKeyBundle {
    /// Peer's identity
    pub identity: IdentityPublicKey,
    /// Peer's signed pre-key
    pub prekey: SignedPreKey,
}
