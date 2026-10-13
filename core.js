// SPDX-License-Identifier: MIT
(function (root) {
  const VERSION = '1.4.2';
  const ITERATIONS = 600000;
  const MAX_TEXT_CHARS = 8000;
  // Largest padded bucket is 16384 bytes; 4 bytes hold the length prefix.
  const MAX_TEXT_BYTES = 16380;
  const MAX_PAYLOAD_CHARS = 32768;
  const AAD_V1 = 'XMessenger/1';
  const AAD_V2 = 'XMessenger/2';
  const AAD_VAULT = 'XMessenger/vault1';
  const VAULT_FORMAT = 'XMV1.';
  // History blobs are local files, never QR: generous but bounded cap keeps
  // PBKDF2/AEAD work finite on hostile input.
  const MAX_VAULT_BYTES = 2 * 1024 * 1024;
  const encoder = new TextEncoder();
  // Never silently replace malformed UTF-8 in decrypted content.  A malformed
  // plaintext is an invalid transfer, not a message with substituted bytes.
  const decoder = new TextDecoder('utf-8', { fatal: true });
  // The largest bucket keeps the complete base64 transfer below the parser's
  // hard size limit.  It also bounds PBKDF2/AEAD work on hostile input.
  // Fixed buckets also reduce plaintext-length leakage (100-pt #31).
  const PAD_BUCKETS = [256, 512, 1024, 2048, 4096, 8192, 16384];
  const b64url = (bytes) => {
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  const fromB64url = (value) => {
    if (typeof value !== 'string' || !/^[A-Za-z0-9\-_]*$/.test(value) || value.length === 0) {
      throw new Error('Unsupported transfer format.');
    }
    try {
      const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
      return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    } catch {
      throw new Error('Unsupported transfer format.');
    }
  };
  const randomBytes = (length) => {
    const c = (typeof crypto !== 'undefined' && crypto) || (root.crypto) || globalThis.crypto;
    if (!c || typeof c.getRandomValues !== 'function') {
      throw new Error('Secure random generator unavailable on this device/browser. Update WebView/browser and retry.');
    }
    return c.getRandomValues(new Uint8Array(length));
  };
  function subtle() {
    const c = (typeof crypto !== 'undefined' && crypto) || root.crypto || globalThis.crypto;
    if (!c || !c.subtle || typeof c.subtle.importKey !== 'function') {
      throw new Error('WebCrypto unavailable: update Android System WebView/Chrome (v90+) or use a current browser.');
    }
    return c.subtle;
  }

  function paddedPlaintext(text) {
    const plain = encoder.encode(text);
    const required = plain.length + 4;
    const bucket = PAD_BUCKETS.find((size) => size >= required);
    if (!bucket) throw new Error('Message is too long to seal.');
    const out = randomBytes(bucket);
    new DataView(out.buffer).setUint32(0, plain.length, false);
    out.set(plain, 4);
    plain.fill(0);
    return out;
  }

  function unpadPlaintext(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 4 || !PAD_BUCKETS.includes(bytes.length)) {
      throw new Error('Unsupported transfer format.');
    }
    const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
    if (length > bytes.length - 4) throw new Error('Unsupported transfer format.');
    return decoder.decode(bytes.subarray(4, 4 + length));
  }

  async function keyFor(phrase, salt, usages) {
    const material = await subtle().importKey('raw', encoder.encode(phrase), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, usages);
  }

  async function encryptText(text, phrase) {
    if (typeof text !== 'string' || typeof phrase !== 'string') throw new TypeError('Text and phrase must be strings.');
    if (text.length === 0) throw new Error('Enter a message to seal.');
    if (text.length > MAX_TEXT_CHARS) throw new Error(`Message too long: keep it under ${MAX_TEXT_CHARS} characters; use a shorter message.`);
    // Count bytes, not UTF-16 units: emoji/CJK can be 3-4 bytes per char and
    // would otherwise pass the char cap but overflow the largest pad bucket.
    if (encoder.encode(text).length > MAX_TEXT_BYTES) throw new Error(`Message too long in bytes: keep UTF-8 under ${MAX_TEXT_BYTES} bytes (shorten emoji/CJK or split the transfer).`);
    if (phrase.length === 0) throw new Error('A shared phrase is required.');
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await keyFor(phrase, salt, ['encrypt']);
    const plain = paddedPlaintext(text);
    try {
      const encrypted = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(AAD_V2) }, key, plain));
      return 'XM1.' + b64url(encoder.encode(JSON.stringify({ v: 2, kdf: 'PBKDF2-SHA256', i: ITERATIONS, s: b64url(salt), n: b64url(iv), c: b64url(encrypted) })));
    } finally {
      plain.fill(0);
      salt.fill(0);
      iv.fill(0);
    }
  }

  async function decryptText(payload, phrase) {
    if (typeof payload !== 'string' || typeof phrase !== 'string') throw new TypeError('Payload and phrase must be strings.');
    if (!payload.startsWith('XM1.')) throw new Error('This is not an X Messenger transfer.');
    if (payload.length > MAX_PAYLOAD_CHARS + 4) throw new Error('Unsupported transfer format.');
    if (phrase.length === 0) throw new Error('A shared phrase is required.');
    let data;
    try {
      data = JSON.parse(decoder.decode(fromB64url(payload.slice(4))));
    } catch {
      throw new Error('Unsupported transfer format.');
    }
    if (!data || (data.v !== 1 && data.v !== 2) || data.kdf !== 'PBKDF2-SHA256' || data.i !== ITERATIONS) throw new Error('Unsupported transfer format.');
    if (typeof data.s !== 'string' || typeof data.n !== 'string' || typeof data.c !== 'string') throw new Error('Unsupported transfer format.');
    const salt = fromB64url(data.s);
    const iv = fromB64url(data.n);
    const ciphertext = fromB64url(data.c);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length === 0) throw new Error('Unsupported transfer format.');
    const key = await keyFor(phrase, salt, ['decrypt']);
    try {
      const aad = data.v === 2 ? AAD_V2 : AAD_V1;
      const plain = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(aad) }, key, ciphertext));
      try {
        return data.v === 2 ? unpadPlaintext(plain) : decoder.decode(plain);
      } finally {
        plain.fill(0);
      }
    } catch {
      throw new Error('Could not decrypt: incorrect phrase or altered / unsupported transfer.');
    } finally {
      try { ciphertext.fill(0); salt.fill(0); iv.fill(0); } catch {}
    }
  }
  root.XMessengerCrypto = { encryptText, decryptText, vaultSeal, vaultOpen, ITERATIONS, MAX_TEXT_CHARS, MAX_TEXT_BYTES, MAX_PAYLOAD_CHARS, MAX_VAULT_BYTES, VERSION };

  // ---- Encrypted on-device history vault (same primitives, no new crypto)
  // vaultSeal(value, phrase) -> 'XMV1.…' (salt+nonce fresh per seal).
  // vaultOpen(payload, phrase) -> the original value. Wrong passphrase or
  // any altered byte fails closed. Plaintext value must be JSON-serializable.
  async function vaultSeal(value, phrase) {
    if (typeof phrase !== 'string' || phrase.length === 0) throw new Error('A vault passphrase is required.');
    let raw;
    try { raw = encoder.encode(JSON.stringify(value)); }
    catch { throw new Error('History cannot be stored.'); }
    if (raw.length > MAX_VAULT_BYTES) throw new Error('History too large to lock (cap reached — delete old messages).');
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await keyFor(phrase, salt, ['encrypt']);
    try {
      const encrypted = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(AAD_VAULT) }, key, raw));
      return VAULT_FORMAT + b64url(encoder.encode(JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', i: ITERATIONS, s: b64url(salt), n: b64url(iv), c: b64url(encrypted) })));
    } finally {
      raw.fill(0); salt.fill(0); iv.fill(0);
    }
  }

  async function vaultOpen(payload, phrase) {
    if (typeof payload !== 'string' || typeof phrase !== 'string') throw new TypeError('Payload and passphrase must be strings.');
    if (!payload.startsWith(VAULT_FORMAT)) throw new Error('Not an X Messenger vault.');
    if (phrase.length === 0) throw new Error('A vault passphrase is required.');
    let data;
    try {
      data = JSON.parse(decoder.decode(fromB64url(payload.slice(VAULT_FORMAT.length))));
    } catch {
      throw new Error('Unsupported vault format.');
    }
    if (!data || data.v !== 1 || data.kdf !== 'PBKDF2-SHA256' || data.i !== ITERATIONS) throw new Error('Unsupported vault format.');
    if (typeof data.s !== 'string' || typeof data.n !== 'string' || typeof data.c !== 'string') throw new Error('Unsupported vault format.');
    const salt = fromB64url(data.s);
    const iv = fromB64url(data.n);
    const ciphertext = fromB64url(data.c);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length === 0 || ciphertext.length > MAX_VAULT_BYTES + 1024) throw new Error('Unsupported vault format.');
    const key = await keyFor(phrase, salt, ['decrypt']);
    try {
      const raw = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(AAD_VAULT) }, key, ciphertext));
      try {
        return JSON.parse(decoder.decode(raw));
      } finally {
        raw.fill(0);
      }
    } catch {
      throw new Error('Could not unlock: wrong passphrase or altered vault.');
    } finally {
      try { ciphertext.fill(0); salt.fill(0); iv.fill(0); } catch {}
    }
  }
  if (typeof module !== 'undefined') module.exports = root.XMessengerCrypto;
})(typeof globalThis !== 'undefined' ? globalThis : window);
