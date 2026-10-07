"""Envelope helpers: detect mode, wrap for QR/file transport."""
from __future__ import annotations

from .crypto import MAGIC, VERSION, MODE_CONTACT, MODE_WORDS, CryptoError


def pack_message(envelope: bytes) -> bytes:
    """Envelope bytes are already self-describing; validate + return."""
    if len(envelope) < 8 or envelope[:4] != MAGIC or envelope[4] != VERSION:
        raise CryptoError("bad envelope")
    if envelope[5] not in (MODE_CONTACT, MODE_WORDS):
        raise CryptoError("unknown mode")
    if len(envelope) > 16 * 1024 * 1024:
        raise CryptoError("message too large")
    return bytes(envelope)


def unpack_message(raw: bytes) -> bytes:
    return pack_message(raw)


def envelope_mode(envelope: bytes) -> str:
    if envelope[5] == MODE_CONTACT:
        return "contact"
    if envelope[5] == MODE_WORDS:
        return "words"
    raise CryptoError("unknown mode")
