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
	// Generates a lit that matches w and only w. Case-insensitive.
	function word(w) {
		return name(w).lit(new RegExp(`^${w}\\b`, "i"));
	}
	// Generates a prefix term.
	function prefix(name, value) {
		return seq(word(name), lit(PREFIX), value);
	}

	// .call: Append x only if it is valid.
	function appendOperand(a, x) {
		if (x) {
			a.operands.push(x);
		};
		return a;
	};
	// .call: Set field to x only if it is valid.
	function operand(a, x) {
		if (x) {
			a.operand = x;
		};
		return a;
	};
	// .call: Prevent capture from being appended.
	function skip() {
		return null;
	};

	// .call: Collapse single-operand binary expression.
	function collapse(a) {
		switch (a.operands.length) {
		case 0:
			// Return null instead of undefined so that capture is not replaced
			// by match.
			return null;
		case 1:
			return a.operands[0];
		};
		return a;
	};

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
				ref("term").call(appendOperand),
				opt(alt(
					seq(
						ref("or_op").field("expr", "or"),
						ref("expr_and").call(appendOperand),
						rep(ref("or_op"), ref("expr_and").call(appendOperand)),
					),
					seq(
						ref("and_op").field("expr", "and"),
						ref("expr_and").call(appendOperand),
						rep(ref("and_op"), ref("expr_and").call(appendOperand)),
					),
				)),
			).call(collapse),
		],
		["expr_and",
			init(()=>({expr: "", operands: []})).seq(
				ref("term").call(appendOperand),
				opt(alt(
					seq(
						ref("and_op").field("expr", "and"),
						ref("term").call(appendOperand),
						rep(ref("and_op"), ref("term").call(appendOperand)),
					),
				)),
			).call(collapse),
		],
		["expr_not",
			init(()=>({expr: "not", operand: null})).seq(
				ref("not_op"),
				ref("term").call(operand),
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
			prefix(`is`, ref("word").set()).call((a,x)=>{
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
			prefix(`tag`, opt(ref("word")).set()).call((a,x)=>{
				return {expr: "flag",
					types: DB.T.ALL,
					field: F.FLAGS,
					flag: x.toLowerCase(),
				};
			}),
			prefix(`has`, ref("word").set()).call((a,x)=>{
				return {expr: "op",
					types: DB.T.ALL,
					field: F[x], //TODO: map to friendly name
					method: M.TRUE, args: [],
				};
			}),
			prefix(`removed`, opt(ref("bool").set())).call((a,x)=>{
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
			prefix(`superclasses`, opt(ref("number_expr")).set()).call((a,x)=>{
				if (x === "") { throw `expected number` };
				return {expr:"op",
					types: DB.T.CLASS,
					field: F.SUPERCLASSES,
					...x,
				};
			}),
			prefix(`subclasses`, opt(ref("number_expr")).set()).call((a,x)=>{
				if (x === "") { throw `expected number` };
				return {expr:"op",
					types: DB.T.CLASS,
					field: F.SUBCLASSES,
					...x,
				};
			}),
			prefix(`members`, opt(ref("number_expr")).set()).call((a,x)=>{
				if (x === "") { throw `expected number` };
				return {expr:"op",
					types: DB.T.CLASS,
					field: F.MEMBERS,
					...x,
				};
			}),
			prefix(`superclass`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: DB.T.CLASS,
					field: F.SUPERCLASS,
					...x,
				};
			}),
			prefix(`subclass`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: DB.T.CLASS,
					field: F.SUBCLASS,
					...x,
				};
			}),
			prefix(`memcat`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: DB.T.CLASS,
					field: F.MEM_CAT,
					...x,
				};
			}),
			prefix(`memecat`, opt(ref("string_expr")).set()).call((a,x)=>{
				let s = `˖⁺‧₊˚˖⁺‧₊˚˖⁺‧₊˚˖⁺‧₊˚ᓚ₍ ˆ•⩊•ˆ₎`+(x?` ⦟⟮ ${x.args[0]} ⟯`:``);
				return {expr:"op",
					types: DB.T.CLASS,
					field: [(t,d,v)=>v, s],
					method: M.TRUE, args:[Infinity],
				};
			}),
			prefix(`threadsafety`, opt(ref("word")).set()).call((a,x)=>{
				return {expr:"op",
					types: DB.T.MEMBERS,
					field: F.THREAD_SAFETY,
					method: M.FUZZY, args:[x],
				};
			}),
			prefix(`security`, opt(ref("word")).set()).call((a,x)=>{
				return {expr:"or", operands:[
					{expr:"op",
						types: DB.T.MEMBERS,
						field: F.SECURITY,
						method: M.FUZZY, args:["foo"],
					},
					{expr:"op",
						types: [DB.T.PROPERTY],
						field: F.WRITE_SECURITY,
						method: M.FUZZY, args:["foo"],
					},
				]};
			}),
			prefix(`cansave`, opt(ref("bool")).set()).call((a,x)=>{
				return {expr:"op",
					types: DB.T.MEMBERS,
					field: F.CAN_SAVE,
					method: M.EQ, args:[!!x],
				};
			}),
			prefix(`canload`, opt(ref("bool")).set()).call((a,x)=>{
				return {expr:"op",
					types: DB.T.MEMBERS,
					field: F.CAN_LOAD,
					method: M.EQ, args:[!!x],
				};
			}),
			prefix(`readsecurity`, opt(ref("word")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.PROPERTY],
					field: F.READ_SECURITY,
					method: M.FUZZY, args:["foo"],
				};
			}),
			prefix(`writesecurity`, opt(ref("word")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.PROPERTY],
					field: F.WRITE_SECURITY,
					method: M.FUZZY, args:["foo"],
				};
			}),
			prefix(`valuetypecat`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.PROPERTY],
					field: F.VALUE_TYPE_CAT,
					...x,
				};
			}),
			prefix(`valuetypename`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.PROPERTY],
					field: F.VALUE_TYPE_NAME,
					...x,
				};
			}),
			prefix(`category`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.PROPERTY],
					field: F.CATEGORY,
					...x,
				};
			}),
			prefix(`default`, opt(alt(ref("number_expr"), ref("string_expr")))).call((a,x)=>{
			}),
			prefix(`returns`, opt(ref("number_expr")).set()).call((a,x)=>{
				if (x === "") { throw `expected number` };
				return {expr:"op",
					types: [DB.T.FUNCTION, DB.T.CALLBACK],
					field: F.RETURNS,
					...x,
				};
			}),
			prefix(`parameters`, opt(ref("number_expr")).set()).call((a,x)=>{
				if (x === "") { throw `expected number` };
				return {expr:"op",
					types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
					field: F.PARAMETERS,
					...x,
				};
			}),
			prefix(`returntypecat`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.FUNCTION, DB.T.CALLBACK],
					field: F.RETURN_TYPE_CAT,
					...x,
				};
			}),
			prefix(`returntypename`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.FUNCTION, DB.T.CALLBACK],
					field: F.RETURN_TYPE_NAME,
					...x,
				};
			}),
			prefix(`returntypeopt`, opt(ref("bool")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
					field: F.RETURN_TYPE_OPT,
					method: M.EQ, args:[!!x],
				};
			}),
			prefix(`paramtypecat`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
					field: F.PARAM_TYPE_CAT,
					...x,
				};
			}),
			prefix(`paramtypename`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
					field: F.PARAM_TYPE_NAME,
					...x,
				};
			}),
			prefix(`paramtypeopt`, opt(ref("bool")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
					field: F.PARAM_TYPE_OPT,
					method: M.EQ, args:[!!x],
				};
			}),
			prefix(`paramname`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
					field: F.PARAM_NAME,
					...x,
				};
			}),
			prefix(`paramdefault`, opt(alt(ref("number_expr"), ref("string_expr")))).call((a,x)=>{
			}),
			prefix(`enumitems`, opt(ref("number_expr")).set()).call((a,x)=>{
				if (x === "") { throw `expected number` };
				return {expr:"op",
					types: [DB.T.ENUM],
					field: F.ENUM_ITEMS,
					...x,
				};
			}),
			prefix(`itemvalue`, opt(ref("number_expr")).set()).call((a,x)=>{
				if (x === "") { throw `expected number` };
				return {expr:"op",
					types: [DB.T.ENUM_ITEM],
					field: F.ITEM_VALUE,
					...x,
				};
			}),
			prefix(`legacynames`, opt(ref("number_expr")).set()).call((a,x)=>{
				if (x === "") { throw `expected number` };
				return {expr:"op",
					types: [DB.T.ENUM_ITEM],
					field: F.LEGACY_NAMES,
					...x,
				};
			}),
			prefix(`legacyname`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.ENUM_ITEM],
					field: F.LEGACY_NAME,
					...x,
				};
			}),
			prefix(`typecat`, opt(ref("string_expr")).set()).call((a,x)=>{
				return {expr:"op",
					types: [DB.T.TYPE],
					field: F.TYPE_CAT,
					...x,
				};
			}),
		)],

		// Prefixes related to search results.
		["results", init(()=>({})).alt(
			prefix(`limit`, ref("number").global("limit")),
			prefix(`order`, seq(
				opt(alt(lit(LT), lit(GT))).field("direction"),
				ref("word").field("column"),
			)).global("order"),
			prefix(`go`, ref("word").set()).global("go"),
		).call(()=>null)],

		// Term for dot-separated names.
		["compound", init(()=>[]).alt(
			seq(
				ref("string_expr").call((a,x) => {
					a.push({expr:"op",
						types: DB.T.ALL,
						field: F.PRIMARY,
						...x,
					});
				}),
				lit(COMPOUND),
				ref("string_expr").call((a,x) => {
					a.push({expr:"op",
						types: DB.T.ALL,
						field: F.SECONDARY,
						...x,
					});
				}),
			),
			seq(
				ref("string_expr").call((a,x) => {
					a.push({expr:"op",
						types: DB.T.ALL,
						field: F.PRIMARY,
						...x,
					});
				}),
				lit(COMPOUND),
			),
			seq(
				lit(COMPOUND),
				ref("string_expr").call((a,x) => {
					a.push({expr:"op",
						types: DB.T.ALL,
						field: F.SECONDARY,
						...x,
					});
				}),
			),
		).call((a,x) => (x.length==1 ? x[0] : {expr: "or", operands: x}))],

		// Term matching primary or secondary name.
		["name", ref("string_expr").call((a,x) => {
			return {expr:"or", operands:[
				{expr:"op",
					types: DB.T.PRIMARY,
					field: F.PRIMARY,
					...x,
				},
				{expr:"op",
					types: DB.T.SECONDARY,
					field: F.SECONDARY,
					...x,
				},
			]};
		})],

		// Terms for matching stringlike values.
		["string_expr", alt(
			ref("all"),
			ref("word").call((a,x) => ({method: M.FUZZY, args:[x]})),
			ref("string"),
			ref("regexp"),
		)],
		["all", lit(ALL).call((a,x) => ({method: M.TRUE, args:[]}))],
		["word", name("word").lit(WORD)],
		["string", alt(ref("string_sq"), ref("string_dq"))],
		["string_sq",
			seq(
				lit(SUB_STRING),
				rep(alt(seq(lit(ESCAPE), ref("any")), exc(lit(SUB_STRING)))),
				lit(SUB_STRING),
			).call((a, x) => ({method: M.SUB, args:[JSON.parse('"'+x.slice(1, -1)+'"')]})),
		],
		["string_dq",
			seq(
				lit(EXACT_STRING),
				rep(alt(seq(lit(ESCAPE), ref("any")), exc(lit(EXACT_STRING)))),
				lit(EXACT_STRING),
			).call((a, x) => ({method: M.EQ, args:[JSON.parse(x)]})),
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
				return {method: M.REGEXP, args:[new RegExp(pattern, flags)]};
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
			//TODO:range: `lower-upper`
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