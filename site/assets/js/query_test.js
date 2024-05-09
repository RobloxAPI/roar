import * as query from "./query.js"

const TESTS = [
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
];

for (let test of TESTS) {
	const [input, expected] = test;
	try {
		const result = query.parse(input);
		if (expected === undefined) {
			console.log(
`INPUT ${input}
OUTPUT ${JSON.stringify(result.capture)}
`);
			continue;
		} else {
			let exp = JSON.stringify(expected);
			const output = JSON.stringify(result.capture);
			if (output !== exp) {
				console.log(
`INPUT ${input}
EXPECTED ${JSON.stringify(expected, null, "    ")}
OUTPUT ${JSON.stringify(result.capture, null, "    ")}
`);
			};
		};
	} catch (error) {
		console.log(
`INPUT ${input}
ERROR ${error}
`);
	};
};
