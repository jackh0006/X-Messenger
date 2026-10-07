//! Message authentication: HMAC-SHA-256 / HMAC-SHA3-256.
use hmac::{Hmac, Mac};
use sha2::Sha256;
use sha3::Sha3_256;
use zeroize::{Zeroize, ZeroizeOnDrop};

use crate::utils::SecureBytes;

/// MAC algorithms.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroize)]
pub enum MacAlgorithm {
    /// HMAC-SHA-256
    HmacSha256,
    /// HMAC-SHA3-256
    HmacSha3_256,
}

/// MAC errors.
#[derive(Debug, thiserror::Error)]
pub enum MacError {
    /// Verification failed (generic: no oracle details)
    #[error("verification failed")]
    VerificationFailed,
    /// Bad key size
    #[error("invalid key size")]
    InvalidKeySize,
}

/// MAC key (zeroed on drop).
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct MacKey {
    bytes: SecureBytes,
    algorithm: MacAlgorithm,
}

impl MacKey {
    /// Wrap key bytes.
    pub fn new(algorithm: MacAlgorithm, bytes: &[u8]) -> Result<Self, MacError> {
        if bytes.len() < 16 {
            return Err(MacError::InvalidKeySize);
        }
        Ok(Self { bytes: SecureBytes::from(bytes), algorithm })
    }
    /// Algorithm.
    pub fn algorithm(&self) -> MacAlgorithm {
        self.algorithm
    }
}

/// MAC tag.
#[derive(Clone, PartialEq, Eq)]
pub struct MacTag(pub alloc::vec::Vec<u8>);

impl MacTag {
    /// Borrow bytes.
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }
}

/// Compute tag over `message`.
pub fn sign(key: &MacKey, message: &[u8]) -> MacTag {
    match key.algorithm() {
        MacAlgorithm::HmacSha256 => {
            let mut m = Hmac::<Sha256>::new_from_slice(key.bytes.as_slice()).expect("hmac");
            m.update(message);
            MacTag(m.finalize().into_bytes().to_vec())
        }
        MacAlgorithm::HmacSha3_256 => {
            let mut m = Hmac::<Sha3_256>::new_from_slice(key.bytes.as_slice()).expect("hmac");
            m.update(message);
            MacTag(m.finalize().into_bytes().to_vec())
        }
    }
}

/// Verify tag in constant time.
pub fn verify(key: &MacKey, message: &[u8], tag: &MacTag) -> Result<(), MacError> {
    let expect = sign(key, message);
    if crate::utils::constant_time_eq(expect.as_bytes(), tag.as_bytes()) {
        Ok(())
    } else {
        Err(MacError::VerificationFailed)
    }
}
