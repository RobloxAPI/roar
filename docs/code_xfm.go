package docs

import (
	"bytes"
	"regexp"
	"strings"

	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

var parseLinkSyntax = regexp.MustCompile(`^(\w+)\.((\w+)(?:[\.:](\w+))?.*?)(?:\|(.*))?$`)

type docCodeSpanTransformer struct {
	baseURL string
}

func (t docCodeSpanTransformer) transformText(input []byte) (content, href []byte) {
	if len(input) == 0 {
		return nil, nil
	}
	cap := parseLinkSyntax.FindSubmatch(input)
	if cap == nil {
		return nil, nil
	}
	kind := cap[1] // Kind of link.
	text := cap[2] // Text portion of link.
	prim := cap[3] // Primary ID.
	sec := cap[4]  // Optional secondary ID.
	sub := cap[5]  // Optional substitution.

	if string(sub) == "no-link" {
		before, _, _ := bytes.Cut(input, []byte("|"))
		return before, sub
	}

	baseURL := strings.Trim(t.baseURL, "/")
	if baseURL != "" {
		baseURL += "/"
	}
	baseURL = "/" + baseURL
	switch string(kind) {
	case "Class":
		content = text
		href = append(href, baseURL...)
		href = append(href, "class/"...)
		href = append(href, prim...)
		href = append(href, ".html"...)
		if len(sec) > 0 {
			href = append(href, "#member-"...)
			href = append(href, sec...)
		}
	case "Datatype":
		content = text
		href = append(href, baseURL...)
		href = append(href, "type/"...)
		href = append(href, prim...)
		href = append(href, ".html"...)
		if len(sec) > 0 {
			href = append(href, "#member-"...)
			href = append(href, sec...)
		}
	case "Enum":
		content = text
		href = append(href, baseURL...)
		href = append(href, "enum/"...)
		href = append(href, prim...)
		href = append(href, ".html"...)
	case "Global":
		content = text[len(prim)+1:]
		href = append(href, "https://create.roblox.com/docs/reference/engine/globals/"...)
		href = append(href, prim...)
		href = append(href, "#"...)
		href = append(href, sec...)
	case "Library":
		content = text
		href = append(href, "https://create.roblox.com/docs/reference/engine/libraries/"...)
		href = append(href, prim...)
		href = append(href, "#"...)
		href = append(href, sec...)
	}
	if len(sub) > 0 {
		content = sub
	}
	return content, href
}

func (t docCodeSpanTransformer) transformCodeSpan(n *ast.CodeSpan, reader text.Reader) ast.Node {
	if n.ChildCount() != 1 {
		return nil
	}
	textNode, ok := n.FirstChild().(*ast.Text)
	if !ok {
		return nil
	}
	text := reader.Value(textNode.Segment)
	content, href := t.transformText(text)
	if len(href) == 0 {
		return nil
	} else if string(href) == "no-link" {
		codeNode := ast.NewCodeSpan()
		contentNode := ast.NewString(content)
		codeNode.AppendChild(codeNode, contentNode)
		return codeNode
	}

	linkNode := ast.NewLink()
	linkNode.Destination = href
	contentNode := ast.NewString(content)
	linkNode.AppendChild(linkNode, contentNode)
	return linkNode
}

func (t docCodeSpanTransformer) Transform(node *ast.Document, reader text.Reader, pc parser.Context) {
	var replacements [][2]ast.Node
	ast.Walk(node, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering {
			return ast.WalkContinue, nil
		}
		switch n := n.(type) {
		case *ast.CodeSpan:
			newNode := t.transformCodeSpan(n, reader)
			if newNode == nil {
				return ast.WalkContinue, nil
			}
			replacements = append(replacements, [2]ast.Node{n, newNode})
			return ast.WalkSkipChildren, nil
		}
		return ast.WalkContinue, nil
	})
	for _, rep := range replacements {
		parent := rep[0].Parent()
		parent.ReplaceChild(parent, rep[0], rep[1])
	}
}
