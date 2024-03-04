# (Ro)blox (A)PI (R)eference
The `roar` command generates reference pages for the Roblox Lua API.

## Usage
Currently, the only subcommand is `generate`, which produces data and pages for
a [Hugo][hugo] website.

```bash
roar generate [config]
```

An optional path to a configuration file can be passed as an argument. If `-`,
then stdin will be used. Otherwise, if unspecified, the program will look for
configuration in the following locations, in order:

1. `roar.toml` in the working directory.
2. `roar/roar.toml` in the user config directory (according to
   [os.UserConfigDir][userconfigdir]).

### Configuration
The generate command is configured by a [TOML][toml] file.

```toml
# Location of the data source. May be a URL or a file path. Must include a
# trailing slash.
source = "https://raw.githubusercontent.com/RobloxAPI/build-archive/master/data/"

# A path to the Hugo website repository for which data and pages will be
# generated. Files will be generated under the `data` and `content` directories.
site = "~/projects/website"

# If true, API history will be fetched and merged with cached history. The
# merging process can take some time, and may fetch data from a remote source,
# so setting this to false will skip merging and use the existing cache instead.
update = true

# Location of documentation source. May be a URL or a file path. Must point
# to a Git repository. If empty or unspecified, then documentation is disabled.
docs = "https://github.com/Roblox/creator-docs"

# Selectively disable types of generated data.
[disable]
dump = true    # Excludes cumulative API dump.
reflect = true # Excludes reflection metadata.
pages = true   # Don't generate website pages.
```

The `source` field must point to the `data` directory of a
[build-archive][build-archive]-formatted source.

[hugo]: https://gohugo.io/
[userconfigdir]: https://pkg.go.dev/os#UserConfigDir
[toml]: https://toml.io
[build-archive]: https://github.com/RobloxAPI/build-archive
