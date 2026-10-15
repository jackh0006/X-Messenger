# Security policy and threat model (v1.5.2)

Report suspected vulnerabilities privately to **jackh109867@gmail.com** with version, impact, and reproduction steps. Do not send private keys, real message contents, recovery phrases, or tokens. Do not open public issues for vulns.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.5.2 | Yes (current) |
| older | No — please upgrade and re-test |

## Protected

With uncompromised endpoints, a strong unique phrase exchanged separately, and correct platform Web Crypto, an `XM1` payload protects message confidentiality and detects alteration. TLS 1.2+ protects the road (loopback/LAN/VPS); XM1 protects the letter end-to-end. Payloads too long for one reliable QR are shown as numbered `XMQ1` parts carrying the same ciphertext; only a complete set reassembles, and alteration still fails at XM1 authentication.

## Not protected

- Malware, root access, screen capture, keyloggers, or physical endpoint compromise.
- Weak, reused, guessed, or observed phrases.
- Metadata: VPS/LAN observers see domain/IP/port/sizes/timing. Cloudflare orange-cloud proxy sees TLS plaintext — use grey-cloud (DNS-only) for end-to-end.
- Traffic analysis, identity authentication, forward secrecy, post-compromise security, or secure deletion beyond 1-pass overwrite.
- The v2 post-quantum channel (P-384 + ML-KEM-1024) is experimental and unaudited: its handshake composition has a Tamarin skeleton, not a proof. Do not rely on it for high-risk use until the external audit lands. Known platform issue, fixed in the Linux shell: Ubuntu's WebKitGTK 2.52 emits AVX in its probe path on the WASM baseline tier, so any v2 call killed the page (SIGILL) on CPUs without AVX. The shell now disables only that tier (`JSC_useBBQJIT=0`, full loopback pairing verified) and keeps crash-reload with v2 stand-down as a safety net. XM1 transfers never touch the v2 engine.

Before high-risk use, move the protocol to a small audited native Rust/libsodium core with OS-backed storage, X25519/Ed25519 identities, an audited asynchronous double ratchet, signed reproducible builds, and an external audit. Do not claim “unhackable,” agency resistance, or certification without evidence.
