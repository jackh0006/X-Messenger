// SPDX-License-Identifier: MIT
// v1.4.1 regression: pair v2 failed at step 4/4 with
// "Pairing failed: core: bad handshake input length" because the meeting
// secret was 16B (single XOR) while Go RootKey needs S32 (duplicated XOR).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const js = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

test('meeting secret expands halves to 32 bytes (S32)', () => {
  assert.ok(js.includes('new Uint8Array(32)'), 'S32 buffer must exist');
  assert.ok(js.includes('a[i % 16] ^ b[i % 16]') || js.includes('a[i%16] ^ b[i%16]') || js.includes('i % 16'), 'S32 must XOR halves across 32 bytes');
  assert.ok(!js.includes('a.map((x, i) => x ^ b[i % b.length])'), 'old 16-byte sBytes map must be gone');
});

test('lo/hi uses byte-lexicographic compare, not decimal strings', () => {
  assert.ok(js.includes('_cmp(myId, peerId)'), 'must compare raw identity bytes with _cmp');
  assert.ok(!js.includes("join(',') + '|'"), 'decimal-string bundle compare must be gone');
});

test('fingerprint uses ordered spec transcript, not sorted blobs', () => {
  assert.ok(js.includes('ctLo') && js.includes('ctHi'), 'ordered ct_lo/ct_hi must exist');
  assert.ok(!js.includes('blobs.sort('), 'lexicographic blob sort must be gone');
});

test('v2 codes warn when too large for cameras', () => {
  assert.ok(js.includes('~2.3k') || js.includes('large for cameras'), 'QR size warning must exist');
});

test('v1.4.2 P0: view-once never hits disk, high-value gate live, XM2 restore accepted', () => {
  assert.ok(js.includes('filter(m => !m.viewOnce)'), 'vaultSnapshot must filter view-once');
  assert.ok(js.includes('const highValue = !!('), 'high-value must be captured before clearing');
  assert.ok(!js.includes("if ($('#highValue') && $('#highValue').checked && phrase.length"), 'dead high-value check must be gone');
  assert.ok(js.includes("e.sealed.startsWith('XM1.') || e.sealed.startsWith('XM2.')"), 'restore must accept XM1 and XM2');
});

test('v1.4.2 P0: delete-all and forgot call v2unpair and clear clipboard', () => {
  assert.ok(js.includes('v2unpair()'), 'wipe paths must unpair v2');
  assert.ok(js.includes("xm2call('forget'"), 'WASM handles must be forgotten');
  assert.ok(js.includes('clearClipboardNow()'), 'wipe/lock must clear clipboard now');
});

test('v1.4.2: export capped, QR copy-first, v2 length pre-check, templates exist', () => {
  assert.ok(js.includes('.filter(m => m.sealed).slice(-500)'), 'export must cap at 500');
  assert.ok(js.includes('too big for reliable QR'), 'large payloads must skip QR render');
  assert.ok(js.includes('Too long for v2 QR bucket'), 'v2 thread must pre-check length');
  assert.ok(js.includes('insertTemplate') && js.includes('tplLoc'), 'QR-only templates must exist');
});
