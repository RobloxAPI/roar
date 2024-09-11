package docs

import (
	"bytes"
	"errors"
	"regexp"
	"strings"

	"github.com/robloxapi/roar/id"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
	"github.com/yuin/goldmark/util"
)

type Renderer interface {
	// Recursively replace markdown fields with rendered HTML.
	RenderHTML() error
}

type Root struct {
	Class    map[id.Class]*Class
	Member   map[id.Class]map[id.Member]*Member
	Enum     map[id.Enum]*Enum
	EnumItem map[id.Enum]map[id.EnumItem]*EnumItem
	Type     map[id.Type]*Type
}

func (r *Root) RenderHTML() error {
	//TODO: Accumulates nils.
	var errs []error
	for _, v := range r.Class {
		errs = append(errs, v.RenderHTML())
	}
	for _, v := range r.Member {
		for _, v := range v {
			errs = append(errs, v.RenderHTML())
		}
	}
	for _, v := range r.Enum {
		errs = append(errs, v.RenderHTML())
	}
	for _, v := range r.EnumItem {
		for _, v := range v {
			errs = append(errs, v.RenderHTML())
		}
	}
	for _, v := range r.Type {
		errs = append(errs, v.RenderHTML())
	}
	return errors.Join(errs[:1]...)
}

type Doc struct {
	Summary            string   `json:",omitempty"`
	Description        string   `json:",omitempty"`
	DeprecationMessage string   `json:",omitempty"`
	CodeSamples        []string `json:",omitempty"`
}

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

var codeSpanTransformer = docCodeSpanTransformer{
	baseURL: "ref",
}

var markdown = goldmark.New(
	goldmark.WithParser(parser.NewParser(
		parser.WithBlockParsers(parser.DefaultBlockParsers()...),
		parser.WithInlineParsers(parser.DefaultInlineParsers()...),
		parser.WithParagraphTransformers(parser.DefaultParagraphTransformers()...),
		parser.WithASTTransformers(util.Prioritized(codeSpanTransformer, 1010)),
	)),
)

func renderHTML(source *string) error {
	var buf strings.Builder
	if err := markdown.Convert([]byte(*source), &buf); err != nil {
		return err
	}
	*source = buf.String()
	return nil
}

func (d *Doc) RenderHTML() error {
	//TODO: Accumulates nils.
	var errs []error
	errs = append(errs, renderHTML(&d.Summary))
	errs = append(errs, renderHTML(&d.Description))
	errs = append(errs, renderHTML(&d.DeprecationMessage))
	return errors.Join(errs...)
}

type Class struct {
	Category string `json:",omitempty"`
	Doc
}
type Member struct {
	Doc
}
type Enum struct {
	Doc
}
type EnumItem struct {
	Doc
}
type Type struct {
	Constants      []Constant    `json:",omitempty"`
	Constructors   []Constructor `json:",omitempty"`
	Functions      []Function    `json:",omitempty"`
	Properties     []Property    `json:",omitempty"`
	Methods        []Method      `json:",omitempty"`
	MathOperations []Operation   `json:",omitempty"`
	Tags           []string      `json:",omitempty"`
	Doc
}

func (t *Type) RenderHTML() error {
	//TODO: Accumulates nils.
	var errs []error
	errs = append(errs, t.Doc.RenderHTML())
	for _, v := range t.Constants {
		errs = append(errs, v.RenderHTML())
	}
	for _, v := range t.Constructors {
		errs = append(errs, v.RenderHTML())
	}
	for _, v := range t.Functions {
		errs = append(errs, v.RenderHTML())
	}
	for _, v := range t.Properties {
		errs = append(errs, v.RenderHTML())
	}
	for _, v := range t.Methods {
		errs = append(errs, v.RenderHTML())
	}
	for _, v := range t.MathOperations {
		errs = append(errs, v.RenderHTML())
	}
	return errors.Join(errs...)
}

type Constant struct {
	Name string
	Type string
	Tags []string `json:",omitempty"`
	Doc
}
type Constructor struct {
	Name       string
	Parameters []Parameter
	Tags       []string `json:",omitempty"`
	Doc
}
type Function struct {
	Name       string
	Parameters []Parameter
	Returns    []Return
	Tags       []string `json:",omitempty"`
	Doc
}
type Property struct {
	Name string
	Type string
	Tags []string `json:",omitempty"`
	Doc
}
type Method struct {
	Name       string
	Parameters []Parameter
	Returns    []Return
	Tags       []string `json:",omitempty"`
	Doc
}
type Operation struct {
	Operation  string
	TypeA      string
	TypeB      string
	ReturnType string
	Tags       []string `json:",omitempty"`
	Doc
}

type Parameter struct {
	Name    string
	Type    string
	Default any
	Summary string `json:",omitempty"`
}
type Return struct {
	Type    string
	Summary string `json:",omitempty"`
}
