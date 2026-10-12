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
