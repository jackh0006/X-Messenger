// SPDX-License-Identifier: MIT
// Cross-platform paths + helpers shared by bin/cipherlink and server.js.
// Linux/macOS keep XDG/HOME layout; Windows uses APPDATA/LOCALAPPDATA.
// No secrets here — only directory resolution and safe chmod.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const PLATFORM = process.platform; // 'linux' | 'win32' | 'darwin' | ...
const IS_WINDOWS = PLATFORM === 'win32';
const IS_MAC = PLATFORM === 'darwin';

function homeDir() {
  try {
    const h = os.homedir();
    if (h && typeof h === 'string' && h.length) return h;
  } catch {}
  return process.env.HOME || process.env.USERPROFILE || '.';
}

function dataBase() {
  // Writable per-user app data root (no admin required).
  if (process.env.XDG_DATA_HOME && process.env.XDG_DATA_HOME.length) return process.env.XDG_DATA_HOME;
  if (IS_WINDOWS) {
    const appData = process.env.APPDATA;
    if (appData && appData.length) return path.join(appData, 'x-messenger');
    return path.join(homeDir(), 'AppData', 'Roaming', 'x-messenger');
  }
  if (IS_MAC) return path.join(homeDir(), 'Library', 'Application Support');
  return path.join(homeDir(), '.local', 'share');
}

function appDataDir() {
  if (IS_WINDOWS && (process.env.APPDATA || '').length) {
    // dataBase() already includes x-messenger on Windows
    return dataBase();
  }
  return path.join(dataBase(), 'x-messenger');
}

function tlsDir() {
  return path.join(appDataDir(), 'tls');
}

function guiPrefsFile() {
  return path.join(appDataDir(), 'gui.json');
}

function recipientsFile() {
  return path.join(appDataDir(), 'recipients.json');
}

function chromeProfileDir() {
  if (IS_WINDOWS) {
    const local = process.env.LOCALAPPDATA || path.join(homeDir(), 'AppData', 'Local');
    return path.join(local, 'x-messenger', 'chrome-app-profile');
  }
  return path.join(appDataDir(), 'chrome-app-profile');
}

function nssDbDir() {
  // Linux/macOS Chromium/Firefox NSS DB. Windows uses the OS cert store instead.
  if (IS_WINDOWS) return null;
  return path.join(homeDir(), '.pki', 'nssdb');
}

function safeChmod(file, mode) {
  // chmod is POSIX-only; on Windows rely on per-user profile ACLs.
  if (IS_WINDOWS) return;
  try { fs.chmodSync(file, mode); } catch {}
}

function safeMkdir(dir, mode) {
  fs.mkdirSync(dir, { recursive: true, ...(IS_WINDOWS ? {} : { mode }) });
}

function browserCandidates() {
  const list = [];
  if (process.env.BROWSER) list.push(process.env.BROWSER);
  if (IS_WINDOWS) {
    // Edge is preinstalled on Win10/11; Chrome paths cover per-user + machine installs.
    list.push(
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'msedge.exe',
      'chrome.exe',
      'chromium.exe'
    );
  } else if (IS_MAC) {
    list.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'google-chrome', 'chromium', 'chromium-browser'
    );
  } else {
    list.push('google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge');
  }
  return list;
}

function v2demoBinary(root) {
  // Per-OS/arch Go demo binary name. Linux keeps legacy name for compat.
  const arch = process.arch; // x64 | arm64 | arm | ia32
  if (IS_WINDOWS) {
    if (arch === 'arm64') return path.join(root, 'core', 'v2demo-windows-arm64.exe');
    return path.join(root, 'core', 'v2demo-windows-amd64.exe');
  }
  if (IS_MAC) {
    if (arch === 'arm64') return path.join(root, 'core', 'v2demo-macos-arm64');
    return path.join(root, 'core', 'v2demo-macos-amd64');
  }
  if (arch === 'arm64') return path.join(root, 'core', 'v2demo-linux-arm64');
  if (arch === 'arm' || arch === 'ia32') return path.join(root, 'core', 'v2demo-linux-armhf');
  return path.join(root, 'core', 'v2demo-linux-amd64');
}

function systemTrustHint(caCert) {
  if (IS_WINDOWS) {
    return [
      'Windows trust (one-time, no admin for CurrentUser):',
      `  certutil -user -addstore Root "${caCert}"`,
      'Or double-click the CA file → Install Certificate → Current User → Trusted Root.',
      'Remove anytime: certutil -user -delstore Root "X Messenger Local CA"',
    ].join('\n');
  }
  if (IS_MAC) {
    return [
      'macOS trust (one-time):',
      `  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${caCert}"`,
      'Remove anytime: sudo security delete-certificate -c "X Messenger Local CA"',
    ].join('\n');
  }
  return [
    'System store (one-time, your sudo):',
    `  sudo install -m 644 ${caCert} /usr/local/share/ca-certificates/x-messenger-local-ca.crt && sudo update-ca-certificates`,
    'Remove anytime: sudo rm -f /usr/local/share/ca-certificates/x-messenger-local-ca.crt && sudo update-ca-certificates --fresh',
  ].join('\n');
}

function privilegedPortHint() {
  if (IS_WINDOWS) return 'Privileged port: use 1024+ (e.g. 8443), or run once as Administrator for 443.';
  if (IS_MAC) return 'Privileged port: use 1024+ (e.g. 8443), or run with sudo once for 443.';
  return 'Privileged port: sudo setcap cap_net_bind_service=+ep $(readlink -f $(which node)) or use 1024+ (e.g. 8443).';
}

module.exports = {
  PLATFORM, IS_WINDOWS, IS_MAC,
  homeDir, dataBase, appDataDir, tlsDir, guiPrefsFile, recipientsFile,
  chromeProfileDir, nssDbDir, safeChmod, safeMkdir,
  browserCandidates, v2demoBinary, systemTrustHint, privilegedPortHint,
};
