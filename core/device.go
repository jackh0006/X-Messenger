// SPDX-License-Identifier: MIT
package core

import (
	"crypto/rand"
	"errors"
	"os"
	"path/filepath"
)

// FileKeyer holds the device key in a 0600 file. This is a DEVELOPMENT
// fallback, not hardware: it proves the mixing construction, not theft
// resistance. Production builds must supply a hardware-backed DeviceKeyer
// (Android Keystore/StrongBox, TPM 2.0) — see StubKeyer below.
type FileKeyer struct {
	Path string
}

// NewFileKeyer points at dir/device.key (0600 on create).
func NewFileKeyer(dir string) *FileKeyer {
	return &FileKeyer{Path: filepath.Join(dir, "device.key")}
}

func (k *FileKeyer) DeviceKey() ([]byte, error) {
	if data, err := os.ReadFile(k.Path); err == nil {
		if len(data) != 32 {
			return nil, errors.New("core: corrupt device key file")
		}
		return append([]byte{}, data...), nil
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(k.Path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		zero(key)
		return nil, err
	}
	if _, err := f.Write(key); err != nil {
		f.Close()
		zero(key)
		return nil, err
	}
	f.Close()
	return key, nil
}

// Destroy removes the device key file (best-effort overwrite first).
func (k *FileKeyer) Destroy() error {
	if data, err := os.ReadFile(k.Path); err == nil {
		zero(data)
		_ = os.WriteFile(k.Path, data, 0600)
	}
	return os.Remove(k.Path)
}

// Hardware reports false: this is NOT hardware-backed storage.
func (k *FileKeyer) Hardware() bool { return false }

// Name identifies the provider in logs and UI.
func (k *FileKeyer) Name() string { return "file-dev (NOT hardware-backed)" }

// StubKeyer is returned by platform constructors that are not implemented
// on this OS. Calling DeviceKey fails closed with a clear message.
type StubKeyer struct{ Platform string }

func (k *StubKeyer) DeviceKey() ([]byte, error) {
	return nil, errors.New("core: " + k.Platform + " hardware keystore not implemented on this OS")
}

func (k *StubKeyer) Destroy() error {
	return errors.New("core: " + k.Platform + " hardware keystore not implemented on this OS")
}

func (k *StubKeyer) Hardware() bool { return false }

func (k *StubKeyer) Name() string { return k.Platform + " (unimplemented)" }

// AndroidKeyer and TPMKeyer are placeholders the mobile/desktop builds
// replace with real Keystore/StrongBox and TPM 2.0 implementations.
func AndroidKeyer() DeviceKeyer { return &StubKeyer{Platform: "Android Keystore"} }

func TPMKeyer() DeviceKeyer { return &StubKeyer{Platform: "TPM 2.0"} }

// BrowserArgon is the in-page calibration: 128 MiB keeps tabs alive where
// 256 MiB OOMs. Labeled non-hardware alongside MemKeyer below.
func BrowserArgon() ArgonParams { return ArgonParams{Memory: 128 * 1024, Time: 3, Threads: 4} }

// MemKeyer holds the device key in process memory only. It exists so the
// browser bridge has the same mixing construction with zero persistence.
// It is explicitly NOT hardware-backed: Name() says so, and the UI must
// repeat it. Native builds replace it with Keystore/StrongBox/TPM.
type MemKeyer struct {
	key  [32]byte
	name string
}

// NewMemKeyer creates a memory-only device key from a seed.
func NewMemKeyer(name string, seed []byte) *MemKeyer {
	k := &MemKeyer{name: name}
	copy(k.key[:], seed)
	return k
}

func (k *MemKeyer) DeviceKey() ([]byte, error) {
	return append([]byte{}, k.key[:]...), nil
}

func (k *MemKeyer) Destroy() error {
	zero(k.key[:])
	return nil
}

func (k *MemKeyer) Hardware() bool { return false }

func (k *MemKeyer) Name() string { return k.name + " (memory-only, NOT hardware-backed)" }
