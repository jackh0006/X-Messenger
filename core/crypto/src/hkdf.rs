//! HKDF with SHA-256 / SHA3-256 / SHA3-512 (RFC 5869 construction).
use hmac::{Hmac, Mac};
use sha2::Sha256;
use sha3::{Sha3_256, Sha3_512};

/// Hash choice for HKDF.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HkdfAlgorithm {
    /// HMAC-SHA-256
    Sha256,
    /// HMAC-SHA3-256
    Sha3_256,
    /// HMAC-SHA3-512
    Sha3_512,
}

/// HKDF errors.
#[derive(Debug, thiserror::Error)]
pub enum HkdfError {
    /// Output too long
    #[error("output too long")]
    OutputTooLong,
    /// Bad parameter
    #[error("invalid parameter")]
    InvalidParam,
}

/// HKDF instance bound to an algorithm and salt/context.
pub struct Hkdf {
    algorithm: HkdfAlgorithm,
    salt: alloc::vec::Vec<u8>,
}

impl Hkdf {
    /// Create with algorithm and salt/context label.
    pub fn new(algorithm: HkdfAlgorithm, salt: &[u8]) -> Self {
        Self { algorithm, salt: salt.to_vec() }
    }

    /// Extract: PRK = HMAC(salt, ikm).
    pub fn extract(&self, salt: &[u8], ikm: &[u8]) -> Result<alloc::vec::Vec<u8>, HkdfError> {
        let s = if salt.is_empty() { &self.salt } else { salt };
        Ok(match self.algorithm {
            HkdfAlgorithm::Sha256 => {
                let mut m = Hmac::<Sha256>::new_from_slice(s).map_err(|_| HkdfError::InvalidParam)?;
                m.update(ikm);
                m.finalize().into_bytes().to_vec()
            }
            HkdfAlgorithm::Sha3_256 => {
                let mut m = Hmac::<Sha3_256>::new_from_slice(s).map_err(|_| HkdfError::InvalidParam)?;
                m.update(ikm);
                m.finalize().into_bytes().to_vec()
            }
            HkdfAlgorithm::Sha3_512 => {
                let mut m = Hmac::<Sha3_512>::new_from_slice(s).map_err(|_| HkdfError::InvalidParam)?;
                m.update(ikm);
                m.finalize().into_bytes().to_vec()
            }
        })
    }

    /// Expand: OKM = T(1) || T(2) || ... truncated to `okm.len()`.
    pub fn expand(&self, prk: &[u8], info: &[u8], okm: &mut [u8]) -> Result<(), HkdfError> {
        if okm.len() > 255 * 64 {
            return Err(HkdfError::OutputTooLong);
        }
        let mut prev: alloc::vec::Vec<u8> = alloc::vec::Vec::new();
        let mut out = 0usize;
        let mut counter = 1u8;
        while out < okm.len() {
            let t: alloc::vec::Vec<u8> = match self.algorithm {
                HkdfAlgorithm::Sha256 => {
                    let mut m = Hmac::<Sha256>::new_from_slice(prk).map_err(|_| HkdfError::InvalidParam)?;
                    m.update(&prev);
                    m.update(info);
                    m.update(&[counter]);
                    m.finalize().into_bytes().to_vec()
                }
                HkdfAlgorithm::Sha3_256 => {
                    let mut m = Hmac::<Sha3_256>::new_from_slice(prk).map_err(|_| HkdfError::InvalidParam)?;
                    m.update(&prev);
                    m.update(info);
                    m.update(&[counter]);
                    m.finalize().into_bytes().to_vec()
                }
                HkdfAlgorithm::Sha3_512 => {
                    let mut m = Hmac::<Sha3_512>::new_from_slice(prk).map_err(|_| HkdfError::InvalidParam)?;
                    m.update(&prev);
                    m.update(info);
                    m.update(&[counter]);
                    m.finalize().into_bytes().to_vec()
                }
            };
            let n = core::cmp::min(t.len(), okm.len() - out);
            okm[out..out + n].copy_from_slice(&t[..n]);
            out += n;
            prev = t;
            counter = counter.wrapping_add(1);
        }
        Ok(())
    }
}
