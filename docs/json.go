package docs

import (
	"errors"
	"strings"

	"github.com/robloxapi/roar/id"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/parser"
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
