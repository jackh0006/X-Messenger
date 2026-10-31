# X Messenger — No signal? No account? Send it anyway.

[![Verify](https://github.com/jackh0006/X-Messenger/actions/workflows/test.yml/badge.svg)](https://github.com/jackh0006/X-Messenger/actions)
[![Strict](https://github.com/jackh0006/X-Messenger/actions/workflows/strict-boundary.yml/badge.svg)](https://github.com/jackh0006/X-Messenger/actions)
![Version](https://img.shields.io/github/v/release/jackh0006/X-Messenger?label=stable)
![Android](https://img.shields.io/badge/Android-targetSdk%2036-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Offline](https://img.shields.io/badge/offline-first-orange)

Free, open-source, offline-first encrypted courier by **jackh0006**.
Seal a message **on this device**, hand it over as a **QR code, copied text,
or `.xmsg` file**. If WhatsApp needs the internet, X needs only eyesight.

> No app is impossible to hack. Weak phrases, hacked phones, or someone
> watching your screen can still leak a message. X Messenger needs an
> independent security audit before high-risk use.

## Proof, not promises — verified scoreboard

Every row is re-runnable by you (last column). Nothing here asks for trust.

| # | Proof | Result | Verified by |
| --- | --- | --- | --- |
| 1 | Node test suite: crypto, offline core, UI invariants, pairing, QR parts | **72 / 72 pass** | `npm ci && npm test` — same run on GitHub's runners (`Verify` workflow, Node 22) |
| 2 | Android asks for **CAMERA only** — never `INTERNET` | ✅ | `aapt dump badging` on the shipped APK + `Strict boundary` CI gate |
| 3 | Linux GUI: loopback-only `https://127.0.0.1` by default, zero egress | ✅ | `ss -tlnp` while running; airplane mode is a supported way to use it |
| 4 | Version lockstep — one version everywhere | ✅ `1.5.2` in all 6 files | `package.json` · `core.js` · gradle · deb control · `index.html` · `/api/info` |
| 5 | WASM v2 pair integrity | ✅ | `node scripts/check-wasm-pair.js` → self-test fingerprint, pinned toolchain |
| 6 | Desktop UI ≡ Android UI | ✅ 12/12 shared files byte-identical | `diff -rq www android/app/src/main/assets/public` (only the Capacitor bridge differs) |
| 7 | APK signatures are real (upload keystore, not debug keys) | ✅ | `apksigner verify --print-certs` → `CN=X Messenger, OU=Offline, O=jackh0006` |
| 8 | Published bytes = built bytes | ✅ 14/14 files hash-verified | `SHA256SUMS.txt` on every release; re-downloaded from GitHub and re-checked: MATCH |
| 9 | What you install = what you build | ✅ same source tree | deb from `scripts/build-deb.sh` matches `dpkg -s x-messenger` (`Version: 1.5.2`) |
| 10 | Real-device functional tasting by the author | ◐ first-party | Android arm64 + Ubuntu amd64, all flows — exact hashes in [`docs/VERIFICATION-LOG.md`](docs/VERIFICATION-LOG.md). Honest label: functional verification, *not* security audit |

Fresh numbers live in the [Actions tab](https://github.com/jackh0006/X-Messenger/actions).
**72 / 72** is not a target — it is the merge gate: a change that breaks a
test cannot get in.

### Nothing left out — where every test lives

| Suite (file) | Tests | What family it owns |
| --- | :---: | --- |
| `test/crypto.test.js` — sealing core (v1+v2) | 13 | round-trips, tamper/wrong-phrase rejection, caps, vault |
| `test/offline.test.js` — offline + platform boundaries | 24 | bundle purity, server gates, CA, backup, security guide honesty |
| `test/ui-invariants.test.js` — face of the app | 10 | ids/theming/drawer/views/camera/no-skew |
| `test/desktop.test.js` — installers & authorship | 8 | deb contents, Windows launchers, jackh0006-only credit |
| `test/pair.test.js` — pair-v2 math | 7 | secret expansion, ordering, fingerprints, length pre-checks |
| `test/qrparts.test.js` — split-transfer | 6 | numbering, out-of-order, fail-closed chunk rules |
| `test/messages.test.js` — message handling | 4 | delete, backup addressing, view-once |
| **Total** | **72** | run as one gate on GitHub's runners + docs |

**From each suite to its promise:**

| Suite | The headline promise its tests prove |
| --- | --- |
| crypto (13) | *only a mind holding your words opens the note; tampering fails loudly* |
| offline (24) | *the core truly has no phone line — nothing to leak through it* |
| ui-invariants (10) | *every button you see does what it says, in theme, on small screens* |
| desktop (8) | *the deb/EXE ships exactly the tested story — authored by jackh0006 alone* |
| pair (7) | *the v2 keys, fingerprints and ordering match the spec, face to face* |
| qrparts (6) | *long notes ride many squares in the right order — or nothing opens* |
| messages (4) | *deletes, backups and view-once behave for humans, not just for files* |

**Every one of the 72 tests mapped to the property it locks and its
plain-world meaning: [`docs/TEST-PROOF-MAP.md`](docs/TEST-PROOF-MAP.md)**.

The **six automated CI gates** (`.github/workflows/strict-boundary.yml`):
① no network APIs in the bundle · ② Android stays CAMERA-only · ③ no
certificate bypasses · ④ no unverifiable claims · ⑤ version lockstep ·
⑥ SPDX headers + third-party notices. Plus **artifact machines** in the
release pipeline: `aapt` permission scan, `apksigner verify`, `SHA256SUMS`,
`dpkg -s` accepted-install identity, `diff -rq` UI parity.

## Who can read your words — plain answer

In simple words: **nobody**. Not the author, not a server, not an AI, not
the store you installed from. This is not a promise — it is a list of
things that *do not exist* in the app, and an absence cannot betray you:

| Who | Can read your messages? | Can touch your files? | The mechanism (and how it is checked) |
| --- | :---: | :---: | --- |
| **jackh0006 (the author)** | ✗ never | ✗ | There is **no account, no signup, no server, nothing to receive**. The app never sends anything anywhere. GitHub hosts only the public code |
| **Any server — ours or someone else's** | ✗ | ✗ | By default **no server exists**. The GUI answers only on your own device at `https://127.0.0.1` — your machine talking to itself |
| **AI (the assistant used while building)** | ✗ never | ✗ | The app you install **contains no AI code and makes no network calls**. The assistant worked on the developer's own machine, at build time, under human direction — it has **no permission and no connection** to your device, your data or your messages. Ever |
| **The internet itself** | ✗ | ✗ | Android: camera permission only, **no INTERNET permission at all**. Linux: loopback by default. Airplane mode is a supported mode, not a bug |
| **Google / Play** (if you use the store) | ✗ — store install metadata only | ✗ | Standard store machinery; this app adds nothing to it (no analytics, no trackers — asserted by CI) |
| **You** | ✓ only on screen while reading | ✓ by your own install/uninstall | Plaintext exists only while a message is open; storage keeps sealed envelopes + local labels (tested). Export/backup happens only when *you* press the button |
| **Someone holding your unlocked phone + your secret words** | ◐ that one message | — | The honest limit every messenger shares: a compromised device or leaked phrase can't be cured by any app. Strong one-time phrases + lock screen (`SECURITY.md`) are the answer |

Scope note: this page and the repo are public on purpose — *the code*.
Your sealed messages never touch GitHub, any server, or any AI.

## Human-tested by the author — repeat it yourself in ~10 minutes

**2026-10-31, jackh0006:** *"I've tested it on Android arm64 and Linux
Ubuntu amd64 and all parts were working — it was all good."* Full flows,
generic devices, **exact build hashes** recorded in
[`docs/VERIFICATION-LOG.md`](docs/VERIFICATION-LOG.md) — first-party
functional verification, and the honest label says exactly that (not a
security audit).

Make the claim **reproducible** — the strongest form of honest
advertising:

| Step | One sentence |
| --- | --- |
| 1 | Two devices: an Android phone (arm64) + a Linux/Ubuntu machine, or two of anything |
| 2 | Check your SHA-256 begins with the logged ones → same builds tested |
| 3 | On the Linux box: `x-messenger gui` → the app-window opens on `127.0.0.1` |
| 4 | Seal a note with 4 secret words → show the QR |
| 5 | On the phone (airplane mode on!): scan → type the words → decrypt, and read — that is the product |

Four steps turn "trust me" into "watch me — then watch yourself."


## Contents

- [Proof, not promises — verified scoreboard](#proof-not-promises--verified-scoreboard)
- [Nothing left out — where every test lives](#nothing-left-out--where-every-test-lives)
- [Who can read your words — plain answer](#who-can-read-your-words--plain-answer)
- [Human-tested by the author — repeat it yourself](#human-tested-by-the-author--repeat-it-yourself-in-10-minutes)
- [Why it is different](#why-its-different-to-any-messenger)
- [What people need it for](#what-people-need-it-for)
- [30-second demo](#30-second-demo-like-teaching-a-5-year-old)
- [Features (all platforms same)](#features-all-platforms-same)
- [Use it](#use-it)
- [Linux GUI modes: device, LAN, VPS](#linux-gui-modes-device-lan-vps)
- [Android (stays offline)](#android-stays-offline)
- [Windows (portable, no admin, real exe)](#windows-portable-no-admin-real-exe)
- [Security design](#security-design)
- [Encryption protocols — plainly](#encryption-protocols--plainly-what-they-are-best-for-proved-how)
- [Provenance — who made this](#provenance--who-made-this)
- [Open source — verify, don't trust](#open-source--verify-dont-trust)
- [v2 post-quantum channel (experimental)](#v2-post-quantum-channel-experimental)
- [Docs map](#docs-map)
- [Donate](#donate-no-ads-no-premium)
- [Versions](#versions)

## Why it’s different to any messenger — scoreboard ✈◌⬢◈

Same task, same method, reproducible (method + proof under the table).
Legend: ✓ yes · ✗ no · ◐ partial.

| Need (your words) | X (stable) | WhatsApp | Telegram | SMS | How we prove it |
| --- | :---: | :---: | :---: | :---: | --- |
| ✈ Send with **zero bars** | ✓ | ✗ | ✗ | ◐ no lock | Airplane-mode QR seal → scan → decrypt, `npm test` |
| ◌ **No SIM / number / email** | ✓ | ✗ | ✗ | ✗ | Signup screens need numbers; X has no account field |
| ⬢ **No server copy to leak** | ✓ offline · ◐ your VPS | ✗ | ✗ | ✗ | `ss -tlnp` loopback + `aapt` (no `INTERNET`) |
| ◈ Phrase **never in QR** | ✓ enforced | — | — | — | Tamper test rejects mixed payloads |
| Padded transfers hide length | ✓ buckets | — | — | — | Duplicate/truncation tests |
| No browser warning (after trust) | ✓ local CA | — | — | — | `gui --trust-ca` + fingerprint compare |
| Normal-looking private page | ✓ LE + 443 | — | — | — | `openssl s_client` transcript |
| Independent audit | ◐ open, needs audit | ✓ | ◐ | ✗ | [`SECURITY.md`](SECURITY.md) |

Method: Ubuntu amd64 + Pixel/arm64, `npm ci && npm test` green,
`aapt dump permissions`, `ss -tlnp`, `openssl s_client -tls1_2`.
Honest footnote: LAN/VPS observers still see domain/IP/port/sizes; message
*words* stay `XM1` end-to-end. No “unhackable” claims — see Security below.

## What people need it for

- Travel, flights, power cuts, censored Wi-Fi — QR works with zero bars.
- Spare phones, de-Googled devices, no-SIM tablets.
- Clinics, field teams, classrooms sharing secrets without accounts.
- VPS owners wanting a normal-looking private page (`https://msg.example.com`)
  whose message *words* even the provider cannot read (metadata still visible —
  see `docs/vps-private-mode.md`).

## 30-second demo (like teaching a 5-year-old)

1. Type a note, like `meet at sunset`.
2. Pick 4 secret words, like `purple horse dances quietly`.
3. Tap **Seal and create QR** → a square puzzle appears.
4. Friend points their camera at the puzzle, types the 4 words, taps
   **Decrypt on this device** → they read it. Nothing flew on the internet.

```bash
npm ci
npm test          # crypto, offline, dark mode, LAN honesty
npm run gui       # first run? run: npx x-messenger setup
```

The Linux GUI opens on `https://127.0.0.1:443` (this device only, zero
egress; if 443 is taken you are asked for another port). To change
port/domain/mode: `x-messenger setup` or Settings → Connection.

### Changing port after install (persisted)

```bash
x-messenger gui --port 8443                  # use 8443 from now on
x-messenger gui --loopback --port 8443       # back to safest offline mode
x-messenger setup                            # wizard: Port [443] -> Mode 1/2/3 -> Domain
```

Quit the GUI first — the new port is saved to `gui.json`
(`~/.local/share/x-messenger/gui.json`, `%APPDATA%\x-messenger` on
Windows) and used on the next start. In a terminal you get an
interactive `Choose another port (1024–65535) [8443]` prompt; from a
launcher you get `Retry with: x-messenger gui --port 8443`. Ports
`<1024` need elevation (see VPS `setcap` below).

CLI (`cipherlink version` → current stable, by jackh0006):

```bash
cipherlink encrypt "Meet at the north gate" --to "Amina"
cipherlink decrypt "XM1.…"                  # XM2 opens via paired session in GUI
cipherlink profile "Amina" "met in person"
cipherlink profiles                         # list local labels (max 100)
cipherlink data export backup.json
cipherlink data import backup.json          # validates 512KB / 500 envelopes
cipherlink data delete --yes                # irreversible, 1-pass overwrite
cipherlink v2demo                           # terminal handshake→shred demo
cipherlink version
cipherlink help
x-messenger setup [--yes]                   # port + device/LAN/VPS + domain guide
x-messenger gui --port 8443
x-messenger gui --loopback                  # revert to offline-only
x-messenger gui --lan --port 8443           # opt-in LAN (observable)
x-messenger gui --vps --domain msg.example.com --port 443
x-messenger gui --cert-info                 # show CA + leaf SHA256/SAN/expiry
x-messenger gui --trust-ca                  # trust device-local CA once
x-messenger gui --untrust-ca                # remove device-local CA trust
x-messenger gui --regen-cert [--lan]        # rotate loopback/LAN cert
```

The phrase is always asked **hidden** (never in shell history unless you
force `--phrase` for scripts; `--phrase` warns and is for automation
only). Native window is automatic (`cipherlink-gui`, isolated webkit profile), not a
flag.

## Features (all platforms same)

- Same `www/` bundle on Linux + Android (`cap sync` verified): themes
  (system/light/dark, fully fixed contrast), text size 14–20px that really
  scales, local users (max 100, dedupe), fingerprint + copy, QR scan with
  camera-denied fallback, `.xmsg` download, backup/restore/delete (capped,
  validated), first-run “why different” card.
- Secrets hygiene: phrases wiped after use, ciphertext zeroed, clipboard
  auto-clears in 30s, plaintext never saved, backups hold labels only.
- Linux server: `GET/HEAD` allow-list, `TLS1.2+`, `no-store/nosniff/DENY/CSP`,
  `/api/info` (version, bind, TLS fingerprint/expiry/SAN), custom port
  `1024–65535` (default `443`, prompt fallback), device-local CA-signed
  loopback/LAN certs + Let’s Encrypt VPS certs, `0600/0700` files.
- Android: `CAMERA` only, no `INTERNET`, `allowBackup=false`,
  `usesCleartextTraffic=false`, `minifyEnabled`.

## Linux GUI modes: device, LAN, VPS

- **This device (default):** `x-messenger gui` → `https://127.0.0.1:443`.
  Zero internet. Safest. If 443 is taken or needs privilege you are asked
  for another port (`1024–65535`, `8443` suggested). Airplane-mode proof in `PUBLISHING.md`.
- **LAN (opt-in):** `x-messenger gui --lan --port 8443` → encrypted TLS on
  your Wi-Fi, but routers/DPI **see** LAN IP/port/sizes. Compare the cert
  fingerprint in person (`x-messenger gui --cert-info`, Settings → TLS certificate).
  Back to safety: `x-messenger gui --loopback --port 8443`.
- **My VPS (opt-in):** your domain with normal HTTPS:
  `x-messenger gui --vps --domain msg.example.com --port 443`.
  Port 443 needs one capability:
  `sudo setcap cap_net_bind_service=+ep $(readlink -f $(which node))`.
  Re-run after Node updates; alternatively `systemd AmbientCapabilities=CAP_NET_BIND_SERVICE`
  or `8443` behind Nginx/Caddy `443 → 8443`.
  Full 5-year-old guide: [`docs/vps-domain-cloudflare.md`](docs/vps-domain-cloudflare.md)
  (DNS grey-cloud, subdomains, certbot, renew). Privacy truth + risk controls:
  [`docs/vps-private-mode.md`](docs/vps-private-mode.md).

### Cert trust / verify / rotate

```bash
x-messenger gui --cert-info     # CA + leaf SHA256, validity, SAN
x-messenger gui --trust-ca      # Linux: NSS + system store; Windows: CurrentUser Root; macOS: keychain
x-messenger gui --untrust-ca    # remove trust again
x-messenger gui --regen-cert [--lan]
```
Compare fingerprints in person before trusting. See Settings → TLS certificate.

## Android (stays offline)

Settings, local users, fingerprint, QR scan — everything works with zero
bars. Rebuild: `npm run android:sync && npm run android:apk` (debug only).
Play upload is a signed `.aab` (current `versionCode`/`versionName`, see
`android/app/build.gradle`, `targetSdk 36`, `minSdk 24` for Android 9+).
GitHub ships arm64 + arm32 APKs; Play serves splits from the `.aab`.
Debug APKs never go to Play — see [PLAY_RELEASE.md](PLAY_RELEASE.md)
and [docs/store-listing.md](docs/store-listing.md). Privacy: [docs/privacy-policy.md](docs/privacy-policy.md).

## Windows (portable, no admin, real `.exe`)

Windows 10 1809+ and 11 (`x64` + `arm64` ZIPs with `X-Messenger-GUI.exe`,
`x86` experimental): unzip, ensure Node 20 LTS (`x86`: Node 18 32-bit EOL)
+ `openssl` (Git for Windows) on `PATH`, double-click `X-Messenger-GUI.exe`
(or `X-Messenger-GUI.cmd` fallback) or run `x-messenger.cmd gui` (loopback
`https://127.0.0.1:443`, fallback `8443`). Per-user `*-setup.exe` installer
(no admin) when published. Data in `%APPDATA%\x-messenger`. SmartScreen “Unknown publisher”
on first run is expected for sideloads — verify `SHA256SUMS`, use the signed
setup when published. Full steps: [`WINDOWS_GUIDE.md`](WINDOWS_GUIDE.md).

## Security design

- `AES-256-GCM` via Web Crypto, `PBKDF2-HMAC-SHA256` 600,000 iterations,
  fresh 128-bit salt + 96-bit nonce per message, versioned `XM1` (v2 seals
  with padded size buckets, v1 reads) + `XMessenger/1|2` context, strict
  parsing, 8000-char / 16380-byte cap (UI 900 for QR + counter, `>2900B`
  suggests `.xmsg`).
- Loopback HTTPS via a device-local CA (`gui --trust-ca` once,
  `gui --cert-info` to compare fingerprints); separate `--app` window,
  `FLAG_SECURE` on Android, phrase fields wiped when hidden.
- No forward secrecy, no identity proof, no endpoint-malware defense, no
  secure deletion beyond 1-pass overwrite. Any non-empty phrase allowed;
  long unique one-time phrases only. Names/notes are unverified labels.
- VPS/LAN metadata (domain/IP/port/sizes/timing) is always observable;
  message *content* stays XM1 end-to-end when the phrase stays off the server.

Read [SECURITY.md](SECURITY.md) before high-risk use.

## Encryption protocols — plainly: what they are, best for, proved how

| Protocol | Algorithm (standard — nothing invented) | Open-source implementation | Best for | Used when | Proved |
| --- | --- | --- | --- | --- | --- |
| **v1 seal `XM1`** | AES-256-GCM + PBKDF2-HMAC-SHA-256 ×600k, fresh salt+nonce every message | ✅ Web Crypto, calls readable in `core.js` | short private notes, two persons, no signal | every seal; v1 always reads | as standard (FIPS-197 since 2001, NIST GCM 2007, RFC 8018) + in-suite behavior tests; **composition audit pending** |
| **Pair v2 + `XM2`** (experimental) | ECDH P-384 + ML-KEM-1024 (post-quantum, FIPS 203) + HKDF-SHA-384 + AES-256-GCM | ✅ Go core, source shipped in `core/`, toolchain pinned | repeat contact with no shared phrase | after face-to-face pairing + spoken fingerprint | standards-fresh + in-suite pairing tests; **experimental & unaudited banner stays on** |
| **Vault `XMV1`** | AES-256-GCM, bounded (≤2 MiB) | ✅ `core.js` | local history encryption | when auto-lock/export is on | same family + dedicated vault tests |
| **Local HTTPS window** | TLS 1.2+, device-local CA (or your Let's Encrypt on opt-in VPS) | ✅ system toolchain | moving the QR/window safely inside your own device | GUI serving (loopback default) | RFC family + header/TLS gates |

Plain-language edition (locker-and-grinder analogies, best-for / *not*
best-for table): [`docs/ENCRYPTION-PLAIN.md`](docs/ENCRYPTION-PLAIN.md).

**Proved — in say-exactly-what senses:** ① standards from public NIST/IETF
process, decades of open attack (ML-KEM: newest standard, fast-growing
public review); ② open implementations — standard library code that
anyone can read, routines invented by nobody here; ③ this app's
*behavior* — the suite above locks round-trips, rejections, and limits;
④ a full audit of how it is *wired together*: not done yet — stated out
loud, since honesty is the only durable advertising.


## Provenance — who made this

- **Author and human in charge: jackh0006.** Every final decision, the
  security spec and every shipped release are directed, reviewed and
  signed off by a human. `package.json` keeps `"author": "jackh0006"` —
  and the test suite refuses anything else.
- **AI as a tool under human direction, never at runtime.** The
  development used an AI coding **assistant** to write and review parts of
  the code, always on the developer's own machine, always on your team's
  terms: the human wrote the spec and approved the ship. The app you
  install runs **no AI at all** — it is pure offline code with no network
  path, so no assistant (and no supplier of one) can read your data,
  change your files or touch your device.
- **Independent audit still recommended.** Real trust comes from outside
  eyes ([`SECURITY.md`](SECURITY.md)). Source, test counts and hash sums
  are published precisely so such an audit is possible — and cheap.

## Open source — verify, don't trust

MIT-licensed, buildable from source, and the proofs above run on GitHub's
own runners — on every push, forever, without asking anyone.

```bash
git clone https://github.com/jackh0006/X-Messenger.git
cd X-Messenger
npm ci && npm test            # → Tests 72, Pass 72
npm run build:web             # offline bundle; rejects remote assets
bash scripts/build-deb.sh amd64   # → your own .deb
```

Compare your `sha256sum` against the release's `SHA256SUMS.txt` — or skip
our builds entirely and install **your own**. That is the point of open.

| Question | Answer that can be checked |
| --- | --- |
| Is the code readable by anyone? | Yes — public repo, [MIT](LICENSE), SPDX `MIT`, notices in [NOTICE](NOTICE) |
| Can I build each shipped artifact myself? | Yes — every artifact has a from-source builder in `scripts/` |
| Who runs the tests — the author's word? | No: CI (`.github/workflows/`) runs them on GitHub's servers for every push |
| What do 72 tests actually check? | See `test/` — 7 suites from crypto round-trips to "no tracker ever loads" |
| Could a release carry something the source does not have? | The builders produce artifacts from the same tree; `SHA256SUMS` + your own build catch any drift |

### Standard repo furniture — every piece present

| Standard file | Status | Role |
| --- | :---: | --- |
| `LICENSE` (MIT) | ✅ | can-read-can-rebuild permission |
| `SECURITY.md` | ✅ | threat model, honest limits, private-in reporting path |
| `NOTICE` + `THIRD-PARTY-NOTICES.md` | ✅ (CI-gated) | attribution for the standard-lib routines |
| `CODE_OF_CONDUCT.md` / `CONTRIBUTING.md` | ✅ | how to disagree / how to add code |
| Issue templates | ✅ `bug.yml` + `device-report.yml` + `feature_request.yml` | fast reports — including first-device-testing reports |
| `.github/FUNDING.yml` | ✅ | the standard sponsor button (same addresses as the Donate table) |
| CI workflows | ✅ 3, all passing | proofs run on GitHub's machines, not memory |
| Agent guardrails | ✅ `AGENTS.md` | even AI assistance is inside written rules: no invented crypto, no hype |


## v2 post-quantum channel (experimental)

New seals can use hybrid post-quantum crypto instead of a shared phrase:
ECDH P-384 + ML-KEM-1024 (CNSA 2.0 suite), HKDF-SHA-384 chains, AES-256-GCM,
same audited Go core as the terminal demo, running in-page as WebAssembly.

- **Pair:** sidebar → Pair v2 contact. Swap QR codes face to face (4 steps),
  compare the fingerprint **out loud**, tick confirm. No pairing, no v2 seals.
- **Send:** paired sessions seal `XM2.` by default. **Read:** `XM2` opens via
  session, `XM1` always still opens — read both, write v2.
- **Honest limits:** experimental and **unaudited** (banner stays in the UI);
  128 MiB in-page key stretching, session-only vault, no hardware backing in
  the browser. Spec: [`docs/PROTOCOL-v2.md`](docs/PROTOCOL-v2.md); terminal
  loop: `x-messenger v2demo`; audit-gated roadmap in `model/README.md`.

## Docs map

| File | What it teaches (5yo-simple where it matters) |
| --- | --- |
| `docs/TEST-PROOF-MAP.md` | Every one of the 72 tests → the property it locks → its meaning in the world |
| `docs/ENCRYPTION-PLAIN.md` | The lockers explained in plain words: what each cipher is, open-source status, best-for / not-for, proof senses |
| `docs/VERIFICATION-LOG.md` | The maintainer's dated two-device test session — builds, hashes, flows, honest scope |
| `docs/GATEWAY.md` | Offline core vs optional gateway: loopback default, LAN IP / VPS domain / VPS IP with custom ports |
| `docs/vps-domain-cloudflare.md` | House address: VPS + Cloudflare DNS + subdomain + Let’s Encrypt |
| `docs/vps-private-mode.md` | Bedtime-story privacy: who sees what + daily safety rules |
| `docs/privacy-policy.md` | Collects nothing; camera frames never leave device |
| `docs/store-listing.md` | Paste-ready Play text + data safety |
| `ANDROID_GUIDE.md` / `LINUX_GUIDE.md` / `LINUX_INSTALL.md` / `WINDOWS_GUIDE.md` | Platform steps |
| `PUBLISHING.md` / `PLAY_RELEASE.md` / `RELEASE-CONTENTS.md` | GitHub + Play checklists |

## Donate (no ads, no premium)

Keeping releases signed and free costs time. If this offline freedom helps
you, please support it:

| Asset | Address |
| --- | --- |
| Bitcoin | `bc1q8t0fn2yrsy4lh3m0pz34uj27t8vxjeavkjym83` |
| DOGE | `D6ZdMQ7mHGGmuH9prpZ2zjpnG5Q3WVRDtC` |
| Ethereum / USDT ERC20 / BNB | `0xdad428900a4359be8f76b3062df34211582e09eb` |
| TRX / USDT TRC20 | `TMpb6RNTuGNM1eTakm9kjds1mRTPYYJesf` |
| SOL / USDT SPL / USDC SPL | `BDCCrRez1yD1RpkAtiqKKDk3BfxPD8P7nkL26jCYrzgL` |
| XRP | `rNUAhaATFLvosdu9m9M95bupRBtZ8eqpj9` |
| TON | `UQCu6-3yGyQ5dzvcCxr2gobuvx5ddbS9EC690qtey92P5_wX` |
| LTC | `ltc1q2gs89cfy3mumr7gu9w0zl9rllf80q67m5rmma8` |

Support / security contact: jackh109867@gmail.com (never send real phrases
or message contents).

## Versions

Single source of truth: `package.json` (+ `core.js VERSION`,
`android/app/build.gradle`, `packaging/debian/DEBIAN/control`,
`server.js /api/info` dynamic — enforced by `test/crypto.test.js`).
Check yours with `cipherlink version` and compare to the
[stable release](https://github.com/jackh0006/X-Messenger/releases/latest).
Each release ships:

| File | What |
| --- | --- |
| `X-Messenger-<ver>-Linux-amd64.deb` | Debian/Ubuntu desktop (amd64) |
| `X-Messenger-<ver>-Linux-arm64.deb` | Debian/Ubuntu desktop (ARM64: Pi 4/5, ARM laptops) |
| `X-Messenger-<ver>-Linux-armhf.deb` | Debian/Ubuntu desktop (ARM32: Pi 3/Zero 2) |
| `X-Messenger-<ver>-Linux-amd64.tar.gz` | Portable Linux (Fedora/Arch/NixOS, no root) |
| `X-Messenger-<ver>-Linux-arm64.tar.gz` | Portable Linux ARM64 |
| `X-Messenger-<ver>-Linux-armhf.tar.gz` | Portable Linux ARM32 |
| `X-Messenger-<ver>-Windows-x64.zip` | Windows 10/11 portable (x64, no admin, `X-Messenger-GUI.exe`) — see `WINDOWS_GUIDE.md` |
| `X-Messenger-<ver>-Windows-arm64.zip` | Windows on ARM portable (`X-Messenger-GUI.exe`) |
| `X-Messenger-<ver>-Windows-x86.zip` | Windows 32-bit experimental (Node 18 32-bit EOL, `X-Messenger-GUI.exe`) |
| `X-Messenger-<ver>-Windows-*-setup.exe` | Per-user installer (no admin) when `makensis` runs — otherwise ZIP only |
| `X-Messenger-<ver>-Android-arm64.apk` | Android arm64 (CAMERA-only, Android 7+/9+ tested) |
| `X-Messenger-<ver>-Android-arm32.apk` | Android arm32 (armeabi-v7a, Android 9-era phones) |
| `X-Messenger-<ver>-Android.aab` | Play upload bundle (signed, CAMERA-only) |
| `X-Messenger-<ver>-SHA256SUMS.txt` | Hashes — verify before installing |

Play/SmartScreen note: sideloaded APKs/ZIPs always warn (“Unknown app /
publisher”) until Play-signed + reputation. The `.aab` (Play) and signed
setup are the trusted paths; GitHub builds are byte-identical code with
`SHA256SUMS` for verification. See `PLAY_RELEASE.md` + `WINDOWS_GUIDE.md`.

## Legal

Licensed under [MIT](LICENSE) — see [NOTICE](NOTICE) and
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). SPDX: `MIT`.
