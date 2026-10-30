# X Messenger

X Messenger is a free, open-source, offline-first encrypted courier for Linux
and Android. It seals a message on your device and transfers it as a QR code,
copied text, or an encrypted `.xmsg` file. No account, no server, and no
Internet connection are required.

**Current stable release:** `1.5.3-self-audited`

## Security status

**Self-audited only.** This release has been reviewed by the maintainer and
passes the project's automated tests, but it has **not** undergone an
independent third-party security audit. It must not be described as
professionally audited, unhackable, or suitable for high-risk use.

For high-risk communication, use a messenger that has completed an independent
security audit. The project's audit preparation material is in
[`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) and
[`docs/AUDIT_CHECKLIST.md`](docs/AUDIT_CHECKLIST.md).

Known limitations:

- No forward secrecy in the legacy passphrase mode.
- No traffic-analysis resistance. LAN and VPS modes expose IP address, domain,
  port, and message sizes to network observers.
- No post-quantum guarantee for the legacy XM1 mode.
- A compromised endpoint, a weak shared phrase, or an observed screen can still
  expose a message.
- Deleted files are not guaranteed to be forensically erased on every
  filesystem.

## Features

- Offline transfer by QR code, copied text, or `.xmsg` file.
- AES-256-GCM authenticated encryption.
- PBKDF2-HMAC-SHA-256 key derivation with 600,000 iterations.
- A fresh random salt and nonce for every sealed message.
- Padded message lengths to reduce size leakage.
- Optional paired-session mode (XM2) for face-to-face contact pairing.
- Native Linux desktop window using GTK4, libadwaita, and WebKitGTK 6.0.
- Android build with camera access for QR scanning.
- Versioned local vault, contact labels, and encrypted backups.
- No account, phone number, email address, or signup.

## Install on Linux

Download the package for your architecture from the
[latest release](https://github.com/jackh0006/X-Messenger/releases/latest).

```bash
sudo dpkg -i X-Messenger-1.5.3-linux-amd64.deb
sudo apt-get install -f
x-messenger gui --port 8443
```

The GUI opens at `https://127.0.0.1:8443` and binds to the loopback interface
only. If port 8443 is already in use, choose another port:

```bash
x-messenger gui --port 9443
```

To return to loopback-only mode:

```bash
x-messenger gui --loopback --port 8443
```

The first launch creates a device-local certificate authority. The browser or
native window may show a certificate warning until you trust it:

```bash
x-messenger gui --cert-info
x-messenger gui --trust-ca
```

## Install on Android

Download the APK for your device:

- `X-Messenger-1.5.3-android-arm64.apk` for most modern phones.
- `X-Messenger-1.5.3-android-armv7.apk` for older 32-bit devices.
- `X-Messenger-1.5.3-android-x86_64.apk` for x86_64 emulators and tablets.
- `X-Messenger-1.5.3-android-universal.apk` when the architecture is unknown.

Sideloading requires allowing installation from unknown sources. Verify the
SHA-256 checksum before installing.

## Use

1. Write a message.
2. Choose a strong, one-time shared phrase. Share it separately, in person or
   over a trusted channel. Never place the phrase in the same QR code or file.
3. Seal the message and show the QR code, copy the encrypted text, or save the
   `.xmsg` file.
4. The recipient scans or pastes the encrypted payload, enters the phrase, and
   decrypts the message on their own device.

## Linux GUI modes

| Mode | Command | Exposure |
| --- | --- | --- |
| Loopback (default) | `x-messenger gui --loopback --port 8443` | This device only |
| LAN | `x-messenger gui --lan --port 8443` | LAN peers see IP, port, and sizes |
| VPS | `x-messenger gui --vps --domain msg.example.com --port 443` | Network and provider see domain, IP, and sizes |

Message contents remain encrypted in LAN and VPS modes. Metadata remains
visible. See [`docs/vps-private-mode.md`](docs/vps-private-mode.md).

## Release assets

| File | Description |
| --- | --- |
| `X-Messenger-1.5.3-linux-amd64.deb` | Debian/Ubuntu, x86_64 |
| `X-Messenger-1.5.3-linux-arm64.deb` | Debian/Ubuntu, ARM64 |
| `X-Messenger-1.5.3-linux-armhf.deb` | Debian/Ubuntu, ARM32 |
| `X-Messenger-1.5.3-android-arm64.apk` | Android ARM64 |
| `X-Messenger-1.5.3-android-armv7.apk` | Android ARMv7 |
| `X-Messenger-1.5.3-android-x86_64.apk` | Android x86_64 |
| `X-Messenger-1.5.3-android-universal.apk` | Android universal |
| `SHA256SUMS.txt` | Checksums for all release files |

## Build from source

Requirements: Node.js 18 or newer, npm, Python 3 with GTK4/WebKitGTK 6.0
bindings, and Go 1.24 or newer for the optional WASM module.

```bash
git clone https://github.com/jackh0006/X-Messenger.git
cd X-Messenger
git checkout v1.5.3-self-audited
npm ci
npm test
npm run gui
```

Build the Linux package:

```bash
bash scripts/build-deb.sh amd64
```

Verify the JavaScript before packaging:

```bash
node --check app.js
node --check core.js
```

The release build refuses to package JavaScript that fails the syntax check.

## Security design

| Layer | Implementation |
| --- | --- |
| Message encryption | AES-256-GCM |
| Key derivation | PBKDF2-HMAC-SHA-256, 600,000 iterations |
| Salt and nonce | Random per message |
| Length hiding | Fixed padding buckets |
| Transport | QR code, copied text, or local file |
| Desktop isolation | Loopback-only HTTPS by default |
| Android permissions | Camera access for QR scanning |

All cryptography is implemented with the platform Web Crypto API (`crypto.subtle`).
The project does not implement custom cryptographic primitives.

## Documentation

- [`SECURITY.md`](SECURITY.md) — vulnerability reporting and security policy.
- [`SECURITY_REVIEW.md`](SECURITY_REVIEW.md) — self-review notes and limitations.
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) — adversaries and mitigations.
- [`docs/PROTOCOL.md`](docs/PROTOCOL.md) — message format.
- [`docs/AUDIT_CHECKLIST.md`](docs/AUDIT_CHECKLIST.md) — audit preparation.

## Support

Security contact: jackh109867@gmail.com. Do not send real phrases, private keys,
or message contents by email.

Donations are optional and do not affect the licence or features:

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

## Licence

MIT. See [`LICENSE`](LICENSE), [`NOTICE`](NOTICE), and
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
