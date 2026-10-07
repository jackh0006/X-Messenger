"""QR frame codec: chunk envelopes into single/animated QR payloads.

Frame layout (binary, then QR binary mode):
  b'OAMQ' | ver(1) | msgid(16) | total(>H) | index(>H) | parity(1) | data

Data frames carry envelope slices. After every 5 data frames one XOR parity
frame is appended so a single missed/damaged scan can be rebuilt.
Payload per frame defaults to 1400 bytes -> safe QR versions with EC-M.
"""
from __future__ import annotations

import base64
import hashlib
import os
import struct

FRAME_MAGIC = b"OAMQ"
FRAME_VER = 0x01
FRAME_SIZE = 1000
PARITY_EVERY = 5
QR_TEXT_PREFIX = b"OAMQ1:"  # QR holds ASCII b64 (binary-safe across encoders)


class QrError(Exception):
    pass


def _msgid(data: bytes) -> bytes:
    return hashlib.sha256(b"OAMQ-frame" + data).digest()[:16]


def encode_frames(envelope: bytes, frame_size: int = FRAME_SIZE) -> list[bytes]:
    if not envelope:
        raise QrError("empty envelope")
    mid = _msgid(envelope)
    chunks = [envelope[i:i + frame_size] for i in range(0, len(envelope), frame_size)]
    data_frames: list[bytes] = []
    for idx, ch in enumerate(chunks):
        hdr = FRAME_MAGIC + bytes([FRAME_VER]) + mid + struct.pack(">HHB", len(chunks), idx, 0)
        data_frames.append(hdr + ch)
    # parity frames (XOR over each group of PARITY_EVERY data payloads,
    # zero-padded to group max length; true lengths appended for rebuild)
    out = list(data_frames)
    group: list[bytes] = []
    group_idx: list[int] = []

    def _flush(group: list[bytes], group_idx: list[int]):
        if len(chunks) <= 1 or not group:
            return
        maxlen = max(len(c) for c in group)
        acc = bytearray(maxlen)
        for c in group:
            for i, b in enumerate(c):
                acc[i] ^= b
        lens = struct.pack(">H", len(group)) + b"".join(struct.pack(">H", len(c)) for c in group)
        hdr = FRAME_MAGIC + bytes([FRAME_VER]) + mid + struct.pack(
            ">HHB", len(chunks), group_idx[0] // PARITY_EVERY, 1)
        out.append(hdr + bytes(acc) + lens)

    for idx, ch in enumerate(chunks):
        group.append(ch)
        group_idx.append(idx)
        if len(group) == PARITY_EVERY or idx == len(chunks) - 1:
            _flush(group, group_idx)
            group = []
            group_idx = []
    return out


def _parse(frame: bytes):
    if len(frame) < 24 or frame[:4] != FRAME_MAGIC or frame[4] != FRAME_VER:
        raise QrError("bad frame")
    mid = frame[5:21]
    total, index, parity = struct.unpack(">HHB", frame[21:26])
    return mid, total, index, parity, frame[26:]


def decode_frames(frames: list[bytes]) -> bytes:
    """Reassemble envelope from scanned frames (data + optional parity)."""
    if not frames:
        raise QrError("no frames")
    by_mid: dict[bytes, dict] = {}
    for f in frames:
        mid, total, index, parity, payload = _parse(bytes(f))
        e = by_mid.setdefault(mid, {"total": total, "data": {}, "parity": {}})
        if total != e["total"]:
            raise QrError("mixed messages")
        if parity == 0:
            e["data"][index] = payload
        else:
            e["parity"][index] = payload
    if len(by_mid) != 1:
        raise QrError("frames from different messages")
    e = next(iter(by_mid.values()))
    total = e["total"]
    # parity rebuild for single missing frame per group
    for g in range((total + PARITY_EVERY - 1) // PARITY_EVERY):
        lo = g * PARITY_EVERY
        hi = min(lo + PARITY_EVERY, total)
        missing = [i for i in range(lo, hi) if i not in e["data"]]
        if len(missing) == 1 and g in e["parity"]:
            par = e["parity"][g]
            nframes = hi - lo
            # layout: xor(maxlen) + count(>H) + lens(>H each)
            tail = par[len(par) - 2 - 2 * nframes:]
            count = struct.unpack(">H", tail[:2])[0]
            if count != nframes:
                continue
            lens = [struct.unpack(">H", tail[2 + 2 * k:4 + 2 * k])[0] for k in range(nframes)]
            xor = par[:len(par) - 2 - 2 * nframes]
            acc = bytearray(xor)
            for i in range(lo, hi):
                if i in e["data"]:
                    c = e["data"][i]
                    for j, b in enumerate(c):
                        acc[j] ^= b
            want = lens[missing[0] - lo]
            e["data"][missing[0]] = bytes(acc[:want])
    if len(e["data"]) != total:
        raise QrError(f"incomplete: {len(e['data'])}/{total} frames")
    return b"".join(e["data"][i] for i in range(total))


def qr_image(payload: bytes, box_size: int = 8, border: int = 2):
    """Render a QR PIL image for one frame payload.

    NOTE: python-qrcode mangles raw bytes >= 0x80 (latin-1 -> UTF-8), so the
    binary frame is base64url-wrapped as ASCII text. Always pair with
    decode_qr_image(), which unwraps automatically.
    """
    import base64 as _b64
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M
    text = (QR_TEXT_PREFIX + _b64.urlsafe_b64encode(bytes(payload))).decode("ascii")
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=box_size, border=border)
    qr.add_data(text, optimize=0)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGB")


def decode_qr_image(path_or_image) -> bytes:
    """Decode a QR payload from an image file path or PIL image.

    Unwraps the OAMQ1: base64 envelope when present; otherwise returns the
    raw QR bytes (back-compat).
    """
    import base64 as _b64
    from pyzbar.pyzbar import decode as zbar_decode
    from PIL import Image
    img = Image.open(path_or_image) if isinstance(path_or_image, str) else path_or_image
    found = zbar_decode(img)
    if not found:
        # fallback: try grayscale via opencv if available
        try:
            import cv2
            det = cv2.QRCodeDetector()
            data, _, _ = det.detectAndDecode(cv2.cvtColor(__import__("numpy").asarray(img), cv2.COLOR_RGB2BGR))
            if data:
                # opencv returns text; our frames are binary -> re-read raw via pyzbar path failed
                raise QrError("no QR found (binary frame needs pyzbar/zbar)")
        except QrError:
            raise
        except Exception:
            pass
        raise QrError("no QR found in image")
    if len(found) > 1:
        raise QrError("multiple QRs in one image: scan frames one by one")
    raw = bytes(found[0].data)
    if raw.startswith(QR_TEXT_PREFIX):
        try:
            return _b64.urlsafe_b64decode(raw[len(QR_TEXT_PREFIX):])
        except Exception as e:
            raise QrError("bad QR text encoding") from e
    return raw


def envelope_to_text(envelope: bytes) -> str:
    """Copy-pasteable fallback when camera is unavailable (still offline)."""
    return "OAM1:" + base64.urlsafe_b64encode(envelope).decode()


def text_to_envelope(text: str) -> bytes:
    text = text.strip()
    if not text.startswith("OAM1:"):
        raise QrError("not an OAM text block")
    return base64.urlsafe_b64decode(text[5:])
