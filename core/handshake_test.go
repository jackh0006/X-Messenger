// SPDX-License-Identifier: MIT
package core

import (
	"bytes"
	"crypto/ecdh"
	"crypto/mlkem"
		"testing"
)

func fixedScalar(start byte) []byte {
	b := make([]byte, 48)
	for i := range b {
		b[i] = start + byte(i)
	}
	b[0] &= 0x0F // keep well under the P-384 order
	b[0] |= 0x01
	return b
}

func fixedSeed(start byte) []byte {
	b := make([]byte, 64)
	for i := range b {
		b[i] = start + byte(i*7)
	}
	return b
}

func TestHandshakeGolden(t *testing.T) {
	ecA, err := ecdh.P384().NewPrivateKey(fixedScalar(0x11))
	if err != nil {
		t.Fatal(err)
	}
	ecB, err := ecdh.P384().NewPrivateKey(fixedScalar(0x33))
	if err != nil {
		t.Fatal(err)
	}
	mkA, err := mlkem.NewDecapsulationKey1024(fixedSeed(0x55))
	if err != nil {
		t.Fatal(err)
	}
	mkB, err := mlkem.NewDecapsulationKey1024(fixedSeed(0x77))
	if err != nil {
		t.Fatal(err)
	}
	A, B := ecA.PublicKey().Bytes(), ecB.PublicKey().Bytes()
	MKA, MKB := mkA.EncapsulationKey().Bytes(), mkB.EncapsulationKey().Bytes()
	fpA, fpB := OrderFP(append(A, MKA...), append(B, MKB...))
	// Canonical order for all downstream inputs.
	ecdhPubLo, ecdhPubHi := OrderFP(A, B)
	mkLo, mkHi := OrderFP(MKA, MKB)

	// Each side encapsulates to the peer (fixed randomness via seeds would
	// need internal APIs; live encaps here, sensitivity checked below).
	ekAB, err := mlkem.NewEncapsulationKey1024(MKB)
	if err != nil {
		t.Fatal(err)
	}
	kAB, ctAB := ekAB.Encapsulate()
	ekBA, err := mlkem.NewEncapsulationKey1024(MKA)
	if err != nil {
		t.Fatal(err)
	}
	kBA, ctBA := ekBA.Encapsulate()
	// Peer decapsulation recovers the same secrets (round-trip proof).
	dkB, _ := mlkem.NewDecapsulationKey1024(mkB.Bytes())
	gotAB, err := dkB.Decapsulate(ctAB)
	if err != nil || !bytes.Equal(gotAB, kAB) {
		t.Fatal("ML-KEM decaps mismatch (A->B)")
	}
	dkA, _ := mlkem.NewDecapsulationKey1024(mkA.Bytes())
	gotBA, err := dkA.Decapsulate(ctBA)
	if err != nil || !bytes.Equal(gotBA, kBA) {
		t.Fatal("ML-KEM decaps mismatch (B->A)")
	}

	sA := bytes.Repeat([]byte{0xA5}, 16)
	sB := bytes.Repeat([]byte{0x5A}, 16)
	s := make([]byte, 32)
	for i := range s {
		s[i] = sA[i%16] ^ sB[i%16]
	}
	ecdhAB, err := ecA.ECDH(ecB.PublicKey())
	if err != nil {
		t.Fatal(err)
	}
	ecdhBA, err := ecB.ECDH(ecA.PublicKey())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(ecdhAB, ecdhBA) || len(ecdhAB) != ChainLen {
		t.Fatal("ECDH mismatch or bad length")
	}
	// Ordered KEM secrets.
	kLo, kHi := kAB, kBA
	if bytes.Compare(fpA, fpB) > 0 {
		kLo, kHi = kBA, kAB
	}
	root1, err := RootKey(ecdhPubLo, ecdhPubHi, mkLo, mkHi, append([]byte{}, ecdhAB...), kLo, kHi, s)
	if err != nil {
		t.Fatal(err)
	}
	// Determinism: identical inputs give identical roots.
	ecdhAB2, _ := ecA.ECDH(ecB.PublicKey())
	root2, err := RootKey(ecdhPubLo, ecdhPubHi, mkLo, mkHi, ecdhAB2, kLo, kHi, s)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(root1, root2) || len(root1) != 2*ChainLen {
		t.Fatal("root not deterministic or bad length")
	}
	// Sensitivity: flip one meeting-secret bit.
	s[0] ^= 0x01
	ecdhAB3, _ := ecA.ECDH(ecB.PublicKey())
	root3, err := RootKey(ecdhPubLo, ecdhPubHi, mkLo, mkHi, ecdhAB3, kLo, kHi, s)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Equal(root1, root3) {
		t.Fatal("root insensitive to input change")
	}
	// Fingerprint determinism + length.
	fp := Fingerprint(fpA, fpB)
	if len(fp) != FingerprintLen || !bytes.Equal(fp, Fingerprint(fpA, fpB)) {
		t.Fatal("fingerprint unstable")
	}
	if len(FingerprintHex(fp)) == 0 {
		t.Fatal("empty fingerprint rendering")
	}
}
