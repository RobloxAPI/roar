// For executing command-line scripts.
package script

import (
	"bytes"
	"fmt"
	"os/exec"
)

type Command []string
type Script []Command

func (s Script) Run() error {
	for _, c := range s {
		cmd := exec.Command(c[0], c[1:]...)
		var buf bytes.Buffer
		cmd.Stderr = &buf
		if err := cmd.Run(); err != nil {
			if buf.Len() == 0 {
				return fmt.Errorf("run %v: %w", c, err)
			}
			return fmt.Errorf("run %v: %w\n%s", c, err, &buf)
		}
	}
	return nil
}
