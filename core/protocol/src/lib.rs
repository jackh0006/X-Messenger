//! Omni Messenger Protocol Library
//! Protocol definitions for offline messaging with QR codes

#![deny(
    missing_docs,
    missing_debug_implementations,
    trivial_casts,
    trivial_numeric_casts,
    unsafe_code,
    unused_import_braces,
    unused_qualifications
)]
#![forbid(unsafe_code)]

pub mod contact;
pub mod message;
pub mod qr;

pub use contact::{ContactInfo, ContactQr};
pub use message::{EncryptedMessage, EncryptedPackage, MessageFlags, MessageHeader, MessageType, ProtocolError, ProtocolVersion, QrChunk, RatchetState};
pub use qr::{QrData, QrType};

use crate::crypto::{CipherAlgorithm, SignatureAlgorithm, KemAlgorithm};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Protocol Version
pub const PROTOCOL_VERSION: u8 = 1;

/// Message Flags
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum MessageFlags {
    None = 0x00,
    PqRatchet = 0x01,
    Compressed = 0x02,
    Ephemeral = 0x04,
    Receipt = 0x08,
    KeyRotation = 0x10,
}

impl MessageFlags {
    pub fn bits(&self) -> u8 {
        *self as u8
    }

    pub fn from_bits(bits: u8) -> Self {
        match bits {
            0x00 => MessageFlags::None,
            0x01 => MessageFlags::PqRatchet,
            0x02 => MessageFlags::Compressed,
            0x04 => MessageFlags::Ephemeral,
            0x08 => MessageFlags::Receipt,
            0x10 => MessageFlags::KeyRotation,
            _ => MessageFlags::None,
        }
    }
}

/// Protocol Version
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProtocolVersion(pub u8);

impl ProtocolVersion {
    pub const CURRENT: ProtocolVersion = ProtocolVersion(1);
    pub const MIN_SUPPORTED: ProtocolVersion = ProtocolVersion(1);

    pub fn is_compatible(&self, other: ProtocolVersion) -> bool {
        self.0 >= Self::MIN_SUPPORTED.0 && other.0 >= Self::MIN_SUPPORTED.0
    }
}

/// Message Header
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct MessageHeader {
    pub version: ProtocolVersion,
    pub flags: u8,
    pub epoch: u32,
    pub message_num: u64,
    pub dh_ratchet_pk: Vec<u8>,
    pub pq_ratchet_ct: Option<Vec<u8>>,
    pub prev_msg_num: u64,
    pub timestamp: u64,
}

impl MessageHeader {
    pub fn new(
        flags: MessageFlags,
        epoch: u32,
        message_num: u64,
        dh_ratchet_pk: Vec<u8>,
        pq_ratchet_ct: Option<Vec<u8>>,
        prev_msg_num: u64,
    ) -> Self {
        Self {
            version: ProtocolVersion::CURRENT,
            flags: flags.bits(),
            epoch,
            message_num,
            dh_ratchet_pk,
            pq_ratchet_ct,
            prev_msg_num,
            timestamp: crate::crypto::utils::current_timestamp_ms(),
        }
    }

    pub fn has_pq_ratchet(&self) -> bool {
        (self.flags & MessageFlags::PqRatchet as u8) != 0
    }

    pub fn is_compressed(&self) -> bool {
        (self.flags & MessageFlags::Compressed as u8) != 0
    }

    pub fn is_ephemeral(&self) -> bool {
        (self.flags & MessageFlags::Ephemeral as u8) != 0
    }
}

/// Message Structure
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct EncryptedMessage {
    pub header: MessageHeader,
    pub ciphertext: Vec<u8>,
    pub mac: Vec<u8>,
    pub signature: Option<Vec<u8>>,
}

impl EncryptedMessage {
    pub fn new(
        header: MessageHeader,
        ciphertext: Vec<u8>,
        mac: Vec<u8>,
        signature: Option<Vec<u8>>,
    ) -> Self {
        Self {
            header,
            ciphertext,
            mac,
            signature,
        }
    }

    pub fn is_valid(&self) -> bool {
        self.header.version.is_compatible(ProtocolVersion::CURRENT)
            && self.ciphertext.len() <= crate::crypto::MAX_MESSAGE_SIZE
            && self.mac.len() == 32
            && self.signature.as_ref().map_or(true, |s| {
                s.len() == 64 || s.len() == 3293 || s.len() == 64 + 3293
            })
    }

    pub fn total_size(&self) -> usize {
        let header_size = bincode::serialized_size(&self.header).unwrap_or(0) as usize;
        header_size + self.ciphertext.len() + self.mac.len() + self.signature.as_ref().map_or(0, |s| s.len())
    }
}

/// QR Code Chunk
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct QrChunk {
    pub version: u8,
    pub total_chunks: u16,
    pub chunk_index: u16,
    pub message_id: [u8; 16],
    pub payload: Vec<u8>,
    pub crc32: u32,
}

impl QrChunk {
    pub fn new(
        total_chunks: u16,
        chunk_index: u16,
        message_id: [u8; 16],
        payload: Vec<u8>,
    ) -> Self {
        let crc32 = crc32fast::hash(&payload);
        Self {
            version: 1,
            total_chunks,
            chunk_index,
            message_id,
            payload,
            crc32,
        }
    }

    pub fn verify(&self) -> bool {
        crc32fast::hash(&self.payload) == self.crc32
    }

    pub fn max_payload_size() -> usize {
        2953 - 50
    }
}

/// Encrypted Package for QR Transport
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct EncryptedPackage {
    pub version: u8,
    pub algorithm: u8,
    pub nonce: Vec<u8>,
    pub ciphertext: Vec<u8>,
    pub mac: Vec<u8>,
    pub signature: Option<Vec<u8>>,
    pub timestamp: u64,
}

impl EncryptedPackage {
    pub fn new(
        algorithm: CipherAlgorithm,
        nonce: Vec<u8>,
        ciphertext: Vec<u8>,
        mac: Vec<u8>,
        signature: Option<Vec<u8>>,
    ) -> Self {
        Self {
            version: 1,
            algorithm: algorithm as u8,
            nonce,
            ciphertext,
            mac,
            signature,
            timestamp: crate::crypto::utils::current_timestamp_ms(),
        }
    }

    pub fn to_cbor(&self) -> Result<Vec<u8>, crate::crypto::serialization::EncodeError> {
        let mut buf = Vec::new();
        ciborium::ser::into_writer(self, &mut buf)
            .map_err(|e| crate::crypto::serialization::EncodeError::Cbor(e.to_string()))?;
        Ok(buf)
    }

    pub fn from_cbor(data: &[u8]) -> Result<Self, crate::crypto::serialization::DecodeError> {
        ciborium::de::from_reader(data)
            .map_err(|e| crate::crypto::serialization::DecodeError::Cbor(e.to_string()))
    }

    pub fn to_qr_chunks(&self) -> Result<Vec<QrChunk>, ProtocolError> {
        let cbor = self.to_cbor()?;
        let compressed = zstd::encode_all(&cbor[..], 3)
            .map_err(|e| ProtocolError::CompressionFailed(e.to_string()))?;
        
        let message_id = {
            use sha3::{Digest, Sha3_256};
            let mut hasher = Sha3_256::new();
            hasher.update(&compressed);
            let hash = hasher.finalize();
            let mut id = [0u8; 16];
            id.copy_from_slice(&hash[..16]);
            id
        };

        let chunk_size = QrChunk::max_payload_size();
        let mut chunks = Vec::new();
        
        for (i, chunk) in compressed.chunks(chunk_size).enumerate() {
            let chunk = QrChunk::new(
                (compressed.len() + chunk_size - 1) / chunk_size as u16,
                i as u16,
                message_id,
                chunk.to_vec(),
            );
            chunks.push(chunk);
        }
        
        Ok(chunks)
    }

    pub fn from_qr_chunks(chunks: &[QrChunk]) -> Result<Self, ProtocolError> {
        let message_id = chunks[0].message_id;
        for chunk in chunks {
            if chunk.message_id != message_id {
                return Err(ProtocolError::MessageIdMismatch);
            }
            if !chunk.verify() {
                return Err(ProtocolError::CrcMismatch);
            }
        }

        let mut sorted = chunks.to_vec();
        sorted.sort_by_key(|c| c.chunk_index);

        for (i, chunk) in sorted.iter().enumerate() {
            if chunk.chunk_index != i as u16 {
                return Err(ProtocolError::ChunkIndexMismatch);
            }
        }

        let mut compressed = Vec::new();
        for chunk in sorted {
            compressed.extend_from_slice(&chunk.payload);
        }

        let cbor = zstd::decode_all(&compressed[..])
            .map_err(|e| ProtocolError::DecompressionFailed(e.to_string()))?;

        Self::from_cbor(&cbor)
    }
}

/// Protocol Errors
#[derive(Debug, thiserror::Error)]
pub enum ProtocolError {
    #[error("Invalid protocol version")]
    InvalidVersion,
    #[error("Message too large")]
    MessageTooLarge,
    #[error("Invalid MAC")]
    InvalidMac,
    #[error("Invalid signature")]
    InvalidSignature,
    #[error("Decryption failed")]
    DecryptionFailed,
    #[error("Decompression failed: {0}")]
    DecompressionFailed(String),
    #[error("Compression failed: {0}")]
    CompressionFailed(String),
    #[error("CRC mismatch")]
    CrcMismatch,
    #[error("Message ID mismatch")]
    MessageIdMismatch,
    #[error("Chunk index mismatch")]
    ChunkIndexMismatch,
    #[error("Missing chunks")]
    MissingChunks,
    #[error("Invalid QR chunk")]
    InvalidQrChunk,
    #[error("Crypto error: {0}")]
    CryptoError(#[from] crate::crypto::CipherError),
    #[error("Signature error: {0}")]
    SignatureError(#[from] crate::crypto::SignatureError),
    #[error("Serialization error: {0}")]
    SerializationError(String),
}

/// Message Types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum MessageType {
    Message = 0x01,
    KeyExchangeInit = 0x02,
    KeyExchangeResponse = 0x03,
    KeyRotation = 0x04,
    ReadReceipt = 0x05,
    Ephemeral = 0x06,
    ContactRequest = 0x07,
    ContactAccept = 0x08,
    ContactReject = 0x09,
    SyncRequest = 0x0A,
    SyncResponse = 0x0B,
    Ping = 0x0F,
}

impl MessageType {
    pub fn is_key_exchange(&self) -> bool {
        matches!(self, MessageType::KeyExchangeInit | MessageType::KeyExchangeResponse)
    }
}

/// Ratchet State for Protocol
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct RatchetState {
    pub identity_sk: Vec<u8>,
    pub identity_pk: Vec<u8>,
    pub their_identity_pk: Vec<u8>,
    pub root_key: Vec<u8>,
    pub sending_chain_key: Vec<u8>,
    pub sending_dh_ratchet_pk: Vec<u8>,
    pub sending_dh_ratchet_sk: Vec<u8>,
    pub their_dh_ratchet_pk: Option<Vec<u8>>,
    pub receiving_chain_key: Vec<u8>,
    pub receiving_dh_ratchet_pk: Option<Vec<u8>>,
    pub receiving_dh_ratchet_sk: Option<Vec<u8>>,
    pub sending_msg_num: u64,
    pub receiving_msg_num: u64,
    pub max_skip: usize,
    pub skipped_keys: Vec<(u64, u64, Vec<u8>)>, // (epoch, msg_num, key)
    pub pq_ratchet_enabled: bool,
    pub pq_ratchet_counter: u64,
    pub pq_ratchet_interval: u64,
    pub cipher_algorithm: u8,
    pub epoch: u32,
}

/// Contact Info for QR Exchange
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct ContactInfo {
    pub version: u8,
    pub identity_pk: Vec<u8>,
    pub signed_prekey: Vec<u8>,
    pub prekey_signature: Vec<u8>,
    pub one_time_prekeys: Vec<Vec<u8>>,
    pub display_name: String,
    pub avatar_hash: Option<Vec<u8>>,
    pub timestamp: u64,
    pub expires_at: Option<u64>,
}

impl ContactInfo {
    pub fn to_qr_base64(&self) -> Result<String, crate::crypto::serialization::EncodeError> {
        let mut buf = Vec::new();
        ciborium::ser::into_writer(self, &mut buf)
            .map_err(|e| crate::crypto::serialization::EncodeError::Cbor(e.to_string()))?;
        
        let compressed = zstd::encode_all(&buf[..], 3)
            .map_err(|e| crate::crypto::serialization::EncodeError::Compression(e.to_string()))?;
        
        Ok(base64::encode_config(&compressed, base64::URL_SAFE_NO_PAD))
    }

    pub fn from_qr_base64(s: &str) -> Result<Self, crate::crypto::serialization::DecodeError> {
        let compressed = crate::crypto::serialization::decode_base64url(s)?;
        let decompressed = crate::crypto::serialization::decompress(&compressed)?;
        ciborium::de::from_reader(&decompressed[..])
            .map_err(|e| crate::crypto::serialization::DecodeError::Cbor(e.to_string()))
    }

    pub fn fingerprint(&self) -> String {
        use sha3::{Digest, Sha3_256};
        let mut hasher = Sha3_256::new();
        hasher.update(&self.identity_pk);
        let hash = hasher.finalize();
        hex::encode(&hash[..32])
    }
}

impl Default for ContactInfo {
    fn default() -> Self {
        Self {
            version: 1,
            identity_pk: Vec::new(),
            signed_prekey: Vec::new(),
            prekey_signature: Vec::new(),
            one_time_prekeys: Vec::new(),
            display_name: String::new(),
            avatar_hash: None,
            timestamp: crate::crypto::utils::current_timestamp_ms(),
            expires_at: None,
        }
    }
}

/// QR Code Data Types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum QrType {
    Contact = 1,
    Message = 2,
    ProxyConfig = 3,
    PublicKey = 4,
    SessionKey = 5,
}

/// QR Code Data Wrapper
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct QrData {
    pub version: u8,
    pub qr_type: QrType,
    pub payload: Vec<u8>,
    pub timestamp: u64,
}

impl QrData {
    pub fn new(qr_type: QrType, payload: Vec<u8>) -> Self {
        Self {
            version: 1,
            qr_type,
            payload,
            timestamp: crate::crypto::utils::current_timestamp_ms(),
        }
    }

    pub fn to_base64url(&self) -> Result<String, crate::crypto::serialization::EncodeError> {
        let cbor = self.to_cbor()?;
        Ok(base64::encode_config(&cbor, base64::URL_SAFE_NO_PAD))
    }

    pub fn from_base64url(s: &str) -> Result<Self, crate::crypto::serialization::DecodeError> {
        let cbor = crate::crypto::serialization::decode_base64url(s)?;
        Self::from_cbor(&cbor)
    }

    pub fn to_cbor(&self) -> Result<Vec<u8>, crate::crypto::serialization::EncodeError> {
        let mut buf = Vec::new();
        ciborium::ser::into_writer(self, &mut buf)
            .map_err(|e| crate::crypto::serialization::EncodeError::Cbor(e.to_string()))?;
        Ok(buf)
    }

    pub fn from_cbor(data: &[u8]) -> Result<Self, crate::crypto::serialization::DecodeError> {
        ciborium::de::from_reader(data)
            .map_err(|e| crate::crypto::serialization::DecodeError::Cbor(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_header() {
        let header = MessageHeader::new(
            MessageFlags::None,
            1,
            1,
            vec![0u8; 32],
            None,
            0,
        );
        assert_eq!(header.version.0, 1);
        assert_eq!(header.flags, 0);
    }

    #[test]
    fn test_qr_chunk() {
        let mut message_id = [0u8; 16];
        message_id[0] = 1;
        let chunk = QrChunk::new(1, 0, message_id, vec![0u8; 100]);
        assert!(chunk.verify());
    }

    #[test]
    fn test_encrypted_package() {
        let pkg = EncryptedPackage::new(
            CipherAlgorithm::XChaCha20Poly1305,
            vec![0u8; 24],
            vec![0u8; 100],
            vec![0u8; 32],
            None,
        );
        let cbor = pkg.to_cbor().unwrap();
        let decoded = EncryptedPackage::from_cbor(&cbor).unwrap();
        assert_eq!(pkg.ciphertext, decoded.ciphertext);
    }

    #[test]
    fn test_qr_chunks() {
        let pkg = EncryptedPackage::new(
            CipherAlgorithm::XChaCha20Poly1305,
            vec![0u8; 24],
            vec![0u8; 5000],
            vec![0u8; 32],
            None,
        );
        let chunks = pkg.to_qr_chunks().unwrap();
        assert!(chunks.len() > 1);
        let reconstructed = EncryptedPackage::from_qr_chunks(&chunks).unwrap();
        assert_eq!(pkg.ciphertext, reconstructed.ciphertext);
    }

    #[test]
    fn test_contact_qr() {
        let contact = ContactInfo {
            version: 1,
            identity_pk: vec![0u8; 32 + 1952],
            signed_prekey: vec![0u8; 32],
            prekey_signature: vec![0u8; 64],
            one_time_prekeys: vec![vec![0u8; 32]; 10],
            display_name: "Test User".to_string(),
            avatar_hash: None,
            timestamp: 1234567890,
            expires_at: None,
        };
        let qr = contact.to_qr_base64().unwrap();
        let restored = ContactInfo::from_qr_base64(&qr).unwrap();
        assert_eq!(contact.display_name, restored.display_name);
        assert_eq!(contact.identity_pk, restored.identity_pk);
    }
}