# X Messenger Privacy Policy

Effective: 2026-10-06. App: X Messenger 1.0.8 (`com.jackh0006.xmessenger`).

## Short version

X Messenger collects nothing, uploads nothing, and has no server. Camera frames used for QR scanning never leave your device.

## Data collection: none

- No account, no phone number, no email, no contacts upload.
- No analytics, no ads SDK, no crash reporting, no location.
- Messages, phrases, recipient names/notes, and settings stay in on-device storage only (`localStorage` on Android/Linux GUI, `~/.local/share/x-messenger` for CLI).

## Permissions

- Android: `CAMERA` only, for QR scanning. No `INTERNET`, no network-state permission. Deny camera and you can still paste `XM1.` text.
- Linux: GUI binds `https://127.0.0.1` loopback only with a device-local CA-signed leaf (trust once via `x-messenger gui --trust-ca`). No outbound connections.

## What leaves the device

Only what **you** choose to show: a QR image, copied `XM1.` text, or an `.xmsg` file you hand over offline. The shared phrase is never included in that payload.

## Backups and deletion

- Android: `allowBackup=false`, `usesCleartextTraffic=false`.
- Export creates a local JSON backup only when you tap Export. Delete removes on-device labels/preferences. No remote wipe is possible because there is no remote copy.

## Contact

Security / privacy: jackh109867@gmail.com. Do not send real message contents or phrases.

## Changes

Material changes will bump the app version and this document together. Current version: 1.0.8 (2026-10-10: QR-only transfers, session messages).
