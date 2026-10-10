// SPDX-License-Identifier: MIT
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

// The app is served from the prebuilt, offline bundle. This also makes the
// Debian installation read-only and usable by an unprivileged desktop user.
const root = fs.existsSync(path.join(__dirname, 'www', 'index.html')) ? path.join(__dirname, 'www') : __dirname;
function loadGuiPrefs() {
  try {
    const home = process.env.XDG_DATA_HOME || path.join(process.env.HOME || '.', '.local', 'share');
    const raw = fs.readFileSync(path.join(home, 'x-messenger', 'gui.json'), 'utf8');
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : {};
  } catch { return {}; }
}
const prefs = loadGuiPrefs();
// Build stamp proves which commit serves (generated at package time).
function readBuildStamp() {
  for (const p of [path.join(root, 'build-info.json'), path.join(root, '..', 'build-info.json')]) {
    try {
      const info = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (info && info.commit) return { commit: info.commit, date: info.date || '' };
    } catch {}
  }
  return null;
}
function validDomain(d) {
  return typeof d === 'string' && /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?\.[a-z]{2,}$/i.test(d.trim()) && d.trim().length <= 253;
}
const rawBind = process.env.X_MESSENGER_BIND || prefs.bind || 'loopback';
const bindMode = rawBind === 'vps' ? 'vps' : rawBind === 'lan' ? 'lan' : 'loopback';
const domain = (process.env.X_MESSENGER_DOMAIN || prefs.domain || '').trim().toLowerCase();
if (bindMode === 'vps' && !validDomain(domain)) {
  throw new Error('VPS mode needs --domain msg.example.com with a valid public domain. Run: x-messenger setup');
}
// Default 443 everywhere (normal HTTPS). If taken, bin/cipherlink asks for
// another port before spawning; the increment below is only a safety net.
const DEFAULT_PORT = 443;
const requestedPort = Number.parseInt(process.env.X_MESSENGER_PORT || process.env.PORT || prefs.port || String(DEFAULT_PORT), 10);
const firstPort = Number.isInteger(requestedPort) && requestedPort >= 1 && requestedPort <= 65535 ? requestedPort : DEFAULT_PORT;
if (firstPort < 1024) console.warn(`Port ${firstPort} is privileged and needs root/capability (setcap or systemd AmbientCapabilities) or a 443→8443 proxy.`);
const host = bindMode === 'loopback' ? '127.0.0.1' : '0.0.0.0';
const advertiseHost = bindMode === 'vps' ? domain : bindMode === 'lan' ? (process.env.X_MESSENGER_LAN_IP || prefs.lanIp || 'LAN-IP') : '127.0.0.1';
const maxAttempts = 20;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const keyPath = process.env.X_MESSENGER_TLS_KEY;
const certPath = process.env.X_MESSENGER_TLS_CERT;
if (!keyPath || !certPath) throw new Error('X Messenger requires its local TLS certificate. Launch it through x-messenger gui.');
const server = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath), minVersion: 'TLSv1.2' }, (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end('Method not allowed'); return;
  }
  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (pathname.length > 256 || pathname.includes('\0')) { res.writeHead(400); res.end('Bad request'); return; }
  const normalized = path.posix.normalize(pathname);
  if (normalized === '/api/info') {
    try {
      const certPem = fs.readFileSync(certPath, 'utf8');
      const cert = new (require('node:crypto').X509Certificate)(certPem);
      const info = {
        version: '1.0.9', bind: bindMode, host: advertiseHost, port, domain: bindMode === 'vps' ? domain : undefined,
        build: readBuildStamp(),
        tls: { subject: cert.subject, issuer: cert.issuer, validFrom: cert.validFrom, validTo: cert.validTo, fingerprint256: cert.fingerprint256, san: cert.subjectAltName },
      };
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(info));
    } catch { res.writeHead(500); res.end('TLS info unavailable'); }
    return;
  }
  const allowed = new Set(['/', '/index.html', '/style.css', '/app.js', '/core.js', '/service-worker.js', '/manifest.webmanifest', '/assets/icon.svg', '/vendor/qrcode.min.js', '/vendor/jsQR.js']);
  if (!allowed.has(normalized)) { res.writeHead(404); res.end('Not found'); return; }
  const file = normalized === '/' ? '/index.html' : normalized;
  const target = path.resolve(root, `.${file}`);
  if (!target.startsWith(root + path.sep) && target !== path.join(root, 'index.html')) {
    res.writeHead(404); res.end('Not found'); return;
  }
  let stat;
  try { stat = fs.statSync(target); } catch { res.writeHead(404); res.end('Not found'); return; }
  if (!stat.isFile()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, {
    'Content-Type': types[path.extname(target)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'",
  });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(target).pipe(res);
});

let port = firstPort;
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && port < firstPort + maxAttempts) {
    port += 1;
    console.warn(`Port ${port - 1} is already in use; trying ${port}.`);
    server.listen(port, host);
    return;
  }
  console.error(`X Messenger could not start on ${host}:${port}: ${error.message}`);
  process.exitCode = 1;
});
server.on('listening', () => {
  const endpoint = bindMode === 'vps' ? `https://${domain}${port === 443 ? '' : `:${port}`}` : bindMode === 'lan' ? `https://${advertiseHost}:${port}` : `https://${host}:${port}`;
  if (process.env.X_MESSENGER_ENDPOINT_FILE) {
    fs.writeFileSync(process.env.X_MESSENGER_ENDPOINT_FILE, endpoint, { mode: 0o600 });
  }
  console.log(`X Messenger 1.0.9 running at ${endpoint} [bind=${bindMode}]`);
  if (bindMode === 'lan') console.warn('LAN mode: observable encrypted TLS on this network (IP/port/sizes visible). Compare cert fingerprint in person.');
  if (bindMode === 'vps') console.warn('VPS mode: provider/DNS/network see domain+IP+sizes; message content stays XM1 end-to-end. Keep Cloudflare grey-cloud (DNS-only) for E2E.');
});
server.listen(port, host);
