<!-- SPDX-License-Identifier: MIT -->
# The encryption in X Messenger, plainly

One page, plain words, zero jargon debts: what each layer **is**, whether
the **implementation is open source**, **what it is best for**, **what it
is used for** — and in exactly which *senses each is proved*. The technical
twin of this page is [`SECURITY.md`](SECURITY.md); the product twin is the
release table.

## The cast in plain words

| Name in the app | What it is, without jargon | That thing, generally |
| --- | --- | --- |
| **Seal & Decrypt (v1, `XM1`)** | A locker whose key is *ground out of your secret words*. A machine grinds the words through 600,000 heavy turns to make the key — slow on purpose, so guessing stays expensive. Every lock gets a **fresh random key-wheel** | AES-256-GCM (locker) + PBKDF2-HMAC-SHA-256 × 600,000 (grinding) |
| **Pair (v2, `XM2`)** — experimental | Two people swap lockers **face to face**, then keep exchanging sealed notes with keys that churn forward — *yesterday's key never opens tomorrow's note* | ECDH P-384 handshake + ML-KEM-1024 (post-quantum) + HKDF-SHA-384 chain + AES-256-GCM |
| **Vault (`XMV1`)** | The same locker, holding your saved history behind one passphrase | AES-256-GCM, bounded input |
| **The window on your machine (site/QR flow)** | An ordinary padlock so the little local site is a real HTTPS page — but trusted to *your own device*, no outside helper | TLS 1.2+ via device-local CA (or your own Let's Encrypt on a VPS you opt into) |

## Open source? implemented where?

Every algorithm is a **public standard, implemented in public code** —
nothing invented at the garage:

| Layer | Standard (age of public analysis) | Implementation you can read |
| --- | --- | --- |
| AES-256 | FIPS-197 (2001) — banked on for decades worldwide | Browser/WebView **Web Crypto API** (`core.js` calls it); docs ship the exact calls |
| PBKDF2-HMAC-SHA-256 | RFC 2898 / RFC 8018; NIST-approved | Same Web Crypto call in `core.js`, iterations **600,000** |
| GCM mode | NIST SP 800-38D (2007) | Web Crypto `AES-GCM` |
| HKDF-SHA-384 | RFC 5869 | Go standard library, in the shipped Go core source (`core/`) |
| ECDH P-384 | NIST SP 800-186 | Go standard library |
| ML-KEM-1024 | **FIPS 203 (2024)** — the newest standard | Go standard library, in this repo |
| TLS 1.2+ | IETF RFC family | OpenSSL/GnuTLS + OS cert store |

## Proved — in exactly these senses (and one we're still asking for)

Every cipher above is **proved** — meaning:

1. **Proved as a standard**: produced by public NIST/IETF processes,
   attacked publicly worldwide for decades (ML-KEM: newly standardized,
   already many peer eyes).
2. **proved by open implementations**: call code lives in standard,
   reusable libraries — read the exact lines in `core.js` and `core/`.
3. **Proved in this app's behavior**: the 72-test suite locks in
   seal→decrypt round-trips, wrong-phrase rejection, forged-bit rejection,
   cut-message rejection, duplicate rejection, KDF-parameter locks —
   machine-checked on every push (green badges).
4. **What this build is still asking for**: a **formal audit of the
   composition** — how these proven parts are wired together. What that
   is *not* implied by senses 1–3, and we say so out loud: see
   [`SECURITY.md`](SECURITY.md). Independent audit welcome.

## Best for / not best for (say it out loud)

| Ask | Answer | Why |
| --- | --- | --- |
| Short private notes, one person to one person, no signal needed? | ✅ **its best use** | Built exactly for this: no account, no bars |
| Classroom / field team / clinic passing one-off words offline? | ✅ strong | QR + `.xmsg`, zero bars, no signup |
| Being private even from the phone company? | ✅ by absence | No phone number, no SIM, nothing to bind you |
| Long-term top-secret files? | ❌ not the best tool | It is a *courier*, not an archivist; caps exist (2 MiB vault, 8000-char texts) |
| Group chats for many people? | ❌ not the use case | Pairing is one-to-one by design |
| Anonymous communication? | ❌ and never claimed | QR onto any screen still shows *someone* the secret |
| A device you can't unlock? | ◐ help with phrasing + lock screen | If the phone is open and the phrase known, no messenger can fix that |

## Where the rules live

- Full threat model and honest limits: [`SECURITY.md`](SECURITY.md)
- The pair protocol spec: [`docs/PROTOCOL-v2.md`](PROTOCOL-v2.md)
- How the offline/off-line-only boundary is gated in CI:
  `.github/workflows/strict-boundary.yml`
- Swap notes → `docs/GATEWAY.md` — the loopback default and the
  observable-by-anything LAN/VPS truths.
