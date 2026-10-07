//! AEAD Cipher Implementations
//! Supports XChaCha20-Poly1305 (RFC 8439) and AES-256-GCM-SIV (RFC 8452)

use crate::utils::SecureBytes;
use core::fmt;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// AEAD Cipher algorithms supported
#[derive(Debug, Clone, Copy, PartialEq, Eq, Zeroize)]
pub enum CipherAlgorithm {
    /// XChaCha20-Poly1305 (RFC 8439) - 192-bit nonce, fast on ARM
    XChaCha20Poly1305,
    /// AES-256-GCM-SIV (RFC 8452) - Nonce-misuse resistant
    Aes256GcmSiv,
}

impl CipherAlgorithm {
    /// Key size in bytes
    pub const fn key_size(&self) -> usize {
        32 // 256 bits for both algorithms
    }

    /// Nonce size in bytes
    pub const fn nonce_size(&self) -> usize {
        match self {
            CipherAlgorithm::XChaCha20Poly1305 => 24, // 192-bit nonce
            CipherAlgorithm::Aes256GcmSiv => 12,      // 96-bit nonce
        }
    }

    /// Tag size in bytes
    pub const fn tag_size(&self) -> usize {
        16 // 128-bit tag for both
    }
}

/// AEAD Cipher trait for unified interface
pub trait AeadCipher: Send + Sync {
    fn algorithm(&self) -> CipherAlgorithm;
    fn encrypt(&self, key: &AeadKey, nonce: &Nonce, plaintext: &[u8], aad: &[u8]) -> Result<Ciphertext, CipherError>;
    fn decrypt(&self, key: &AeadKey, nonce: &Nonce, ciphertext: &Ciphertext, aad: &[u8]) -> Result<SecureBytes, CipherError>;
}

/// AEAD Key wrapper with zeroize
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct AeadKey {
    key: SecureBytes,
    algorithm: CipherAlgorithm,
}

impl AeadKey {
    pub fn new(algorithm: CipherAlgorithm, key: &[u8]) -> Result<Self, CipherError> {
        if key.len() != algorithm.key_size() {
            return Err(CipherError::InvalidKeySize);
        }
        Ok(Self {
            key: SecureBytes::from(key),
            algorithm,
        })
    }

    pub fn generate(algorithm: CipherAlgorithm) -> Self {
        use rand_core::RngCore;
        let mut key = vec![0u8; algorithm.key_size()];
        rand_core::OsRng.fill_bytes(&mut key);
        Self {
            key: SecureBytes::from(key),
            algorithm,
        }
    }

    pub fn algorithm(&self) -> CipherAlgorithm {
        self.algorithm
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.key.as_slice()
    }
}

impl fmt::Debug for AeadKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AeadKey")
            .field("algorithm", &self.algorithm)
            .field("key", &"[REDACTED]")
            .finish()
    }
}

/// Nonce for AEAD operations
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct Nonce {
    bytes: [u8; 24], // Max size for XChaCha20
    len: usize,
}

impl Nonce {
    pub fn new(algorithm: CipherAlgorithm, bytes: &[u8]) -> Result<Self, CipherError> {
        let required = algorithm.nonce_size();
        if bytes.len() != required {
            return Err(CipherError::InvalidNonceSize);
        }
        let mut nonce = Self { bytes: [0; 24], len: required };
        nonce.bytes[..required].copy_from_slice(bytes);
        Ok(nonce)
    }

    pub fn random(algorithm: CipherAlgorithm) -> Self {
        use rand_core::RngCore;
        let mut nonce = Self { bytes: [0; 24], len: algorithm.nonce_size() };
        rand_core::OsRng.fill_bytes(&mut nonce.bytes[..algorithm.nonce_size()]);
        nonce
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes[..self.len]
    }

    pub fn len(&self) -> usize {
        self.len
    }
}

impl fmt::Debug for Nonce {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Nonce")
            .field("bytes", &hex::encode(&self.bytes[..self.len]))
            .finish()
    }
}

/// Ciphertext with authentication tag
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct Ciphertext {
    data: SecureBytes,
}

impl Ciphertext {
    pub fn new(data: Vec<u8>) -> Self {
        Self {
            data: SecureBytes::from(data),
        }
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.data.as_slice()
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
}

impl fmt::Debug for Ciphertext {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Ciphertext")
            .field("len", &self.data.len())
            .finish()
    }
}

/// Cipher errors
#[derive(Debug, thiserror::Error)]
pub enum CipherError {
    #[error("Invalid key size")]
    InvalidKeySize,
    #[error("Invalid nonce size")]
    InvalidNonceSize,
    #[error("Authentication failed")]
    AuthFailed,
    #[error("Message too large")]
    MessageTooLarge,
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
}

/// XChaCha20-Poly1305 Implementation (RFC 8439)
pub struct XChaCha20Poly1305;

impl AeadCipher for XChaCha20Poly1305 {
    fn algorithm(&self) -> CipherAlgorithm {
        CipherAlgorithm::XChaCha20Poly1305
    }

    fn encrypt(&self, key: &AeadKey, nonce: &Nonce, plaintext: &[u8], aad: &[u8]) -> Result<Ciphertext, CipherError> {
        use chacha20poly1305::{
            aead::{Aead, KeyInit, Payload},
            XChaCha20Poly1305 as XChaCha,
        };

        if plaintext.len() > crate::MAX_MESSAGE_SIZE {
            return Err(CipherError::MessageTooLarge);
        }

        let cipher = XChaCha::new(key.as_bytes().into());
        let nonce = chacha20poly1305::XNonce::from_slice(nonce.as_bytes());
        let payload = Payload { msg: plaintext, aad };

        let mut ciphertext = cipher.encrypt(nonce, payload)
            .map_err(|e| CipherError::EncryptionFailed(e.to_string()))?;

        Ok(Ciphertext::new(ciphertext))
    }

    fn decrypt(&self, key: &AeadKey, nonce: &Nonce, ciphertext: &Ciphertext, aad: &[u8]) -> Result<SecureBytes, CipherError> {
        use chacha20poly1305::{
            aead::{Aead, KeyInit, Payload},
            XChaCha20Poly1305 as XChaCha,
        };

        let cipher = XChaCha::new(key.as_bytes().into());
        let nonce = chacha20poly1305::XNonce::from_slice(nonce.as_bytes());
        let payload = Payload { msg: ciphertext.as_bytes(), aad };

        let plaintext = cipher.decrypt(nonce, payload)
            .map_err(|_| CipherError::AuthFailed)?;

        Ok(SecureBytes::from(plaintext))
    }
}

/// AES-256-GCM-SIV Implementation (RFC 8452) - Nonce-misuse resistant
pub struct Aes256GcmSiv;

impl AeadCipher for Aes256GcmSiv {
    fn algorithm(&self) -> CipherAlgorithm {
        CipherAlgorithm::Aes256GcmSiv
    }

    fn encrypt(&self, key: &AeadKey, nonce: &Nonce, plaintext: &[u8], aad: &[u8]) -> Result<Ciphertext, CipherError> {
        use aes_gcm_siv::{
            aead::{Aead, KeyInit, Payload},
            Aes256GcmSiv as AesGcmSiv,
        };

        if plaintext.len() > crate::MAX_MESSAGE_SIZE {
            return Err(CipherError::MessageTooLarge);
        }

        let cipher = AesGcmSiv::new(key.as_bytes().into());
        let nonce = aes_gcm_siv::Nonce::from_slice(nonce.as_bytes());
        let payload = Payload { msg: plaintext, aad };

        let mut ciphertext = cipher.encrypt(nonce, payload)
            .map_err(|e| CipherError::EncryptionFailed(e.to_string()))?;

        Ok(Ciphertext::new(ciphertext))
    }

    fn decrypt(&self, key: &AeadKey, nonce: &Nonce, ciphertext: &Ciphertext, aad: &[u8]) -> Result<SecureBytes, CipherError> {
        use aes_gcm_siv::{
            aead::{Aead, KeyInit, Payload},
            Aes256GcmSiv as AesGcmSiv,
        };

        let cipher = AesGcmSiv::new(key.as_bytes().into());
        let nonce = aes_gcm_siv::Nonce::from_slice(nonce.as_bytes());
        let payload = Payload { msg: ciphertext.as_bytes(), aad };

        let plaintext = cipher.decrypt(nonce, payload)
            .map_err(|_| CipherError::AuthFailed)?;

        Ok(SecureBytes::from(plaintext))
    }
}

/// Factory function to get cipher implementation
pub fn get_cipher(algorithm: CipherAlgorithm) -> Box<dyn AeadCipher> {
    match algorithm {
        CipherAlgorithm::XChaCha20Poly1305 => Box::new(XChaCha20Poly1305),
        CipherAlgorithm::Aes256GcmSiv => Box::new(Aes256GcmSiv),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_xchacha20_encrypt_decrypt() {
        let key = AeadKey::generate(CipherAlgorithm::XChaCha20Poly1305);
        let nonce = Nonce::random(CipherAlgorithm::XChaCha20Poly1305);
        let plaintext = b"Hello, World!";
        let aad = b"additional data";

        let cipher = XChaCha20Poly1305;
        let ciphertext = cipher.encrypt(&key, &nonce, plaintext, aad).unwrap();
        let decrypted = cipher.decrypt(&key, &nonce, &ciphertext, aad).unwrap();

        assert_eq!(decrypted.as_slice(), plaintext);
    }

    #[test]
    fn test_aes_gcm_siv_encrypt_decrypt() {
        let key = AeadKey::generate(CipherAlgorithm::Aes256GcmSiv);
        let nonce = Nonce::random(CipherAlgorithm::Aes256GcmSiv);
        let plaintext = b"Hello, World!";
        let aad = b"additional data";

        let cipher = Aes256GcmSiv;
        let ciphertext = cipher.encrypt(&key, &nonce, plaintext, aad).unwrap();
        let decrypted = cipher.decrypt(&key, &nonce, &ciphertext, aad).unwrap();

        assert_eq!(decrypted.as_slice(), plaintext);
    }

    #[test]
    fn test_nonce_misuse_resistance_aes_gcm_siv() {
        // AES-GCM-SIV should be resistant to nonce reuse
        let key = AeadKey::generate(CipherAlgorithm::Aes256GcmSiv);
        let nonce = Nonce::new(CipherAlgorithm::Aes256GcmSiv, &[0u8; 12]).unwrap();
        let aad = b"aad";

        let cipher = Aes256GcmSiv;
        
        // Encrypt two different messages with same nonce
        let ct1 = cipher.encrypt(&key, &nonce, b"message 1", b"aad").unwrap();
        let ct2 = cipher.encrypt(&key, &nonce, b"message 2", b"aad").unwrap();

        // Both should decrypt correctly (nonce-misuse resistance)
        let pt1 = cipher.decrypt(&key, &nonce, &ct1, b"aad").unwrap();
        let pt2 = cipher.decrypt(&key, &nonce, &ct2, b"aad").unwrap();

        assert_eq!(pt1.as_slice(), b"message 1");
        assert_eq!(pt2.as_slice(), b"message 2");
        // Ciphertexts should be different even with same nonce
        assert_ne!(ct1.as_bytes(), ct2.as_bytes());
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = AeadKey::generate(CipherAlgorithm::XChaCha20Poly1305);
        let key2 = AeadKey::generate(CipherAlgorithm::XChaCha20Poly1305);
        let nonce = Nonce::random(CipherAlgorithm::XChaCha20Poly1305);
        let plaintext = b"Hello";
        let aad = b"aad";

        let cipher = XChaCha20Poly1305;
        let ciphertext = cipher.encrypt(&key1, &nonce, plaintext, aad).unwrap();
        
        let result = cipher.decrypt(&key2, &nonce, &ciphertext, aad);
        assert!(result.is_err());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let key = AeadKey::generate(CipherAlgorithm::XChaCha20Poly1305);
        let nonce = Nonce::random(CipherAlgorithm::XChaCha20Poly1305);
        let plaintext = b"Hello";
        let aad = b"aad";

        let cipher = XChaCha20Poly1305;
        let ciphertext = cipher.encrypt(&key, &nonce, plaintext, aad).unwrap();

        // Tamper with ciphertext
        let mut data = ciphertext.as_bytes().to_vec();
        let last = data.len() - 1;
        data[last] ^= 0xFF; // Flip last bit
        let tampered = Ciphertext::new(data);

        let result = cipher.decrypt(&key, &nonce, &tampered, aad);
        assert!(result.is_err());
    }
}