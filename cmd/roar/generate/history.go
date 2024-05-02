package generate

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"slices"
	"sort"
	"strings"
	"unicode"

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
	// Map updates to GUID.
	storedUpdates := make(map[string]*history.Update, len(storedHist.Update))
	for _, update := range storedHist.Update {
		storedUpdates[update.GUID] = update
	}

	fmt.Printf("loaded %d updates\n", len(storedUpdates))

	// Retrieve and filter all builds.
	allBuilds := repo.Builds()
	allBuilds = FilterBuilds(repo, allBuilds)
	// Filter GUIDs that are already in updates.
	allBuilds = slices.DeleteFunc(allBuilds, func(build archive.Build) bool {
		if prev, ok := storedUpdates[build.GUID]; ok && prev.Date.Before(build.Date) {
			fmt.Println("skip", build.GUID)
			return true
		}
		return false
	})

	// Walk through each build. Compared to known builds to fetch new builds
	// incrementally.
	differ := diff.Diff{SeparateFields: true}
	var cursor history.Cursor
	updatedHist := history.NewRoot()
	for _, build := range allBuilds {
		var dump *rbxdump.Root
		if update, ok := storedUpdates[build.GUID]; ok {
			// Get dump for stored history.
			if !cursor.Roll(update) {
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
		sort.Slice(actions, func(i, j int) bool {
			if pi, pj := actions[i].Element.Primary(), actions[j].Element.Primary(); pi != pj {
				return pi < pj
			}
			if actions[i].Primary != actions[j].Primary {
				return actions[i].Primary < actions[j].Primary
			}
			if actions[i].Element != actions[j].Element {
				return actions[i].Element < actions[j].Element
			}
			if actions[i].Secondary != actions[j].Secondary {
				return actions[i].Secondary < actions[j].Secondary
			}
			if actions[i].Type != actions[j].Type {
				return actions[i].Type > actions[j].Type
			}
			var fieldi, fieldj string
			for field := range actions[i].Fields {
				fieldi = field
				break
			}
			for field := range actions[i].Fields {
				fieldj = field
				break
			}
			return fieldi < fieldj
		})
		updatedHist.AppendUpdate(build, actions, differ.Prev)
		fmt.Printf("\tappended %d actions\n", len(actions))

		if update, ok := storedUpdates[build.GUID]; ok {
			if len(actions) != len(update.Changes) {
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
			storedHist = history.NewRoot()
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

// Normalizes any tags and security context values within hist to their
// canonical forms. For example, "WriteOnly" and "writeonly" are considered
// equivalent tags, which are normalized by selecting which ever has the most
// uppercase latters.
func NormalizeHistoryTags(hist *history.Root) {
	canonTags := map[string]string{}
	history.VisitTags(hist, func(tag string) (string, bool) {
		low := strings.ToLower(tag)
		if cur, ok := canonTags[low]; ok {
			canonTags[low] = normalizeTag(cur, tag)
		} else {
			canonTags[low] = tag
		}
		return "", false
	})
	printed := map[string]bool{}
	history.VisitTags(hist, func(tag string) (string, bool) {
		t := canonTags[strings.ToLower(tag)]
		if t != tag && !printed[tag] {
			printed[tag] = true
			fmt.Printf("normalized tag %s => %s\n", tag, t)
		}
		return t, true
	})
}

// Selects the most canon capitalization of a tag. Arguments are assumed to be
// equivalent. Has the following preference:
//  1. WriteOnly // Has 2 uppercase letters.
//  2. Writeonly // Has 1 uppercase letter, first is uppercase.
//  2. writeOnly // Has 1 uppercase letter.
//  3. writeonly // Has 0 uppercase letters.
func normalizeTag(current, next string) string {
	cu := 0
	cf := false
	for i, c := range current {
		if unicode.IsUpper(c) {
			cu++
			if i == 0 {
				cf = true
			}
		}
	}
	nu := 0
	for _, c := range next {
		if unicode.IsUpper(c) {
			nu++
		}
	}
	// Prefer current if it contains more uppers.
	if cu > nu {
		return current
	}
	// Prefer current if first letter is upper.
	if cu == nu && cf {
		return current
	}
	return next
}
