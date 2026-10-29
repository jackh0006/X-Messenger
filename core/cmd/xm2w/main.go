// SPDX-License-Identifier: MIT
// Command xm2w exposes the v2 core to the browser UI as WebAssembly.
//
// Build: GOOS=js GOARCH=wasm go build -trimpath -o xm2.wasm ./cmd/xm2w
// with the matching wasm_exec.js from the same toolchain.
//
// Boundary rules: secret material crosses as transient call arguments
// only; long-term secrets live in the WASM session keystore (page memory,
// dies on reload). JS persists sealed envelopes and wrapped blobs. The
// page must wipe displayed secrets and never log bridge traffic.
package main

import (
	"crypto/ecdh"
	"crypto/mlkem"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"syscall/js"

	core "github.com/jackh0006/X-Messenger/core"
)

var (
	identities = map[string]*core.Identity{}
	chains     = map[string]*core.Chain{}
	receivers  = map[string]*core.Session{}
	vaults     = map[string]*core.Vault{}
	seq        int
)

func nextHandle(prefix string) string {
	seq++
	return fmt.Sprintf("%s%d", prefix, seq)
}

func b64dec(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(s)
}

func b64enc(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

func fail(err error) js.Value {
	m, _ := json.Marshal(map[string]string{"error": err.Error()})
	return js.ValueOf(string(m))
}

func ok(v any) js.Value {
	m, _ := json.Marshal(v)
	return js.ValueOf(string(m))
}

func args0(call []js.Value) (map[string]any, error) {
	if len(call) < 1 {
		return nil, fmt.Errorf("missing argument")
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(call[0].String()), &m); err != nil {
		return nil, fmt.Errorf("bad argument: %w", err)
	}
	return m, nil
}

func getBin(m map[string]any, key string) ([]byte, error) {
	s, _ := m[key].(string)
	if s == "" {
		return nil, fmt.Errorf("missing %s", key)
	}
	b, err := b64dec(s)
	if err != nil {
		return nil, fmt.Errorf("bad %s: %w", key, err)
	}
	return b, nil
}

func num(m map[string]any, key string) float64 {
	v, _ := m[key].(float64)
	return v
}

func dirOf(m map[string]any) byte {
	if s, _ := m["dir"].(string); s == "hi-lo" {
		return core.DirHiLo
	}
	return core.DirLoHi
}

func register() {
	js.Global().Set("xm2", map[string]any{
		// generateIdentity creates a hybrid identity held in WASM memory.
		"generateIdentity": js.FuncOf(func(_ js.Value, _ []js.Value) any {
			id, err := core.GenerateIdentity()
			if err != nil {
				return fail(err)
			}
			h := nextHandle("id")
			identities[h] = id
			return ok(map[string]string{
				"handle": h, "ecdhPub": b64enc(id.ECDHPublic()),
				"mlkemPub": b64enc(id.MLKEMPublic()),
			})
		}),
		// ecdh runs P-384 ECDH with the held identity against a peer public key.
		"ecdh": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			id, found := identities[h]
			if !found {
				return fail(fmt.Errorf("unknown identity"))
			}
			peerRaw, err := getBin(m, "peerEcdh")
			if err != nil {
				return fail(err)
			}
			peer, err := ecdh.P384().NewPublicKey(peerRaw)
			if err != nil {
				return fail(fmt.Errorf("bad peer key: %w", err))
			}
			shared, err := id.ECDH.ECDH(peer)
			if err != nil {
				return fail(fmt.Errorf("ecdh failed: %w", err))
			}
			return ok(map[string]string{"k": b64enc(shared)})
		}),
		// encaps runs ML-KEM-1024 encapsulation to a peer key held by handle.
		"encaps": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			if _, found := identities[h]; !found {
				return fail(fmt.Errorf("unknown identity"))
			}
			peerRaw, err := getBin(m, "peerMkem")
			if err != nil {
				return fail(err)
			}
			ek, err := mlkem.NewEncapsulationKey1024(peerRaw)
			if err != nil {
				return fail(fmt.Errorf("bad peer key: %w", err))
			}
			k, ct := ek.Encapsulate()
			return ok(map[string]string{"k": b64enc(k), "ct": b64enc(ct)})
		}),
		// decaps recovers the shared secret from a peer ciphertext.
		"decaps": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			id, found := identities[h]
			if !found {
				return fail(fmt.Errorf("unknown identity"))
			}
			ctRaw, err := getBin(m, "ct")
			if err != nil {
				return fail(err)
			}
			k, err := id.MLKEM.Decapsulate(ctRaw)
			if err != nil {
				return fail(fmt.Errorf("decaps failed: %w", err))
			}
			return ok(map[string]string{"k": b64enc(k)})
		}),
		"fingerprint": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			a, err := getBin(m, "a")
			if err != nil {
				return fail(err)
			}
			b, err := getBin(m, "b")
			if err != nil {
				return fail(err)
			}
			lo, hi := core.OrderFP(a, b)
			return ok(map[string]string{"hex": core.FingerprintHex(core.Fingerprint(lo, hi))})
		}),
		// deriveRoot runs the §2 handshake; chain halves are returned
		// base64 (caller holds them in the session keystore or wraps them).
		"deriveRoot": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			eLo, err := getBin(m, "ecdhLo")
			if err != nil {
				return fail(err)
			}
			eHi, err := getBin(m, "ecdhHi")
			if err != nil {
				return fail(err)
			}
			mkLo, err := getBin(m, "mkLo")
			if err != nil {
				return fail(err)
			}
			mkHi, err := getBin(m, "mkHi")
			if err != nil {
				return fail(err)
			}
			kECDH, err := getBin(m, "kEcdh")
			if err != nil {
				return fail(err)
			}
			kLo, err := getBin(m, "kLo")
			if err != nil {
				return fail(err)
			}
			kHi, err := getBin(m, "kHi")
			if err != nil {
				return fail(err)
			}
			S, err := getBin(m, "meeting")
			if err != nil {
				return fail(err)
			}
			root, err := core.RootKey(eLo, eHi, mkLo, mkHi, kECDH, kLo, kHi, S)
			if err != nil {
				return fail(err)
			}
			loHi, hiLo, err := core.SplitRoot(root)
			if err != nil {
				return fail(err)
			}
			return ok(map[string]string{"chainLoHi": b64enc(loHi), "chainHiLo": b64enc(hiLo)})
		}),
		// sender opens a send chain held in WASM memory.
		"sender": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			chain, err := getBin(m, "chain")
			if err != nil {
				return fail(err)
			}
			if len(chain) != core.ChainLen {
				return fail(fmt.Errorf("bad chain length"))
			}
			var value [core.ChainLen]byte
			copy(value[:], chain)
			ch := &core.Chain{Value: value, Counter: uint64(num(m, "counter")),
				Epoch: uint32(num(m, "epoch")), Dir: dirOf(m)}
			h := nextHandle("send")
			chains[h] = ch
			return ok(map[string]string{"handle": h})
		}),
		// receiver opens a receive session held in WASM memory.
		"receiver": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			chain, err := getBin(m, "chain")
			if err != nil {
				return fail(err)
			}
			sess, err := core.NewSession(chain, uint32(num(m, "epoch")), dirOf(m))
			if err != nil {
				return fail(err)
			}
			h := nextHandle("recv")
			receivers[h] = sess
			return ok(map[string]string{"handle": h})
		}),
		// seal encrypts text; returns the display envelope.
		"seal": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			text, _ := m["text"].(string)
			ch, found := chains[h]
			if !found {
				return fail(fmt.Errorf("unknown sender"))
			}
			if text == "" {
				return fail(fmt.Errorf("empty message"))
			}
			body, err := ch.Seal([]byte(text))
			if err != nil {
				return fail(err)
			}
			return ok(map[string]any{"envelope": core.EncodeEnvelope(body), "counter": ch.Counter - 1})
		}),
		// open decrypts a display envelope; returns plaintext.
		"open": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			env, _ := m["envelope"].(string)
			sess, found := receivers[h]
			if !found {
				return fail(fmt.Errorf("unknown receiver"))
			}
			body, err := core.DecodeEnvelope(env)
			if err != nil {
				return fail(err)
			}
			plain, err := sess.Open(body)
			if err != nil {
				return fail(err)
			}
			return ok(map[string]string{"text": string(plain)})
		}),
		// vaultCreate makes a session vault (browser: memory only, plus an
		// explicit non-hardware label — TPM/StrongBox need native builds).
		"vaultCreate": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			pass, err := getBin(m, "passphrase")
			if err != nil {
				return fail(err)
			}
			seed := make([]byte, 32)
			if _, err := rand.Read(seed); err != nil {
				return fail(err)
			}
			dir := "mem://" + nextHandle("dir")
			v, err := core.NewVault(pass, core.BrowserArgon(), core.NewMemKeyer(dir, seed))
			if err != nil {
				return fail(err)
			}
			h := nextHandle("vault")
			vaults[h] = v
			return ok(map[string]string{"handle": h})
		}),
		// vaultAdd stores plaintext under a fresh per-message key.
		"vaultAdd": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			v, found := vaults[h]
			if !found {
				return fail(fmt.Errorf("unknown vault"))
			}
			convRaw, err := getBin(m, "conv")
			if err != nil {
				return fail(err)
			}
			var conv [16]byte
			copy(conv[:], convRaw)
			text, _ := m["text"].(string)
			id, err := v.AddMessage(conv, []byte(text), 0)
			if err != nil {
				return fail(err)
			}
			return ok(map[string]string{"id": b64enc(id[:])})
		}),
		// vaultOpen decrypts one stored message.
		"vaultOpen": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			v, found := vaults[h]
			if !found {
				return fail(fmt.Errorf("unknown vault"))
			}
			convRaw, err := getBin(m, "conv")
			if err != nil {
				return fail(err)
			}
			idRaw, err := getBin(m, "id")
			if err != nil {
				return fail(err)
			}
			var conv, id [16]byte
			copy(conv[:], convRaw)
			copy(id[:], idRaw)
			plain, err := v.OpenMessage(conv, id, 0)
			if err != nil {
				return fail(err)
			}
			return ok(map[string]string{"text": string(plain)})
		}),
		// vaultNewConversation creates a conversation key.
		"vaultNewConversation": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			v, found := vaults[h]
			if !found {
				return fail(fmt.Errorf("unknown vault"))
			}
			conv, err := v.NewConversation()
			if err != nil {
				return fail(err)
			}
			return ok(map[string]string{"conv": b64enc(conv[:])})
		}),
		// vaultLock zeroes the master key. vaultForget drops a handle.
		"vaultLock": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			if v, found := vaults[h]; found {
				v.Lock()
			}
			return ok(map[string]string{"locked": "yes"})
		}),
		"forget": js.FuncOf(func(_ js.Value, call []js.Value) any {
			m, err := args0(call)
			if err != nil {
				return fail(err)
			}
			h, _ := m["handle"].(string)
			delete(identities, h)
			delete(chains, h)
			delete(receivers, h)
			if v, found := vaults[h]; found {
				v.Lock()
				delete(vaults, h)
			}
			return ok(map[string]string{"forgotten": "yes"})
		}),
	})
}

func main() {
	register()
	select {} // serve bridge calls forever
}
