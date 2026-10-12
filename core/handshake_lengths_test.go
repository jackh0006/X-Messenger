// SPDX-License-Identifier: MIT
package core

import (
	"bytes"
	"testing"
)

// v1.4.1 regression: every real pairing failed with
// "core: bad handshake input length" because JS sent a 16-byte meeting
// secret (single XOR of 128-bit halves) while RootKey requires 32 bytes
// S32 = (sA^sB)||(sA^sB). This test locks the contract.
func TestRootKeyMeetingLength(t *testing.T) {
	// Deterministic 32-byte meeting secret like handshake_test.go.
	sA := bytes.Repeat([]byte{0xA5}, 16)
	sB := bytes.Repeat([]byte{0x5A}, 16)
	s32 := make([]byte, 32)
	for i := range s32 {
		s32[i] = sA[i%16] ^ sB[i%16]
	}
	if len(s32) != 32 {
		t.Fatal("test setup: S32 must be 32 bytes")
	}

	kECDH := bytes.Repeat([]byte{0x11}, ChainLen)
	kLo := bytes.Repeat([]byte{0x22}, 32)
	kHi := bytes.Repeat([]byte{0x33}, 32)
	eLo := bytes.Repeat([]byte{0x01}, 97)
	eHi := bytes.Repeat([]byte{0x02}, 97)
	mkLo := bytes.Repeat([]byte{0x03}, 1568)
	mkHi := bytes.Repeat([]byte{0x04}, 1568)

	// 16-byte S (v1.4.0 bug) must fail closed with the known prefix.
	s16 := s32[:16]
	if _, err := RootKey(eLo, eHi, mkLo, mkHi, append([]byte{}, kECDH...), kLo, kHi, s16); err == nil {
		t.Fatal("RootKey accepted 16-byte meeting secret — must reject (v1.4.0 bug)")
	} else if got := err.Error(); len(got) < 32 || got[:32] != "core: bad handshake input length" {
		t.Fatalf("wrong error for 16-byte meeting: %q", got)
	}

	// 32-byte S must succeed and be deterministic.
	r1, err := RootKey(eLo, eHi, mkLo, mkHi, append([]byte{}, kECDH...), kLo, kHi, s32)
	if err != nil {
		t.Fatalf("RootKey rejected valid 32-byte meeting: %v", err)
	}
	if len(r1) != 2*ChainLen {
		t.Fatalf("bad root length %d", len(r1))
	}
	r2, err := RootKey(eLo, eHi, mkLo, mkHi, append([]byte{}, kECDH...), kLo, kHi, append([]byte{}, s32...))
	if err != nil || !bytes.Equal(r1, r2) {
		t.Fatal("RootKey not deterministic for identical 32-byte meeting")
	}

	// Wrong kECDH/kLo/kHi lengths must also fail closed.
	if _, err := RootKey(eLo, eHi, mkLo, mkHi, kECDH[:31], kLo, kHi, s32); err == nil {
		t.Fatal("RootKey accepted short kECDH")
	}
	if _, err := RootKey(eLo, eHi, mkLo, mkHi, append([]byte{}, kECDH...), kLo[:16], kHi, s32); err == nil {
		t.Fatal("RootKey accepted short kLo")
	}
}
