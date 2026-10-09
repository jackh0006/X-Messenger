# Continue with a coding agent — safe workflow

This is the only AI guide. Main docs never name providers or models.
Use whatever coding agent you already have configured.

This guide does not make an agent a security authority. All changes need
human review and, before real secret use, an independent audit.

## 1. The two codebases (do not mix them)

- **Current release v1.0.5** (what users run): Node.js offline courier.
  Source = tag `v1.0.5`. Map: `core.js` (crypto), `server.js` + `bin/cipherlink`
  (loopback GUI/CLI), `app.js` + `index.html` + `style.css` (UI),
  `android/` (Capacitor shell), `scripts/build-deb.sh` + `packaging/debian/`
  (DEB), `test/` (18 Node checks). Licence of this snapshot: MIT.
- **Future rebuild** (on branch `security-remediation`): Flutter `app/` +
  Rust `core/vault` + `core/transport`. Licence: AGPL-3.0-or-later.
  Quarantined drafts in `core/` must never ship (see `core/QUARANTINE.md`).

Fix bugs in v1.0.5 against the tag. Build the future only on the branch.

## 2. Prepare (copy-paste)

For v1.0.5 work:

```bash
git clone https://github.com/jackh0006/X-Messenger.git
cd X-Messenger
git switch --detach v1.0.5   # exact released source
npm ci
npm test                     # 18 checks, all must pass
```

For rebuild work: switch to `security-remediation` instead, and follow
`docs/BUILD_ENV.md`. Never develop directly on `main`.

## 3. Connect your agent (no secrets in repo)

At the repo root, start your coding agent, then:

- Connect your provider account (the agent stores keys outside the repo).
- Pick the model shown by your agent's model picker.
- Do NOT put API keys, tokens, passphrases, or secrets in config files,
  `.env`, Git, issues, prompts, logs, or screenshots.

Example local-only config template (do not commit real values):

```jsonc
{
  "model": "YOUR_PROVIDER/YOUR_MODEL",
  "small_model": "YOUR_PROVIDER/YOUR_SMALL_MODEL"
}
```

See `agent-config.example.jsonc` in the repo root. Keep your real file local.

## 4. Paste this at the start of every session

```text
You are contributing to X Messenger. Read README.md, SECURITY_REVIEW.md,
docs/THREAT_MODEL.md, docs/PROTOCOL.md, docs/AUDIT_CHECKLIST.md,
docs/RISK_POLICY.md, and docs/AI_CONTINUATION.md before changing code.
State whether you work on the v1.0.5 app or the rebuild branch. Treat both
as experimental, never as finished. Do not claim unhackable,
military-grade, or safe for crown-jewel secrets. Never add network code,
telemetry, analytics, remote fonts, cloud sync, automatic updates, or
secrets in source/logs. Do one task only. First give a plan, then make
small changes with tests. Finish with files changed, tests actually run,
security notes, and open risks. Stop if you would need to invent crypto
or choose an unreviewed security dependency.
```

## 5. v1.0.5 task map (copy-paste prompts)

Fix a bug:

```text
Fix one v1.0.5 bug only, against tag v1.0.5. Reproduce it first with a
failing Node test, then fix, then run the full npm test suite. Show exact
command output. Do not change the UI look or add features.
```

Rebuild the DEB/APK:

```text
Rebuild the v1.0.5 packages only: npm run build:web, bash
scripts/build-deb.sh, npm run android:apk. Verify with sha256sum and the
merged-manifest permission check. Do not modify app code.
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
exist. Prereleases must say EXPERIMENTAL and must not be advertised for
high-value keys. Only the repo owner approves releases, tags, and merges
(see docs/RELEASE_PROCESS.md and docs/ACCESS_POLICY.md).
