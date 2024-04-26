import "./settings.js"
import "./search.js"
import "./updates.js"
import "./classes.js"
import {actions} from "./actions.js"

function domLoaded() {
	const body = document.body;

	if (body.matches(".kind-home, .kind-section")) {
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
		// ToC
		actions.QuickLink(
			"#toc-superclasses",
			"#superclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-subclasses",
			"#subclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-sibclasses",
			"#sibclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-hierarchy",
			"#toc-hierarchy > ol",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-removed-members-index",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["HideIfZero", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#toc-members",
			"#toc-members > ol",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-removed-members",
			"#toc-removed-members > ol",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-related-classes",
			"#related-classes > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-related-members",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-related-enums",
			"#related-enums > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-related-types",
			"#related-types > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-references",
			"#toc-references > ol",
			["HideIfZero", ">*"]
		);

		// Sections
		actions.QuickLink(
			"#superclasses",
			"#superclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#subclasses",
			"#subclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#sibclasses",
			"#sibclasses > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#hierarchy",
			"#hierarchy",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#removed-members-index",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["HideIfZero", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#members",
			"#members > .members-sections",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#removed-members",
			"#removed-members > .members-sections",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-classes",
			"#related-classes > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-members",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-enums",
			"#related-enums > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#related-types",
			"#related-types > ul",
			["HideIfZero", ">*"]
		);

		// Counters
		actions.QuickLink(
			"#superclasses > header .element-count",
			"#superclasses > ul",
			["Count", ">*"]
		);
		actions.QuickLink(
			"#subclasses > header .element-count",
			"#subclasses > ul",
			["Count", ">*"]
		);
		actions.QuickLink(
			"#sibclasses > header .element-count",
			"#sibclasses > ul",
			["Count", ">*"]
		);
		actions.QuickLink(
			"#members-index > header .element-count",
			"#members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#removed-members-index > header .element-count",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#members > header .element-count",
			"#members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#removed-members > header .element-count",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#history > header .element-count",
			"#history > ul",
			["Count", ">*"]
		);
		const target = document.querySelector("#history > header .element-count");
		document.querySelector("#history input.filter-input").addEventListener("change", function() {
			actions.Update(target);
		})
		actions.QuickLink(
			"#related-classes > header .element-count",
			"#related-classes > ul",
			["Count", ">*"]
		);
		actions.QuickLink(
			"#related-members > header .element-count",
			"#related-members > ul",
			["Count", ">*"]
		);
		actions.QuickLink(
			"#related-enums > header .element-count",
			"#related-enums > ul",
			["Count", ">*"]
		);
		actions.QuickLink(
			"#related-types > header .element-count",
			"#related-types > ul",
			["Count", ">*"]
		);
	};

	if (body.matches(".kind-page.type-enum")) {
		// ToC
		actions.QuickLink(
			"#toc-references",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);
		actions.QuickLink(
			"#toc-removed-members-index",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["HideIfZero", ">:not(.empty)"]
		);

		// Sections
		actions.QuickLink(
			"#removed-members-index",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["HideIfZero", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#related-members",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);

		// Counters
		actions.QuickLink(
			"#members-index > header .element-count",
			"#members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#removed-members-index > header .element-count",
			"#removed-members-index > .index-card > tbody:first-of-type",
			["Count", ">:not(.empty)"]
		);
		actions.QuickLink(
			"#history > header .element-count",
			"#history > ul",
			["Count", ">*"]
		);
		const target = document.querySelector("#history > header .element-count");
		document.querySelector("#history input.filter-input").addEventListener("change", function() {
			actions.Update(target);
		})
		actions.QuickLink(
			"#related-members > header .element-count",
			"#related-members > ul",
			["Count", ">*"]
		);
	};

	if (body.matches(".kind-page.type-type")) {
		// Sections
		actions.QuickLink(
			"#related-members",
			"#related-members > ul",
			["HideIfZero", ">*"]
		);

		// Counters
		actions.QuickLink(
			"#related-members > header .element-count",
			"#related-members > ul",
			["Count", ">*"]
		);
	};
};

if (document.readyState === "loading") {
	window.addEventListener("DOMContentLoaded", domLoaded);
} else {
	domLoaded();
};
