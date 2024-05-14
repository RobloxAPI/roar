import * as grammar from "./grammar.js"

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
const REGEXP_FLAGS  = /^[imsuv]*/;
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
const globalValue = () => ({results: [], list: []});
const rules = ({rule, ref, lit, seq, alt, opt, rep, exc, init, name, ignoreCase, debug}) => {
	// Generates a lit that matches w and only w. Case-insensitive.
	function word(w) {
		return name(w).lit(new RegExp(`^${w}\\b`, "i"));
	}
	// Generates a prefix selector.
	function prefix(name, value) {
		return seq(word(name), lit(PREFIX), value);
	}
	// lit that matches anything except char.
	function except(char) {
		return name(char).lit(new RegExp(`^[^${char}]`));
	};

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

	// Entrypoint.
	rule("main", seq(ref("space"), ref("expr"), ref("space")))

	// Spacing. Allows block comments.
	rule("space", seq(
		name("space").lit(SPACE),
		opt(ref("comment"), ref("space")),
	))
	rule("comment", seq(
		lit(COMMENT_OPEN),
		rep(exc(lit(COMMENT_CLOSE))),
		lit(COMMENT_CLOSE),
	))

	// Logical operators.
	rule("or_op", seq(
		ref("space"),
		alt(
			lit(OR_OP),
			lit(OR_OP_ALT),
		),
		ref("space"),
	))
	rule("and_op", seq(
		alt(
			seq(ref("space"), lit(AND_OP)),
			name("space").lit(AND_OP_ALT),
		),
		ref("space"),
	))
	rule("not_op", seq(
		ref("space"),
		lit(NOT_OP),
		ref("space"),
	))

	// Logical expression implementing operator precedence.
	rule("expr",
		init(()=>({expr: "or", operands: []})).seq(
			ref("expr1").call(appendOperand),
			rep(
				ref("or_op"),
				ref("expr1").call(appendOperand),
			),
		).call(collapse),
	)
	rule("expr1",
		init(()=>({expr: "and", operands: []})).seq(
			ref("expr2").call(appendOperand),
			rep(
				ref("and_op"),
				ref("expr2").call(appendOperand),
			),
		).call(collapse),
	)
	rule("expr2",
		alt(
			ref("selector"),
			init(()=>({expr: "not", operand: null})).seq(
				ref("not_op"),
				ref("expr2").call(operand),
			),
			ref("group"),
		),
	)
	rule("group", seq(
		lit(GROUP_OPEN),
		ref("space"),
		ref("expr"),
		ref("space"),
		lit(GROUP_CLOSE),
	))

	// All types of selector.
	rule("selector", alt(
		ref("prefixes"),
		ref("results"),
		ref("compound"),
		ref("name"),
	))

	// Selectors denoted by a prefix.
	rule("prefixes", alt(
		prefix(`is`, ref("word").set()).call((a,x)=>{
			switch (x.toLowerCase()) {
			case "class":
				return {expr:"any",types:[DB.T.CLASS]};
			case "property":
				return {expr:"any",types:[DB.T.PROPERTY]};
			case "function":
				return {expr:"any",types:[DB.T.FUNCTION]};
			case "event":
				return {expr:"any",types:[DB.T.EVENT]};
			case "callback":
				return {expr:"any",types:[DB.T.CALLBACK]};
			case "enum":
				return {expr:"any",types:[DB.T.ENUM]};
			case "enumitem":
				return {expr:"any",types:[DB.T.ENUMITEM]};
			case "type":
				return {expr:"any",types:[DB.T.TYPE]};
			case "primary":
				return {expr:"any",types:DB.T.PRIMARY};
			case "secondary":
				return {expr:"any",types:DB.T.SECONDARY};
			case "member":
				return {expr:"any",types:DB.T.MEMBERS};
			};
			throw `unknown selector 'is:${x}'`;
		}),
		prefix(`list`, opt(ref("word")).set().callGlobal((g,x)=>{
			if (x === "") {
				g.list.push({field: null});
				return;
			};
			const expr = DB.F.get(x.toLowerCase());
			if (expr) {
				g.list.push(expr);
			};
		})).call(()=>null),
		prefix(`tag`, opt(ref("word")).set()).call((a,x)=>{
			return {expr: "flag",
				types: DB.T.ALL,
				field: F.FLAGS,
				flag: x.toLowerCase(),
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
		prefix(`superclasses`, ref("opt_number_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.SUPERCLASSES,
				...x,
			};
		}),
		prefix(`subclasses`, ref("opt_number_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.SUBCLASSES,
				...x,
			};
		}),
		prefix(`members`, ref("opt_number_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.MEMBERS,
				...x,
			};
		}),
		prefix(`superclass`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.SUPERCLASS,
				...x,
			};
		}),
		prefix(`subclass`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.SUBCLASS,
				...x,
			};
		}),
		prefix(`memcat`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.MEM_CAT,
				...x,
			};
		}),
		prefix(`memecat`, ref("opt_string_expr").set().callGlobal((g,x)=>{
			g.results.push(`˖⁺‧₊˚˖⁺‧₊˚˖⁺‧₊˚˖⁺‧₊˚ᓚ₍ ˆ•⩊•ˆ₎`+((x&&x.args[0])?` ⦟⟮ ${x.args[0]} ⟯`:``));
		})).call(()=>null),
		prefix(`threadsafety`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: DB.T.MEMBERS,
				field: F.THREAD_SAFETY,
				...x,
			};
		}),
		prefix(`security`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"or", operands:[
				{expr:"op",
					types: DB.T.MEMBERS,
					field: F.SECURITY,
					...x,
				},
				{expr:"op",
					types: [DB.T.PROPERTY],
					field: F.WRITE_SECURITY,
					...x,
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
		prefix(`readsecurity`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.READ_SECURITY,
				...x,
			};
		}),
		prefix(`writesecurity`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.WRITE_SECURITY,
				...x,
			};
		}),
		prefix(`valuetypecat`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.VALUE_TYPE_CAT,
				...x,
			};
		}),
		prefix(`valuetypename`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.VALUE_TYPE_NAME,
				...x,
			};
		}),
		prefix(`category`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.CATEGORY,
				...x,
			};
		}),
		prefix(`default`, opt(ref("default"))).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.DEFAULT,
				...x,
			};
		}),
		prefix(`returns`, ref("opt_number_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.CALLBACK],
				field: F.RETURNS,
				...x,
			};
		}),
		prefix(`parameters`, ref("opt_number_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
				field: F.PARAMETERS,
				...x,
			};
		}),
		prefix(`returntypecat`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.CALLBACK],
				field: F.RETURN_TYPE_CAT,
				...x,
			};
		}),
		prefix(`returntypename`, ref("opt_string_expr").set()).call((a,x)=>{
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
		prefix(`paramtypecat`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
				field: F.PARAM_TYPE_CAT,
				...x,
			};
		}),
		prefix(`paramtypename`, ref("opt_string_expr").set()).call((a,x)=>{
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
		prefix(`paramname`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
				field: F.PARAM_NAME,
				...x,
			};
		}),
		prefix(`paramdefault`, opt(ref("default"))).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.CALLBACK],
				field: F.PARAM_DEFAULT,
				...x,
			};
		}),
		prefix(`enumitems`, ref("opt_number_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.ENUM],
				field: F.ENUM_ITEMS,
				...x,
			};
		}),
		prefix(`itemvalue`, ref("opt_number_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.ENUMITEM],
				field: F.ITEM_VALUE,
				...x,
			};
		}),
		prefix(`legacynames`, ref("opt_number_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.ENUMITEM],
				field: F.LEGACY_NAMES,
				...x,
			};
		}),
		prefix(`legacyname`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.ENUMITEM],
				field: F.LEGACY_NAME,
				...x,
			};
		}),
		prefix(`typecat`, ref("opt_string_expr").set()).call((a,x)=>{
			return {expr:"op",
				types: [DB.T.TYPE],
				field: F.TYPE_CAT,
				...x,
			};
		}),
	).newline())

	// Prefixes related to search results.
	rule("results", alt(
		prefix(`limit`, ref("number").global("limit")),
		prefix(`sort`, seq(
			opt(alt(lit(LT), lit(GT))).field("direction"),
			ref("word").field("column"),
		)).global("sort"),
		prefix(`go`, ref("word").set()).global("go"),
	).call(()=>null))

	// Selector for dot-separated names.
	rule("compound", alt(
		init(()=>[]).seq(
			ref("string_expr").call((a,x) => {
				a.push({expr:"op",
					types: DB.T.ALL,
					field: F.PRIMARY,
					...x,
				});
				return a;
			}),
			lit(COMPOUND),
			ref("string_expr").call((a,x) => {
				a.push({expr:"op",
					types: DB.T.ALL,
					field: F.SECONDARY,
					...x,
				});
				return a;
			}),
		).set(),
		init(()=>[]).seq(
			ref("string_expr").call((a,x) => {
				a.push({expr:"op",
					types: DB.T.ALL,
					field: F.PRIMARY,
					...x,
				});
				return a;
			}),
			lit(COMPOUND),
		).set(),
		init(()=>[]).seq(
			lit(COMPOUND),
			ref("string_expr").call((a,x) => {
				a.push({expr:"op",
					types: DB.T.ALL,
					field: F.SECONDARY,
					...x,
				});
				return a;
			}),
		).set(),
	).call((a,x) => (x.length==1 ? x[0] : {expr: "and", operands: x})))

	// Selector matching primary or secondary name.
	rule("name", ref("string_expr").call((a,x) => {
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
	}))

	// Selector that tries to match a numeric expression, then falls back to
	// a string expression.
	rule("default", alt(ref("number_expr"), ref("string_expr")))

	// Optional string expression defaulting to matching all rows.
	rule("opt_string_expr", opt(ref("string_expr").set()).call((a,x)=>{
		if (x !== "") {
			return x;
		};
		return {method: M.TRUE, args: []};
	}))

	// Selectors for matching stringlike values.
	rule("string_expr", alt(
		ref("all"),
		ref("fuzzy"),
		ref("string"),
		ref("regexp"),
	))
	rule("all", lit(ALL).call((a,x) => ({method: M.TRUE, args:[]})))
	rule("string", alt(ref("string_sq"), ref("string_dq")))
	rule("fuzzy", ref("word").call((a,x) => ({method: M.FUZZY, args:[x]})))
	rule("string_sq",
		seq(
			lit(SUB_STRING),
			init(()=>[]).rep(alt(ref("escapes"), except(SUB_STRING).set()).append()).set(),
			lit(SUB_STRING),
		).call((a, x) => ({method: M.SUB, args:[x.join("")]})),
	)
	rule("string_dq",
		seq(
			lit(EXACT_STRING),
			init(()=>[]).rep(alt(ref("escapes"), except(EXACT_STRING).set()).append()).set(),
			lit(EXACT_STRING),
		).call((a, x) => ({method: M.EQ, args:[x.join("")]})),
	)
	rule("regexp",
		seq(
			lit(REGEXP),
			rep(alt(seq(lit(ESCAPE), lit(REGEXP)), except(REGEXP))),
			lit(REGEXP),
			lit(REGEXP_FLAGS),
		).call((a,x) => {
			const i = x.lastIndexOf("/");
			const pattern = x.slice(1, i);
			const flags = x.slice(i+1);
			return {method: M.REGEXP, args:[new RegExp(pattern, flags)]};
		}),
	)
	rule("any", name("any").lit(ANY))

	rule("escapes", seq(lit(ESCAPE), alt(
		lit(ESCAPE).set(ESCAPE),
		lit(EXACT_STRING).set(EXACT_STRING),
		lit(SUB_STRING).set(SUB_STRING),
		lit(REGEXP).set(REGEXP),
		lit("t").set("\t"),
		lit("n").set("\n"),
		lit("r").set("\r"),
		lit("\n").set(""),
		lit(/^x([0-9A-Fa-f]{2})/).call((a,x)=>(String.fromCharCode(parseInt(x, 16)))),
		lit(/^u([0-9A-Fa-f]{4})/).call((a,x)=>(String.fromCharCode(parseInt(x, 16)))),
		lit(/^U([0-9A-Fa-f]{8})/).call((a,x)=>{
			x = parseInt(x, 16);
			if (x > 0x10FFFF) {
				return "\uFFFD";
			};
			return String.fromCodePoint(x);
		}),
		ref("any").set(),
	)))

	// Sequence of letter characters.
	rule("word", name("word").lit(WORD))

	// Words that translate to a boolean.
	rule("bool", alt(
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
	))

	// Optional number expression defaulting to matching all rows.
	rule("opt_number_expr", opt(ref("number_expr").set()).call((a,x)=>{
		if (x !== "") {
			return x;
		};
		return {method: M.TRUE, args: []};
	}))

	// Selectors for numbers.
	rule("number_expr", init(()=>({method:M.N_EQ,args:[]})).seq(
		//TODO:range: `lower-upper`
		opt(ref("number_op").field("method")),
		ref("number").appendField("args"),
	))
	rule("number_op", alt(
		lit(LE).set(M.N_LE),
		lit(LT).set(M.N_LT),
		lit(GE).set(M.N_GE),
		lit(GT).set(M.N_GT),
	))
	rule("number", alt(
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
	))
	rule("digits", lit(DIGITS))
};
return [()=>grammar.make(rules, globalValue), ()=>grammar.print(rules)];
};
