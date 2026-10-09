// SPDX-License-Identifier: AGPL-3.0-or-later
//! Strict versioned packet codec.
//!
//! Wire format (all integers big-endian):
//!
//! ```text
//! magic[3]="XM1" | version[1]=1 | type[1] | flags[1] | packet_id[4]
//!   | length[4] | payload[length] | crc32[4]
//! ```
//!
//! CRC covers everything before it (error detection only — authenticity
//! comes from the AEAD layer inside the payload). Limits are enforced
//! *before* allocating: oversized length fields are rejected outright.

use crc32fast::Hasher;
use thiserror::Error;

pub const MAGIC: &[u8; 3] = b"XM1";
pub const VERSION: u8 = 1;
/// Largest accepted payload: comfortable QR-transfer ceiling is 64 KiB.
pub const MAX_PAYLOAD: usize = 64 * 1024;
pub const HEADER_LEN: usize = 3 + 1 + 1 + 1 + 4 + 4;
pub const CRC_LEN: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum PacketType {
    /// Opaque ciphertext chunk of a fountain-coded transfer.
    Frame = 1,
    /// Whole small message in one packet.
    Single = 2,
    /// Signed delivery receipt (payload is authenticated upstream).
    Receipt = 3,
}

impl TryFrom<u8> for PacketType {
    type Error = PacketError;
    fn try_from(v: u8) -> Result<Self, Self::Error> {
        match v {
            1 => Ok(Self::Frame),
            2 => Ok(Self::Single),
            3 => Ok(Self::Receipt),
            _ => Err(PacketError::Rejected),
        }
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum PacketError {
    /// Deliberately vague: magic, version, type, length, CRC, trailing.
    #[error("packet rejected")]
    Rejected,
    #[error("payload too large")]
    TooLarge,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Packet {
    pub ptype: PacketType,
    pub flags: u8,
    pub packet_id: u32,
    pub payload: Vec<u8>,
}

impl Packet {
    pub fn encode(&self) -> Result<Vec<u8>, PacketError> {
        if self.payload.len() > MAX_PAYLOAD {
            return Err(PacketError::TooLarge);
        }
        let mut out = Vec::with_capacity(HEADER_LEN + self.payload.len() + CRC_LEN);
        out.extend_from_slice(MAGIC);
        out.push(VERSION);
        out.push(self.ptype as u8);
        out.push(self.flags);
        out.extend_from_slice(&self.packet_id.to_be_bytes());
        out.extend_from_slice(&(self.payload.len() as u32).to_be_bytes());
        out.extend_from_slice(&self.payload);
        let mut h = Hasher::new();
        h.update(&out);
        out.extend_from_slice(&h.finalize().to_be_bytes());
        Ok(out)
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, PacketError> {
        if bytes.len() < HEADER_LEN + CRC_LEN {
            return Err(PacketError::Rejected);
        }
        if &bytes[0..3] != MAGIC {
            return Err(PacketError::Rejected);
        }
        if bytes[3] != VERSION {
            return Err(PacketError::Rejected);
        }
        let ptype = PacketType::try_from(bytes[4])?;
        let flags = bytes[5];
        let packet_id = u32::from_be_bytes([bytes[6], bytes[7], bytes[8], bytes[9]]);
        let len = u32::from_be_bytes([bytes[10], bytes[11], bytes[12], bytes[13]]) as usize;
        if len > MAX_PAYLOAD {
            return Err(PacketError::TooLarge);
        }
        // Exact length: no truncation, no trailing bytes.
        if bytes.len() != HEADER_LEN + len + CRC_LEN {
            return Err(PacketError::Rejected);
        }
        let mut h = Hasher::new();
        h.update(&bytes[..HEADER_LEN + len]);
        let want = h.finalize().to_be_bytes();
        if bytes[HEADER_LEN + len..] != want {
            return Err(PacketError::Rejected);
        }
        Ok(Self {
            ptype,
            flags,
            packet_id,
            payload: bytes[HEADER_LEN..HEADER_LEN + len].to_vec(),
        })
    }
}
