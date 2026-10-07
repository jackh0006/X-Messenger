//! QR frame codec: chunk envelopes into single/animated QR payloads.
//!
//! Byte-compatible with the Python `oam.qrcodec` module.
//!
//! Frame layout: `OAMQ | ver(1) | msgid(16) | total(>H) | index(>H) | parity(1) | data`
//! Parity frame payload: `xor(maxlen) | count(>H) | lens(>H each)`
//! One XOR parity frame per group of [`PARITY_EVERY`] data frames rebuilds any
//! single lost/damaged frame in the group.

use std::collections::HashMap;

/// Frame magic.
pub const FRAME_MAGIC: [u8; 4] = *b"OAMQ";
/// Frame codec version.
pub const FRAME_VER: u8 = 0x01;
/// Envelope bytes per data frame (b64 growth accounted for at the QR layer).
pub const FRAME_SIZE: usize = 1000;
/// Data frames per parity group.
pub const PARITY_EVERY: usize = 5;

/// Frame codec errors.
#[derive(Debug, thiserror::Error)]
pub enum QrError {
    /// Empty input
    #[error("empty envelope")]
    Empty,
    /// Bad frame header
    #[error("bad frame")]
    BadFrame,
    /// Frames from different messages mixed
    #[error("mixed messages")]
    Mixed,
    /// Missing frames even after parity rebuild
    #[error("incomplete: {0}/{1} frames")]
    Incomplete(usize, usize),
}

/// Split an envelope into data + parity frames.
pub fn encode_frames(envelope: &[u8]) -> Result<Vec<Vec<u8>>, QrError> {
    if envelope.is_empty() {
        return Err(QrError::Empty);
    }
    let mid = msgid(envelope);
    let chunks: Vec<&[u8]> = envelope.chunks(FRAME_SIZE).collect();
    let total = chunks.len() as u16;

    let mut out: Vec<Vec<u8>> = Vec::new();
    for (idx, ch) in chunks.iter().enumerate() {
        let mut f = Vec::with_capacity(26 + ch.len());
        f.extend_from_slice(&FRAME_MAGIC);
        f.push(FRAME_VER);
        f.extend_from_slice(&mid);
        f.extend_from_slice(&total.to_be_bytes());
        f.extend_from_slice(&(idx as u16).to_be_bytes());
        f.push(0);
        f.extend_from_slice(ch);
        out.push(f);
    }
    if chunks.len() > 1 {
        for (g, group) in chunks.chunks(PARITY_EVERY).enumerate() {
            let maxlen = group.iter().map(|c| c.len()).max().unwrap_or(0);
            let mut acc = vec![0u8; maxlen];
            for c in group {
                for (i, b) in c.iter().enumerate() {
                    acc[i] ^= b;
                }
            }
            let mut f = Vec::with_capacity(26 + maxlen + 2 + 2 * group.len());
            f.extend_from_slice(&FRAME_MAGIC);
            f.push(FRAME_VER);
            f.extend_from_slice(&mid);
            f.extend_from_slice(&total.to_be_bytes());
            f.extend_from_slice(&(g as u16).to_be_bytes());
            f.push(1);
            f.extend_from_slice(&acc);
            f.extend_from_slice(&(group.len() as u16).to_be_bytes());
            for c in group {
                f.extend_from_slice(&(c.len() as u16).to_be_bytes());
            }
            out.push(f);
        }
    }
    Ok(out)
}

fn msgid(data: &[u8]) -> [u8; 16] {
    use sha3::{Digest, Sha3_256};
    let mut h = Sha3_256::new();
    h.update(b"OAMQ-frame");
    h.update(data);
    let d = h.finalize();
    let mut m = [0u8; 16];
    m.copy_from_slice(&d[..16]);
    m
}

struct Parsed<'a> {
    mid: [u8; 16],
    total: usize,
    index: usize,
    parity: bool,
    payload: &'a [u8],
}

fn parse(frame: &[u8]) -> Result<Parsed<'_>, QrError> {
    if frame.len() < 26 || frame[..4] != FRAME_MAGIC || frame[4] != FRAME_VER {
        return Err(QrError::BadFrame);
    }
    let mut mid = [0u8; 16];
    mid.copy_from_slice(&frame[5..21]);
    let total = u16::from_be_bytes([frame[21], frame[22]]) as usize;
    let index = u16::from_be_bytes([frame[23], frame[24]]) as usize;
    Ok(Parsed { mid, total, index, parity: frame[25] == 1, payload: &frame[26..] })
}

/// Reassemble an envelope from scanned frames (data + optional parity).
pub fn decode_frames(frames: &[Vec<u8>]) -> Result<Vec<u8>, QrError> {
    if frames.is_empty() {
        return Err(QrError::Empty);
    }
    let mut data: HashMap<(Vec<u8>, usize), Vec<u8>> = HashMap::new();
    let mut parity: HashMap<(Vec<u8>, usize), Vec<u8>> = HashMap::new();
    let mut total = None;
    for f in frames {
        let p = parse(f)?;
        let key = p.mid.to_vec();
        match total {
            None => total = Some(p.total),
            Some(t) if t != p.total => return Err(QrError::Mixed),
            _ => {}
        }
        if p.parity {
            parity.insert((key, p.index), p.payload.to_vec());
        } else {
            data.insert((key, p.index), p.payload.to_vec());
        }
    }
    let total = total.unwrap_or(0);
    let mid = parse(&frames[0])?.mid.to_vec();
    if data.keys().any(|(m, _)| *m != mid) || parity.keys().any(|(m, _)| *m != mid) {
        return Err(QrError::Mixed);
    }
    // parity rebuild: one missing data frame per group
    let groups = total.div_ceil(PARITY_EVERY);
    for g in 0..groups {
        let lo = g * PARITY_EVERY;
        let hi = (lo + PARITY_EVERY).min(total);
        let missing: Vec<usize> =
            (lo..hi).filter(|i| !data.contains_key(&(mid.clone(), *i))).collect();
        if missing.len() == 1 {
            if let Some(par) = parity.get(&(mid.clone(), g)) {
                let n = hi - lo;
                if par.len() >= 2 + 2 * n {
                    let tail = &par[par.len() - 2 - 2 * n..];
                    let count = u16::from_be_bytes([tail[0], tail[1]]) as usize;
                    if count == n {
                        let lens: Vec<usize> = (0..n)
                            .map(|k| {
                                u16::from_be_bytes([tail[2 + 2 * k], tail[3 + 2 * k]]) as usize
                            })
                            .collect();
                        let xor = &par[..par.len() - 2 - 2 * n];
                        let mut acc = xor.to_vec();
                        for i in lo..hi {
                            if let Some(c) = data.get(&(mid.clone(), i)) {
                                for (j, b) in c.iter().enumerate() {
                                    if j < acc.len() {
                                        acc[j] ^= b;
                                    }
                                }
                            }
                        }
                        let want = lens[missing[0] - lo].min(acc.len());
                        acc.truncate(want);
                        data.insert((mid.clone(), missing[0]), acc);
                    }
                }
            }
        }
    }
    if (0..total).any(|i| !data.contains_key(&(mid.clone(), i))) {
        let have = (0..total).filter(|i| data.contains_key(&(mid.clone(), *i))).count();
        return Err(QrError::Incomplete(have, total));
    }
    let mut out = Vec::new();
    for i in 0..total {
        out.extend_from_slice(&data[&(mid.clone(), i)]);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn envelope(n: usize) -> Vec<u8> {
        let mut v = b"OAM1".to_vec();
        v.extend((0..n).map(|i| (i * 31 % 251) as u8));
        v
    }

    #[test]
    fn roundtrip_small() {
        let env = envelope(100);
        let fr = encode_frames(&env).unwrap();
        assert_eq!(fr.len(), 1); // no parity for single frame
        assert_eq!(decode_frames(&fr).unwrap(), env);
    }

    #[test]
    fn roundtrip_multi() {
        let env = envelope(4337);
        let fr = encode_frames(&env).unwrap();
        assert!(fr.len() > 1);
        assert_eq!(decode_frames(&fr).unwrap(), env);
    }

    #[test]
    fn parity_rebuild() {
        let env = envelope(4337);
        let fr = encode_frames(&env).unwrap();
        let mut datas: Vec<Vec<u8>> = vec![];
        let mut pars: Vec<Vec<u8>> = vec![];
        for f in &fr {
            let p = parse(f).unwrap();
            if p.parity {
                pars.push(f.clone());
            } else {
                datas.push(f.clone());
            }
        }
        assert!(!pars.is_empty());
        let mut lost = datas[1..].to_vec();
        lost.extend(pars);
        assert_eq!(decode_frames(&lost).unwrap(), env);
    }

    #[test]
    fn incomplete_fails() {
        let env = envelope(4337);
        let fr = encode_frames(&env).unwrap();
        let datas: Vec<Vec<u8>> = fr
            .iter()
            .filter(|f| !parse(f).unwrap().parity)
            .cloned()
            .collect();
        assert!(decode_frames(&datas[2..]).is_err());
    }
}
