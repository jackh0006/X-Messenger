// SPDX-License-Identifier: MIT
// Command xm2demo runs the v2 handshake → ratchet → storage loop once,
// end to end, with no network. Usage: go run ./cmd/xm2demo
package main

import (
	"crypto/mlkem"
	"crypto/rand"
	"fmt"
	"os"
	"time"

	core "github.com/jackh0006/X-Messenger/core"
)

func must(err error, what string) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "demo:", what+":", err)
		os.Exit(1)
	}
}

func main() {
	fmt.Println("== XM2 demo: setup → send → store → shred ==")
	// 1. Setup (face to face, once).
	a, err := core.GenerateIdentity()
	must(err, "alice identity")
	b, err := core.GenerateIdentity()
	must(err, "bob identity")
	A, B := a.ECDHPublic(), b.ECDHPublic()
	MKA, MKB := a.MLKEMPublic(), b.MLKEMPublic()
	fpA, fpB := core.OrderFP(append(A, MKA...), append(B, MKB...))
	fmt.Println("fingerprint:", core.FingerprintHex(core.Fingerprint(fpA, fpB))[:35]+"…")

	sA := make([]byte, 16)
	sB := make([]byte, 16)
	_, _ = rand.Read(sA)
	_, _ = rand.Read(sB)
	S := make([]byte, 32)
	for i := range S {
		S[i] = sA[i%16] ^ sB[i%16]
	}
	// Each side encapsulates to the peer.
	ekAB, err := mlkem.NewEncapsulationKey1024(MKB)
	must(err, "encaps key B")
	kAB, ctAB := ekAB.Encapsulate()
	ekBA, err := mlkem.NewEncapsulationKey1024(MKA)
	must(err, "encaps key A")
	kBA, ctBA := ekBA.Encapsulate()
	dkB, _ := mlkem.NewDecapsulationKey1024(b.MLKEM.Bytes())
	gotAB, err := dkB.Decapsulate(ctAB)
	must(err, "decaps A->B")
	_ = gotAB
	dkA, _ := mlkem.NewDecapsulationKey1024(a.MLKEM.Bytes())
	gotBA, err := dkA.Decapsulate(ctBA)
	must(err, "decaps B->A")
	_ = gotBA

	shared, err := a.ECDH.ECDH(b.ECDH.PublicKey())
	must(err, "ecdh")
	loPub, hiPub := core.OrderFP(A, B)
	mkLo, mkHi := core.OrderFP(MKA, MKB)
	kLo, kHi := kAB, kBA
	if string(loPub) != string(A) {
		kLo, kHi = kBA, kAB
	}
	root, err := core.RootKey(loPub, hiPub, mkLo, mkHi, append([]byte{}, shared...), kLo, kHi, S)
	must(err, "root")
	loHi, _, err := core.SplitRoot(root)
	must(err, "split")
	fmt.Printf("root established (%d bytes → 2 chains)\n", len(root))

	// 2. Sending: Alice → Bob, then Bob → Alice, with a gap.
	alice := &core.Chain{Counter: 0, Epoch: 0, Dir: core.DirLoHi}
	copy(alice.Value[:], loHi)
	// Bob receives Alice's lo→hi direction, so his session starts from the
	// same loHi chain value (both sides derived it from the shared root).
	bobRx, err := core.NewSession(loHi, 0, core.DirLoHi)
	must(err, "bob session")
	_ = bobRx
	// Note: directions are per-ordered-identities; demo uses one direction.
	var bodies [][]byte
	for _, text := range []string{"meet at the north gate", "09:00 sharp", "bring nothing digital"} {
		body, err := alice.Seal([]byte(text))
		must(err, "seal")
		bodies = append(bodies, body)
	}
	fmt.Printf("sealed %d messages, first envelope: %s\n", len(bodies),
		mustEncode(bodies[0])[:40]+"…")

	// 3. Receiving out of order (2, 0, 1).
	for _, i := range []int{2, 0, 1} {
		plain, err := bobRx.Open(bodies[i])
		must(err, "open")
		fmt.Printf("bob got #%d: %s\n", i, plain)
	}

	// 4. Storage with crypto-shredding.
	dir, _ := os.MkdirTemp("", "xm2demo")
	vault, err := core.NewVault([]byte("correct horse battery staple words"), core.TestArgon(), core.NewFileKeyer(dir))
	must(err, "vault")
	conv, err := vault.NewConversation()
	must(err, "conversation")
	msgID, err := vault.AddMessage(conv, []byte("crown jewel"), 0)
	must(err, "store")
	got, err := vault.OpenMessage(conv, msgID, time.Now().Unix())
	must(err, "reopen")
	fmt.Printf("vault roundtrip: %s\n", got)
	must(vault.DeleteConversation(conv), "shred conversation")
	if _, err := vault.OpenMessage(conv, msgID, time.Now().Unix()); err == nil {
		fmt.Fprintln(os.Stderr, "demo: shredded message still opens — BUG")
		os.Exit(1)
	}
	fmt.Println("shredded conversation unreadable ✓")
	must(vault.DestroyAll(), "destroy all")
	fmt.Println("== demo complete: handshake, ratchet, storage, shredding all ran ==")
}

func mustEncode(body []byte) string {
	return core.EncodeEnvelope(body)
}
