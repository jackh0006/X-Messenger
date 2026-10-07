"""Encrypted local store: contacts + messages + identity, sealed at rest.

File layout: magic b'OAMS' | ver | scrypt-salt(16) | nonce(12) | AES-256-GCM ct
Key: scrypt(device passphrase, salt, n=2**15, r=8, p=1) — lighter than the
message Argon2id so app unlock is fast; messages themselves use Argon2id.
"""
from __future__ import annotations

import hashlib
import json
import os
import time

STORE_MAGIC = b"OAMS"
STORE_VER = 0x01


class StoreError(Exception):
    pass


def _stretch(passphrase: str, salt: bytes) -> bytes:
    # n=2**14 (~16 MiB) so OpenSSL default memory limits accept it everywhere;
    # message keys still use Argon2id-64MiB. Store wrapping is not the bottleneck.
    return hashlib.scrypt(passphrase.encode(), salt=salt, n=2**14, r=8, p=1,
                          dklen=32, maxmem=64 * 1024 * 1024)


def save_store(path: str, passphrase: str, data: dict) -> None:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    salt = os.urandom(16)
    nonce = os.urandom(12)
    key = _stretch(passphrase, salt)
    raw = json.dumps(data, ensure_ascii=False).encode()
    ct = AESGCM(key).encrypt(nonce, raw, STORE_MAGIC + bytes([STORE_VER]))
    key = b"\x00" * 32
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(STORE_MAGIC + bytes([STORE_VER]) + salt + nonce + ct)
    os.replace(tmp, path)


def load_store(path: str, passphrase: str) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.exceptions import InvalidTag
    try:
        with open(path, "rb") as f:
            blob = f.read()
        assert blob[:4] == STORE_MAGIC and blob[4] == STORE_VER
        salt, nonce, ct = blob[5:21], blob[21:33], blob[33:]
        key = _stretch(passphrase, salt)
        try:
            raw = AESGCM(key).decrypt(nonce, ct, STORE_MAGIC + bytes([STORE_VER]))
        finally:
            key = b"\x00" * 32
        return json.loads(raw.decode())
    except InvalidTag as e:
        raise StoreError("wrong passphrase or corrupt store") from e
    except StoreError:
        raise
    except Exception as e:
        raise StoreError("cannot open store") from e


def new_store_data() -> dict:
    return {"identity": None, "contacts": {}, "messages": [], "created": int(time.time())}
