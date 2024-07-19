import {settings, matchSecurity} from "./settings.js";
import {fuzzy_match} from "./fuzzy.js";
import {sanitize, entityLink} from "./link.js";
import * as grammar from "./grammar.js";
import * as queryGrammar from "./query.js";

function element(type, text) {
	const e = document.createElement(type);
	e.textContent = text;
	return e;
};

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
		this.tagsLower = new Map();
		for (let i = 0; i < this.LEN_TAGS; i++) {
			const tag = this.strings[u8(this.data, this.OFF_TAGS + i)];
			// First bit reserved for removed flag.
			this.tags.set(tag, i + 1);
			this.tagsLower.set(tag.toLowerCase(), i + 1);
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

		this.F = new Map([
			["is"             , {op: "is"                    , types: this.T.ALL}],
			["tag"            , {op: "tag"                   , types: this.T.ALL}],
			["primary"        , {field: F.PRIMARY            , types: this.T.ALL}],
			["secondary"      , {field: F.SECONDARY          , types: this.T.SECONDARY}],
			["removed"        , {field: F.REMOVED            , types: this.T.ALL}],
			["superclasses"   , {field: F.SUPERCLASSES       , types: [this.T.CLASS]}],
			["subclasses"     , {field: F.SUBCLASSES         , types: [this.T.CLASS]}],
			["members"        , {field: F.MEMBERS            , types: [this.T.CLASS]}],
			["ancestor"       , {field: F.ANCESTOR           , types: [this.T.CLASS]}],
			["superclass"     , {field: F.SUPERCLASS         , types: [this.T.CLASS]}],
			["subclass"       , {field: F.SUBCLASS           , types: [this.T.CLASS]}],
			["memcat"         , {field: F.MEM_CAT            , types: [this.T.CLASS]}],
			["threadsafety"   , {field: F.THREAD_SAFETY      , types: this.T.MEMBERS}],
			["security"       , {field: F.SECURITY           , types: this.T.MEMBERS}],
			["cansave"        , {field: F.CAN_SAVE           , types: [this.T.PROPERTY]}],
			["canload"        , {field: F.CAN_LOAD           , types: [this.T.PROPERTY]}],
			["readsecurity"   , {field: F.READ_SECURITY      , types: [this.T.PROPERTY]}],
			["writesecurity"  , {field: F.WRITE_SECURITY     , types: [this.T.PROPERTY]}],
			["valuetypecat"   , {field: F.VALUE_TYPE_CAT     , types: [this.T.PROPERTY]}],
			["valuetypename"  , {field: F.VALUE_TYPE_NAME    , types: [this.T.PROPERTY]}],
			["category"       , {field: F.CATEGORY           , types: [this.T.PROPERTY]}],
			["default"        , {field: F.DEFAULT            , types: [this.T.PROPERTY]}],
			["returns"        , {field: F.RETURNS            , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["parameters"     , {field: F.PARAMETERS         , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["paramtypeopt"   , {field: F.PARAM_TYPE_OPT     , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["returntypeopt"  , {field: F.RETURN_TYPE_OPT    , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["paramtypecat"   , {field: F.PARAM_TYPE_CAT     , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["returntypecat"  , {field: F.RETURN_TYPE_CAT    , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["returntypename" , {field: F.RETURN_TYPE_NAME   , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["paramtypename"  , {field: F.PARAM_TYPE_NAME    , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["paramname"      , {field: F.PARAM_NAME         , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["paramdefault"   , {field: F.PARAM_DEFAULT      , types: [this.T.FUNCTION, this.T.EVENT, this.T.CALLBACK]}],
			["enumitems"      , {field: F.ENUM_ITEMS         , types: [this.T.ENUM]}],
			["legacynames"    , {field: F.LEGACY_NAMES       , types: [this.T.ENUMITEM]}],
			["itemvalue"      , {field: F.ITEM_VALUE         , types: [this.T.ENUMITEM]}],
			["legacyname"     , {field: F.LEGACY_NAME        , types: [this.T.ENUMITEM]}],
			["typecat"        , {field: F.TYPE_CAT           , types: [this.T.TYPE]}],
		]);
		this.TF = new Map();
		for (let [name, expr] of this.F) {
			for (let type of expr.types) {
				let set = this.TF.get(type);
				if (!set) {
					set = new Set();
					this.TF.set(type, set);
				};
				set.add(name);
			};
		};
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

// Flags. Value is a bit field. Bit representation is determined by header.
function f4(table, data, i) {
	const v = u32(data, i);
	if (v == 0xFFFFFFFF) {
		return undefined;
	};
	return v;
}

// 32-bit bit field. Returns nth flag.
function f1(table, data, i, n) {
	const v = u32(data, i);
	if (v == 0xFFFFFFFF) {
		return undefined;
	};
	return (v&(1<<n)) !== 0;
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
export const F = {
	// Entity

	PRIMARY      : [s2, 0],
	SECONDARY    : [s2, 2],
	FLAGS        : [f4, 4],
	REMOVED      : [f1, 4, 0],

	// Class

	CLASS_NAME   : [s2,  0],
	SUPERCLASSES : [n1,  8],
	SUBCLASSES   : [n2,  9],
	MEMBERS      : [n2, 11],
	ANCESTOR     : [n1, 13],
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

// Contains methods to compare the field of a row to a value.
//
// Each method returns a score. A match is indicated by a positive score. A
// non-match is indicated by negative score. A score of 0 indicates an undefined
// field, and is also considered a non-match. Positive scores can have an
// arbitrary magntiude, which is relative to the result of a fuzzy match.
// Negative scores are normalized to -1.
export const M = {
	// Returns the score of a fuzzy match of a pattern against a field. Returns
	// zero unless the full pattern is matched.
	FUZZY: function(field, value) {
		const [matched, score] = fuzzy_match(value, field);
		if (matched) {
			return score;
		};
		return -1;
	},
	// Like FUZZY, but returns the score even without a full match.
	FUZZY_ALL: function(field, value) {
		const [matched, score] = fuzzy_match(value, field);
		return score;
	},
	// Returns 1 if the field matches the given regular expression, and -1
	// otherwise.
	REGEXP: function(field, regexp) {
		return (field.match(regexp)) ? 1 : -1;
	},
	// Returns 1 if the field contains the given value as a substring, and -1
	// otherwise.
	SUB: function(field, value) {
		return (field.indexOf(value)) >= 0 ? 1 : -1;
	},
	TRUE: function(field, score) {
		return score ? score : 1;
	},
	// Matches if the field is with the bounds of lower and upper. Returns the
	// field as the score.
	RANGE: (field, lower, upper) => ((lower <= field && field <= upper) ? field : -1),
	// Comparison operators.
	EQ: (field, value) => ((field === value) ? 1 : -1),
	NE: (field, value) => ((field !== value) ? 1 : -1),
	LT: (field, value) => ((field <   value) ? 1 : -1),
	LE: (field, value) => ((field <=  value) ? 1 : -1),
	GT: (field, value) => ((field >   value) ? 1 : -1),
	GE: (field, value) => ((field >=  value) ? 1 : -1),
	// Variants that return field as score (assuming number).
	N_EQ: (field, value) => ((field == value) ? Math.max(1, field) : -1),
	N_NE: (field, value) => ((field != value) ? Math.max(1, field) : -1),
	N_LT: (field, value) => ((field <  value) ? Math.max(1, field) : -1),
	N_LE: (field, value) => ((field <= value) ? Math.max(1, field) : -1),
	N_GT: (field, value) => ((field >  value) ? Math.max(1, field) : -1),
	N_GE: (field, value) => ((field >= value) ? Math.max(1, field) : -1),
};

// Recursively checks if row matches expr.
function rowMatches(row, expr) {
	switch (expr.expr) {
	case "op":
		// Skip if row and op types do not match.
		if (!expr.types.includes(row.type)) {
			return 0;
		};
		const fvalue = row.field(expr.field);
		if (fvalue === undefined) {
			return 0;
		};
		// Clamp negative scores.
		return Math.max(-1, expr.method(fvalue, ...expr.args));
	case "flag":
		// Skip if row and op types do not match.
		if (!expr.types.includes(row.type)) {
			return 0;
		};
		const flags = row.field(expr.field);
		if (flags === undefined) {
			return 0;
		};
		const n = row.db.tagsLower.get(expr.flag);
		if (!n) {
			return 0;
		};
		return ((flags&(1<<n)) !== 0) ? 1 : -1;
	case "any":
		// Skip if row and op types do not match.
		return (expr.types.includes(row.type)) ? 1 : -1;
	case "true":
		// Returns always postive match.
		return 1;
	case "false":
		// Returns always negative match.
		return -1;
	case "and":
		// All operands must return a positive score. Result is the highest
		// score.
		let result = 0;
		for (let op of expr.operands) {
			const r = rowMatches(row, op);
			if (r > result) {
				result = r;
			};
			if (r <= 0) {
				result = r;
				break;
			};
		};
		return result;
	case "or":
		// At least one operand must return a positive score. Result is the
		// first matching score.
		for (let op of expr.operands) {
			const r = rowMatches(row, op);
			if (r > 0) {
				//TODO: Don't short-circuit so that the highest score can be
				//selected.
				return r;
			};
		};
		return -1;
	case "not":
		// Returns the negation of the operand. This turns a match into a
		// non-match, and vise-versa. Zero, indicating undefined, is still
		// propagated as zero.
		return Math.max(-1, -rowMatches(row, expr.operand));
	};
	return -1;
};

// Recursively finds the types of each operation in expr.
function exprTypes(types, expr) {
	switch (expr.expr) {
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
	default:
		types.push(...expr.types);
		break;
	};
};

function visitRows(db, results, types, capture, visit) {
	for (let type of types) {
		const length = db.tables.get(type).length;
		for (let i = 0; i < length; i++) {
			const row = new Row(db, type, i);
			const score = rowMatches(row, capture);
			if (score > 0) {
				visit(row, score, type);
			};
		};
	};
}

// Performs a search of db using expr as the query.
function search(db, expr) {
	let searchResults = [];
	if (expr.global.results) {
		for (let x of expr.global.results) {
			searchResults.push({row: x, score: 1000});
		};
	};
	let capture = expr.capture;
	if (!capture && expr.global.list.length > 0) {
		// With no query, select all rows.
		capture = {expr: "true", types: db.T.ALL};
	}
	if (capture) {
		// Select only types relevant to the query.
		let types = [];
		exprTypes(types, capture);
		types = [... new Set(types)];

		if (expr.global.list.length > 0) {
			// List given fields of each matching row.
			let results = [];
			for (let list of expr.global.list) {
				if (list.op === "is") {
					// List types.
					const t = types.length > 0 ? types : list.types;
					visitRows(db, results, t, capture, (row, score, type) => {
						results.push({value: type, score: 1});
					});
				} else if (list.op === "tag") {
					// Every entity is considered as having every tag, so
					// unconditionally list all tags. Technically, this would be
					// incorrect if the query returned no results.
					for (let [tag] of db.tags) {
						results.push({value: tag, score: 1});
					};
				} else if (list.field === null) {
					// List all possible fields for matching rows.
					visitRows(db, results, types, capture, (row, score, type) => {
						for (let field of db.TF.get(type)) {
							results.push({value: field, row: row, score: score});
						};
					});
				} else {
					// List values of fields of matching rows.
					visitRows(db, results, list.types, capture, (row, score, type) => {
						const fvalue = row.field(list.field);
						if (fvalue === undefined) {
							return;
						};
						results.push({value: fvalue, row: row, score: score});
					});
				};
			};

			// Group results by identifier. JS does not have tuples, so an identifier is
			// built as a null-separated string.
			let ids = new Map();
			let final = [];
			for (let result of results) {
				const id = result.value;
				ids.set(id, (ids.get(id)||0)+result.score);
			};
			for (let [value, score] of ids) {
				final.push({value: value, score: score});
			};
			// Sort results descending by score.
			final.sort((a, b) => b.score - a.score);
			searchResults.push(...final);
		} else {
			// List each matching row.
			let results = [];
			for (let type of types) {
				const length = db.tables.get(type).length;
				for (let i = 0; i < length; i++) {
					const row = new Row(db, type, i);
					const score = rowMatches(row, capture);
					if (score > 0) {
						results.push({row: row, score: score});
					};
				};
			};

			// Group results by identifier. JS does not have tuples, so an identifier is
			// built as a null-separated string.
			let ids = new Set();
			let final = [];
			for (let result of results) {
				const row = result.row;
				const id = row.type + "\0" + row.primary + (row.secondary ? ("\0"+row.secondary) : "");
				if (ids.has(id)) {
					continue;
				};
				ids.add(id);
				final.push(result);
			};
			// Sort results descending by score.
			final.sort((a, b) => b.score - a.score);
			searchResults.push(...final);
		};
	};
	return new SearchResults(db, searchResults, expr.global.limit);
};

function forEachSecurity(row, visit) {
	switch (row.type) {
	case "Property":
		if (visit(row.field(F.READ_SECURITY)) === false) { return };
		if (visit(row.field(F.WRITE_SECURITY)) === false) { return };
	case "Function":
	case "Event":
	case "Callback":
		if (visit(row.field(F.SECURITY)) === false) { return };
	};
};

class SearchResults {
	constructor(database, rows, limit) {
		this.database = database;
		this.rows = rows;
		this.limit = limit;
	};
	render(parent) {
		let n = this.rows.length;
		if (n === 0) {
			parent.appendChild(element("i", "No results found."));
			return 0;
		};
		if (typeof this.limit === "number") {
			n = this.limit;
		} else {
			n = 50;
		};
		n = Math.max(0, Math.min(n, this.rows.length));
		for (let i = 0; i < n; i++) {
			const result = this.rows[i];
			const score = result.score;
			if (result.value !== undefined) {
				const item = document.createElement("li");
				item.title = `score: ${score}`;
				item.textContent = result.value;
				parent.appendChild(item);
				continue;
			};
			const row = result.row;
			const item = document.createElement("li");
			item.title = `score: ${score}`;
			if (typeof row === "string") {
				item.textContent = row;
				parent.appendChild(item);
				continue;
			};

			item.classList.add("set");
			if (row.tag("Deprecated")) {
				item.classList.add("deprecated");
			};
			if (row.tag("NotBrowsable")) {
				item.classList.add("unbrowsable");
			};
			if (row.tag("Hidden")) {
				item.classList.add("hidden");
			};
			if (row.removed) {
				item.classList.add("removed");
			};
			forEachSecurity(row, function(sec) {
				if (sec === "" || sec === "None") {
					return;
				};
				item.classList.add(`sec-${sec}`);
			});

			item.appendChild(entityLink(row));
			parent.appendChild(item);
		};
		return n;
	};
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
	field_name(name) {
		const method = F[name];
		if (!method) {
			return undefiend;
		};
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

let databasePromise = null;
function getDatabase() {
	if (databasePromise) {
		return databasePromise;
	}
	databasePromise = new Promise(function(resolve, reject) {
		let dbPath = document.head.querySelector("meta[name=\"search-db\"]");
		if (dbPath === null) {
			reject("Error: database path not found");
			return;
		};
		resolve(dbPath.content);
	})
	.then((location) => {
		return fetch(location)
			.then((resp) => {
				if (!resp.ok) {
					console.log("FETCH DATABASE", resp)
					throw "failed to fetch database";
				};
				return resp.arrayBuffer();
			})
	})
	.then((buffer) => {
		const DB = new Database(buffer);
		console.log("DATABASE", DB);
		return [DB, F, M];
	})
	return databasePromise;
};

const fields = {
	Class: [
		"CLASS_NAME",
		"SUPERCLASSES",
		"SUBCLASSES",
		"MEMBERS",
		"ANCESTOR",
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

function renderList(text, items) {
	const item = element("li", text);
	const ul = document.createElement("ul");
	for (let item of items) {
		ul.appendChild(element("li", item));
	};
	item.appendChild(ul);
	return item;
};

function cellContext(td, value, type, row, field) {
	let cat;
	switch (true) {
	case field === "CLASS_NAME":
	case field === "SUPERCLASS":
	case field === "SUBCLASS":
		td.appendChild(entityLink({type:"Class",primary:value}, "link", "simple"));
		return;
	case field === "MEMBER_NAME":
		const className = row.field(F.CLASS_NAME);
		td.appendChild(entityLink({type:"Class",primary:className,secondary:value}, "link", "simple"));
		return;
	case field === "ENUM_NAME":
		td.appendChild(entityLink({type:"Enum",primary:value}, "link", "simple"));
		return;
	case field === "ITEM_NAME":
		const enumName = row.field(F.ENUM_NAME);
		td.appendChild(entityLink({type:"Enum",primary:enumName,secondary:value}, "link", "simple"));
		return;
	case field === "TYPE_NAME":
		td.appendChild(entityLink({type:"Type",primary:value}, "link", "simple"));
		return;
	case field === "VALUE_TYPE_NAME":
		cat = row.field(F.VALUE_TYPE_CAT);
	case field === "RETURN_TYPE_NAME":
		cat = row.field(F.RETURN_TYPE_CAT);
	case field === "PARAM_TYPE_NAME":
		if (field === "PARAM_TYPE_NAME") {
			cat = row.field(F.PARAM_TYPE_CAT);
		};
		switch (cat) {
		case "Class":
		case "Enum":
			break;
		default:
			cat = "Type";
			break;
		};
		td.appendChild(entityLink({type:cat,primary:value}, "link", "simple"));
		return;
	};
	td.textContent = value;
};

function renderSearchData() {
	const main = document.getElementById("root-main");
	if (!main) {
		return;
	};
	main.style.display = "block";
	main.style.margin = "var(--halfbase)";
	main.replaceChildren();
	getDatabase()
		.then(function([db]) {
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

				table.classList.add("search-database");

				const trh = document.createElement("tr");
				thead.appendChild(trh);
				trh.appendChild(element("th", "Row"));
				trh.appendChild(element("th", "Type"));
				for (const field of fields[type]) {
					trh.appendChild(element("th", field));
				};
				trh.appendChild(element("th", "removed"));
				if (type !== "Type") {
					for (const [tag] of db.tags) {
						trh.appendChild(element("th", tag));
					};
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
							cellContext(td, value, type, row, field);
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
					if (type !== "Type") {
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
					};

					tbody.appendChild(tr);
				};

				main.appendChild(details);
			};
			const gap = document.createElement("div");
			gap.classList.add("gap");
			main.appendChild(gap);
		})
		.catch(function(msg, err) {
			console.log(msg, err);
			main.appendChild(element("p", msg));
		})
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

// Filter search results by current status settings. Note that, if a setting
// change causes an entity to become visible, it will not be reflected in
// visible search results until the search is ran again.
const securityIdentity = settings.Value("SecurityIdentity");
const showDeprecated = settings.Value("ShowDeprecated");
const showUnbrowsable = settings.Value("ShowNotBrowsable");
const showHidden = settings.Value("ShowHidden");
const showRemoved = settings.Value("ShowRemoved");
function statusFilter(results) {
	results.rows = results.rows.filter(function(result) {
		const row = result.row;
		if (!showDeprecated.value && row.tag("Deprecated")) {
			return false;
		};
		if (!showUnbrowsable.value && row.tag("NotBrowsable")) {
			return false;
		};
		if (!showHidden.value && row.tag("Hidden")) {
			return false;
		};
		if (!showRemoved.value && row.removed) {
			return false;
		};
		if (securityIdentity.value !== "All") {
			let ok = true;
			forEachSecurity(row, function(sec) {
				if (!matchSecurity(securityIdentity.value, sec)) {
					ok = false;
					return false;
				};
			});
			if (!ok) {
				return false;
			};
		};
		return true;
	})
	return results;
};

function initSearchInput() {
	const form = document.getElementById("search-form");
	if (!form) { return };
	const input = document.getElementById("search-input");
	if (!input) { return };
	const main = document.getElementById("root-main");
	if (!main) { return };

	const searchState = document.getElementById("focus-search");
	if (!searchState) { return };
	const noneState = document.getElementById("focus-none");
	if (!noneState) { return };

	// Show search form.
	form.classList.remove("js");

	// Create search results container.
	const searchResults = document.createElement("section");
	searchResults.id = "search-results";
	searchResults.style.display = "none";
	main.insertAdjacentElement("beforebegin", searchResults);

	const heading = element("h2", "Search results")
	searchResults.appendChild(heading);

	// Render search results. If falsy, results are hidden. If a string, it is
	// displayed as a message. Otherwise, must be an array of search results.
	function renderResults(results) {
		searchResults.replaceChildren(heading);

		if (!results) {
			// Hide results.
			main.style.display = "";
			searchResults.style.display = "none";
			return;
		}

		// Show results.
		main.style.display = "none";
		searchResults.style.display = "";
		heading.textContent = `Search results`

		switch (true) {
		case typeof results === "string":
			searchResults.appendChild(element("p", results));
			return;
		case results instanceof Error:
			searchResults.appendChild(element("p", `Error: ${results.message}`));
			return;
		case results instanceof Element:
			searchResults.appendChild(results);
			return;
		};

		const list = document.createElement("ul");
		const n = results.render(list);
		searchResults.appendChild(list);
		heading.textContent += ` (${n})`;
	};

	let parseQuery, printQuery;
	function doSearch(query, render) {
		render ||= renderResults;
		if (query.length === 0) {
			render(null);
			return;
		};
		console.log("SEARCHING", query);
		render("Searching...");
		getDatabase()
			.then(function([DB, F, M]) {
				if (!parseQuery) {
					[parseQuery, printQuery] = queryGrammar.forDatabase(DB, F, M);
					parseQuery = parseQuery();
				};
				let expr;
				if (window.DEBUG) {
					if (printQuery) {
						console.log(printQuery());
						printQuery = undefined;
					};
					expr = parseQuery(query, "main");
					console.log("EXPR", expr);
					if (!expr) {
						render(`Error parsing query.`);
						return;
					} else if (expr instanceof grammar.Error) {
						render(`Error parsing query: line ${expr.line}, column ${expr.column}: ${expr.error}`);
						return;
					};
					render(statusFilter(search(DB, expr)));
				} else {
					try {
						expr = parseQuery(query, "main", "debug");
					} catch (error) {
						console.log("PARSE ERROR", error);
					};
					if (!expr || (expr instanceof grammar.Error)) {
						// Fallback to fuzzy search.
						expr = {
							global: {results: [], list: []},
							capture: {expr: "or", operands: [
								{expr: "op",
									types: DB.T.PRIMARY,
									field: F.PRIMARY,
									method: M.FUZZY, args: [query],
								},
								{expr: "op",
									types: DB.T.SECONDARY,
									field: F.SECONDARY,
									method: M.FUZZY, args: [query],
								},
							]},
						};
					};
					try {
						render(statusFilter(search(DB, expr)));
					} catch (error) {
						console.log("SEARCH ERROR", error);
						render("An error occurred.");
					};
				};
			})
			.catch(function(msg, err) {
				console.log(msg, err);
				render(msg);
			})
	};

	function focusSearch() {
		searchState.checked = true;
		input.focus();
		input.select();
	};

	function blurSearch() {
		renderResults(null);
		input.blur();
		noneState.checked = true;
	}

	// Add shortcuts to focus search bar.
	document.addEventListener("keydown",function(e) {
		if (e.altKey || e.ctrlKey || e.metaKey) {
			return;
		};
		if (e.key === "Escape" && input === document.activeElement) {
			blurSearch();
			return;
		};
		if ((e.key === "s" || e.key === "S") && input !== document.activeElement) {
			e.preventDefault();
			focusSearch();
			return;
		};
	});

	input.addEventListener("focus", function() {
		focusSearch();
	});
	searchState.addEventListener("change", function() {
		focusSearch();
	});
	for (let state of document.querySelectorAll("input[name='focused-panel']")) {
		if (state === searchState) {
			continue
		};
		state.addEventListener("change", function() {
			renderResults(null);
		});
	};

	// Show results as the user types.
	let timer;
	input.addEventListener("input", function() {
		timer && clearTimeout(timer);
		timer = window.setTimeout(function() {
			doSearch(input.value);
		}, 500);
	});

	// Hide results when a result on the current page is selected.
	searchResults.addEventListener("click", function(event) {
		let anchor = event.target.closest("a");
		if (anchor === null) {
			return;
		};
		if (document.location.origin == anchor.origin &&
			document.location.pathname == anchor.pathname) {
			renderResults(null);
		};
	});

	// Reshow results on focus.
	input.addEventListener("focus", function() {
		if (input.value.length > 0 || searchResults.style.display !== "none") {
			doSearch(input.value);
		};
	});

	// Go to the first result when the user presses enter.
	form.addEventListener("submit", function(event) {
		event.preventDefault();
		const a = searchResults.querySelector("a");
		if (a) {
			if (document.location.origin == a.origin &&
				document.location.pathname == a.pathname) {
				renderResults(null);
				if (a.hash.length > 0) {
					document.location.hash = a.hash;
				}
			} else {
				document.location = a.href;
			}
		};
	});

	if (input.value.length > 0) {
		focusSearch();
		doSearch(input.value);
	} else {
		// Try reading URL query.
		let params = new URLSearchParams(document.location.search);
		let q = params.get("q");
		if (q !== null && q !== "") {
			doSearch(q, function(results) {
				if (!results) {
					return;
				};
				if (typeof results === "string") {
					return;
				};

				let go = params.get("go");
				if (!go && params.get("devhub")) {
					go = "hub";
				};
				if (!go) {
					renderResults(results);
					return;
				};
				// Automatically redirect to external site.
				let first = results.rows[0];
				if (!first) {
					return;
				};
				let a = entityLink(first.row, go, "simple");
				if (a.href === "") {
					renderResults(results);
					return;
				};
				document.location = a.href;
			});
		};
	};
}

new Promise(resolve => {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", resolve);
	} else {
		resolve();
	};
}).then(() => {
	initSearchData();
	initSearchInput();
});
