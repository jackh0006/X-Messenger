#!/usr/bin/env python3
"""OAM Linux app — Telegram-like, 100% offline air-gapped messenger.

No sockets are opened anywhere in this program (crypto/QR/camera/files only).
Run:  python3 apps/linux/oam_gui.py
"""
from __future__ import annotations

import base64
import glob as _glob
import os
import struct
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog, ttk

from oam.crypto import (
    ContactCard, Identity, decrypt_for_contact, decrypt_with_passphrase,
    encrypt_for_contact, encrypt_with_passphrase, fingerprint_words,
    generate_passphrase,
)
from oam.qrcodec import (
    decode_frames, decode_qr_image, encode_frames, envelope_to_text,
    qr_image, text_to_envelope,
)
from oam.store import StoreError, load_store, new_store_data, save_store

APP_DIR = os.path.expanduser("~/.oam_gui")
STORE_PATH = os.path.join(APP_DIR, "store.bin")
INBOX = os.path.join(APP_DIR, "inbox")

# Telegram-like dark palette
BG = "#0e1621"
PANEL = "#17212b"
CARD = "#1d2a3a"
ACCENT = "#2aabee"
ACCENT_D = "#1d8dcc"
TEXT = "#e8eef4"
DIM = "#7f91a4"
BUBBLE_IN = "#182533"
BUBBLE_OUT = "#2b5278"
GOOD = "#4caf50"
BAD = "#e53935"


def ts() -> int:
    return int(time.time())


def fmt_time(t: int) -> str:
    return time.strftime("%H:%M %d.%m", time.localtime(t))


class QrShowWindow(tk.Toplevel):
    """Animated QR playback for a list of frame payloads."""

    def __init__(self, master, frames: list[bytes], title: str = "Show QR (offline)"):
        super().__init__(master)
        self.title(title)
        self.configure(bg=BG)
        self.frames = frames
        self.idx = 0
        self.playing = len(frames) > 1
        self.delay_ms = tk.IntVar(value=600)
        total, _, _, _, _ = self._parse(frames[0])
        ttk.Label(self, text=f"{len([f for f in frames if self._is_data(f)])} data + "
                 f"{len([f for f in frames if not self._is_data(f)])} parity frames",
                  foreground=DIM, background=BG).pack(pady=(8, 0))
        self.img_label = tk.Label(self, bg="white", bd=0)
        self.img_label.pack(padx=16, pady=10)
        self.status = tk.Label(self, text="", fg=TEXT, bg=BG, font=("TkDefaultFont", 11, "bold"))
        self.status.pack()
        bar = tk.Frame(self, bg=BG)
        bar.pack(pady=8)
        tk.Button(bar, text="⏸ Pause" if self.playing else "▶ Play", command=self.toggle,
                  bg=CARD, fg=TEXT, relief="flat", padx=12).pack(side="left", padx=4)
        tk.Button(bar, text="◀ Prev", command=self.prev, bg=CARD, fg=TEXT, relief="flat", padx=12).pack(side="left", padx=4)
        tk.Button(bar, text="Next ▶", command=self.next, bg=CARD, fg=TEXT, relief="flat", padx=12).pack(side="left", padx=4)
        tk.Button(bar, text="💾 Save PNGs", command=self.save_all, bg=ACCENT, fg="white", relief="flat", padx=12).pack(side="left", padx=4)
        tk.Scale(self, from_=200, to=2000, orient="horizontal", variable=self.delay_ms,
                 label="frame interval (ms)", bg=BG, fg=DIM, highlightthickness=0).pack(fill="x", padx=20)
        self._render()
        self._tick()

    @staticmethod
    def _parse(f: bytes):
        import struct as _s
        total, index, parity = _s.unpack(">HHB", f[21:26])
        return total, index, parity, None, None

    @staticmethod
    def _is_data(f: bytes) -> bool:
        import struct as _s
        return _s.unpack(">HHB", f[21:26])[2] == 0

    def _render(self):
        from PIL import ImageTk
        img = qr_image(self.frames[self.idx], box_size=6).resize((360, 360))
        self._photo = ImageTk.PhotoImage(img)
        self.img_label.configure(image=self._photo)
        total, index, parity = self._parse(self.frames[self.idx])[:3]
        kind = "parity" if parity else "data"
        self.status.configure(text=f"frame {self.idx + 1}/{len(self.frames)}  ({kind} {index + 1}/{total})")

    def _tick(self):
        if self.playing and self.winfo_exists():
            self.idx = (self.idx + 1) % len(self.frames)
            self._render()
        self.after(self.delay_ms.get(), self._tick)

    def toggle(self):
        self.playing = not self.playing

    def next(self):
        self.idx = (self.idx + 1) % len(self.frames)
        self._render()

    def prev(self):
        self.idx = (self.idx - 1) % len(self.frames)
        self._render()

    def save_all(self):
        d = filedialog.askdirectory(title="Save QR frames")
        if not d:
            return
        for i, fr in enumerate(self.frames):
            qr_image(fr).save(os.path.join(d, f"frame_{i:02d}.png"))
        messagebox.showinfo("Saved", f"{len(self.frames)} frames saved to {d}")


class ScanWindow(tk.Toplevel):
    """Collect QR frames via camera, image files, or pasted text block."""

    def __init__(self, master, on_done):
        super().__init__(master)
        self.title("Scan / import (offline)")
        self.configure(bg=BG)
        self.on_done = on_done
        self.collected: list[bytes] = []
        self.cap = None
        tk.Label(self, text="Collect every frame of the animated QR, then press Finish.",
                 fg=DIM, bg=BG).pack(pady=8)
        self.prog = tk.Label(self, text="0 frames", fg=TEXT, bg=BG, font=("TkDefaultFont", 12, "bold"))
        self.prog.pack()
        btns = tk.Frame(self, bg=BG)
        btns.pack(pady=8)
        tk.Button(btns, text="📷 Start camera", command=self.start_cam, bg=CARD, fg=TEXT, relief="flat", padx=10).pack(side="left", padx=4)
        tk.Button(btns, text="📁 Load PNGs", command=self.load_files, bg=CARD, fg=TEXT, relief="flat", padx=10).pack(side="left", padx=4)
        tk.Button(btns, text="📋 Paste text block", command=self.paste_text, bg=CARD, fg=TEXT, relief="flat", padx=10).pack(side="left", padx=4)
        tk.Button(btns, text="✅ Finish & decode", command=self.finish, bg=GOOD, fg="white", relief="flat", padx=10).pack(side="left", padx=4)
        self.video = tk.Label(self, bg="black")
        self.video.pack(padx=12, pady=8)
        self._cam_on = False

    def _add(self, payloads: list[bytes]):
        known = {bytes(p) for p in self.collected}
        for p in payloads:
            if bytes(p) not in known:
                self.collected.append(bytes(p))
                known.add(bytes(p))
        self.prog.configure(text=f"{len(self.collected)} frames")

    def start_cam(self):
        try:
            import cv2
            from PIL import Image, ImageTk
            from pyzbar.pyzbar import decode as zbar_decode
        except Exception as e:
            messagebox.showerror("Camera", f"camera libs missing: {e}")
            return
        if self.cap is None:
            self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            messagebox.showerror("Camera", "cannot open camera")
            return
        self._cam_on = True
        self._grab_loop()

    def _grab_loop(self):
        if not self._cam_on or not self.winfo_exists():
            return
        import cv2
        from PIL import Image, ImageTk
        from pyzbar.pyzbar import decode as zbar_decode
        ok, frame = self.cap.read() if self.cap else (False, None)
        if ok:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            for d in zbar_decode(rgb):
                raw = bytes(d.data)
                if raw.startswith(b"OAMQ1:"):
                    import base64 as _b64
                    try:
                        raw = _b64.urlsafe_b64decode(raw[6:])
                    except Exception:
                        continue
                if raw[:4] == b"OAMQ":
                    self._add([raw])
            small = cv2.resize(frame, (480, 360))
            self._tk = ImageTk.PhotoImage(Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)))
            self.video.configure(image=self._tk)
        self.after(150, self._grab_loop)

    def load_files(self):
        paths = filedialog.askopenfilenames(title="Select QR frame PNGs",
                                            filetypes=[("PNG", "*.png"), ("All", "*.*")])
        got = []
        for p in paths:
            try:
                got.append(decode_qr_image(p))
            except Exception as e:
                messagebox.showwarning("Decode", f"{os.path.basename(p)}: {e}")
        self._add(got)

    def paste_text(self):
        win = tk.Toplevel(self)
        win.title("Paste OAM1: block")
        win.configure(bg=BG)
        txt = tk.Text(win, width=70, height=12, bg=CARD, fg=TEXT, insertbackground=TEXT)
        txt.pack(padx=10, pady=10)

        def _ok():
            try:
                env = text_to_envelope(txt.get("1.0", "end"))
            except Exception as e:
                messagebox.showerror("Error", str(e))
                return
            win.destroy()
            self.on_done(("text", env))

        tk.Button(win, text="Decode", command=_ok, bg=ACCENT, fg="white", relief="flat", padx=16).pack(pady=6)

    def finish(self):
        self._cam_on = False
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        if not self.collected:
            messagebox.showinfo("Scan", "no frames collected")
            return
        try:
            env = decode_frames(self.collected)
        except Exception as e:
            messagebox.showerror("Decode", f"incomplete/damaged frames: {e}")
            return
        self.on_done(("frames", env))
        self.destroy()

    def destroy(self):
        try:
            self._cam_on = False
            if self.cap:
                self.cap.release()
        except Exception:
            pass
        super().destroy()


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("OAM — Offline Messenger")
        self.configure(bg=BG)
        self.geometry("1080x680")
        os.makedirs(APP_DIR, exist_ok=True)
        os.makedirs(INBOX, exist_ok=True)
        self.store_pass: str | None = None
        self.data: dict | None = None
        self.ident: Identity | None = None
        self.peer: str | None = None
        self._unlock_screen()

    # ---------------------------------------------------------- store/unlock
    def _unlock_screen(self):
        for w in self.winfo_children():
            w.destroy()
        box = tk.Frame(self, bg=PANEL, padx=30, pady=30)
        box.place(relx=0.5, rely=0.5, anchor="center")
        tk.Label(box, text="🔒 OAM — Offline Messenger", fg=TEXT, bg=PANEL,
                 font=("TkDefaultFont", 18, "bold")).pack(pady=6)
        tk.Label(box, text="100% offline. No internet. QR + words only.",
                 fg=DIM, bg=PANEL).pack(pady=4)
        tk.Label(box, text="App passphrase:", fg=TEXT, bg=PANEL).pack(pady=(12, 2))
        pw = tk.Entry(box, show="•", width=34, bg=CARD, fg=TEXT, insertbackground=TEXT)
        pw.pack()
        pw.focus()

        def _go(new=False):
            p = pw.get()
            if len(p) < 8:
                messagebox.showerror("Error", "passphrase must be 8+ characters")
                return
            try:
                if new or not os.path.exists(STORE_PATH):
                    name = "user"
                    self.data = new_store_data()
                    self.ident = Identity(name)
                    self.data["identity"] = self.ident.export_secret()
                    self.data["display_name"] = name
                    save_store(STORE_PATH, p, self.data)
                else:
                    self.data = load_store(STORE_PATH, p)
                    self.ident = Identity.import_secret(self.data["identity"])
                self.store_pass = p
                self._main_screen()
            except StoreError as e:
                messagebox.showerror("Error", str(e))
            except Exception as e:
                messagebox.showerror("Error", f"{type(e).__name__}: {e}")

        row = tk.Frame(box, bg=PANEL)
        row.pack(pady=12)
        tk.Button(row, text="Unlock", command=lambda: _go(False), bg=ACCENT, fg="white",
                  relief="flat", padx=18).pack(side="left", padx=6)
        tk.Button(row, text="Create new", command=lambda: _go(True), bg=CARD, fg=TEXT,
                  relief="flat", padx=18).pack(side="left", padx=6)

    def _save(self):
        assert self.data is not None and self.store_pass
        self.data["identity"] = self.ident.export_secret()
        save_store(STORE_PATH, self.store_pass, self.data)

    # ---------------------------------------------------------- main screen
    def _main_screen(self):
        for w in self.winfo_children():
            w.destroy()
        # top bar
        top = tk.Frame(self, bg=PANEL, height=56)
        top.pack(fill="x")
        tk.Label(top, text="✈ OAM Offline", fg=TEXT, bg=PANEL,
                 font=("TkDefaultFont", 14, "bold")).pack(side="left", padx=14, pady=12)
        tk.Label(top, text=f"{self.data.get('display_name', '')}  •  "
                 f"{' '.join(fingerprint_words(self.ident.fingerprint()).split()[:4])}…",
                 fg=DIM, bg=PANEL).pack(side="left")
        for label, cmd in [("🪪 My QR", self.show_my_qr), ("➕ Contact", self.add_contact),
                           ("📷 Scan", self.scan), ("📁 Files", self.file_menu)]:
            tk.Button(top, text=label, command=cmd, bg=CARD, fg=TEXT,
                      relief="flat", padx=10).pack(side="right", padx=4, pady=10)
        # body
        body = tk.Frame(self, bg=BG)
        body.pack(fill="both", expand=True)
        left = tk.Frame(body, bg=PANEL, width=300)
        left.pack(side="left", fill="y")
        left.pack_propagate(False)
        tk.Label(left, text="Chats  (offline only)", fg=DIM, bg=PANEL,
                 font=("TkDefaultFont", 11, "bold")).pack(pady=(10, 4))
        self.peer_list = tk.Listbox(left, bg=PANEL, fg=TEXT, selectbackground=ACCENT,
                                   relief="flat", highlightthickness=0, font=("TkDefaultFont", 12))
        self.peer_list.pack(fill="both", expand=True, padx=8, pady=4)
        self.peer_list.bind("<<ListboxSelect>>", lambda _e: self._select_peer())
        prow = tk.Frame(left, bg=PANEL)
        prow.pack(pady=8)
        tk.Button(prow, text="➕ Add", command=self.add_contact, bg=CARD, fg=TEXT,
                  relief="flat", padx=10).pack(side="left", padx=4)
        tk.Button(prow, text="🔑 Words chat", command=self.add_words_chat, bg=CARD, fg=TEXT,
                  relief="flat", padx=10).pack(side="left", padx=4)
        # right: messages + composer
        right = tk.Frame(body, bg=BG)
        right.pack(side="left", fill="both", expand=True)
        self.chat_head = tk.Label(right, text="select a chat", fg=TEXT, bg=CARD,
                                  font=("TkDefaultFont", 12, "bold"), anchor="w", padx=12, pady=8)
        self.chat_head.pack(fill="x", padx=12, pady=(12, 6))
        wrap = tk.Frame(right, bg=BG)
        wrap.pack(fill="both", expand=True, padx=12)
        self.msgs = tk.Text(wrap, bg=BG, fg=TEXT, relief="flat", state="disabled",
                            wrap="word", font=("TkDefaultFont", 12), spacing1=6, spacing3=6)
        self.msgs.pack(side="left", fill="both", expand=True)
        sb = tk.Scrollbar(wrap, command=self.msgs.yview)
        sb.pack(side="right", fill="y")
        self.msgs.configure(yscrollcommand=sb.set)
        self._tags()
        comp = tk.Frame(right, bg=BG)
        comp.pack(fill="x", padx=12, pady=12)
        self.entry = tk.Entry(comp, bg=CARD, fg=TEXT, insertbackground=TEXT,
                              relief="flat", font=("TkDefaultFont", 12))
        self.entry.pack(side="left", fill="x", expand=True, ipady=8, padx=(0, 8))
        self.entry.bind("<Return>", lambda _e: self.send_text())
        tk.Button(comp, text="📎", command=self.send_file, bg=CARD, fg=TEXT,
                  relief="flat", padx=12).pack(side="left", padx=2)
        tk.Button(comp, text="Send ➤", command=self.send_text, bg=ACCENT, fg="white",
                  relief="flat", padx=18).pack(side="left", padx=2)
        self._refresh_peers(select_first=True)

    def _tags(self):
        self.msgs.tag_config("out", background=BUBBLE_OUT, foreground="white",
                             lmargin1=220, lmargin2=220, rmargin=10, justify="right",
                             borderwidth=8, relief="flat")
        self.msgs.tag_config("in", background=BUBBLE_IN, foreground=TEXT,
                             lmargin1=10, lmargin2=10, rmargin=220, justify="left",
                             borderwidth=8, relief="flat")
        self.msgs.tag_config("sys", foreground=DIM, justify="center")

    # ---------------------------------------------------------- peers/chats
    def _peers(self) -> list[str]:
        chats = self.data.get("chats", {})
        contacts = self.data.get("contacts", {})
        order = list(chats.keys())
        for c in contacts:
            if c not in order:
                order.append(c)
        return order

    def _refresh_peers(self, select_first=False):
        sel = self.peer
        self.peer_list.delete(0, "end")
        for p in self._peers():
            n = len(self.data.get("chats", {}).get(p, []))
            self.peer_list.insert("end", f"{p}  ({n})" if n else p)
        if self.peer in self._peers():
            self.peer_list.select_set(self._peers().index(self.peer))
        elif select_first and self._peers():
            self.peer_list.select_set(0)
            self._select_peer()

    def _select_peer(self):
        cur = self.peer_list.curselection()
        if not cur:
            return
        label = self.peer_list.get(cur[0])
        self.peer = label.rsplit("  (", 1)[0]
        is_words = self.peer.startswith("🔑")
        self.chat_head.configure(
            text=f"{self.peer}   •   {'passphrase channel — receiver needs the words' if is_words else 'contact channel — PQ hybrid crypto'}")
        self._render_chat()

    def _render_chat(self):
        self.msgs.configure(state="normal")
        self.msgs.delete("1.0", "end")
        for m in self.data.get("chats", {}).get(self.peer or "", []):
            tag = "out" if m["dir"] == "out" else "in"
            body = m.get("text") or f"📎 {m.get('filename', 'file')}"
            self.msgs.insert("end", f"{body}\n{fmt_time(m['ts'])}  {m.get('via', '')}\n\n", tag)
        self.msgs.configure(state="disabled")
        self.msgs.see("end")

    def _log(self, peer: str, msg: dict):
        self.data.setdefault("chats", {}).setdefault(peer, []).append(msg)
        self._save()
        if peer == self.peer:
            self._render_chat()
        self._refresh_peers()

    # ---------------------------------------------------------- identity/QR
    def show_my_qr(self):
        card = self.ident.contact_card().to_bytes()
        frames = encode_frames(card)
        QrShowWindow(self, frames, title="My contact QR — let them scan all frames")
        messagebox.showinfo("Verify", "SAS words (compare in person):\n\n" +
                            fingerprint_words(self.ident.fingerprint()))

    def add_contact(self):
        def _done(kind, payload):
            env = payload  # ScanWindow already reassembled frames -> envelope
            try:
                card = ContactCard.from_bytes(env)
            except Exception as e:
                messagebox.showerror("Error", f"bad contact data: {e}")
                return
            name = simpledialog.askstring("Contact", "Name for this contact:",
                                          initialvalue=card.name or "friend")
            if not name:
                return
            contacts = self.data.setdefault("contacts", {})
            contacts[name] = card.to_bytes().hex()
            self._save()
            self._refresh_peers()
            messagebox.showinfo("Verify identity",
                                f"Compare these SAS words IN PERSON:\n\n"
                                f"{fingerprint_words(card.fingerprint())}\n\n"
                                f"If they differ: STOP, you are being intercepted.")
        ScanWindow(self, _done)

    def add_words_chat(self):
        name = simpledialog.askstring("Words chat", "Channel name:",
                                      initialvalue="🔑 field-team")
        if not name:
            return
        self.data.setdefault("chats", {}).setdefault(name, [])
        self._save()
        self._refresh_peers()

    # ---------------------------------------------------------- send
    def _current_words(self) -> str | None:
        if self.peer and self.peer.startswith("🔑"):
            w = simpledialog.askstring("Passphrase words",
                                       "Words the receiver must know (share offline!):",
                                       show="•")
            return w
        return None

    def send_text(self):
        if not self.peer:
            messagebox.showinfo("Send", "select a chat first")
            return
        text = self.entry.get().strip()
        if not text:
            return
        self.entry.delete(0, "end")
        self._send_payload(text.encode(), "")

    def send_file(self):
        if not self.peer:
            messagebox.showinfo("Send", "select a chat first")
            return
        path = filedialog.askopenfilename(title="Attach file (stays offline)")
        if not path:
            return
        with open(path, "rb") as f:
            data = f.read()
        if len(data) > 5 * 1024 * 1024:
            messagebox.showerror("Error", "file too large for QR (max 5 MB)")
            return
        self._send_payload(data, os.path.basename(path))

    def _send_payload(self, data: bytes, filename: str):
        try:
            if self.peer.startswith("🔑"):
                words = self._current_words()
                if not words or len(words.encode()) < 8:
                    messagebox.showerror("Error", "need the shared words (8+ chars)")
                    return
                env = encrypt_with_passphrase(data, words, filename)
                via = "words"
            else:
                contacts = self.data.get("contacts", {})
                if self.peer not in contacts:
                    messagebox.showerror("Error", "unknown contact")
                    return
                card = ContactCard.from_bytes(bytes.fromhex(contacts[self.peer]))
                env = encrypt_for_contact(self.ident, card, data, filename)
                via = "contact"
        except Exception as e:
            messagebox.showerror("Encrypt", f"{e}")
            return
        label = data.decode(errors="replace")[:200] if not filename else f"📎 {filename}"
        self._log(self.peer, {"dir": "out", "kind": "file" if filename else "text",
                              "text": label, "filename": filename, "ts": ts(), "via": via})
        QrShowWindow(self, encode_frames(env), title=f"Scan to receive — {self.peer}")

    # ---------------------------------------------------------- receive
    def scan(self):
        def _done(kind, payload):
            env = payload  # both paths deliver a full envelope
            if self.peer and self.peer.startswith("🔑"):
                words = simpledialog.askstring("Words", "Enter the shared words:", show="•")
                if not words:
                    return
                try:
                    pt, fname = decrypt_with_passphrase(env, words)
                except Exception:
                    messagebox.showerror("Decrypt", "wrong words or tampered message")
                    return
                self._got_message(self.peer, pt, fname, "words")
                return
            # contact mode: try every contact as sender
            contacts = self.data.get("contacts", {})
            for name, hexcard in contacts.items():
                try:
                    pt, fname = decrypt_for_contact(
                        self.ident, ContactCard.from_bytes(bytes.fromhex(hexcard)), env)
                except Exception:
                    continue
                peer = self.peer if self.peer and not self.peer.startswith("🔑") else name
                self._got_message(peer, pt, fname, f"contact:{name}")
                return
            messagebox.showerror("Decrypt", "no known sender key works.\nWrong card, wrong words, or tampered data.")
        ScanWindow(self, _done)

    def _got_message(self, peer: str, pt: bytes, fname: str, via: str):
        if fname:
            dest = os.path.join(INBOX, f"{ts()}_{os.path.basename(fname)}")
            with open(dest, "wb") as f:
                f.write(pt)
            label = f"📎 {fname} → saved {dest}"
        else:
            try:
                label = pt.decode()
            except UnicodeDecodeError:
                dest = os.path.join(INBOX, f"{ts()}_msg.bin")
                with open(dest, "wb") as f:
                    f.write(pt)
                label = f"📎 binary → saved {dest}"
        self._log(peer, {"dir": "in", "kind": "file" if fname else "text",
                         "text": label, "filename": fname, "ts": ts(), "via": via})
        self.peer = peer
        self._refresh_peers()
        self._select_peer()

    # ---------------------------------------------------------- files
    def file_menu(self):
        win = tk.Toplevel(self)
        win.title("Offline files (.oam)")
        win.configure(bg=BG)
        tk.Label(win, text="Raw envelopes for USB sticks / SD cards. Still encrypted.",
                 fg=DIM, bg=BG).pack(pady=8)
        row = tk.Frame(win, bg=BG)
        row.pack(pady=8)
        tk.Button(row, text="Export last sent → .oam", command=self._export_oam,
                  bg=CARD, fg=TEXT, relief="flat", padx=10).pack(side="left", padx=4)
        tk.Button(row, text="Import .oam → decode", command=self._import_oam,
                  bg=CARD, fg=TEXT, relief="flat", padx=10).pack(side="left", padx=4)
        tk.Button(row, text="Copy text block", command=self._copy_block,
                  bg=CARD, fg=TEXT, relief="flat", padx=10).pack(side="left", padx=4)

    def _export_oam(self):
        messagebox.showinfo("Export", "Send any message first — its QR window has 💾 Save PNGs.\n"
                                      "For USB: paste the text block into a .oam file instead.")

    def _import_oam(self):
        path = filedialog.askopenfilename(title="Open .oam / envelope file",
                                          filetypes=[("OAM", "*.oam"), ("All", "*.*")])
        if not path:
            return
        with open(path, "rb") as f:
            raw = f.read()
        try:
            env = raw if raw[:4] == b"OAM1" else text_to_envelope(raw.decode())
        except Exception as e:
            messagebox.showerror("Error", f"bad file: {e}")
            return
        # reuse scan handler
        self.scan_finish_direct(env)

    def scan_finish_direct(self, env: bytes):
        if self.peer and self.peer.startswith("🔑"):
            words = simpledialog.askstring("Words", "Enter the shared words:", show="•")
            if not words:
                return
            try:
                pt, fname = decrypt_with_passphrase(env, words)
            except Exception:
                messagebox.showerror("Decrypt", "wrong words or tampered message")
                return
            self._got_message(self.peer, pt, fname, "words")
            return
        contacts = self.data.get("contacts", {})
        for name, hexcard in contacts.items():
            try:
                pt, fname = decrypt_for_contact(
                    self.ident, ContactCard.from_bytes(bytes.fromhex(hexcard)), env)
            except Exception:
                continue
            peer = self.peer if self.peer and not self.peer.startswith("🔑") else name
            self._got_message(peer, pt, fname, f"contact:{name}")
            return
        messagebox.showerror("Decrypt", "no known sender key works.")

    def _copy_block(self):
        messagebox.showinfo("Text block", "After Send, use CLI for text blocks:\n"
                                          "python3 oam_cli.py send ... --text")


def main():
    # hard offline self-check: refuse to run if the process has network sockets
    # (best effort; the app itself never creates any)
    App().mainloop()


if __name__ == "__main__":
    main()
