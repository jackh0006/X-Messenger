//! Binary message envelope. Byte-compatible with the Python `oam` core.
//!
//! ```text
//! MAGIC(4)=OAM1 | ver(1) | mode(1) | flags(1) | msgid(16)
//! contact: eph_x_pub(32) | mlkem_ct(1088) | nonce(24) | fn_len(>H) | fn
//!          | ct_len(>I) | ct | sig(64)
//! words:   salt(16) | nonce(24) | fn_len(>H) | fn | ct_len(>I) | ct
//! ```

/// Envelope magic.
pub const MAGIC: [u8; 4] = *b"OAM1";
/// Envelope version.
pub const VERSION: u8 = 0x01;
/// Contact (public-key) mode.
pub const MODE_CONTACT: u8 = 0x01;
/// Passphrase-words mode.
pub const MODE_WORDS: u8 = 0x02;
/// Flags: payload zlib-compressed.
pub const FLAG_COMPRESSED: u8 = 0x01;

/// Protocol version marker.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProtocolVersion(pub u8);

/// Parsed envelope header (borrowed).
#[derive(Debug, Clone)]
pub struct MessageHeader<'a> {
    /// Protocol version
    pub version: u8,
    /// MODE_CONTACT or MODE_WORDS
    pub mode: u8,
    /// Flags bitmask
    pub flags: u8,
    /// Random message id (16 bytes)
    pub msgid: &'a [u8],
    /// Rest of the envelope after the fixed header
    pub body: &'a [u8],
}

/// Protocol errors (deliberately vague).
#[derive(Debug, thiserror::Error)]
pub enum ProtocolError {
    /// Malformed envelope
    #[error("bad envelope")]
    BadEnvelope,
    /// Unknown mode
    #[error("unknown mode")]
    UnknownMode,
    /// Message too large
    #[error("message too large")]
    TooLarge,
}

/// Full parsed message.
#[derive(Debug, Clone)]
pub struct Message {
    /// Header fields
    pub version: u8,
    /// Mode byte
    pub mode: u8,
    /// Flags
    pub flags: u8,
    /// Message id
    pub msgid: alloc::vec::Vec<u8>,
    /// Raw body after header
    pub body: alloc::vec::Vec<u8>,
}

impl Message {
    /// Parse and validate an envelope.
    pub fn parse(raw: &[u8]) -> Result<Self, ProtocolError> {
        if raw.len() < 7 || raw[..4] != MAGIC || raw[4] != VERSION {
            return Err(ProtocolError::BadEnvelope);
        }
        if raw[5] != MODE_CONTACT && raw[5] != MODE_WORDS {
            return Err(ProtocolError::UnknownMode);
        }
        if raw.len() > crate::MAX_MESSAGE_SIZE {
            return Err(ProtocolError::TooLarge);
        }
        Ok(Self {
            version: raw[4],
            mode: raw[5],
            flags: raw[6],
            msgid: raw[7..23.min(raw.len())].to_vec(),
            body: raw[7..].to_vec(),
        })
    }

    /// Borrowed header view.
    pub fn header<'a>(raw: &'a [u8]) -> Result<MessageHeader<'a>, ProtocolError> {
        let m = Self::parse(raw)?;
        let _ = m;
        Ok(MessageHeader {
            version: raw[4],
            mode: raw[5],
            flags: raw[6],
            msgid: &raw[7..23.min(raw.len())],
            body: &raw[7..],
        })
    }
}
