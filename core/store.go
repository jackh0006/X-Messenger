// SPDX-License-Identifier: MIT
package core

// At-rest hierarchy with crypto-shredding (docs/PROTOCOL-v2.md §5).
//
//   Master M  = HKDF(deviceKey ‖ Argon2id(passphrase))      (memory only)
//   Conv C_i  = random 256-bit, stored only as AEAD(M, C_i)
//   Msg  k_j  = random 256-bit per message, stored wrapped by C_i;
//             ciphertext is AEAD(k_j, aad = convID ‖ msgID)
//
// Deleting a wrapped key destroys everything it protects even if file
// copies survive (flash cannot be reliably overwritten). Plaintext and
// keys are zeroed after use and never logged, backed up, or cached.
import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"

	"golang.org/x/crypto/argon2"
)

// Store format versions.
const (
	storeMagic   = "XM2S"
	storeVersion = 1
)

// ArgonParams carries the password-KDF parameters (stored in the header).
type ArgonParams struct {
	Memory  uint32 // KiB
	Time    uint32
	Threads uint8
}

// DefaultArgon is the production target; Calibrate may step memory down
// on constrained devices (128 MiB floor documented in the spec).
func DefaultArgon() ArgonParams { return ArgonParams{Memory: 256 * 1024, Time: 3, Threads: 4} }

// TestArgon is fast and for tests only — never ship it as a default.
func TestArgon() ArgonParams { return ArgonParams{Memory: 8 * 1024, Time: 1, Threads: 1} }

// DeviceKeyer abstracts the hardware-held device key. Files alone must
// never suffice to open a vault.
type DeviceKeyer interface {
	// DeviceKey returns 32 random-or-hardware bytes, creating them once.
	DeviceKey() ([]byte, error)
	// Destroy removes the device key (crypto-shredding step 2).
	Destroy() error
	// Hardware reports whether the key lives in real hardware.
	Hardware() bool
	Name() string
}

// messageRecord is one stored message: everything except IDs is secret.
type messageRecord struct {
	MsgID      [16]byte
	WrappedKey []byte // AEAD(C_i, msgKey), nonce prepended
	Nonce      []byte // message AEAD nonce
	Ciphertext []byte
	ExpiresAt  int64 // unix seconds, 0 = never (best-effort, not security)
}

// conversationRecord holds one conversation's wrapped key + messages.
type conversationRecord struct {
	ID       [16]byte
	Wrapped  []byte // AEAD(M, C_i), nonce prepended
	Messages map[string]*messageRecord
}

// Vault is an unlocked store. Lock() zeroes the master key.
type Vault struct {
	params ArgonParams
	salt   [16]byte
	master [32]byte
	convs  map[string]*conversationRecord
	keyer  DeviceKeyer
}

// deriveMaster runs Argon2id + device-key mixing per the spec.
func deriveMaster(passphrase []byte, params ArgonParams, salt [16]byte, keyer DeviceKeyer) ([32]byte, error) {
	var out [32]byte
	if len(passphrase) < 8 {
		return out, errors.New("core: passphrase too short")
	}
	ak := argon2.IDKey(passphrase, salt[:], params.Time, params.Memory, params.Threads, 32)
	defer zero(ak)
	dk, err := keyer.DeviceKey()
	if err != nil {
		return out, err
	}
	if len(dk) != 32 {
		return out, errors.New("core: bad device key length")
	}
	prk, err := Extract(nil, append(append([]byte{}, dk...), ak...))
	if err != nil {
		return out, err
	}
	m, err := Expand(prk, []byte("XM2/master/v1"), 32)
	if err != nil {
		return out, err
	}
	copy(out[:], m)
	zero(m)
	zero(prk)
	return out, nil
}

// sealWith encrypts plaintext under key with AAD, prepending the nonce.
func sealWith(key, aad, plaintext []byte) ([]byte, error) {
	return sealGCM(key, aad, plaintext)
}

// openWithKey decrypts a nonce-prepended envelope.
func openEnvelope(key, aad, envelope []byte) ([]byte, error) {
	if len(envelope) < NonceLen {
		return nil, errors.New("core: envelope too short")
	}
	return openGCM(key, envelope[:NonceLen], envelope[NonceLen:], aad)
}

func sealGCM(key, aad, plaintext []byte) ([]byte, error) {
	aead, nonce, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	out := make([]byte, 0, NonceLen+len(plaintext)+16)
	out = append(out, nonce...)
	return aead.Seal(out, nonce, plaintext, aad), nil
}

func openGCM(key, nonce, sealed, aad []byte) ([]byte, error) {
	aead, _, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	plain, err := aead.Open(nil, nonce, sealed, aad)
	if err != nil {
		return nil, errors.New("core: authentication failed")
	}
	return plain, nil
}

func newGCM(key []byte) (cipher.AEAD, []byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}
	nonce := make([]byte, NonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, err
	}
	return gcm, nonce, nil
}

// NewVault creates a fresh vault (nothing persisted yet — caller saves).
func NewVault(passphrase []byte, params ArgonParams, keyer DeviceKeyer) (*Vault, error) {
	var salt [16]byte
	if _, err := rand.Read(salt[:]); err != nil {
		return nil, err
	}
	master, err := deriveMaster(passphrase, params, salt, keyer)
	if err != nil {
		return nil, err
	}
	return &Vault{params: params, salt: salt, master: master,
		convs: map[string]*conversationRecord{}, keyer: keyer}, nil
}

// Lock zeroes the in-memory master key. Use on background/lock/timeout.
func (v *Vault) Lock() { zero(v.master[:]) }

// convAAD binds a conversation key wrap to its ID.
func convAAD(id [16]byte) []byte {
	out := make([]byte, 0, 12+16)
	out = append(out, "XM2/conv/v1"...)
	return append(out, id[:]...)
}

// NewConversation creates a conversation with a fresh random key.
func (v *Vault) NewConversation() ([16]byte, error) {
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return id, err
	}
	var ck [32]byte
	if _, err := rand.Read(ck[:]); err != nil {
		return id, err
	}
	defer zero(ck[:])
	wrapped, err := sealWith(v.master[:], convAAD(id), ck[:])
	if err != nil {
		return id, err
	}
	v.convs[string(id[:])] = &conversationRecord{ID: id, Wrapped: wrapped,
		Messages: map[string]*messageRecord{}}
	return id, nil
}

// openConv unwraps a conversation key (zeroed by caller via defer pattern
// at each call site below).
func (v *Vault) openConv(id [16]byte) ([]byte, *conversationRecord, error) {
	c, ok := v.convs[string(id[:])]
	if !ok {
		return nil, nil, errors.New("core: unknown conversation")
	}
	ck, err := openEnvelope(v.master[:], convAAD(id), c.Wrapped)
	if err != nil {
		return nil, nil, errors.New("core: conversation key authentication failed")
	}
	return ck, c, nil
}

// AddMessage stores plaintext encrypted under a fresh per-message key.
// expiresAt is unix seconds (0 = never); expiry is best-effort, the
// replay counter (not the clock) is the security mechanism.
func (v *Vault) AddMessage(conv [16]byte, plaintext []byte, expiresAt int64) ([16]byte, error) {
	var msgID [16]byte
	ck, c, err := v.openConv(conv)
	if err != nil {
		return msgID, err
	}
	defer zero(ck)
	var mk [32]byte
	if _, err := rand.Read(mk[:]); err != nil {
		return msgID, err
	}
	defer zero(mk[:])
	if _, err := rand.Read(msgID[:]); err != nil {
		return msgID, err
	}
	wrappedKey, err := sealWith(ck, append(append([]byte("XM2/msgkey/v1"), conv[:]...), msgID[:]...), mk[:])
	if err != nil {
		return msgID, err
	}
	aad := append(append([]byte("XM2/msg/v1"), conv[:]...), msgID[:]...)
	envelope, err := sealWith(mk[:], aad, plaintext)
	if err != nil {
		return msgID, err
	}
	c.Messages[string(msgID[:])] = &messageRecord{
		MsgID: msgID, WrappedKey: wrappedKey,
		Nonce: envelope[:NonceLen], Ciphertext: envelope[NonceLen:],
		ExpiresAt: expiresAt,
	}
	return msgID, nil
}

// OpenMessage decrypts one message (checks expiry, best-effort).
func (v *Vault) OpenMessage(conv, msgID [16]byte, nowUnix int64) ([]byte, error) {
	ck, c, err := v.openConv(conv)
	if err != nil {
		return nil, err
	}
	defer zero(ck)
	m, ok := c.Messages[string(msgID[:])]
	if !ok {
		return nil, errors.New("core: unknown message")
	}
	if m.ExpiresAt != 0 && nowUnix >= m.ExpiresAt {
		return nil, errors.New("core: message expired")
	}
	mk, err := openEnvelope(ck, append(append([]byte("XM2/msgkey/v1"), conv[:]...), msgID[:]...), m.WrappedKey)
	if err != nil {
		return nil, errors.New("core: message key authentication failed")
	}
	defer zero(mk)
	aad := append(append([]byte("XM2/msg/v1"), conv[:]...), msgID[:]...)
	envelope := append(append([]byte{}, m.Nonce...), m.Ciphertext...)
	plain, err := openEnvelope(mk, aad, envelope)
	if err != nil {
		return nil, err
	}
	return plain, nil
}

// DeleteMessage destroys the per-message key first (crypto-shredding),
// then the record. Copies of the record stay unreadable.
func (v *Vault) DeleteMessage(conv, msgID [16]byte) error {
	_, c, err := v.openConv(conv)
	if err != nil {
		return err
	}
	m, ok := c.Messages[string(msgID[:])]
	if !ok {
		return errors.New("core: unknown message")
	}
	zero(m.WrappedKey)
	zero(m.Nonce)
	zero(m.Ciphertext)
	delete(c.Messages, string(msgID[:]))
	return nil
}

// DeleteConversation destroys the conversation key, then all records.
func (v *Vault) DeleteConversation(conv [16]byte) error {
	c, ok := v.convs[string(conv[:])]
	if !ok {
		return errors.New("core: unknown conversation")
	}
	zero(c.Wrapped)
	for k, m := range c.Messages {
		zero(m.WrappedKey)
		zero(m.Nonce)
		zero(m.Ciphertext)
		delete(c.Messages, k)
	}
	delete(v.convs, string(conv[:]))
	return nil
}

// DestroyAll crypto-shreds everything: master, wrapped keys, records,
// then the hardware device key. Instant and irreversible.
func (v *Vault) DestroyAll() error {
	for id := range v.convs {
		var conv [16]byte
		copy(conv[:], id)
		if err := v.DeleteConversation(conv); err != nil {
			return err
		}
	}
	zero(v.master[:])
	zero(v.salt[:])
	if err := v.keyer.Destroy(); err != nil {
		return err
	}
	v.convs = map[string]*conversationRecord{}
	return nil
}
