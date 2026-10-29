const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
global.crypto = webcrypto;
const { qrSplit, qrParseChunk, qrAssemble, encryptText, decryptText, QR_CHUNK_CHARS } = require('../core.js');

test('short payloads stay a single plain QR (no XMQ1 wrapping)', async () => {
  const sealed = await encryptText('short note', 'four uncommon private words here');
  assert.ok(sealed.length <= QR_CHUNK_CHARS, 'fixture must fit one chunk');
  // Sender rule: split only when the payload exceeds one chunk, so short
  // transfers keep today's exact single-QR bytes (no XMQ1 envelope).
  const shown = sealed.length > QR_CHUNK_CHARS ? qrSplit(sealed) : [sealed];
  assert.equal(shown.length, 1);
  assert.ok(shown[0].startsWith('XM1.'), 'single QR keeps the XM1 envelope');
  assert.equal(await decryptText(shown[0], 'four uncommon private words here'), 'short note');
});

test('splits a long payload into numbered parts and reassembles out of order', async () => {
  const sealed = await encryptText('x'.repeat(3000), 'four uncommon private words here');
  assert.ok(sealed.length > QR_CHUNK_CHARS, 'fixture must exceed one chunk');
  const parts = qrSplit(sealed);
  assert.ok(parts.length >= 2, 'long payload must split into 2+ parts');
  assert.ok(parts.every(p => p.startsWith('XMQ1.')), 'every part carries the XMQ1 magic');
  const reversed = [...parts].reverse();
  assert.equal(qrAssemble(reversed), sealed);
});

test('rejects incomplete, duplicate, mixed and tampered part sets', async () => {
  const sealed = await encryptText('y'.repeat(3000), 'four uncommon private words here');
  const parts = qrSplit(sealed);
  await assert.rejects(async () => qrAssemble(parts.slice(0, -1)), /Incomplete/);
  const dup = [...parts]; dup[0] = parts[1];
  await assert.rejects(async () => qrAssemble(dup), /Duplicate|Incomplete/);
  const other = await encryptText('z'.repeat(3000), 'four uncommon private words here');
  const mixed = [...parts.slice(0, -1), ...qrSplit(other).slice(-1)];
  await assert.rejects(async () => qrAssemble(mixed), /Mixed|Incomplete/);
  const tampered = parts[0].slice(0, -1) + (parts[0].endsWith('A') ? 'B' : 'A');
  // Framing is not authenticated (the AEAD layer is): a tampered chunk
  // still parses, but the assembled payload must then fail decryption.
  const corrupt = qrAssemble([tampered, ...parts.slice(1)]);
  assert.notEqual(corrupt, sealed);
  await assert.rejects(decryptText(corrupt, 'four uncommon private words here'));
});

test('parse rejects malformed chunks fail-closed', () => {
  assert.throws(() => qrParseChunk('XM1.abc'), /Not a QR part/);
  assert.throws(() => qrParseChunk('XMQ1.short'), /Unsupported QR part/);
  assert.throws(() => qrParseChunk('XMQ1.!!!.1.2.AAAA'), /Unsupported QR part/);
  assert.throws(() => qrParseChunk('XMQ1.abcdefghijklmnopqrstuv.9.2.AAAA'), /Unsupported QR part/);
  assert.throws(() => qrSplit(''), /Nothing to split/);
  assert.throws(() => qrSplit('XMQ1.a.1.2.AAAA'), /Already a QR part/);
});

test('split chunks never contain the phrase or plaintext', async () => {
  const sealed = await encryptText('never show these words', 'correct horse vault phrase words');
  for (const part of qrSplit(sealed)) {
    assert.ok(!part.includes('never show these words'), 'chunk must stay opaque');
    assert.ok(!part.includes('correct horse vault phrase words'), 'chunk must not carry the phrase');
  }
});
