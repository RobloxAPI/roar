package generate

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"

	"github.com/anaminus/snek"
	"github.com/robloxapi/rbxdump"
	"github.com/robloxapi/rbxdump/diff"
	rbxdumpjson "github.com/robloxapi/rbxdump/json"
	"github.com/robloxapi/roar/archive"
	"github.com/robloxapi/roar/cmd/roar/config"
	"github.com/robloxapi/roar/history"
)

const (
	siteData    = "data"
	siteContent = "content"
	historyData = "history.json"
	apiDump     = "API-Dump.json"
	fullAPIDump = "Full-API-Dump.json"
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

	d := cfg.Data
	if !d.Docs && !d.Dump && !d.Reflect && !d.None {
		d.Docs = true
		d.Dump = true
		d.Reflect = true
	}

	if cfg.Source == "" {
		if opt.Arg(0) == "" {
			opt.WriteUsageOf(opt.Stderr, opt.Def)
			return nil
		}
		return fmt.Errorf("source option is required")
	}

	histPath := filepath.Join(cfg.Site, siteData, historyData)
	var storedHist *history.Root
	if f, err := os.Open(histPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			storedHist = &history.Root{}
		} else {
			return fmt.Errorf("open %s: %w", historyData, err)
		}
	} else {
		jd := json.NewDecoder(f)
		err := jd.Decode(&storedHist)
		f.Close()
		if err != nil {
			return fmt.Errorf("decode %s: %w", historyData, err)
		}
	}

	storedEvents := make(map[string]*history.Event, len(storedHist.Event))
	for _, event := range storedHist.Event {
		storedEvents[event.GUID] = event
	}

	fmt.Printf("loaded %d events\n", len(storedEvents))

	repo, err := archive.NewRepo(cfg.Source)
	if err != nil {
		return fmt.Errorf("failed to read repo: %w", err)
	}

	allBuilds := repo.Builds()
	allBuilds = FilterBuilds(repo, allBuilds)
	// Filter GUIDs that are already in events.
	allBuilds = slices.DeleteFunc(allBuilds, func(build archive.Build) bool {
		if prev, ok := storedEvents[build.GUID]; ok && prev.Date.Before(build.Date) {
			fmt.Println("skip", build.GUID)
			return true
		}
		return false
	})

	fmt.Println("rebuilding database")

	var differ diff.Diff
	var cursor history.Cursor
	updatedHist := &history.Root{}
	for _, build := range allBuilds {
		var dump *rbxdump.Root
		if event, ok := storedEvents[build.GUID]; ok {
			// Get dump for stored history.
			if !cursor.Roll(event) {
				panic("failed to roll cursor!")
			}
			fmt.Println("rolled to", build)
			dump = cursor.Dump
		} else {
			// Get dump by fetching from repo.
			var rc io.ReadCloser
			switch {
			case repo.Exists(build, fullAPIDump):
				fmt.Println("fetching", build)
				rc, err = repo.Open(build, fullAPIDump)
				if err != nil {
				}
			case repo.Exists(build, apiDump):
				fmt.Println("fetching", build)
				rc, _ = repo.Open(build, apiDump)
			default:
				fmt.Println("no api", build)
				continue
			}
			if rc == nil {
				fmt.Println("bad api", build.GUID)
				continue
			}

			var err error
			dump, err = rbxdumpjson.Decode(rc)
			rc.Close()
			if err != nil {
				fmt.Printf("bad api %s: %s\n", build.GUID, err)
				continue
			}
		}

		differ.Next = dump
		actions := differ.Diff()
		updatedHist.AppendEvent(build, actions, differ.Prev)
		fmt.Printf("\tappended %d actions\n", len(actions))

		if event, ok := storedEvents[build.GUID]; ok {
			if len(actions) != len(event.Changes) {
				var b bytes.Buffer
				for _, v := range actions {
					fmt.Fprintln(&b, v)
				}
				os.WriteFile(filepath.Join(filepath.Dir(histPath), "actions_b.txt"), b.Bytes(), 0666)

				b.Reset()
				for _, v := range event.Changes {
					fmt.Fprintln(&b, v.Action)
				}
				os.WriteFile(filepath.Join(filepath.Dir(histPath), "actions_a.txt"), b.Bytes(), 0666)

				b.Reset()
				rbxdumpjson.Encode(&b, differ.Prev)
				os.WriteFile(filepath.Join(filepath.Dir(histPath), "prev.json"), b.Bytes(), 0666)

				b.Reset()
				rbxdumpjson.Encode(&b, differ.Next)
				os.WriteFile(filepath.Join(filepath.Dir(histPath), "next.json"), b.Bytes(), 0666)

				fmt.Println("DIFF")
				os.Exit(1)
			}
		}

		differ.Prev = differ.Next.Copy()
	}

	// Write new history file.
	os.MkdirAll(filepath.Dir(histPath), 0755)
	f, err := os.Create(histPath)
	if err != nil {
		return fmt.Errorf("create history file: %w", err)
	}
	je := json.NewEncoder(f)
	je.SetEscapeHTML(false)
	je.SetIndent("", "\t")
	err = je.Encode(updatedHist)
	f.Close()
	if err != nil {
		return fmt.Errorf("encode history file: %w", err)
	}

	return nil
}
