"""OAM secure core: hybrid PQ crypto, envelopes, QR codec, words, store.
100% offline. No sockets. No telemetry. Pure local crypto + QR transport.
"""
from .crypto import (
    Identity, ContactCard,
    encrypt_for_contact, decrypt_for_contact,
    encrypt_with_passphrase, decrypt_with_passphrase,
    generate_passphrase, fingerprint_words,
)
from .envelope import pack_message, unpack_message
from .qrcodec import encode_frames, decode_frames, qr_image, decode_qr_image
from .words import WORDLIST

__all__ = [
    "Identity", "ContactCard",
    "encrypt_for_contact", "decrypt_for_contact",
    "encrypt_with_passphrase", "decrypt_with_passphrase",
    "generate_passphrase", "fingerprint_words",
    "pack_message", "unpack_message",
    "encode_frames", "decode_frames", "qr_image", "decode_qr_image",
    "WORDLIST",
]

__version__ = "1.0.0"
