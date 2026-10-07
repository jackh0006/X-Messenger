# X Messenger v1.0.2 — No signal? No account? Send it anyway.

[![Verify](https://github.com/jackh0006/X-Messenger/actions/workflows/test.yml/badge.svg)](https://github.com/jackh0006/X-Messenger/actions)
![Version](https://img.shields.io/badge/version-1.0.2-blue)
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
- [Features (v1.0.2, all platforms same)](#features-v102-all-platforms-same)
- [Use it](#use-it)
- [Linux GUI modes: device, LAN, VPS](#linux-gui-modes-device-lan-vps)
- [Android (stays offline)](#android-stays-offline)
- [Security design](#security-design-v102)
- [Docs map](#docs-map)
- [Donate](#donate-no-ads-no-premium)
- [Versions](#versions)

## Why it’s different to any messenger — scoreboard ✈◌⬢◈

Same task, same method, reproducible (method + proof under the table).
Legend: ✓ yes · ✗ no · ◐ partial.

| Need (your words) | X v1.0.2 | WhatsApp | Telegram | SMS | How we prove it |
| --- | :---: | :---: | :---: | :---: | --- |
| ✈ Send with **zero bars** | ✓ | ✗ | ✗ | ◐ no lock | Airplane-mode QR seal → scan → decrypt, `npm test` |
| ◌ **No SIM / number / email** | ✓ | ✗ | ✗ | ✗ | Signup screens need numbers; X has no account field |
| ⬢ **No server copy to leak** | ✓ offline · ◐ your VPS | ✗ | ✗ | ✗ | `ss -tlnp` loopback + `aapt` (no `INTERNET`) |
| ◈ Phrase **never in QR** | ✓ enforced | — | — | — | Tamper test rejects mixed payloads |
| Normal-looking private page | ✓ LE + 443 | — | — | — | `openssl s_client` transcript |
| Independent audit | ◐ open, needs audit | ✓ | ◐ | ✗ | [`SECURITY.md`](SECURITY.md) |

Method: Ubuntu amd64 + Pixel/arm64, 2026-10-07, `npm ci && npm test` (16 pass),
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
npm test          # 16 checks: crypto, offline, dark mode, LAN honesty
npm run gui       # first run? run: npx x-messenger setup
```

The Linux GUI opens on `https://127.0.0.1:8443` (this device only, zero
egress). To change port/domain/mode: `x-messenger setup` or
Settings → Connection.

CLI (`cipherlink version` → `1.0.2`):

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

## Features (v1.0.2, all platforms same)

- Same `www/` bundle on Linux + Android (`cap sync` verified): themes
  (system/light/dark, fully fixed contrast), text size 14–20px that really
  scales, local users (max 100, dedupe), fingerprint + copy, QR scan with
  camera-denied fallback, `.xmsg` download, backup/restore/delete (capped,
  validated), first-run “why different” card.
- Secrets hygiene: phrases wiped after use, ciphertext zeroed, clipboard
  auto-clears in 30s, plaintext never saved, backups hold labels only.
- Linux server: `GET/HEAD` allow-list, `TLS1.2+`, `no-store/nosniff/DENY/CSP`,
  `/api/info` (version, bind, TLS fingerprint/expiry/SAN), custom port
  `1–65535` (best `8443`, VPS `443`), self-signed loopback/LAN certs +
  Let’s Encrypt VPS certs, `0600/0700` files.
- Android: `CAMERA` only, no `INTERNET`, `allowBackup=false`,
  `usesCleartextTraffic=false`, `minifyEnabled`.

## Linux GUI modes: device, LAN, VPS

- **This device (default):** `x-messenger gui` → `https://127.0.0.1:8443`.
  Zero internet. Safest. Airplane-mode proof in `PUBLISHING.md`.
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
Play upload is a signed `.aab` (`versionCode 3 / versionName 1.0.2`,
`targetSdk 37`). Debug APKs never go to Play — see [PLAY_RELEASE.md](PLAY_RELEASE.md)
and [docs/store-listing.md](docs/store-listing.md). Privacy: [docs/privacy-policy.md](docs/privacy-policy.md).

## Security design (v1.0.2)

- `AES-256-GCM` via Web Crypto, `PBKDF2-HMAC-SHA256` 600,000 iterations,
  fresh 128-bit salt + 96-bit nonce per message, versioned `XM1` + `XMessenger/1`
  context, strict parsing, 8000-char cap (UI 900 for QR + counter, `>2900B`
  suggests `.xmsg`).
- No forward secrecy, no identity proof, no endpoint-malware defense, no
  secure deletion beyond 1-pass overwrite. Any non-empty phrase allowed;
  long unique one-time phrases only. Names/notes are unverified labels.
- VPS/LAN metadata (domain/IP/port/sizes/timing) is always observable;
  message *content* stays XM1 end-to-end when the phrase stays off the server.

Read [SECURITY.md](SECURITY.md) before high-risk use.

## Docs map

| File | What it teaches (5yo-simple where it matters) |
| --- | --- |
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

`package.json 1.0.2` · `core.js 1.0.2` · Android `versionCode 3 / versionName 1.0.2`
· Debian `1.0.2` · CLI `1.0.2` · GUI `v1.0.2`. Verify downloads with `SHA256SUMS`.

## Legal

Licensed under [MIT](LICENSE) — see [NOTICE](NOTICE) and
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). SPDX: `MIT`.
