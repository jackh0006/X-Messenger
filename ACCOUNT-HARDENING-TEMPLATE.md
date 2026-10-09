# SPDX-License-Identifier: MIT
# Account hardening template (reused from X Messenger v1.0.7)

Apply per repo. Check boxes, keep evidence in the repo.

## 1. Legal + privacy (100% open source)

- [ ] `LICENSE` present (MIT recommended for store-distributed apps with
  MIT/Apache deps; AGPL only if vendoring copyleft code like libsignal).
- [ ] `NOTICE` (holder, year, contact) + `THIRD-PARTY-NOTICES.md` listing
  every direct dependency with version + license.
- [ ] `PRIVACY.md` at root: what is collected (goal: nothing), permissions
  and why, what leaves the device, backups/deletion.
- [ ] SPDX header on every source file (`MIT`).
- [ ] No committed secrets: run `git log -p | grep -iE
  'ghp_|gho_|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|api[_-]?key'`
  before every release.

## 2. Security honesty

- [ ] `SECURITY.md`: contact, supported versions table, protected / NOT
  protected lists, audit status. No `unhackable / CIA-grade / zero bugs`.
- [ ] Threat model names the adversary (provider, network, thief) and the
  non-goals (compromised OS, coerced user).
- [ ] Crypto only from audited libraries; no custom protocols. Pin versions.

## 3. CI that stays green

- [ ] `test.yml`: install + unit tests + build on every push/PR.
- [ ] `strict-boundary.yml` (copy this repo's): offline manifest check
  (where applicable), no-suspicious-API grep, no-hype grep,
  version-lockstep check, SPDX + third-party check.
- [ ] Branch protection: require both workflows before merge.

## 4. Releases that never need renaming

- [ ] `scripts/release.sh` pattern: single `VER` argument, lockstep grep,
  canonical asset names `Name-<ver>-<os>-<arch>.<ext>`, `SHA256SUMS` +
  SBOM artifacts, `gh release` publish step, old releases demoted never
  rewritten.
- [ ] Docs reference "current stable" + dynamic badges, never hardcoded
  versions (except generated changelogs).

## 5. Advertising with tables (truthful)

- [ ] Scoreboard table vs alternatives with a reproducible method row.
- [ ] Platform-parity table with proof commands (`aapt`, `ss`, test names).
- [ ] Asset table with exact filenames + hash verification instructions.
- [ ] Every ✓ links to proof (test name, command, doc section).

## Rollout order for this account

1. X-Messenger (done — reference implementation).
2. `bnb-terminal-wallet` (money at stake: local-signing audit first).
3. `openvpn-wizard` / `openvpn-stealth-wizard` (claims about DPI need proof).
4. `XDNS`, `GooseRelayVPN-Installer`, `X-UI-Fronting-Pro` (server-side
   hardening + key handling review).
