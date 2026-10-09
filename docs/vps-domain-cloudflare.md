# Your domain for X Messenger — like writing your house address on an envelope

Think of your VPS like a house far away. A domain like `msg.example.com`
is the house address so friends can find it. This guide shows every tiny
step, like teaching a 5-year-old.

## What you need (your shopping list)

1. A VPS (a small computer in the sky, e.g. Ubuntu 24.04).
2. A domain you own (e.g. `example.com`). We will make `msg.example.com`.
3. Cloudflare account (free) — like a phone book for the internet.

## Step 1 — Buy the house (VPS) and know its number

1. Buy a VPS. Write down its IP number, like `1.2.3.4`.
 It looks like four numbers with dots. That is your house number.
2. Open the doors you need (like opening windows):
 ```bash
 sudo ufw allow 22/tcp
 sudo ufw allow 80/tcp
 sudo ufw allow 443/tcp
 sudo ufw enable
 ```
 - `22` = your secret key door (SSH, only you).
 - `80` = the postman knocks here once to prove the house is yours.
 - `443` = the normal safe door everyone uses (looks like every website).

## Step 2 — Write the address in the Cloudflare phone book

1. Go to Cloudflare → Add your domain `example.com`.
2. Cloudflare gives you 2 nameserver names. Copy them to your domain
 seller (where you bought `example.com`). Wait 5 minutes.
3. In Cloudflare → DNS → Add record:
 - Type: `A`, Name: `msg`, Content: `1.2.3.4`, Proxy: **OFF / grey cloud
 (DNS only)**. TTL: Auto.
 - Why grey cloud OFF? Orange cloud means Cloudflare opens your letter
 and reads it before giving it to friends. Grey cloud means the letter
 goes straight to your house. For secret letters, use grey cloud.
4. Check the address works (like calling the house):
 ```bash
 dig +short msg.example.com
 # must print 1.2.3.4
 ```

## Step 3 — Get the magic sticker (Let's Encrypt certificate)

A certificate is like a magic sticker that says "this house is really
msg.example.com". Browsers trust stickers from Let's Encrypt.

On your VPS:
```bash
sudo apt update && sudo apt install -y certbot
sudo certbot certonly --standalone -d msg.example.com
# type your email when asked; agree with Y
```

If port 80 is busy, use the web server way:
```bash
sudo certbot certonly --nginx -d msg.example.com
```

Copy the sticker to X Messenger's pocket:
```bash
sudo install -m 600 /etc/letsencrypt/live/msg.example.com/privkey.pem \
 ~/.local/share/x-messenger/tls/vps-msg.example.com-privkey.pem
sudo install -m 644 /etc/letsencrypt/live/msg.example.com/fullchain.pem \
 ~/.local/share/x-messenger/tls/vps-msg.example.com-fullchain.pem
```

Make the sticker renew forever (like watering a plant):
```bash
sudo sh -c 'echo "0 3 * * * root certbot renew --quiet --deploy-hook \"install -m 600 /etc/letsencrypt/live/msg.example.com/privkey.pem /home/YOU/.local/share/x-messenger/tls/vps-msg.example.com-privkey.pem; install -m 644 /etc/letsencrypt/live/msg.example.com/fullchain.pem /home/YOU/.local/share/x-messenger/tls/vps-msg.example.com-fullchain.pem\"" > /etc/cron.d/x-messenger-cert'
```
Replace `YOU` with your Linux username and `msg.example.com` with yours.

## Step 4 — Tell X Messenger your address

On your VPS:
```bash
x-messenger setup
# Port: 443 (normal door, needs one-time key below)
# Mode: 3 (vps)
# Domain: msg.example.com
```

Port 443 is a special low door (under 1024). Give Node one key once:
```bash
sudo setcap cap_net_bind_service=+ep $(readlink -f $(which node))
```
Or use systemd with `AmbientCapabilities=CAP_NET_BIND_SERVICE`.
If you cannot, use `8443` + a helper (Nginx/Caddy) that moves 443 → 8443.

Start:
```bash
x-messenger gui --vps --domain msg.example.com --port 443
```

Open in a browser: `https://msg.example.com` (no `:443` needed, that is
the normal door). Check Settings → Connection shows your domain +
green sticker info (SHA256 fingerprint, dates, SAN).

## Step 5 — Friends compare the sticker (very important)

1. On the VPS: `x-messenger gui --cert-info` → writes a long code
 like `AA:BB:CC:...`. That is the sticker fingerprint.
2. Tell friends this code **in person or by voice you trust**.
3. Friends open Settings → TLS certificate → compare every letter.
 If even one letter is different: STOP. Someone is pretending.

## Subdomains (more rooms in the same house)

- `msg.example.com` = your main GUI room. Start with this.
- Want a second room later? Add `A qr → same IP`, get a second sticker
 with `-d qr.example.com`. One sticker per room is cleanest.

## If something breaks (boo-boos)

- `dig` shows wrong IP → wait 5 min, check Cloudflare grey cloud.
- Browser says "not secure" → sticker missing/expired: re-run certbot copy step.
- `Permission denied on 443` → run the `setcap` line again after Node updates.
- `Domain invalid` → use only letters, numbers, dots, dashes, like
 `msg.example.com` (no `http://`, no spaces).

## Remember (big truth)

- Friends see the address `msg.example.com` and the house IP. The
 postman (provider/DNS/network) sees letters going in and out and how
 big they are. But your **message words inside stay locked** with XM1
 (only people with the shared phrase can read them).
- Never turn on orange cloud if you want secret letters end-to-end.
