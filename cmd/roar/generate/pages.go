package generate

import (
	"bytes"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"

	"github.com/robloxapi/roar/index"
)

const PageTemplate = `+++
title = %[1]q
+++
`

type Pages map[string]struct{}

func (p Pages) Add(page string) {
	p[page] = struct{}{}
}

func (p Pages) Remove(page string) {
	delete(p, page)
}

func (p Pages) Print() {
	var keys []string
	for k := range p {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	fmt.Println("PAGES", len(keys))
	for _, k := range keys {
		fmt.Println("PAGE", k)
	}
}

func scanPages(paths ...string) Pages {
	pages := make(Pages, len(paths))
	for _, base := range paths {
		fs.WalkDir(os.DirFS(base), ".", func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			pages.Add(filepath.Join(base, path))
			return nil
		})
	}
	return pages
}

func generatePageType[T any](rootPath, typ string, pages Pages, m map[string]T) {
	basePath := filepath.Join(rootPath, typ)
	os.MkdirAll(basePath, 0755)
	pages.Remove(basePath)
	var buf bytes.Buffer

	// Generate index page for section, so that an alias can be configured.
	fmt.Fprintf(&buf,
		`+++
title = %[1]q
aliases = ['../%[1]s.html']
+++
`, typ)
	filePath := filepath.Join(basePath, "_index.md")
	if err := os.WriteFile(filePath, buf.Bytes(), 0666); err != nil {
		fmt.Printf("generate page _index.md: %s\n", err)
	} else {
		pages.Remove(filePath)
	}

	for name := range m {
		buf.Reset()
		fmt.Fprintf(&buf, PageTemplate, name)
		filePath := filepath.Join(basePath, name+".md")
		if err := os.WriteFile(filePath, buf.Bytes(), 0666); err != nil {
			fmt.Printf("generate page %q: %s\n", name, err)
			continue
		}
		pages.Remove(filePath)
	}
}

func GeneratePages(index *index.Root, rootPath string) {
	// Set of existing pages.
	pages := scanPages(
		filepath.Join(rootPath, "class"),
		filepath.Join(rootPath, "enum"),
		filepath.Join(rootPath, "type"),
		filepath.Join(rootPath, "updates"),
	)

	// Generate for each type of primary entity.
	generatePageType(rootPath, "class", pages, index.Class)
	generatePageType(rootPath, "enum", pages, index.Enum)
	generatePageType(rootPath, "type", pages, index.Type)

	// Generate pages for each year of changes.
	years := map[string]struct{}{}
	for i := index.MinYear; i <= index.MaxYear; i++ {
		years[strconv.Itoa(i)] = struct{}{}
	}
	generatePageType(rootPath, "updates", pages, years)

	// Remove untouched pages.
	for path := range pages {
		if err := os.RemoveAll(path); err != nil {
			fmt.Println(err)
			continue
		}
		fmt.Println("remove page", path)
	}
}
