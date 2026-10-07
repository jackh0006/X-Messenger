//! Settings for Omni Messenger Linux App

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Application Settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    // Appearance
    pub dark_mode: bool,
    pub compact_mode: bool,
    pub language: String,
    
    // Notifications
    pub notifications_enabled: bool,
    pub message_preview: bool,
    pub sound_enabled: bool,
    
    // Security
    pub cipher_algorithm: String,
    pub key_rotation_interval: u64,
    pub ephemeral_default: bool,
    pub auto_lock_minutes: u32,
    
    // Network
    pub tunnel_token: String,
    pub custom_domain: String,
    pub auto_connect: bool,
    
    // Offline Transport
    pub qr_enabled: bool,
    pub nfc_enabled: bool,
    pub usb_enabled: bool,
    pub bluetooth_enabled: bool,
    
    // Advanced
    pub debug_logging: bool,
    pub log_level: String,
    pub max_message_size: usize,
    pub max_cache_size: usize,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            dark_mode: true,
            compact_mode: false,
            language: "en".to_string(),
            notifications_enabled: true,
            message_preview: true,
            sound_enabled: true,
            cipher_algorithm: "XChaCha20-Poly1305".to_string(),
            key_rotation_interval: 100,
            ephemeral_default: false,
            auto_lock_minutes: 15,
            tunnel_token: String::new(),
            custom_domain: String::new(),
            auto_connect: true,
            qr_enabled: true,
            nfc_enabled: false,
            usb_enabled: true,
            bluetooth_enabled: false,
            debug_logging: false,
            log_level: "info".to_string(),
            max_message_size: 16 * 1024 * 1024,
            max_cache_size: 500 * 1024 * 1024,
        }
    }
}

impl AppSettings {
    pub fn load() -> Self {
        let path = Self::settings_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(settings) = serde_json::from_str(&content) {
                    return settings;
                }
            }
        }
        Self::default()
    }

    pub fn save(&self) {
        let path = Self::settings_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).ok();
        }
        if let Ok(content) = serde_json::to_string_pretty(self) {
            fs::write(&path, content).ok();
        }
    }

    fn settings_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("x-messenger")
            .join("settings.json")
    }

    pub fn reset(&mut self) {
        *self = Self::default();
        self.save();
    }
}