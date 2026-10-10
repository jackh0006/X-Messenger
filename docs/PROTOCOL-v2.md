# X Messenger v2 protocol (DRAFT 0.2 — self-reviewed, still needs audit)

Status: Phase 0 design document. The handshake/ratchet composition below is
**novel** and MUST be modeled (`model/v2-handshake.spthy`) and independently
audited before any high-risk use. Benchmark: NSA CNSA 2.0 (public suite).
No claim of parity with classified systems is made.

Conventions used everywhere below: identities are ordered lexicographically
by fingerprint (`lo`, `hi`). Every hash, KDF input, chain-half assignment,
AAD direction byte (`0x00` = lo→hi, `0x01` = hi→lo), and secret ordering
uses this order, so both sides always agree.

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
2. Exchange over QR (camera, not radio): `A`, `MK`, and a 128-bit half
   secret (`sA` / `sB`). Meeting secret `S = sA ⊕ sB` — two QR scans
   minimum; neither side dictates `S` alone. Typing path allowed only for
   fingerprints/short codes.
3. Each side encapsulates to the peer's key and shows the resulting `ct`
   on a second QR each: `(ct_lo, k_lo)` = Encaps(`MK_hi`),
   `(ct_hi, k_hi)` = Encaps(`MK_lo`). Both `ct`s are exchanged.
4. Compare `SHA-384(A_lo ‖ A_hi ‖ MK_lo ‖ MK_hi ‖ S ‖ ct_lo ‖ ct_hi)`
   rendered as 6 words + digits **out loud**. Abort on any mismatch.
   (Covers keys, secret, AND both ciphertexts — a swapped `ct` is
   caught here, not discovered later as silent decryption failure.)
5. Both compute, with HKDF-SHA-384 and distinct labels:
   - `k_ecdh` = ECDH(a, B_peer) — 48 bytes (static-static; forward
     secrecy comes from chain stepping + deletion, not from this ECDH)
   - `root = HKDF-SHA-384(salt = SHA-384(A_lo‖A_hi‖MK_lo‖MK_hi),
     ikm = k_ecdh ‖ k_lo ‖ k_hi ‖ S, info = "XM2/root/v1", len = 96)`
   - `chain_lo_hi = root[0:48]`, `chain_hi_lo = root[48:96]`.
6. Delete `k_ecdh`, both `k_kem`s, and both `ct`s after derivation. Store
   only wrapped long-term keys (see §5). Each side starts its send
   counter at 0 and its receive window empty, persisted with the chain.

Renew: meet again every few months, or immediately on device loss. Old
chains are deleted at renewal (healing).

## 3. Sending (per message)

Chain state (chain value, send counter, epoch) is persisted atomically
with the chain — a counter MUST never repeat for a chain value, or a
nonce/key pair repeats catastrophically. Restore-then-send without state
is forbidden; implementations fail closed when state is missing.

1. `msg_key, nonce = HKDF-SHA-384(chain_dir, info = "XM2/msg/v1" ‖ epoch ‖
   counter)` split 32+12 bytes; then `chain_dir = HKDF-SHA-384(chain_dir,
   info = "XM2/step/v1" ‖ epoch)`; **delete the old chain value**.
2. Plaintext: `counter(8B BE) ‖ text(UTF-8) ‖ random pad` to bucket
   {256, 512, 1024} total bytes.
3. `AEAD = AES-256-GCM(msg_key, nonce, aad)` where
   `aad = version(1B: 0x02) ‖ epoch(4B BE) ‖ dir(1B) ‖ counter(8B)`.
   The epoch binds every message to its handshake generation: cross-epoch
   replays fail authentication.
4. Wire format: `XM2.` + Base32 (no padding, RFC 4648 alphabet) of
   `ver(1B) ‖ epoch(4B) ‖ dir(1B) ‖ counter(8B) ‖ nonce(12B) ‖
   ciphertext+tag`, grouped in 5-char blocks; final group is the CRC-16
   (XMODEM) of all preceding bytes, Base32-encoded to exactly 4 chars.
   Primary move: QR or `.xmsg` file (1 KB buckets stay scannable);
   hand-typing only for short codes.
5. Increment and persist the counter. At `2^64-1`, stop and force renewal.
   Never reuse a nonce; counters are the replay clock (no wall-clock trust).

Relationship to storage (§5): §3 keys protect messages **in transit**.
On receipt (and on send, for the sender's copy), the plaintext is
re-encrypted under the conversation key `C_i` for at-rest storage.
Transit keys and storage keys never mix; deleting a conversation key
destroys the stored copies regardless of transit state.

## 4. Receiving

1. Verify checksum + Base32; reject malformed (fail closed, neutral error).
2. Reject unknown epoch (only the current generation decrypts) and any
   already-seen `counter` (persistent replay window per contact).
3. Derive `msg_key` for the counter, tolerating gaps: keep a bounded
   skipped-key cache (≤ 64 entries, bounded memory against insult);
   derive-and-store skipped keys, evict oldest. Out-of-order inside the
   window decrypts; outside it fails closed. A late arrival after eviction
   fails closed (availability tradeoff, stated).
4. Decrypt + verify AAD; on success delete the used key. Display; keep
   plaintext in memory only, zero after use.

## 5. At-rest hierarchy (crypto-shredding)

- Master key `M`: `Argon2id(passphrase, salt, mem, t, p)` mixed via
  `HKDF-SHA-384` with a random device key in hardware storage
  (Android Keystore/StrongBox, TPM on Linux). Files alone ⇒ nothing.
  Header stores `salt ‖ mem ‖ t ‖ p` (versioned) so re-derivation is
  possible without guessing parameters.
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

## 7. Open questions for the audit (updated after self-review 2026-10-10)

1. ~~Chain-step KDF labels~~ — fixed: epoch-bound labels specified in §3.
2. ~~Skipped-key cache DoS~~ — bounded at 64 with fail-closed eviction (§4).
3. QR pairing ceremony resistance to camera-over-shoulder at fingerprint
   comparison (6 words spoken aloud in potentially hostile space).
4. Argon2id calibration table for low-end Android (128 MiB floor?).
5. Formal lemmas in `model/v2-handshake.spthy`: secrecy of `root`,
   forward secrecy after step, post-compromise healing at renewal,
   no-replay-across-epochs. Model must be extended with epoch + dual-ct
   before proving.
6. Renewal ceremony UX: epoch bump must be atomic with chain deletion on
   both sides; half-renewed state recovery procedure needed.
