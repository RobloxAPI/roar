package docs

import (
	"github.com/alecthomas/chroma/v2/formatters/html"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/yuin/goldmark"
	highlighting "github.com/yuin/goldmark-highlighting/v2"
	"github.com/yuin/goldmark/extension"
	rhtml "github.com/yuin/goldmark/renderer/html"
)

var Light = styles.Get("xcode")
var Dark = styles.Get("xcode-dark")
var Formatter = html.New(FormatterOptions...)
var FormatterOptions = []html.Option{
	html.TabWidth(4),
	html.ClassPrefix("_"),
	html.WithClasses(true),
	html.WithLineNumbers(true),
	html.LineNumbersInTable(true),
}
var Markdown = goldmark.New(
	goldmark.WithRendererOptions(
		rhtml.WithUnsafe(),
	),
	goldmark.WithExtensions(
		highlighting.NewHighlighting(
			highlighting.WithFormatOptions(FormatterOptions...),
		),
		extension.GFM,
	),
)
