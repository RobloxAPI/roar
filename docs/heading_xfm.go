package docs

import (
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

type docHeadingTransformer struct {
	SectionLevel int
}

func (t docHeadingTransformer) Transform(node *ast.Document, reader text.Reader, pc parser.Context) {
	if t.SectionLevel == 0 {
		return
	}
	var topLevel int = 10000
	ast.Walk(node, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch n := n.(type) {
		case *ast.Heading:
			if n.Level < topLevel {
				topLevel = n.Level
			}
			return ast.WalkSkipChildren, nil
		}
		return ast.WalkContinue, nil
	})
	if topLevel >= 10000 {
		return
	}
	ast.Walk(node, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch n := n.(type) {
		case *ast.Heading:
			n.Level += t.SectionLevel - topLevel + 1
			if n.Level > 6 {
				n.Level = 6
			}
			return ast.WalkSkipChildren, nil
		}
		return ast.WalkContinue, nil
	})
}
