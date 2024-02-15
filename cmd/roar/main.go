// The roar command.
package main

import (
	"os"

	"github.com/anaminus/snek"
)

var Program = snek.NewProgram("roar", os.Args)

var Usage = `%s [command]

Handles generation of Roblox Luau API data for a Hugo website.

The following commands are available:
%s
`

func main() {
	Program.Usage(Usage)
	Program.Main()
}
