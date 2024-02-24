package generate

import (
	"slices"

	"github.com/robloxapi/roar/archive"
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
