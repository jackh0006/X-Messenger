// SPDX-License-Identifier: MIT
package core

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/binary"
	"errors"
)

// Chain is one direction's ratchet state. Persist value+counter+epoch
// atomically: a counter MUST never repeat for a chain value.
type Chain struct {
	Value   [ChainLen]byte
	Counter uint64
	Epoch   uint32
	Dir     byte
}

// counterInfo builds the HKDF info binding counter (+epoch for messages).
func counterInfo(label string, epoch uint32, counter uint64) []byte {
	info := make([]byte, 0, len(label)+12)
	info = append(info, label...)
	var tmp [12]byte
	binary.BigEndian.PutUint32(tmp[0:4], epoch)
	binary.BigEndian.PutUint64(tmp[4:12], counter)
	return append(info, tmp[:]...)
}

// Seal encrypts text under the chain, advances it, and deletes the old
// value. Returns the wire body (ver‖epoch‖dir‖ctr‖nonce‖ct+tag).
func (c *Chain) Seal(text []byte) ([]byte, error) {
	if c.Counter == ^uint64(0) {
		return nil, errors.New("core: counter exhausted, renew keys")
	}
	msgKey, err := Expand(c.Value[:], counterInfo(labelMsg, c.Epoch, c.Counter), MsgKeyLen+NonceLen)
	if err != nil {
		return nil, err
	}
	defer zero(msgKey)
	key, nonce := msgKey[:MsgKeyLen], msgKey[MsgKeyLen:]

	need := 8 + len(text)
	bucket := BucketFor(need)
	if bucket < 0 {
		return nil, errors.New("core: message too long")
	}
	plain := make([]byte, bucket)
	if _, err := rand.Read(plain[8+len(text):]); err != nil {
		return nil, err
	}
	binary.BigEndian.PutUint64(plain[0:8], uint64(len(text)))
	copy(plain[8:], text)

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	aad := make([]byte, 0, 10)
	aad = append(aad, Version, c.Dir)
	var tmp [12]byte
	binary.BigEndian.PutUint32(tmp[0:4], c.Epoch)
	binary.BigEndian.PutUint64(tmp[4:12], c.Counter)
	aad = append(aad, tmp[:]...)
	sealed := gcm.Seal(nil, nonce, plain, aad)
	zero(plain)

	next, err := Expand(c.Value[:], counterInfo(labelStep, c.Epoch, c.Counter), ChainLen)
	if err != nil {
		return nil, err
	}
	zero(c.Value[:])
	copy(c.Value[:], next)
	zero(next)
	ctr := c.Counter
	c.Counter++

	body := make([]byte, 0, 1+4+1+8+NonceLen+len(sealed))
	body = append(body, Version)
	var e4 [4]byte
	binary.BigEndian.PutUint32(e4[:], c.Epoch)
	body = append(body, e4[:]...)
	body = append(body, c.Dir)
	var c8 [8]byte
	binary.BigEndian.PutUint64(c8[:], ctr)
	body = append(body, c8[:]...)
	body = append(body, nonce...)
	body = append(body, sealed...)
	return body, nil
}

// Session is the receive side: replay window, skipped-key cache, epoch.
type Session struct {
	Epoch   uint32
	Seen    map[uint64]bool
	Skipped map[uint64][]byte // counter -> msg key (bounded)
	Chain   [ChainLen]byte    // current chain value for gap derivation
	Dir     byte
	base    uint64 // next counter the Chain value corresponds to
}

// NewSession starts a receive session at the epoch-0 chain value.
func NewSession(chain []byte, epoch uint32, dir byte) (*Session, error) {
	if len(chain) != ChainLen {
		return nil, errors.New("core: bad chain length")
	}
	s := &Session{Epoch: epoch, Seen: map[uint64]bool{}, Skipped: map[uint64][]byte{}, Dir: dir}
	copy(s.Chain[:], chain)
	return s, nil
}

// Open authenticates and decrypts one wire body (without the XM2./Base32
// envelope — see wire.go). Tolerates gaps via the skipped-key cache.
func (s *Session) Open(body []byte) ([]byte, error) {
	if len(body) < 1+4+1+8+NonceLen+16 {
		return nil, errors.New("core: envelope too short")
	}
	if body[0] != Version {
		return nil, errors.New("core: unsupported version")
	}
	epoch := binary.BigEndian.Uint32(body[1:5])
	if epoch != s.Epoch {
		return nil, errors.New("core: wrong epoch")
	}
	dir := body[5]
	if dir != s.Dir {
		return nil, errors.New("core: wrong direction")
	}
	counter := binary.BigEndian.Uint64(body[6:14])
	if s.Seen[counter] {
		return nil, errors.New("core: replay rejected")
	}
	nonce := body[14 : 14+NonceLen]
	sealed := body[14+NonceLen:]

	if key, ok := s.Skipped[counter]; ok {
		defer zero(key)
		delete(s.Skipped, counter)
		s.Seen[counter] = true
		return openWith(key, nonce, sealed, epoch, dir, counter)
	}
	// Derive forward from current chain, caching skipped keys.
	value := append([]byte{}, s.Chain[:]...)
	for c := s.base; ; c++ {
		mk, err := Expand(value, counterInfo(labelMsg, epoch, c), MsgKeyLen+NonceLen)
		if err != nil {
			return nil, err
		}
		nk, err := Expand(value, counterInfo(labelStep, epoch, c), ChainLen)
		if err != nil {
			zero(mk)
			return nil, err
		}
		copy(value, nk)
		zero(nk)
		if c == counter {
			s.Seen[counter] = true
			copy(s.Chain[:], value)
			s.setBase(counter + 1)
			out, err := openWith(mk[:MsgKeyLen], nonce, sealed, epoch, dir, counter)
			zero(mk)
			return out, err
		}
		if len(s.Skipped) >= MaxSkipped {
			zero(mk)
			zero(value)
			return nil, errors.New("core: too far ahead, fails closed")
		}
		s.Skipped[c] = append([]byte{}, mk[:MsgKeyLen]...)
		zero(mk)
	}
}

// setBase records the counter the session chain value corresponds to.
func (s *Session) setBase(c uint64) { s.base = c }

func openWith(key, nonce, sealed []byte, epoch uint32, dir byte, counter uint64) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	aad := make([]byte, 0, 10)
	aad = append(aad, Version, dir)
	var tmp [12]byte
	binary.BigEndian.PutUint32(tmp[0:4], epoch)
	binary.BigEndian.PutUint64(tmp[4:12], counter)
	aad = append(aad, tmp[:]...)
	plain, err := gcm.Open(nil, nonce, sealed, aad)
	if err != nil {
		return nil, errors.New("core: authentication failed")
	}
	defer zero(plain)
	if len(plain) < 8 {
		return nil, errors.New("core: plaintext too short")
	}
	n := binary.BigEndian.Uint64(plain[0:8])
	if n > uint64(len(plain)-8) {
		return nil, errors.New("core: bad length prefix")
	}
	text := append([]byte{}, plain[8:8+n]...)
	// Validate UTF-8 without silently replacing.
	for i := 0; i < len(text); {
		c := text[i]
		var size int
		switch {
		case c < 0x80:
			size = 1
		case c >= 0xC2 && c < 0xE0:
			size = 2
		case c >= 0xE0 && c < 0xF0:
			size = 3
		case c >= 0xF0 && c < 0xF5:
			size = 4
		default:
			return nil, errors.New("core: malformed UTF-8")
		}
		if i+size > len(text) {
			return nil, errors.New("core: malformed UTF-8")
		}
		i += size
	}
	return text, nil
}

func zero(b []byte) {
	for i := range b {
		b[i] = 0
	}
}
