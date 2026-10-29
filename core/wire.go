// SPDX-License-Identifier: MIT
package core

import (
	"encoding/base32"
	"errors"
	"strings"
)

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

// crc16XMODEM computes CRC-16/XMODEM (poly 0x1021, init 0x0000).
func crc16XMODEM(data []byte) uint16 {
	var crc uint16
	for _, b := range data {
		crc ^= uint16(b) << 8
		for i := 0; i < 8; i++ {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
}

// EncodeEnvelope renders a wire body as XM2. + grouped Base32 + checksum word.
func EncodeEnvelope(body []byte) string {
	text := b32.EncodeToString(body)
	var grouped strings.Builder
	for i := 0; i < len(text); i += 5 {
		if i > 0 {
			grouped.WriteByte(' ')
		}
		end := i + 5
		if end > len(text) {
			end = len(text)
		}
		grouped.WriteString(text[i:end])
	}
	sum := crc16XMODEM([]byte(text))
	var sumBytes [2]byte
	sumBytes[0], sumBytes[1] = byte(sum>>8), byte(sum)
	check := b32.EncodeToString(sumBytes[:])
	return Magic + grouped.String() + " " + check
}

// DecodeEnvelope parses an envelope, verifying grouping-insensitive Base32
// and the checksum word. Returns the raw wire body.
func DecodeEnvelope(envelope string) ([]byte, error) {
	if !strings.HasPrefix(envelope, Magic) {
		return nil, errors.New("core: not an XM2 transfer")
	}
	fields := strings.Fields(envelope[len(Magic):])
	if len(fields) < 2 {
		return nil, errors.New("core: envelope too short")
	}
	check, text := fields[len(fields)-1], strings.Join(fields[:len(fields)-1], "")
	if len(check) != 4 {
		return nil, errors.New("core: bad checksum word")
	}
	sumBytes, err := b32.DecodeString(check)
	if err != nil || len(sumBytes) != 2 {
		return nil, errors.New("core: bad checksum word")
	}
	want := uint16(sumBytes[0])<<8 | uint16(sumBytes[1])
	if crc16XMODEM([]byte(text)) != want {
		return nil, errors.New("core: checksum mismatch")
	}
	body, err := b32.DecodeString(text)
	if err != nil {
		return nil, errors.New("core: malformed Base32")
	}
	return body, nil
}
