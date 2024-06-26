// Reads the build archive format.
package archive

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"path"
	"slices"
	"sort"
	"time"

	"github.com/robloxapi/rbxver"
)

type data struct {
	groups   []string
	metadata map[string]metadata
}

type metadata struct {
	Files   []string
	Builds  []Build
	Missing map[string][]string `json:",omitempty"`
}

type Build struct {
	Group   string `json:",omitempty"`
	GUID    string
	Date    time.Time
	Version rbxver.Version
}

type Repo struct {
	fs fs.FS
	d  *data
	l  Build
}

// Returns a new Repo that uses the given source. The source is expected to be
// compliant with the build archive format. The source must point to the data
// directory. For an HTTP source, the path must have a trailing slash.
func NewRepo(source fs.FS) (repo *Repo, err error) {
	repo = &Repo{fs: source}
	if err := repo.fetchData(); err != nil {
		return nil, err
	}
	return repo, nil
}

// Fetches metadata.
func (r *Repo) fetchData() error {
	d := data{metadata: map[string]metadata{}}

	// Fetch groups.
	gf, err := r.fs.Open("groups.json")
	if err != nil {
		return err
	}
	jd := json.NewDecoder(gf)
	err = jd.Decode(&d.groups)
	gf.Close()
	if err != nil {
		return fmt.Errorf("decode groups.json: %w", err)
	}

	// Fetch group metadata.
	for _, group := range d.groups {
		mdf, err := r.fs.Open(path.Join(group, "metadata.json"))
		if err != nil {
			return fmt.Errorf("open %s/metadata.json: %w", group, err)
		}
		jd := json.NewDecoder(mdf)
		var md metadata
		err = jd.Decode(&md)
		mdf.Close()
		if err != nil {
			return fmt.Errorf("decode %s/metadata.json: %w", group, err)
		}
		for i, build := range md.Builds {
			build.Group = group
			md.Builds[i] = build
			if r.l.Date.IsZero() || build.Date.After(r.l.Date) {
				r.l = build
			}
		}
		d.metadata[group] = md
	}

	r.d = &d
	return nil
}

// Returns the latest build.
func (r *Repo) Latest() Build {
	return r.l
}

// Returns a list of all builds, ordered by date.
func (r *Repo) Builds() (builds []Build) {
	if r.d == nil {
		return nil
	}

	for _, group := range r.d.groups {
		md := r.d.metadata[group]
		builds = append(builds, md.Builds...)
	}

	sort.Slice(builds, func(i, j int) bool {
		return builds[i].Date.Before(builds[j].Date)
	})

	return builds
}

// Returns whether a file exists without making any FS calls.
func (r *Repo) Exists(build Build, name string) bool {
	if r.d == nil {
		return false
	}
	// Attempt to determine if file is present early.
	md, ok := r.d.metadata[build.Group]
	if !ok {
		// No metadata for group.
		return false
	}
	if slices.Index(md.Files, name) < 0 {
		// File name not present for group.
		return false
	}
	if missing, ok := md.Missing[build.GUID]; ok && slices.Index(missing, name) >= 0 {
		// Build is missing specific file.
		return false
	}
	return true
}

// Returns file path for a build and file name.
func filePath(build Build, name string) string {
	return path.Join(build.Group, "builds", build.GUID, name)
}

// Returns info for a file. Returns nil if the file does not exist, or otherwise
// errors.
func (r *Repo) Stat(build Build, name string) fs.FileInfo {
	if !r.Exists(build, name) {
		return nil
	}
	info, err := fs.Stat(r.fs, filePath(build, name))
	if err != nil {
		return nil
	}
	return info
}

// Returns a ReadCloser for the content of a file. Returns nil if the build or
// name was not found.
func (r *Repo) Open(build Build, name string) (rc io.ReadCloser, err error) {
	if !r.Exists(build, name) {
		return nil, nil
	}

	// Finally try fetching file.
	f, err := r.fs.Open(filePath(build, name))
	if err != nil {
		return nil, err
	}
	return f, nil
}
