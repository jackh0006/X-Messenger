# Install X Messenger on Debian / Ubuntu

The installed GUI opens in an app-style local window at `https://127.0.0.1`
on the first free local port. It is bound only to this device and has no
Internet route or proxy.

```bash
sudo apt install ./X-Messenger-Linux.deb
```

Then open **X Messenger** from the application menu, or run:

```bash
x-messenger gui
x-messenger-cli encrypt "private message"
x-messenger-cli decrypt "XM1.…"
```

The first CLI command asks for the shared phrase with hidden input. The package depends on `nodejs`; `apt` installs it when needed.
