"use strict";

import { entityIcon } from "./icon.js";

let pathSub = "";
{
	let sub = document.head.querySelector(`meta[name="path-sub"]`);
	if (sub) {
		pathSub = sub.content;
	};
};

export function sanitize(name) {
	return name.replaceAll("<", "").replaceAll(">", "");
};

function typePath(type) {
	switch (type.toLowerCase()) {
	case "class":
		return "class";
	case "property":
		return "class";
	case "function":
		return "class";
	case "event":
		return "class";
	case "callback":
		return "class";
	case "enum":
		return "enum";
	case "enumitem":
		return "enum";
	case "type":
		return "type";
	};
}

function href(kind, row) {
	let link;
	switch (kind) {
	case "link":
		link = `${pathSub}/${typePath(row.type)}/${sanitize(row.primary)}.html`;
		if (row.secondary) {
			link += `#member-${row.secondary}`;
		};
		return link;
	};

	let type = row.type;
	switch (typePath(row.type)) {
	case "class":
		type = "classes";
		break;
	case "enum":
		type = "enums";
		break;
	case "type":
		type = "datatypes";
		break;
	};

	switch (kind) {
	case "hub":
		link = `https://create.roblox.com/docs/reference/engine/${type}/${sanitize(row.primary)}`
		if (row.secondary) {
			link += `#${row.secondary}`;
		};
		break;
	case "doc":
		link = `https://github.com/Roblox/creator-docs/blob/main/content/en-us/reference/engine/${type}/${sanitize(row.primary)}.yaml`
		break;
	};

	return link;
};

export function entityLink(row, kind, simple) {
	kind ||= "link";
	let element;
	switch (kind) {
	case "nolink":
		element = document.createElement("span");
		break;
	default:
		element = document.createElement("a");
		element.classList.add("entity-link");
		element.href = href(kind, row);
		break;
	};

	switch (kind) {
	case "hub":
		if (!simple) {
			entityIcon(row, kind).then((icon) => element.insertAdjacentElement("afterbegin", icon));
		};
		element.appendChild(new Text("CreatorHub"));
		return element;
	case "doc":
		if (!simple) {
			entityIcon(row, kind).then((icon) => element.insertAdjacentElement("afterbegin", icon));
		};
		element.appendChild(new Text("Doc source"));
		return element;
	};

	// Decorate status.
	if (!simple) {
		element.classList.add("deco");
		if (row.tag("Deprecated")) {
			element.classList.add("deprecated");
		};
		if (row.tag("NotBrowsable")) {
			element.classList.add("unbrowsable");
		};
		if (row.tag("Hidden")) {
			element.classList.add("hidden");
		};
		if (row.removed) {
			element.classList.add("removed");
		};
	};

	if (!simple) {
		entityIcon(row, kind).then((icon) => element.insertAdjacentElement("afterbegin", icon));
	};

	// Render text.
	let text = "";
	if (simple) {
		if (row.secondary) {
			text += `${row.secondary}`;
		} else {
			text += `${row.primary}`;
		};
	} else {
		text += `${row.primary}`;
		if (row.secondary) {
			text += `.${row.secondary}`;
		};
	};
	element.appendChild(new Text(text));

	return element;
};