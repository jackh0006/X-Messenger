#!/usr/bin/env python3
"""OAM offline CLI. No network. All transport is QR images / .oam files / text blocks.

Examples:
  oam gen-id --name alice --out alice.id
  oam my-qr --id alice.id --out alice-contact.png
  oam add-contact --id alice.id --qr bob-contact.png --name bob
  oam send --id alice.id --to bob --msg 'hello' --out msg/
  oam send-words --msg 'hello' --words '...' --out msg/
  oam recv --id bob.id --frame msg/frame_00.png --frame msg/frame_01.png
  oam recv-words --frame msg/frame_00.png --words '...'
"""
from __future__ import annotations

import argparse
import base64
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from oam.crypto import (  # noqa: E402
    ContactCard, Identity, decrypt_for_contact, decrypt_with_passphrase,
    encrypt_for_contact, encrypt_with_passphrase, fingerprint_words,
    generate_passphrase,
)
from oam.qrcodec import (  # noqa: E402
    decode_frames, decode_qr_image, encode_frames, envelope_to_text,
    qr_image, text_to_envelope,
)


def _load_id(path: str) -> Identity:
    with open(path) as f:
        return Identity.import_secret(json.load(f))


def _save_id(path: str, ident: Identity):
    with open(path, "w") as f:
        json.dump(ident.export_secret(), f, indent=2)
    os.chmod(path, 0o600)


def _contacts_path(id_path: str) -> str:
    return id_path + ".contacts.json"


def _load_contacts(id_path: str) -> dict:
    p = _contacts_path(id_path)
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return {}


def _save_contacts(id_path: str, contacts: dict):
    with open(_contacts_path(id_path), "w") as f:
        json.dump(contacts, f, indent=2)


def cmd_gen_id(a):
    ident = Identity(a.name)
    _save_id(a.out, ident)
    print(f"identity '{a.name}' -> {a.out}")
    print("fingerprint (verify in person):")
    print(" ", fingerprint_words(ident.fingerprint()))


def cmd_my_qr(a):
    ident = _load_id(a.id)
    card = ident.contact_card().to_bytes()
    if a.text:
        print(envelope_to_text(card))
    else:
        frames = encode_frames(card)
        if len(frames) > 1:
            print(f"contact card needs {len(frames)} frames; saving dir {a.out}")
            os.makedirs(a.out, exist_ok=True)
            for i, fr in enumerate(frames):
                qr_image(fr).save(os.path.join(a.out, f"contact_{i:02d}.png"))
        else:
            qr_image(frames[0]).save(a.out)
            print(f"contact QR -> {a.out}")
    print("SAS words:", fingerprint_words(ident.fingerprint()))


def _read_card_source(a) -> bytes:
    if a.text_block:
        blob = a.text_block
        if os.path.exists(blob):
            blob = open(blob).read()
        try:
            return text_to_envelope(blob)
        except Exception:
            pass
        return base64.urlsafe_b64decode(blob)
    frames = []
    for pat in a.qr or []:
        for path in sorted(glob.glob(pat)):
            frames.append(decode_qr_image(path))
    if not frames:
        print("no QR input given", file=sys.stderr)
        sys.exit(2)
    if len(frames) == 1 and frames[0][:4] != b"OAMQ":
        return frames[0]  # raw envelope (contact card fits one frame incl header? no -> frames)
    # try frame reassembly, else single raw
    try:
        return decode_frames(frames)
    except Exception:
        if len(frames) == 1:
            return frames[0]
        raise


def cmd_add_contact(a):
    raw = _read_card_source(a)
    card = ContactCard.from_bytes(raw)
    contacts = _load_contacts(a.id)
    contacts[a.name or card.name] = card.to_bytes().hex()
    _save_contacts(a.id, contacts)
    print(f"added contact '{a.name or card.name}'")
    print("VERIFY SAS words in person:", fingerprint_words(card.fingerprint()))


def _read_input_file(a) -> tuple[bytes, str]:
    if a.file:
        with open(a.file, "rb") as f:
            return f.read(), os.path.basename(a.file)
    return (a.msg or "").encode(), ""


def cmd_send(a):
    ident = _load_id(a.id)
    contacts = _load_contacts(a.id)
    if a.to not in contacts:
        print(f"unknown contact '{a.to}'", file=sys.stderr)
        sys.exit(2)
    card = ContactCard.from_bytes(bytes.fromhex(contacts[a.to]))
    data, fname = _read_input_file(a)
    env = encrypt_for_contact(ident, card, data, fname)
    _emit(env, a)


def cmd_send_words(a):
    data, fname = _read_input_file(a)
    words = a.words or generate_passphrase(6)
    if not a.words:
        print("ONE-TIME passphrase (share via separate offline channel):")
        print(" ", words)
    env = encrypt_with_passphrase(data, words, fname)
    _emit(env, a)


def _emit(env: bytes, a):
    frames = encode_frames(env)
    if a.text:
        print(envelope_to_text(env))
        return
    os.makedirs(a.out, exist_ok=True)
    for i, fr in enumerate(frames):
        p = os.path.join(a.out, f"frame_{i:02d}.png")
        qr_image(fr).save(p)
    print(f"wrote {len(frames)} QR frame(s) -> {a.out}/")
    if a.text_out:
        with open(a.text_out, "w") as f:
            f.write(envelope_to_text(env))


def _read_frames(a) -> bytes:
    if a.text_block:
        blob = a.text_block
        if os.path.exists(blob):
            blob = open(blob).read()
        return text_to_envelope(blob)
    frames = []
    for pat in a.frame or []:
        for path in sorted(glob.glob(pat)):
            frames.append(decode_qr_image(path))
    if not frames:
        print("no input frames", file=sys.stderr)
        sys.exit(2)
    if len(frames) == 1:
        try:
            return decode_frames(frames)
        except Exception:
            return frames[0]
    return decode_frames(frames)


def cmd_recv(a):
    ident = _load_id(a.id)
    env = _read_frames(a)
    contacts = _load_contacts(a.id)
    # try every known contact as sender (offline; small sets)
    for name, hexcard in contacts.items():
        try:
            pt, fname = decrypt_for_contact(
                ident, ContactCard.from_bytes(bytes.fromhex(hexcard)), env)
            _print_msg(pt, fname, a, via=f"contact:{name}")
            return
        except Exception:
            continue
    print("FAILED: no known sender key decrypts this (wrong card or tampered).", file=sys.stderr)
    sys.exit(1)


def cmd_recv_words(a):
    env = _read_frames(a)
    try:
        pt, fname = decrypt_with_passphrase(env, a.words)
    except Exception:
        print("FAILED: wrong words or tampered message.", file=sys.stderr)
        sys.exit(1)
    _print_msg(pt, fname, a, via="passphrase")


def _print_msg(pt: bytes, fname: str, a, via: str):
    print(f"[via {via}] file={fname or '-'} bytes={len(pt)}")
    if fname and a.out_dir:
        os.makedirs(a.out_dir, exist_ok=True)
        with open(os.path.join(a.out_dir, os.path.basename(fname)), "wb") as f:
            f.write(pt)
        print(f"saved -> {a.out_dir}/{fname}")
    else:
        try:
            print(pt.decode())
        except UnicodeDecodeError:
            if a.out_dir:
                os.makedirs(a.out_dir, exist_ok=True)
                with open(os.path.join(a.out_dir, "msg.bin"), "wb") as f:
                    f.write(pt)
                print("binary saved -> msg.bin")
            else:
                print(pt.hex()[:200] + "...")


def main():
    ap = argparse.ArgumentParser(prog="oam", description="Offline air-gapped messenger")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("gen-id"); s.add_argument("--name", required=True); s.add_argument("--out", required=True)
    s.set_defaults(f=cmd_gen_id)
    s = sub.add_parser("my-qr"); s.add_argument("--id", required=True); s.add_argument("--out", default="contact.png"); s.add_argument("--text", action="store_true")
    s.set_defaults(f=cmd_my_qr)
    s = sub.add_parser("add-contact"); s.add_argument("--id", required=True); s.add_argument("--qr", action="append", default=[]); s.add_argument("--name", default=""); s.add_argument("--text-block", default="")
    s.set_defaults(f=cmd_add_contact)
    s = sub.add_parser("send"); s.add_argument("--id", required=True); s.add_argument("--to", required=True); s.add_argument("--msg", default=""); s.add_argument("--file", default=""); s.add_argument("--out", default="out"); s.add_argument("--text", action="store_true"); s.add_argument("--text-out", default="")
    s.set_defaults(f=cmd_send)
    s = sub.add_parser("send-words"); s.add_argument("--msg", default=""); s.add_argument("--file", default=""); s.add_argument("--words", default=""); s.add_argument("--out", default="out"); s.add_argument("--text", action="store_true"); s.add_argument("--text-out", default="")
    s.set_defaults(f=cmd_send_words)
    s = sub.add_parser("recv"); s.add_argument("--id", required=True); s.add_argument("--frame", action="append", default=[]); s.add_argument("--text-block", default=""); s.add_argument("--out-dir", default="")
    s.set_defaults(f=cmd_recv)
    s = sub.add_parser("recv-words"); s.add_argument("--frame", action="append", default=[]); s.add_argument("--text-block", default="", required=False); s.add_argument("--words", required=True); s.add_argument("--out-dir", default="")
    s.set_defaults(f=cmd_recv_words)
    a = ap.parse_args()
    # normalize add-contact qr alias
    if a.cmd == "add-contact":
        a.qr = a.qr
    a.f(a)


if __name__ == "__main__":
    main()
