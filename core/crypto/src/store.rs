//! Encrypted local store: scrypt + XChaCha20-Poly1305 sealed JSON.
//!
//! File layout: `OAMS | ver(1) | salt(16) | nonce(24) | ciphertext`
//! Matches the Python `oam.store` module.

use chacha20poly1305::{
    aead::{Aead, KeyInit, Payload},
    XChaCha20Poly1305, XNonce,
};
use scrypt::{scrypt, Params as ScryptParams};

/// Store magic.
pub const STORE_MAGIC: [u8; 4] = *b"OAMS";
/// Store version.
pub const STORE_VER: u8 = 0x01;

/// Store errors (deliberately vague).
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    /// Wrong passphrase or corrupt store (indistinguishable by design)
    #[error("wrong passphrase or corrupt store")]
    Open,
    /// Bad file layout
    #[error("cannot open store")]
    Format,
}

fn stretch(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], StoreError> {
    // N=2^14 (~16 MiB): fast unlock, OpenSSL-friendly. Message keys use Argon2id.
    let params = ScryptParams::new(14, 8, 1, 32).map_err(|_| StoreError::Format)?;
    let mut out = [0u8; 32];
    scrypt(passphrase.as_bytes(), salt, &params, &mut out).map_err(|_| StoreError::Open)?;
    Ok(out)
}

/// Seal JSON bytes into a store blob.
pub fn seal(passphrase: &str, json: &[u8]) -> Result<Vec<u8>, StoreError> {
    use rand_core::RngCore;
    let mut salt = [0u8; 16];
    let mut nonce = [0u8; 24];
    rand_core::OsRng.fill_bytes(&mut salt);
    rand_core::OsRng.fill_bytes(&mut nonce);
    let key = stretch(passphrase, &salt)?;
    let aad: &[u8] = &[STORE_MAGIC[0], STORE_MAGIC[1], STORE_MAGIC[2], STORE_MAGIC[3], STORE_VER];
    let ct = XChaCha20Poly1305::new((&key).into())
        .encrypt(
            XNonce::from_slice(&nonce),
            Payload { msg: json, aad },
        )
        .map_err(|_| StoreError::Open)?;
    let mut out = Vec::with_capacity(5 + 16 + 24 + ct.len());
    out.extend_from_slice(&STORE_MAGIC);
    out.push(STORE_VER);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ct);
    Ok(out)
}

/// Open a store blob with the passphrase.
pub fn open(passphrase: &str, blob: &[u8]) -> Result<Vec<u8>, StoreError> {
    if blob.len() < 45 || blob[..4] != STORE_MAGIC || blob[4] != STORE_VER {
        return Err(StoreError::Format);
    }
    let salt = &blob[5..21];
    let nonce = &blob[21..45];
    let ct = &blob[45..];
    let key = stretch(passphrase, salt)?;
    let aad: &[u8] = &[STORE_MAGIC[0], STORE_MAGIC[1], STORE_MAGIC[2], STORE_MAGIC[3], STORE_VER];
    XChaCha20Poly1305::new((&key).into())
        .decrypt(
            XNonce::from_slice(nonce),
            Payload { msg: ct, aad },
        )
        .map_err(|_| StoreError::Open)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roundtrip() {
        let blob = seal("test passphrase words here", b"{\"a\":1}").unwrap();
        assert_eq!(open("test passphrase words here", &blob).unwrap(), b"{\"a\":1}");
    }
    #[test]
    fn wrong_passphrase_fails() {
        let blob = seal("test passphrase words here", b"{\"a\":1}").unwrap();
        assert!(open("wrong passphrase words here!!", &blob).is_err());
    }
}
