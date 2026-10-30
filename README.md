# X Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/jackh0006/X-Messenger?label=latest)](https://github.com/jackh0006/X-Messenger/releases/latest)
[![Android](https://img.shields.io/badge/Android-arm64%20%7C%20armv7%20%7C%20x86__64-3DDC84?logo=android&logoColor=white)](https://github.com/jackh0006/X-Messenger/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-amd64%20%7C%20arm64%20%7C%20armhf-E95420?logo=linux&logoColor=white)](https://github.com/jackh0006/X-Messenger/releases/latest)
[![Offline](https://img.shields.io/badge/Offline-First-orange)](https://github.com/jackh0006/X-Messenger/releases/latest)
[![No Account](https://img.shields.io/badge/Account-None-purple)](https://github.com/jackh0006/X-Messenger/releases/latest)
[![No Internet](https://img.shields.io/badge/Internet-Not%20Required-red)](https://github.com/jackh0006/X-Messenger/releases/latest)
[![Audit](https://img.shields.io/badge/Audit-Self--Audited-yellow)](https://github.com/jackh0006/X-Messenger/releases/latest)

**X Messenger** is a free, open-source, offline-first encrypted courier for **Linux** and **Android**. It lets you send private messages without the internet, without an account, and without a server. Just seal your message on your device, show a QR code, and the other person scans it to read it — even in airplane mode.

> **No signal? No account? Send it anyway.** If WhatsApp needs the internet, X needs only eyesight.

---

## Table of Contents

1. [Why X Messenger?](#why-x-messenger)
2. [How It Works (Simple Explanation)](#how-it-works-simple-explanation)
3. [Comparison with Other Messengers](#comparison-with-other-messengers)
4. [Features](#features)
5. [Security and Privacy](#security-and-privacy)
6. [What X Messenger Does NOT Do](#what-x-messenger-does-not-do)
7. [Install on Linux](#install-on-linux)
8. [Install on Android](#install-on-android)
9. [How to Use](#how-to-use)
10. [Release Assets](#release-assets)
11. [Verify Your Download](#verify-your-download)
12. [Build from Source](#build-from-source)
13. [Security Model](#security-model)
14. [Known Limitations](#known-limitations)
15. [Audit Status](#audit-status)
16. [FAQ](#faq)
17. [Contributing](#contributing)
18. [Support](#support)
19. [Licence](#licence)

---

## Why X Messenger?

**Every other messenger needs the internet.** WhatsApp, Telegram, Signal — they all require a server, an account, and a working internet connection. If the network is down, censored, or unavailable, you cannot send a message.

**X Messenger does not need any of that.**

Imagine you are in an airplane, in a hospital with no Wi-Fi, in a remote village, or in a country where the internet is blocked. You need to send a private message to someone standing next to you. With X Messenger, you can.

You type your message, choose a shared secret phrase (exchanged in person), and seal it. X Messenger turns your sealed message into a QR code. You show the QR code to the other person. They scan it with their phone. They enter the same phrase. The message decrypts on their device. **No internet, no account, no server, no phone number, no email address.**

The message travels as light — from your screen to their camera. That is all.

### Who is X Messenger for?

- **People who value privacy.** Your message never touches a server. No company can read it, log it, or store it.
- **People in low-connectivity areas.** Airplanes, hospitals, remote areas, censored networks, disaster zones.
- **People who want simplicity.** No sign-up, no phone number, no email. Just install and go.
- **People who distrust centralized services.** No single point of failure, no data breach risk, no surveillance.
- **Journalists, activists, and whistleblowers** who need to communicate securely without leaving a digital trail on a server.
- **Anyone who believes privacy is a right, not a feature.**

### Why not just use WhatsApp or Telegram?

Because WhatsApp and Telegram need the internet. They store your messages on their servers. They require your phone number. They can be blocked, subpoenaed, or breached. X Messenger cannot be blocked (it uses no network), cannot be subpoenaed (it has no server), and cannot be breached (it has no central database). Your message exists only on the devices of the sender and the receiver.

## How It Works (Simple Explanation)

Think of X Messenger like a **locked box**:

1. **You write a message** (like putting a letter in a box).
2. **You choose a secret phrase** (like a padlock code). You tell this phrase to the other person in person, by voice, or through a trusted channel — **never inside the QR code itself**.
3. **X Messenger locks the box** using strong encryption (AES-256-GCM) and a key derived from your phrase (PBKDF2 with 600,000 iterations).
4. **X Messenger shows you a QR code** (the locked box). The QR code contains only the locked box — never the phrase.
5. **You show the QR code** to the other person (like handing them the locked box).
6. **They scan it** with their phone or computer.
7. **They enter the phrase** (the padlock code).
8. **The box opens.** They read the message.

The message travels as a QR code — light from your screen to their camera. **No internet, no server, no account, no phone number.** The message is encrypted before it leaves your device and can only be decrypted with the correct phrase on the other device.

### What about longer messages?

If your message is too long for one QR code, X Messenger **automatically splits it into multiple QR codes**. You scan them one by one, and X Messenger reassembles them. No message is ever too long.

### What about files?

You can also save the encrypted message as a `.xmsg` file and transfer it via USB, Bluetooth, or any offline method. The file is fully encrypted — only someone with the correct phrase can read it.

---

## Comparison with Other Messengers

### Feature Comparison Table

| Feature | X Messenger | WhatsApp | Telegram | Signal | SMS |
|---|---|---|---|---|---|
| Works offline | Yes | No | No | No | Partial |
| No account needed | Yes | Phone number | Phone number | Phone number | SIM card |
| No server | Yes | Cloud servers | Cloud servers | Cloud servers | Carrier |
| No internet permission | Yes | No | No | No | No |
| End-to-end encryption | AES-256-GCM | Optional | Server-side | Yes | No |
| Open source | Yes | No | No | Yes | No |
| No telemetry | Yes | No | No | Yes | Carrier |
| No metadata collection | Yes | No | No | Minimal | No |
| QR transfer | Yes | No | No | No | No |
| File transfer offline | Yes | No | No | No | No |
| No phone number required | Yes | Yes | Yes | Yes | Yes |
| Airplane mode works | Yes | No | No | No | Partial |
| Censorship resistant | Yes | No | No | No | Partial |
| No corporate ownership | Yes | Meta | Telegram | Foundation | Carrier |
| Self-hosted possible | Yes | No | No | No | No |
| Auditable code | Yes | No | No | Yes | No |
| Works without SIM | Yes | No | No | No | No |

### Security Comparison

| Security Property | X Messenger | WhatsApp | Telegram | Signal |
|---|---|---|---|---|
| Encryption algorithm | AES-256-GCM | Signal Protocol | MTProto | Signal Protocol |
| Key derivation | PBKDF2-SHA-256, 600k iterations | Server keys | Server-managed | Server keys |
| Salt per message | Random 128-bit | N/A | No | N/A |
| Nonce per message | Random 96-bit | N/A | No | N/A |
| Length hiding | Fixed buckets | No | No | No |
| Phrase never travels | Yes | N/A | No | N/A |
| Server-side metadata | None (no server) | Extensive | Extensive | Minimal |
| Network permission | None | Required | Required | Required |
| Account required | None | Phone number | Phone number | Phone number |

### When to Use X Messenger vs Others

| Scenario | Best Choice | Why |
|---|---|---|
| No internet available | X Messenger | Works completely offline |
| Internet blocked / censored | X Messenger | No network needed at all |
| Airplane mode | X Messenger | No signal required |
| Remote area / disaster zone | X Messenger | No infrastructure needed |
| Journalist communicating with source | X Messenger | No server, no account, no metadata |
| Daily chatting with friends | WhatsApp / Telegram | Better UX for frequent use |
| Need voice/video calls | WhatsApp / Telegram | X Messenger is text-only |
| Need group chats | WhatsApp / Telegram | X Messenger is 1-on-1 |
| Need message sync across devices | WhatsApp / Telegram | X Messenger is device-local |
| Maximum privacy (no metadata) | X Messenger | Zero server, zero account, zero metadata |

## Features

### Core Features

- **Offline transfer** — QR code, copied text, or encrypted `.xmsg` file. No internet needed.
- **AES-256-GCM authenticated encryption** — Detects any alteration of the ciphertext.
- **PBKDF2-HMAC-SHA-256 key derivation** — 600,000 iterations, resistant to brute-force.
- **Fresh salt and nonce** — Every sealed message uses a new random 128-bit salt and 96-bit nonce. Identical messages seal differently.
- **Padded message lengths** — Fixed-size buckets hide the true message length.
- **QR code splitting** — Large messages automatically split into multiple QR codes.
- **Encrypted vault** — Versioned local vault with passphrase protection.
- **Contact labels** — Local contact names and fingerprints.
- **Encrypted backups** — Export and import encrypted vault files.
- **Contact trust** — Mark contacts as trusted after comparing fingerprints out loud.
- **Dark theme** — Dark UI by default.

### Linux (Desktop)

- Native GTK4 + libadwaita window (no Chrome required)
- WebKitGTK 6.0 rendering engine
- Loopback-only HTTPS by default (`https://127.0.0.1:8443`)
- LAN sharing (opt-in, with consent and warnings)
- VPS sharing (opt-in, with consent and warnings)
- Custom port and domain configuration
- TLS certificate management
- System tray and launcher integration
- `.deb` packages for amd64, arm64, armhf

### Android

- Camera-only permission for QR scanning
- No Internet permission (offline by design)
- Native QR code scanning
- Android 7+ (API 24) and above
- ARM32, ARM64, x86_64 support
- Per-ABI APK splits
- Universal APK available

### Security Features

- **No network permission** on Android.
- **Loopback-only GUI** on Linux.
- **No accounts, no phone numbers, no email addresses, no sign-up.**
- **No telemetry, no analytics, no update checks.**
- **No central server.**
- **Camera-only permission** on Android.
- **Secure deletion** of local data on demand.
- **Locked history** — Vault is sealed with your passphrase.

---

## Security and Privacy

### How Encryption Works

1. **Key derivation:** Your shared phrase becomes a 256-bit key using PBKDF2-HMAC-SHA-256 with 600,000 iterations.
2. **Salt:** A fresh random 128-bit salt is generated for every message.
3. **Encryption:** The message is encrypted with AES-256-GCM.
4. **Nonce:** A fresh random 96-bit nonce is generated for every message.
5. **Padding:** The message is padded to fixed-size buckets to hide message length.
6. **Output:** The result is a base64url-encoded payload starting with `XM1.`

### What Is Protected

- Message confidentiality (with correct phrase and uncompromised endpoints)
- Message integrity (tamper detection via AES-256-GCM)
- Length hiding (padded buckets)
- Phrase never travels
- Fresh keys (new salt + nonce per message)
- Offline operation

### What Is NOT Protected

- A compromised endpoint (malware, root access, screen capture)
- A weak, reused, or guessed phrase
- Metadata in LAN/VPS mode
- Forensic recovery of deleted files
- Someone watching your screen
- Quantum computers (post-quantum not implemented in legacy XM1 mode)

---

## What X Messenger Does NOT Do

- **No forward secrecy.** If your phrase is compromised, all messages sealed with that phrase can be read.
- **No traffic-analysis resistance.** In LAN/VPS mode, observers can see IP addresses, domains, ports, and message sizes.
- **No post-quantum security.** The legacy XM1 mode uses classical cryptography.
- **No forensic erasure guarantees.** Deleted files may be recoverable on some filesystems.
- **No group chats, voice calls, video calls, or media sharing.** Text-only.
- **No sync across devices.** Messages are stored locally.
- **Not a replacement for Signal or WhatsApp** for everyday messaging. It is a specialized tool for offline, high-privacy communication.

## Install on Linux

### Download

Download the package for your architecture from the [latest release](https://github.com/jackh0006/X-Messenger/releases/latest).

| Architecture | File |
|---|---|
| x86_64 | `X-Messenger-1.5.3-linux-amd64.deb` |
| ARM64 | `X-Messenger-1.5.3-linux-arm64.deb` |
| ARM32 | `X-Messenger-1.5.3-linux-armhf.deb` |

### Install

```bash
sudo dpkg -i X-Messenger-1.5.3-linux-amd64.deb
sudo apt-get install -f
x-messenger gui --port 8443
```

The GUI opens at `https://127.0.0.1:8443` and binds to the loopback interface only.

### First Launch

```bash
x-messenger gui --cert-info
x-messenger gui --trust-ca
```

### Options

```bash
x-messenger gui --port 9443
x-messenger gui --loopback --port 8443
x-messenger gui --lan --port 8443
x-messenger gui --vps --domain msg.example.com --port 443
x-messenger gui --help
```

---

## Install on Android

### Download

| Architecture | File | For |
|---|---|---|
| ARM64 | `X-Messenger-1.5.3-android-arm64.apk` | Most modern phones |
| ARMv7 | `X-Messenger-1.5.3-android-armv7.apk` | Older 32-bit devices |
| x86_64 | `X-Messenger-1.5.3-android-x86_64.apk` | Emulators and Intel tablets |
| Universal | `X-Messenger-1.5.3-android-universal.apk` | Unknown architecture |

### Install

1. Download the APK for your device.
2. Enable "Install from unknown sources" in Android settings.
3. Open the APK and install.
4. Grant camera permission when prompted (for QR scanning only).

### Verify Before Installing

```bash
aapt dump badging X-Messenger-1.5.3-android-arm64.apk | grep -E "uses-permission|versionName"
```

Expected: `uses-permission: name='android.permission.CAMERA'` and `versionName='1.5.3-self-audited'`. **No Internet permission.**

---

## How to Use

### Sending a Message

1. **Write your message.**
2. **Choose a strong shared phrase.** Use at least four uncommon words or 20+ characters. Never include the phrase in the QR code.
3. **Tap "Seal and create QR."**
4. **Show the QR code** to the recipient.
5. **Give them the phrase** through a separate trusted channel.

### Receiving a Message

1. **Scan the QR code** or paste encrypted text.
2. **Enter the shared phrase.**
3. **Tap "Decrypt."**
4. **Read the message.**

### Transferring via File

1. **Seal your message.**
2. **Tap "Download .xmsg."**
3. **Transfer the file** via USB, Bluetooth, or any offline method.
4. **The recipient opens the .xmsg file**, enters the phrase, and decrypts.

### Important Rules

- **One phrase = one message.** Never reuse a phrase.
- **Exchange the phrase separately.** Never put the phrase in the QR code.
- **Use strong phrases.** Four random words or 20+ characters.
- **Verify fingerprints.** Compare contact fingerprints out loud.
- **Keep your device secure.**

## Release Assets

| File | Platform | Architecture |
|---|---|---|
| `X-Messenger-1.5.3-linux-amd64.deb` | Linux (Debian/Ubuntu) | x86_64 |
| `X-Messenger-1.5.3-linux-arm64.deb` | Linux (Debian/Ubuntu) | ARM64 |
| `X-Messenger-1.5.3-linux-armhf.deb` | Linux (Debian/Ubuntu) | ARM32 |
| `X-Messenger-1.5.3-android-arm64.apk` | Android | ARM64 |
| `X-Messenger-1.5.3-android-armv7.apk` | Android | ARMv7 |
| `X-Messenger-1.5.3-android-x86_64.apk` | Android | x86_64 |
| `X-Messenger-1.5.3-android-universal.apk` | Android | All architectures |
| `SHA256SUMS.txt` | — | Checksums |

---

## Verify Your Download

```bash
sha256sum -c SHA256SUMS.txt
```

Expected output: all files show `OK`.

---

## Build from Source

### Requirements

- Node.js 18 or newer
- npm
- Python 3 with GTK4/WebKitGTK 6.0 bindings
- Go 1.24 or newer (for optional WASM module)

### Build Steps

```bash
git clone https://github.com/jackh0006/X-Messenger.git
cd X-Messenger
git checkout v1.5.3-self-audited
npm ci
npm test
npm run build:web
node --check app.js
node --check core.js
bash scripts/build-deb.sh amd64
```

### Test Suite

```bash
npm test
# 69 tests, 0 failures
```

---

## Security Model

### Threat Model

| Threat | Mitigation |
|---|---|
| Network interception | No network used |
| Server breach | No server exists |
| Account takeover | No account exists |
| Metadata collection | No metadata transmitted |
| Brute-force passphrase | PBKDF2 with 600,000 iterations |
| Ciphertext tampering | AES-256-GCM authentication tag |
| Replay attack | Fresh salt + nonce per message |
| Length analysis | Fixed padding buckets |
| Weak passphrase | User must choose strong phrase |

### Cryptographic Implementation

| Component | Algorithm | Details |
|---|---|---|
| Message encryption | AES-256-GCM | 256-bit key, 96-bit nonce, 128-bit auth tag |
| Key derivation | PBKDF2-HMAC-SHA-256 | 600,000 iterations |
| Salt | Random 128-bit | Fresh per message |
| Nonce | Random 96-bit | Fresh per message |
| Random generator | `crypto.getRandomValues()` | OS-level CSPRNG |
| Padding | Fixed buckets | 256–16384 bytes |

## Known Limitations

1. **No forward secrecy.** If your phrase is compromised, all messages sealed with that phrase can be read.
2. **No traffic-analysis resistance.** LAN/VPS modes expose IP, domain, port, and message sizes.
3. **No post-quantum security.** The legacy XM1 mode uses classical cryptography.
4. **No forensic erasure guarantees.** Deleted files may be recoverable.
5. **No group chats.** One sender, one receiver.
6. **No voice/video calls.** Text only.
7. **No media sharing.** Text messages only.
8. **No cross-device sync.** Messages are local to each device.
9. **No automatic updates.** Manual download required.
10. **Self-audited only.** Not independently audited.

---

## Audit Status

**Self-audited only.** This release has been reviewed by the maintainer and passes the project's automated test suite, but it has **not** undergone an independent third-party security audit.

### AI-Assisted Security Confirmation

As part of the self-audit process, this release was reviewed using AI-assisted analysis:

- **Code review:** All JavaScript and Python code was reviewed for common vulnerabilities.
- **Syntax validation:** All shipped JavaScript passes `node --check` before packaging.
- **Test suite:** 69 automated tests covering encryption, decryption, vault operations, UI invariants, QR splitting, and desktop integration.
- **Dependency audit:** All dependencies reviewed for known vulnerabilities.
- **Permission audit:** Android manifest verified to contain only `CAMERA` permission — no `INTERNET`, no `ACCESS_NETWORK_STATE`, no `ACCESS_WIFI_STATE`.
- **Build verification:** Build process includes automatic syntax validation that refuses to package broken code.

### What Remains for Independent Audit

- Formal cryptographic review of the XM1 protocol
- Penetration testing of the Linux GUI and Android app
- Side-channel analysis of the cryptographic implementation
- Review of the Rust core (if used)
- Formal verification of the protocol specification

For high-risk communication, use a messenger that has completed an independent security audit.

---

## FAQ

### Is X Messenger free?

Yes. X Messenger is free and open source (MIT licence). No ads, no premium, no subscriptions, no server bills.

### Does X Messenger need the internet?

No. X Messenger works completely offline. It has no Internet permission on Android and binds to loopback only on Linux.

### Can I use X Messenger without a phone number?

Yes. X Messenger requires no phone number, no email address, no SIM card, and no account of any kind.

### Is my message safe?

Your message is protected by AES-256-GCM encryption with a key derived from your shared phrase using PBKDF2 with 600,000 iterations. With a strong phrase and uncompromised endpoints, your message is secure. However, no software is unhackable — a weak phrase, a hacked device, or someone watching your screen can compromise your message.

### What if my message is too long for one QR code?

X Messenger automatically splits long messages into multiple QR codes. You scan them one by one, and X Messenger reassembles the original message.

### Can I use X Messenger on a Raspberry Pi?

Yes. The Linux package supports arm64 and armhf architectures.

### Can I use X Messenger on Android 7?

Yes. The minimum Android version is 7.0 (API 24).

### Is X Messenger a replacement for WhatsApp?

No. X Messenger is a specialized tool for offline, high-privacy communication. For everyday messaging with friends and family, WhatsApp or Telegram is more convenient. For offline or high-privacy scenarios, X Messenger is the right tool.

### Can I verify the source code?

Yes. X Messenger is fully open source. You can read every line of code, build it yourself, and verify that it does what it claims.

### How do I report a vulnerability?

Report suspected vulnerabilities privately to **jackh109867@gmail.com**. Do not send private keys, real message contents, recovery phrases, or tokens.

---

## Contributing

Contributions are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

### Development Setup

```bash
git clone https://github.com/jackh0006/X-Messenger.git
cd X-Messenger
npm ci
npm test
npm run gui
```

---

## Support

**Security contact: jackh109867@gmail.com**

### Documentation

- [`SECURITY.md`](SECURITY.md) — Security policy and threat model
- [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) — Self-review notes
- [`PRIVACY.md`](PRIVACY.md) — Privacy policy
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) — Adversaries and mitigations
- [`docs/PROTOCOL.md`](docs/PROTOCOL.md) — Message format
- [`docs/AUDIT_CHECKLIST.md`](docs/AUDIT_CHECKLIST.md) — Audit preparation
- [`ANDROID_GUIDE.md`](ANDROID_GUIDE.md) — Android build guide
- [`LINUX_GUIDE.md`](LINUX_GUIDE.md) — Linux build guide

### Donations

| Asset | Address |
|---|---|
| Bitcoin | `bc1q8t0fn2yrsy4lh3m0pz34uj27t8vxjeavkjym83` |
| DOGE | `D6ZdMQ7mHGGmuH9prpZ2zjpnG5Q3WVRDtC` |
| Ethereum / USDT ERC20 / BNB | `0xdad428900a4359be8f76b3062df34211582e09eb` |
| TRX / USDT TRC20 | `TMpb6RNTuGNM1eTakm9kjds1mRTPYYJesf` |
| SOL / USDT SPL / USDC SPL | `BDCCrRez1yD1RpkAtiqKKDk3BfxPD8P7nkL26jCYrzgL` |
| XRP | `rNUAhaATFLvosdu9m9M95bupRBtZ8eqpj9` |
| TON | `UQCu6-3yGyQ5dzvcCxr2gobuvx5ddbS9EC690qtey92P5_wX` |
| LTC | `ltc1q2gs89cfy3mumr7gu9w0zl9rllf80q67m5rmma8` |

---

## Licence

MIT. See [`LICENSE`](LICENSE), [`NOTICE`](NOTICE), and [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

---

**X Messenger — No signal? No account? Send it anyway.**

*Free. Open source. Offline. Private. By jackh0006.*
