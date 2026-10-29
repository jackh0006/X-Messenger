// SPDX-License-Identifier: MIT
// Writes build-info.json (git SHA + UTC date). Generated at package time,
// never committed: every window and CLI can then prove which commit serves.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
let commit = 'unknown', dirty = false;
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  // Tracked modifications only: pre-existing untracked dirs must not taint
  // the stamp. Untracked files we created are either committed or ignored.
  try { execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { cwd: root, stdio: 'ignore' }); }
  catch { dirty = true; }
} catch {}
const info = {
  version: require(path.join(root, 'package.json')).version,
  commit: dirty ? `${commit}-dirty` : commit,
  date: new Date().toISOString(),
};
fs.writeFileSync(path.join(root, 'build-info.json'), JSON.stringify(info, null, 2));
console.log(`build-info: ${info.version} ${info.commit} ${info.date}`);
