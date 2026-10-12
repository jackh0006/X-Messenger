// SPDX-License-Identifier: MIT
// Functional gate for the v2 WASM pair (v1.3.1 fix).
// Proves, outside any browser, that the shipped www/vendor/xm2.wasm +
// www/vendor/wasm_exec.js load together, register the bridge, and answer.
// A version-skewed pair (e.g. Go 1.22 runtime x Go 1.24 module) loads but
// never registers — exactly the "engine ran but exposed no bridge" failure.
// Usage: node scripts/check-wasm-pair.js [www-dir]
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const www = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www'));
  const wasmPath = path.join(www, 'vendor', 'xm2.wasm');
  const rtPath = path.join(www, 'vendor', 'wasm_exec.js');
  for (const f of [wasmPath, rtPath]) {
    if (!fs.existsSync(f)) throw new Error(`missing bundle file: ${f}. Run: npm run build:web`);
  }
  // wasm_exec.js assigns globalThis.Go; it needs a browser-ish global.
  // Node provides what the runtime touches (crypto.getRandomValues, performance).
  require(rtPath);
  if (typeof Go === 'undefined') throw new Error('wasm_exec.js did not define Go');
  const go = new Go();
  const bytes = fs.readFileSync(wasmPath);
  if (bytes.subarray(0, 4).toString('binary') !== '\0asm') throw new Error('xm2.wasm is not a WebAssembly module');
  const mod = await WebAssembly.instantiate(bytes, go.importObject);
  const inst = mod.instance || mod;
  const errors = [];
  const onRej = (e) => errors.push((e && e.reason && e.reason.message) || (e && e.message) || String(e));
  process.on('unhandledRejection', onRej);
  go.run(inst);
  const deadline = Date.now() + 15000;
  while (typeof globalThis.xm2 === 'undefined' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  process.removeListener('unhandledRejection', onRej);
  if (typeof globalThis.xm2 === 'undefined') {
    throw new Error(`BRIDGE ABSENT after run (runtime+module skewed?). Go errors: ${errors.join('; ') || 'none'}`);
  }
  // Self-test: fingerprint of a fixed split must return 64 hex chars.
  const a = Buffer.from('00'.repeat(32), 'hex').toString('base64url');
  const b = Buffer.from('ff'.repeat(32), 'hex').toString('base64url');
  const raw = globalThis.xm2.fingerprint(JSON.stringify({ a, b }));
  const out = JSON.parse(raw);
  if (out.error) throw new Error(`bridge answered with error: ${out.error}`);
  const hex = String(out.hex || '');
  // FingerprintHex: first 24 bytes as 6 groups of 8 hex (see core/handshake.go).
  if (!/^[0-9a-f]{8}(-[0-9a-f]{8}){5}$/.test(hex)) throw new Error(`bad fingerprint shape: ${out.hex}`);
  console.log(`wasm-pair OK: bridge registered, self-test fingerprint ${out.hex.slice(0, 17)}…`);
  // Toolchain-consistency: the runtime must come from the same toolchain
  // family that built the module (see scripts/build-web.js pin). A skewed
  // pair can load in some engines yet never register on real devices.
  const stampPath = path.join(www, 'vendor', 'BUILD');
  if (!fs.existsSync(stampPath)) throw new Error('vendor/BUILD stamp missing — rebuild with: npm run build:web');
  const stamp = fs.readFileSync(stampPath, 'utf8');
  const tool = stamp.match(/toolchain: go version go1\.(\d+)/);
  if (!tool) throw new Error('vendor/BUILD has no toolchain line');
  const modText = bytes.toString('latin1');
  const modStamp = modText.match(/go1\.(\d+)\.\d+/);
  if (!modStamp) throw new Error('xm2.wasm has no embedded Go stamp — not a Go build?');
  if (modStamp[1] !== tool[1]) {
    throw new Error(`SKEWED PAIR: module built by go1.${modStamp[1]}, runtime from go1.${tool[1]} (vendor/BUILD). Rebuild with the pinned toolchain.`);
  }
  console.log(`pair consistent: module + runtime from go1.${tool[1]} family`);
}

main().then(
  () => process.exit(0),
  (e) => { console.error(`wasm-pair FAIL: ${e.message}`); process.exit(1); },
);
