+++
title = "Changelog"
summary = "Summary of changes to the website."
layout = "changelog"
outputs = ["html", "rss"]
+++

This page lists changes to the website itself.

## Pending
- **Implement advanced search engine parser.**
- The basic search query syntax is the same as before: words will perform a
  fuzzy search over names.
- The [search]({{<relref "search">}}) page details the full syntax.
- While focused, the search bar covers the full width of the header.
- Fix missing thread safety field in member sections.
- Remove redundant member type field in member sections.
- Consolidate can-load and can-save fields in property sections.
- Reorganize member sections to display principle data (parameters, types) more
  prominently.
- Use index card to display property type and default value.

## 2024-05-09
- Improve appearance of settings panel.
- Add descriptions for each setting (via tooltip).
- Hide default value column if no parameters have default values.
<!---->

## 2024-05-04
- Add website change log.
- Add [RSS feed](/ref/updates/index.xml) for API updates.
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
- Add [page listing statistics](/ref/stats.html) about the API.
- Significantly more detailed search database (search syntax coming soon).
- No longer includes Reflection Metadata (may be added back later).
- No longer includes custom documentation (docs from creator-docs will be added
  later).
- Fix search sometimes not including all possible results.
<!---->
