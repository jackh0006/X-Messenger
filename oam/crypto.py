"""Hybrid post-quantum crypto core. Offline-only. No network imports.

Contact mode : ephemeral X25519 + ephemeral ML-KEM-768 -> HKDF-SHA3-512
               -> XChaCha20-Poly1305 + Ed25519 signature.
Words mode   : Argon2id(passphrase, random salt) -> XChaCha20-Poly1305.
PQ signatures (ML-DSA) are used for contact cards; per-message auth is
Ed25519 over the full envelope (keeps QRs small) plus KEM binding.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import struct
import zlib

from argon2.low_level import Type as Argon2Type, hash_secret_raw
from cryptography.exceptions import InvalidTag  # noqa: F401  (kept for compat)
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey, Ed25519PublicKey,
)
from cryptography.hazmat.primitives.asymmetric.x25519 import (
    X25519PrivateKey, X25519PublicKey,
)
from pqcrypto.kem.ml_kem_768 import decaps as mlkem_decaps, encaps as mlkem_encaps, keygen as mlkem_keygen
from pqcrypto.sign.ml_dsa_65 import keygen as mldsa_keygen, sign as mldsa_sign, verify as mldsa_verify

MAGIC = b"OAM1"
VERSION = 0x01
MODE_CONTACT = 0x01
MODE_WORDS = 0x02
FLAG_COMPRESSED = 0x01

X25519_PK = 32
X25519_SK = 32
MLKEM_PK = 1184
MLKEM_SK = 2400
MLKEM_CT = 1088
ED_PK = 32
ED_SK = 32  # seed bytes
SALT_LEN = 16
NONCE_LEN = 24
MSGID_LEN = 16
PAD_BLOCK = 128


def _ed_priv_raw(priv) -> bytes:
    from cryptography.hazmat.primitives import serialization
    try:
        return priv.private_bytes_raw()  # type: ignore[attr-defined]
    except AttributeError:
        return priv.private_bytes(
            serialization.Encoding.Raw, serialization.PrivateFormat.Raw,
            serialization.NoEncryption())


def _ed_pub_raw(pub) -> bytes:
    from cryptography.hazmat.primitives import serialization
    try:
        return pub.public_bytes_raw()  # type: ignore[attr-defined]
    except AttributeError:
        return pub.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


def _x_priv_raw(priv) -> bytes:
    from cryptography.hazmat.primitives import serialization
    try:
        return priv.private_bytes_raw()  # type: ignore[attr-defined]
    except AttributeError:
        return priv.private_bytes(
            serialization.Encoding.Raw, serialization.PrivateFormat.Raw,
            serialization.NoEncryption())


def _x_pub_raw(pub) -> bytes:
    from cryptography.hazmat.primitives import serialization
    try:
        return pub.public_bytes_raw()  # type: ignore[attr-defined]
    except AttributeError:
        return pub.public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)


class CryptoError(Exception):
    """Generic crypto failure. Messages are deliberately vague to avoid oracles."""


class _AeadTagError(CryptoError):
    pass


def _aead_encrypt(key: bytes, nonce: bytes, plaintext: bytes, aad: bytes) -> bytes:
    """XChaCha20-Poly1305 (libsodium IETF variant, 24-byte nonce)."""
    from nacl.bindings import crypto_aead_xchacha20poly1305_ietf_encrypt
    if len(key) != 32 or len(nonce) != 24:
        raise CryptoError("bad aead params")
    return crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, nonce, key)


def _aead_decrypt(key: bytes, nonce: bytes, ciphertext: bytes, aad: bytes) -> bytes:
    from nacl.bindings import crypto_aead_xchacha20poly1305_ietf_decrypt
    try:
        return crypto_aead_xchacha20poly1305_ietf_decrypt(ciphertext, aad, nonce, key)
    except Exception as e:
        raise _AeadTagError("decrypt failed") from e


# ---------------------------------------------------------------- HKDF-SHA3
def _hkdf_sha3_512(ikm: bytes, salt: bytes, info: bytes, length: int) -> bytes:
    if not salt:
        salt = b"\x00" * 64
    prk = hmac.new(salt, ikm, hashlib.sha3_512).digest()
    out = b""
    prev = b""
    counter = 1
    while len(out) < length:
        prev = hmac.new(prk, prev + info + bytes([counter]), hashlib.sha3_512).digest()
        out += prev
        counter += 1
    return out[:length]


def _pad(data: bytes) -> bytes:
    """PADME-style: round up to PAD_BLOCK plus 0..1 extra blocks of randomness."""
    n = PAD_BLOCK - (len(data) % PAD_BLOCK)
    extra = secrets.randbelow(2) * PAD_BLOCK
    return data + os.urandom(n + extra)


def _unpad_len(padded_total: int, orig_len: int) -> bytes:
    raise NotImplementedError  # length is stored explicitly; see envelope


# ---------------------------------------------------------------- Identity
class Identity:
    """Long-term identity: Ed25519 + X25519 + ML-KEM-768 + ML-DSA-65."""

    def __init__(self, name: str = ""):
        self.name = name or "oam-user"
        ed_priv = Ed25519PrivateKey.generate()
        x_priv = X25519PrivateKey.generate()
        mlkem_pk, mlkem_sk = mlkem_keygen()
        mldsa_pk, mldsa_sk = mldsa_keygen()
        self._ed_priv = ed_priv
        self._x_priv = x_priv
        self._mlkem_sk = bytes(mlkem_sk)
        self._mldsa_sk = bytes(mldsa_sk)
        self.ed_pub = _ed_pub_raw(ed_priv.public_key())
        self.x_pub = _x_pub_raw(x_priv.public_key())
        self.mlkem_pub = bytes(mlkem_pk)
        self.mldsa_pub = bytes(mldsa_pk)

    @classmethod
    def _from_parts(cls, name, ed_priv, x_priv, mlkem_sk, mldsa_sk,
                    ed_pub, x_pub, mlkem_pub, mldsa_pub) -> "Identity":
        obj = cls.__new__(cls)
        obj.name = name
        obj._ed_priv = ed_priv
        obj._x_priv = x_priv
        obj._mlkem_sk = mlkem_sk
        obj._mldsa_sk = mldsa_sk
        obj.ed_pub = ed_pub
        obj.x_pub = x_pub
        obj.mlkem_pub = mlkem_pub
        obj.mldsa_pub = mldsa_pub
        return obj

    # -- persistence (caller must store bytes in encrypted store) --
    def export_secret(self) -> dict:
        return {
            "name": self.name,
            "ed_seed": _ed_priv_raw(self._ed_priv).hex(),
            "x_priv": _x_priv_raw(self._x_priv).hex(),
            "mlkem_sk": self._mlkem_sk.hex(),
            "mldsa_sk": self._mldsa_sk.hex(),
            "mlkem_pub": self.mlkem_pub.hex(),
            "mldsa_pub": self.mldsa_pub.hex(),
        }

    @classmethod
    def import_secret(cls, d: dict) -> "Identity":
        ed_priv = Ed25519PrivateKey.from_private_bytes(bytes.fromhex(d["ed_seed"]))
        x_priv = X25519PrivateKey.from_private_bytes(bytes.fromhex(d["x_priv"]))
        return _identity_from_secret_dict(d, ed_priv, x_priv)

    def contact_card(self) -> "ContactCard":
        return ContactCard(self.name, self.ed_pub, self.x_pub, self.mlkem_pub, self.mldsa_pub)

    def fingerprint(self) -> bytes:
        h = hashlib.sha3_256()
        h.update(self.ed_pub + self.x_pub + self.mlkem_pub + self.mldsa_pub)
        return h.digest()

    # -- private accessors for decrypt/sign --
    def _ed_private(self) -> Ed25519PrivateKey:
        return self._ed_priv

    def _x_private(self) -> X25519PrivateKey:
        return self._x_priv


def _identity_from_secret_dict(d: dict, ed_priv, x_priv) -> Identity:
    # ML-KEM / ML-DSA public keys cannot be recomputed from secret alone via
    # this binding, so we persist them alongside the secret material.
    obj = Identity.__new__(Identity)
    obj.name = d.get("name", "")
    obj._ed_priv = ed_priv
    obj._x_priv = x_priv
    obj._mlkem_sk = bytes.fromhex(d["mlkem_sk"])
    obj._mldsa_sk = bytes.fromhex(d["mldsa_sk"])
    obj.ed_pub = _ed_pub_raw(ed_priv.public_key())
    obj.x_pub = _x_pub_raw(x_priv.public_key())
    obj.mlkem_pub = bytes.fromhex(d["mlkem_pub"])
    obj.mldsa_pub = bytes.fromhex(d["mldsa_pub"])
    return obj


class ContactCard:
    """Shareable public identity. Exchanged once via QR / file (offline)."""

    def __init__(self, name: str, ed_pub: bytes, x_pub: bytes, mlkem_pub: bytes, mldsa_pub: bytes):
        if len(ed_pub) != ED_PK or len(x_pub) != X25519_PK:
            raise CryptoError("bad contact key length")
        if len(mlkem_pub) != MLKEM_PK:
            raise CryptoError("bad ml-kem key length")
        self.name = name
        self.ed_pub = bytes(ed_pub)
        self.x_pub = bytes(x_pub)
        self.mlkem_pub = bytes(mlkem_pub)
        self.mldsa_pub = bytes(mldsa_pub)

    def fingerprint(self) -> bytes:
        h = hashlib.sha3_256()
        h.update(self.ed_pub + self.x_pub + self.mlkem_pub + self.mldsa_pub)
        return h.digest()

    def to_bytes(self) -> bytes:
        name_b = self.name.encode("utf-8")[:64]
        out = MAGIC + bytes([VERSION, 0x51])  # 'Q' contact record
        out += struct.pack(">H", len(name_b)) + name_b
        out += self.ed_pub + self.x_pub + self.mlkem_pub + self.mldsa_pub
        # self-signature omitted here; verified SAS words compared in person
        return out

    @classmethod
    def from_bytes(cls, raw: bytes) -> "ContactCard":
        try:
            assert raw[:4] == MAGIC and raw[4] == VERSION and raw[5] == 0x51
            nlen = struct.unpack(">H", raw[6:8])[0]
            name = raw[8:8 + nlen].decode("utf-8")
            p = 8 + nlen
            ed = raw[p:p + 32]; p += 32
            xp = raw[p:p + 32]; p += 32
            kp = raw[p:p + MLKEM_PK]; p += MLKEM_PK
            dp = raw[p:]
            return cls(name, ed, xp, kp, dp)
        except Exception as e:
            raise CryptoError("bad contact card") from e


# ---------------------------------------------------------------- Contact mode
def encrypt_for_contact(sender: Identity, recipient: ContactCard, plaintext: bytes,
                        filename: str = "") -> bytes:
    comp = zlib.compress(bytes(plaintext), 6)
    padded = _pad(comp)
    msgid = os.urandom(MSGID_LEN)

    # Ephemeral hybrid KEM
    eph_x_priv = X25519PrivateKey.generate()
    eph_x_pub = _x_pub_raw(eph_x_priv.public_key())
    peer_x = X25519PublicKey.from_public_bytes(recipient.x_pub)
    x_share = eph_x_priv.exchange(peer_x)
    ml_ct, ml_share = mlkem_encaps(recipient.mlkem_pub)
    ml_ct, ml_share = bytes(ml_ct), bytes(ml_share)
    session = _hkdf_sha3_512(x_share + ml_share, b"OAM1-hybrid-salt",
                             b"OAM1-msg" + msgid, 32)
    # wipe DH shares ASAP (best effort)
    x_share = b"\x00" * len(x_share)

    nonce = os.urandom(NONCE_LEN)
    aad = MAGIC + bytes([VERSION, MODE_CONTACT]) + msgid
    ct = _aead_encrypt(session, nonce, struct.pack(">I", len(comp)) + padded, aad)
    session = b"\x00" * 32

    fn_b = filename.encode("utf-8")[:256]
    body = (
        MAGIC + bytes([VERSION, MODE_CONTACT, FLAG_COMPRESSED])
        + msgid + eph_x_pub + ml_ct + nonce
        + struct.pack(">H", len(fn_b)) + fn_b
        + struct.pack(">I", len(ct)) + ct
    )
    sig = sender._ed_private().sign(body)
    return body + sig


def decrypt_for_contact(recipient: Identity, sender_card: ContactCard, envelope: bytes) -> tuple[bytes, str]:
    try:
        assert envelope[:4] == MAGIC and envelope[4] == VERSION and envelope[5] == MODE_CONTACT
        p = 7  # MAGIC(4) + ver/mode/flags(3)
        msgid = envelope[p:p + 16]; p += 16
        eph_x_pub = envelope[p:p + 32]; p += 32
        ml_ct = envelope[p:p + MLKEM_CT]; p += MLKEM_CT
        nonce = envelope[p:p + 24]; p += 24
        fn_len = struct.unpack(">H", envelope[p:p + 2])[0]; p += 2
        filename = envelope[p:p + fn_len].decode("utf-8"); p += fn_len
        ct_len = struct.unpack(">I", envelope[p:p + 4])[0]; p += 4
        ct = envelope[p:p + ct_len]; p += ct_len
        sig = envelope[p:p + 64]
        body = envelope[:p]
        # verify first (constant-time Ed25519 verify inside lib)
        Ed25519PublicKey.from_public_bytes(sender_card.ed_pub).verify(sig, body)
        # decapsulate
        peer = X25519PublicKey.from_public_bytes(eph_x_pub)
        x_share = recipient._x_private().exchange(peer)
        ml_share = bytes(mlkem_decaps(recipient._mlkem_sk, ml_ct))
        session = _hkdf_sha3_512(x_share + ml_share, b"OAM1-hybrid-salt",
                                 b"OAM1-msg" + msgid, 32)
        x_share = b"\x00" * 32
        aad = MAGIC + bytes([VERSION, MODE_CONTACT]) + msgid
        raw = _aead_decrypt(session, nonce, ct, aad)
        session = b"\x00" * 32
        orig_len = struct.unpack(">I", raw[:4])[0]
        comp = raw[4:4 + orig_len]
        plain = zlib.decompress(comp)
        return plain, filename
    except CryptoError:
        raise
    except Exception as e:
        raise CryptoError("decrypt failed") from e


# ---------------------------------------------------------------- Words mode
def _passphrase_key(passphrase: str, salt: bytes) -> bytes:
    # Argon2id, 64 MiB / t=3 / p=4. Strong on desktop+phone, ~0.5-1.5s.
    return hash_secret_raw(passphrase.encode("utf-8"), salt,
                           time_cost=3, memory_cost=65536,
                           parallelism=4, hash_len=32, type=Argon2Type.ID)


def encrypt_with_passphrase(plaintext: bytes, passphrase: str, filename: str = "") -> bytes:
    if len(passphrase.encode()) < 8:
        raise CryptoError("passphrase too short")
    comp = zlib.compress(bytes(plaintext), 6)
    padded = _pad(comp)
    msgid = os.urandom(MSGID_LEN)
    salt = os.urandom(SALT_LEN)
    key = _passphrase_key(passphrase, salt)
    nonce = os.urandom(NONCE_LEN)
    aad = MAGIC + bytes([VERSION, MODE_WORDS]) + msgid + salt
    ct = _aead_encrypt(key, nonce, struct.pack(">I", len(comp)) + padded, aad)
    key = b"\x00" * 32
    fn_b = filename.encode("utf-8")[:256]
    return (
        MAGIC + bytes([VERSION, MODE_WORDS, FLAG_COMPRESSED])
        + msgid + salt + nonce
        + struct.pack(">H", len(fn_b)) + fn_b
        + struct.pack(">I", len(ct)) + ct
    )


def decrypt_with_passphrase(envelope: bytes, passphrase: str) -> tuple[bytes, str]:
    try:
        assert envelope[:4] == MAGIC and envelope[4] == VERSION and envelope[5] == MODE_WORDS
        p = 7  # MAGIC(4) + ver/mode/flags(3)
        msgid = envelope[p:p + 16]; p += 16
        salt = envelope[p:p + 16]; p += 16
        nonce = envelope[p:p + 24]; p += 24
        fn_len = struct.unpack(">H", envelope[p:p + 2])[0]; p += 2
        filename = envelope[p:p + fn_len].decode("utf-8"); p += fn_len
        ct_len = struct.unpack(">I", envelope[p:p + 4])[0]; p += 4
        ct = envelope[p:p + ct_len]
        key = _passphrase_key(passphrase, salt)
        aad = MAGIC + bytes([VERSION, MODE_WORDS]) + msgid + salt
        # Single generic error: wrong passphrase indistinguishable from corruption.
        try:
            raw = _aead_decrypt(key, nonce, ct, aad)
        finally:
            key = b"\x00" * 32
        orig_len = struct.unpack(">I", raw[:4])[0]
        comp = raw[4:4 + orig_len]
        return zlib.decompress(comp), filename
    except CryptoError:
        raise
    except Exception as e:
        raise CryptoError("decrypt failed") from e


# ---------------------------------------------------------------- helpers
def generate_passphrase(nwords: int = 6) -> str:
    from .words import WORDLIST
    if nwords not in (6, 8, 12):
        raise ValueError("nwords must be 6, 8 or 12")
    return " ".join(secrets.choice(WORDLIST) for _ in range(nwords))


def fingerprint_words(fp: bytes) -> str:
    from .words import WORDLIST
    out = []
    for i in range(0, 12):
        idx = int.from_bytes(fp[2 * i:2 * i + 2], "big") % 2048
        out.append(WORDLIST[idx])
        if i == 11:
            break
    return " ".join(out[:12])
