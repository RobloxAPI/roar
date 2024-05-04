package generate

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
)

//go:embed manifest.json
var ManifestEmbed []byte

type Manifest struct {
	Schema string `json:"schema"`
}

var ErrSchemaMismatch = errors.New("schema mismatch")

func ReadManifest(manPath string) (manifest Manifest, err error) {
	if err := json.Unmarshal(ManifestEmbed, &manifest); err != nil {
		panic(err)
	}
	if f, err := os.Open(manPath); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return manifest, fmt.Errorf("open %s: %w", historyData, err)
		}
	} else {
		var stored Manifest
		defer f.Close()
		if err = json.NewDecoder(f).Decode(&stored); err != nil {
			return manifest, fmt.Errorf("decode %s: %w", historyData, err)
		}
		if stored.Schema != manifest.Schema {
			return stored, ErrSchemaMismatch
		}
	}
	return manifest, nil
}

func WriteManifest(manPath string, manifest Manifest) error {
	f, err := os.Create(manPath)
	if err != nil {
		return err
	}
	defer f.Close()
	je := json.NewEncoder(f)
	je.SetEscapeHTML(false)
	je.SetIndent("", "")
	return je.Encode(manifest)
}
