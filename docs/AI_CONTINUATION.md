# Continue with a coding agent — safe workflow

This is the only AI guide. Main docs never name providers or models.
Use whatever coding agent you already have configured.

This guide does not make an agent a security authority. All changes need
human review and, before real secret use, an independent audit.

## 1. Prepare (copy-paste)

```bash
git clone https://github.com/jackh0006/X-Messenger.git
cd X-Messenger
git switch codex/v2-security-remediation
git switch -c work/one-small-task
```

Do not develop directly on `main`.

## 2. Connect your agent (no secrets in repo)

At the repo root, start your coding agent, then:

- Connect your provider account (the agent stores keys outside the repo).
- Pick the model shown by your agent's model picker.
- Do NOT put API keys, tokens, passphrases, or secrets in config files,
  `.env`, Git, issues, prompts, logs, or screenshots.

Example local-only config template (do not commit real values):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "YOUR_PROVIDER/YOUR_MODEL",
  "small_model": "YOUR_PROVIDER/YOUR_SMALL_MODEL"
}
```

See `opencode.jsonc.example` in the repo root. Keep your real file local.

## 3. Paste this at the start of every session

```text
You are contributing to X Messenger. Read README.md, SECURITY_REVIEW.md,
docs/THREAT_MODEL.md, docs/PROTOCOL.md, docs/AUDIT_CHECKLIST.md,
docs/RISK_POLICY.md, and docs/AI_CONTINUATION.md before changing code.
Treat this as experimental, never as finished. Do not claim unhackable,
military-grade, or safe for crown-jewel secrets. Never add network code,
telemetry, analytics, remote fonts, cloud sync, automatic updates, or
secrets in source/logs. Do one phase only. First give a plan, then make
small changes with tests. Finish with files changed, tests actually run,
security notes, and open risks. Stop if you would need to invent crypto
or choose an unreviewed security dependency.
```

## 4. Work in this order

1. Foundation: strict checks green, shared UI builds on Android + Linux.
2. Vault: Rust-only encrypted vault, formats + known-answer + negative tests.
3. Pairing and protocol: reviewed session library only, document exactly.
4. Transport: strict parsers + fuzz targets for file, QR, NFC. Ciphertext only.
5. Bridge and UI: narrow Rust commands to UI. UI never keeps raw keys.
6. Hardening and packaging: reproducible builds, signed artifacts, SBOM.
7. Audit and beta: independent review, fix all findings, then scoped beta.

## 5. Phase prompts (copy-paste)

Foundation:

```text
Do the next foundation task only. Improve a failing or missing strict gate
for the shared app. Do not add crypto or release packages. Show exact
command output for each check.
```

Vault:

```text
Do vault design only: propose a Rust-only vault interface and versioned
authenticated at-rest format with reviewed crates. Do not invent a protocol,
export raw keys, or connect it to UI yet. Add known-answer and malformed
input tests. Stop if dependency maturity or licence is unclear.
```

Review (no edits):

```text
Act as a hostile reviewer. Rank findings by severity, cite file and line,
explain a realistic exploit path, propose the smallest fix. Check secret
leakage, network paths, unsafe parsing, crypto misuse, unsupported claims,
dependency risk, missing tests. Do not modify files in this pass.
```

## 6. Release gate

No stable APK or DEB until clean builds, tests, strict-manifest results,
reproducibility evidence, dependency review, and independent audit evidence
exist. Previews must say EXPERIMENTAL and must not handle real secrets.
Only the repo owner approves releases (see docs/RELEASE_PROCESS.md).
