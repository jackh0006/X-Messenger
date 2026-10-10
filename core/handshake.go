// SPDX-License-Identifier: MIT
package core

import (
	"bytes"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/mlkem"
	"crypto/rand"
	"crypto/sha512"
	"encoding/binary"
	"errors"
	"fmt"
)

// FingerprintLen is the SHA-384 transcript digest length.
const FingerprintLen = 48

// Identity is one side's long-term hybrid keypair.
type Identity struct {
	ECDH  *ecdh.PrivateKey
	MLKEM *mlkem.DecapsulationKey1024
}

// Fingerprint returns the raw fingerprint digest over the ordered
// transcript. Render it as words+digits for the out-loud ceremony.
func Fingerprint(fpLo, fpHi []byte) []byte {
	h := sha512.Sum384(append(append([]byte{}, fpLo...), fpHi...))
	return h[:]
}

// FingerprintHex renders fp as 6 groups of 8 hex chars for comparison.
// (Word list rendering needs an audited list; tracked as follow-up.)
func FingerprintHex(fp []byte) string {
	var out string
	for i := 0; i+8 <= len(fp) && i < 48; i += 8 {
		if i > 0 {
			out += "-"
		}
		out += fmt.Sprintf("%08x", binary.BigEndian.Uint32(fp[i:]))
	}
	return out
}

// GenerateIdentity creates a fresh P-384 + ML-KEM-1024 identity.
func GenerateIdentity() (*Identity, error) {
	ec, err := ecdh.P384().GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	mk, err := mlkem.GenerateKey1024()
	if err != nil {
		return nil, err
	}
	return &Identity{ECDH: ec, MLKEM: mk}, nil
}

// ECDHPublic returns the 97-byte uncompressed P-384 public key.
func (id *Identity) ECDHPublic() []byte {
	return id.ECDH.PublicKey().Bytes()
}

// MLKEMPublic returns the 1568-byte encapsulation key.
func (id *Identity) MLKEMPublic() []byte {
	return id.MLKEM.EncapsulationKey().Bytes()
}

// OrderFP orders two fingerprints lexicographically (lo, hi).
func OrderFP(a, b []byte) (lo, hi []byte) {
	if bytes.Compare(a, b) <= 0 {
		return a, b
	}
	return b, a
}

// Expand is HKDF-SHA-384(key, info, length).
func Expand(key, info []byte, length int) ([]byte, error) {
	return hkdf.Expand(sha512.New384, key, string(info), length)
}

// Extract is HKDF-SHA-384 extract(salt, ikm).
func Extract(salt, ikm []byte) ([]byte, error) {
	return hkdf.Extract(sha512.New384, ikm, salt)
}

// RootKey derives the 96-byte root from the ordered handshake transcript.
// kECDH (48B), kLo, kHi (32B each, ordered), meeting secret S.
// Mirrors docs/PROTOCOL-v2.md §2.5.
func RootKey(ecdhPubLo, ecdhPubHi, mkLo, mkHi []byte, kECDH, kLo, kHi, meeting []byte) ([]byte, error) {
	if len(kECDH) != ChainLen || len(kLo) != mlkem.SharedKeySize ||
		len(kHi) != mlkem.SharedKeySize || len(meeting) != 32 {
		return nil, errors.New("core: bad handshake input length")
	}
	saltInput := append(append(append([]byte{}, ecdhPubLo...), ecdhPubHi...), append(mkLo, mkHi...)...)
	salt := sha512.Sum384(saltInput)
	ikm := append(append(append([]byte{}, kECDH...), kLo...), append(kHi, meeting...)...)
	prk, err := Extract(salt[:], ikm)
	if err != nil {
		return nil, err
	}
	root, err := Expand(prk, []byte(labelRoot), 2*ChainLen)
	if err != nil {
		return nil, err
	}
	out := append([]byte{}, root...)
	for i := range kECDH {
		kECDH[i] = 0
	}
	return out, nil
}

// SplitRoot splits the 96-byte root into ordered per-direction chains.
func SplitRoot(root []byte) (loHi, hiLo []byte, err error) {
	if len(root) != 2*ChainLen {
		return nil, nil, errors.New("core: bad root length")
	}
	loHi = append([]byte{}, root[:ChainLen]...)
	hiLo = append([]byte{}, root[ChainLen:]...)
	return loHi, hiLo, nil
}
