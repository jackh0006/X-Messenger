// SPDX-License-Identifier: MIT
package core

import (
	"strings"
	"testing"
)

func TestWireRoundtrip(t *testing.T) {
	send, _ := newPair(t)
	body, err := send.Seal([]byte("wire test"))
	if err != nil {
		t.Fatal(err)
	}
	env := EncodeEnvelope(body)
	if !strings.HasPrefix(env, Magic) {
		t.Fatal("missing magic")
	}
	back, err := DecodeEnvelope(env)
	if err != nil {
		t.Fatal(err)
	}
	if string(back) != string(body) {
		t.Fatal("wire roundtrip mismatch")
	}
}

func TestWireRejects(t *testing.T) {
	for _, bad := range []string{"", "XM1.AAAA", "XM2.", "XM2.AAAA", "XM2.AAAA BBBB"} {
		if _, err := DecodeEnvelope(bad); err == nil {
			t.Fatalf("accepted %q", bad)
		}
	}
	send, _ := newPair(t)
	body, _ := send.Seal([]byte("x"))
	env := EncodeEnvelope(body)
	// Corrupt one grouped char (not the checksum word).
	flat := strings.ReplaceAll(env[len(Magic):], " ", "")
	broken := flat[:10] + "A" + flat[11:]
	if _, err := DecodeEnvelope(Magic + broken); err == nil {
		t.Fatal("corrupted envelope accepted")
	}
}
