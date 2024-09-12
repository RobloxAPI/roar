package docs

import (
	"github.com/alecthomas/chroma/v2/formatters/html"
	"github.com/alecthomas/chroma/v2/styles"
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
