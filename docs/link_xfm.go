package docs

import (
	"net/url"
	"path"

	"github.com/PuerkitoBio/goquery"
	"github.com/andybalholm/cascadia"
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
			if path.IsAbs(stem) {
				x.Path = path.Join(x.Path, stem)
			} else {
				x.Path = path.Join(x.Path, path.Dir(t.Context.Path), stem)
			}
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

var matchLink = cascadia.MustCompile("a[href]")
var matchImage = cascadia.MustCompile("img[src]")

func (t docLinkTransformer) Transform(s *goquery.Selection) {
	s.FindMatcher(matchLink).Each(func(i int, s *goquery.Selection) {
		href, ok := t.transformLink(s.AttrOr("href", ""), false)
		if !ok {
			return
		}
		s.SetAttr("href", href)
	})
	s.FindMatcher(matchImage).Each(func(i int, s *goquery.Selection) {
		src, ok := t.transformLink(s.AttrOr("src", ""), true)
		if !ok {
			return
		}
		s.SetAttr("src", src)
	})
}
