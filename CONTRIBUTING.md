# Contributing to X Messenger

Thank you for helping. This project handles a high-risk problem, so security
claims and release artifacts need a higher bar than ordinary application work.

## Before coding

1. Read `README.md`, `SECURITY_REVIEW.md`, `docs/THREAT_MODEL.md`, and
   `docs/AI_CONTINUATION.md`.
2. Work in a branch. Keep each change small and reviewable.
3. Sign every commit: `git commit -s` (adds `Signed-off-by`; DCO is enforced
   by CI). Put `SPDX-License-Identifier: AGPL-3.0-or-later` at the top of new source files.
3. Never add network transport, telemetry, analytics, ads, crash reporting, or
   automatic update code to the strict build.
4. Never invent a cryptographic protocol or change cryptographic dependencies
   without a written decision and human review.

## Required checks

Run the checks relevant to your change before opening a pull request:

```bash
bash scripts/strict-check.sh
cd app && flutter analyze && flutter test
cargo test --workspace
```

If a command cannot run, say why in the pull request. Do not claim it passed.

## Pull requests

Include: purpose, files changed, tests run, security impact, and open risks.
Do not commit build directories, `.env` files, tokens, signing keys, APKs,
DEBs, private test fixtures, or real secrets.
