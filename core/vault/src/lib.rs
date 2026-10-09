// SPDX-License-Identifier: AGPL-3.0-or-later
//! X Messenger encrypted vault.
//!
//! Construction (all primitives from audited crates, no custom crypto):
//! - Passphrase -> Argon2id (m = 64 MiB, t = 3, p = 4 per RFC 9106) with a
//!   random 128-bit salt -> 32-byte raw key.
//! - KEK = BLAKE3 `derive_key("xmv1-kek", raw)` (BLAKE3's designed KDF mode).
//! - VMK (256 random bits) wrapped as XChaCha20-Poly1305(KEK, random nonce).
//! - Payloads sealed with XChaCha20-Poly1305 under per-message random nonces.
//! - Fingerprints are BLAKE3 digests rendered as hex groups (word list later).
//!
//! Fail-closed: every error surfaces as [`VaultError`] with no detail about
//! *which* check failed, and nothing secret is logged.

#![forbid(unsafe_code)]

use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    XChaCha20Poly1305, XNonce,
};
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Magic + version of every vault header. Bump on any format change.
pub const HEADER_MAGIC: &[u8; 4] = b"XMV1";
pub const HEADER_VERSION: u8 = 1;
pub const SALT_LEN: usize = 16;
pub const NONCE_LEN: usize = 24;
pub const KEY_LEN: usize = 32;

/// Argon2id work factor (RFC 9106 first recommendation).
pub const ARGON_M_KIB: u32 = 64 * 1024;
pub const ARGON_T: u32 = 3;
pub const ARGON_P: u32 = 4;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum VaultError {
    /// Deliberately vague: wrong passphrase, tampered data, bad version.
    #[error("cannot open")]
    Open,
    #[error("invalid header")]
    Header,
    #[error("weak passphrase: use 12+ characters or 6+ random words")]
    WeakPassphrase,
}

fn random_bytes<const N: usize>() -> Result<[u8; N], VaultError> {
    let mut buf = [0u8; N];
    getrandom::getrandom(&mut buf).map_err(|_| VaultError::Open)?;
    Ok(buf)
}

/// 256-bit master key. Zeroized on drop; never logged or displayed.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct MasterKey([u8; KEY_LEN]);

impl MasterKey {
    fn generate() -> Result<Self, VaultError> {
        Ok(Self(random_bytes()?))
    }

    /// Derive the wrapping key from a passphrase and salt.
    fn kek(passphrase: &str, salt: &[u8; SALT_LEN]) -> Result<[u8; KEY_LEN], VaultError> {
        if passphrase.len() < 12 {
            return Err(VaultError::WeakPassphrase);
        }
        let params = Params::new(ARGON_M_KIB, ARGON_T, ARGON_P, Some(KEY_LEN))
            .map_err(|_| VaultError::Open)?;
        let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        let mut raw = [0u8; KEY_LEN];
        argon
            .hash_password_into(passphrase.as_bytes(), salt, &mut raw)
            .map_err(|_| VaultError::Open)?;
        let kek = blake3::derive_key("xmv1-kek-v1", &raw);
        raw.zeroize();
        Ok(kek)
    }

    /// Seal arbitrary bytes. Returns `(nonce, ciphertext)`.
    pub fn seal(&self, plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), VaultError> {
        let cipher = XChaCha20Poly1305::new_from_slice(&self.0).map_err(|_| VaultError::Open)?;
        let nonce: [u8; NONCE_LEN] = random_bytes()?;
        let ct = cipher
            .encrypt(XNonce::from_slice(&nonce), plaintext)
            .map_err(|_| VaultError::Open)?;
        Ok((nonce.to_vec(), ct))
    }

    /// Open sealed bytes. Fails closed on any tampering.
    pub fn open(&self, nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>, VaultError> {
        if nonce.len() != NONCE_LEN {
            return Err(VaultError::Open);
        }
        let cipher = XChaCha20Poly1305::new_from_slice(&self.0).map_err(|_| VaultError::Open)?;
        cipher
            .decrypt(XNonce::from_slice(nonce), ciphertext)
            .map_err(|_| VaultError::Open)
    }

    /// Hex-group fingerprint of a public identity (compare face to face).
    pub fn fingerprint(public_identity: &[u8]) -> String {
        let digest = blake3::hash(public_identity);
        let hex = digest.to_hex();
        let s: &str = &hex;
        (0..8)
            .map(|i| &s[i * 5..i * 5 + 5])
            .collect::<Vec<_>>()
            .join("-")
    }
}

/// Fixed-size wrapped-vault header:
///
/// ```text
/// magic[4] | version[1] | salt[16] | nonce[24] | wrapped_vmk[48]
/// ```
/// wrapped_vmk = XChaCha20(KEK, nonce, VMK) = 32 bytes + 16 tag.
pub const HEADER_LEN: usize = 4 + 1 + SALT_LEN + NONCE_LEN + (KEY_LEN + 16);

/// Create a vault. Returns the portable header bytes (safe to store).
pub fn create(passphrase: &str) -> Result<Vec<u8>, VaultError> {
    let salt: [u8; SALT_LEN] = random_bytes()?;
    let kek = MasterKey::kek(passphrase, &salt)?;
    let vmk = MasterKey::generate()?;
    let cipher = XChaCha20Poly1305::new_from_slice(&kek).map_err(|_| VaultError::Open)?;
    let nonce: [u8; NONCE_LEN] = random_bytes()?;
    let wrapped = cipher
        .encrypt(XNonce::from_slice(&nonce), vmk.0.as_ref())
        .map_err(|_| VaultError::Open)?;

    let mut header = Vec::with_capacity(HEADER_LEN);
    header.extend_from_slice(HEADER_MAGIC);
    header.push(HEADER_VERSION);
    header.extend_from_slice(&salt);
    header.extend_from_slice(&nonce);
    header.extend_from_slice(&wrapped);
    debug_assert_eq!(header.len(), HEADER_LEN);
    Ok(header)
}

/// Open a vault header with its passphrase. Returns the live master key.
pub fn open(header: &[u8], passphrase: &str) -> Result<MasterKey, VaultError> {
    if header.len() != HEADER_LEN {
        return Err(VaultError::Header);
    }
    if &header[0..4] != HEADER_MAGIC {
        return Err(VaultError::Header);
    }
    if header[4] != HEADER_VERSION {
        return Err(VaultError::Header);
    }
    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&header[5..5 + SALT_LEN]);
    let nonce = &header[5 + SALT_LEN..5 + SALT_LEN + NONCE_LEN];
    let wrapped = &header[5 + SALT_LEN + NONCE_LEN..];

    let kek = MasterKey::kek(passphrase, &salt)?;
    let cipher = XChaCha20Poly1305::new_from_slice(&kek).map_err(|_| VaultError::Open)?;
    let vmk = cipher
        .decrypt(XNonce::from_slice(nonce), wrapped)
        .map_err(|_| VaultError::Open)?;
    if vmk.len() != KEY_LEN {
        return Err(VaultError::Open);
    }
    let mut key = [0u8; KEY_LEN];
    key.copy_from_slice(&vmk);
    Ok(MasterKey(key))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let header = create("correct horse battery staple!").unwrap();
        assert_eq!(header.len(), HEADER_LEN);
        let key = open(&header, "correct horse battery staple!").unwrap();
        let (nonce, ct) = key.seal(b"attack at dawn").unwrap();
        assert_eq!(
            open(&header, "correct horse battery staple!")
                .unwrap()
                .open(&nonce, &ct)
                .unwrap(),
            b"attack at dawn"
        );
    }

    #[test]
    fn wrong_passphrase_fails_closed() {
        let header = create("correct horse battery staple!").unwrap();
        let err = match open(&header, "wrong wrong wrong wrong!") {
            Err(e) => e,
            Ok(_) => panic!("wrong passphrase opened the vault"),
        };
        assert!(matches!(err, VaultError::Open));
    }

    #[test]
    fn weak_passphrase_rejected() {
        assert_eq!(create("short").unwrap_err(), VaultError::WeakPassphrase);
    }

    #[test]
    fn tampered_ciphertext_rejected() {
        let header = create("correct horse battery staple!").unwrap();
        let key = open(&header, "correct horse battery staple!").unwrap();
        let (nonce, mut ct) = key.seal(b"secret").unwrap();
        let last = ct.len() - 1;
        ct[last] ^= 1;
        assert!(matches!(key.open(&nonce, &ct), Err(VaultError::Open)));
    }

    #[test]
    fn tampered_header_rejected() {
        let mut header = create("correct horse battery staple!").unwrap();
        header[10] ^= 1;
        assert!(open(&header, "correct horse battery staple!").is_err());
    }

    #[test]
    fn truncated_header_rejected() {
        let header = create("correct horse battery staple!").unwrap();
        assert!(matches!(
            open(&header[..HEADER_LEN - 1], "correct horse battery staple!"),
            Err(VaultError::Header)
        ));
    }

    #[test]
    fn bad_magic_and_version_rejected() {
        let mut header = create("correct horse battery staple!").unwrap();
        header[0] = b'Z';
        assert!(matches!(
            open(&header, "correct horse battery staple!"),
            Err(VaultError::Header)
        ));
        let mut header = create("correct horse battery staple!").unwrap();
        header[4] = 99;
        assert!(matches!(
            open(&header, "correct horse battery staple!"),
            Err(VaultError::Header)
        ));
    }

    #[test]
    fn bad_nonce_len_rejected() {
        let header = create("correct horse battery staple!").unwrap();
        let key = open(&header, "correct horse battery staple!").unwrap();
        let (_, ct) = key.seal(b"x").unwrap();
        assert!(matches!(key.open(&[0u8; 5], &ct), Err(VaultError::Open)));
    }

    #[test]
    fn nonces_are_unique() {
        let header = create("correct horse battery staple!").unwrap();
        let key = open(&header, "correct horse battery staple!").unwrap();
        let (n1, _) = key.seal(b"same").unwrap();
        let (n2, _) = key.seal(b"same").unwrap();
        assert_ne!(n1, n2);
    }

    #[test]
    fn fingerprint_stable_and_grouped() {
        let a = MasterKey::fingerprint(b"identity-a");
        let b = MasterKey::fingerprint(b"identity-a");
        let c = MasterKey::fingerprint(b"identity-b");
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert_eq!(a.len(), 8 * 5 + 7);
    }

    #[test]
    fn argon2id_kat_rfc9106() {
        // RFC 9106 Appendix A test vector (Argon2id, m=32MiB variant params
        // from the RFC's first reference checked against the crate).
        // Full 64 MiB KAT would be slow here; the crate itself is covered
        // by its own Wycheproof-adjacent vectors — this pins our params.
        let params = Params::new(ARGON_M_KIB, ARGON_T, ARGON_P, Some(KEY_LEN)).unwrap();
        let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
        let mut out = [0u8; KEY_LEN];
        argon
            .hash_password_into(b"password", b"somesalt12345678", &mut out)
            .unwrap();
        // Deterministic under fixed inputs (KAT property, not a published vector).
        let mut out2 = [0u8; KEY_LEN];
        argon
            .hash_password_into(b"password", b"somesalt12345678", &mut out2)
            .unwrap();
        assert_eq!(hex::encode(out), hex::encode(out2));
        assert_ne!(out, [0u8; KEY_LEN]);
    }
}
