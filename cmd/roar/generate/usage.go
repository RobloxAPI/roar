package generate

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
