package docs

import (
	"strconv"

	"github.com/PuerkitoBio/goquery"
	"github.com/andybalholm/cascadia"
)

type docHeadingTransformer struct {
	SectionLevel int
}

var matchHeading = cascadia.MustCompile("h1,h2,h3,h4,h5,h6")

func headingLevel(s *goquery.Selection) int {
	tag := s.Nodes[0].Data
	if len(tag) == 0 || tag[0] != 'h' {
		return 0
	}
	level, err := strconv.ParseUint(tag[1:], 10, 8)
	if err != nil || level < 1 || level > 6 {
		return 0
	}
	return int(level)
}

func setHeadingLevel(s *goquery.Selection, level int) {
	if level < 1 || level > 6 {
		return
	}
	s.Nodes[0].Data = "h" + strconv.Itoa(level)
}

func (t docHeadingTransformer) Transform(s *goquery.Selection) {
	if t.SectionLevel == 0 {
		return
	}
	var topLevel int = 10000
	s.FindMatcher(matchHeading).Each(func(i int, s *goquery.Selection) {
		level := headingLevel(s)
		if level <= 0 {
			return
		}
		if level < topLevel {
			topLevel = level
		}
	})
	if topLevel >= 10000 {
		return
	}
	s.FindMatcher(matchHeading).Each(func(i int, s *goquery.Selection) {
		level := headingLevel(s)
		if level <= 0 {
			return
		}
		level += t.SectionLevel - topLevel + 1
		if level > 6 {
			level = 6
		}
		setHeadingLevel(s, level)
	})
}
