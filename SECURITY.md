# Security policy and threat model (v1.0.7)

Report suspected vulnerabilities privately to **jackh109867@gmail.com** with version, impact, and reproduction steps. Do not send private keys, real message contents, recovery phrases, or tokens. Do not open public issues for vulns.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.7 | Yes (current) |
| older | No — please upgrade and re-test |

## Protected

With uncompromised endpoints, a strong unique phrase exchanged separately, and correct platform Web Crypto, an `XM1` payload protects message confidentiality and detects alteration. TLS 1.2+ protects the road (loopback/LAN/VPS); XM1 protects the letter end-to-end.

## Not protected

- Malware, root access, screen capture, keyloggers, or physical endpoint compromise.
- Weak, reused, guessed, or observed phrases.
- Metadata: VPS/LAN observers see domain/IP/port/sizes/timing. Cloudflare orange-cloud proxy sees TLS plaintext — use grey-cloud (DNS-only) for end-to-end.
- Traffic analysis, identity authentication, forward secrecy, post-compromise security, or secure deletion beyond 1-pass overwrite.

Before high-risk use, move the protocol to a small audited native Rust/libsodium core with OS-backed storage, X25519/Ed25519 identities, an audited asynchronous double ratchet, signed reproducible builds, and an external audit. Do not claim “unhackable,” agency resistance, or certification without evidence.
