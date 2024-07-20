package icons

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/robloxapi/roar/script"
)

func Write(output string) error {
	tmp, err := os.MkdirTemp(".", "session-")
	if err != nil {
		return err
	}
	defer func() {
		os.RemoveAll(tmp)
	}()

	fmt.Println("ICON TEMP", tmp)

	err = script.Script{
		{"git", "-C", tmp, "clone", "-n", "--depth=1", "--filter", "tree:0", "https://github.com/MaximumADHD/Roblox-Client-Tracker"},
		{"git", "-C", filepath.Join(tmp, "Roblox-Client-Tracker"), "sparse-checkout", "set", "--no-cone", "QtResources/icons/Dark/Roblox/16/3x", "QtResources/icons/Light/Roblox/16/3x"},
		{"git", "-C", filepath.Join(tmp, "Roblox-Client-Tracker"), "checkout"},
	}.Run()
	if err != nil {
		return err
	}

	fmt.Println("ICON REMOVE", filepath.Join(output, "icons"))
	os.RemoveAll(filepath.Join(output, "icons"))
	os.MkdirAll(filepath.Join(output, "icons"), 0755)

	fmt.Println("ICON RENAME Light")
	fmt.Println(filepath.Join(tmp, "Roblox-Client-Tracker/QtResources/icons/Light/Roblox/16/3x"))
	fmt.Println(filepath.Join(output, "icons", "light"))
	err = os.Rename(filepath.Join(tmp, "Roblox-Client-Tracker/QtResources/icons/Light/Roblox/16/3x"), filepath.Join(output, "icons", "light"))
	if err != nil {
		return err
	}

	fmt.Println("ICON RENAME Dark")
	fmt.Println(filepath.Join(tmp, "Roblox-Client-Tracker/QtResources/icons/Dark/Roblox/16/3x"))
	fmt.Println(filepath.Join(output, "icons", "dark"))
	err = os.Rename(filepath.Join(tmp, "Roblox-Client-Tracker/QtResources/icons/Dark/Roblox/16/3x"), filepath.Join(output, "icons", "dark"))
	if err != nil {
		return err
	}

	return nil
}
