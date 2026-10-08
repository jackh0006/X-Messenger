# Release process — owner approval only

Only the repository owner can publish a new version. Forks and pull
requests cannot release.

## Rules

1. All work happens in branches. No direct push to `main`.
2. Every pull request needs:
   - 1 approving review from `@jackh0006` (see `.github/CODEOWNERS`),
   - green `strict-security` + `verify` checks,
   - signed commits.
3. Stable releases are manual only:
   - Go to Actions → `preview-release` → Run workflow.
   - Environment `release` requires owner approval.
   - No auto-release on push or tag.
4. Preview packages must be named `*-preview*` and say EXPERIMENTAL.
5. Stable secret-handling releases are blocked until
   `docs/AUDIT_CHECKLIST.md` + `SECURITY_REVIEW.md` are fully resolved
   and an independent audit is complete.

## Enable in GitHub settings (owner does once)

- Settings → Branches → Add rule for `main`:
  Require pull request, 1 approval, dismiss stale reviews,
  require status checks, require signed commits,
  block force pushes, do not allow direct pushes.
- Settings → Environments → New `release` → Required reviewers: `@jackh0006`.
- Settings → Code security: enable secret scanning + push protection,
  Dependabot, CodeQL, private vulnerability reporting.

Copy-paste to protect `main` with `gh`:

```bash
gh api repos/jackh0006/X-Messenger/branches/main/protection -X PUT \
  -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  -f required_status_checks='{"strict":true,"contexts":["strict-boundary","verify"]}' \
  -f enforce_admins=true \
  -f required_signatures=true \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```
