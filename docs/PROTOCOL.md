# Protocol boundary — X Messenger

Status: experimental. There is no approved security core yet.

## Compatibility format: XM1

`XM1` is the old JavaScript demo format in this repo. It is NOT approved
for seed phrases, private keys, or other crown-jewel secrets.

Do not claim Signal compatibility, forward secrecy, or post-quantum
security for `XM1`. Those claims need a reviewed library, test vectors,
fuzzing, and an independent audit.

## Future strict path

- Pairwise sessions: use a maintained, reviewed session library (Signal-grade).
  Wrap it behind our own `protocol` crate interface so it can be updated.
- Never invent a custom protocol, mode, padding, or key derivation.
- One-shot files: use standard HPKE (RFC 9180) with reviewed code.
- AEAD: XChaCha20-Poly1305 or AES-256-GCM, random nonces.
- Passwords: Argon2id. Key derivation: HKDF with unique labels.
- Every packet, file, and DB record: version byte + AEAD + context binding.
- Transport moves opaque ciphertext only. Packet = magic | version | type |
  flags | packet-id | length | ciphertext | CRC32. CRC is for errors only,
  not security. Strict parser: size limits, validate length before allocate,
  reject trailing bytes. Parser must be fuzzed.

## Pairing

- Identity = keys only. No phone number, email, or server account.
- Strongest: scan QR face to face both ways, then compare the same 6-word
  safety phrase on both screens, then both tap Match.
- Imported contact cards stay Unverified until the phrase is compared
  on another channel (for example a voice call).
- A changed key blocks sending until re-verified.
