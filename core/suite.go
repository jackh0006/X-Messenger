// SPDX-License-Identifier: MIT
// Package core implements the X Messenger v2 protocol suite
// (docs/PROTOCOL-v2.md): fixed CNSA-2.0 algorithms, hybrid P-384 +
// ML-KEM-1024 setup, per-direction chain ratchet, XM2 wire format.
// No network code in this package: crypto, KDF, framing, and state only.
package core

// Wire/protocol constants. Fixed — version bump, never negotiation.
const (
	// Magic is the envelope prefix (v1 used "XM1.").
	Magic = "XM2."
	// Version is the wire version byte.
	Version byte = 0x02
	// DirLoHi / DirHiLo are the AAD direction bytes for ordered identities.
	DirLoHi byte = 0x00
	DirHiLo byte = 0x01

	// ChainLen is the per-direction chain value length (HKDF-SHA-384 output).
	ChainLen = 48
	// MsgKeyLen is the AES-256 key length.
	MsgKeyLen = 32
	// NonceLen is the AES-GCM nonce length.
	NonceLen = 12
	// Buckets are the fixed plaintext sizes (counter + text + random pad).
	// 1 KB buckets stay QR-scannable.
	bucketSmall  = 256
	bucketMedium = 512
	bucketLarge  = 1024
	// MaxSkipped bounds the out-of-order key cache (DoS bound).
	MaxSkipped = 64

	labelRoot = "XM2/root/v1"
	labelMsg  = "XM2/msg/v1"
	labelStep = "XM2/step/v1"
)

// Buckets returns the fixed plaintext size buckets.
func Buckets() [3]int { return [3]int{bucketSmall, bucketMedium, bucketLarge} }

// BucketFor returns the smallest bucket fitting need bytes, or -1.
func BucketFor(need int) int {
	for _, b := range Buckets() {
		if need <= b {
			return b
		}
	}
	return -1
}
