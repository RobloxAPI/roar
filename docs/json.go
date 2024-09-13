package docs

import (
	"bytes"
	"errors"
	"fmt"
	"net/url"
	"path"

	"github.com/PuerkitoBio/goquery"
	"github.com/andybalholm/cascadia"
	"github.com/robloxapi/roar/id"
	"golang.org/x/net/html"
)

type Renderer interface {
	// Recursively replace markdown fields with rendered HTML.
	RenderHTML(ctx Context) error
}

// Extra context for renderer.
type Context struct {
	// Base URL for external doc website.
	BaseURL url.URL
	// Path within base corresponding to renderer object.
	Path string
	// Base URL for external image CDN.
	BaseImageURL url.URL

	// Heading level to use.
	Level int
	// Heading levels for summary section.
	SummaryLevel int
	// Heading levels for description section.
	DescriptionLevel int
}

// Returns ctx with s appended to the Path.
func (ctx Context) AppendPath(s ...string) Context {
	ctx.Path = path.Join(append([]string{ctx.Path}, s...)...)
	return ctx
}

// Returns ctx with heading levels set.
func (ctx Context) SetLevels(summ, desc int) Context {
	ctx.SummaryLevel = summ
	ctx.DescriptionLevel = desc
	return ctx
}

// Returns ctx with used heading level set.
func (ctx Context) UseLevel(level int) Context {
	ctx.Level = level
	return ctx
}

type Root struct {
	Class    map[id.Class]*Class
	Member   map[id.Class]map[id.Member]*Member
	Enum     map[id.Enum]*Enum
	EnumItem map[id.Enum]map[id.EnumItem]*EnumItem
	Type     map[id.Type]*Type
}

func (r *Root) RenderHTML(ctx Context) error {
	//TODO: Accumulates nils.
	var errs []error
	ctx = ctx.AppendPath("reference", "engine")
	for class, v := range r.Class {
		errs = append(errs, v.RenderHTML(ctx.AppendPath("classes", class).SetLevels(1, 2)))
	}
	for class, v := range r.Member {
		for _, v := range v {
			errs = append(errs, v.RenderHTML(ctx.AppendPath("classes", class).SetLevels(3, 3)))
		}
	}
	for enum, v := range r.Enum {
		errs = append(errs, v.RenderHTML(ctx.AppendPath("enums", enum).SetLevels(1, 2)))
	}
	for enum, v := range r.EnumItem {
		for _, v := range v {
			errs = append(errs, v.RenderHTML(ctx.AppendPath("enums", enum).SetLevels(0, 0)))
		}
	}
	for typ, v := range r.Type {
		errs = append(errs, v.RenderHTML(ctx.AppendPath("datatypes", typ).SetLevels(1, 2)))
	}
	return errors.Join(errs[:1]...)
}

type Doc struct {
	Summary            string   `json:",omitempty"`
	Description        string   `json:",omitempty"`
	DeprecationMessage string   `json:",omitempty"`
	CodeSamples        []string `json:",omitempty"`
}

var matchBody = cascadia.MustCompile("body")

func renderHTML(ctx Context, source *string) error {
	// Render markdown to HTML.
	var buf bytes.Buffer
	if err := Markdown.Convert([]byte(*source), &buf); err != nil {
		// Skip and warn.
		*source = ""
		fmt.Printf("WARN: %s: markdown: %s\n", ctx.Path, err)
		return nil
	}

	// Transform HTML.
	q, err := goquery.NewDocumentFromReader(&buf)
	if err != nil {
		// Skip and warn.
		*source = ""
		fmt.Printf("WARN: %s: goquery: %s\n", ctx.Path, err)
		return nil
	}

	docLinkTransformer{Context: ctx}.Transform(q.Selection)
	docCodeSpanTransformer{baseURL: "ref"}.Transform(q.Selection)
	docHeadingTransformer{SectionLevel: ctx.Level}.Transform(q.Selection)

	buf.Reset()
	q.Selection.FindMatcher(matchBody).Each(func(i int, s *goquery.Selection) {
		body := s.Nodes[0]
		for c := body.FirstChild; c != nil; c = c.NextSibling {
			if err := html.Render(&buf, c); err != nil {
				// Skip and warn.
				buf.Reset()
				fmt.Printf("WARN: %s: goquery render: %s\n", ctx.Path, err)
				return
			}
		}
	})

	*source = buf.String()
	return nil
}

func (d *Doc) RenderHTML(ctx Context) error {
	//TODO: Accumulates nils.
	var errs []error
	errs = append(errs, renderHTML(ctx.UseLevel(ctx.SummaryLevel), &d.Summary))
	errs = append(errs, renderHTML(ctx.UseLevel(ctx.DescriptionLevel), &d.Description))
	errs = append(errs, renderHTML(ctx.UseLevel(0), &d.DeprecationMessage))
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

func (t *Type) RenderHTML(ctx Context) error {
	//TODO: Accumulates nils.
	var errs []error
	errs = append(errs, t.Doc.RenderHTML(ctx))
	for i, v := range t.Constants {
		errs = append(errs, v.RenderHTML(ctx.SetLevels(3, 3)))
		t.Constants[i] = v
	}
	for i, v := range t.Constructors {
		errs = append(errs, v.RenderHTML(ctx.SetLevels(3, 3)))
		t.Constructors[i] = v
	}
	for i, v := range t.Functions {
		errs = append(errs, v.RenderHTML(ctx.SetLevels(3, 3)))
		t.Functions[i] = v
	}
	for i, v := range t.Properties {
		errs = append(errs, v.RenderHTML(ctx.SetLevels(3, 3)))
		t.Properties[i] = v
	}
	for i, v := range t.Methods {
		errs = append(errs, v.RenderHTML(ctx.SetLevels(3, 3)))
		t.Methods[i] = v
	}
	for i, v := range t.MathOperations {
		errs = append(errs, v.RenderHTML(ctx.SetLevels(3, 3)))
		t.MathOperations[i] = v
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
