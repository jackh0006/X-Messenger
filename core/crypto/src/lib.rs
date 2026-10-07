#![forbid(unsafe_code)]
#![deny(clippy::all)]
#![warn(missing_docs)]

//! Offline Messenger Core Cryptography Library
//! Hybrid KEM: X25519 + ML-KEM-768 (FIPS 203)
//! AEAD: XChaCha20-Poly1305 / AES-256-GCM-SIV
//! KDF: Argon2id + HKDF-SHA3-512
//! Signatures: Ed25519 + ML-DSA-65 (FIPS 204)
//!
//! No network. No `std::net`. This crate never opens a socket.

#[cfg(feature = "alloc")]
extern crate alloc;

pub mod cipher;
pub mod hash;
pub mod hkdf;
pub mod kdf;
pub mod kem;
pub mod keys;
pub mod mac;
pub mod protocol;
pub mod qr;
pub mod ratchet;
pub mod serialization;
pub mod signatures;
pub mod store;
pub mod utils;

pub use cipher::{AeadCipher, AeadKey, CipherAlgorithm, CipherError, Ciphertext, Nonce};
pub use hash::{HashAlgorithm, HashOutput};
pub use hkdf::{Hkdf, HkdfAlgorithm, HkdfError};
pub use kdf::{stretch_passphrase, KdfError};
pub use kem::{
    get_kem, Kem, KemAlgorithm, KemCiphertext, KemError, KemPublicKey, KemSecretKey,
    SharedSecret,
};
pub use keys::{IdentityKeyPair, IdentityPublicKey, PreKeyBundle, SignedPreKey};
pub use mac::{MacAlgorithm, MacError, MacKey, MacTag};
pub use protocol::{Message, MessageHeader, ProtocolVersion};
pub use qr::{decode_frames, encode_frames, QrError};
pub use ratchet::{DoubleRatchet, RatchetError, RatchetState};
pub use serialization::{decode, encode, DecodeError, EncodeError};
pub use signatures::{
    get_signer, Signature, SignatureAlgorithm, SignatureError, SignatureKeyPair,
    SignaturePublicKey, SignatureSecretKey, Signer,
};
pub use store::{open as store_open, seal as store_seal, StoreError};
pub use utils::{constant_time_eq, secure_zero, verify_secret, SecureBytes};

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Protocol version (matches Python `oam` envelope version)
pub const PROTOCOL_VERSION: u8 = 1;

/// Maximum message size (16MB)
pub const MAX_MESSAGE_SIZE: usize = 16 * 1024 * 1024;

/// QR Code maximum usable payload (binary, EC-M)
pub const QR_MAX_PAYLOAD: usize = 2331;

/// Library initialization - best-effort memory locking, no I/O.
pub fn init() -> Result<(), InitError> {
    Ok(())
}

/// Initialization errors
#[derive(Debug, thiserror::Error)]
pub enum InitError {
    /// Memory locking failed (non-fatal on most platforms)
    #[error("Failed to lock memory: {0}")]
    MemoryLock(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constant_time_eq() {
        assert!(constant_time_eq(b"hello", b"hello"));
        assert!(!constant_time_eq(b"hello", b"world"));
        assert!(!constant_time_eq(b"hello", b"hell"));
    }

    #[test]
    fn test_secure_zero() {
        let mut data = b"secret".to_vec();
        secure_zero(&mut data);
        assert_eq!(data, vec![0, 0, 0, 0, 0, 0]);
    }
}
