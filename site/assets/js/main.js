import "./settings.js"
import "./search.js"
import "./updates.js"
import "./classes.js"
import {actions} from "./actions.js"
import {getLayouts} from "./layouts.js"

new Promise(resolve => {
	if (document.readyState === "loading") {
		window.addEventListener("DOMContentLoaded", resolve);
	} else {
		resolve();
	};
}).then(() => {
	const body = document.body;

	if (body.matches(".kind-home, .kind-section")) {
		// Classes
		actions.QuickLink(
			"#present-classes > header .element-count",
			"#present-classes > .class-tree",
			["Count", "li > .entity-link"]
		);
		actions.QuickLink(
			"#removed-classes > header .element-count",
			"#removed-classes > .class-tree",
			["Count", "li > .entity-link.set.removed"]
		);
		actions.QuickLink(
			"#removed-classes",
			"#removed-classes > .class-tree",
			["HideIfZero", ">*"]
		);

		// Enums
		actions.QuickLink(
			"#present-enums > header .element-count",
			"#present-enums > .enum-list",
			["Count", ">*"]
		);
		actions.QuickLink(
			"#removed-enums > header .element-count",
			"#removed-enums > .enum-list",
			["Count", ">*"]
		);
		actions.QuickLink(
			"#removed-enums",
			"#removed-enums > .enum-list",
			["HideIfZero", ">*"]
		);
	};

	if (body.matches(".kind-page.type-class")) {
		// Superclasses
		actions.QuickLink(
			"#toc-superclasses",
			"#superclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#superclasses",
			"#superclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#superclasses > header .element-count",
			"#superclasses > ul",
			["Count", ">*"]
		);

		// Subclasses
		actions.QuickLink(
			"#toc-subclasses",
			"#subclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#subclasses",
			"#subclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#subclasses > header .element-count",
			"#subclasses > ul",
			["Count", ">*"]
		);

		// Sibclasses
		actions.QuickLink(
			"#toc-sibclasses",
			"#sibclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#sibclasses",
			"#sibclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#sibclasses > header .element-count",
			"#sibclasses > ul",
			["Count", ">*"]
		);

		// Hierarchy
		actions.QuickLink(
			"#toc-hierarchy",
			"#toc-hierarchy > ol",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#hierarchy",
			"#hierarchy",
			["HideIfZero", ">*"]
		);

		// Members index
		actions.QuickLink(
			"#members-index > header .element-count",
			"#members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);

		// Removed members index
		actions.QuickLink(
			"#toc-removed-members-index",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["HideIfZero", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#removed-members-index",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["HideIfZero", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#removed-members-index > header .element-count",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);

		// History
		actions.QuickLink(
			"#history > header .element-count",
			"#history > ul",
			["Count", ">*"]
		);
		const target = document.querySelector("#history > header .element-count");
		document.querySelector("#history input.filter-input").addEventListener("change", function() {
			actions.Update(target);
		})

		// Members
		actions.QuickLink(
			"#toc-members",
			"#toc-members > ol",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#members",
			"#members > .members-sections",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#members > header .element-count",
			"#members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);

		// Removed members
		actions.QuickLink(
			"#toc-removed-members",
			"#toc-removed-members > ol",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#removed-members",
			"#removed-members > .members-sections",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#removed-members > header .element-count",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);

		// References
		actions.QuickLink(
			"#toc-references",
			"#toc-references > ol",
			["HideIfZero", ">*"]
		);

		// Related classes
		actions.QuickLink(
			"#toc-related-classes",
			"#related-classes > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-classes",
			"#related-classes > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-classes > header .element-count",
			"#related-classes > ul",
			["Count", ">*"]
		);

		// Related members
		actions.QuickLink(
			"#toc-related-members",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-members",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-members > header .element-count",
			"#related-members > ul",
			["Count", ">*"]
		);

		// Related enums
		actions.QuickLink(
			"#toc-related-enums",
			"#related-enums > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-enums",
			"#related-enums > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-enums > header .element-count",
			"#related-enums > ul",
			["Count", ">*"]
		);

		// Related types
		actions.QuickLink(
			"#toc-related-types",
			"#related-types > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-types",
			"#related-types > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-types > header .element-count",
			"#related-types > ul",
			["Count", ">*"]
		);
	};

	if (body.matches(".kind-page.type-enum")) {
		// Members index
		actions.QuickLink(
			"#members-index > header .element-count",
			"#members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);

		// Removed members index
		actions.QuickLink(
			"#toc-removed-members-index",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["HideIfZero", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#removed-members-index",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["HideIfZero", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#removed-members-index > header .element-count",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);

		// History
		actions.QuickLink(
			"#history > header .element-count",
			"#history > ul",
			["Count", ">*"]
		);
		const target = document.querySelector("#history > header .element-count");
		document.querySelector("#history input.filter-input").addEventListener("change", function() {
			actions.Update(target);
		})

		// References
		actions.QuickLink(
			"#toc-references",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);

		// Related members
		actions.QuickLink(
			"#related-members",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-members > header .element-count",
			"#related-members > ul",
			["Count", ">*"]
		);
	};

	if (body.matches(".kind-page.type-type")) {
		// Related members
		actions.QuickLink(
			"#related-members",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-members > header .element-count",
			"#related-members > ul",
			["Count", ">*"]
		);
	};
});

// When a link to the current page is clicked on a panel, the panel should
// collapse.
getLayouts.then((layouts) => {
	// Only for small layout, where panel covers the entire viewport.
	const layoutSmall = layouts.get("small");
	if (!layoutSmall) {
		return;
	};

	const focusNone = document.getElementById("focus-none");
	if (!focusNone) {
		return;
	};

	function refocus(e) {
		if (!layoutSmall.matches) {
			return;
		};
		if (!(e.target instanceof HTMLAnchorElement)) {
			return;
		};
		const l = window.location;
		const a = new URL(e.target.href);
		if (a.origin !== l.origin || a.pathname !== l.pathname) {
			return;
		}
		focusNone.checked = true;
	};

	function applyToPanel(name) {
		const panel = document.getElementById(name);
		if (panel) {
			const section = panel.querySelector(":scope > section");
			if (section) {
				section.addEventListener("click", refocus);
			};
		};
	}

	applyToPanel("nav-panel");
});

// Collapse panels when layout changes to standard.
getLayouts.then((layouts) => {
	const layoutStandard = layouts.get("standard");
	if (!layoutStandard) {
		return;
	};

	const focusNone = document.getElementById("focus-none");
	if (!focusNone) {
		return;
	};

	layoutStandard.addEventListener("change", (e) => {
		if (e.matches) {
			focusNone.checked = true;
		};
	})
});