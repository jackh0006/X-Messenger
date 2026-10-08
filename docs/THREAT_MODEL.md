# Threat model — X Messenger (simple words)

Status: experimental. This file lists what we try to stop, and what we cannot stop.

## What we protect

Small secrets moved offline between people who trust each other:
short texts, passwords, keys, recovery phrases, small files.

We use only face-to-face transfer or a file you carry yourself:
QR codes, NFC tap, or one encrypted `.courier` file.

## What we defend against

- Someone watches or records the transfer (camera on QR, NFC sniffing, stolen USB stick).
- Someone changes, replays, deletes, or injects packets.
- A thief with a locked device, or forensic reading of storage.
- Bad dependencies (supply chain).
- A forced user (panic wipe, decoy vault).
- Future computers decrypting recorded traffic (we plan hybrid post-quantum crypto).

Goals: privacy, integrity, authenticity, forward secrecy, replay protection,
minimal metadata (no accounts, no servers), strong storage protection, safe failure.

## What we cannot defend against

Be honest about this:

- A hacked phone or laptop OS, bad firmware, or hardware implant.
- An attacker holding your unlocked device.
- A malicious contact you paired with.
- You typing a secret on an infected machine.
- A camera looking over your shoulder when you reveal a secret.

If any of these happen, no app can save the secret.

## Rules from this model

- No network in the strict build. The channel is untrusted.
- Security comes only from encryption inside, never from QR/NFC/file secrecy.
- Clocks are not trusted. We use counters for replay protection, not time.
- Any parse, auth, or crypto error = reject, show neutral message, log nothing sensitive.
- No secrets in logs, screenshots, backups, clipboard (by default), or task-switcher preview.
