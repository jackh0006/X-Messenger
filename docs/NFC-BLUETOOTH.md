# SPDX-License-Identifier: MIT
# NFC + Bluetooth transfers — guide, limits, risks (v1.0.8)

QR and `.xmsg` files stay the primary couriers. NFC and Bluetooth are
short-range conveniences for **already-sealed** `XM1` envelopes. The radio
is hostile: assume anyone nearby records everything. `XM1` authenticated
encryption is the **only** security — proximity, pairing, and signal bars
prove nothing, and the shared phrase still travels separately, in person.

## NFC tap (Android app)

- **What works:** write a short sealed envelope to an NFC tag (or
  phone-to-tag), tap to read it into the receive box, then enter the phrase.
- **Limits:** sealed envelopes start near 620 bytes (padded). You need
  NTAG216-class tags (888 bytes). Anything bigger is refused with
  "Too big for NFC — use QR, file, or Bluetooth."
- **Where:** Android app only (native NDEF reader/writer). Desktop browsers
  have no NFC; the buttons hide there with an honest note.
- **Risks:** NFC reads at a few centimetres, but attackers extend range
  with antennas and can relay taps. A tag left behind is a ciphertext
  leak — treat found tags as hostile and never accept a phrase from the
  same tag. Wipe tags you retire.

## Bluetooth LE (Android peripheral + desktop central)

- **What works:** the Android app advertises an `X Messenger` GATT service;
  the Linux desktop page (Chrome `--app` window) connects, and chunked
  `XMB` frames carry the envelope with per-frame CRC, order-independence,
  resume, and duplicate tolerance. The receiver still enters the phrase.
- **Limits:** short range (~10 m), slow (hundreds of bytes per second),
  one peer at a time, 90-second listen window, explicit tap per transfer.
  Phone-to-phone needs a future central on the second phone (roadmap).
- **Where:** Android app advertises; Linux GUI connects. WebViews cannot be
  centrals, so in-app Bluetooth buttons appear only where `navigator.bluetooth`
  or the native bridge exists.
- **Risks:** BLE is sniffable with a $30 dongle; MAC addresses can track
  you across sessions; pairing encryption is **not** trusted (KNOB/BIAS-class
  flaws) — the app treats the link as a dirty wire and re-verifies `XM1`.
  Keep transfers short, confirm the safety fingerprint in person, and turn
  Bluetooth off when done.

## Rules for every transport (QR included)

1. Phrase travels separately, in person, once. Never inside the envelope.
2. Compare fingerprints before trusting a sender.
3. View-once for crown jewels; delete session messages after reading.
4. Lost device? The session held plaintext — re-key your phrases.

No software is unhackable; radio tricks need an independent audit before
high-risk use. See `SECURITY.md`.
