<!-- SPDX-License-Identifier: MIT -->
# First-party verification log — X Messenger 1.5.2

Maintainer session recorded **2026-10-31** by **jackh0006**: the exact
published artifacts were used on real hardware, and every major user flow
was exercised by hand. Nothing below is third-party — it is one careful
human doing full-feature tasting, with hashes published so **your build =
their test**.

## The tested builds (verify your copy against these)

| Artifact | SHA-256 (first 12 · full) | Notes |
| --- | --- | --- |
| `X-Messenger-1.5.2-Android-arm64.apk` | `e866f4ebb440` — chain: `e866f4eb b440f386 c915682c 596c9fd6 de068abda8137f06 8ad2ed39939e9f7f` | upload-keystore-signed, `versionCode 20` |
| `X-Messenger-1.5.2-Linux-amd64.deb` | `21ecf79f03a0` — chain: `21ecf79f 03a05524 5f5329d6 61bed156 ea202e6f b2c4188c 13304ab1 1bed27db` | the deb also installed on the maintainer's PC (`dpkg -s x-messenger → 1.5.2`) |

Plain rule: `sha256sum <your-download>` must start with the same 12
characters as above — otherwise you tested a different build.

## Devices (kept generic on purpose)

| Platform | Device | OS |
| --- | --- | --- |
| Android | arm64-v8a phone (Android 9+ era) | Android 9–16 range class |
| Linux | standard x86-64 personal machine | Ubuntu 24.04 (LTS), amd64 |

Models stay unnamed — what matters is the artifact bytes above, not the
brand of glass it ran on.

## What was exercised (all of it flows, not benchmarks)

- Seal → show **QR**; scan → decrypt, both directions.
- Long text via **multi-part QR** and `.xmsg` file hand-off.
- Wrong phrase = polite rejection; right phrase = instant message.
- Copy-first clipboard flow with the 30-second auto-clear.
- Vault: lock, auto-lock on hide, sealed export/import.
- Local users, per-user threads, v2 **pair** with fingerprint spoken aloud.
- Settings: themes, text size, port persistence after restart.
- Airplane mode as the *expected* mode — full session with zero bars.
- Android: home-screen launcher icon, camera-only prompts, no install
  warnings about network. Linux: `x-messenger` desktop launcher, GUI
  app-window on `https://127.0.0.1`, CLI roundtrip commands.

## Verdict (word-for-word)

> "I've tested it on **Android arm64** and **Linux Ubuntu amd64** and all
> parts were working — it was all good." — jackh0006, 2026-10-31

## Scope (what this session does and does not claim)

- ✅ Claims: the **functional** completeness of those two exact artifacts —
  every listed flow ran green on real hardware.
- ✗ Does not claim: security under attack, certification, or any
  third-party assurance — see [`SECURITY.md`](SECURITY.md): independent
  audit still recommended before high-risk use.
- Duplicate this session yourself: the recipe lives in the README
  (*"Human-tested by the author — repeat it in ~10 minutes"* block).
