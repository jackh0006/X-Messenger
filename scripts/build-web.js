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
console.log('Created offline app bundle in www/.');
