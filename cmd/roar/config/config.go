// handles program configuration.
package config

import (
	"errors"
	"io"
	"os"
	"path/filepath"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Source string // Location of builds.
	Site   string // Location of Hugo site.
	Data   Data
}

type Data struct {
	Docs    bool // Whether to generate doc data.
	Dump    bool // Whether to generate dump data.
	Reflect bool // Whether to generate reflection metadata.
	None    bool // Force no extra data to be generated.
}

// Opens configuration. If stdin is not nil, then it is used. Otherwise, if path
// not empty, then config is read from the given path. If empty, the config will
// be tried from roar.toml in the working directory, then from roar/roar.toml in
// the user config directory.
func Open(path string, stdin io.Reader) (c Config, err error) {
	// From stdin.
	if stdin != nil {
		_, err = toml.NewDecoder(stdin).Decode(&c)
		return c.Normalize(), err
	}

	// From specified file.
	if path != "" {
		_, err = toml.DecodeFile(path, &c)
		return c.Normalize(), err
	}

	// From working directory.
	path = "roar.toml"
	if _, err = toml.DecodeFile(path, &c); !errors.Is(err, os.ErrNotExist) {
		return c.Normalize(), err
	}

	// From user config.
	configDir, err := os.UserConfigDir()
	if err != nil {
		return c.Normalize(), nil
	}
	path = filepath.Join(configDir, "roar", "roar.toml")
	if _, err = toml.DecodeFile(path, &c); !errors.Is(err, os.ErrNotExist) {
		return c.Normalize(), err
	}

	// Default config.
	return Config{}.Normalize(), nil
}

func (c Config) Normalize() Config {
	if !c.Data.Docs && !c.Data.Dump && !c.Data.Reflect && !c.Data.None {
		c.Data.Docs = true
		c.Data.Dump = true
		c.Data.Reflect = true
	}
	return c
}
