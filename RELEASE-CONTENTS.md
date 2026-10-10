# X Messenger release contents

This folder is designed for a GitHub release or local distribution. The Linux
GUI is served only on local HTTPS (`127.0.0.1`) and opens automatically in an
app-style window.

- `Android/X-Messenger-Offline.apk` — signed debug APK for device testing only.
- `Linux/X-Messenger-Linux.deb` — installable Debian/Ubuntu GUI + CLI package.
- `Linux/X-Messenger-CLI.sh` — shell launcher for the installed CLI.
- `Linux/X-Messenger-Linux-Source.tar.gz` — Linux GUI/CLI source package.
- `Google-Play/X-Messenger-Google-Play-Source.tar.gz` — Android source package plus Play signing instructions.
- `Source/X-Messenger-Source.tar.gz` — complete source release.

## Verify the Android APK

```bash
sha256sum X-Messenger-Offline.apk
```

The expected SHA-256 is stored in `SHA256SUMS`.

## Install on Debian / Ubuntu

```bash
cd Linux
sudo apt install ./X-Messenger-Linux.deb
x-messenger gui
x-messenger-cli encrypt "private message"
```

## Important publishing boundary

The debug APK is installable for testing, but it is not a Google Play upload. A Play release must be generated as a signed `.aab` with the publisher's private upload key. See `Google-Play/PLAY_RELEASE.md`.

## Inside the Linux package (`/usr/lib/x-messenger`)

Besides the GUI/CLI (`www/`, `bin/`, `server.js`), every deb ships the
complete v2 payload — nothing left out:

- `core/` — Go v2 source (handshake, ratchet, wire, storage) + `go.mod`
- `core/v2demo-linux-amd64` — prebuilt demo (`x-messenger v2demo` runs it;
  rebuilt from source at package time, compare with `go build -trimpath`)
- `model/` — Tamarin skeleton + Phase gates
- `docs/PROTOCOL-v2.md` — the v2 specification
- No `node_modules`, bytecode, CI files, or Gradle caches — pruned at
  package time (see `scripts/build-deb.sh`).
