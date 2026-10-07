# Security Specification - Omni Messenger

**Version:** 1.0  
**Classification:** CIA-Grade / Air-Gapped  
**Status:** Implementation Complete

---

## 1. Threat Model

### 1.1 Adversary Capabilities
- **Passive**: Network traffic capture, metadata analysis, timing attacks
- **Active**: MITM, message injection, replay, modification, deletion
- **Quantum**: CRQC (Cryptographically Relevant Quantum Computer) with Shor's algorithm
- **Physical**: Device theft, forensic analysis, side-channel attacks
- **Insider**: Compromised contact, coerced key disclosure

### 1.2 Security Goals
| Goal | Property | Mechanism |
|------|----------|-----------|
| Confidentiality | IND-CCA2 | Hybrid KEM (X25519+ML-KEM-768) + AEAD (XChaCha20-Poly1305) |
| Integrity | INT-CTXT | AEAD + HMAC-SHA3-256 |
| Authentication | EUF-CMA | Hybrid Signatures (Ed25519+Dilithium3) |
| Forward Secrecy | FS | Double Ratchet + PQ Ratchet |
| Post-Compromise | PCS | Self-healing ratchet on message receipt |
| Deniability | OTR-style | No non-repudiation, ephemeral keys |
| Anonymity | Metadata protection | No identifiers in ciphertext, padded messages |
| Availability | Offline-first | QR/NFC/USB transport, no server dependency |

### 1.3 Trust Assumptions
- Initial contact verification via out-of-band fingerprint comparison
- Device integrity (no rootkits, hardware backdoors)
- CSPRNG quality (OS entropy source)
- Correct implementation of cryptographic primitives

---

## 2. Cryptographic Primitives

### 2.1 Key Encapsulation Mechanism (KEM)

#### Hybrid KEM: X25519 + ML-KEM-768
```
HybridKEM.Encapsulate(pk_classical, pk_pq) → (ct_classical, ct_pq, ss)
HybridKEM.Decapsulate(sk_classical, sk_pq, ct_classical, ct_pq) → ss
```

**Construction:**
- Classical: X25519 (RFC 7748) - 128-bit classical security
- Post-Quantum: ML-KEM-768 (FIPS 203, Kyber-768) - NIST Level 5 (256-bit classical, 128-bit quantum)
- Combination: Concatenated KEM (SS = SS_classical || SS_pq, then HKDF)
- Ciphertext: ct = ct_classical || ct_pq (32 + 1088 = 1120 bytes)
- Public Key: pk = pk_classical || pk_pq (32 + 1184 = 1216 bytes)
- Secret Key: sk = sk_classical || sk_pq (32 + 2400 = 2432 bytes)

**Security Proof:** Hybrid KEM achieves IND-CCA2 if either component is IND-CCA2 (Binder et al., 2022)

### 2.2 Digital Signatures

#### Hybrid Signature: Ed25519 + Dilithium3
```
HybridSign.Sign(sk_classical, sk_pq, msg) → (sig_classical, sig_pq)
HybridSign.Verify(pk_classical, pk_pq, msg, sig_classical, sig_pq) → bool
```

**Construction:**
- Classical: Ed25519 (RFC 8032) - 128-bit security
- Post-Quantum: ML-DSA-65 (FIPS 204, Dilithium3) - NIST Level 5
- Combination: Both signatures must verify (AND composition)
- Signature: sig = sig_classical || sig_pq (64 + 3293 = 3357 bytes)
- Public Key: pk = pk_classical || pk_pq (32 + 1952 = 1984 bytes)
- Secret Key: sk = sk_classical || sk_pq (32 + 4032 = 4064 bytes)

**Security Proof:** Hybrid signature achieves EUF-CMA if either component is EUF-CMA

### 2.3 Authenticated Encryption (AEAD)

#### Primary: XChaCha20-Poly1305 (RFC 8439)
- Key: 256 bits
- Nonce: 192 bits (random, never reused)
- Tag: 128 bits
- AAD: Associated authenticated data (header, message number)

#### Fallback: AES-256-GCM-SIV (RFC 8452)
- Key: 256 bits
- Nonce: 96 bits
- Tag: 128 bits
- Nonce misuse resistant

### 2.4 Key Derivation Functions

#### HKDF-SHA3-512 (RFC 5869 with SHA3-512)
```
HKDF-Extract(salt, IKM) → PRK
HKDF-Expand(PRK, info, L) → OKM
```

**Parameters:**
- Extract salt: Domain-separated ("OMNI-INIT", "OMNI-SESSION", etc.)
- Expand info: Context-specific ("CHAIN-NEXT", "MESSAGE-KEYS", "ROOT-RATCHET")
- Output length: Up to 255 × 64 bytes

#### Argon2id (RFC 9106) - Password-Based KDF
- Memory: 65,536 KiB (64 MiB)
- Iterations: 3
- Parallelism: 4
- Output: 256 bits
- Salt: 128 bits random

### 2.5 Hash Functions

| Algorithm | Output | Use Case |
|-----------|--------|----------|
| SHA3-256 | 256 bits | General hashing, HMAC, fingerprints |
| SHA3-512 | 512 bits | HKDF extract, root key derivation |
| BLAKE3 | 256 bits | Fast hashing, keyed MAC, key derivation |
| SHA2-256 | 256 bits | Compatibility, TLS certificates |

---

## 3. Key Hierarchy

### 3.1 Long-Term Identity Keys
```
IdentityKeyPair:
  KEM KeyPair:     (pk_kem, sk_kem)     ← Hybrid X25519+ML-KEM-768
  Sign KeyPair:    (pk_sign, sk_sign)   ← Hybrid Ed25519+Dilithium3
  Created:         timestamp
  Expires:         optional (default: none)
```

**Fingerprint:** SHA3-256(pk_kem || pk_sign) → 64 hex chars

### 3.2 Medium-Term PreKeys (X3DH-style)

#### Signed PreKey (SPK)
```
SignedPreKey:
  KeyPair:         (pk_spk, sk_spk)     ← X25519 (32 bytes each)
  Signature:       sig = Ed25519.Sign(sk_sign, pk_spk)
  KeyID:           uint32
  Created:         timestamp
  Expires:         +30 days
```

#### One-Time PreKeys (OPK)
```
OneTimePreKey:
  KeyPair:         (pk_opk, sk_opk)     ← X25519
  KeyID:           uint32
  Used:            bool
```

**PreKey Bundle:**
```
PreKeyBundle:
  IdentityPK:      pk_identity
  SignedPreKey:    pk_spk
  SPKSignature:    sig_spk
  OneTimePreKeys:  [pk_opk_1, ..., pk_opk_N]  (N=10 default)
  Created:         timestamp
  Expires:         +30 days
```

### 3.3 Session Keys (Ephemeral)

```
SessionKeys:
  CipherKey:       32 bytes  ← Message encryption
  MACKey:          32 bytes  ← HMAC-SHA3-256
  RatchetKey:      32 bytes  ← Chain key derivation
  AuthKey:         32 bytes  ← Authentication tag
  Created:         timestamp
  MessageCount:    uint64
```

**Derivation from Shared Secret (SS):**
```
PRK = HKDF-Extract("OMNI-SESSION", SS)
OKM = HKDF-Expand(PRK, context, 128 bytes)
CipherKey  = OKM[0:32]
MACKey     = OKM[32:64]
RatchetKey = OKM[64:96]
AuthKey    = OKM[96:128]
```

---

## 4. Double Ratchet + PQ Ratchet

### 4.1 Classical Double Ratchet (Signal Protocol)

```
RootKey (32 bytes)
    │
    ├── DH Ratchet (X25519)
    │     Alice PK ──→ Bob PK
    │     Bob  PK ──→ Alice PK
    │     DH Shared Secret → HKDF → New RootKey + ChainKey
    │
    ├── Sending Chain
    │     ChainKey → (NextChainKey, MessageKey)
    │     MessageKey → (CipherKey, MACKey, IV)
    │
    └── Receiving Chain
          ChainKey → (NextChainKey, MessageKey)
          MessageKey → (CipherKey, MACKey, IV)
```

**Ratchet Step (DH):**
1. Generate new X25519 keypair
2. DH with peer's current public key
3. HKDF-SHA3-512(RootKey, DH_shared) → (NewRootKey, NewChainKey)
4. Update sending/receiving chains
5. Increment epoch

### 4.2 Post-Quantum Ratchet

**Trigger:** Every 100 messages (configurable)
```
PQ Ratchet Step:
1. Generate new ML-KEM-768 keypair (pk_pq_new, sk_pq_new)
2. Encapsulate to peer's PQ public key: (ct_pq, ss_pq) = ML-KEM.Encaps(pk_pq_peer)
3. Include ct_pq in next message header
4. Peer decapsulates: ss_pq = ML-KEM.Decaps(sk_pq_peer, ct_pq)
5. New RootKey = HKDF-SHA3-512(OldRootKey, ss_pq)
6. Update PQ key pair
```

**Security:** Provides post-quantum forward secrecy even if classical DH is broken retroactively

### 4.3 Ratchet State

```
RatchetState:
  // Identity
  IdentitySK:       sk_sign (hybrid)
  IdentityPK:       pk_sign (hybrid)
  TheirIdentityPK:  pk_sign_peer (hybrid)
  
  // Root Key
  RootKey:          32 bytes
  
  // Sending Chain
  SendingChainKey:  32 bytes
  SendingDHRatchet: (pk_dh, sk_dh)     ← X25519
  TheirDHRatchetPK: pk_dh_peer         ← X25519
  
  // Receiving Chain
  ReceivingChainKey: 32 bytes
  ReceivingDHRatchet: (pk_dh, sk_dh)?  ← X25519 (optional)
  
  // Counters
  SendingMsgNum:    uint64
  ReceivingMsgNum:  uint64
  MaxSkip:          100
  
  // Skipped Message Keys
  SkippedKeys:      Map<(epoch, msg_num), MessageKey>
  
  // PQ Ratchet
  PQEnabled:        bool
  PQCounter:        uint64
  PQInterval:       100
  
  // Crypto
  CipherAlgorithm:  XChaCha20Poly1305 | AES256GCMSIV
  
  // Epoch
  Epoch:            uint32
```

---

## 5. Message Format

### 5.1 Wire Format (Binary CBOR)

```
Message:
  Header:       MessageHeader
  Ciphertext:   bytes (AEAD encrypted)
  MAC:          32 bytes (HMAC-SHA3-256)
  Signature:    bytes? (Hybrid signature, optional)

MessageHeader:
  Version:      u8 = 1
  Flags:        u8 (bitfield)
  Epoch:        u32
  MsgNum:       u64
  DHRatchetPK:  32 bytes (X25519 public)
  PQRatchetCT:  bytes? (ML-KEM-768 ciphertext, 1088 bytes)
  PrevMsgNum:   u64
  Timestamp:    u64 (ms since epoch)

Flags:
  0x01: PQ_RATCHET    - PQ ratchet ciphertext present
  0x02: COMPRESSED    - Payload Zstd compressed
  0x04: EPHEMERAL     - Auto-delete after read
  0x08: RECEIPT       - Read receipt
  0x10: KEY_ROTATION  - Key rotation message
```

### 5.2 Encryption Process

```
Encrypt(plaintext, session_keys, header):
  1. Derive MessageKey from SendingChainKey
  2. Generate random nonce (192 bits for XChaCha20, 96 for AES-GCM-SIV)
  3. AAD = Header || session_keys.auth_key
  4. Ciphertext = AEAD.Encrypt(MessageKey.cipher_key, nonce, plaintext, AAD)
  5. MAC = HMAC-SHA3-256(MessageKey.mac_key, Header || Ciphertext)
  6. (Optional) Signature = HybridSign.Sign(identity_sk, Header || Ciphertext || MAC)
  7. Advance SendingChainKey
  8. Increment SendingMsgNum
  9. Check PQ ratchet interval
  10. Return Message
```

### 5.3 Decryption Process

```
Decrypt(message, session_keys):
  1. Verify MAC = HMAC-SHA3-256(ReceivingChainKey.mac_key, Header || Ciphertext)
  2. If DH ratchet public key changed → DH ratchet step
  3. If PQ ratchet ciphertext present → PQ ratchet step (decapsulate)
  4. Derive MessageKey from ReceivingChainKey (skip if needed)
  5. AAD = Header || session_keys.auth_key
  6. Plaintext = AEAD.Decrypt(MessageKey.cipher_key, nonce, Ciphertext, AAD)
  7. Verify message number (handle out-of-order with skipped keys)
  8. Advance ReceivingChainKey
  9. Increment ReceivingMsgNum
  10. Return Plaintext
```

### 5.4 Out-of-Order Delivery

- Max skip: 100 message keys stored
- When message N+K arrives before N:
  1. Derive and store keys for N...N+K-1 in skipped_keys map
  2. Decrypt N+K normally
  3. When N arrives, use skipped key
- Prevents DoS via memory exhaustion

---

## 6. QR Code Transport Protocol

### 6.1 Encoding Pipeline

```
Message → CBOR → Zstd(level=3) → Chunk → Base64URL → QR Code
```

### 6.2 Chunking

- Max QR capacity (v40-H): 2,953 bytes
- Overhead per chunk: ~50 bytes (version, index, total, message_id, CRC32)
- Effective payload: ~2,900 bytes per QR
- Large messages split across multiple QR codes

### 6.3 Chunk Format

```
QrChunk:
  Version:       u8 = 1
  TotalChunks:   u16
  ChunkIndex:    u16 (0-based)
  MessageID:     [u8; 16] (truncated SHA3-256 of compressed data)
  Payload:       bytes
  CRC32:         u32 (crc32fast of payload)
```

### 6.4 Reconstruction

1. Collect all chunks (verify same MessageID)
2. Sort by ChunkIndex
3. Verify sequential (0 to TotalChunks-1)
4. Verify CRC32 per chunk
5. Concatenate payloads
6. Zstd decompress
7. CBOR decode to EncryptedPackage
8. Decrypt with session keys

### 6.5 Contact QR Format

```
ContactQR:
  Version:     u8 = 1
  Type:        u8 = 1 (Contact)
  Name:        string
  IdentityPK:  base64url (hybrid identity public key)
  SignedPK:    base64url (X25519 signed prekey)
  SPSig:       base64url (Ed25519 signature of signed prekey)
  OPKs:        [base64url] (one-time prekeys)
  AvatarHash:  base64url? (SHA3-256 of avatar)
  ExpiresAt:   u64? (timestamp)
```

---

## 7. Key Exchange Protocol (X3DH + Hybrid)

### 7.1 Initiator (Alice) → Responder (Bob)

**Alice fetches Bob's PreKey Bundle:**
```
Bob's Bundle = {
  IdentityPK_B,
  SignedPK_B,
  SPSig_B,
  OPKs_B[0..N-1]
}
```

**Alice verifies:**
```
1. Verify Ed25519.Sig(IdentityPK_B.ed25519, SignedPK_B) == SPSig_B
2. Verify IdentityPK_B matches known fingerprint (out-of-band)
```

**Alice generates ephemeral key:**
```
Ephemeral_A = X25519.Generate()
```

**Alice computes shared secrets:**
```
DH1 = X25519.DH(Ephemeral_A.sk, SignedPK_B)
DH2 = X25519.DH(Identity_A.x25519, SignedPK_B)
DH3 = X25519.DH(Ephemeral_A.sk, Identity_B.x25519)
DH4 = X25519.DH(Ephemeral_A.sk, OPK_B[0])  (if OPK available)

PQ1 = ML-KEM.Encaps(Identity_B.mlkem768)
PQ2 = ML-KEM.Encaps(OPK_B[0].mlkem768)  (if OPK available)

SK = HKDF-SHA3-512("", DH1 || DH2 || DH3 || DH4 || PQ1 || PQ2 || "OMNI-X3DH")
```

**Alice sends initial message:**
```
InitialMessage:
  EphemeralPK_A:    Ephemeral_A.pk
  IdentityPK_A:     Identity_A.pk
  SignedPK_A:       SignedPK_A (from bundle)
  SPSig_A:          SPSig_A
  UsedOPK_ID:       OPK_B[0].id (or null)
  PQ_Ciphertexts:   [PQ1.ct, PQ2.ct?]
  EncryptedPayload: AEAD.Encrypt(SK, first_message)
```

### 7.2 Responder (Bob) Processing

```
Bob receives InitialMessage:
1. Verify SPSig_A with IdentityPK_A.ed25519
2. Verify IdentityPK_A matches known fingerprint
3. Mark OPK_B[0] as used (delete)
4. Compute same DH shared secrets
5. Decapsulate PQ ciphertexts with corresponding SKs
6. Derive same SK
7. Decrypt first message
8. Initialize Double Ratchet with SK
9. Send response (ratchet confirmation)
```

---

## 8. Offline Transport Methods

### 8.1 QR Code (Primary)
- **Capacity**: ~2.9 KB per QR (v40-H)
- **Chunking**: Automatic for large messages
- **Error Correction**: High (H) - 30% damage recovery
- **Scanning**: Camera or gallery image
- **Animation**: Multiple QR codes displayed sequentially

### 8.2 NFC (Android Beam / Peer-to-Peer)
- **Range**: < 4 cm
- **Speed**: 424 kbps
- **Use Case**: Contact exchange, small messages
- **Security**: Same encryption, transport confidentiality

### 8.3 USB / Local Network
- **USB**: USB OTG, ADB, or custom protocol
- **Local Network**: mDNS discovery, direct TCP (if air-gap permits)
- **Speed**: Up to 480 Mbps (USB 2.0) / 1 Gbps (Ethernet)
- **Use Case**: Bulk transfer, initial sync

### 8.4 File-Based (SD Card / USB Drive)
- **Format**: Encrypted package files (.omni)
- **Transfer**: Sneakernet
- **Use Case**: Highest security, no electronic emanation

---

## 9. Key Management

### 9.1 Key Generation
- **CSPRNG**: OS entropy (getrandom, /dev/urandom, Android Keystore)
- **Key Sizes**: Per NIST recommendations (see Section 2)
- **Validation**: Public key validation (curve membership, order)

### 9.2 Key Storage

#### Linux (Desktop)
- **Encrypted SQLite**: SQLCipher or AES-256-GCM-SIV encrypted database
- **Key Derivation**: Argon2id from user passphrase
- **Memory**: Zeroize-on-drop, mlock() where available

#### Android
- **EncryptedSharedPreferences**: AES-256-GCM-SIV (MasterKey)
- **Keystore**: Hardware-backed (StrongBox/TEE) for identity keys
- **Biometric**: Optional unlock with fingerprint/face

### 9.3 Key Rotation
- **DH Ratchet**: Every message (forward secrecy)
- **PQ Ratchet**: Every 100 messages (post-quantum forward secrecy)
- **Signed PreKey**: Every 30 days
- **One-Time PreKeys**: Single use, regenerate batch when < 5 remain
- **Identity Keys**: Long-term, rotate only on compromise

### 9.4 Key Deletion
- **Message Keys**: Zeroized immediately after use
- **Chain Keys**: Zeroized on ratchet step
- **Ephemeral Keys**: Zeroized on session end
- **Identity Keys**: Zeroized on "Clear All Data" or app uninstall

---

## 10. Implementation Security

### 10.1 Constant-Time Operations
- All secret-dependent branches eliminated
- `constant_time_eq()` for all comparisons
- `subtle` crate patterns for conditional selection

### 10.2 Memory Safety
- `zeroize` and `zeroize_on_drop` on all secret types
- `SecretBytes` wrapper prevents accidental logging
- No `unsafe` in crypto modules
- Rust memory safety guarantees

### 10.3 Side-Channel Resistance
- Constant-time scalar multiplication (X25519 via `dalek`)
- Constant-time polynomial operations (ML-KEM via `pqcrypto`)
- Blinding in RSA/ECDSA (not used, but available)
- Cache-timing resistant table lookups

### 10.4 Testing
- **Unit Tests**: All primitives, ratchet steps, serialization
- **Property Tests**: Proptest for round-trip, commutativity
- **Vector Tests**: NIST KAT vectors for ML-KEM, ML-DSA
- **Integration Tests**: Full protocol flows, QR chunking
- **Fuzzing**: cargo-fuzz on parsers, decoders

---

## 11. Compliance & Standards

| Standard | Component | Status |
|----------|-----------|--------|
| FIPS 203 | ML-KEM-768 (Kyber) | ✅ Implemented via pqcrypto-kem |
| FIPS 204 | ML-DSA-65 (Dilithium) | ✅ Implemented via pqcrypto-sign |
| RFC 7748 | X25519 | ✅ Implemented via x25519-dalek |
| RFC 8032 | Ed25519 | ✅ Implemented via ed25519-dalek |
| RFC 8439 | XChaCha20-Poly1305 | ✅ Implemented via chacha20poly1305 |
| RFC 8452 | AES-256-GCM-SIV | ✅ Implemented via aes-gcm-siv |
| RFC 5869 | HKDF | ✅ Custom with SHA3-512 |
| RFC 9106 | Argon2id | ✅ Implemented via argon2 |
| RFC 7748 | Double Ratchet | ✅ Custom implementation |
| Signal Spec | X3DH | ✅ Hybrid variant |

---

## 12. Security Checklist for Deployment

- [ ] Verify fingerprint out-of-band before first message
- [ ] Enable ephemeral messages for sensitive conversations
- [ ] Set auto-lock timeout (recommended: 5-15 minutes)
- [ ] Use strong device passphrase (Argon2id protects keys)
- [ ] Keep app updated (security patches)
- [ ] Disable unused transports (NFC, USB if not needed)
- [ ] Regularly verify contact fingerprints
- [ ] Use "Clear All Data" on device decommission
- [ ] Run self-tests after updates
- [ ] Audit QR codes before scanning (check for tampering)

---

## 13. Future Enhancements

| Feature | Description | Priority |
|---------|-------------|----------|
| ML-KEM-1024 | Higher security level when standardized | Medium |
| PQ Key Encapsulation | HPKE with hybrid KEM | Medium |
| Group Messaging | MLS (Message Layer Security) with PQ | High |
| Voice/Video | Encrypted WebRTC over local transport | Low |
| Hardware Tokens | FIDO2 / PIV integration for identity | Medium |
| Remote Attestation | TEE/SE attestation for device integrity | High |

---

## 14. References

1. **Signal Protocol** - Double Ratchet Algorithm (Perrin, Marlinspike)
2. **NIST FIPS 203** - Module-Lattice-Based Key-Encapsulation Mechanism (ML-KEM)
3. **NIST FIPS 204** - Module-Lattice-Based Digital Signature Standard (ML-DSA)
4. **RFC 7748** - Elliptic Curves for Security (X25519)
5. **RFC 8032** - Edwards-Curve Digital Signature Algorithm (EdDSA)
6. **RFC 8439** - ChaCha20 and Poly1305 for IETF Protocols
7. **RFC 8452** - AES-GCM-SIV
8. **RFC 5869** - HMAC-based Extract-and-Expand Key Derivation Function (HKDF)
9. **RFC 9106** - Argon2 Memory-Hard Function
10. **Binder et al.** - "Hybrid Key Encapsulation" (2022)
11. **pqcrypto** - Rust bindings for PQClean (ML-KEM, ML-DSA)
12. **dalek cryptography** - X25519, Ed25519 implementations

---

*Document Version 1.0 - October 2026*  
*Omni Messenger - CIA-Grade Offline Messaging*