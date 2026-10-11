# X Messenger — No signal? No account? Send it anyway.

[![Verify](https://github.com/jackh0006/X-Messenger/actions/workflows/test.yml/badge.svg)](https://github.com/jackh0006/X-Messenger/actions)
[![Strict](https://github.com/jackh0006/X-Messenger/actions/workflows/strict-boundary.yml/badge.svg)](https://github.com/jackh0006/X-Messenger/actions)
![Version](https://img.shields.io/github/v/release/jackh0006/X-Messenger?label=stable)
![Android](https://img.shields.io/badge/Android-targetSdk%2037-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Offline](https://img.shields.io/badge/offline-first-orange)

Free, open-source, offline-first encrypted courier by **jackh0006**.
Seal a message **on this device**, hand it over as a **QR code, copied text,
or `.xmsg` file**. If WhatsApp needs the internet, X needs only eyesight.

> No app is impossible to hack. Weak phrases, hacked phones, or someone
> watching your screen can still leak a message. X Messenger needs an
> independent security audit before high-risk use.

## Contents

- [Why it is different](#why-its-different-to-any-messenger)
- [What people need it for](#what-people-need-it-for)
- [30-second demo](#30-second-demo-like-teaching-a-5-year-old)
- [Features (all platforms same)](#features-all-platforms-same)
- [Use it](#use-it)
- [Linux GUI modes: device, LAN, VPS](#linux-gui-modes-device-lan-vps)
- [Android (stays offline)](#android-stays-offline)
- [Security design](#security-design)
- [v2 post-quantum channel (experimental)](#v2-post-quantum-channel-experimental)
- [Docs map](#docs-map)
- [Donate](#donate-no-ads-no-premium)
- [Versions](#versions)

## Why it’s different to any messenger — scoreboard ✈◌⬢◈

Same task, same method, reproducible (method + proof under the table).
Legend: ✓ yes · ✗ no · ◐ partial.

| Need (your words) | X (stable) | WhatsApp | Telegram | SMS | How we prove it |
| --- | :---: | :---: | :---: | :---: | --- |
| ✈ Send with **zero bars** | ✓ | ✗ | ✗ | ◐ no lock | Airplane-mode QR seal → scan → decrypt, `npm test` |
| ◌ **No SIM / number / email** | ✓ | ✗ | ✗ | ✗ | Signup screens need numbers; X has no account field |
| ⬢ **No server copy to leak** | ✓ offline · ◐ your VPS | ✗ | ✗ | ✗ | `ss -tlnp` loopback + `aapt` (no `INTERNET`) |
| ◈ Phrase **never in QR** | ✓ enforced | — | — | — | Tamper test rejects mixed payloads |
| Padded transfers hide length | ✓ buckets | — | — | — | Duplicate/truncation tests |
| No browser warning (after trust) | ✓ local CA | — | — | — | `gui --trust-ca` + fingerprint compare |
| Normal-looking private page | ✓ LE + 443 | — | — | — | `openssl s_client` transcript |
| Independent audit | ◐ open, needs audit | ✓ | ◐ | ✗ | [`SECURITY.md`](SECURITY.md) |

Method: Ubuntu amd64 + Pixel/arm64, `npm ci && npm test` green,
`aapt dump permissions`, `ss -tlnp`, `openssl s_client -tls1_2`.
Honest footnote: LAN/VPS observers still see domain/IP/port/sizes; message
*words* stay `XM1` end-to-end. No “unhackable” claims — see Security below.

## What people need it for

- Travel, flights, power cuts, censored Wi-Fi — QR works with zero bars.
- Spare phones, de-Googled devices, no-SIM tablets.
- Clinics, field teams, classrooms sharing secrets without accounts.
- VPS owners wanting a normal-looking private page (`https://msg.example.com`)
  whose message *words* even the provider cannot read (metadata still visible —
  see `docs/vps-private-mode.md`).

## 30-second demo (like teaching a 5-year-old)

1. Type a note, like `meet at sunset`.
2. Pick 4 secret words, like `purple horse dances quietly`.
3. Tap **Seal and create QR** → a square puzzle appears.
4. Friend points their camera at the puzzle, types the 4 words, taps
   **Decrypt on this device** → they read it. Nothing flew on the internet.

```bash
npm ci
npm test          # crypto, offline, dark mode, LAN honesty
npm run gui       # first run? run: npx x-messenger setup
```

The Linux GUI opens on `https://127.0.0.1:443` (this device only, zero
egress; if 443 is taken you are asked for another port). To change
port/domain/mode: `x-messenger setup` or Settings → Connection.

CLI (`cipherlink version` → current stable):

```bash
cipherlink encrypt "Meet at the north gate"
cipherlink decrypt "XM1.…"
cipherlink profile "Amina" "met in person"
cipherlink data export backup.json
x-messenger setup                 # port + device/LAN/VPS + domain guide
x-messenger gui --port 8443
x-messenger gui --vps --domain msg.example.com --port 443
```

The phrase is always asked **hidden** (never in shell history unless you
force `--phrase` for scripts).

## Features (all platforms same)

- Same `www/` bundle on Linux + Android (`cap sync` verified): themes
  (system/light/dark, fully fixed contrast), text size 14–20px that really
  scales, local users (max 100, dedupe), fingerprint + copy, QR scan with
  camera-denied fallback, `.xmsg` download, backup/restore/delete (capped,
  validated), first-run “why different” card.
- Secrets hygiene: phrases wiped after use, ciphertext zeroed, clipboard
  auto-clears in 30s, plaintext never saved, backups hold labels only.
- Linux server: `GET/HEAD` allow-list, `TLS1.2+`, `no-store/nosniff/DENY/CSP`,
  `/api/info` (version, bind, TLS fingerprint/expiry/SAN), custom port
  `1024–65535` (default `443`, prompt fallback), device-local CA-signed
  loopback/LAN certs + Let’s Encrypt VPS certs, `0600/0700` files.
- Android: `CAMERA` only, no `INTERNET`, `allowBackup=false`,
  `usesCleartextTraffic=false`, `minifyEnabled`.

## Linux GUI modes: device, LAN, VPS

- **This device (default):** `x-messenger gui` → `https://127.0.0.1:443`.
  Zero internet. Safest. If 443 is taken or needs privilege you are asked
  for another port. Airplane-mode proof in `PUBLISHING.md`.
- **LAN (opt-in):** `x-messenger gui --lan --port 8443` → encrypted TLS on
  your Wi-Fi, but routers/DPI **see** LAN IP/port/sizes. Compare the cert
  fingerprint in person (Settings → TLS certificate).
- **My VPS (opt-in):** your domain with normal HTTPS:
  `x-messenger gui --vps --domain msg.example.com --port 443`.
  Port 443 needs one capability:
  `sudo setcap cap_net_bind_service=+ep $(readlink -f $(which node))`.
  Full 5-year-old guide: [`docs/vps-domain-cloudflare.md`](docs/vps-domain-cloudflare.md)
  (DNS grey-cloud, subdomains, certbot, renew). Privacy truth + risk controls:
  [`docs/vps-private-mode.md`](docs/vps-private-mode.md).

## Android (stays offline)

Settings, local users, fingerprint, QR scan — everything works with zero
bars. Rebuild: `npm run android:sync && npm run android:apk` (debug only).
Play upload is a signed `.aab` (current `versionCode`/`versionName`, see
`android/app/build.gradle`, `targetSdk 37`). Debug APKs never go to Play — see [PLAY_RELEASE.md](PLAY_RELEASE.md)
and [docs/store-listing.md](docs/store-listing.md). Privacy: [docs/privacy-policy.md](docs/privacy-policy.md).

## Security design

- `AES-256-GCM` via Web Crypto, `PBKDF2-HMAC-SHA256` 600,000 iterations,
  fresh 128-bit salt + 96-bit nonce per message, versioned `XM1` (v2 seals
  with padded size buckets, v1 reads) + `XMessenger/2` context, strict
  parsing, 8000-char cap (UI 900 for QR + counter, `>2900B`
  suggests `.xmsg`).
- Loopback HTTPS via a device-local CA (`gui --trust-ca` once,
  `gui --cert-info` to compare fingerprints); separate `--app` window,
  `FLAG_SECURE` on Android, phrase fields wiped when hidden.
- No forward secrecy, no identity proof, no endpoint-malware defense, no
  secure deletion beyond 1-pass overwrite. Any non-empty phrase allowed;
  long unique one-time phrases only. Names/notes are unverified labels.
- VPS/LAN metadata (domain/IP/port/sizes/timing) is always observable;
  message *content* stays XM1 end-to-end when the phrase stays off the server.

Read [SECURITY.md](SECURITY.md) before high-risk use.

## v2 post-quantum channel (experimental)

New seals can use hybrid post-quantum crypto instead of a shared phrase:
ECDH P-384 + ML-KEM-1024 (CNSA 2.0 suite), HKDF-SHA-384 chains, AES-256-GCM,
same audited Go core as the terminal demo, running in-page as WebAssembly.

- **Pair:** sidebar → Pair v2 contact. Swap QR codes face to face (4 steps),
  compare the fingerprint **out loud**, tick confirm. No pairing, no v2 seals.
- **Send:** paired sessions seal `XM2.` by default. **Read:** `XM2` opens via
  session, `XM1` always still opens — read both, write v2.
- **Honest limits:** experimental and **unaudited** (banner stays in the UI);
  128 MiB in-page key stretching, session-only vault, no hardware backing in
  the browser. Spec: [`docs/PROTOCOL-v2.md`](docs/PROTOCOL-v2.md); terminal
  loop: `x-messenger v2demo`; audit-gated roadmap in `model/README.md`.

## Docs map

| File | What it teaches (5yo-simple where it matters) |
| --- | --- |
| `docs/GATEWAY.md` | Offline core vs optional gateway: loopback default, LAN IP / VPS domain / VPS IP with custom ports |
| `docs/vps-domain-cloudflare.md` | House address: VPS + Cloudflare DNS + subdomain + Let’s Encrypt |
| `docs/vps-private-mode.md` | Bedtime-story privacy: who sees what + daily safety rules |
| `docs/privacy-policy.md` | Collects nothing; camera frames never leave device |
| `docs/store-listing.md` | Paste-ready Play text + data safety |
| `ANDROID_GUIDE.md` / `LINUX_GUIDE.md` / `LINUX_INSTALL.md` | Platform steps |
| `PUBLISHING.md` / `PLAY_RELEASE.md` / `RELEASE-CONTENTS.md` | GitHub + Play checklists |

## Donate (no ads, no premium)

Keeping releases signed and free costs time. If this offline freedom helps
you, please support it:

| Asset | Address |
| --- | --- |
| Bitcoin | `bc1q8t0fn2yrsy4lh3m0pz34uj27t8vxjeavkjym83` |
| DOGE | `D6ZdMQ7mHGGmuH9prpZ2zjpnG5Q3WVRDtC` |
| Ethereum / USDT ERC20 / BNB | `0xdad428900a4359be8f76b3062df34211582e09eb` |
| TRX / USDT TRC20 | `TMpb6RNTuGNM1eTakm9kjds1mRTPYYJesf` |
| SOL / USDT SPL / USDC SPL | `BDCCrRez1yD1RpkAtiqKKDk3BfxPD8P7nkL26jCYrzgL` |
| XRP | `rNUAhaATFLvosdu9m9M95bupRBtZ8eqpj9` |
| TON | `UQCu6-3yGyQ5dzvcCxr2gobuvx5ddbS9EC690qtey92P5_wX` |
| LTC | `ltc1q2gs89cfy3mumr7gu9w0zl9rllf80q67m5rmma8` |

Support / security contact: jackh109867@gmail.com (never send real phrases
or message contents).

## Versions

Single source of truth: `package.json` (+ `core.js VERSION`,
`android/app/build.gradle`, `packaging/debian/DEBIAN/control`,
`server.js /api/info` — enforced by `test/crypto.test.js`).
Check yours with `cipherlink version` and compare to the
[stable release](https://github.com/jackh0006/X-Messenger/releases/latest).
Each release ships:

| File | What |
| --- | --- |
| `X-Messenger-<ver>-Linux-amd64.deb` | Ubuntu desktop app |
| `X-Messenger-<ver>-Android-arm64.apk` | Android app (CAMERA-only) |
| `X-Messenger-<ver>-SHA256SUMS.txt` | Hashes — verify before installing |

## Legal

Licensed under [MIT](LICENSE) — see [NOTICE](NOTICE) and
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). SPDX: `MIT`.
