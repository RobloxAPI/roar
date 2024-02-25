package generate

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"slices"

	"github.com/robloxapi/rbxdump"
	"github.com/robloxapi/rbxdump/diff"
	rbxdumpjson "github.com/robloxapi/rbxdump/json"
	"github.com/robloxapi/roar/archive"
	"github.com/robloxapi/roar/history"
)

// Filters out builds meeting some criteria.
//
// - Excludes a build when it is missing API-Dump.json and Full-API-Dump.json.
// - Excludes a build when a later build has the same GUID and an older date.
func FilterBuilds(repo *archive.Repo, builds []archive.Build) []archive.Build {
	// Delete builds missing an API dump.
	builds = slices.DeleteFunc(builds, func(build archive.Build) bool {
		return !repo.Exists(build, fullAPIDump) && !repo.Exists(build, apiDump)
	})

	// Delete builds that have matching GUIDs and are older.
	m := make(map[string]archive.Build, len(builds))
	builds = slices.DeleteFunc(builds, func(build archive.Build) bool {
		if prev, ok := m[build.GUID]; ok && prev.Date.Before(build.Date) {
			return true
		}
		m[build.GUID] = build
		return false
	})

	return builds
}

// Retrieves all builds from repo.
func MergeHistory(repo *archive.Repo, storedHist *history.Root) *history.Root {
	// Map events to GUID.
	storedEvents := make(map[string]*history.Event, len(storedHist.Event))
	for _, event := range storedHist.Event {
		storedEvents[event.GUID] = event
	}

	fmt.Printf("loaded %d events\n", len(storedEvents))

	// Retrieve and filter all builds.
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

	// Walk through each build. Compared to known builds to fetch new builds
	// incrementally.
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
				rc, _ = repo.Open(build, fullAPIDump)
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
				fmt.Println("DIFF")
				os.Exit(1)
			}
		}

		differ.Prev = differ.Next.Copy()
	}

	return updatedHist
}

// Reads history JSON from histPath.
func ReadHistory(histPath string) (storedhist *history.Root, err error) {
	var storedHist *history.Root
	if f, err := os.Open(histPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			storedHist = &history.Root{}
		} else {
			return nil, fmt.Errorf("open %s: %w", historyData, err)
		}
	} else {
		jd := json.NewDecoder(f)
		err := jd.Decode(&storedHist)
		f.Close()
		if err != nil {
			return nil, fmt.Errorf("decode %s: %w", historyData, err)
		}
	}
	return storedHist, nil
}
