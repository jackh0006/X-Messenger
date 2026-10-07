//! Small utilities: secret bytes, constant-time helpers.
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Heap secret that is zeroed on drop.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SecureBytes {
    inner: alloc::vec::Vec<u8>,
}

impl SecureBytes {
    /// Length in bytes.
    pub fn len(&self) -> usize {
        self.inner.len()
    }
    /// True when empty.
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }
    /// Borrow the secret.
    pub fn as_slice(&self) -> &[u8] {
        &self.inner
    }
}

impl From<&[u8]> for SecureBytes {
    fn from(v: &[u8]) -> Self {
        Self { inner: v.to_vec() }
    }
}

impl From<alloc::vec::Vec<u8>> for SecureBytes {
    fn from(v: alloc::vec::Vec<u8>) -> Self {
        Self { inner: v }
    }
}

impl AsRef<[u8]> for SecureBytes {
    fn as_ref(&self) -> &[u8] {
        &self.inner
    }
}

impl core::ops::Index<core::ops::RangeFull> for SecureBytes {
    type Output = [u8];
    fn index(&self, _: core::ops::RangeFull) -> &[u8] {
        &self.inner
    }
}

/// Constant-time equality for secrets.
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Best-effort memory wipe with a compiler barrier.
pub fn secure_zero(bytes: &mut [u8]) {
    for b in bytes.iter_mut() {
        *b = 0;
    }
    core::sync::atomic::compiler_fence(core::sync::atomic::Ordering::SeqCst);
}

/// Alias used at verification sites.
pub fn verify_secret(a: &[u8], b: &[u8]) -> bool {
    constant_time_eq(a, b)
}
