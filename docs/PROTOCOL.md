# X-Messenger Protocol Specification

**Status:** Draft / v1 — implemented in `core.js` as the XM1 envelope format (v2) and XMV1 vault format.

**Honesty constraint:** This is a passphrase-based encrypted file/message courier, **not** a real-time messaging protocol. It does **not** implement double-ratchet forward secrecy, post-compromise recovery, session key ratcheting, or deniability. Do not claim compatibility with Signal, the Signal Protocol, MLS, or any other established messaging protocol. The design favors simplicity and auditability over the full feature set of a modern secure messenger.

---

## 1. Scope and Design Goals

- **Offline-first encrypted courier:** messages are sealed into self-contained packages that can be transferred by any out-of-band channel (QR code, removable media, file exchange, etc.).
- **Passphrase-based access control:** no accounts, no phone numbers, no server registration. A user-memorized passphrase derives all cryptographic material.
- **Authenticated encryption:** every message envelope is encrypted and integrity-protected with AES-256-GCM.
- **Small, auditable surface:** minimal dependencies; no custom cryptographic primitives.

### Explicitly non-goals (for v1)

- Real-time synchronous messaging.
- Forward secrecy or post-compromise recovery.
- Multi-device session synchronization.
- Deniable authentication.
- Resistance to traffic analysis.
- Online relay or server-mediated delivery (LAN/VPS are opt-in).

---

## 2. Protocol Version

| Field | Value | Notes |
|-------|-------|-------|
| Protocol name | XM1 | X-Messenger v1 envelope format |
| Envelope version | `v: 2` | JSON field `"v"` |
| KDF | `PBKDF2-HMAC-SHA256` | JSON field `"kdf"` |
| Iterations | `600_000` | JSON field `"i"` |
| Salt length | 16 bytes | Random per envelope |
| Nonce length | 12 bytes | Random per envelope (AES-GCM standard) |
| Cipher | AES-256-GCM | Authenticated encryption |
| Vault format | `XMV1.` | Encrypted on-device history vault |
| Multi-part QR | `XMQ1.` | Numbered chunks for large payloads |

Version negotiation: **none in v1.** A single fixed version is supported. If a payload declares an unsupported `v`, `kdf`, or `i`, decryption fails closed with an error. Future versions (v3+) may be introduced alongside v2; the receiver must explicitly enumerate supported versions and reject anything outside that set. There is no silent downgrade.

v2 envelopes (`XM2`) are a separate experimental draft (see `docs/PROTOCOL-v2.md`) using P-384 + ML-KEM-1024; they are **not** readable by v1 builds and vice versa.

---

## 3. Key Roles and Domain Separation

Keys are never reused across unrelated purposes:

| Key purpose | Derivation source | Storage | Lifetime |
|-------------|-------------------|---------|----------|
| Vault encryption key | PBKDF2(passphrase, vault_salt) | Never persisted; derived on unlock | Vault unlocked session |
| Message envelope key | PBKDF2(phrase, salt) | Not stored; derived per seal operation | Single message |
| Salt/nonce | `crypto.getRandomValues()` (OS CSPRNG) | Stored in envelope metadata | Single use |

- **Vault key:** protects all messages, contacts, and metadata at rest. Derived from the vault passphrase with a fresh vault salt stored in the vault file header.
- **Envelope key:** protects an individual message package. Derived from a sharing phrase supplied by the sender. Each seal operation uses a fresh salt and nonce.

The vault passphrase and sharing phrases are **never stored**. Only derived key material exists in memory, and only transiently. Buffers are zeroized after use.

---

## 4. Message Envelope Format (XM1 / v2)

A sealed message is a UTF-8 string of the form:

```
XM1.<base64url(JSON payload)>
```

### JSON payload fields

| Field | Type | Presence | Description |
|-------|------|----------|-------------|
| `v` | integer | Required | Envelope version; must be `2`. |
| `kdf` | string | Required | Key derivation function; must be `"PBKDF2-SHA256"`. |
| `i` | integer | Required | PBKDF2 iterations; must be `600000`. |
| `s` | string | Required | Base64url-encoded 16-byte random salt. |
| `n` | string | Required | Base64url-encoded 12-byte random GCM nonce. |
| `c` | string | Required | Base64url-encoded AES-256-GCM ciphertext (includes 16-byte GCM tag). |

### Plaintext structure before encryption

```
[4-byte big-endian length][plaintext bytes][zero padding to bucket]
```

Bucket sizes: 256, 512, 1024, 2048, 4096, 8192, 16384 bytes. Maximum plaintext: 16380 bytes (4-byte length prefix). Maximum input: 8000 characters. Messages exceeding these are rejected.

### Encryption algorithm

1. Validate input (non-empty text and phrase; text ≤ 8000 chars; UTF-8 ≤ 16380 bytes).
2. Generate random 16-byte salt and 12-byte nonce from the OS CSPRNG.
3. Derive a 256-bit AES-GCM key: `PBKDF2-HMAC-SHA256(phrase, salt, 600000)`.
4. Pad plaintext to the smallest fitting bucket, prepend a 4-byte BE length.
5. Encrypt with `AES-256-GCM(key, nonce, plaintext, AAD="XMessenger/2")`.
6. Zeroize the plaintext, salt, and nonce buffers immediately after encryption.
7. Serialize the JSON payload and base64url-encode it.
8. Prefix with `XM1.`.

### Decryption algorithm

1. Validate `XM1.` prefix and non-empty phrase.
2. Base64url-decode and parse the JSON payload.
3. Validate `v == 2`, `kdf == "PBKDF2-SHA256"`, `i == 600000`. (v1 envelopes also accepted for backward compat.)
4. Decode salt (16 bytes), nonce (12 bytes), ciphertext (non-empty).
5. Derive key: `PBKDF2-HMAC-SHA256(phrase, salt, 600000)`.
6. Decrypt with `AES-256-GCM`. GCM authentication tag failure → reject (wrong phrase or tampered payload).
7. Validate padded structure: bucket size in allowed set, length prefix consistent.
8. Zeroize buffers immediately after decryption.
9. Return the plaintext decoded as UTF-8 (fatal on malformed UTF-8).

Errors are generic and do not distinguish wrong passphrase from tampered ciphertext, to avoid oracle feedback.

---

## 5. Multi-Part QR Format (XMQ1)

Large sealed payloads that do not fit one reliable QR are split into numbered `XMQ1` chunks:

- Format: `XMQ1.<id>.<i>.<n>.<base64url slice>`
- `id`: random 16-byte base64url identifier shared by all parts
- `i`: part number (1-based), `n`: total parts (max 64)
- Max chunk size: 1200 chars per part; slice ≤ 1400 bytes
- Assembly is strict: same id, all parts 1..n present, no duplicates; anything else fails closed.
- Chunks carry no keys, phrases, or plaintext beyond what the sealed payload already holds.

---

## 6. Vault Format (XMV1)

The vault is an authenticated-encrypted container storing all local data (messages, contacts, trust state, metadata).

### Vault file envelope

```
XMV1.<base64url(JSON {v:1, kdf:"PBKDF2-SHA256", i:600000, s:<salt>, n:<nonce>, c:<ciphertext>})>
```

### Vault contents (plaintext before encryption)

JSON-serializable value containing messages, contacts, trust state, and metadata.

### Vault operations

- **Seal:** encrypt value with fresh salt/nonce per operation.
- **Open:** decrypt and authenticate; wrong passphrase or altered byte fails closed.
- Max vault size: 2 MB.

---

## 7. Message Authentication and Integrity

- Every message envelope is authenticated by AES-256-GCM. Tampering with any byte causes decryption to fail.
- The vault file is authenticated by AES-256-GCM over the serialized contents.
- **No separate MAC or signature layer**; GCM provides both confidentiality and integrity.
- **No sender authentication:** the envelope is sealed with a shared phrase. Anyone who knows the phrase can seal a message.

---

## 8. Replay Detection and Duplicate Handling

**Not implemented in v1.** Each envelope is stateless; there is no message identifier registry, no sequence number, and no replay cache. The same sealed package can be decrypted multiple times by any holder of the phrase. Applications consuming sealed packages must implement their own replay protection at the application layer if required.

---

## 9. Identity and Device Key Roles

**Not implemented in v1.**

The current design uses a single shared phrase per message and a single vault passphrase. There are **no** long-term identity key pairs, no device keys, no contact public keys, and no fingerprint verification in the cryptographic layer.

### Planned (future)

- Local identity key pair generated on vault creation.
- Contact public keys stored with SHA-384 fingerprints.
- Out-of-band fingerprint verification (QR code comparison) before marking a contact trusted.
- Explicit trust-state transitions and revocation warnings on key change.

---

## 10. Local Data Deletion

Supported operations:
- Delete individual message
- Delete conversation
- Delete contact
- Delete entire vault / backup files

### Cryptographic erasure

**Not implemented in v1.** Deleting a file removes the filesystem reference but does not overwrite storage blocks. Because the data is encrypted at rest, destruction of the vault passphrase renders the ciphertext unrecoverable without the passphrase. Users who require forensic unrecoverability should delete the vault file and use filesystem-level secure-erase tooling.

---

## 11. Error Handling

- All cryptographic failures return generic, non-distinguishing errors.
- No error reveals whether a passphrase was wrong versus the payload was tampered with.
- No silent fallback to weaker ciphers, KDFs, or protocol versions.
- No silent fallback when an operation fails.

---

## 12. Message Size and Nesting Limits

- Maximum plaintext per sealed message: **16,380 bytes** (UTF-8).
- Maximum input: **8,000 characters**.
- Maximum vault size: **2 MB**.
- No nested envelopes.

---

## 13. Compatibility Rules

- Importers/exporters must agree on the XM1 v2 envelope format and PBKDF2 parameters.
- Cross-implementation compatibility is only claimed for implementations that reproduce this exact format.
- No forward compatibility promise; no backward compatibility promise for v1 payloads beyond explicit support.

---

## 14. Forward Secrecy and Post-Compromise Recovery

**Not implemented.** Do not advertise or claim:
- Forward secrecy (compromise of the passphrase exposes all past and future messages).
- Post-compromise security / self-healing.
- Deniability.
- Post-quantum security (v2 is experimental and unaudited).

---

## 15. Persistence of Session State

**No sessions exist in v1.** The courier is stateless: each seal/decrypt operation derives keys on demand and zeroizes them afterward. The vault holds persistent encrypted state, but no ephemeral session state is maintained between operations.

---

## 16. Backup and Restoration Implications

- Backups are encrypted with the same passphrase as the source vault.
- If the passphrase is lost, **all data is permanently unrecoverable.** No recovery mechanism, no key escrow, no reset path.
- Users must back up both the vault file and remember the passphrase.

---

## 17. Retirement of Old Protocol Versions

v2 is the only supported version. Retirement procedure for any future version:
1. Announce deprecation in release notes.
2. Continue reading deprecated versions for one release cycle.
3. Stop writing deprecated versions; write only the current version.
4. After two release cycles, remove read support for deprecated versions.

---

## 18. Cryptographic Dependencies

| Component | Purpose | Standard |
|-----------|---------|----------|
| Web Crypto API | AES-256-GCM, PBKDF2-HMAC-SHA256, CSPRNG | W3C Web Cryptography API |
| qrcode | QR code generation | ISO/IEC 18004 |
| jsqr | QR code scanning | ISO/IEC 18004 |

No claim is made that dependency audits guarantee application security.

---

## 19. Known Limitations (v1)

1. No forward secrecy.
2. No sender identity (shared phrase authenticates possession of phrase, not a person).
3. No replay protection.
4. No contact trust system (fingerprints reserved but not cryptographically bound).
5. No secure file deletion.
6. No online transport in default mode.
7. No post-quantum cryptography (v2 experimental).

---

## 20. Change Log

| Version | Date | Changes |
|---------|------|---------|
| v2 (current) | 2026-10 | XM1 envelope: PBKDF2-HMAC-SHA256 (600k) + AES-256-GCM, padded plaintext, JSON metadata, base64url transport, XMV1 vault, XMQ1 multi-part QR. |
| v1 | (pre-release) | Earlier format; backward-compatible read supported. |
