// SPDX-License-Identifier: MIT
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'www');
const assets = [
  ['index.html', 'index.html'],
  ['style.css', 'style.css'],
  ['app.js', 'app.js'],
  ['core.js', 'core.js'],
  ['manifest.webmanifest', 'manifest.webmanifest'],
  ['service-worker.js', 'service-worker.js'],
  ['assets/icon.svg', 'assets/icon.svg'],
  ['node_modules/jsqr/dist/jsQR.js', 'vendor/jsQR.js'],
];

fs.rmSync(output, { recursive: true, force: true });
for (const [source, destination] of assets) {
  const from = path.join(root, source);
  const to = path.join(output, destination);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
execFileSync(path.join(root, 'node_modules/.bin/browserify'), ['node_modules/qrcode/lib/browser.js', '--standalone', 'QRCode', '--outfile', 'www/vendor/qrcode.min.js'], { cwd: root, stdio: 'inherit' });
// v2 WASM bridge (same audited Go core, compiled in). Rebuilt here so the
// shipped bytes always match the shipped source; the matching wasm_exec.js
// comes from the same toolchain that compiles it.
try {
  const goBin = process.env.XM2_GO_BIN || 'go';
  execFileSync(goBin, ['version'], { stdio: 'ignore' });
  execFileSync(goBin, ['build', '-trimpath', '-o', 'www/vendor/xm2.wasm', './cmd/xm2w'],
    { cwd: path.join(root, 'core'), stdio: 'inherit', env: { ...process.env, GOOS: 'js', GOARCH: 'wasm' } });
  const out = execFileSync(goBin, ['env', 'GOROOT'], { encoding: 'utf8' }).trim();
  for (const candidate of [path.join(out, 'lib', 'wasm', 'wasm_exec.js'), path.join(out, 'misc', 'wasm', 'wasm_exec.js')]) {
    if (fs.existsSync(candidate)) { fs.copyFileSync(candidate, path.join(output, 'vendor', 'wasm_exec.js')); break; }
  }
  if (!fs.existsSync(path.join(output, 'vendor', 'wasm_exec.js'))) throw new Error('wasm_exec.js not found in toolchain');
} catch (e) {
  if (!fs.existsSync(path.join(output, 'vendor', 'xm2.wasm'))) {
    throw new Error('Go >= 1.24 toolchain required to build xm2.wasm (or vendor a verified copy): ' + e.message);
  }
  console.log('warning: Go toolchain unavailable, keeping existing xm2.wasm');
}
console.log('Created offline app bundle in www/.');
