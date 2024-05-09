import * as grammar from "./grammar.js"
import * as queryGrammar from "./query.js"

function TESTS(DB, F, M) {
	return [
		[`foo,bar !fizz,buzz`, {expr:"or",operands:[
			"foo",
			{expr:"and",operands:[
				"bar",
				{expr:"not",operand:"fizz"},
			]},
			"buzz",
		]}],
		[`(foo,bar) (!fizz,buzz)`, {expr:"and",operands:[
			{expr:"or",operands:[
				"foo",
				"bar",
			]},
			{expr:"or",operands:[
				{expr:"not",operand:"fizz"},
				"buzz",
			]},
		]}],
		[`$tag`, {expr:"meta",type:"tag"}],
		[`$foo`, null, `unknown term '$foo'`],
		[`is:class`, {expr:"any",types:DB.T.CLASS}],
		[`is:foo`, null, `unknown term 'is:foo'`],
		[`removed:`, {expr:"op",types:DB.T.ALL,field:F.FLAGS,method:M.REMOVED,args:[]}],
		[`removed:true`, {expr:"op",types:DB.T.ALL,field:F.FLAGS,method:M.REMOVED,args:[]}],
		[`removed:false`, {expr:"not",operand:{expr:"op",types:DB.T.ALL,field:F.FLAGS,method:M.REMOVED,args:[]}}],
		[`removed:falsey`, null, /^1:9: unexpected character .*$/],
		[`superclasses:`, null, `expected number`],
		[`superclasses:4`, {expr:"op",
			types: DB.T.CLASS,
			field: F.SUPERCLASSES,
			method: M.EQ, args: [4],
		}],
		[`superclasses:<4`, {expr:"op",
			types: DB.T.CLASS,
			field: F.SUPERCLASSES,
			method: M.LT, args: [4],
		}],
		[`superclasses:<=4`, {expr:"op",
			types: DB.T.CLASS,
			field: F.SUPERCLASSES,
			method: M.LE, args: [4],
		}],
		[`superclasses:>4`, {expr:"op",
			types: DB.T.CLASS,
			field: F.SUPERCLASSES,
			method: M.GT, args: [4],
		}],
		[`superclasses:>=4`, {expr:"op",
			types: DB.T.CLASS,
			field: F.SUPERCLASSES,
			method: M.GE, args: [4],
		}],
		[`subclasses:4`, {expr:"op",
			types: DB.T.CLASS,
			field: F.SUBCLASSES,
			method: M.EQ, args: [4],
		}],
		// [`tag:Deprecated`, null],
		// [`tag:foo`, null],
	];
};

function deepeq(a, b, lvl) {
	lvl = lvl || 0;
	if (a instanceof Array && b instanceof Array) {
		if (a.length !== b.length) {
			return false;
		};
		for (let i = 0; i < a.length; i++) {
			if (!deepeq(a[i], b[i], lvl+1)) {
				console.log("DIFF"+"    ".repeat(lvl), i);
				return false;
			};
		};
		return true;
	} else if (typeof a === "object" && typeof b === "object") {
		const s = new Set();
		for (let k in a) { s.add(k) };
		for (let k in b) { s.add(k) };
		for (let k of s) {
			if (!deepeq(a[k], b[k], lvl+1)) {
				console.log("DIFF"+"    ".repeat(lvl), k);
				return false;
			};
		};
		return true;
	};
	if (a !== b) {
		console.log("DIFF"+"    ".repeat(lvl), a, b);
	}
	return a === b;
};

export function run([DB, F, M]) {
	const queryParser = grammar.make(queryGrammar.forDatabase(DB, F, M));
	for (let test of TESTS(DB, F, M)) {
		const [input, expected, err] = test;
		try {
			const result = queryParser(input, "main", "debug");
			if (expected === undefined) {
				console.log(
`INPUT  ${input}
OUTPUT ${JSON.stringify(result.capture)}
`);
				continue;
			} else if (expected === null) {
				console.log(
`INPUT    ${input}
EXPECTED ERROR
`);
			} else {
				if (!deepeq(expected, result.capture)) {
					console.log(
`INPUT    ${input}
EXPECTED ${JSON.stringify(expected)}
OUTPUT   ${JSON.stringify(result.capture)}
`);
				};
			};
		} catch (error) {
			if (expected === null) {
				let match;
				if (err instanceof RegExp) {
					match = err.test(error);
				} else {
					match = error === err;
				};
				if (!match) {
			console.log(
`INPUT    ${input}
EXPECTED ${err}
ERROR    ${error}
`);
				};
			} else {
			console.log(
`INPUT ${input}
ERROR ${error}
`);
			};
		};
	};
};
