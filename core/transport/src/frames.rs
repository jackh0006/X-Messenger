// SPDX-License-Identifier: AGPL-3.0-or-later
//! Order-independent frame reassembly for animated-QR transfers.
//!
//! A transfer is split into numbered frames; each frame rides as one
//! [`Packet`](crate::packet::Packet) of type `Frame` whose payload is:
//!
//! ```text
//! transfer_id[4] | index[2] | total[2] | chunk
//! ```
//!
//! Frames may arrive in any order, duplicated, or not at all. Completion
//! yields the original bytes only when every index 0..total is present.

use std::collections::HashMap;

use crate::packet::{Packet, PacketError, PacketType};

/// Raw ciphertext bytes per QR frame: keeps codes small and scannable.
pub const FRAME_CHUNK: usize = 700;
pub const FRAME_HEADER: usize = 8;

pub fn split(transfer_id: u32, data: &[u8]) -> Vec<Packet> {
    let chunks: Vec<&[u8]> = if data.is_empty() {
        vec![&[]]
    } else {
        data.chunks(FRAME_CHUNK).collect()
    };
    let total = chunks.len() as u16;
    let mut out = Vec::with_capacity(chunks.len());
    for (i, chunk) in chunks.into_iter().enumerate() {
        let mut payload = Vec::with_capacity(FRAME_HEADER + chunk.len());
        payload.extend_from_slice(&transfer_id.to_be_bytes());
        payload.extend_from_slice(&(i as u16).to_be_bytes());
        payload.extend_from_slice(&total.to_be_bytes());
        payload.extend_from_slice(chunk);
        out.push(Packet {
            ptype: PacketType::Frame,
            flags: 0,
            packet_id: i as u32,
            payload,
        });
    }
    out
}

#[derive(Debug, Default)]
pub struct Reassembler {
    transfer_id: Option<u32>,
    total: Option<u16>,
    chunks: HashMap<u16, Vec<u8>>,
}

impl Reassembler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Feed one decoded frame packet. Returns the full bytes once complete.
    pub fn push(&mut self, packet: &Packet) -> Result<Option<Vec<u8>>, PacketError> {
        if packet.ptype != PacketType::Frame {
            return Err(PacketError::Rejected);
        }
        if packet.payload.len() < FRAME_HEADER {
            return Err(PacketError::Rejected);
        }
        let tid = u32::from_be_bytes([
            packet.payload[0],
            packet.payload[1],
            packet.payload[2],
            packet.payload[3],
        ]);
        let index = u16::from_be_bytes([packet.payload[4], packet.payload[5]]);
        let total = u16::from_be_bytes([packet.payload[6], packet.payload[7]]);
        if total == 0 || index >= total {
            return Err(PacketError::Rejected);
        }
        match (self.transfer_id, self.total) {
            (None, None) => {
                self.transfer_id = Some(tid);
                self.total = Some(total);
            }
            (Some(t), Some(n)) if t == tid && n == total => {}
            _ => return Err(PacketError::Rejected),
        }
        self.chunks
            .entry(index)
            .or_insert_with(|| packet.payload[FRAME_HEADER..].to_vec());
        let total = self.total.unwrap_or(0) as usize;
        if self.chunks.len() == total {
            let mut out = Vec::new();
            for i in 0..total as u16 {
                out.extend_from_slice(&self.chunks[&i]);
            }
            return Ok(Some(out));
        }
        Ok(None)
    }
}
