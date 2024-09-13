package docs

import (
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/andybalholm/cascadia"
	"golang.org/x/net/html"
)

var parseLinkSyntax = regexp.MustCompile(`^(\w+)\.((\w+)(?:[\.:](\w+))?.*?)(?:\|(.*))?$`)

type docCodeSpanTransformer struct {
	baseURL string
}

func (t docCodeSpanTransformer) transformText(input string) (content, href string) {
	if len(input) == 0 {
		return "", ""
	}
	cap := parseLinkSyntax.FindStringSubmatch(input)
	if cap == nil {
		return "", ""
	}
	kind := cap[1] // Kind of link.
	text := cap[2] // Text portion of link.
	prim := cap[3] // Primary ID.
	sec := cap[4]  // Optional secondary ID.
	sub := cap[5]  // Optional substitution.

	if sub == "no-link" {
		before, _, _ := strings.Cut(input, "|")
		return before, sub
	}

	baseURL := strings.Trim(t.baseURL, "/")
	if baseURL != "" {
		baseURL += "/"
	}
	baseURL = "/" + baseURL

	var h []byte
	switch kind {
	case "Class":
		content = text
		h = append(h, baseURL...)
		h = append(h, "class/"...)
		h = append(h, prim...)
		h = append(h, ".html"...)
		if len(sec) > 0 {
			h = append(h, "#member-"...)
			h = append(h, sec...)
		}
	case "Datatype":
		content = text
		h = append(h, baseURL...)
		h = append(h, "type/"...)
		h = append(h, prim...)
		h = append(h, ".html"...)
		if len(sec) > 0 {
			h = append(h, "#member-"...)
			h = append(h, sec...)
		}
	case "Enum":
		content = text
		h = append(h, baseURL...)
		h = append(h, "enum/"...)
		h = append(h, prim...)
		h = append(h, ".html"...)
	case "Global":
		content = text[len(prim)+1:]
		h = append(h, "https://create.roblox.com/docs/reference/engine/globals/"...)
		h = append(h, prim...)
		h = append(h, "#"...)
		h = append(h, sec...)
	case "Library":
		content = text
		h = append(h, "https://create.roblox.com/docs/reference/engine/libraries/"...)
		h = append(h, prim...)
		h = append(h, "#"...)
		h = append(h, sec...)
	}
	if len(sub) > 0 {
		content = sub
	}
	return content, string(h)
}

var matchCodeSpan = cascadia.MustCompile(":not(pre) > code")

func (t docCodeSpanTransformer) Transform(s *goquery.Selection) {
	s.FindMatcher(matchCodeSpan).Each(func(i int, s *goquery.Selection) {
		text := s.Text()
		if strings.Index(text, "\n") > -1 {
			return
		}
		content, href := t.transformText(text)
		if href == "" {
			return
		}
		if href == "no-link" {
			s.SetText(content)
			return
		}
		link := &html.Node{
			Type: html.ElementNode,
			Data: "a",
			Attr: []html.Attribute{{Key: "href", Val: href}},
			FirstChild: &html.Node{
				Type: html.TextNode,
				Data: content,
			},
		}
		s.ReplaceWithNodes(link)
	})
}
