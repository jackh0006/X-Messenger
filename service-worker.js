const CACHE = 'x-messenger-offline-v3-retired';
const FILES = ['/', '/index.html', '/style.css', '/app.js', '/core.js', '/vendor/qrcode.min.js', '/vendor/jsQR.js', '/assets/icon.svg'];
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))).then(() => self.clients.claim())));
