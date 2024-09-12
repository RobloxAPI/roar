package docs

import (
	"net/url"
	"path"

	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

type docLinkTransformer struct {
	Context Context
}

func (t docLinkTransformer) transformLink(link string, image bool) (string, bool) {
	u, err := url.Parse(link)
	if err != nil {
		return "", false
	}
	if u.Host == "" {
		stem := u.Path
		var x url.URL
		if image {
			x = t.Context.BaseImageURL
			x.Path = path.Join(x.Path, stem)
		} else {
			ext := path.Ext(stem)
			if ext == ".md" {
				stem = stem[:len(stem)-len(ext)]
				if path.Base(stem) == "index" {
					stem = path.Dir(stem)
				}
			}
			x = t.Context.BaseURL
			if path.IsAbs(stem) {
				x.Path = path.Join(x.Path, stem)
			} else {
				x.Path = path.Join(x.Path, path.Dir(t.Context.Path), stem)
			}
			x.Fragment = u.Fragment
		}
		return x.String(), true
	}
	return "", false
}

func (t docLinkTransformer) Transform(node *ast.Document, reader text.Reader, pc parser.Context) {
	ast.Walk(node, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch n := n.(type) {
		case *ast.Link:
			if href, ok := t.transformLink(string(n.Destination), false); ok {
				n.Destination = []byte(href)
			}
			return ast.WalkSkipChildren, nil
		case *ast.Image:
			if href, ok := t.transformLink(string(n.Destination), true); ok {
				n.Destination = []byte(href)
			}
			return ast.WalkSkipChildren, nil
		}
		return ast.WalkContinue, nil
	})
}
