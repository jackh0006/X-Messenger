# Access policy — who can change, who can publish

Simple words. Anyone (human or coding agent) may propose changes. Only the
owner, jackh0006, can publish them.

## Giving this repo to another AI (copy-paste recipe)

1. GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
2. Expiry: 30 days or less. Repository access: **Only select
   repositories** → `jackh0006/X-Messenger`.
3. Permissions — allow exactly these, nothing else:
   - Contents: **Read and write** (branches, commits, files)
   - Pull requests: **Read and write** (open and update PRs)
   - Actions: **Read-only** (see CI results)
   - Metadata: read-only (automatic)
4. Paste the token into the AI tool's own secret field. **Never paste it in
   chat, issues, prompts, or code.** Revoke it when the job is done and make
   a new one next time. Any token ever pasted in chat counts as burned.

## What that token can and cannot do

| Action | Allowed? | Why |
| --- | --- | --- |
| Create branches, commit, rewrite any file | Yes | Contents write |
| Open and update pull requests | Yes | PRs write |
| Merge a PR into `main` | **No** | Ruleset requires owner's review |
| Push directly to `main` | **No** | Branch ruleset blocks, no bypass except owner |
| Create or move a `v*` version tag | **No** | Tag ruleset, owner-only bypass |
| Publish or edit a Release | **No** | Token has no Releases permission |
| Approve the `release` environment | **No** | Required reviewer is the owner |
| Change repo settings, protections, secrets | **No** | No Administration permission |

## Owner confirmation checkpoints (all required to ship)

1. **Merge:** PR needs your approving review + green checks + signed commits.
2. **Tag:** only you can push `v*` tags (ruleset bypass list: repository owner).
3. **Publish:** the `release` workflow waits on the `release` environment,
   whose only reviewer is you. No auto-release on push or tag.

So an AI can change the project completely on a branch — and nothing reaches
users until you personally approve all three checkpoints.
