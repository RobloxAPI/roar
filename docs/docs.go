// Provides documentation data.
package docs

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path"

	"github.com/robloxapi/roar/git"
	"gopkg.in/yaml.v3"
)

// Write JSON file to output from source. source may be a creator-docs-formatted
// directory, or an HTTP URL to a git repository.
func Write(output, source string) error {
	var repo fs.FS
	sourceURL, _ := url.Parse(source)
	if sourceURL.Scheme == "http" || sourceURL.Scheme == "https" {
		tmp, err := os.MkdirTemp(".", "session-")
		if err != nil {
			return err
		}
		defer func() {
			os.RemoveAll(tmp)
		}()
		const basePath = "content/en-us/reference/engine"
		err = git.Checkout(tmp, source, "main", []string{
			path.Join(basePath, "classes"),
			path.Join(basePath, "datatypes"),
			path.Join(basePath, "enums"),
		})
		if err != nil {
			return err
		}
		repo = os.DirFS(path.Join(tmp, basePath))
		fmt.Println("DOCS TEMP", tmp)
	} else {
		repo = os.DirFS(source)
	}
	return generate(output, repo)
}

type yml map[string]any

type files map[string]yml

type data struct {
	Class files
	Enum  files
	Type  files
}

// source is expected to be the "engine" directory of the creator-docs repo.
func generate(output string, source fs.FS) error {
	var d data

	j, err := os.Create(output)
	if err != nil {
		return err
	}
	defer j.Close()

	if d.Class, err = generateFiles(source, "classes"); err != nil {
		return err
	}
	if d.Enum, err = generateFiles(source, "enums"); err != nil {
		return err
	}
	if d.Type, err = generateFiles(source, "datatypes"); err != nil {
		return err
	}

	je := json.NewEncoder(j)
	je.SetEscapeHTML(false)
	je.SetIndent("", "\t")
	return je.Encode(d)
}

func generateFiles(source fs.FS, root string) (files, error) {
	f := files{}
	errs := 0
	err := fs.WalkDir(source, root, func(p string, d fs.DirEntry, err error) error {
		if errs > 10 {
			return fmt.Errorf("too many errors")
		}
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		ext := path.Ext(p)
		if ext != ".yaml" {
			return nil
		}
		key := path.Base(p)
		key = key[:len(key)-len(ext)]

		file, err := source.Open(p)
		if err != nil {
			errs++
			fmt.Println(err)
			return nil
		}
		defer file.Close()
		yd := yaml.NewDecoder(file)
		var y yml
		if err := yd.Decode(&y); err != nil {
			errs++
			fmt.Printf("decode %s: %s\n", p, err)
			return nil
		}
		f[key] = y
		return nil
	})
	if err != nil {
		return nil, err
	}
	return f, nil
}
