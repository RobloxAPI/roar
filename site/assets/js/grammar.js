/* Parser generator. Based off of LuaText by stravant.

Import the module:

	import * as grammar from "./grammar.js"

Generate a new parser:

	let parseExample = grammar.make(exampleGrammar)

Parse a string:

	try {
		let result = parseExample("example.string")
		console.log(result.match)   // The matched string.
		console.log(result.capture) // The captured value.
	} catch (error) {
		console.log("error:", error)
	}

By default, the input is parsed using the rule named "main". A specific rule can
be used by passing it as the second argument:

	let result = parseExample("example.string", "exampleRule")

The grammar definition is is a function that is expected to return an array of
value pairs, the same as expected from the Map constructor:

	function definition()
		return [
			[name, value],
			[name, value],
			[etc, etc],
		]
	}

Each pair defines a named rule of the grammar.

	[
		["main", ...],
		["exampleRule", ...],
	]

The definition receives an object with number of functions that are used to
construct rules. For convenience, destructuring this object is recommended:

	function definition({ref, lit, seq, alt, opt, rep, exc, init, name, ignoreCase}) {
	};

ref(name: string): rule

	Defines a reference to a named rule.

	[
		["main", ref("exampleRule")],
		["exampleRule", ...],
	]

lit(literal: string|RegExp): rule

	Defines a literal token.

	If *literal* is a string, then the token matches the string exactly.

	If *literal* is a RegExp, then the token matches if the expression matches.
	Note that the expression is not anchored by default, which allows a regexp
	to match anything up to and including the matchex expression. Typically "^"
	is used to anchor the expression to the current location. For example, /\s+/
	matches anything up to and including the next sequence of whitespace
	characters, while /^\s+/ matches if the next characters are whitespace.

	["comment_open", lit("//")]
	["whitespace"  , lit(/^\s*?/)]

seq(rules: ...rule): rule

	Sequence. Produces a rule that matches if all of its rules match.

	// Match space-separated sequence of 3 numbers.
	["vector3", seq(
		ref("number"),
		ref("whitespace"),
		ref("number"),
		ref("whitespace"),
		ref("number"),
	)]

	Returns the last non-undefined capture.

alt(rules: ...rule): rule

	Alteration. Produces a rule that matches if any of its rules match.

	["value", alt(
		ref("bool"),
		ref("number"),
		ref("string"),
	)]

	Returns the capture of the first matching rule.

opt(rules: ...rule): rule

	Optional. Produces a rule that matches 0 or 1 of seq(...rules).

	["sign", opt(lit("-"))]
	["integer", seq(ref("sign"), ref("digits"))]

	Returns the last non-undefined capture, or undefined if no rules matched.

rep(rules: ...rule): rule

	Repetition. Produces a rule that matches any number of seq(...rules).

	// []
	// [v,]
	// [v,v,]
	// [v,v,etc,]
	["array", seq(lit("["), rep(ref("value"), lit(",")), lit("]"))]

	Returns the last non-undefined capture.

exc(rule: rule): rule

	Exception. Produces a rule that matches everything up to but excluding the
	given rule.

	// Matches the starting quote, then anything up to the next quote, then the
	// next quote itself.
	["string", seq(lit('"'), rep(exc('"')), lit('"'))]

	Returns the capture of the inner rule.

While parsing, "captures" allow structured results to be produced by capturing
"matches" (matched substrings of the input) and passing them through the parser
stack.

init(fn: () => any): methods

	Sets a function that returns a new capture value, set before the rule is
	invoked. While unset, the capture is undefined.

	The init function returns an object that contains each of the constructor
	functions. Calling one produces the rule initialized with the init function.

	// Without initialized value.
	ref("example")   // Rule.
	.field("result") // Decorator suffix.

	// With initialized value.
	init(() => ({result:"default"})) // Decorator prefix.
	.ref("example")                  // Rule.
	.field("result")                 // Decorator suffix.

Each rule has a number of methods that configure how the rule handles captures,
as well as other behaviors. Every method returns the rule itself, allowing them
to be chained.

name(name: string)

	Sets the name of the rule, which can be used within messages when the rule
	produces an error. The name overrides outer rules, and is inherited by inner
	rules.

ignoreCase()

	Causes inner lit rules to become case-insensitive.

The following methods set a behavior to be invoked after the rule successfully
matches. Only one of these can be set at a time.

While a capture method is set, the method receives the rule's capture. If this
capture is undefined, then it receives the rule's match instead. If no capture
method is set, then the rule always returns its capture, regardless if it is
undefined or not.

set(value: any?)

	After the rule matches, sets the capture to *value*. If *value* is
	undefined, then the capture is set to the match.

append()

	After the rule matches, appends the match to the capture. If the capture is
	not an Array, then it is first set to a new Array.

field(name: string)

	After the rule matches, assigns the match to the *name* field of the
	capture. If the capture is undefined or null, then it is first set to a new
	Object.

appendField(name: string)

	After the rule matches, appends the match to the *name* field of the
	capture. If the capture is undefined or null, then it is first set to a new
	Object. If the *name* field is not an Array, then it is first set to a new
	Array.

call(fn: (a: any, x: any) => any)

	After the rule matches, calls *fn*. The function receives the capture (a)
	and the match (x) as arguments, and is expected to return the new capture.

	// Append the match to the capture; keep the capture.
	(a, x) => {
		a.push(x)
		return a
	}

skip()

	After the rule matches, sets the capture to undefined.

*/

// Returns the line and column of offset i within s.
function position(s, i) {
	const r = s.slice(0, i);
	let line = 1;
	for (let c of r) { if (c == "\n") { line++ }};
	const column = r.lastIndexOf("\n");
	return [line, column >= 0 ? i-column : r.length+1];
};

// Returns a string indicating that *expected* was expected, but *got* was
// gotten instead.
function expected(s, i, expected, got) {
	if (got) {
		got = JSON.stringify(got);
	} else {
		if (i >= s.length) {
			got = "end of query";
		} else {
			got = s[i];
		};
	};
	let [line, column] = position(s, i);
	return `${line}:${column}: expected ${expected}, got ${got}`;
};

// Produces a new parser from a grammar.
export function make(grammar, globalValue) {
	const globalRules = new Map();
	function globalRule(name, sub) {
		globalRules.set(name, sub);
	};

	// Invokes rule while handling any decorators and context.
	function invoke(rule, ctx) {
		if (rule.$debug_before) {
			debugger;
		};
		const prevName = ctx.name;
		if (rule.$name !== undefined) {
			ctx.name = rule.$name;
		};
		const prevIgnoreCase = ctx.ignoreCase;
		if (rule.$ignoreCase !== undefined) {
			ctx.ignoreCase = rule.$ignoreCase;
		};
		const prev = ctx.outer;
		let value = prev;
		if (rule.$init) {
			value = rule.$init(value);
		};
		ctx.outer = value;
		const [ok, match, capture] = rule(ctx);
		if (rule.$debug_after) {
			debugger;
		};
		if (ok) {
			if (rule.$cap) {
				value = rule.$cap(value, capture!==undefined?capture:match);
			} else {
				value = capture;
			};
			if (rule.$global) {
				rule.$global(ctx.global, value);
			};
		} else {
			value = capture;
		};
		ctx.outer = prev;
		ctx.name = prevName;
		ctx.ignoreCase = prevIgnoreCase;
		return [ok, match, value];
	};

	// Decorates rule with methods that add behaviors. Enables the decoration of
	// a rule after it has been created.
	//
	//     rule().decorate()
	function suffixDecorators(rule) {
		rule.skip = () => {
			rule.$cap = () => undefined;
			return rule;
		};
		rule.set = (v) => {
			if (v === undefined) {
				rule.$cap = (a, x) => x;
			} else {
				rule.$cap = () => v;
			};
			return rule;
		};
		rule.append = (v) => {
			if (v === undefined) {
				rule.$cap = (a, x) => {
					if (!(a instanceof Array)) {
						a = [];
					};
					a.push(x);
					return a;
				};
			} else {
				rule.$cap = (a, x) => {
					if (!(a instanceof Array)) {
						a = [];
					};
					a.push(v);
					return a;
				};
			};
			return rule;
		};
		rule.field = (f, v) => {
			if (v === undefined) {
				rule.$cap = (a, x) => {
					if (a === undefined || a === null) {
						a = {};
					};
					a[f] = x;
					return a;
				};
			} else {
				rule.$cap = (a, x) => {
					if (a === undefined || a === null) {
						a = {};
					};
					a[f] = v;
					return a;
				};
			};
			return rule;
		};
		rule.appendField = (f, v) => {
			if (v === undefined) {
				rule.$cap = (a, x) => {
					if (a === undefined || a === null) {
						a = {};
					};
					if (!(a[f] instanceof Array)) {
						a[f] = [];
					}
					a[f].push(x);
					return a;
				};
			} else {
				rule.$cap = (a, x) => {
					if (a === undefined || a === null) {
						a = {};
					};
					if (!(a[f] instanceof Array)) {
						a[f] = [];
					}
					a[f].push(v);
					return a;
				};
			};
			return rule;
		};
		rule.call = (f) => {
			rule.$cap = f;
			return rule;
		};
		rule.global = (f, v) => {
			if (v === undefined) {
				rule.$global = (g, x) => g[f] = x;
			} else {
				rule.$global = (g) => g[f] = v;
			};
			return rule;
		};
		rule.appendGlobal = (f, v) => {
			if (v === undefined) {
				rule.$global = (g, x) => {
					if (!(g[f] instanceof Array)) {
						g[f] = [];
					};
					g[f].push(x);
				};
			} else {
				rule.$global = (g) => {
					if (!(g[f] instanceof Array)) {
						g[f] = [];
					};
					g[f].push(v);
				};
			};
			return rule;
		};
		rule.callGlobal = (f) => {
			rule.$global = f;
			return rule;
		};
		rule.debug = (v) => {
			rule.$debug_after = v === undefined ? true : v;
			return rule;
		};
		return rule;
	};

	// Warning: This code is icky.

	function stackPrev(fn, prev) {
		return (rule) => {fn(rule); prev(rule)};
	};

	// Enables the decoration of a rule before it has been created.
	//
	//     decorate().rule()
	function prefixDecorators(f) {
		return (...a) => {
			let fn = f(...a);
			const self = {
				ref: (...a) => {const r = ref(...a); fn(r); return r },
				lit: (...a) => {const r = lit(...a); fn(r); return r },
				seq: (...a) => {const r = seq(...a); fn(r); return r },
				alt: (...a) => {const r = alt(...a); fn(r); return r },
				opt: (...a) => {const r = opt(...a); fn(r); return r },
				rep: (...a) => {const r = rep(...a); fn(r); return r },
				exc: (...a) => {const r = exc(...a); fn(r); return r },

				init:       (...a) => { fn = stackPrev(init      (...a), fn); return self },
				name:       (...a) => { fn = stackPrev(name      (...a), fn); return self },
				ignoreCase: (...a) => { fn = stackPrev(ignoreCase(...a), fn); return self },
				debug:      (...a) => { fn = stackPrev(debug     (...a), fn); return self },
			};
			return self;
		};
	};

	// Initializes a capture method.
	function init(f) {
		return (rule) => rule.$init = f;
	};
	// Sets readable name for error messages.
	function name(name) {
		return (rule) => rule.$name = name;
	};
	// Causes lit rules to ignore casing.
	function ignoreCase() {
		return (rule) => rule.$ignoreCase = true;
	};
	function debug(v) {
		return (rule) => rule.$debug_before = v === undefined ? true : v;
	};

	// Resolves a reference to a named production.
	function ref(name) {
		return suffixDecorators((ctx) => {
			const rule = globalRules.get(name);
			if (!rule) {
				return [false, `unknown rule: ${name}`];
			};
			return invoke(rule, ctx);
		});
	};
	// Literal. Matches when the given string or RegExp matches exactly.
	function lit(token) {
		if (token instanceof RegExp) {
			return suffixDecorators((ctx) => {
				// Note: Without ^ anchor, match will jump ahead to first
				// occurrence.
				let re = token;
				if (ctx.ignoreCase && !re.ignoreCase) {
					re = new RegExp(re.source, ''.concat(...new Set(re.flags+"i")))
				};
				const match = ctx.source.slice(ctx.i).match(re);
				if (match) {
					ctx.i += match.index + match[0].length;
					return [true, match[1]||match[0]];
				};
				return [false, expected(ctx.source, ctx.i, ctx.name?ctx.name:token)];
			});
		} else {
			return suffixDecorators((ctx) => {
				let a = ctx.source.slice(ctx.i, ctx.i+token.length);
				let b = token;
				if (ctx.ignoreCase) {
					a = a.toLowerCase();
					b = b.toLowerCase();
				};
				if (a == b) {
					ctx.i += token.length;
					return [true, token];
				};
				return [false, expected(ctx.source, ctx.i, ctx.name?ctx.name:token)];
			});
		};
	};
	// Sequence. Matches when all rules match. Selects the last non-undefined
	// capture.
	function seq(...rules) {
		return suffixDecorators((ctx) => {
			let capture;
			const i = ctx.i;
			for (let rule of rules) {
				let [ok, match, cap] = invoke(rule, ctx);
				if (!ok) {
					ctx.i = i
					return [false, match];
				};
				if (cap !== undefined) {
					capture = cap;
				};
			};
			const s = ctx.source.slice(i, ctx.i);
			return [true, s, capture];
		});
	};
	// Returns the given rules as a seq, or one rule as-is.
	function one_or_seq(rule, ...rules) {
		if (rules.length > 0) {
			rule = seq(rule, ...rules);
		};
		return rule;
	};
	// Alteration. Matches when any rules match.
	function alt(...rules) {
		return suffixDecorators((ctx) => {
			let err;
			for (let rule of rules) {
				const i = ctx.i;
				const [ok, match, capture] = invoke(rule, ctx);
				if (ok) {
					return [true, match, capture];
				}
				ctx.i = i;
				if (err === undefined) {
					err = match;
				};
			};
			return [false, err];
		});
	};
	// Optional. Matches 0 or 1 of seq(...rules).
	function opt(...rules) {
		return suffixDecorators((ctx) => {
			const i = ctx.i;
			const [ok, match, capture] = invoke(one_or_seq(...rules), ctx);
			if (ok) {
				return [ok, match, capture];
			} else {
				ctx.i = i;
				return [true, "", undefined];
			};
		});
	};
	// Repetition. Matches any number of seq(...rules).
	function rep(...rules) {
		return suffixDecorators((ctx) => {
			const start = ctx.i;
			let ok, match, capture;
			const rule = one_or_seq(...rules);
			while (true) {
				let i = ctx.i;
				let [ok, match, cap] = invoke(rule, ctx);
				if (!ok) {
					ctx.i = i;
					return [true, ctx.source.slice(start, i), capture];
				};
				capture = cap;
			};
		});
	};
	// Exception. Match everything up to the given rule.
	function exc(rule) {
		return suffixDecorators((ctx) => {
			const i = ctx.i;
			while (true) {
				const beforeMatch = ctx.i;
				const [ok, match, capture] = invoke(rule, ctx);
				if (ok) {
					ctx.i = beforeMatch;
					if (ctx.i == i) {
						return [false];
					} else {
						const s = ctx.source.slice(i, ctx.i);
						return [true, s, capture];
					};
				};
				ctx.i = beforeMatch;
				if (ctx.i >= ctx.source.length) {
					const [line, column] = position(ctx.source, i);
					return [false, `${line}:${column}: unexpected end of query`];
				};
				ctx.i += 1;
			};
		});
	};

	grammar({
		rule: globalRule,
		ref: ref,
		lit: lit,
		seq: seq,
		alt: alt,
		opt: opt,
		rep: rep,
		exc: exc,
		init: prefixDecorators(init),
		name: prefixDecorators(name),
		ignoreCase: prefixDecorators(ignoreCase),
		debug: prefixDecorators(debug),
	});

	return function(source, name) {
		name = typeof name === "string" ? name : "main";
		const rule = globalRules.get(name);
		if (!rule) {
			throw `unknown rule: ${name}`;
		};

		const ctx = {
			source: source,
			i: 0,
			global: globalValue ? globalValue() : {},
		};

		let err, cap;
		try {
			const [ok, match, capture] = invoke(rule, ctx);
			if (ok) {
				if (ctx.i < source.length) {
					const char = ctx.source[ctx.i];
					let delim = '"';
					if (char === delim) {
						delim = "'";
					};
					err = `unexpected character ${delim}${char}${delim}`;
				} else {
					cap = capture;
				};
			};
		} catch (error) {
			err = error;
		};
		if (err) {
			return new Error(err, ctx);
		};
		return {capture: cap, global: ctx.global};
	};
};

export class Error {
	constructor(err, ctx) {
		this.error = err;
		if (ctx) {
			this.global = ctx.global;
			if (ctx.i) {
				const [line, column] = position(ctx.source, ctx.i);
				this.line = line;
				this.column = column;
				this.offset = ctx.i;
			};
		};
	};
	toString() {
		if (this.line && this.column) {
			return `${this.line}:${this.column}: ${this.error}`;
		};
		return this.error;
	};
};
