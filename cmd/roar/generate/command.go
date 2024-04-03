package generate

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime/pprof"
	"strings"

	"github.com/anaminus/snek"
	"github.com/robloxapi/rbxdump"
	"github.com/robloxapi/rbxdump/diff"
	"github.com/robloxapi/roar/archive"
	"github.com/robloxapi/roar/history"
	"github.com/robloxapi/roar/icons"
	"github.com/robloxapi/roar/index"
)

const (
	apiDump     = "API-Dump.json"
	fullAPIDump = "Full-API-Dump.json"

	jsonIndent = "\t"

	siteAssets  = "assets"
	siteContent = "content"
	siteData    = "data"

	historyData = "History.json"
	indexData   = "Index.json"
	docsData    = "Docs.json"
	dumpData    = "Dump.json"
	reflectData = "Reflect.json"
)

var Def = snek.Def{
	Name: "generate",
	Doc: snek.Doc{
		Summary:     "Generate site.",
		Arguments:   "[flags] [config]",
		Description: usage,
	},
	New: func() snek.Command { return &Command{} },
}

type Command struct {
	Site       string
	Source     string
	Docs       string
	Update     bool
	NoCache    bool
	Disable    Disable
	CPUProfile string
}

type Disable struct {
	Index   bool // Don't generate index data.
	History bool // Don't write history data (cache).
	Dump    bool // Don't generate dump data.
	Reflect bool // Don't generate reflection metadata.
	Pages   bool // Don't generate website pages.
	Icons   bool // Don't generate icon resources.
}

func (c *Command) SetFlags(flagset snek.FlagSet) {
	flagset.StringVar(&c.CPUProfile, "cpuprofile", "", "Write profile to given path.")

	flagset.StringVar(&c.Site, "site", "", "Location of Hugo site.")
	flagset.StringVar(&c.Source, "source", "", "Location of builds.")
	flagset.StringVar(&c.Docs, "docs", "", "Location of documentation.")
	flagset.BoolVar(&c.Update, "update", false, "Update history database.")
	flagset.BoolVar(&c.NoCache, "no-cache", false, "Ignore cached history.")

	flagset.BoolVar(&c.Disable.Index, "disable-index", false, "Don't generate index data.")
	flagset.BoolVar(&c.Disable.History, "disable-history", false, "Don't write history data (cache).")
	flagset.BoolVar(&c.Disable.Dump, "disable-dump", false, "Don't generate dump data.")
	flagset.BoolVar(&c.Disable.Reflect, "disable-reflect", false, "Don't generate reflection metadata.")
	flagset.BoolVar(&c.Disable.Pages, "disable-pages", false, "Don't generate website pages.")
	flagset.BoolVar(&c.Disable.Icons, "disable-icons", false, "Don't generate website icons.")
}

func (c *Command) Run(opt snek.Options) error {
	if err := opt.Parse(opt.Arguments); err != nil {
		return err
	}

	if c.CPUProfile != "" {
		f, err := os.Create(c.CPUProfile)
		if err != nil {
			return fmt.Errorf("could not start CPU profile: %w", err)
		}
		defer f.Close()
		if err := pprof.StartCPUProfile(f); err != nil {
			return fmt.Errorf("could not start CPU profile: %w", err)
		}
		defer pprof.StopCPUProfile()
	}

	if c.Source == "" {
		if opt.Arg(0) == "" {
			opt.WriteUsageOf(opt.Stderr, opt.Def)
			return nil
		}
		return fmt.Errorf("source option is required")
	}
	if !strings.HasSuffix(c.Source, "/") {
		c.Source += "/"
	}

	// Read history file, if available.
	histPath := filepath.Join(c.Site, siteData, historyData)
	var storedHist *history.Root
	if c.NoCache {
		storedHist = history.NewRoot()
	} else {
		var err error
		if storedHist, err = ReadHistory(histPath); err != nil {
			return err
		}
	}

	// Create archive repository.
	repo, err := archive.NewRepo(c.Source)
	if err != nil {
		return fmt.Errorf("failed to read repo: %w", err)
	}

	var updatedHist *history.Root
	if c.Update {
		// Produce updated history using stored history as cache.
		fmt.Println("rebuilding history database")
		updatedHist = MergeHistory(repo, storedHist)

		// Write new history file.
		if !c.Disable.History {
			if err := WriteFile(c.Site, historyData, updatedHist); err != nil {
				return err
			}
		}
	} else {
		updatedHist = storedHist
	}

	// Generate dump by rolling through entire history, excluding actions that
	// remove elements.
	patcher := diff.Patch{Root: &rbxdump.Root{}}
	for _, event := range updatedHist.Event {
		for _, change := range event.Changes {
			if change.Action.Type == diff.Remove {
				continue
			}
			patcher.Patch([]diff.Action{change.Action})
		}
	}
	if !c.Disable.Dump {
		if err := WriteFile(c.Site, dumpData, patcher.Root); err != nil {
			return err
		}
	}

	// Generate index file.
	indexRoot := &index.Root{}
	if err := indexRoot.Build(updatedHist, patcher.Root); err != nil {
		return err
	}
	if !c.Disable.Index {
		if err := WriteFile(c.Site, indexData, indexRoot); err != nil {
			return err
		}
	}

	// Generate pages.
	if !c.Disable.Pages {
		GeneratePages(indexRoot, filepath.Join(c.Site, siteContent))
	}

	// Generate icons.
	if !c.Disable.Icons {
		if err := icons.Write(filepath.Join(c.Site, siteAssets)); err != nil {
			return err
		}
	}

	return nil
}

// Writes JSON to file at path.
func WriteFile(site, file string, value any) error {
	path := filepath.Join(site, siteData, file)
	os.MkdirAll(filepath.Dir(path), 0755)
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create %s file: %w", file, err)
	}
	je := json.NewEncoder(f)
	je.SetEscapeHTML(false)
	je.SetIndent("", jsonIndent)
	err = je.Encode(value)
	f.Close()
	if err != nil {
		return fmt.Errorf("encode %s file: %w", file, err)
	}
	return nil
}
