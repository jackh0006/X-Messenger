# X Messenger

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Strict boundary](https://github.com/jackh0006/X-Messenger/actions/workflows/strict-security.yml/badge.svg)](https://github.com/jackh0006/X-Messenger/actions/workflows/strict-security.yml)
[![Verify](https://github.com/jackh0006/X-Messenger/actions/workflows/test.yml/badge.svg)](https://github.com/jackh0006/X-Messenger/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/jackh0006/X-Messenger?include_prereleases&label=release)](https://github.com/jackh0006/X-Messenger/releases)
![Android](https://img.shields.io/badge/Android-arm64-3DDC84?logo=android&logoColor=white)
![Linux](https://img.shields.io/badge/Ubuntu-amd64-E95420?logo=ubuntu&logoColor=white)

**Offline-first secret courier.** Move small, high-value secrets between trusted
people with no accounts and no servers — seal here, show a QR code, decrypt
offline. No SIM, no phone number, no cloud. Fully open source.

> **Status: PRERELEASE.** Current release is **v1.0.5** (legacy app, for
> tasting). It is not audited: treat it as a feature demo, not a hardened
> build. Never store crown-jewel secrets without your own review. Nothing
> here is unhackable, military-grade, or a finished Signal replacement.
> See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) and
> [docs/RISK_POLICY.md](docs/RISK_POLICY.md).

## The v1.0.5 app (current)

- **Linux:** Node.js GUI + CLI. The GUI runs a loopback-only page on your own
  machine (`https://127.0.0.1:8444`) — chats, QR show/scan, high-value phrase
  mode, vault, donate and security dialogs. Nothing leaves the device.
- **Android:** Capacitor shell of the same app (camera for QR scan).
- **Crypto:** JavaScript core (`core.js`) — AES-GCM sealed envelopes, safety
  phrases, fingerprint compare. Demo-grade: it has never passed an
  independent audit.
- **Tests:** 18 Node checks (`npm test`) cover crypto vectors, offline
  posture, and UI invariants.

## Try v1.0.5

```bash
# 1. Download from the v1.0.5 release page and verify first:
sha256sum -c SHA256SUMS
# 2. Install the Debian package (needs nodejs + openssl):
sudo dpkg -i X-Messenger-Linux-amd64.deb
# 3. Launch: x-messenger  (or: x-messenger-cli for the terminal)
# Android: install X-Messenger-Android-arm64.apk and compare its permission
# list against the release notes before trusting it.
```

Downloads: [releases](https://github.com/jackh0006/X-Messenger/releases)
(all prerelease until an independent audit passes).

## How X Messenger differs from Signal, Telegram, and WhatsApp

Architecture facts, verified against each project's public documentation.
"Design" means where this project is headed; v1.0.5 is the tasting step.

| Property | Signal | Telegram | WhatsApp | X Messenger (design) |
| --- | --- | --- | --- | --- |
| Identity | Phone number required | Account ID required | Phone number required | **Keys only, no number** |
| Transport | Central servers | Central servers | Central servers | **No servers; QR / file / local carriers** |
| Works with zero internet | No | No | No | **Yes, by construction** |
| Default chats E2E encrypted | Yes (Signal protocol) | **No** (cloud chats; optional Secret Chats) | Yes (Signal protocol) | Sealed offline envelopes |
| Custom crypto protocol | No (published Signal protocol) | Yes (custom MTProto) | No (Signal protocol) | **No custom crypto in the goal** |
| Operator must be trusted with metadata | Yes | Yes | Yes (Meta) | **No operator exists** |
| License | GPL (client) | Clients open; server proprietary | Proprietary | **Open source (v1.0.5: MIT; current tree: AGPL-3.0)** |

What this project does that the others structurally cannot: operate where
there is no network at all, and leave no metadata with any operator — there
is none. The `.github` CI gate plus the release checklist enforce the
offline boundary on every change.

## Repository map

- `app/` — future shared Flutter interface (preview track, not released).
- `core/` — future Rust core: quarantined drafts, never shipped
  (see `core/QUARANTINE.md`).
- `apps/` — legacy platform drafts; not the release path.
- `docs/` — [threat model](docs/THREAT_MODEL.md),
  [protocol boundary](docs/PROTOCOL.md),
  [audit checklist](docs/AUDIT_CHECKLIST.md),
  [risk policy](docs/RISK_POLICY.md),
  [release process](docs/RELEASE_PROCESS.md),
  [build environment](docs/BUILD_ENV.md),
  [100-point roadmap](docs/MASTER_SPEC_100.md),
  [coding-agent guide](docs/AI_CONTINUATION.md).
- `scripts/strict-check.sh` — offline boundary checks.
- `SECURITY_REVIEW.md` — evidence-based release blockers.

## Build v1.0.5 from source (copy-paste)

```bash
git clone https://github.com/jackh0006/X-Messenger.git
cd X-Messenger
git switch --detach v1.0.5   # exact released source, no later changes
npm ci
npm test                     # 18 checks, all must pass
npm run build:web
bash scripts/build-deb.sh X-Messenger-Linux-amd64.deb
npm run android:apk          # needs Android SDK, see docs/BUILD_ENV.md
```

## Local checks (current tree)

```bash
bash scripts/strict-check.sh
cd app
flutter pub get --offline
flutter analyze
flutter test
```

Contributions welcome under [CONTRIBUTING.md](CONTRIBUTING.md) (AGPL-3.0
terms for the current tree; the v1.0.5 snapshot stays MIT as released).
Report vulnerabilities privately per [SECURITY.md](SECURITY.md) — never post
real phrases, keys, or message contents anywhere.

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
