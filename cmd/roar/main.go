// The roar command.
package main

import (
	"os"

	"github.com/anaminus/snek"
	"github.com/robloxapi/roar/cmd/roar/generate"
)

var Program = snek.NewProgram("roar", os.Args)

func init() {
	Program.Register(generate.Def)
}

func main() {
	Program.Usage(usage)
	Program.Main()
}

const usage = `%s [command]

Handles generation of Roblox Luau API data for a Hugo website.

The following commands are available:
%s
`
