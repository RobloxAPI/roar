package generate

import (
	"fmt"
	"io"

	"github.com/anaminus/snek"
	"github.com/robloxapi/roar/archive"
	"github.com/robloxapi/roar/cmd/roar/config"
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

	fmt.Println("data.docs    :", d.Docs)
	fmt.Println("data.dump    :", d.Dump)
	fmt.Println("data.reflect :", d.Reflect)
	fmt.Println()

	repo, err := archive.NewRepo(cfg.Source)
	if err != nil {
		return fmt.Errorf("failed to read repo: %w", err)
	}

	builds := repo.Builds()
	for _, build := range builds {
		fmt.Println(build)
	}
	return nil
}

const usage = `
Generates API data for a Hugo website.

The only argument is a path to the config file to use, expected to be in TOML
format. Passing '-' will read from stdin. If unspecified, the config will be
tried from roar.toml in the working directory, then roar/roar.toml in the user
config directory.

The following options can be configured:

source : string

    The data source, which is expected to comply with the structure specified by
    build-archive:

        https://github.com/RobloxAPI/build-archive

    The source can be either a file path or a URL. A file path reads from the
    local file system. A URL reads from a remote source via HTTP.

site : string

    The path to the Hugo site to which data will be written.

    Pages are generated under content for each type of API object.

    - content/class/$CLASS.md
    - content/enum/$ENUM.md
    - content/type/$TYPE.md

    Such files are generated from the corresponding templates in the archetype
    directory.

    Content files are usually minimal, simply invoking a shortcode to produce
    the full page. Actual data is generated in the data directory.

docs : bool

    Whether doc data will be generated.

dump : bool

    Whether to dump data will be generated.

reflect : bool

    Whether reflection metadata will be generated.

none : bool

    The data that is generated can be controlled on an individual basis by the
    docs, dump, and reflect options. If none of these options are specified,
    then all data is generated unless the none option is specified.
`
