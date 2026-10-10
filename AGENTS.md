# AGENTS.md — AI contributor guide for X Messenger (v1.1.0)

You are helping with an offline-first encrypted courier. Real users trust
this with private words. Be honest, be minimal, never inflate claims.

## Hard rules (from SPEC + 100-point review)

1. **No custom crypto.** Only the shipped `AES-256-GCM + PBKDF2-SHA256/600k`
   in `core.js` (v2 seals, v1 reads). Never invent protocols, KDFs, or
   padding. PQ ratchet / MLS belong in a future audited Rust core, not JS.
2. **Offline core stays offline.** Default bind is `127.0.0.1` loopback-only.
   No `INTERNET` permission on Android, no remote `fetch`/XHR/WebSocket in
   `www/`, no `file://` launch. Gateway (`--lan/--vps`) is explicit opt-in
   with consent + observability warnings (`docs/GATEWAY.md`).
3. **Secrets stay local.** Never log phrases, keys, plaintext, or full
   payloads. Wipe phrase fields on hide (`visibilitychange`), clear
   clipboard after 30s, `0600` on key material, no secrets in tests.
4. **Fail closed.** Any parse/auth/crypto error → reject with a neutral
   message. Never downgrade, never silently retry insecurely.
5. **No bypass flags.** Never add `--ignore-certificate-errors`,
   `--allow-insecure`, or equivalent. The browser warning is fixed by the
   device-local CA (`gui --trust-ca` + fingerprint compare), not by
   skipping validation.
6. **No hype.** Never write `unhackable`, `CIA-grade`, `NSA-proof`,
   `invisible to DPI`, or agency-resistance claims. Say what is verified
   and what needs an audit (`SECURITY.md`).

## Workflow

- Small steps: `npm test` must stay green (`test/crypto, offline,
  ui-invariants`). Add a test with every behavior change.
- Version lockstep: `package.json`, `core.js VERSION`, `index.html`
  (`?v=` + labels), `android/app/build.gradle`
  (`versionCode`/`versionName`), `packaging/debian/DEBIAN/control`,
  `server.js /api/info`, docs headers. `test/crypto.test.js` enforces it.
- Release only via `scripts/release.sh`. Never hand-edit tags; never
  rewrite published releases — supersede with a new version.
- Before crypto/transport changes, re-read `SECURITY.md`,
  `docs/GATEWAY.md`, `docs/privacy-policy.md` and update them in the same
  commit when behavior changes.

## What good looks like

`files changed, how to run the tests, open risks` at the end of every
answer. If you cannot follow a rule, stop and ask the human.
