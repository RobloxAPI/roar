import * as grammar from "./grammar.js"
import * as queryGrammar from "./query.js"

function TESTS(DB, F, M) {
	function fuzzy(value) {
		return {expr:"or", operands:[
			{expr:"op",
				types:DB.T.PRIMARY,
				field:F.PRIMARY,
				method:M.FUZZY,
				args:[value],
			},
			{expr:"op",
				types:DB.T.SECONDARY,
				field:F.SECONDARY,
				method:M.FUZZY,
				args:[value],
			},
		]};
	}
	return [
		[`foo,bar !fizz,buzz`, {expr:"or",operands:[
			fuzzy("foo"),
			{expr:"and",operands:[
				fuzzy("bar"),
				{expr:"not",operand:fuzzy("fizz")},
			]},
			fuzzy("buzz"),
		]}],
		[`(foo,bar) (!fizz,buzz)`, {expr:"and",operands:[
			{expr:"or",operands:[
				fuzzy("foo"),
				fuzzy("bar"),
			]},
			{expr:"or",operands:[
				{expr:"not",operand:fuzzy("fizz")},
				fuzzy("buzz"),
			]},
		]}],

		[`$tag`, {expr:"meta",type:"tag"}],
		[`$foo`, null, `unknown term '$foo'`],

		[`is:class`, {expr:"any",types:[DB.T.CLASS]}],
		[`is:foo`, null, `unknown term 'is:foo'`],

		[`removed:`, {expr:"op",types:DB.T.ALL,field:F.FLAGS,method:M.REMOVED,args:[]}],
		[`removed:true`, {expr:"op",types:DB.T.ALL,field:F.FLAGS,method:M.REMOVED,args:[]}],
		[`removed:false`, {expr:"not",operand:{expr:"op",types:DB.T.ALL,field:F.FLAGS,method:M.REMOVED,args:[]}}],
		[`removed:falsey`, null, {line: 1, column: 9, error: /^unexpected character .*$/}],

		[`superclasses:`, null, `expected number`],
		[`superclasses:4`, {expr:"op", types: [DB.T.CLASS], field: F.SUPERCLASSES, method: M.N_EQ, args: [4]}],
		[`superclasses:<4`, {expr:"op", types: [DB.T.CLASS], field: F.SUPERCLASSES, method: M.N_LT, args: [4]}],
		[`superclasses:<=4`, {expr:"op", types: [DB.T.CLASS], field: F.SUPERCLASSES, method: M.N_LE, args: [4]}],
		[`superclasses:>4`, {expr:"op", types: [DB.T.CLASS], field: F.SUPERCLASSES, method: M.N_GT, args: [4]}],
		[`superclasses:>=4`, {expr:"op", types: [DB.T.CLASS], field: F.SUPERCLASSES, method: M.N_GE, args: [4]}],
		[`SUPERCLASSES:4`, {expr:"op", types: [DB.T.CLASS], field: F.SUPERCLASSES, method: M.N_EQ, args: [4]}],

		[`subclasses:`, null, `expected number`],
		[`subclasses:4`, {expr:"op", types: [DB.T.CLASS], field: F.SUBCLASSES, method: M.N_EQ, args: [4]}],
		[`subclasses:<4`, {expr:"op", types: [DB.T.CLASS], field: F.SUBCLASSES, method: M.N_LT, args: [4]}],
		[`subclasses:<=4`, {expr:"op", types: [DB.T.CLASS], field: F.SUBCLASSES, method: M.N_LE, args: [4]}],
		[`subclasses:>4`, {expr:"op", types: [DB.T.CLASS], field: F.SUBCLASSES, method: M.N_GT, args: [4]}],
		[`subclasses:>=4`, {expr:"op", types: [DB.T.CLASS], field: F.SUBCLASSES, method: M.N_GE, args: [4]}],
		[`SUBCLASSES:4`, {expr:"op", types: [DB.T.CLASS], field: F.SUBCLASSES, method: M.N_EQ, args: [4]}],

		[`members:`, null, `expected number`],
		[`members:4`, {expr:"op", types: [DB.T.CLASS], field: F.MEMBERS, method: M.N_EQ, args: [4]}],
		[`members:<4`, {expr:"op", types: [DB.T.CLASS], field: F.MEMBERS, method: M.N_LT, args: [4]}],
		[`members:<=4`, {expr:"op", types: [DB.T.CLASS], field: F.MEMBERS, method: M.N_LE, args: [4]}],
		[`members:>4`, {expr:"op", types: [DB.T.CLASS], field: F.MEMBERS, method: M.N_GT, args: [4]}],
		[`members:>=4`, {expr:"op", types: [DB.T.CLASS], field: F.MEMBERS, method: M.N_GE, args: [4]}],
		[`MEMBERS:4`, {expr:"op", types: [DB.T.CLASS], field: F.MEMBERS, method: M.N_EQ, args: [4]}],

		[`tag:Deprecated`, {expr:"flag", types: DB.T.ALL, field: F.FLAGS, flag: "deprecated"}],
		[`tag:foo`, {expr:"flag", types: DB.T.ALL, field: F.FLAGS, flag: "foo"}],
	];
};

function deepeq(a, b, lvl, ref) {
	lvl = lvl || 0;
	ref = ref || new Set();
	if (ref.has(a) || ref.has(b)) {
		return ref.has(a) && ref.has(b);
	};
	ref.add(a);
	ref.add(b);
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

function matchError(expected, got) {
	if (expected instanceof RegExp) {
		return expected.test(got.error);
	} else if (typeof expected === "string") {
		return expected === got.error;
	} else {
		if (expected.error !== undefined && !matchError(expected.error, got)) {
			return false;
		}
		if (expected.line !== undefined && expected.line !== got.line) {
			return false;
		}
		if (expected.column !== undefined && expected.column !== got.column) {
			return false;
		}
		if (expected.offset !== undefined && expected.offset !== got.offset) {
			return false;
		}
	};
	return true;
};

export function run([DB, F, M]) {
	const queryParser = grammar.make(queryGrammar.forDatabase(DB, F, M));
	for (let test of TESTS(DB, F, M)) {
		const [input, expected, err] = test;
		const result = queryParser(input, "main", "debug");
		if (!(result instanceof grammar.Error)) {
			if (expected === undefined) {
				console.log(`INPUT  ${input}\nOUTPUT ${JSON.stringify(result.capture)}\nGLOBAL ${JSON.stringify(result.global)}\n`);
			} else if (expected === null) {
				console.log(`INPUT    ${input}\nEXPECTED ERROR\nGLOBAL ${JSON.stringify(result.global)}\n`);
			} else {
				if (!deepeq(expected, result.capture)) {
					console.log(`INPUT    ${input}\nEXPECTED ${JSON.stringify(expected)}\nOUTPUT   ${JSON.stringify(result.capture)}\nGLOBAL ${JSON.stringify(result.global)}\n`);
				};
			};
		} else {
			if (expected === null) {
				if (!matchError(err, result)) {
					console.log(`INPUT    ${input}\nEXPECTED ${err}\nERROR    ${result.error}\n`);
				};
			} else {
				console.log(`INPUT ${input}\nERROR ${result.error}\n`);
			};
		};
	};
};
