// SPDX-License-Identifier: MIT
// v1.4.2: desktop launcher + Windows .exe + builder purity gates.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('desktop entry is absolute, single-category, by jackh0006', () => {
  const d = read('packaging/debian/x-messenger.desktop');
  assert.ok(d.includes('Exec=/usr/bin/x-messenger gui'), 'Exec must be absolute');
  assert.ok(d.includes('TryExec=/usr/bin/x-messenger'), 'TryExec must exist');
  assert.ok(d.includes('Categories=Network;InstantMessaging;'), 'single main category');
  assert.ok(d.includes('jackh0006') || d.includes('X Messenger'), 'builder visible');
  assert.ok(!d.includes('Utility;Network'), 'dual-main categories gone');
});

test('deb ships postinst and prunes dev docs', () => {
  assert.ok(fs.existsSync(path.join(root, 'packaging/debian/DEBIAN/postinst')), 'postinst must exist');
  const sh = read('scripts/build-deb.sh');
  assert.ok(sh.includes('DEBIAN/postinst'), 'deb must install postinst');
  assert.ok(sh.includes('AGENTS.md'), 'deb must prune AGENTS.md');
  assert.ok(sh.includes('packaging/debian/DEBIAN'), 'deb must prune DEBIAN leakage');
  const gi = read('.gitignore');
  assert.ok(gi.includes('google-services.json'), 'firebase path must be ignored');
});

test('windows ships real .exe launchers (by jackh0006), x86 experimental documented', () => {
  assert.ok(fs.existsSync(path.join(root, 'core/cmd/xm-launcher/main.go')), 'Go launcher source must exist');
  const wsh = read('scripts/build-windows.sh');
  assert.ok(wsh.includes('X-Messenger-GUI-windows-$label.exe'), 'ZIPs must embed GUI .exe');
  assert.ok(wsh.includes('build_one x86 386'), 'x86 must be built');
  assert.ok(fs.existsSync(path.join(root, 'scripts/build-win-exe.sh')), 'exe/setup stage must exist');
  const nsi = read('packaging/windows/x-messenger.nsi');
  assert.ok(nsi.includes('-setup.exe'), 'NSIS setup.exe must be defined');
  const guide = read('WINDOWS_GUIDE.md');
  assert.ok(guide.includes('X-Messenger-GUI.exe'), '.exe launcher must be documented');
  assert.ok(guide.includes('x86'), 'x86 experimental must be documented');
});

test('no AI/OpenCode builder credit, jackh0006 only', () => {
  const files = ['package.json', 'README.md', 'index.html', 'WINDOWS_GUIDE.md', 'THIRD-PARTY-NOTICES.md'];
  const bad = /opencode|muse spark|anthropic|openai|chatgpt|copilot|\bclaude\b|gemini|deepseek|built by AI|by OpenCode/i;
  for (const f of files) assert.ok(!bad.test(read(f)), `${f} must have no AI builder credit`);
  assert.ok(read('package.json').includes('"author": "jackh0006"'), 'author must be jackh0006');
});
