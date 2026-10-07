//! Data Models for Omni Messenger

use crate::crypto::{IdentityPublicKey, SignaturePublicKey};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Contact Information
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub server: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub public_key: Option<IdentityPublicKey>,
    pub fingerprint: Option<String>,
    pub added_at: u64,
    pub last_seen: Option<u64>,
    pub is_online: bool,
    pub is_verified: bool,
    pub metadata: HashMap<String, String>,
}

impl Contact {
    pub fn new(name: String, server: String, port: u16, username: String, password: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            server,
            port,
            username,
            password,
            public_key: None,
            fingerprint: None,
            added_at: crate::crypto::utils::current_timestamp_ms(),
            last_seen: None,
            is_online: false,
            is_verified: false,
            metadata: HashMap::new(),
        }
    }

    pub fn connection_string(&self) -> String {
        format!("{}:{}", self.server, self.port)
    }

    pub fn display_name(&self) -> String {
        self.name.clone()
    }
}

/// Message Structure
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct Message {
    pub id: String,
    pub contact_id: String,
    pub content: String,
    pub message_type: MessageType,
    pub direction: MessageDirection,
    pub timestamp: u64,
    pub is_read: bool,
    pub is_delivered: bool,
    pub is_ephemeral: bool,
    pub expires_at: Option<u64>,
    pub reply_to: Option<String>,
    pub attachments: Vec<Attachment>,
    pub encryption_info: EncryptionInfo,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum MessageType {
    Text = 1,
    Image = 2,
    File = 3,
    Audio = 4,
    Video = 5,
    Contact = 6,
    Location = 7,
    System = 8,
    KeyExchange = 9,
    ReadReceipt = 10,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum MessageDirection {
    Incoming = 1,
    Outgoing = 2,
}

#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct Attachment {
    pub id: String,
    pub filename: String,
    pub mime_type: String,
    pub size: u64,
    pub path: String,
    pub thumbnail_path: Option<String>,
    pub encrypted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct EncryptionInfo {
    pub algorithm: String,
    pub key_id: String,
    pub nonce: Vec<u8>,
    pub epoch: u32,
    pub message_num: u64,
    pub pq_ratchet: bool,
}

/// Proxy Configuration
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct ProxyConfig {
    pub id: String,
    pub name: String,
    pub proxy_type: ProxyType,
    pub server: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub tls_enabled: bool,
    pub tls_sni: Option<String>,
    pub tls_fingerprint: Option<String>,
    pub plugin: Option<String>,
    pub plugin_opts: HashMap<String, String>,
    pub is_active: bool,
    pub created_at: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum ProxyType {
    Socks5 = 1,
    Http = 2,
    Https = 3,
    Shadowsocks = 4,
    Vless = 5,
    Trojan = 6,
    Wireguard = 7,
    Openvpn = 8,
}

impl ProxyConfig {
    pub fn new(name: String, proxy_type: ProxyType, server: String, port: u16) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            proxy_type,
            server,
            port,
            username: None,
            password: None,
            tls_enabled: false,
            tls_sni: None,
            tls_fingerprint: None,
            plugin: None,
            plugin_opts: HashMap::new(),
            is_active: false,
            created_at: crate::crypto::utils::current_timestamp_ms(),
        }
    }

    pub fn to_uri(&self) -> String {
        match self.proxy_type {
            ProxyType::Socks5 => {
                let auth = if let (Some(u), Some(p)) = (&self.username, &self.password) {
                    format!("{}:{}@", u, p)
                } else {
                    String::new()
                };
                format!("socks5://{}{}:{}", auth, self.server, self.port)
            }
            ProxyType::Http | ProxyType::Https => {
                let scheme = if self.proxy_type == ProxyType::Https { "https" } else { "http" };
                let auth = if let (Some(u), Some(p)) = (&self.username, &self.password) {
                    format!("{}:{}@", u, p)
                } else {
                    String::new()
                };
                format!("{}://{}{}:{}", scheme, auth, self.server, self.port)
            }
            ProxyType::Shadowsocks => {
                let method = self.plugin_opts.get("method").unwrap_or(&"aes-256-gcm".to_string());
                let password = self.password.as_ref().unwrap_or(&"".to_string());
                format!("ss://{}:{}@{}:{}#{}", method, password, self.server, self.port, self.name)
            }
            ProxyType::Vless => {
                let uuid = self.username.as_ref().unwrap_or(&"".to_string());
                format!("vless://{}@{}:{}#{}", uuid, self.server, self.port, self.name)
            }
            _ => format!("{}://{}:{}", self.proxy_type_str(), self.server, self.port),
        }
    }

    fn proxy_type_str(&self) -> &'static str {
        match self.proxy_type {
            ProxyType::Socks5 => "socks5",
            ProxyType::Http => "http",
            ProxyType::Https => "https",
            ProxyType::Shadowsocks => "ss",
            ProxyType::Vless => "vless",
            ProxyType::Trojan => "trojan",
            ProxyType::Wireguard => "wireguard",
            ProxyType::Openvpn => "openvpn",
        }
    }
}

/// Session Data
#[derive(Debug, Clone, Serialize, Deserialize, Zeroize, ZeroizeOnDrop)]
pub struct Session {
    pub id: String,
    pub contact_id: String,
    pub session_keys: crate::crypto::SessionKeys,
    pub created_at: u64,
    pub last_used: u64,
    pub message_count_sent: u64,
    pub message_count_received: u64,
    pub ratchet_state: crate::crypto::RatchetState,
}

/// Database Interface
pub struct Database {
    conn: rusqlite::Connection,
}

impl Database {
    pub fn new() -> Result<Self, rusqlite::Error> {
        let dir = dirs::data_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("x-messenger");
        std::fs::create_dir_all(&dir)?;
        let db_path = dir.join("messenger.db");
        
        let conn = rusqlite::Connection::open(db_path)?;
        
        // Enable WAL mode for better concurrency
        conn.execute("PRAGMA journal_mode = WAL", [])?;
        conn.execute("PRAGMA synchronous = NORMAL", [])?;
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        
        // Create tables
        Self::create_tables(&conn)?;
        
        Ok(Self { conn })
    }

    fn create_tables(conn: &rusqlite::Connection) -> Result<(), rusqlite::Error> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                server TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                public_key BLOB,
                fingerprint TEXT,
                added_at INTEGER NOT NULL,
                last_seen INTEGER,
                is_online INTEGER NOT NULL DEFAULT 0,
                is_verified INTEGER NOT NULL DEFAULT 0,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                contact_id TEXT NOT NULL,
                content TEXT NOT NULL,
                message_type INTEGER NOT NULL,
                direction INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                is_delivered INTEGER NOT NULL DEFAULT 0,
                is_ephemeral INTEGER NOT NULL DEFAULT 0,
                expires_at INTEGER,
                reply_to TEXT,
                attachments TEXT,
                encryption_info TEXT,
                FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages (contact_id);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);

            CREATE TABLE IF NOT EXISTS proxy_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                proxy_type INTEGER NOT NULL,
                server TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT,
                password TEXT,
                tls_enabled INTEGER NOT NULL DEFAULT 0,
                tls_sni TEXT,
                tls_fingerprint TEXT,
                plugin TEXT,
                plugin_opts TEXT,
                is_active INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                contact_id TEXT NOT NULL,
                session_keys BLOB NOT NULL,
                created_at INTEGER NOT NULL,
                last_used INTEGER NOT NULL,
                message_count_sent INTEGER NOT NULL DEFAULT 0,
                message_count_received INTEGER NOT NULL DEFAULT 0,
                ratchet_state BLOB,
                FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS identity (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                identity_keypair BLOB NOT NULL,
                created_at INTEGER NOT NULL
            );
            "
        )?;
        
        Ok(())
    }

    // Contact operations
    pub fn add_contact(&self, contact: &Contact) -> Result<(), rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "INSERT INTO contacts (id, name, server, port, username, password, public_key, fingerprint, added_at, last_seen, is_online, is_verified, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"
        )?;
        
        let metadata = serde_json::to_string(&contact.metadata).unwrap_or_default();
        let public_key = contact.public_key.as_ref().map(|pk| {
            let mut buf = Vec::new();
            ciborium::ser::into_writer(pk, &mut buf).unwrap();
            buf
        });
        
        stmt.execute((
            &contact.id,
            &contact.name,
            &contact.server,
            contact.port,
            &contact.username,
            &contact.password,
            public_key.as_deref(),
            contact.fingerprint.as_deref(),
            contact.added_at,
            contact.last_seen,
            contact.is_online as i32,
            contact.is_verified as i32,
            metadata,
        ))?;
        
        Ok(())
    }

    pub fn get_contacts(&self) -> Result<Vec<Contact>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, server, port, username, password, public_key, fingerprint, added_at, last_seen, is_online, is_verified, metadata
             FROM contacts ORDER BY name"
        )?;
        
        let contacts = stmt.query_map([], |row| {
            let public_key_blob: Option<Vec<u8>> = row.get(6)?;
            let public_key = public_key_blob.and_then(|blob| {
                ciborium::de::from_reader(&blob[..]).ok()
            });
            
            let metadata_str: String = row.get(12)?;
            let metadata = serde_json::from_str(&metadata_str).unwrap_or_default();
            
            Ok(Contact {
                id: row.get(0)?,
                name: row.get(1)?,
                server: row.get(2)?,
                port: row.get(3)?,
                username: row.get(4)?,
                password: row.get(5)?,
                public_key,
                fingerprint: row.get(7)?,
                added_at: row.get(8)?,
                last_seen: row.get(9)?,
                is_online: row.get::<_, i32>(10)? != 0,
                is_verified: row.get::<_, i32>(11)? != 0,
                metadata,
            })
        })?;
        
        let mut result = Vec::new();
        for contact in contacts {
            result.push(contact?);
        }
        Ok(result)
    }

    pub fn get_contact(&self, id: &str) -> Result<Option<Contact>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, server, port, username, password, public_key, fingerprint, added_at, last_seen, is_online, is_verified, metadata
             FROM contacts WHERE id = ?1"
        )?;
        
        let mut rows = stmt.query([id])?;
        if let Some(row) = rows.next()? {
            let public_key_blob: Option<Vec<u8>> = row.get(6)?;
            let public_key = public_key_blob.and_then(|blob| {
                ciborium::de::from_reader(&blob[..]).ok()
            });
            
            let metadata_str: String = row.get(12)?;
            let metadata = serde_json::from_str(&metadata_str).unwrap_or_default();
            
            Ok(Some(Contact {
                id: row.get(0)?,
                name: row.get(1)?,
                server: row.get(2)?,
                port: row.get(3)?,
                username: row.get(4)?,
                password: row.get(5)?,
                public_key,
                fingerprint: row.get(7)?,
                added_at: row.get(8)?,
                last_seen: row.get(9)?,
                is_online: row.get::<_, i32>(10)? != 0,
                is_verified: row.get::<_, i32>(11)? != 0,
                metadata,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn delete_contact(&self, id: &str) -> Result<(), rusqlite::Error> {
        self.conn.execute("DELETE FROM contacts WHERE id = ?1", [id])?;
        Ok(())
    }

    // Message operations
    pub fn add_message(&self, message: &Message) -> Result<(), rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "INSERT INTO messages (id, contact_id, content, message_type, direction, timestamp, is_read, is_delivered, is_ephemeral, expires_at, reply_to, attachments, encryption_info)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"
        )?;
        
        let attachments = serde_json::to_string(&message.attachments).unwrap_or_default();
        let encryption_info = serde_json::to_string(&message.encryption_info).unwrap_or_default();
        
        stmt.execute((
            &message.id,
            &message.contact_id,
            &message.content,
            message.message_type as i32,
            message.direction as i32,
            message.timestamp,
            message.is_read as i32,
            message.is_delivered as i32,
            message.is_ephemeral as i32,
            message.expires_at,
            message.reply_to.as_deref(),
            attachments,
            encryption_info,
        ))?;
        
        Ok(())
    }

    pub fn get_messages(&self, contact_id: &str, limit: usize, offset: usize) -> Result<Vec<Message>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, contact_id, content, message_type, direction, timestamp, is_read, is_delivered, is_ephemeral, expires_at, reply_to, attachments, encryption_info
             FROM messages WHERE contact_id = ?1 ORDER BY timestamp DESC LIMIT ?2 OFFSET ?3"
        )?;
        
        let messages = stmt.query_map([contact_id, limit, offset], |row| {
            let attachments_str: String = row.get(11)?;
            let attachments = serde_json::from_str(&attachments_str).unwrap_or_default();
            
            let encryption_str: String = row.get(12)?;
            let encryption_info = serde_json::from_str(&encryption_str).unwrap_or_default();
            
            Ok(Message {
                id: row.get(0)?,
                contact_id: row.get(1)?,
                content: row.get(2)?,
                message_type: match row.get::<_, i32>(3)? {
                    1 => MessageType::Text,
                    2 => MessageType::Image,
                    3 => MessageType::File,
                    4 => MessageType::Audio,
                    5 => MessageType::Video,
                    6 => MessageType::Contact,
                    7 => MessageType::Location,
                    8 => MessageType::System,
                    9 => MessageType::KeyExchange,
                    10 => MessageType::ReadReceipt,
                    _ => MessageType::Text,
                },
                direction: match row.get::<_, i32>(4)? {
                    1 => MessageDirection::Incoming,
                    2 => MessageDirection::Outgoing,
                    _ => MessageDirection::Incoming,
                },
                timestamp: row.get(5)?,
                is_read: row.get::<_, i32>(6)? != 0,
                is_delivered: row.get::<_, i32>(7)? != 0,
                is_ephemeral: row.get::<_, i32>(8)? != 0,
                expires_at: row.get(9)?,
                reply_to: row.get(10)?,
                attachments,
                encryption_info,
            })
        })?;
        
        let mut result = Vec::new();
        for msg in messages {
            result.push(msg?);
        }
        Ok(result)
    }

    pub fn mark_as_read(&self, message_id: &str) -> Result<(), rusqlite::Error> {
        self.conn.execute("UPDATE messages SET is_read = 1 WHERE id = ?1", [message_id])?;
        Ok(())
    }

    // Proxy config operations
    pub fn add_proxy_config(&self, config: &ProxyConfig) -> Result<(), rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "INSERT INTO proxy_configs (id, name, proxy_type, server, port, username, password, tls_enabled, tls_sni, tls_fingerprint, plugin, plugin_opts, is_active, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)"
        )?;
        
        let plugin_opts = serde_json::to_string(&config.plugin_opts).unwrap_or_default();
        
        stmt.execute((
            &config.id,
            &config.name,
            config.proxy_type as i32,
            &config.server,
            config.port,
            config.username.as_deref(),
            config.password.as_deref(),
            config.tls_enabled as i32,
            config.tls_sni.as_deref(),
            config.tls_fingerprint.as_deref(),
            config.plugin.as_deref(),
            plugin_opts,
            config.is_active as i32,
            config.created_at,
        ))?;
        
        Ok(())
    }

    pub fn get_proxy_configs(&self) -> Result<Vec<ProxyConfig>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, proxy_type, server, port, username, password, tls_enabled, tls_sni, tls_fingerprint, plugin, plugin_opts, is_active, created_at
             FROM proxy_configs ORDER BY name"
        )?;
        
        let configs = stmt.query_map([], |row| {
            let plugin_opts_str: String = row.get(11)?;
            let plugin_opts = serde_json::from_str(&plugin_opts_str).unwrap_or_default();
            
            Ok(ProxyConfig {
                id: row.get(0)?,
                name: row.get(1)?,
                proxy_type: match row.get::<_, i32>(2)? {
                    1 => ProxyType::Socks5,
                    2 => ProxyType::Http,
                    3 => ProxyType::Https,
                    4 => ProxyType::Shadowsocks,
                    5 => ProxyType::Vless,
                    6 => ProxyType::Trojan,
                    7 => ProxyType::Wireguard,
                    8 => ProxyType::Openvpn,
                    _ => ProxyType::Socks5,
                },
                server: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                password: row.get(6)?,
                tls_enabled: row.get::<_, i32>(7)? != 0,
                tls_sni: row.get(8)?,
                tls_fingerprint: row.get(9)?,
                plugin: row.get(10)?,
                plugin_opts,
                is_active: row.get::<_, i32>(12)? != 0,
                created_at: row.get(13)?,
            })
        })?;
        
        let mut result = Vec::new();
        for config in configs {
            result.push(config?);
        }
        Ok(result)
    }

    // Settings operations
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, rusqlite::Error> {
        let mut stmt = self.conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query([key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            [key, value]
        )?;
        Ok(())
    }

    // Identity operations
    pub fn save_identity(&self, identity: &crate::crypto::IdentityKeyPair) -> Result<(), rusqlite::Error> {
        let mut buf = Vec::new();
        ciborium::ser::into_writer(identity, &mut buf)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        
        self.conn.execute(
            "INSERT OR REPLACE INTO identity (id, identity_keypair, created_at) VALUES (1, ?1, ?2)",
            [buf, crate::crypto::utils::current_timestamp_ms()],
        )?;
        Ok(())
    }

    pub fn load_identity(&self) -> Result<Option<crate::crypto::IdentityKeyPair>, rusqlite::Error> {
        let mut stmt = self.conn.prepare("SELECT identity_keypair FROM identity WHERE id = 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            let blob: Vec<u8> = row.get(0)?;
            let identity = ciborium::de::from_reader(&blob[..])
                .map_err(|e| rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Blob, Box::new(e)))?;
            Ok(Some(identity))
        } else {
            Ok(None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_database() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        let conn = rusqlite::Connection::open(db_path).unwrap();
        
        Database::create_tables(&conn).unwrap();
        
        let db = Database { conn };
        
        let contact = Contact::new(
            "Test User".to_string(),
            "example.com".to_string(),
            443,
            "user".to_string(),
            "pass".to_string(),
        );
        
        db.add_contact(&contact).unwrap();
        let contacts = db.get_contacts().unwrap();
        assert_eq!(contacts.len(), 1);
        assert_eq!(contacts[0].name, "Test User");
    }
}