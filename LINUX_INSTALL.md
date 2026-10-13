# Install X Messenger on Debian / Ubuntu (by jackh0006)

The installed GUI opens in an app-style local window at `https://127.0.0.1`
on the first free local port. It is bound only to this device and has no
Internet route or proxy.

```bash
sudo apt install ./dist/X-Messenger-1.4.2-Linux-amd64.deb
# arm64: dist/X-Messenger-1.4.2-Linux-arm64.deb
# armhf: dist/X-Messenger-1.4.2-Linux-armhf.deb
```

Then open **X Messenger** from the application menu (`Super` key, type
`X Messenger`), or run:

```bash
x-messenger gui
x-messenger gui --port 8443
x-messenger-cli encrypt "private message"
x-messenger-cli decrypt "XM1.…"
```

No icon on the desktop background is normal: Ubuntu/GNOME shows new apps
only in the app grid. Right-click the icon and choose **Add to Favorites**
for the dock, or copy it to the desktop and allow launching:

```bash
cp /usr/share/applications/x-messenger.desktop ~/Desktop/
gio set ~/Desktop/x-messenger.desktop metadata::trusted true
chmod +x ~/Desktop/x-messenger.desktop
# If the grid still hides it:
update-desktop-database ~/.local/share/applications
gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor || true
```

The first CLI command asks for the shared phrase with hidden input. The package depends on `nodejs`; `apt` installs it when needed. If `443` needs privilege, use `x-messenger gui --port 8443` or `x-messenger setup`.
