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

// Refuse to build if any shipped JavaScript has a syntax error. A single
// broken line here would make the whole UI inert (no click handlers, stuck
// "Generating ID..." screen), so fail the build before copying anything.
for (const [source] of assets) {
  if (!source.endsWith('.js')) continue;
  execFileSync(process.execPath, ['--check', path.join(root, source)], { stdio: 'inherit' });
}

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
//
// Toolchain pin (v1.3.1 fix): a version-skewed runtime+module pair loads but
// never registers its bridge ("engine ran but exposed no bridge"). So the
// toolchain MUST satisfy go.mod (>= 1.24): PATH `go` if new enough, else
// $HOME/sdk/go/bin/go, else XM2_GO_BIN. Anything else fails HARD — never
// silently keep stale bytes or mix runtimes.
function pickGo() {
  const { execFileSync } = require('node:child_process');
  const os = require('node:os');
  const fs = require('node:fs');
  const candidates = [];
  if (process.env.XM2_GO_BIN) candidates.push(process.env.XM2_GO_BIN);
  candidates.push('go', path.join(os.homedir(), 'sdk', 'go', 'bin', 'go'));
  for (const bin of candidates) {
    try {
      const v = execFileSync(bin, ['version'], { encoding: 'utf8' }).trim();
      const m = v.match(/go1\.(\d+)/);
      if (m && Number(m[1]) >= 24) return { bin, version: v };
      console.log(`build-web: rejecting ${bin} (${v.trim()}: needs go >= 1.24)`);
    } catch {}
  }
  return null;
}
const picked = pickGo();
if (!picked) {
  throw new Error('Go >= 1.24 toolchain required (PATH go, $HOME/sdk/go/bin/go, or XM2_GO_BIN). Refusing to ship a stale/skewed WASM pair.');
}
{
  const goBin = picked.bin;
  execFileSync(goBin, ['build', '-trimpath', '-o', path.join(output, 'vendor', 'xm2.wasm'), './cmd/xm2w'],
    { cwd: path.join(root, 'core'), stdio: 'inherit', env: { ...process.env, GOOS: 'js', GOARCH: 'wasm' } });
  const out = execFileSync(goBin, ['env', 'GOROOT'], { encoding: 'utf8' }).trim();
  for (const candidate of [path.join(out, 'lib', 'wasm', 'wasm_exec.js'), path.join(out, 'misc', 'wasm', 'wasm_exec.js')]) {
    if (fs.existsSync(candidate)) { fs.copyFileSync(candidate, path.join(output, 'vendor', 'wasm_exec.js')); break; }
  }
  if (!fs.existsSync(path.join(output, 'vendor', 'wasm_exec.js'))) throw new Error('wasm_exec.js not found in toolchain');
  // Pair stamp: proves runtime+module came from one toolchain. Checked by
  // scripts/check-wasm-pair.js and shipped for auditability.
  const crypto = require('node:crypto');
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
  fs.writeFileSync(path.join(output, 'vendor', 'BUILD'),
    `toolchain: ${picked.version}\nwasm: ${sha(path.join(output, 'vendor', 'xm2.wasm'))}\nruntime: ${sha(path.join(output, 'vendor', 'wasm_exec.js'))}\nbuilt: ${new Date().toISOString()}\n`);
}
console.log('Created offline app bundle in www/.');
