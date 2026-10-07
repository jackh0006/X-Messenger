//! Simplified one-way ratchet for offline sessions.
//!
//! v1 messages are one-shot (no live session), so this ratchet advances a
//! chain key per sent message: `ck' = HKDF-SHA3-256(ck, "chain")`,
//! `mk = HKDF-SHA3-256(ck, "message")`. A PQ re-key mixes a fresh
//! ML-KEM shared secret into the chain every `PQ_REKEY_EVERY` messages.
use crate::hkdf::{Hkdf, HkdfAlgorithm};
use crate::utils::SecureBytes;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Messages between PQ re-keys.
pub const PQ_REKEY_EVERY: u64 = 100;

/// Ratchet errors.
#[derive(Debug, thiserror::Error)]
pub enum RatchetError {
    /// KDF failure
    #[error("kdf failed")]
    Kdf,
    /// Out of order
    #[error("out of order")]
    Order,
}

/// Public ratchet state (counters only; keys stay sealed).
#[derive(Debug, Clone)]
pub struct RatchetState {
    /// Messages sent under this chain
    pub send_counter: u64,
    /// Messages received under this chain
    pub recv_counter: u64,
    /// PQ epoch
    pub pq_epoch: u64,
}

/// Sending/receiving chain.
#[derive(Zeroize, ZeroizeOnDrop)]
pub struct DoubleRatchet {
    chain_key: SecureBytes,
    state: [u64; 3],
}

impl DoubleRatchet {
    /// Start from a 64-byte hybrid shared secret.
    pub fn new(shared: &[u8]) -> Result<Self, RatchetError> {
        if shared.len() != 64 {
            return Err(RatchetError::Kdf);
        }
        let hk = Hkdf::new(HkdfAlgorithm::Sha3_512, b"OAM1-ratchet");
        let prk = hk.extract(b"OAM1-RATCHET-v1", shared).map_err(|_| RatchetError::Kdf)?;
        let mut ck = [0u8; 32];
        hk.expand(&prk, b"OAM1-chain", &mut ck).map_err(|_| RatchetError::Kdf)?;
        Ok(Self { chain_key: SecureBytes::from(ck.as_slice()), state: [0, 0, 0] })
    }

    /// Next message key (advances the chain).
    pub fn next_message_key(&mut self) -> Result<SecureBytes, RatchetError> {
        let hk = Hkdf::new(HkdfAlgorithm::Sha3_256, b"");
        let ck = self.chain_key.as_slice().to_vec();
        let prk = hk.extract(b"", &ck).map_err(|_| RatchetError::Kdf)?;
        let mut mk = [0u8; 32];
        let mut ck2 = [0u8; 32];
        hk.expand(&prk, b"OAM1-message", &mut mk).map_err(|_| RatchetError::Kdf)?;
        hk.expand(&prk, b"OAM1-chain", &mut ck2).map_err(|_| RatchetError::Kdf)?;
        self.chain_key = SecureBytes::from(ck2.as_slice());
        self.state[0] += 1;
        Ok(SecureBytes::from(mk.as_slice()))
    }

    /// Mix a fresh PQ shared secret into the chain.
    pub fn pq_rekey(&mut self, pq_shared: &[u8]) -> Result<(), RatchetError> {
        let hk = Hkdf::new(HkdfAlgorithm::Sha3_256, b"");
        let mut mix = self.chain_key.as_slice().to_vec();
        mix.extend_from_slice(pq_shared);
        let prk = hk.extract(b"", &mix).map_err(|_| RatchetError::Kdf)?;
        let mut ck = [0u8; 32];
        hk.expand(&prk, b"OAM1-pq-chain", &mut ck).map_err(|_| RatchetError::Kdf)?;
        self.chain_key = SecureBytes::from(ck.as_slice());
        self.state[2] += 1;
        Ok(())
    }

    /// Public counters.
    pub fn state(&self) -> RatchetState {
        RatchetState {
            send_counter: self.state[0],
            recv_counter: self.state[1],
            pq_epoch: self.state[2],
        }
    }
}
