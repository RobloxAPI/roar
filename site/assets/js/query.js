// Constant literals.
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

export function forDatabase(DB, F, M) {
return ({ref, lit, seq, alt, opt, rep, exc, init, name, ignoreCase, debug}) => {
	// Generates a prefix term.
	function prefix(name, value, fn) {
		return seq(lit(name), lit(PREFIX), value).call(fn);
	}
	// Generates a lit that matches w and only w. Case-insensitive.
	function word(w) {
		return name(w).lit(new RegExp(`^${w}\\b`, "i"));
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
		["meta", seq(lit(META), ref("word").set()).call((a,x)=>{
			switch (x.toLowerCase()) {
			case "type":
			case "tag":
			case "security":
			case "threadsafety":
			case "typecat":
				break;
			default:
				throw `unknown term '$${x}'`;
			};
			return {expr: "meta", type: x.toLowerCase()};
		})],

		// Terms denoted by a prefix.
		["prefixes", alt(
			prefix(`is`, ref("word").set(), (a,x)=>{
				switch (x.toLowerCase()) {
				case "class":
					return {expr:"any",types:DB.T.CLASS};
				case "property":
					return {expr:"any",types:DB.T.PROPERTY};
				case "function":
					return {expr:"any",types:DB.T.FUNCTION};
				case "event":
					return {expr:"any",types:DB.T.EVENT};
				case "callback":
					return {expr:"any",types:DB.T.CALLBACK};
				case "enum":
					return {expr:"any",types:DB.T.ENUM};
				case "enumitem":
					return {expr:"any",types:DB.T.ENUMITEM};
				case "type":
					return {expr:"any",types:DB.T.TYPE};
				};
				throw `unknown term 'is:${x}'`;
			}),
			prefix(`tag`, opt(ref("word")), (a,x)=>{
				throw `'tag:' term not implemented`;
			}),
			prefix(`has`, ref("word").set(), (a,x)=>{
				return {expr: "op",
					types: DB.T.ALL,
					field: F[x], //TODO: map to friendly name
					method: M.TRUE, args: [],
				};
			}),
			prefix(`removed`, opt(ref("bool").set()), (a,x)=>{
				let v = {expr: "op",
					types: DB.T.ALL,
					field: F.FLAGS,
					method: M.REMOVED, args: [],
				};
				if (!x) {
					v = {expr: "not", operand: v};
				};
				return v;
			}),
			prefix(`superclasses`, opt(ref("number_expr")).set(), (a,x)=>{
				if (x === "") { // "" from non-matching opt
					throw `expected number`;
				};
				return {expr:"op",
					types: DB.T.CLASS,
					field: F.SUPERCLASSES,
					method: x.method, args: [x.args[0]],
				};
			}),
			prefix(`subclasses`, opt(ref("number_expr")), (a,x)=>{
				if (x === "") { // "" from non-matching opt
					throw `expected number`;
				};
				return {expr:"op",
					types: DB.T.CLASS,
					field: F.SUBCLASSES,
					method: x.method, args: [x.args[0]],
				};
			}),
			prefix(`members`, opt(ref("number_expr")), (a,x)=>{}),
			prefix(`superclass`, opt(ref("name")), (a,x)=>{}),
			prefix(`subclass`, opt(ref("name")), (a,x)=>{}),
			prefix(`memcat`, opt(ref("name")), (a,x)=>{}),
			prefix(`memecat`, opt(ref("name")), (a,x)=>{}),
			prefix(`threadsafety`, opt(ref("word")), (a,x)=>{}),
			prefix(`security`, opt(ref("word")), (a,x)=>{}),
			prefix(`cansave`, opt(ref("bool")), (a,x)=>{}),
			prefix(`canload`, opt(ref("bool")), (a,x)=>{}),
			prefix(`readsecurity`, opt(ref("word")), (a,x)=>{}),
			prefix(`writesecurity`, opt(ref("word")), (a,x)=>{}),
			prefix(`valuetypename`, opt(ref("name")), (a,x)=>{}),
			prefix(`category`, opt(ref("name")), (a,x)=>{}),
			prefix(`default`, opt(alt(ref("number_expr"), ref("name"))), (a,x)=>{}),
			prefix(`returns`, opt(ref("number_expr")), (a,x)=>{}),
			prefix(`parameters`, opt(ref("number_expr")), (a,x)=>{}),
			prefix(`returntypecat`, opt(ref("word")), (a,x)=>{}),
			prefix(`returntypename`, opt(ref("name")), (a,x)=>{}),
			prefix(`returntypeopt`, opt(ref("bool")), (a,x)=>{}),
			prefix(`paramtypecat`, opt(ref("word")), (a,x)=>{}),
			prefix(`paramtypename`, opt(ref("name")), (a,x)=>{}),
			prefix(`paramtypeopt`, opt(ref("bool")), (a,x)=>{}),
			prefix(`paramname`, opt(ref("name")), (a,x)=>{}),
			prefix(`paramdefault`, opt(alt(ref("number_expr"), ref("name"))), (a,x)=>{}),
			prefix(`enumitems`, opt(ref("number_expr")), (a,x)=>{}),
			prefix(`itemvalue`, opt(ref("number_expr")), (a,x)=>{}),
			prefix(`legacynames`, opt(ref("number_expr")), (a,x)=>{}),
			prefix(`legacyname`, opt(ref("name")), (a,x)=>{}),
			prefix(`typecat`, opt(ref("word")), (a,x)=>{}),
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

		// Words that translate to a boolean.
		["bool", alt(
			alt(
				word(`0`),
				word(`no`),
				word(`false`),
				word(`n`),
				word(`f`),
			).set(false),
			alt(
				word(`1`),
				word(`yes`),
				word(`true`),
				word(`y`),
				word(`t`),
			).set(true),
		)],

		// Terms for numbers.
		["number_expr", init(()=>({method:M.EQ,args:[]})).seq(
			opt(ref("number_op").field("method")),
			ref("number").appendField("args"),
		)],
		["number_op", alt(
			lit(LE).set(M.LE),
			lit(LT).set(M.LT),
			lit(GE).set(M.GE),
			lit(GT).set(M.GT),
		)],
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
};
