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
const PREFIX        = ":";
const RESULT        = "/";
const LT            = "<";
const LE            = "<=";
const GT            = ">";
const GE            = ">=";
const COMPOUND      = ".";
const SUB_STRING    = "'";
const EXACT_STRING  = '"';
const FUZZY_STRING  = '~';
const ESCAPE        = "\\";
const REGEXP        = "/";
const REGEXP_FLAGS  = /^[imsuv]*/;
const ALL           = "*";
const ANY           = /^./;;
const RANGE         = "..";
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
	// Generates a field selector. name is the name of the prefix portion. value
	// is the rule of the suffix portion. The value is made optional. If the
	// value is empty, then a list selector is emitted, and the rule returns
	// null. Otherwise, call is invoked.
	function field(name, value, call) {
		return seq(word(name), lit(PREFIX), opt(value).set().callGlobal((g,x)=>{
			if (x !== "") {
				return;
			};
			const expr = DB.F.get(name);
			if (expr) {
				g.list.push(expr);
			};
		})).call((a,x) => {
			if (x === "") {
				return null;
			};
			return call(a, x);
		});
	}
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
		ref("results"),
		ref("prefixes"),
		ref("compound"),
		ref("name"),
	))

	// Selectors denoted by a prefix.
	rule("prefixes", alt(
		seq(lit(ALL), lit(PREFIX)).callGlobal((g,x)=>{
			g.list.push({field: null});
			return;
		}).call(()=>null),
		field(`is`, ref("word"), (a,x)=>{
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
		field(`tag`, ref("word"), (a,x)=>{
			return {expr: "flag",
				types: DB.T.ALL,
				field: F.FLAGS,
				flag: x.toLowerCase(),
			};
		}),
		field(`removed`, ref("bool"), (a,x)=>{
			return {expr: "op",
				types: DB.T.ALL,
				field: F.REMOVED,
				...x,
			};
		}),
		field(`superclasses`, ref("number_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.SUPERCLASSES,
				...x,
			};
		}),
		field(`subclasses`, ref("number_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.SUBCLASSES,
				...x,
			};
		}),
		field(`members`, ref("number_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.MEMBERS,
				...x,
			};
		}),
		field(`superclass`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.SUPERCLASS,
				...x,
			};
		}),
		field(`subclass`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.SUBCLASS,
				...x,
			};
		}),
		field(`memcat`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.CLASS],
				field: F.MEM_CAT,
				...x,
			};
		}),
		prefix(`memecat`, ref("opt_string_expr").set().callGlobal((g,x)=>{
			g.results.push(`˖⁺‧₊˚˖⁺‧₊˚˖⁺‧₊˚˖⁺‧₊˚ᓚ₍ ˆ•⩊•ˆ₎`+((x&&x.args[0])?` ⦟⟮ ${x.args[0]} ⟯`:``));
		})).call(()=>null),
		field(`threadsafety`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: DB.T.MEMBERS,
				field: F.THREAD_SAFETY,
				...x,
			};
		}),
		field(`security`, ref("string_expr"), (a,x)=>{
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
		field(`cansave`, ref("bool"), (a,x)=>{
			return {expr:"op",
				types: DB.T.MEMBERS,
				field: F.CAN_SAVE,
				...x,
			};
		}),
		field(`canload`, ref("bool"), (a,x)=>{
			return {expr:"op",
				types: DB.T.MEMBERS,
				field: F.CAN_LOAD,
				...x,
			};
		}),
		field(`readsecurity`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.READ_SECURITY,
				...x,
			};
		}),
		field(`writesecurity`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.WRITE_SECURITY,
				...x,
			};
		}),
		field(`valuetypecat`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.VALUE_TYPE_CAT,
				...x,
			};
		}),
		field(`valuetypename`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.VALUE_TYPE_NAME,
				...x,
			};
		}),
		field(`category`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.CATEGORY,
				...x,
			};
		}),
		field(`default`, ref("default"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.PROPERTY],
				field: F.DEFAULT,
				...x,
			};
		}),
		field(`returns`, ref("number_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.CALLBACK],
				field: F.RETURNS,
				...x,
			};
		}),
		field(`parameters`, ref("number_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
				field: F.PARAMETERS,
				...x,
			};
		}),
		field(`returntypecat`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.CALLBACK],
				field: F.RETURN_TYPE_CAT,
				...x,
			};
		}),
		field(`returntypename`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.CALLBACK],
				field: F.RETURN_TYPE_NAME,
				...x,
			};
		}),
		field(`returntypeopt`, ref("bool"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
				field: F.RETURN_TYPE_OPT,
				...x,
			};
		}),
		field(`paramtypecat`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
				field: F.PARAM_TYPE_CAT,
				...x,
			};
		}),
		field(`paramtypename`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
				field: F.PARAM_TYPE_NAME,
				...x,
			};
		}),
		field(`paramtypeopt`, ref("bool"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
				field: F.PARAM_TYPE_OPT,
				...x,
			};
		}),
		field(`paramname`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.EVENT, DB.T.CALLBACK],
				field: F.PARAM_NAME,
				...x,
			};
		}),
		field(`paramdefault`, ref("default"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.FUNCTION, DB.T.CALLBACK],
				field: F.PARAM_DEFAULT,
				...x,
			};
		}),
		field(`enumitems`, ref("number_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.ENUM],
				field: F.ENUM_ITEMS,
				...x,
			};
		}),
		field(`itemvalue`, ref("number_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.ENUMITEM],
				field: F.ITEM_VALUE,
				...x,
			};
		}),
		field(`legacynames`, ref("number_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.ENUMITEM],
				field: F.LEGACY_NAMES,
				...x,
			};
		}),
		field(`legacyname`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.ENUMITEM],
				field: F.LEGACY_NAME,
				...x,
			};
		}),
		field(`typecat`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: [DB.T.TYPE],
				field: F.TYPE_CAT,
				...x,
			};
		}),
		field(`primary`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: DB.T.ALL,
				field: F.PRIMARY,
				...x,
			};
		}),
		field(`secondary`, ref("string_expr"), (a,x)=>{
			return {expr:"op",
				types: DB.T.SECONDARY,
				field: F.SECONDARY,
				...x,
			};
		}),
	).newline())

	// Selectors related to search results.
	rule("results", seq(lit(RESULT), alt(
		prefix(`limit`, ref("number").global("limit")),
		prefix(`sort`, seq(
			ref("word").field("column"),
			opt(alt(lit(LT), lit(GT))).field("direction"),
		)).global("sort"),
		prefix(`go`, ref("word").set()).global("go"),
	)).call(()=>null))

	// Selector for dot-separated names.
	rule("compound", alt(
		init(()=>[]).seq(
			ref("string_expr").call((a,x) => {
				a.push({expr:"op",
					types: DB.T.SECONDARY,
					field: F.PRIMARY,
					...x,
				});
				return a;
			}),
			lit(COMPOUND),
			ref("string_expr").call((a,x) => {
				a.push({expr:"op",
					types: DB.T.SECONDARY,
					field: F.SECONDARY,
					...x,
				});
				return a;
			}),
		).set(),
		init(()=>[]).seq(
			ref("string_expr").call((a,x) => {
				a.push({expr:"op",
					types: DB.T.PRIMARY,
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
					types: DB.T.SECONDARY,
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
		ref("sub_string"),
		ref("exact_string"),
		ref("fuzzy_string"),
		ref("regexp"),
	))
	rule("all", lit(ALL).set({method: M.TRUE, args:[]}))
	rule("fuzzy", ref("word").call((a,x) => ({method: M.FUZZY, args:[x]})))
	rule("sub_string",
		seq(
			lit(SUB_STRING),
			init(()=>[]).rep(alt(ref("escapes"), except(SUB_STRING).set()).append()).set(),
			lit(SUB_STRING),
		).call((a, x) => ({method: M.SUB, args:[x==="" ? x : x.join("")]})),
	)
	rule("exact_string",
		seq(
			lit(EXACT_STRING),
			init(()=>[]).rep(alt(ref("escapes"), except(EXACT_STRING).set()).append()).set(),
			lit(EXACT_STRING),
		).call((a, x) => ({method: M.EQ, args:[x==="" ? x : x.join("")]})),
	)
	rule("fuzzy_string",
		seq(
			lit(FUZZY_STRING),
			init(()=>[]).rep(alt(ref("escapes"), except(FUZZY_STRING).set()).append()).set(),
			lit(FUZZY_STRING),
		).call((a, x) => ({method: M.FUZZY, args:[x==="" ? x : x.join("")]})),
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
		lit(FUZZY_STRING).set(FUZZY_STRING),
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
		ref("all"),
		alt(
			word(`0`),
			word(`no`),
			word(`false`),
			word(`n`),
			word(`f`),
		).set({method: M.EQ, args:[false]}),
		alt(
			word(`1`),
			word(`yes`),
			word(`true`),
			word(`y`),
			word(`t`),
		).set({method: M.EQ, args:[true]}),
	))

	// Optional number expression defaulting to matching all rows.
	rule("opt_number_expr", opt(ref("number_expr").set()).call((a,x)=>{
		if (x !== "") {
			return x;
		};
		return {method: M.TRUE, args: []};
	}))

	// Selectors for numbers.
	rule("number_expr", alt(
		ref("all"),
		ref("number_range"),
		ref("number_operation"),
	))
	rule("number_range", init(()=>[]).seq(
		ref("number").append(),
		lit(RANGE),
		ref("number").append(),
	).call((a,x)=>({method:M.RANGE, args:x})))
	rule("number_operation", init(()=>({method:M.N_EQ,args:[]})).seq(
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
