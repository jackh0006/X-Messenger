<!-- SPDX-License-Identifier: MIT -->
# What each test proves — all 72, one row at a time

Every row below is the **actual test name**, extracted mechanically from
`test/*.test.js` (not hand-written), its **one locked-in property**, and
its meaning in the world. If a row ever becomes untrue, the suite turns
red and the merge gate blocks it — this map is pinned to the code, not to
memory.

The ladder: **machine checks (72) → six CI gates → artifact machines
(aapt, apksigner, SHA256SUMS, dpkg, diff) → first-party human tasting
([`VERIFICATION-LOG.md`](VERIFICATION-LOG.md)) → your own 10-minute
repeat.** [SECURITY.md](SECURITY.md) owns the threat model; this page
owns the evidence line.

## crypto.test.js — 13 tests · *the sealing core*

| Test (verbatim) | Locking property | So, in the world |
| --- | --- | --- |
| `encrypts an X Messenger payload and restores the original text` | seal→open round-trip is exact | the core promise: your friend reads back what you wrote, unharmed |
| `rejects a wrong phrase and uses the configured work factor` | forged word-sets fail; the 600,000-turn grind stays on | guessers pay full price every attempt — no cheap keys |
| `keeps version fixed at 1.5.2 everywhere` | all six files agree on one version | what you install is provably what this repo says |
| `round-trips unicode, emoji and punctuation` | every human spelling survives the seal | any language, emoji included, arrives as sent |
| `each seal uses fresh salt and nonce` | no two messages share key material | identical texts can't be cross-compared with each other |
| `rejects tampered ciphertext, salt and nonce` | any forged byte fails in closed arms | a swapped receipt is refused, not opened |
| `rejects empty message, empty phrase and oversize input` | bounds enforced before any crypto | garbage gets a polite refusal, not a silent pass |
| `rejects wrong payload types` | only well-formed envelopes parse | no free-form guessing of the parser |
| `duplicate delivery decrypts identically and truncation is rejected` | re-scans agree; cut-off fails | re-reading is safe; nothing gets quietly cropped |
| `rejects emoji/CJK that exceed the byte cap even within the char cap` | byte-truth, not byte-mirage, on caps | non-Latin scripts can't slip past the safety limits |
| `v1 payloads still decrypt (backward compat), v2 seals use v2 AAD` | old stays readable, new can't replay old | upgrades never orphan your notes |
| `vault seals history opaquely and opens with the right passphrase` | saved history stays sealed on disk | a stolen phone gives a thief a locked chest |
| `vault rejects wrong passphrase, tampering, and bad shapes` | the chest fails closed like the courier | same strictness everywhere |

## offline.test.js — 24 tests · *the no-line stand*

| Test (verbatim) | Locking property | So, in the world |
| --- | --- | --- |
| `web bundle has no remote network calls (same-origin /api/info only)` | zero outside calls | the app has nowhere to phone |
| `android requests camera only and stays offline` | CAMERA-sure, no INTERNET | even the OS says: nothing here gets net |
| `linux server defaults to loopback 443 HTTPS separate window with hardened headers` | loopback-only real HTTPS | the front door stays shut to the street |
| `v2 bridge is WASM-local, experimental, and keeps v1 readable` | post-quantum bridge local + honest | the future math moves in, visibly labeled |
| `wasm pair is pinned: one toolchain, stamped, functionally gated` | the crate matches its fingerprint | no surprise substitutes in the math |
| `camera scan accepts v2 envelopes as well as XM1` | both eras scan | old and new friends' codes both read on the first try |
| `lan mode is opt-in and honestly warned` | sharing stays yours to choose, with warnings | no silent widening of exposure |
| `offline is the default; gateway needs explicit opt-in` | silence by default | out of the box, nothing talks |
| `local CA fixes browser warning without insecure flags` | real padlock, zero bypass flags | not tricked with unlocked rules — warned via locally proven trust |
| `service worker never caches remote content` | the memory-keeper stores only home files | even the rememberer has no interest in strangers |
| `session messages support delete, backup v2 carries sealed envelopes only` | deletion real, backups sealed | your words never lie in backups as plain text |
| `plaintext never persists: localStorage holds labels/settings/sealed vault only` | disk holds sealed, not words | the journal keeps only unreadable paper |
| `opening a sealed envelope stages ciphertext only, stores nothing` | reading adds no readable trace | even the moment of reading leaves no print |
| `boot probe shows an update notice on ancient browsers, not a white screen` | old devices get messaging | no blank wall on older glass |
| `security guide states verifiable guarantees without hype` | claims tied to rulers | our promises carry their proof angle with them |
| `build stamp proves which commit serves` | provenance embedded | the bytes running carry their family tree |
| `android supports arm32 + arm64 on SDK 36 with Play AAB path` | old to new phones + store path | wide phone fan gets equal support |
| `desktop is cross-platform: platform shim + per-arch demo + Windows track` | every supported desktop runs | Pi, laptop, x86-64, Windows each get a working copy |
| `server serves WASM correctly and resolves paths on Windows` | the math-crate loads cross-platform | no OS misses the science door |
| `launch lands in the messenger: no auto splash screens` | instant to the room | open → words, not a maze |
| `v2 pairing works over copied text end to end` | pairing without servers | pair over the face-to-face swaps/Wi-Fi-free bonds |
| `paired v2 contact owns a user page and its thread seals` | one room per person | letters stay in each person's own bin, sealed |
| `vault history: lock UI, auto-lock, settings wipe cover everything` | the chest's locks are complete | no corner of the safe left unlocked |
| `backup carries thread addressing for export and restore` | restore keeps the dialogue | recovered backups rebuild whole rooms |

## ui-invariants.test.js — 10 tests · *the face*

| Test (verbatim) | Locking property | So, in the world |
| --- | --- | --- |
| `every #id referenced in app.js exists in index.html or is created dynamically` | no ghost references | nothing in the code you cannot touch |
| `dark theme covers fonts and key surfaces` | night readability | eyes stay comfortable after midnight |
| `message caps are consistent` | UI matches the crypto limits | the margin always says stop before the code does |
| `encrypted vault-file import is real, bounded, and never accepts plaintext JSON` | the import tool is strict | only sealed files come in; no sneaking please |
| `camera scanner favors the rear camera, continuous focus, and inverted QR recognition` | scanning stays practical | rear camera, live focus, upside-down squares all accepted |
| `hamburger-only mobile nav with one shared handler (no bottom bar)` | one menu, no duplicity | one button, no hidden doors |
| `telegram drawer exists with full sidebar equipment` | mobile has the whole sidebar | the full map works on the phone |
| `views render dedicated pages: receive list, users, pair status` | every view its own room | clicking through with no crowding |
| `per-user threads: addressed messages leave Saved, contacts live in Users only` | one truth per contact | nothing appears in two fountains at once |
| `small screens never overflow horizontally (360px class)` | small-phone fit fixed | even a 360-pixel phone holds the app |

## desktop.test.js — 8 tests · *the doors and the authorship*

| Test (verbatim) | Locking property | So, in the world |
| --- | --- | --- |
| `desktop entry is absolute, single-category, by jackh0006` | launcher is precise, single menu slot | Applications menu shows one truth and the right author's name |
| `deb ships postinst and prunes dev docs` | install is clean and proper | your machine gains an app, not a lab |
| `windows ships real .exe launchers (by jackh0006), x86 experimental documented` | genuine launchers | no batch-file costume, real .exe doors |
| `no AI/OpenCode builder credit, jackh0006 only` | signature accuracy | the author's signature on the wall belongs to a human |
| `linux native shell: no Chromium dependency, WebKitGTK only` | system webview only | no 40-MB surprise browser enters your machine |
| `linux native shell: window chrome with move/close/fullscreen` | the window acts like a window | every natural window habit works |
| `linux menu launcher installs for the current checkout and survives a busy port` | launch is strong | installation doesn't trip on a busy machine |
| `linux native shell: software compositing default, crash reload carries v2 flag` | render-protection + resumption | after a bump, meaning continues |

## pair.test.js — 7 tests · *the v2 (experimental) math*

| Test (verbatim) | Locking property | So, in the world |
| --- | --- | --- |
| `meeting secret expands halves to 32 bytes (S32)` | derivation is exact | your shared whisper becomes precisely the right key size |
| `lo/hi uses byte-lexicographic compare, not decimal strings` | ordering per spec | the rules of comparison are byte-true, never decimal illusions |
| `fingerprint uses ordered spec transcript, not sorted blobs` | verification follows the spec order | you and your friend read the *same* paper to compare |
| `v2 codes warn when too large for cameras` | early warnings before dense walls | the square warns before it's unscannable |
| `v1.4.2 P0: view-once never hits disk, high-value gate live, XM2 restore accepted` | once notes leave no print | "view-once" actually vanishes |
| `v1.4.2 P0: delete-all and forgot call v2unpair and clear clipboard` | forgets are thorough | your broken pair forgets completely and fast |
| `v1.4.2: export capped, QR copy-first, v2 length pre-check, no template buttons` | careful exports | nothing over the caps, copy-first for long QR duty |

## qrparts.test.js — 6 tests · *the courier of pictures*

| Test (verbatim) | Locking property | So, in the world |
| --- | --- | --- |
| `short payloads stay a single plain QR (no XMQ1 wrapping)` | short = quick single scan | a short note never waits behind ceremony |
| `splits a long payload into numbered parts and reassembles out of order` | long notes ride many squares | a long note reassembles from any scanning order |
| `rejects incomplete, duplicate, mixed and tampered part sets` | bad sets fail closed | one rotten piece refuses the whole book |
| `parse rejects malformed chunks fail-closed` | hand-bent = refused | a bent square is just not the message |
| `QR chunks stay small enough for reliable camera scanning` | print size science | chunks stay inside what a phone camera can reliably see |
| `split chunks never contain the phrase or plaintext` | secrets never carry blocks | tickets on the road never expose the password |

## messages.test.js — 4 tests · *the human touches*

| Test (verbatim) | Locking property | So, in the world |
| --- | --- | --- |
| `tap menu offers all eight actions` | menu completeness | hold a message, get every natural move |
| `hold quick bar has copy, forward, delete, and more` | quick actions constant | your thumb reaches all without digging |
| `reply, star, re-key, forward, details share one store` | one truth per message | change a corner, all views update together |
| `message graphics are Telegram-like with dark cover` | familiar rendering | reading feels at home, no learning curve |

## Honest tail

The suite proves **behavior**; the six CI gates prove **boundaries**; the
hash/verify machines prove **artifact identity**; the human log proves
**real-device working order**; nothing here replaces an independent
composition audit ([`SECURITY.md`](SECURITY.md)) — the honest fourth arm
of proof. Any of the above going false turns a build red; it never
hides.
