// SPDX-License-Identifier: MIT
package core

import (
	"testing"
)

func newPair(t *testing.T) (*Chain, *Session) {
	t.Helper()
	var cv [ChainLen]byte
	for i := range cv {
		cv[i] = byte(i + 1)
	}
	send := &Chain{Counter: 0, Epoch: 0, Dir: DirLoHi}
	copy(send.Value[:], cv[:])
	recv, err := NewSession(cv[:], 0, DirLoHi)
	if err != nil {
		t.Fatal(err)
	}
	return send, recv
}

func TestRatchetRoundtrip(t *testing.T) {
	send, recv := newPair(t)
	for _, text := range []string{"hello", "", "x — ✓ déjà ✓"} {
		body, err := send.Seal([]byte(text))
		if err != nil {
			t.Fatal(err)
		}
		got, err := recv.Open(body)
		if err != nil {
			t.Fatalf("open %q: %v", text, err)
		}
		if string(got) != text {
			t.Fatalf("roundtrip mismatch: %q", got)
		}
	}
	if send.Counter != 3 {
		t.Fatalf("counter = %d, want 3", send.Counter)
	}
}

func TestRatchetGapsAndReplay(t *testing.T) {
	send, recv := newPair(t)
	var bodies [][]byte
	for i := 0; i < 5; i++ {
		b, err := send.Seal([]byte{byte('a' + i)})
		if err != nil {
			t.Fatal(err)
		}
		bodies = append(bodies, b)
	}
	// Out of order: 4, then 1..3, then 0 from cache.
	for _, i := range []int{4, 1, 2, 3, 0} {
		got, err := recv.Open(bodies[i])
		if err != nil {
			t.Fatalf("open %d: %v", i, err)
		}
		if len(got) != 1 || got[0] != byte('a'+i) {
			t.Fatalf("wrong plaintext for %d", i)
		}
	}
	// Replay rejected.
	if _, err := recv.Open(bodies[2]); err == nil {
		t.Fatal("replay accepted")
	}
}

func TestRatchetEpochAndTamper(t *testing.T) {
	send, recv := newPair(t)
	body, err := send.Seal([]byte("epoch test"))
	if err != nil {
		t.Fatal(err)
	}
	// Wrong epoch fails.
	recv.Epoch = 1
	if _, err := recv.Open(body); err == nil {
		t.Fatal("wrong epoch accepted")
	}
	recv.Epoch = 0
	// Tampered ciphertext fails.
	body[len(body)-1] ^= 0x01
	if _, err := recv.Open(body); err == nil {
		t.Fatal("tampered message accepted")
	}
}

func TestCounterExhaustion(t *testing.T) {
	send, _ := newPair(t)
	send.Counter = ^uint64(0)
	if _, err := send.Seal([]byte("x")); err == nil {
		t.Fatal("exhausted counter accepted")
	}
}

func TestBucketSelection(t *testing.T) {
	if BucketFor(0) != 256 || BucketFor(256-8) != 256 {
		t.Fatal("small bucket wrong")
	}
	if BucketFor(257) != 512 || BucketFor(1024) != 1024 {
		t.Fatal("medium/large bucket wrong")
	}
	if BucketFor(1025) != -1 {
		t.Fatal("oversize must fail")
	}
}
