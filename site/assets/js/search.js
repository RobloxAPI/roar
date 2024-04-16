"use strict";

import {fuzzy_match} from "./fuzzy.js";

function u8(dv, offset) {
	return dv.getUint8(offset);
};

function u16(dv, offset) {
	return dv.getUint16(offset, true);
};

function u24(dv, offset) {
	return dv.getUint16(offset, true) + (dv.getUint8(offset+2) << 16);
};

function u32(dv, offset) {
	return dv.getUint32(offset, true);
};

class Database {
	constructor(buf) {
		this.buf = buf;
		this.data = new DataView(buf);
		this.LEN_STRINGS = u16(this.data, 0);
		this.LEN_BLOB    = u24(this.data, 2);
		this.LEN_TYPES   = u8(this.data, 5);
		this.LEN_TAGS    = u8(this.data, 6);
		this.LEN_SECS    = u8(this.data, 7);
		this.LEN_SAFES   = u8(this.data, 8);
		this.LEN_CATS    = u8(this.data, 9);

		this.OFF_STRINGS = 10 + this.LEN_TYPES*2;
		this.OFF_BLOB    = this.OFF_STRINGS + this.LEN_STRINGS;
		this.OFF_TYPES   = this.OFF_BLOB + this.LEN_BLOB;
		this.OFF_TAGS    = this.OFF_TYPES + this.LEN_TYPES;
		this.OFF_SECS    = this.OFF_TAGS + this.LEN_TAGS;
		this.OFF_SAFES   = this.OFF_SECS + this.LEN_SECS;
		this.OFF_CATS    = this.OFF_SAFES + this.LEN_SAFES;
		this.OFF_ROWS    = this.OFF_CATS + this.LEN_CATS;
		this.SIZ_ROW     = 23;

		this.strings = Array(this.LEN_STRINGS);
		const d = new TextDecoder();
		for (let i=0, o=0; i < this.LEN_STRINGS; i++) {
			const z = u8(this.data, this.OFF_STRINGS+i);
			const s = buf.slice(this.OFF_BLOB+o, this.OFF_BLOB+o+z);
			this.strings[i] = d.decode(s);
			o += z;
		};

		this.types = Array(this.LEN_TYPES);
		for (let i = 0; i < this.LEN_TYPES; i++) {
			this.types[i] = this.strings[u8(this.data, this.OFF_TYPES + i)];
		};

		this.tags = new Map();
		for (let i = 0; i < this.LEN_TAGS; i++) {
			const tag = this.strings[u8(this.data, this.OFF_TAGS + i)];
			// First bit reserved for removed flag.
			this.tags.set(tag, i + 1);
		};

		this.secs = Array(this.LEN_SECS);
		for (let i = 0; i < this.LEN_SECS; i++) {
			this.secs[i] = this.strings[u8(this.data, this.OFF_SECS + i)];
		};

		this.safes = Array(this.LEN_SAFES);
		for (let i = 0; i < this.LEN_SAFES; i++) {
			this.safes[i] = this.strings[u8(this.data, this.OFF_SAFES + i)];
		};

		this.cats = Array(this.LEN_CATS);
		for (let i = 0; i < this.LEN_CATS; i++) {
			this.cats[i] = this.strings[u8(this.data, this.OFF_CATS + i)];
		};

		this.tables = new Map();
		this.LEN_ROWS = 0;
		this.EOF = this.OFF_ROWS;
		for (let i = 0; i < this.LEN_TYPES; i++) {
			const lenTypeTable = u16(this.data, 10+i*2);
			this.tables.set(this.types[i], {
				offset: this.EOF,
				length: lenTypeTable,
			});
			this.LEN_ROWS += lenTypeTable;
			this.EOF += lenTypeTable*this.SIZ_ROW;
		};

		console.assert(this.EOF === buf.byteLength, this);

		this.T = {};
		for (let type of this.types) {
			this.T[type.toUpperCase()] = type;
		};
		this.T.ALL = this.types;
		this.T.PRIMARY = ["Class", "Enum", "Type"];
		this.T.MEMBERS = this.types.filter(x => !(["Class", "Enum", "EnumItem", "Type"].includes(x)));
		this.T.SECONDARY = this.T.MEMBERS.concat(["EnumItem"]);
	};
	length(type) {
		return this.tables.get(type).length;
	};
	string(i) {
		return this.strings[i];
	};
	row(type, i) {
		return new Row(this, type, i);
	};
};

// 4-bit enumeration packed into lower 4 bits.
function e0(table, data, i, e) {
	const v = (u8(data, i) & 0b00001111) >> 0;
	if (v == 0xF) {
		return undefined;
	};
	return table[e][v];
};

// 4-bit enumeration packed into upper 4 bits.
function e1(table, data, i, e) {
	const v = (u8(data, i) & 0b11110000) >> 4;
	if (v == 0xF) {
		return undefined;
	};
	return table[e][v];
};

// 8-bit enumeration. Value is an index of a prefabricated array of string
// indices.
function e2(table, data, i, e) {
	const v = u8(data, i);
	if (v == 0xFF) {
		return undefined;
	};
	return table[e][v];
};

// String. Value is an index of an array of strings.
function s2(table, data, i) {
	const v = u16(data, i);
	if (v == 0xFFFF) {
		return undefined;
	};
	return table.strings[v];
}

// Flags. Value is a bit field.Bit representation is determined by header.
function f4(table, data, i) {
	const v = u32(data, i);
	if (v == 0xFFFFFFFF) {
		return undefined;
	};
	return v;
}

// uint8.
function n1(table, data, i) {
	const v = u8(data, i);
	if (v == 0xFF) {
		return undefined;
	};
	return v;
}

// uint16.
function n2(table, data, i) {
	const v = u16(data, i);
	if (v == 0xFFFF) {
		return undefined;
	};
	return v;
}

// uint32.
function n4(table, data, i) {
	const v = u32(data, i);
	if (v == 0xFFFFFFFF) {
		return undefined;
	};
	return v;
}

// 8-bit Bool.
function b1(table, data, i) {
	const v = u8(data, i);
	if (v == 0xFF) {
		return undefined;
	} else if (v == 0) {
		return false;
	};
	return true;
}

// Defines how bytes of a row can be interpreted. Certain definitions assume the
// entity type of the row. Invalid data can be returned if a field is not used
// with the correct type.
//
// The first element is a function that receives a Database, a DataView, and the
// remaining elements.
const F = {
	// Entity

	PRIMARY      : [s2, 0],
	SECONDARY    : [s2, 2],
	FLAGS        : [f4, 4],

	// Class

	CLASS_NAME   : [s2,  0],
	SUPERCLASSES : [n1,  8],
	SUBCLASSES   : [n2,  9],
	MEMBERS      : [n2, 11],
	SUPERCLASS   : [s2, 15],
	SUBCLASS     : [s2, 17],
	MEM_CAT      : [s2, 19],

	// Member (property, function, event, callback)

	MEMBER_NAME   : [s2,  2],
	THREAD_SAFETY : [e0, 13, "safes"],
	SECURITY      : [e1, 13, "secs"],

	// Property

	CAN_SAVE        : [b1, 11],
	CAN_LOAD        : [b1, 12],
	READ_SECURITY   : [e1, 13, "secs"],
	WRITE_SECURITY  : [e0, 14, "secs"],
	VALUE_TYPE_CAT  : [e1, 14, "cats"],
	VALUE_TYPE_NAME : [s2, 15],
	CATEGORY        : [s2, 19],
	DEFAULT         : [s2, 21],

	// Function, event, callback

	RETURNS          : [n1,  8],
	PARAMETERS       : [n2,  9],
	PARAM_TYPE_OPT   : [b1, 11],
	RETURN_TYPE_OPT  : [b1, 12],
	PARAM_TYPE_CAT   : [e0, 14, "cats"],
	RETURN_TYPE_CAT  : [e1, 14, "cats"],
	RETURN_TYPE_NAME : [s2, 15],
	PARAM_TYPE_NAME  : [s2, 17],
	PARAM_NAME       : [s2, 19],
	PARAM_DEFAULT    : [s2, 21],

	// Enum

	ENUM_NAME  : [s2, 0],
	ENUM_ITEMS : [n2, 9],

	// EnumItem

	ITEM_NAME    : [s2,  2],
	LEGACY_NAMES : [n1,  8],
	ITEM_VALUE   : [n4,  9],
	LEGACY_NAME  : [s2, 15],

	// Type

	TYPE_NAME : [s2,  0],
	TYPE_CAT  : [e0, 14, "cats"],
};

// Defines operations that can be passed to the COMPARE method.
const O = {
	EQ: (a,b) => a === b,
	NE: (a,b) => a !== b,
	LT: (a,b) => a < b,
	LE: (a,b) => a <= b,
	GT: (a,b) => a > b,
	GE: (a,b) => a >= b,
};

// Contains methods to compare the field of a row to a value.
const M = {
	// Returns the score of a fuzzy match of a pattern against a field. Returns
	// zero unless the full pattern is matched.
	FUZZY: function(row, field, value) {
		const [matched, score] = fuzzy_match(value, row.field(field));
		if (matched) {
			return score;
		};
		return 0;
	},
	// Like FUZZY, but returns the score even without a full match.
	FUZZY_ALL: function(row, field, value) {
		const [matched, score] = fuzzy_match(value, row.field(field));
		return score;
	},
	// Returns 1 if the value is equal to the field, and 0 otherwise.
	EQUAL: function(row, field, value) {
		return (row.field(field) === value) ? 1 : 0;
	},
	// Returns 1 if the field matches the given regular expression, and 0
	// otherwise.
	REGEX: function(row, field, value, flags) {
		const re = new RegExp(value, flags);
		return (row.field(field).match(re)) ? 1 : 0;
	},
	// Returns 1.
	TRUE: function() {
		return 1;
	},
	// Returns the bit corresponding to flag within the field.
	FLAG: function(row, field, flag) {
		const flags = row.field(field);
		if (flags === undefined) {
			return 0;
		};
		const n = row.db.tags.get(flag);
		if (!n) {
			return 0;
		};
		return ((flags&(1<<n)) !== 0) ? 1 : 0;
	},
	// Returns the removed bit.
	REMOVED: function(row, field) {
		const flags = row.field(field);
		if (flags === undefined) {
			return 0;
		};
		return ((flags&(1<<0)) !== 0) ? 1 : 0;
	},
	// Returns 1 if the field is with the bounds of lower and upper, and 0
	// otherwise.
	RANGE: function(row, field, lower, upper) {
		const value = row.field(field);
		return (lower <= value && value <= upper) ? 1 : 0;
	},
	// Returns 1 if the comparision of the field to the value returns true
	// according to op, and 0 otherwise.
	COMPARE: function(row, field, op, value) {
		return op(row.field(field), value) ? 1 : 0;
	},
};

// Recursively checks if row matches expr.
function rowMatches(row, expr) {
	let result = 0;
	switch (expr.expr) {
	case "op":
		// Skip if row and op types do not match.
		if (!expr.types.includes(row.type)) {
			return 0;
		};
		// Clamp negative scores to 0.
		return Math.max(0, expr.method(row, ...expr.args));
	case "and":
		// All operands must return a positive score. Result is the lowest
		// score.
		result = Infinity;
		for (let op of expr.operands) {
			const r = rowMatches(row, op);
			if (r < result) {
				result = r;
			};
			if (r <= 0) {
				break;
			};
		};
		return result;
	case "or":
		// At least one operand must return a positive score. Result is the
		// first matching score.
		result = 0;
		for (let op of expr.operands) {
			const r = rowMatches(row, op);
			if (r > result) {
				result = r;
				//TODO: Don't short-circuit so that the highest score can be
				//selected.
				break;
			};
		};
		return result;
	case "not":
		// Returns the negation of the operand. That is, if the score is
		// positive, then the result will be 0. If the score is 0, then the
		// result will be 1.
		return Math.max(0, 1 - rowMatches(row, expr.operand));
	};
	return result;
};

// Recursively finds the types of each operation in expr.
function exprTypes(types, expr) {
	switch (expr.expr) {
	case "op":
		types.push(...expr.types);
		break;
	case "and":
		for (let op of expr.operands) {
			exprTypes(types, op);
		};
		break;
	case "or":
		for (let op of expr.operands) {
			exprTypes(types, op);
		};
		break;
	case "not":
		exprTypes(types, expr.operand);
		break;
	};
};

// Performs a search of db using expr as the query.
function search(db, expr) {
	// Select only types relevant to the query.
	let types = [];
	exprTypes(types, expr);
	types = [... new Set(types)];

	let results = [];
	for (let type of types) {
		const length = db.tables.get(type).length;
		for (let i = 0; i < length; i++) {
			const row = new Row(db, type, i);
			const score = rowMatches(row, expr)
			if (score > 0) {
				results.push([row, score]);
			};
		};
	};

	// Group results by identifier. JS does not have tuples, so an identifier is
	// built as a null-separated string.
	let ids = new Set();
	let final = [];
	for (let result of results) {
		const row = result[0];
		const id = row.type + "\0" + row.primary + (row.secondary ? ("\0"+row.secondary) : "");
		if (ids.has(id)) {
			continue;
		};
		ids.add(id);
		final.push(result);
	};
	// Sort results descending by score.
	final.sort((a, b) => b[1] - a[1]);
	return final;
};

class Row {
	constructor(db, type, i) {
		this.db = db;
		this.type = type;
		this.i = i;
		this.o = db.tables.get(type).offset;
		this.o += db.SIZ_ROW*i;
		this.buf = db.buf.slice(this.o, this.o + db.SIZ_ROW);
		this.data = new DataView(this.buf);
	};
	field(method) {
		return method[0](this.db, this.data, method[1], method[2]);
	};
	get primary() { return this.field(F.PRIMARY) };
	get secondary() { return this.field(F.SECONDARY) };
	get flags() { return this.field(F.FLAGS) };
	tag(t) {
		const flags = this.flags;
		if (flags === undefined) {
			return undefined;
		};
		const n = this.db.tags.get(t);
		if (!n) {
			return undefined;
		};
		return (flags&(1<<n)) !== 0;
	};
	get removed() {
		const flags = this.flags;
		if (flags === undefined) {
			return undefined;
		};
		return (flags&(1<<0)) !== 0
	};
};

let database = null;
window.DB = null;
let fetchedDB = false;
function getDatabase(success, failure) {
	if (database === null) {
		if (fetchedDB) {
			// TODO: error message.
			failure();
			return
		};

		function fail(event) {
			// TODO: error message.
			failure();
		};

		let dbPath = document.head.querySelector("meta[name=\"search-db\"]");
		if (dbPath === null) {
			return;
		};
		dbPath = dbPath.content;

		let req = new XMLHttpRequest();
		req.addEventListener("load", function(event) {
			database = new Database(event.target.response);
			window.DB = database;
			fetchedDB = true;
			success(database);
		});
		req.addEventListener("error", fail);
		req.addEventListener("abort", fail);
		req.open("GET", dbPath);
		req.responseType = "arraybuffer";
		req.send();
		return;
	};
	success(database);
	return;
}

const fields = {
	Class: [
		"CLASS_NAME",
		"SUPERCLASSES",
		"SUBCLASSES",
		"MEMBERS",
		"SUPERCLASS",
		"SUBCLASS",
		"MEM_CAT",
	],
	Property: [
		"CLASS_NAME",
		"MEMBER_NAME",
		"CAN_SAVE",
		"CAN_LOAD",
		"THREAD_SAFETY",
		"READ_SECURITY",
		"WRITE_SECURITY",
		"VALUE_TYPE_CAT",
		"VALUE_TYPE_NAME",
		"CATEGORY",
		"DEFAULT",
	],
	Function: [
		"CLASS_NAME",
		"MEMBER_NAME",
		"RETURNS",
		"PARAMETERS",
		"PARAM_TYPE_OPT",
		"RETURN_TYPE_OPT",
		"THREAD_SAFETY",
		"SECURITY",
		"PARAM_TYPE_CAT",
		"RETURN_TYPE_CAT",
		"RETURN_TYPE_NAME",
		"PARAM_TYPE_NAME",
		"PARAM_NAME",
		"PARAM_DEFAULT",
	],
	Event: [
		"CLASS_NAME",
		"MEMBER_NAME",
		"PARAMETERS",
		"PARAM_TYPE_OPT",
		"THREAD_SAFETY",
		"SECURITY",
		"PARAM_TYPE_CAT",
		"PARAM_TYPE_NAME",
		"PARAM_NAME",
	],
	Callback: [
		"CLASS_NAME",
		"MEMBER_NAME",
		"RETURNS",
		"PARAMETERS",
		"PARAM_TYPE_OPT",
		"RETURN_TYPE_OPT",
		"THREAD_SAFETY",
		"SECURITY",
		"PARAM_TYPE_CAT",
		"RETURN_TYPE_CAT",
		"RETURN_TYPE_NAME",
		"PARAM_TYPE_NAME",
		"PARAM_NAME",
	],
	Enum: [
		"ENUM_NAME",
		"ENUM_ITEMS",
	],
	EnumItem: [
		"ENUM_NAME",
		"ITEM_NAME",
		"LEGACY_NAMES",
		"ITEM_VALUE",
		"LEGACY_NAME",
	],
	Type: [
		"TYPE_NAME",
		"TYPE_CAT",
	],
};

window.F = F;
window.M = M;
window.O = O;
window.search = function(expr) {
	getDatabase(
		function(db) {
			const main = document.querySelector("body > main");
			if (!main) {
				return;
			};
			// console.log("DB", db);

			main.replaceChildren();

			const results = search(db, expr).slice(0, 50);
			// console.log("RESULTS", results);
			const list = document.createElement("ul");
			for (let [row, score] of results) {
				const item = document.createElement("li");
				let text = `(${score}) ${row.type} ${row.primary}`;
				if (row.secondary) {
					text += `.${row.secondary}`;
				};
				item.textContent = text;
				list.appendChild(item);
			};
			main.appendChild(list);
		},
		function() {
			// TODO: error message.
			console.log("DB FAIL");
		}
	);
};

function element(type, text) {
	const e = document.createElement(type);
	e.textContent = text;
	return e;
};

function renderList(text, items) {
	const item = element("li", text);
	const ul = document.createElement("ul");
	for (let item of items) {
		ul.appendChild(element("li", item));
	};
	item.appendChild(ul);
	return item;
};

function renderSearchData() {
	const main = document.querySelector("body > main");
	if (!main) {
		return;
	};
	main.replaceChildren();
	getDatabase(
		function(db) {
			console.log("DB", db);

			main.appendChild(element("h2", "Database enumerations"));
			const enums = document.createElement("ul");
			enums.style = `display:flex; flex-flow:wrap row; gap:var(--indent)`;
			enums.appendChild(renderList(`Type (${db.types.length})`, db.types));
			enums.appendChild(renderList(`Tag (${db.tags.size})`, [...db.tags.keys()]));
			enums.appendChild(renderList(`Security (${db.secs.length})`, db.secs));
			enums.appendChild(renderList(`ThreadSafety (${db.safes.length})`, db.safes));
			enums.appendChild(renderList(`TypeCategory (${db.cats.length})`, db.cats));
			main.appendChild(enums);

			main.appendChild(element("h2", `Database tables (${db.LEN_ROWS} rows)`));
			for (let type of db.types) {
				const length = db.length(type);

				const details = document.createElement("details");
				details.appendChild(element("summary", `${type} (${length} rows)`));

				const table = document.createElement("table");
				const thead = document.createElement("thead");
				const tbody = document.createElement("tbody");
				table.appendChild(thead);
				table.appendChild(tbody);
				details.appendChild(table);

				table.classList.add("search-database-table");

				const trh = document.createElement("tr");
				thead.appendChild(trh);
				trh.appendChild(element("th", "Row"));
				trh.appendChild(element("th", "Type"));
				for (const field of fields[type]) {
					trh.appendChild(element("th", field));
				};
				trh.appendChild(element("th", "removed"));
				for (const [tag] of db.tags) {
					trh.appendChild(element("th", tag));
				};
				for (let i = 0; i < length; i++) {
					const row = db.row(type, i);
					const tr = document.createElement("tr");
					tr.appendChild(element("td", i));
					tr.appendChild(element("td", type));
					for (const field of fields[type]) {
						const value = row.field(F[field])
						const td = document.createElement("td");
						if (value === undefined) {
							td.classList.add("x");
						} else {
							td.textContent = value;
						};
						tr.appendChild(td);
					};
					{
						const value = row.removed;
						let td = document.createElement("td");
						if (value === undefined) {
							td.classList.add("x");
						} else {
							td.textContent = value ? "true" : "";
						};
						tr.appendChild(td);
					};
					for (const [tag] of db.tags) {
						const value = row.tag(tag);
						let td = document.createElement("td");
						if (value === undefined) {
							td.classList.add("x");
						} else {
							td.textContent = value ? "true" : "";
						};
						tr.appendChild(td);
					};

					tbody.appendChild(tr);
				};

				main.appendChild(details);
			};
			const gap = document.createElement("div");
			gap.classList.add("gap");
			main.appendChild(gap);
		},
		function() {
			// TODO: error message.
			console.log("DB FAIL");
		}
	);
};

function initSearchData() {
	const message = document.getElementById("search-data");
	if (!message) {
		return;
	};
	const replace = message.querySelector(".replace");
	if (replace) {
		const button = document.createElement("button");
		button.textContent = "Click";
		button.addEventListener("click", function(event) {
			button.disabled = true;
			renderSearchData();
		});
		replace.replaceWith(button);
	};
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initSearchData);
} else {
	initSearchData();
};

console.log("SEARCH");
