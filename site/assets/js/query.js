import * as grammar from "./grammar.js"

const SPACE         = /^\s*/;
const WORD          = /^\w+/;
const COMMENT_OPEN  = "#{";
const COMMENT_CLOSE = "}#";
const GROUP_OPEN    = "(";
const GROUP_CLOSE   = ")";
const OR_OP         = "||";
const OR_OP_ALT     = ",";
const AND_OP        = "&&";
const AND_OP_ALT    = /^\s+/;
const NOT_OP        = "!";
const META          = "$";
const PREFIX        = ":";
const LT            = "<";
const LE            = "<=";
const GT            = ">";
const GE            = ">=";
const COMPOUND      = ".";
const SUB_STRING    = "'";
const EXACT_STRING  = '"';
const ESCAPE        = "\\";
const REGEXP        = "/";
const REGEXP_FLAGS  = /^[imsuv]/;
const ALL           = "*";
const ANY           = /^./;;
const POS           = "+";
const NEG           = "-";
const DECIMAL       = ".";
const INF           = "inf";
const NAN           = "nan";
const DIGITS        = /^\d+/;

export const all = Symbol("all");

function queryGrammar({ref, lit, seq, alt, opt, rep, exc, init, name, ignoreCase, debug}) {
	// Generates a prefix term.
	function prefix(name, value) {
		return seq(lit(name), lit(PREFIX), value);
	}

	return [
		// Entrypoint.
		["main", seq(ref("space"), ref("expr"), ref("space"))],

		// Spacing. Allows block comments.
		["space", seq(
			name("space").lit(SPACE),
			opt(ref("comment"), ref("space")),
		)],
		["comment", seq(
			lit(COMMENT_OPEN),
			rep(exc(lit(COMMENT_CLOSE))),
			lit(COMMENT_CLOSE),
		)],

		// Binary operators.
		["or_op", seq(ref("space"), alt(lit(OR_OP_ALT), lit(OR_OP)), ref("space"))],
		["and_op", seq(alt(name("space").lit(AND_OP_ALT), lit(AND_OP)), ref("space"))],
		["not_op", seq(ref("space"), lit(NOT_OP), ref("space"))],

		// Expression is divided in order to implement operator precedence. The
		// top expression allows || and &&, while the inner expression only
		// allows &&.
		["expr",
			init(()=>({expr: "", operands: []})).seq(
				ref("term").appendField("operands"),
				opt(alt(
					seq(
						ref("or_op").field("expr", "or"),
						ref("expr_and").appendField("operands"),
						rep(ref("or_op"), ref("expr_and").appendField("operands")),
					),
					seq(
						ref("and_op").field("expr", "and"),
						ref("expr_and").appendField("operands"),
						rep(ref("and_op"), ref("expr_and").appendField("operands")),
					),
				)),
			).call((a) => a.operands.length > 1 ? a : a.operands[0]),
		],
		["expr_and",
			init(()=>({expr: "", operands: []})).seq(
				ref("term").appendField("operands"),
				opt(alt(
					seq(
						ref("and_op").field("expr", "and"),
						ref("term").appendField("operands"),
						rep(ref("and_op"), ref("term").appendField("operands")),
					),
				)),
			).call((a) => a.operands.length > 1 ? a : a.operands[0]),
		],
		["expr_not",
			init(()=>({expr: "not", operand: undefined})).seq(
				ref("not_op"),
				ref("term").field("operand"),
			),
		],
		["group", seq(
			lit(GROUP_OPEN),
			ref("space"),
			ref("expr"),
			ref("space"),
			lit(GROUP_CLOSE),
		)],
		["term", alt(
			ref("expr_not"),
			ref("meta"),
			ref("prefixes"),
			ref("results"),
			ref("compound"),
			ref("name"),
			ref("group"),
		)],

		// Terms that produce metadata.
		["meta", init(()=>({expr:"meta",type:undefined})).seq(lit(META), alt(
			lit(`type`),
			lit(`tag`),
			lit(`security`),
			lit(`threadsafety`),
			lit(`typecat`),
		).field("type"))],

		// Terms denoted by a prefix.
		["prefixes", alt(
			prefix(`is`, ref("word")),
			prefix(`tag`, opt(ref("word"))),
			prefix(`has`, opt(ref("word"))),
			prefix(`removed`, opt(ref("bool"))),
			prefix(`superclasses`, opt(ref("number_expr"))),
			prefix(`subclasses`, opt(ref("number_expr"))),
			prefix(`members`, opt(ref("number_expr"))),
			prefix(`superclass`, opt(ref("name"))),
			prefix(`subclass`, opt(ref("name"))),
			prefix(`memcat`, opt(ref("name"))),
			prefix(`memecat`, opt(ref("name"))),
			prefix(`threadsafety`, opt(ref("word"))),
			prefix(`security`, opt(ref("word"))),
			prefix(`cansave`, opt(ref("bool"))),
			prefix(`canload`, opt(ref("bool"))),
			prefix(`readsecurity`, opt(ref("word"))),
			prefix(`writesecurity`, opt(ref("word"))),
			prefix(`valuetypename`, opt(ref("name"))),
			prefix(`category`, opt(ref("name"))),
			prefix(`default`, opt(alt(ref("number_expr"), ref("name")))),
			prefix(`returns`, opt(ref("number_expr"))),
			prefix(`parameters`, opt(ref("number_expr"))),
			prefix(`returntypecat`, opt(ref("word"))),
			prefix(`returntypename`, opt(ref("name"))),
			prefix(`returntypeopt`, opt(ref("bool"))),
			prefix(`paramtypecat`, opt(ref("word"))),
			prefix(`paramtypename`, opt(ref("name"))),
			prefix(`paramtypeopt`, opt(ref("bool"))),
			prefix(`paramname`, opt(ref("name"))),
			prefix(`paramdefault`, opt(alt(ref("number_expr"), ref("name")))),
			prefix(`enumitems`, opt(ref("number_expr"))),
			prefix(`itemvalue`, opt(ref("number_expr"))),
			prefix(`legacynames`, opt(ref("number_expr"))),
			prefix(`legacyname`, opt(ref("name"))),
			prefix(`typecat`, opt(ref("word"))),
		)],

		// Prefixes related to search results.
		["results", alt(
			prefix(`limit`, ref("number")),
			prefix(`order`, opt(alt(lit(LT), lit(GT))), ref("word")),
			prefix(`go`, ref("word")),
		)],

		// Term for dot-separated names.
		["compound", init(()=>({type:"compound"})).alt(
			seq(ref("name").field("primary"), lit(COMPOUND), ref("name").field("secondary")),
			seq(ref("name").field("primary"), lit(COMPOUND)),
			seq(lit(COMPOUND), ref("name").field("secondary")),
		)],

		// Terms related to names.
		["name", alt(ref("all"), ref("word"), ref("string"), ref("regexp"))],
		["all", lit(ALL).set(all)],
		["word", name("word").lit(WORD)],
		["string", alt(ref("string_sq"), ref("string_dq"))],
		["string_sq",
			seq(
				lit(SUB_STRING),
				rep(alt(seq(lit(ESCAPE), ref("any")), exc(lit(SUB_STRING)))),
				lit(SUB_STRING),
			).call((a, x) => JSON.parse('"'+x.slice(1, -1)+'"')),
		],
		["string_dq",
			seq(
				lit(EXACT_STRING),
				rep(alt(seq(lit(ESCAPE), ref("any")), exc(lit(EXACT_STRING)))),
				lit(EXACT_STRING),
			).call((a, x) => JSON.parse(x)),
		],
		["regexp",
			seq(
				lit(REGEXP),
				rep(alt(seq(lit(ESCAPE), ref("any")), exc(lit(REGEXP)))),
				lit(REGEXP),
				opt(name("flags").lit(REGEXP_FLAGS)),
			).call((a, x) => {
				const i = x.lastIndexOf("/");
				const pattern = x.slice(1, i);
				const flags = x.slice(i+1);
				return new RegExp(pattern, flags);
			}),
		],
		["any", name("any").lit(ANY)],

		// Literals that translate to a boolean.
		["bool", alt(
			alt(
				lit(`0`),
				lit(`no`),
				lit(`false`),
				lit(`n`),
				lit(`f`),
			).set(false),
			alt(
				lit(`1`),
				lit(`yes`),
				lit(`true`),
				lit(`y`),
				lit(`t`),
			).set(true),
		)],

		// Terms for numbers.
		["number_expr", seq(opt(ref("number_op")), ref("number"))],
		["number_op", alt(lit(LE), lit(LT), lit(GE), lit(GT))],
		["number", alt(
			// Number.
			init(() => ({sign:POS,value:undefined})).seq(
				// Optional sign.
				opt(alt(lit(NEG), lit(POS))).field("sign"),
				alt(
					// Infinity.
					ignoreCase().lit(INF).set(Infinity),
					// Rational number.
					alt(
						// Full number.
						seq(
							// Integer part.
							ref("digits"),
							// Fractional part.
							opt(lit(DECIMAL), ref("digits")),
						),
						// Fractional part only.
						seq(lit(DECIMAL), ref("digits")),
					).call((a, x) => Number(x)),
				).field("value"),
			).call((a, x) => x.sign === NEG ? -x.value : x.value),
			// Not a number.
			ignoreCase().lit(NAN).set(NaN),
		)],
		["digits", lit(DIGITS)],
	];
};

export const parse = grammar.make(queryGrammar);
