// Provides documentation data.
package docs

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/url"
	"os"
	"path"
	"strings"

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

// Receives a JSON object and a key, and transforms its value.
type XFM func(outer any, key string) error

type Transformer struct {
	Method XFM
	Path   []string
}

// If outer is an object, deletes key from it.
func xfmRemove(outer any, key string) error {
	switch outer := outer.(type) {
	case map[string]any:
		delete(outer, key)
	}
	return nil
}

// Fixes a field value by cutting according to sep, and setting the field to the
// portion after sep.
func xfmFixName(sep string) XFM {
	return func(outer any, key string) error {
		o, ok := outer.(map[string]any)
		if !ok {
			return nil
		}
		v, ok := o[key].(string)
		if !ok {
			return nil
		}
		if _, name, ok := strings.Cut(v, sep); ok {
			v = name
		}
		o[key] = v
		return nil
	}
}

// List of transformations to apply to docs data.
var transformers = []Transformer{
	{xfmRemove, []string{"Class", "", "name"}},
	{xfmRemove, []string{"Class", "", "inherits"}},
	{xfmRemove, []string{"Class", "", "memory_category"}},
	{xfmRemove, []string{"Class", "", "tags"}},
	{xfmRemove, []string{"Class", "", "type"}},
	{xfmRemove, []string{"Class", "", "properties", "", "category"}},
	{xfmRemove, []string{"Class", "", "properties", "", "security"}},
	{xfmRemove, []string{"Class", "", "properties", "", "serialization"}},
	{xfmRemove, []string{"Class", "", "properties", "", "tags"}},
	{xfmRemove, []string{"Class", "", "properties", "", "thread_safety"}},
	{xfmRemove, []string{"Class", "", "properties", "", "type"}},
	{xfmRemove, []string{"Class", "", "methods", "", "parameters"}},
	{xfmRemove, []string{"Class", "", "methods", "", "returns"}},
	{xfmRemove, []string{"Class", "", "methods", "", "security"}},
	{xfmRemove, []string{"Class", "", "methods", "", "tags"}},
	{xfmRemove, []string{"Class", "", "methods", "", "thread_safety"}},
	{xfmRemove, []string{"Class", "", "events", "", "parameters"}},
	{xfmRemove, []string{"Class", "", "events", "", "security"}},
	{xfmRemove, []string{"Class", "", "events", "", "tags"}},
	{xfmRemove, []string{"Class", "", "events", "", "thread_safety"}},
	{xfmRemove, []string{"Class", "", "callbacks", "", "parameters"}},
	{xfmRemove, []string{"Class", "", "callbacks", "", "returns"}},
	{xfmRemove, []string{"Class", "", "callbacks", "", "security"}},
	{xfmRemove, []string{"Class", "", "callbacks", "", "tags"}},
	{xfmRemove, []string{"Class", "", "callbacks", "", "thread_safety"}},
	{xfmRemove, []string{"Enum", "", "name"}},
	{xfmRemove, []string{"Enum", "", "tags"}},
	{xfmRemove, []string{"Enum", "", "type"}},
	{xfmRemove, []string{"Enum", "", "items", "", "tags"}},
	{xfmRemove, []string{"Enum", "", "items", "", "value"}},
	{xfmRemove, []string{"Type", "", "name"}},
	{xfmRemove, []string{"Type", "", "type"}},
	{xfmFixName("."), []string{"Class", "", "properties", "", "name"}},
	{xfmFixName(":"), []string{"Class", "", "methods", "", "name"}},
	{xfmFixName("."), []string{"Class", "", "events", "", "name"}},
	{xfmFixName("."), []string{"Class", "", "callbacks", "", "name"}},
	{xfmFixName("."), []string{"Type", "", "constants", "", "name"}},
	{xfmFixName("."), []string{"Type", "", "constructors", "", "name"}},
	{xfmFixName("."), []string{"Type", "", "functions", "", "name"}},
	{xfmFixName(":"), []string{"Type", "", "methods", "", "name"}},
	{xfmFixName("."), []string{"Type", "", "properties", "", "name"}},
}

// Applies a list of transformers to d.
func transformData(d any, transformers []Transformer) {
	for _, t := range transformers {
		transformStruct(d, t.Method, t.Path...)
	}
}

// Applies xfm to the target of path under d, if present.
func transformStruct(d any, xfm XFM, path ...string) {
	if len(path) == 0 {
		return
	}
	key := path[0]
	if len(path) == 1 {
		xfm(d, key)
		return
	}
	switch d := d.(type) {
	case map[string]any:
		if key == "" {
			for _, v := range d {
				transformStruct(v, xfm, path[1:]...)
			}
		} else {
			transformStruct(d[key], xfm, path[1:]...)
		}
	case []any:
		if key == "" {
			for _, v := range d {
				transformStruct(v, xfm, path[1:]...)
			}
		}
	}
}

// Rearranges outer[field] from a list of objects to a map of names to objects.
// If an object does not have a "name" field, then it is discarded.
func rearrangeMembers(members, outer map[string]any, field string) {
	m, _ := outer[field].([]any)
	for _, member := range m {
		member := member.(map[string]any)
		name, ok := member["name"].(string)
		if !ok {
			continue
		}
		members[name] = member
		delete(member, "name")
	}
	delete(outer, field)
}

func rearrangeStructure(d map[string]any) {
	members := map[string]map[string]any{}
	d["Member"] = members
	for className, class := range d["Class"].(map[string]any) {
		class := class.(map[string]any)
		classMembers := map[string]any{}
		members[className] = classMembers
		rearrangeMembers(classMembers, class, "properties")
		rearrangeMembers(classMembers, class, "methods")
		rearrangeMembers(classMembers, class, "events")
		rearrangeMembers(classMembers, class, "callbacks")
	}

	items := map[string]map[string]any{}
	d["EnumItem"] = items
	for enumName, enum := range d["Enum"].(map[string]any) {
		enum := enum.(map[string]any)
		enumItems := map[string]any{}
		items[enumName] = enumItems
		rearrangeMembers(enumItems, enum, "items")
	}
}

// Converts field names from snake_case to UpperCamelCase.
func toUpperCamelCase(d any) {
	switch d := d.(type) {
	case map[string]any:
		var keys []string
		for k := range d {
			keys = append(keys, k)
		}
		for _, k := range keys {
			words := strings.Split(k, "_")
			for i, word := range words {
				if len(word) > 0 {
					words[i] = strings.ToUpper(word[:1]) + word[1:]
				}
			}
			v := d[k]
			delete(d, k)
			d[strings.Join(words, "")] = v
			toUpperCamelCase(v)
		}
	case []any:
		for _, v := range d {
			toUpperCamelCase(v)
		}
	}
}

// Normalizes the casing of field names.
func fixCase(d map[string]any) {
	for _, class := range d["Class"].(map[string]any) {
		toUpperCamelCase(class)
	}
	for _, enum := range d["Enum"].(map[string]any) {
		toUpperCamelCase(enum)
	}
	for _, class := range d["Member"].(map[string]map[string]any) {
		for _, member := range class {
			toUpperCamelCase(member)
		}
	}
	for _, enum := range d["EnumItem"].(map[string]map[string]any) {
		for _, item := range enum {
			toUpperCamelCase(item)
		}
	}
	for _, typ := range d["Type"].(map[string]any) {
		toUpperCamelCase(typ)
	}
}

// Represents the YAML content of a file.
type yml map[string]any

// Maps file names to YAML content.
type files map[string]yml

// Represents the engine directory.
type data struct {
	Class files
	Enum  files
	Type  files
}

// Compiles documentation files from source to a single data file located at
// output. source is expected to be the "engine" directory of the creator-docs
// repo.
func generate(output string, source fs.FS) (err error) {
	var d data

	if d.Class, err = generateFiles(source, "classes"); err != nil {
		return err
	}
	if d.Enum, err = generateFiles(source, "enums"); err != nil {
		return err
	}
	if d.Type, err = generateFiles(source, "datatypes"); err != nil {
		return err
	}

	var buf bytes.Buffer

	// Write full content.
	je := json.NewEncoder(&buf)
	if err := je.Encode(d); err != nil {
		return err
	}

	// Decode as json, which has known structure for empty interface type.
	var dd map[string]any
	jd := json.NewDecoder(&buf)
	if err := jd.Decode(&dd); err != nil {
		return err
	}

	transformData(dd, transformers)
	rearrangeStructure(dd)
	fixCase(dd)

	// Encode transformed structure.
	buf.Reset()
	je = json.NewEncoder(&buf)
	if err := je.Encode(dd); err != nil {
		return err
	}

	// Decode according to root handle optional fields.
	var root Root
	jd = json.NewDecoder(&buf)
	if err := jd.Decode(&root); err != nil {
		return err
	}

	j, err := os.Create(output)
	if err != nil {
		return err
	}
	defer j.Close()

	je = json.NewEncoder(j)
	je.SetEscapeHTML(false)
	je.SetIndent("", "\t")
	if err := je.Encode(root); err != nil {
		return err
	}

	return nil
}

// Compiles a directory of YAML files into a map of file stems to file content.
// Ignores non-YAML files.
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
