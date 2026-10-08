# AGENTS.md — X Messenger

Read before changing code. Keep changes small and reviewable.

1. Read `README.md`, `SECURITY_REVIEW.md`, `docs/THREAT_MODEL.md`,
   `docs/PROTOCOL.md`, `docs/AUDIT_CHECKLIST.md`, `docs/RISK_POLICY.md`.
2. This is experimental. Never claim unhackable, military-grade, or safe
   for seed phrases, private keys, or crown-jewel secrets.
3. Never add network code, telemetry, analytics, remote fonts, cloud sync,
   auto-update, or secrets in source/logs/tests.
4. Do one task only. Plan first, then edit + test.
5. Run before you finish:
   `bash scripts/strict-check.sh`
   `cd app && flutter analyze && flutter test`
6. Finish with: files changed, exact test output, security notes, open risks.
