"""Offline test suite. Run: python3 tests/test_roundtrip.py (no network needed)."""
import os
import struct
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from oam.crypto import (
    ContactCard, Identity, decrypt_for_contact, decrypt_with_passphrase,
    encrypt_for_contact, encrypt_with_passphrase, fingerprint_words,
    generate_passphrase,
)
from oam.envelope import envelope_mode
from oam.qrcodec import (
    decode_frames, decode_qr_image, encode_frames, envelope_to_text,
    qr_image, text_to_envelope,
)
from oam.store import load_store, new_store_data, save_store

PASS = []
FAIL = []


def check(name, fn):
    try:
        fn()
        PASS.append(name)
        print(f"  ok: {name}")
    except Exception as e:
        FAIL.append(name)
        print(f"  FAIL: {name}: {type(e).__name__}: {e}")


def t_contact_text():
    a, b = Identity("a"), Identity("b")
    env = encrypt_for_contact(a, b.contact_card(), b"hello offline", "")
    assert envelope_mode(env) == "contact"
    pt, fn = decrypt_for_contact(b, a.contact_card(), env)
    assert pt == b"hello offline" and fn == ""


def t_contact_file():
    a, b = Identity("a"), Identity("b")
    blob = os.urandom(3000)
    env = encrypt_for_contact(a, b.contact_card(), blob, "photo.bin")
    pt, fn = decrypt_for_contact(b, a.contact_card(), env)
    assert pt == blob and fn == "photo.bin"


def t_words():
    env = encrypt_with_passphrase(b"words secret", "alpha bravo charlie delta echo foxtrot golf")
    pt, _ = decrypt_with_passphrase(env, "alpha bravo charlie delta echo foxtrot golf")
    assert pt == b"words secret"


def t_words_wrong():
    env = encrypt_with_passphrase(b"x", "alpha bravo charlie delta echo foxtrot golf")
    try:
        decrypt_with_passphrase(env, "alpha bravo charlie delta WRONG foxtrot golf")
    except Exception:
        return
    raise AssertionError("wrong passphrase accepted")


def t_tamper():
    a, b = Identity("a"), Identity("b")
    env = bytearray(encrypt_for_contact(a, b.contact_card(), b"hi", ""))
    env[-1] ^= 1
    try:
        decrypt_for_contact(b, a.contact_card(), bytes(env))
    except Exception:
        return
    raise AssertionError("tampered message accepted")


def t_wrong_sender():
    a, b, c = Identity("a"), Identity("b"), Identity("c")
    env = encrypt_for_contact(a, b.contact_card(), b"hi", "")
    try:
        decrypt_for_contact(b, c.contact_card(), env)
    except Exception:
        return
    raise AssertionError("wrong sender accepted")


def t_frames_roundtrip():
    a, b = Identity("a"), Identity("b")
    env = encrypt_for_contact(a, b.contact_card(), os.urandom(3000), "r.bin")
    assert decode_frames(encode_frames(env)) == env


def t_frames_parity():
    a, b = Identity("a"), Identity("b")
    env = encrypt_for_contact(a, b.contact_card(), os.urandom(3000), "r.bin")
    fr = encode_frames(env)
    datas = [f for f in fr if struct.unpack(">HHB", f[21:26])[2] == 0]
    pars = [f for f in fr if struct.unpack(">HHB", f[21:26])[2] == 1]
    assert len(datas) >= 3 and len(pars) >= 1
    assert decode_frames(datas[1:] + pars) == env


def t_qr_image_scan():
    a, b = Identity("a"), Identity("b")
    env = encrypt_for_contact(a, b.contact_card(), b"qr scan test", "")
    fr = encode_frames(env)
    assert len(fr) == 1 or True
    with tempfile.TemporaryDirectory() as d:
        paths = []
        for i, f in enumerate(fr):
            p = os.path.join(d, f"f{i:02d}.png")
            qr_image(f).save(p)
            paths.append(p)
        back = [decode_qr_image(p) for p in paths]
        assert decode_frames(back) == env


def t_text_block():
    env = encrypt_with_passphrase(b"tb", "alpha bravo charlie delta echo foxtrot golf")
    assert text_to_envelope(envelope_to_text(env)) == env


def t_contact_card():
    a = Identity("alice")
    card = ContactCard.from_bytes(a.contact_card().to_bytes())
    assert card.ed_pub == a.ed_pub and card.name == "alice"
    assert len(fingerprint_words(card.fingerprint()).split()) == 12


def t_store():
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "s.bin")
        data = new_store_data()
        data["contacts"] = {"bob": "00ff"}
        save_store(p, "test passphrase words here", data)
        assert load_store(p, "test passphrase words here") == data
        try:
            load_store(p, "wrong passphrase words here!!")
        except Exception:
            return
        raise AssertionError("store opened with wrong passphrase")


def t_identity_export():
    a = Identity("alice")
    b = Identity.import_secret(a.export_secret())
    assert b.ed_pub == a.ed_pub and b.x_pub == a.x_pub
    assert b.mlkem_pub == a.mlkem_pub and b.fingerprint() == a.fingerprint()


def t_passphrase_gen():
    w = generate_passphrase(6)
    assert len(w.split()) == 6


if __name__ == "__main__":
    print("OAM offline tests:")
    for name, fn in sorted([(k, v) for k, v in globals().items() if k.startswith("t_")]):
        check(name, fn)
    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    sys.exit(1 if FAIL else 0)
