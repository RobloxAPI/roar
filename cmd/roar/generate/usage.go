package generate

const usage = `
Generates API data for a Hugo website.

The following flags can be specified:

--site string

    The path to the Hugo site to which data will be written.

    Pages are generated under content for each type of API object.

    - content/class/$CLASS.md
    - content/enum/$ENUM.md
    - content/type/$TYPE.md

    Such files are generated from the corresponding templates in the archetype
    directory.

    Content files are usually minimal, simply invoking a shortcode to produce
    the full page. Actual data is generated in the data directory.

--source string

    The data source, which is expected to comply with the structure specified by
    build-archive:

        https://github.com/RobloxAPI/build-archive

    The source can be either a file path or a URL. A file path reads from the
    local file system. A URL reads from a remote source via HTTP.

--docs string

    Location of documentation. If unspecified, then documentation will not be
    included.

--update

    If specified, then the history database will be updated.

--no-cache

	If specified, then an existing history database will not be read, and the
	history will be generated from scratch.

--disable-index

	Whether index data will be generated.

--disable-history

	Whether the history database will be written.

--disable-dump

    Whether dump data will be generated.

--disable-reflect

    Whether reflection metadata will be generated.

--disable-pages

	Whether pages will be generated.

--disable-icons

	Whether icons will be generated. Icons are added to the site under
	assets/icons.

`
