# X Messenger v2 protocol (DRAFT 0.1 — unreviewed, do not implement from this alone)

Status: Phase 0 design document. The handshake/ratchet composition below is
**novel** and MUST be modeled (`model/v2-handshake.spthy`) and independently
audited before any high-risk use. Benchmark: NSA CNSA 2.0 (public suite).
No claim of parity with classified systems is made.

Clean break: v2 envelopes are NOT readable by v1 builds and vice versa.
Envelope magic: `XM2` (v1 used `XM1`).

## 1. Algorithm suite (fixed, no negotiation)

| Role | Algorithm | Standard |
| --- | --- | --- |
| Classical key exchange | ECDH P-384 | NIST P-384, `crypto/ecdh` |
| Post-quantum KEM | ML-KEM-1024 | FIPS 203, `crypto/mlkem` (Go ≥1.24) |
| Hybrid shape | P-384 share \|\| ML-KEM-1024 ct/key (cf. RFC 10024 `SecP384r1MLKEM1024`) | — |
| KDF | HKDF-SHA-384, domain-separated labels | RFC 5869 |
| Message cipher | AES-256-GCM, 96-bit random nonces | — |
| Password KDF | Argon2id (calibrated; 128–256 MiB, t=3, p=1–4; params stored) | RFC 9106 |
| Randomness | OS CSPRNG only (`crypto/rand`) | — |
| Release signing | minisign (Ed25519) now; LMS/XMSS when a mature Go implementation exists | CNSA 2.0 (future) |

Attacker must break BOTH P-384 and ML-KEM-1024 to recover a session
(record-now/decrypt-later resistant). No algorithm agility: version bump,
never negotiation.

## 2. Setup (face to face, once per contact)

1. Each device generates: P-384 keypair `(a, A)`, ML-KEM-1024 keypair
   `(mk, MK)`, using `crypto/rand`.
2. Exchange over QR (camera, not radio): `A`, `MK`, and one random 256-bit
   meeting secret `S` (each side contributes 128 bits, XORed — neither side
   dictates `S` alone). Typing path allowed only for fingerprints/short codes.
3. Compare `SHA-384(A ‖ MK ‖ S)` rendered as 6 words + digits **out loud**.
   Abort on any mismatch (MITM stop).
4. Both compute, with HKDF-SHA-384 and distinct labels:
   - `k_ecdh` = ECDH(a, B_peer) — 48 bytes
   - `(ct, k_kem)` = ML-KEM-1024.Encaps(MK_peer) — ct sent on the same QR
     channel; decapsulated locally
   - `root = HKDF-SHA-384(salt = SHA-384(A‖B‖MK_A‖MK_B), ikm = k_ecdh ‖
     k_kem ‖ S, info = "XM2/root/v1", len = 96)`
   - `chain_AB = root[0:48]`, `chain_BA = root[48:96]` (one chain per
     direction; labels bound to ordered identities).
5. Delete `k_ecdh`, `k_kem`, and the peer's `ct` after derivation. Store only
   wrapped long-term keys (see §5).

Renew: meet again every few months, or immediately on device loss. Old
chains are deleted at renewal (healing).

## 3. Sending (per message)

1. `msg_key, nonce = HKDF-SHA-384(chain_dir, info = "XM2/msg/v1" ‖ counter)`
   split 32+12 bytes; then `chain_dir = HKDF-SHA-384(chain_dir,
   info = "XM2/step/v1")`; **delete the old chain value**.
2. Plaintext: `counter(8B BE) ‖ text(UTF-8) ‖ random pad` to bucket
   {256, 512, 1024} total bytes.
3. `AEAD = AES-256-GCM(msg_key, nonce, aad)` where
   `aad = version(1B: 0x02) ‖ dir(1B) ‖ counter(8B)`.
4. Wire format: `XM2.` + Base32 (no padding) of
   `ver(1B) ‖ dir(1B) ‖ counter(8B) ‖ nonce(12B) ‖ ciphertext+tag`,
   grouped in 5-char blocks with a CRC-16 checksum word. Primary move: QR
   or `.xmsg` file (1 KB buckets stay scannable); hand-typing only for
   short codes.
5. Increment counter. Never reuse a nonce; counters are the replay clock
   (no wall-clock trust).

## 4. Receiving

1. Verify checksum + Base32; reject malformed (fail closed, neutral error).
2. Reject `counter` already seen (replay window per contact, persistent).
3. Derive `msg_key` for the counter, tolerating gaps: keep a bounded
   skipped-key cache (≤ 64 entries); derive-and-store skipped keys, evict
   oldest. Out-of-order inside the window decrypts; outside it fails closed.
4. Decrypt + verify AAD; on success delete the used key. Display; keep
   plaintext in memory only, zero after use.

## 5. At-rest hierarchy (crypto-shredding)

- Master key `M`: `Argon2id(passphrase, salt, mem, t, p)` mixed via
  `HKDF-SHA-384` with a random device key in hardware storage
  (Android Keystore/StrongBox, TPM on Linux). Files alone ⇒ nothing.
- Conversation key `C_i`: random 256-bit, stored only as `AEAD(M, C_i)`.
- Messages: `AEAD(C_i, aad = convID ‖ msgID)` ciphertext only.
- Delete one message: delete record (optionally per-message key, then
  destroy it). Delete conversation: destroy `C_i`, then files. Delete
  everything: destroy `M`, hardware key, wrapped keys — instant,
  irreversible. Flash can't be reliably overwritten; key destruction is
  the mechanism. Optional timers (e.g. 1 hour).
- Never persisted: plaintext, phrases, keys in logs/backups/clipboard.

## 6. Offline enforcement + gateway split

- Offline build: no `net`/`net/http` in `go list -deps` (CI fails otherwise),
  `-trimpath` reproducible builds, no `INTERNET` permission (Android),
  `PrivateNetwork=yes`/`unshare -n` (Linux). Verify from outside with a
  traffic capture (expect zero packets).
- Gateway is a **separate build**: dumb mailbox (padded blobs, random IDs,
  TTL, no keys/logs), pinned TLS 1.3, optional Tor onion. Signed updates
  with rollback counter.

## 7. Open questions for the audit

1. Chain-step KDF labels and counter-width limits under long-lived contacts.
2. Skipped-key cache sizing vs. DoS (memory exhaustion by insult).
3. QR pairing ceremony resistance to camera-over-shoulder at step 3.
4. Argon2id calibration table for low-end Android (128 MiB floor?).
5. Formal lemmas in `model/v2-handshake.spthy`: secrecy of `root`,
   forward secrecy after step, post-compromise healing at renewal.
