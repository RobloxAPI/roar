class Actions {
	constructor(funcs) {
		this.funcs = new Map(funcs);
		this.targets = new Map();
	};
	// Link a target element with an action.
	Link(target, autoupdate, caller) {
		if (!(caller instanceof Array)) {
			throw new Error("caller must be an Array");
		};
		let func = this.funcs.get(caller[0]);
		if (!func) {
			throw new Error("unknown function " + caller[0]);
		};

		if (this.targets.get(target)) {
			this.Unlink(target);
		};

		let callArgs = caller.slice(1);
		let badArg = false;
		for (let i = 0; i < func.arguments.length; i++) {
			let callArg = callArgs[i]
			let funcArg = func.arguments[i];
			if (funcArg instanceof Array) {
				let okay = false;
				for (let type of funcArg) {
					if (type === undefined) {
						if (callArg === undefined) {
							okay = true;
							break;
						};
					} else if (type === null) {
						if (callArg === null) {
							okay = true;
							break;
						};
					} else if (typeof type === "string") {
						if (typeof callArg === type) {
							okay = true;
							break;
						};
					} else if (callArg instanceof type) {
						okay = true;
						break;
					};
				};
				if (!okay) {
					badArg = i;
					break;
				};
			} else if (typeof funcArg === "string") {
				if (typeof callArg !== funcArg) {
					badArg = i;
					break;
				};
			} else if (!(callArg instanceof funcArg)) {
				badArg = i;
				break;
			};
		};
		if (badArg) {
			throw new Error("bad argument #" + (badArg+1) + " to " + caller[0]);
		};

		let update = func.update.bind(undefined, target, callArgs);
		let data = {
			autoupdate: !!autoupdate,
			func: func,
			args: callArgs,
			update: update,
		}
		if (autoupdate) {
			data.value = func.construct(callArgs, update);
		};
		this.targets.set(target, data);
		update();
	};
	// Unlink a target.
	Unlink(target) {
		let data = this.targets.get(target);
		if (!data) {
			return;
		};
		this.targets.delete(target);
		data.func.destruct(data.args, data.update, data.value);
	};
	// Set auto-updating state of target.
	Autoupdate(target, enabled) {
		let data = this.targets.get(target);
		if (!data) {
			return;
		};
		if (data.autoupdate === enabled) {
			return;
		};
		data.autoupdate = !!enabled;
		if (enbled) {
			data.value = data.func.construct(data.args, data.update);
		} else {
			data.func.destruct(data.args, data.update, data.value);
			data.value = undefined;
		};
	};
	// Manually update a target.
	Update() {
		for (let target of arguments) {
			let data = this.targets.get(target);
			if (!data) {
				return;
			};
			data.update();
		};
	};
	// Manually update all targets.
	UpdateAll() {
		for (let data of Array.from(this.targets.values())) {
			data.update();
		};
	};
	// Create a link with a target and referent from selectors.
	QuickLink(targetSelector, referentSelector, caller) {
		let target = document.querySelector(targetSelector);
		let referent = document.querySelector(referentSelector);
		if (!target) {
			console.log(`skipped missing target: ${targetSelector}`);
			return;
		};
		if (!referent) {
			console.log(`skipped missing referent: ${referentSelector}`);
			return;
		};
		caller.splice(1, 0, referent);
		this.Link(target, false, caller);
	};
};

function selectChildrenOrQuery(root, selector) {
	if (selector[0] === ">") {
		selector = selector.slice(1);
		return Array.from(root.children).filter(function(v) {
			return v.matches(selector);
		});
	};
	return root.querySelectorAll(selector);
};

function countVisible(root, selector) {
	let i = 0;
	for (let element of selectChildrenOrQuery(root, selector)) {
		if (getComputedStyle(element).display !== "none") {
			i++;
		};
	};
	return i;
};

export const actions = new Actions([
	["HideIfZero", {
		arguments: [
			Element,  // root
			"string", // selector
		],
		construct: function(args, update) {
			let observer = new IntersectionObserver(update, {root: args[0]})
			for (let element of selectChildrenOrQuery(args[0], args[1])) {
				observer.observe(element);
			};
			return observer;
		},
		destruct: function(args, update, observer) {
			if (observer.takeRecords().length > 0) {
				update();
			};
			observer.disconnect();
		},
		update: function(target, args) {
			if (countVisible(args[0], args[1]) === 0) {
				target.style.display = "none";
			} else {
				target.style.display = "";
			};
		},
	}],
	["Count", {
		arguments: [
			Element,               // root
			"string",              // selector
			[Function, undefined], // singular
			[Function, undefined], // plural
		],
		construct: function(args, update) {
			let observer = new IntersectionObserver(update, {root: args[0]})
			for (let element of selectChildrenOrQuery(args[0], args[1])) {
				observer.observe(element);
			};
			return observer;
		},
		destruct: function(args, update, observer) {
			if (observer.takeRecords().length > 0) {
				update();
			};
			observer.disconnect();
		},
		update: function(target, args) {
			let count = countVisible(args[0], args[1])
			if (args[2] && args[3]) {
				if (count === 1) {
					count = args[2](count);
				} else {
					count = args[3](count);
				};
			} else if (args[2]) {
				count = args[2](count);
			};
			target.innerText = count;
		},
	}],
]);
