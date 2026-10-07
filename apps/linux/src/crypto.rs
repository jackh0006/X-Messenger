//! Crypto wrapper for Linux app

use crate::crypto::{XMessengerCrypto as CoreCrypto, IdentityKeyPair, IdentityPublicKey, SessionKeys};
use std::sync::Arc;

/// Application-level crypto wrapper
pub struct XMessengerCrypto {
    inner: Arc<CoreCrypto>,
    identity: Option<IdentityKeyPair>,
}

impl XMessengerCrypto {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(CoreCrypto::new()),
            identity: None,
        }
    }

    pub fn init() -> Result<(), Box<dyn std::error::Error>> {
        CoreCrypto::init();
        Ok(())
    }

    pub fn generate_identity(&mut self) -> Result<IdentityKeyPair, Box<dyn std::error::Error>> {
        let identity = IdentityKeyPair::generate()?;
        self.identity = Some(identity.clone());
        Ok(identity)
    }

    pub fn get_identity(&self) -> Option<&IdentityKeyPair> {
        self.identity.as_ref()
    }

    pub fn get_identity_public(&self) -> Option<IdentityPublicKey> {
        self.identity.as_ref().map(|i| i.identity_public_key())
    }

    pub fn create_session(&self, contact_pk: &IdentityPublicKey) -> Result<SessionKeys, Box<dyn std::error::Error>> {
        // Create session with contact's public key
        todo!()
    }

    pub fn encrypt_message(&self, plaintext: &[u8], session_keys: &SessionKeys) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        // Encrypt message
        todo!()
    }

    pub fn decrypt_message(&self, ciphertext: &[u8], session_keys: &SessionKeys) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        // Decrypt message
        todo!()
    }

    pub fn sign(&self, data: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        if let Some(identity) = &self.identity {
            let sig = identity.sign(data)?;
            Ok(sig.to_bytes().to_vec())
        } else {
            Err("No identity".into())
        }
    }

    pub fn verify(&self, data: &[u8], signature: &[u8], pk: &IdentityPublicKey) -> Result<(), Box<dyn std::error::Error>> {
        // Verify signature
        todo!()
    }
}

impl Default for XMessengerCrypto {
    fn default() -> Self {
        Self::new()
    }
}