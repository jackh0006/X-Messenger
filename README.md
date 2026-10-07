# X-Messenger — CIA-Grade Offline Messenger

**The most secure, encrypted, and private messenger for completely offline data transfer on Linux and Android ARM64.**

> **v2.0.0** — Complete cryptographic rewrite with post-quantum hybrids, Double Ratchet + PQ Ratchet, and hardware-backed key storage.

## 🎯 Overview

X-Messenger v2 is a zero-internet, air-gapped messaging system designed for maximum security and privacy. It implements state-of-the-art post-quantum cryptography with hybrid key exchange (X25519 + ML-KEM-768) and hybrid signatures (Ed25519 + Dilithium3), Double Ratchet with Post-Quantum Ratchet, and supports offline transport via QR codes, NFC, USB, and local network.

## 🔐 Security Features (v2.0.0 — Complete Rewrite)

### Cryptographic Primitives
- **Hybrid KEM**: X25519 (classical) + ML-KEM-768 (FIPS 203, NIST Level 5) for post-quantum key exchange
- **Hybrid Signatures**: Ed25519 (classical) + Dilithium3 (FIPS 204, NIST Level 5) for post-quantum authentication
- **AEAD**: XChaCha20-Poly1305 (primary) and AES-256-GCM-SIV (fallback) for authenticated encryption
- **KDF**: HKDF-SHA3-512 and Argon2id (64MB, 3 iterations, 4 parallelism) for key derivation
- **Hash**: SHA3-256, SHA3-512, BLAKE3 for integrity and fingerprinting
- **Secure Memory**: Zeroize-on-drop, constant-time operations, memory locking

### Protocol Security
- **Double Ratchet**: Signal Protocol implementation with symmetric ratchet
- **Post-Quantum Ratchet**: Periodic ML-KEM-768 rekeying (every 100 messages)
- **Forward Secrecy**: Automatic key rotation, deleted after use
- **Post-Compromise Security**: Self-healing ratchet on message receipt
- **Ephemeral Messages**: Configurable auto-delete timers
- **Deniability**: No long-term transcripts, OTR-style deniable auth

### Transport Security
- **Zero Internet**: No network stack, no sockets, no telemetry
- **QR Code Transport**: Compressed CBOR + Zstd + Base64URL, chunked across multiple QR codes
- **NFC Support**: Android Beam / NFC peer-to-peer for contact exchange
- **USB/Local Network**: Direct device-to-device transfer
- **Air-Gapped**: Designed for physically isolated environments

## 📱 Platform Support

| Platform | Architecture | Status |
|----------|-------------|--------|
| Linux Desktop | x86_64, aarch64 | ✅ Full GUI (GTK4/Libadwaita) |
| Android | arm64-v8a (API 24+) | ✅ Full App (Jetpack Compose) |
| Termux | aarch64 | ✅ CLI + Daemon |

## 🏗️ Architecture

```
X-Messenger/
├── core/
│   ├── crypto/          # Cryptographic primitives (Rust)
│   │   ├── src/
│   │   │   ├── lib.rs                  # Main exports + self-tests
│   │   │   ├── cipher.rs               # XChaCha20-Poly1305, AES-256-GCM-SIV
│   │   │   ├── hash.rs                 # SHA3-256/512, BLAKE3, HMAC
│   │   │   ├── hkdf.rs                 # HKDF-SHA3-256/512
│   │   │   ├── kem.rs                  # Hybrid X25519+ML-KEM-768
│   │   │   ├── keys.rs                 # Identity, PreKeys, Sessions, KeyStore
│   │   │   ├── protocol.rs             # Ratchet state, encryption
│   │   │   ├── ratchet.rs              # ChainKey, RootKey, DH Ratchet
│   │   │   ├── serialization.rs        # CBOR, Base64, QR, Zstd
│   │   │   ├── signatures.rs           # Hybrid Ed25519+Dilithium3
│   │   │   └── utils.rs                # Constant-time, secure zero, random
│   │   └── Cargo.toml
│   └── protocol/        # Protocol definitions (Rust)
│       ├── src/lib.rs   # Message, Contact, QR formats
│       └── Cargo.toml
├── apps/
│   ├── linux/           # GTK4/Relm4 Desktop App
│   │   ├── src/
│   │   │   ├── main.rs          # Application entry
│   │   │   ├── components.rs    # Chats, Contacts, Settings, QR Scanner
│   │   │   ├── data.rs          # SQLite database, entities
│   │   │   ├── crypto.rs        # App crypto wrapper
│   │   │   └── settings.rs      # Configuration
│   │   └── Cargo.toml
│   └── android/         # Jetpack Compose Android App
│       ├── app/
│       │   ├── src/main/
│       │   │   ├── java/com/xmessenger/offline/
│       │   │   │   ├── MainActivity.java
│       │   │   │   ├── XMessengerApplication.java
│       │   │   │   ├── crypto/XMessengerCrypto.java
│       │   │   │   ├── data/ (Room DB, DAOs, Entities)
│       │   │   │   ├── ui/ (Chats, Contacts, Settings screens)
│       │   │   │   ├── service/SyncService.java
│       │   │   │   └── receiver/NetworkChangeReceiver.java
│       │   │   └── res/ (themes, strings, layouts)
│       │   └── build.gradle.kts
│       └── build.gradle.kts
├── spec/
│   └── SECURITY_SPEC.md # Detailed security specification
├── Cargo.toml           # Workspace root
└── README.md
```

## 🚀 Quick Start

### Linux Desktop (GTK4)

```bash
# Install dependencies (Ubuntu/Debian)
sudo apt install libgtk-4-dev libadwaita-1-dev libsqlite3-dev pkg-config

# Build and run
cd apps/linux
cargo run --release
```

### Android (ARM64)

```bash
# Open in Android Studio or build with Gradle
cd apps/android
./gradlew assembleRelease

# Output: app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

### Install on Android Device

```bash
# Via ADB
adb install app/build/outputs/apk/release/app-arm64-v8a-release.apk

# Or transfer APK via QR code / USB
```

## 📋 Usage

### 1. First Run - Generate Identity
On first launch, the app generates your cryptographic identity:
- Hybrid X25519 + ML-KEM-768 key pair (for key exchange)
- Hybrid Ed25519 + Dilithium3 key pair (for signing)
- 64-character SHA3-256 fingerprint for verification

### 2. Add Contacts
**Option A: QR Code (Recommended)**
1. Tap "Scan QR Code" 
2. Point camera at contact's QR code
3. Verify fingerprint matches
4. Tap "Add Contact"

**Option B: Manual Entry**
1. Tap "Add Contact"
2. Enter: Name, Server, Port, Username, Password
3. Contact's public key exchanged on first message

### 3. Send Messages
1. Select contact from list
2. Type message
3. Tap send - message encrypted with Double Ratchet + PQ Ratchet
4. Message delivered via QR code scan, NFC tap, or USB transfer

### 4. Offline Transfer
**QR Code:**
- Sender: Message → "Export to QR" → displays animated QR codes
- Receiver: "Scan QR Code" → scans sequence → message decrypted

**NFC:**
- Both devices: Enable NFC
- Tap phones together → contact/message transferred

**USB:**
- Connect devices via USB OTG
- App detects peer → automatic sync

## 🔧 Configuration

### Settings (Linux: `~/.config/x-messenger/settings.json`)
```json
{
  "dark_mode": true,
  "cipher_algorithm": "XChaCha20-Poly1305",
  "key_rotation_interval": 100,
  "ephemeral_default": false,
  "auto_lock_minutes": 15,
  "qr_enabled": true,
  "nfc_enabled": true,
  "usb_enabled": true,
  "debug_logging": false
}
```

### Android Settings
Access via Settings screen in app - all options persisted in encrypted Room database.

## 🧪 Security Verification

### Self-Tests
Run built-in cryptographic self-tests:
```bash
# Linux
cargo test --release -p omni-crypto

# Android (in app)
Settings → Advanced → Run Self-Tests
```

### Verify Fingerprint
Always verify 64-character fingerprint with contact via secure channel:
```
Fingerprint: a1b2c3d4e5f6... (64 hex chars)
```

### Audit
- All crypto in `core/crypto/` - auditable, no external C dependencies for primitives
- Uses `ring`, `pqcrypto`, `ed25519-dalek`, `x25519-dalek` - well-reviewed crates
- Zero `unsafe` code in crypto modules
- Constant-time operations for secret-dependent logic

## 📖 Protocol Specification

See [SPEC.md](spec/SECURITY_SPEC.md) for detailed protocol specification including:
- Message format (binary CBOR)
- Key exchange (X3DH-style with hybrid KEM)
- Double Ratchet + PQ Ratchet state machine
- QR code chunking protocol
- Contact exchange format
- Security proofs and threat model

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`cargo test --workspace`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

### Code Standards
- Rust: `rustfmt`, `clippy -D warnings`
- Android: Kotlin style guide, `ktlint`
- All crypto changes require security review

## 📄 License

Dual-licensed under **MIT OR Apache-2.0** at your option.

```
MIT License
Copyright (c) 2026 Jack Hudson

Apache License 2.0
Copyright 2026 Jack Hudson
```

## 🙏 Acknowledgments

- **Signal Protocol** - Double Ratchet design
- **NIST PQC** - ML-KEM-768 (Kyber) and ML-DSA-65 (Dilithium) standards
- **Rust Crypto** - `ring`, `pqcrypto`, `dalek` crates
- **Android Security** - EncryptedSharedPreferences, Keystore
- **GTK4/Libadwaita** - Modern Linux UI toolkit

## 🔗 Links

- **Repository**: https://github.com/jackh0006/X-Messenger
- **Security Spec**: [spec/SECURITY_SPEC.md](spec/SECURITY_SPEC.md)
- **Issues**: https://github.com/jackh0006/X-Messenger/issues

## ⚠️ Disclaimer

This software is provided "as is" without warranty. While it implements strong cryptography, **security depends on correct usage**:
- Always verify fingerprints out-of-band
- Keep devices physically secure
- Use ephemeral messages for sensitive data
- Regularly rotate keys (automatic at 100 messages)
- Update to latest version for security patches

**For high-risk environments, consult a security professional before deployment.**

---

*Built with 🦀 Rust, ☕ Kotlin, and 🔐 post-quantum cryptography*
*X-Messenger — Because privacy is a right, not a feature*