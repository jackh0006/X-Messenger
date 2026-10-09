# Build environment — reproduce this exact setup on any machine or VPS

<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->

These are the exact versions the rebuild-track packages were built and verified
with. Pin them; do not "just use latest" for release builds.

## Proven versions (Ubuntu 24.04, x86_64)

| Tool | Version | Source |
| --- | --- | --- |
| Flutter | 3.47.6 stable (framework rev `5fc34683`, engine `692136cb`) | `~/develop/flutter` |
| Dart | 3.13.5 (bundled with Flutter) | Flutter SDK |
| Android cmdline-tools | latest (provides `sdkmanager`) | Android Studio SDK Manager |
| SDK Platform | android-36 (also installs 37.0 if Studio wants it) | `sdkmanager "platforms;android-36"` |
| Build-tools | 36.0.0 | `sdkmanager "build-tools;36.0.0"` |
| NDK | 28.2.13676358 (r28c) | auto-installed by first APK build |
| Gradle | 9.3.1 (wrapper) + Android Gradle Plugin 9.1.0 | pinned in `app/android` |
| JDK | OpenJDK 25.0.3 (Android Studio bundled `jbr`) | `flutter config --jdk-dir` if needed |
| Rust | 1.98.1 stable (legacy drafts only, not the release path) | rustup |
| cmake / ninja | 3.28.3 / 1.11.1 | `apt install cmake ninja-build` |
| Linux desktop libs | `libgtk-3-dev mesa-utils pkg-config clang` | apt |

## Fresh VPS setup (copy-paste, Ubuntu 24.04)

```bash
sudo apt update && sudo apt install -y \
  curl git unzip xz-utils zip cmake ninja-build pkg-config clang \
  libgtk-3-dev mesa-utils openjdk-25-jdk
# Flutter (verify the SHA-256 against https://docs.flutter.dev/install/manual)
mkdir -p ~/develop
tar -xf flutter_linux_3.47.6-stable.tar.xz -C ~/develop
export PATH="$HOME/develop/flutter/bin:$PATH"
# Android SDK command-line tools, then:
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
flutter config --android-sdk "$HOME/Android/Sdk"
flutter doctor --android-licenses
```

## Build (low-RAM safe: one ABI, one target at a time)

```bash
git clone https://github.com/jackh0006/X-Messenger.git
cd X-Messenger
git switch security-remediation
bash scripts/strict-check.sh
cd app
flutter pub get --offline
flutter analyze
flutter test
# Android (arm64 only — a fat 3-ABI build OOM-kills machines under ~8 GB RAM):
flutter build apk --release --target-platform android-arm64
# Linux + DEB:
bash packaging/build-deb.sh
# Verify the release APK merged manifest has no INTERNET:
"$HOME/Android/Sdk/build-tools/36.0.0/aapt2" dump permissions \
  build/app/outputs/apk/release/app-release.apk
sha256sum dist/*.deb build/app/outputs/apk/release/*.apk
```

## v1.0.5 legacy app environment (Node + Capacitor)

Proven versions: **Node v24.21.0, npm 12.0.2** (other Node 22+ likely work;
CI for this tree is the 18 Node checks, not Flutter).

```bash
git switch --detach v1.0.5
npm ci
npm test            # 18 checks, all must pass
npm run build:web
bash scripts/build-deb.sh X-Messenger-Linux-amd64.deb
npm run android:apk # needs the same Android SDK as above (Capacitor sync + assembleDebug)
sha256sum -c SHA256SUMS   # after refreshing it for the new file names
```

DEB control lives in `packaging/debian/DEBIAN/control`
(Maintainer: jackh0006 <jackh109867@gmail.com>). Android shell lives in
`android/` (Capacitor). Never commit `node_modules/`, `android/.gradle/`,
`android/app/build/`, or `android/local.properties`.

## Your credentials on the VPS

- `gh auth login` (browser/device flow) as **jackh0006**, or a fine-grained
  token per `docs/ACCESS_POLICY.md` (Contents RW + PRs RW, nothing else).
- Releases stay owner-gated: PR review, `v*` tags, and the `release`
  environment all require you — see `docs/RELEASE_PROCESS.md`.
