# Use X Messenger on Windows (10 1809+ and 11, portable, no admin, by jackh0006)

Supported: **Windows 10 version 1809+ (build 17763) and Windows 11**, `x64`
primary, `arm64` secondary, `x86` experimental. Windows 7/8.1 are **not supported** (Node 18+,
WebView2/Chromium `--app`, and TLS 1.2+ OS defaults require Windows 10+).

## Option A — portable ZIP (recommended for testing)

1. Install **Node.js 20 LTS** (`x64`/`arm64`) from `nodejs.org` (check `node --version` ≥ 18).
   `x86` experimental: Node 18 32-bit (EOL, insecure — prefer `x64`).
2. Install **Git for Windows** (provides `openssl.exe` for the first-run
   device-local CA) **or** Windows OpenSSL, and ensure it is on `PATH`.
3. Unzip `X-Messenger-<ver>-Windows-x64.zip` (or `-arm64.zip` on ARM PCs,
   `-x86.zip` experimental on 32-bit).
4. Double-click `X-Messenger-GUI.exe` (real `.exe` launcher), or
   `X-Messenger-GUI.cmd` fallback, or run:
   `x-messenger.cmd gui` → opens `https://127.0.0.1:443` loopback-only HTTPS
   in a separate Edge/Chrome `--app` window. If 443 needs elevation you are
   asked for another port (use `8443`).
5. First-run browser warning is expected (device-local CA). Compare the
   fingerprint, then run once: `x-messenger.cmd gui --trust-ca`
   (CurrentUser Root, no admin). Verify with `--cert-info`.

Data lives in `%APPDATA%\x-messenger` (per-user). No service, no account,
no network route: verify with `netstat -ano | findstr 443` (only
`127.0.0.1`).

## Option B — per-user installer (no admin)

`X-Messenger-<ver>-Windows-x64-setup.exe` installs to
`%LOCALAPPDATA%\x-messenger` with Start Menu + Desktop shortcuts.
Uninstall via `uninstall.exe` (your data in `%APPDATA%` is kept unless you
delete it).

## SmartScreen (“Unknown publisher”) — the Windows Play-Protect equivalent

* Unsigned or new binaries show **“Windows protected your PC / Unknown
  publisher”** → click **More info → Run anyway** (only for builds whose
  `SHA256SUMS` you verified).
* Proper fix (like Play): Authenticode-sign the `.exe`/setup with a code
  certificate + timestamp, then gain reputation over time. Unsigned GitHub
  builds will always warn on first run — this is expected and documented.
* Never bypass with `--ignore-certificate-errors`. The browser warning is
  fixed by `--trust-ca` + fingerprint compare, not by skipping validation.

## Everyday use (same as Linux/Android)

Seal on this device → hand over QR / copied `XM1.` text / `.xmsg` file →
receiver scans + enters the same phrase → **Decrypt on this device**.
Phrases are wiped after use, clipboard clears in 30s, plaintext never saved.

Needs independent audit before high-risk use. See `SECURITY.md`.
