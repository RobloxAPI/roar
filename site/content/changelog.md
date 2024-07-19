+++
title = "Changelog"
summary = "Summary of changes to the website."
layout = "changelog"
outputs = ["html", "rss"]
+++

This page lists changes to the website itself.

## Pending
- Search: Add [ancestor][ancestor] selector to select classes according to the
  order of their superclasses. For example, `superclass:GuiObject ancestor:0`
  will only select classes where the parent superclass is "GuiObject".
- Search: Remove `n`, `f`, `y`, and `t` as options to [boolean][bool] selectors,
  for being too ambiguous.

[ancestor]: {{<relref "search#selector-ancestor">}}
[bool]: {{<relref "search#bool">}}

<!---->

## 2024-05-16
- Search: Fix [removed][removed] and [is][is] field selectors not returning
  correct results in some cases.

[removed]: {{<relref "search#selector-removed">}}
[is]: {{<relref "search#kind">}}

<!---->

## 2024-05-15
- Search: Prefix selectors have been rebranded as [field][field] selectors. All
  selectors of the form `field:value` now concern only entity fields.
- Search: The syntax of [result][result] selectors now has the form
  `/name:value` to distinguish them from field selectors.
- Search: The syntax of [list][list] selectors has been revised. For example,
  instead of `list:parameters`, it is now just `parameters:` (that is, a field
  selector without a value).
	- The `list:` selector is now `*:`.
	- `foo:*` can be used to select all entities that have field *foo*.
- Search: Add [`N..M`][range] selector for numeric ranges. For example,
  `members:50..100` selects classes with between 50 and 100 members.
- Search: Add [`~text~`][fuzzy] selector for explicitly specifying a fuzzy
  search.
- Search: Fix numeric values less than or equal to 0 failing to match (e.g.
  `superclasses:0`).
- Search: Fix empty strings failing to match (e.g. `threadsafety:""`).
- Search: Fix [primary compound selector][compound] incorrectly selecting
  secondary entities.

[field]: {{<relref "search#field-selectors">}}
[result]: {{<relref "search#result-selectors">}}
[list]: {{<relref "search#list-selector">}}
[range]: {{<relref "search#selector-number-range">}}
[fuzzy]: {{<relref "search#selector-string-fuzzy-delimited">}}
[compound]: {{<relref "search#selector-compound-primary">}}

<!---->

## 2024-05-14
- **Implement advanced search engine parser.**
- The basic search query syntax is the same as before: words will perform a
  fuzzy search over names.
- The [search][search] page details the full syntax.
- While focused, the search bar covers the full width of the header.
- Fix missing thread safety field in member sections.
- Remove redundant member type field in member sections.
- Consolidate can-load and can-save fields in property sections.
- Reorganize member sections to display principle data (parameters, types) more
  prominently.
- Use index card to display property type and default value.

[search]: {{<relref "search">}}

<!---->

## 2024-05-09
- Improve appearance of settings panel.
- Add descriptions for each setting (via tooltip).
- Hide default value column if no parameters have default values.
<!---->

## 2024-05-04
- Add website change log.
- Add [RSS feed][rss] for API updates.
- Display default values of class properties.
- Consolidate and persist class list sorting setting.
- Improve style of class sort buttons.
- Improve theme colors.
- Settings correctly sync across multiple tabs.
- Improve formatting of parameter tables on small layout.
- Improve styling of default values of parameters and properties.
- Add 404 page.
- Fix scrolling when targeting a specific update or change.
- Fix highlighting of certain update changes.
- Creator Hub links open in new tab.
- Various minor styling and formatting improvements.
- Fix nondeterminism in history data.
- Improve GitHub workflow.

[rss]: {{<relref path="updates" outputFormat="rss">}}

<!---->

## 2024-04-30
- **Complete rewrite of frontend and backend.**
- **Modernized frontend with improved support for a wider variety of device
  sizes.**
- **Simplified backend based on Hugo.**
- **Updates work again.**
- Use modern Roblox icons.
- Display recent updates on main page.
- Display inheritance of removed classes on main page.
- Add separate pages for listing each kind of entity (classes, enums, types).
- Change DevHub links to point directly to Creator Hub.
- Add link to release notes for corresponding updates.
- Use Luau-style type signatures in member index.
- Only display latest history for each member in index. Member sections still
  display all history.
- Display sibling classes (classes that inherit from the same superclass).
- Display thread safety of class members.
- Display legacy names of enum items, when available.
- Pages have more detailed list of related entities.
- Add Auto theme setting, which selects a theme based on the device's preferred
  color scheme.
- Add setting to toggle visibility of unscriptable properties.
- Backend incorporates "full" API dump, which has more information than the
  standard API dump, including serialize-only properties.
- Add [page listing statistics][stats] about the API.
- Significantly more detailed search database (search syntax coming soon).
- No longer includes Reflection Metadata (may be added back later).
- No longer includes custom documentation (docs from creator-docs will be added
  later).
- Fix search sometimes not including all possible results.

[stats]: {{<relref "stats">}}

<!---->
