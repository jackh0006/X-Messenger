# X Messenger gateway (optional) — v1.1.0

The default is the **offline core**: `x-messenger gui` serves
`https://127.0.0.1:443` loopback-only in a separate `--app` window.
Nothing leaves the device. Use that unless you have a reason not to.

The **gateway** is opt-in. It serves the same local bundle over TLS so a
second device on your network — or your own server — can open it. The
messages themselves stay XM1 end-to-end encrypted; the gateway only moves
ciphertext. IP/domain, port, timing and sizes stay observable — see below.

## Pick one (like picking shoes)

1. **This device (default, safest).** `https://127.0.0.1:443`, zero egress.
   `x-messenger gui` — if 443 is taken you are asked for another port.
2. **LAN IP + custom port.** Encrypted TLS, but routers see LAN IP/port/sizes.
   `x-messenger gui --lan --port 8443` (needs on-screen consent).
   Compare the cert fingerprint in person (`gui --cert-info`).
3. **Your domain (VPS).** Normal HTTPS on `443` (or a custom port) with a
   Let's Encrypt cert. Provider/DNS/network see domain+IP+sizes, never words.
   `x-messenger gui --vps --domain msg.example.com [--port 443]`
   Keep Cloudflare grey-cloud (DNS-only) for end-to-end.
4. **Your IP (VPS, no domain).** `https://<server-ip>:<port>` with a
   self-provisioned cert you pin in the invite. Same observability as (3)
   minus DNS. Use a high custom port (e.g. `8443`) unless you hold 443.

Details live in `docs/vps-domain-cloudflare.md` and
`docs/vps-private-mode.md`. Read them before exposing anything.

## Honest picture

| Who | Sees |
| --- | ---- |
| LAN/VPS provider, DNS, ISP/DPI | IP/domain, port, timing, sizes. Never words (TLS + XM1). |
| TLS-terminating proxy (orange cloud) | Everything — avoid for secrets. |
| Anyone with your shared phrase | Everything — exchange phrases in person, never reuse. |

## Rules

- Phrase never lives on the server. Type it only on your own devices.
- Gateway certs: LAN uses the device-local CA leaf; VPS domain uses Let's
  Encrypt (`gui --cert-info` shows fingerprints — compare before trusting).
- Back to safety anytime: `x-messenger gui --loopback`.
- No software is unhackable; this build needs an independent audit before
  high-risk use. See `SECURITY.md`.
