//! Password KDF: Argon2id (memory-hard) for passphrase ("words") mode.
//!
//! Parameters match the Python `oam` core: 64 MiB, 3 passes, 4 lanes.
//! Salt must be 16 random bytes per message; never reuse.

/// Argon2 errors.
#[derive(Debug, thiserror::Error)]
pub enum KdfError {
    /// Bad passphrase (too short)
    #[error("passphrase too short")]
    TooShort,
    /// Internal failure
    #[error("kdf failed: {0}")]
    Failed(String),
}

/// Memory cost in KiB (64 MiB).
pub const ARGON2_M_COST: u32 = 65536;
/// Time cost (passes).
pub const ARGON2_T_COST: u32 = 3;
/// Parallelism (lanes).
pub const ARGON2_P_COST: u32 = 4;
/// Salt length in bytes.
pub const SALT_LEN: usize = 16;

/// Stretch `passphrase` with `salt` into a 32-byte key.
pub fn stretch_passphrase(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], KdfError> {
    use argon2::{Algorithm, Argon2, Params, Version};
    if passphrase.as_bytes().len() < 8 {
        return Err(KdfError::TooShort);
    }
    if salt.len() != SALT_LEN {
        return Err(KdfError::Failed("bad salt length".into()));
    }
    let params =
        Params::new(ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST, Some(32))
            .map_err(|e| KdfError::Failed(e.to_string()))?;
    let ctx = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut out = [0u8; 32];
    ctx.hash_password_into(passphrase.as_bytes(), salt, &mut out)
        .map_err(|e| KdfError::Failed(e.to_string()))?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn kdf_deterministic_and_salted() {
        let a = stretch_passphrase("correct horse battery staple", &[7u8; 16]).unwrap();
        let b = stretch_passphrase("correct horse battery staple", &[7u8; 16]).unwrap();
        let c = stretch_passphrase("correct horse battery staple", &[8u8; 16]).unwrap();
        assert_eq!(a, b);
        assert_ne!(a, c);
    }
    #[test]
    fn kdf_rejects_short() {
        assert!(stretch_passphrase("short", &[0u8; 16]).is_err());
    }
}
