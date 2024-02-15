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
