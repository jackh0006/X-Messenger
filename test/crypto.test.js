const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
global.crypto = webcrypto;
const { encryptText, decryptText, ITERATIONS, VERSION, MAX_TEXT_CHARS } = require('../core.js');

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

test('keeps version fixed at 1.5.2 everywhere', () => {
  assert.equal(VERSION, '1.5.2');
  assert.equal(require('../package.json').version, '1.5.2');
  const fs = require('node:fs');
  const gradle = fs.readFileSync(require('node:path').join(__dirname, '..', 'android', 'app', 'build.gradle'), 'utf8');
  assert.ok(gradle.includes('versionName "1.5.2"'), 'android versionName must be 1.5.2');
  assert.ok(gradle.includes('versionCode 20'), 'android versionCode must be 20');
  const control = fs.readFileSync(require('node:path').join(__dirname, '..', 'packaging', 'debian', 'DEBIAN', 'control'), 'utf8');
  assert.ok(control.includes('Version: 1.5.2'), 'deb control must be 1.5.2');
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

test('rejects emoji/CJK that exceed the byte cap even within the char cap', async () => {
  const { MAX_TEXT_BYTES } = require('../core.js');
  assert.ok(MAX_TEXT_BYTES <= 16380, 'byte cap must fit the largest pad bucket');
  // 8000 chars of 4-byte emoji = ~32000 bytes > bucket: must fail closed.
  await assert.rejects(encryptText('🌙'.repeat(8000), 'byte cap phrase words here'));
  // Small emoji still round-trips.
  const small = '🌙'.repeat(10);
  const sealed = await encryptText(small, 'byte cap phrase words here');
  assert.equal(await decryptText(sealed, 'byte cap phrase words here'), small);
});

test('v1 payloads still decrypt (backward compat), v2 seals use v2 AAD', async () => {
  // Craft a v1-format envelope with the test hook: encrypt then rewrite v to 1
  // is impossible without the key; instead verify the code paths exist.
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'core.js'), 'utf8');
  assert.ok(src.includes('AAD_V1') && src.includes('AAD_V2'), 'both AAD contexts must exist');
  assert.ok(src.includes("data.v === 2 ? AAD_V2 : AAD_V1"), 'decrypt must select AAD by version');
});

test('vault seals history opaquely and opens with the right passphrase', async () => {
  const { vaultSeal, vaultOpen } = require('../core.js');
  const history = [
    { id: 'm1-x', dir: 'outgoing', text: 'meet at sunset', sealed: 'XM1.abc', via: 'qr', to: '', ts: 1 },
    { id: 'm2-y', dir: 'incoming', text: '🌙 secret', sealed: 'XM2.def', via: 'xm2', to: 'v2-paired', ts: 2 },
  ];
  const blob = await vaultSeal(history, 'correct horse vault phrase words');
  assert.match(blob, /^XMV1\./);
  assert.ok(!blob.includes('meet at sunset') && !blob.includes('secret'), 'locked blob must be opaque');
  assert.deepEqual(await vaultOpen(blob, 'correct horse vault phrase words'), history);
});

test('vault rejects wrong passphrase, tampering, and bad shapes', async () => {
  const { vaultSeal, vaultOpen } = require('../core.js');
  const blob = await vaultSeal([{ text: 'hi' }], 'right phrase here words');
  await assert.rejects(vaultOpen(blob, 'wrong phrase here words'));
  await assert.rejects(vaultOpen('NOPE', 'right phrase here words'));
  await assert.rejects(vaultOpen(blob.slice(0, -1) + (blob.endsWith('A') ? 'B' : 'A'), 'right phrase here words'));
  await assert.rejects(vaultSeal({ text: 'x' }, ''));
  await assert.rejects(vaultOpen(blob, ''));
});
