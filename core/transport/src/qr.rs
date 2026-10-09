// SPDX-License-Identifier: AGPL-3.0-or-later
//! QR encode/decode for opaque frame bytes.
//!
//! Binary ciphertext cannot go into a QR directly, so frames travel as
//! base64url text (an encoding, not encryption). Encode via `qrcodegen`,
//! decode from camera pixels via `rxing`. The pixel grid this module
//! produces (quiet zone + integer scale) is exactly what a camera sees.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use qrcodegen::{QrCode, QrCodeEcc};
use rxing::{common::HybridBinarizer, BinaryBitmap, DecodeHints, Luma8Source, Reader};
use thiserror::Error;

use crate::packet::Packet;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum QrError {
    #[error("frame does not fit any QR code")]
    TooLarge,
    #[error("unreadable frame")]
    Unreadable,
    #[error("packet rejected")]
    Rejected,
}

/// Modules per side -> pixel size mapping for rendering/scanning.
pub const QUIET_ZONE: usize = 4;
pub const SCALE: u32 = 8;

pub struct QrFrame {
    pub size: usize,
    pub pixels: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

/// Encode one packet as a scannable grayscale QR image (8-bit, row-major).
pub fn encode_packet(packet: &Packet) -> Result<QrFrame, QrError> {
    let wire = packet.encode().map_err(|_| QrError::TooLarge)?;
    let text = URL_SAFE_NO_PAD.encode(&wire);
    let code = QrCode::encode_text(&text, QrCodeEcc::Medium)
        .or_else(|_| QrCode::encode_text(&text, QrCodeEcc::Low))
        .map_err(|_| QrError::TooLarge)?;
    let modules = code.size() as usize;
    let side = (modules + 2 * QUIET_ZONE) as u32 * SCALE;
    let mut pixels = vec![255u8; (side * side) as usize];
    for y in 0..modules {
        for x in 0..modules {
            let v = if code.get_module(x as i32, y as i32) {
                0u8
            } else {
                255u8
            };
            for dy in 0..SCALE {
                for dx in 0..SCALE {
                    let px = ((x + QUIET_ZONE) as u32 * SCALE + dx) as usize;
                    let py = ((y + QUIET_ZONE) as u32 * SCALE + dy) as usize;
                    pixels[py * side as usize + px] = v;
                }
            }
        }
    }
    Ok(QrFrame {
        size: modules,
        pixels,
        width: side,
        height: side,
    })
}

/// Decode a grayscale camera frame back into the packet it shows.
pub fn decode_pixels(pixels: &[u8], width: u32, height: u32) -> Result<Packet, QrError> {
    let source =
        Luma8Source::new(pixels.to_vec(), width, height).map_err(|_| QrError::Unreadable)?;
    let mut bitmap = BinaryBitmap::new(HybridBinarizer::new(source));
    let mut reader = rxing::qrcode::QRCodeReader::new();
    let hints = DecodeHints::default();
    let result = reader
        .decode_with_hints(&mut bitmap, &hints)
        .map_err(|_| QrError::Unreadable)?;
    let wire = URL_SAFE_NO_PAD
        .decode(result.getText())
        .map_err(|_| QrError::Unreadable)?;
    Packet::decode(&wire).map_err(|_| QrError::Rejected)
}
