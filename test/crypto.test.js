const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
global.crypto = webcrypto;
const { encryptText, decryptText, bleEncode, bleDecode, nfcWrap, NFC_MAX, ITERATIONS, VERSION, MAX_TEXT_CHARS } = require('../core.js');

test('encrypts an X Messenger payload and restores the original text', async () => {
  const sealed = await encryptText('meet at the north gate at 09:00', 'glass comet cedar forest');
  assert.match(sealed, /^XM1\./);
  assert.equal(await decryptText(sealed, 'glass comet cedar forest'), 'meet at the north gate at 09:00');
});

test('rejects a wrong phrase and uses the configured work factor', async () => {
  const sealed = await encryptText('private', 'a properly long private phrase');
  await assert.rejects(decryptText(sealed, 'a different private phrase'));
  assert.equal(ITERATIONS, 600000);
});

test('keeps version fixed at 1.0.8 everywhere', () => {
  assert.equal(VERSION, '1.0.8');
  assert.equal(require('../package.json').version, '1.0.8');
  const fs = require('node:fs');
  const gradle = fs.readFileSync(require('node:path').join(__dirname, '..', 'android', 'app', 'build.gradle'), 'utf8');
  assert.ok(gradle.includes('versionName "1.0.8"'), 'android versionName must be 1.0.8');
  assert.ok(gradle.includes('versionCode 9'), 'android versionCode must be 9');
  const control = fs.readFileSync(require('node:path').join(__dirname, '..', 'packaging', 'debian', 'DEBIAN', 'control'), 'utf8');
  assert.ok(control.includes('Version: 1.0.8'), 'deb control must be 1.0.8');
});

test('round-trips unicode, emoji and punctuation', async () => {
  const text = 'Héllo — offline ✓ QR قمر 🌙 “XM1” test!';
  const sealed = await encryptText(text, 'four uncommon private words here');
  assert.equal(await decryptText(sealed, 'four uncommon private words here'), text);
});

test('each seal uses fresh salt and nonce', async () => {
  const a = await encryptText('same message', 'same shared phrase words here');
  const b = await encryptText('same message', 'same shared phrase words here');
  assert.notEqual(a, b);
  assert.equal(await decryptText(a, 'same shared phrase words here'), 'same message');
  assert.equal(await decryptText(b, 'same shared phrase words here'), 'same message');
});

test('rejects tampered ciphertext, salt and nonce', async () => {
  const sealed = await encryptText('tamper me', 'correct horse battery staple words');
  const body = sealed.slice(4);
  const last = body[body.length - 1] === 'A' ? 'B' : 'A';
  await assert.rejects(decryptText(sealed.slice(0, -1) + last, 'correct horse battery staple words'));
  await assert.rejects(decryptText('HELLO-WORLD', 'correct horse battery staple words'));
  await assert.rejects(decryptText('XM1.not-valid-base64!!!', 'correct horse battery staple words'));
});

test('rejects empty message, empty phrase and oversize input', async () => {
  await assert.rejects(encryptText('', 'some phrase here'));
  await assert.rejects(encryptText('hello', ''));
  await assert.rejects(encryptText('x'.repeat(MAX_TEXT_CHARS + 1), 'some phrase here'));
  await assert.rejects(decryptText('XM1.' + 'A'.repeat(40000), 'some phrase here'));
});

test('rejects wrong payload types', async () => {
  await assert.rejects(encryptText(123, 'phrase'));
  await assert.rejects(decryptText(null, 'phrase'));
});

test('duplicate delivery decrypts identically and truncation is rejected', async () => {
  const sealed = await encryptText('replayable delivery', 'duplicate delivery phrase words');
  assert.equal(await decryptText(sealed, 'duplicate delivery phrase words'), 'replayable delivery');
  assert.equal(await decryptText(sealed, 'duplicate delivery phrase words'), 'replayable delivery');
  await assert.rejects(decryptText(sealed.slice(0, Math.floor(sealed.length / 2)), 'duplicate delivery phrase words'));
  await assert.rejects(decryptText(sealed + 'A', 'duplicate delivery phrase words'));
});

test('BLE frames round-trip out of order with duplicates', async () => {
  const sealed = await encryptText('radio test message for bluetooth transfer', 'correct horse battery staple words');
  const frames = bleEncode(sealed);
  assert.ok(frames.length >= 1 && frames.every(f => f.startsWith('XMB.')));
  const shuffled = [...frames].reverse();
  shuffled.push(frames[0]);
  assert.equal(bleDecode(shuffled), sealed);
});

test('BLE frames reject tampering, truncation, and mixing', async () => {
  const sealed = await encryptText('tamper radio', 'correct horse battery staple words');
  const frames = bleEncode(sealed);
  const bad = frames.slice(1);
  if (bad.length) await assert.rejects(async () => bleDecode(bad), /Incomplete/);
  const flip = frames[0].slice(0, -1) + (frames[0].slice(-1) === 'A' ? 'B' : 'A');
  assert.throws(() => bleDecode([flip, ...frames.slice(1)]));
  assert.throws(() => bleDecode(['HELLO']));
  assert.throws(() => bleEncode('not-an-envelope'));
  const other = bleEncode(await encryptText('other', 'correct horse battery staple words'));
  // Same-total mixing passes frame checks (first-wins dedupe) but the mixed
  // envelope always fails XM1 authenticated decryption — defense in depth.
  const mixed = bleDecode([frames[0], ...other.slice(1)]);
  await assert.rejects(decryptText(mixed, 'correct horse battery staple words'));
  // Different totals are rejected at frame level.
  const long = bleEncode(await encryptText('x'.repeat(3000), 'correct horse battery staple words'));
  assert.ok(long.length !== frames.length);
  assert.throws(() => bleDecode([frames[0], long[0]]), /Mixed/);
});

test('NFC wraps short envelopes and refuses large ones', async () => {
  const small = await encryptText('hi', 'four uncommon private words here');
  assert.equal(nfcWrap(small), small);
  assert.ok(small.length <= NFC_MAX);
  const big = await encryptText('x'.repeat(8000), 'four uncommon private words here');
  assert.throws(() => nfcWrap(big), /Too big for NFC/);
  assert.throws(() => nfcWrap('XM0.not'), TypeError);
});
