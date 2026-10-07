(function (root) {
  const VERSION = '1.0.2';
  const ITERATIONS = 600000;
  const MAX_TEXT_CHARS = 8000;
  const MAX_PAYLOAD_CHARS = 32768;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
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
  const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

  async function keyFor(phrase, salt, usages) {
    const material = await crypto.subtle.importKey('raw', encoder.encode(phrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, usages);
  }

  async function encryptText(text, phrase) {
    if (typeof text !== 'string' || typeof phrase !== 'string') throw new TypeError('Text and phrase must be strings.');
    if (text.length === 0) throw new Error('Enter a message to seal.');
    if (text.length > MAX_TEXT_CHARS) throw new Error(`Message too long: keep it under ${MAX_TEXT_CHARS} characters; use a shorter message.`);
    if (phrase.length === 0) throw new Error('A shared phrase is required.');
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await keyFor(phrase, salt, ['encrypt']);
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode('XMessenger/1') }, key, encoder.encode(text)));
    return 'XM1.' + b64url(encoder.encode(JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', i: ITERATIONS, s: b64url(salt), n: b64url(iv), c: b64url(encrypted) })));
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
    if (!data || data.v !== 1 || data.kdf !== 'PBKDF2-SHA256' || data.i !== ITERATIONS) throw new Error('Unsupported transfer format.');
    if (typeof data.s !== 'string' || typeof data.n !== 'string' || typeof data.c !== 'string') throw new Error('Unsupported transfer format.');
    const salt = fromB64url(data.s);
    const iv = fromB64url(data.n);
    const ciphertext = fromB64url(data.c);
    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length === 0) throw new Error('Unsupported transfer format.');
    const key = await keyFor(phrase, salt, ['decrypt']);
    try {
      const plain = decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode('XMessenger/1') }, key, ciphertext));
      return plain;
    } catch {
      throw new Error('Could not decrypt: incorrect phrase or altered / unsupported transfer.');
    } finally {
      try { ciphertext.fill(0); salt.fill(0); iv.fill(0); } catch {}
    }
  }
  root.XMessengerCrypto = { encryptText, decryptText, ITERATIONS, MAX_TEXT_CHARS, MAX_PAYLOAD_CHARS, VERSION };
  if (typeof module !== 'undefined') module.exports = root.XMessengerCrypto;
})(typeof globalThis !== 'undefined' ? globalThis : window);
