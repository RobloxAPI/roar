// Provides documentation data.
package docs

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type script [][]string

func (s script) Run() error {
	for _, c := range s {
		cmd := exec.Command(c[0], c[1:]...)
		var buf bytes.Buffer
		cmd.Stderr = &buf
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("run %v: %w\n%s", c, err, &buf)
		}
	}
	return nil
}

// Checkout pulls data from a Git repository. dir is the directory to which the
// repository will be cloned. remote is the URL of the repository. refspec
// indicates the ref to pull. Sparse checkout is used to pull only the desired
// files: content indicates which files to pull.
//
// The caller must ensure that the given directory is empty or otherwise
// prepared to receive data.
//
// Attempts to remove the .git directory, leaving only the requested data.
//
// Requires git to be available in PATH.
func Checkout(dir, remote, refspec string, content []string) error {
	// Early sanity check for git.
	if err := exec.Command("git", "version").Run(); err != nil {
		return fmt.Errorf("check for git: %w", err)
	}

	// Generate sparse-checkout file.
	sparsePath := filepath.Join(dir, ".git", "info", "sparse-checkout")
	if err := os.MkdirAll(filepath.Dir(sparsePath), 0755); err != nil {
		return fmt.Errorf("create sparse-checkout directory: %w", err)
	}
	f, err := os.Create(sparsePath)
	if err != nil {
		return fmt.Errorf("create sparse-checkout file: %w", err)
	}
	for _, path := range content {
		f.WriteString(path)
		f.WriteString("\n")
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("write sparse-checkout file: %w", err)
	}

	// Run git commands.
	if err := (script{
		{"git", "-C", dir, "init"},
		{"git", "-C", dir, "remote", "add", "-f", "origin", remote},
		{"git", "-C", dir, "config", "core.sparseCheckout", "true"},
		{"git", "-C", dir, "pull", "origin", refspec},
	}.Run()); err != nil {
		return fmt.Errorf("run script: %w", err)
	}

	// Atempt to remove .git.
	os.RemoveAll(filepath.Join(dir, ".git"))

	return nil
}
