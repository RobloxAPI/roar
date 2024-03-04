package generate

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/anaminus/snek"
	"github.com/robloxapi/rbxdump"
	"github.com/robloxapi/rbxdump/diff"
	"github.com/robloxapi/roar/archive"
	"github.com/robloxapi/roar/cmd/roar/config"
	"github.com/robloxapi/roar/history"
	"github.com/robloxapi/roar/index"
)

const (
	apiDump     = "API-Dump.json"
	fullAPIDump = "Full-API-Dump.json"

	jsonIndent = "\t"

	siteData    = "data"
	siteContent = "content"

	historyData = "history.json"
	indexData   = "index.json"
	docsData    = "docs.json"
	dumpData    = "dump.json"
	reflectData = "reflect.json"
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
	NoCache bool
}

func (c *Command) SetFlags(flagset snek.FlagSet) {
	flagset.BoolVar(&c.NoCache, "no-cache", false, "Ignore cached history.")
}

func (c *Command) Run(opt snek.Options) error {
	if err := opt.Parse(opt.Arguments); err != nil {
		return err
	}

	var stdin io.Reader
	if opt.Arg(0) == "-" {
		stdin = opt.Stdin
	}
	cfg, err := config.Open(opt.Arg(0), stdin)
	if err != nil {
		return fmt.Errorf("open config file: %w", err)
	}

	if cfg.Source == "" {
		if opt.Arg(0) == "" {
			opt.WriteUsageOf(opt.Stderr, opt.Def)
			return nil
		}
		return fmt.Errorf("source option is required")
	}

	// Read history file, if available.
	histPath := filepath.Join(cfg.Site, siteData, historyData)
	var storedHist *history.Root
	if c.NoCache {
		storedHist = &history.Root{}
	} else {
		var err error
		if storedHist, err = ReadHistory(histPath); err != nil {
			return err
		}
	}

	// Create archive repository.
	repo, err := archive.NewRepo(cfg.Source)
	if err != nil {
		return fmt.Errorf("failed to read repo: %w", err)
	}

	var updatedHist *history.Root
	if cfg.Update {
		// Produce updated history using stored history as cache.
		fmt.Println("rebuilding history database")
		updatedHist = MergeHistory(repo, storedHist)

		// Write new history file.
		if !cfg.Disable.History {
			if err := WriteFile(cfg.Site, historyData, updatedHist); err != nil {
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
	if !cfg.Disable.Dump {
		if err := WriteFile(cfg.Site, dumpData, patcher.Root); err != nil {
			return err
		}
	}

	// Generate index file.
	indexRoot := &index.Root{}
	if err := indexRoot.Build(updatedHist, patcher.Root); err != nil {
		return err
	}
	if !cfg.Disable.Index {
		if err := WriteFile(cfg.Site, indexData, indexRoot); err != nil {
			return err
		}
	}

	// Generate pages.
	if !cfg.Disable.Pages {
		GeneratePages(indexRoot, filepath.Join(cfg.Site, siteContent))
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
