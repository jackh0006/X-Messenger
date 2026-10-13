// SPDX-License-Identifier: MIT
// X Messenger Windows GUI launcher (by jackh0006).
// Finds node.exe on PATH and spawns the offline GUI (loopback-only).
// No network code here: exec + path lookup only. Ship as X-Messenger-GUI.exe.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	if len(os.Args) > 1 && (os.Args[1] == "--help" || os.Args[1] == "-h" || os.Args[1] == "help") {
		fmt.Println("X Messenger GUI launcher (by jackh0006)")
		fmt.Println("Opens the offline GUI via node. Requires Node.js 18+ and openssl on PATH.")
		fmt.Println("Usage: X-Messenger-GUI.exe [gui args...]")
		return
	}
	exe, err := os.Executable()
	if err != nil {
		fmt.Fprintln(os.Stderr, "X Messenger: cannot locate install dir")
		os.Exit(1)
	}
	root := filepath.Dir(exe)
	// Portable ZIP layout: <root>/X-Messenger-GUI.exe next to x-messenger.cmd,
	// app in <root>/app. NSIS layout: $INSTDIR with same files.
	candidates := []string{
		filepath.Join(root, "app", "bin", "cipherlink"),
		filepath.Join(root, "x-messenger-1.4.2", "app", "bin", "cipherlink"),
	}
	var app string
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			app = c
			break
		}
	}
	if app == "" {
		// Fallback: <root>/app layout.
		app = filepath.Join(root, "app", "bin", "cipherlink")
	}
	node, err := exec.LookPath("node.exe")
	if err != nil {
		node, err = exec.LookPath("node")
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "X Messenger needs Node.js 18+ on PATH. Install Node 20 LTS from nodejs.org, then retry.")
		fmt.Fprintln(os.Stderr, "Windows x86 (32-bit): use Node 18 32-bit (EOL, insecure) — x64/arm64 with Node 20 LTS preferred.")
		os.Exit(2)
	}
	args := append([]string{app, "gui"}, os.Args[1:]...)
	cmd := exec.Command(node, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			os.Exit(ee.ExitCode())
		}
		fmt.Fprintln(os.Stderr, "X Messenger:", err)
		os.Exit(1)
	}
}
