package generate

import (
	"fmt"
	"io"
	"path/filepath"

	"github.com/anaminus/snek"
	"github.com/robloxapi/roar/archive"
	"github.com/robloxapi/roar/cmd/roar/config"
	"github.com/robloxapi/roar/history"
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
	reflectData = "rfl.json"
)

var Def = snek.Def{
	Name: "generate",
	Doc: snek.Doc{
		Summary:     "Generate site.",
		Arguments:   "[config]",
		Description: usage,
	},
	New: func() snek.Command { return &Command{} },
}

type Command struct{}

func (c *Command) Run(opt snek.Options) error {
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
	storedHist, err := ReadHistory(histPath)
	if err != nil {
		return err
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
		if err := WriteHistory(histPath, updatedHist); err != nil {
			return err
		}
	} else {
		updatedHist = storedHist
	}

	return nil
}
