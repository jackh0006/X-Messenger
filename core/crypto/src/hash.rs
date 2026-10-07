//! One-shot hashing: SHA-256 / SHA3-256 / SHA3-512 / BLAKE2b-256.
use sha2::{Digest, Sha256};
use sha3::{Sha3_256, Sha3_512};

/// Hash algorithms.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HashAlgorithm {
    /// SHA-256
    Sha256,
    /// SHA3-256
    Sha3_256,
    /// SHA3-512
    Sha3_512,
    /// BLAKE2b-256
    Blake2b256,
}

/// Hash output bytes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HashOutput(pub alloc::vec::Vec<u8>);

impl HashOutput {
    /// Borrow bytes.
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }
}

/// Hash `data` with `algorithm`.
pub fn hash(algorithm: HashAlgorithm, data: &[u8]) -> HashOutput {
    match algorithm {
        HashAlgorithm::Sha256 => {
            let mut h = Sha256::new();
            h.update(data);
            HashOutput(h.finalize().to_vec())
        }
        HashAlgorithm::Sha3_256 => {
            let mut h = Sha3_256::new();
            h.update(data);
            HashOutput(h.finalize().to_vec())
        }
        HashAlgorithm::Sha3_512 => {
            let mut h = Sha3_512::new();
            h.update(data);
            HashOutput(h.finalize().to_vec())
        }
        HashAlgorithm::Blake2b256 => {
            use blake2::{Blake2b, Digest as _};
            let mut h = Blake2b::<blake2::digest::consts::U32>::new();
            h.update(data);
            HashOutput(h.finalize().to_vec())
        }
    }
}
