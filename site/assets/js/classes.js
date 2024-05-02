function clearList(list) {
	while (list.lastChild) {
		list.removeChild(list.lastChild);
	};
};

function sortByTree(list, classes, parents) {
	clearList(list);
	for (let item of parents) {
		item[1].appendChild(item[0]);
	};
};

function sortByName(list, classes, parents) {
	clearList(list);
	for (let item of classes) {
		if (item[2]) {
			list.appendChild(item[0]);
		} else {
			item[0].remove();
		};
	};
};

new Promise(resolve => {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", resolve);
	} else {
		resolve();
	};
}).then(() => {
	for (let controls of document.getElementsByClassName("class-sort")) {
		let container = controls.closest(".class-container");
		if (!container) {
			continue;
		};
		let tree = container.querySelector(".class-tree");
		if (!tree) {
			continue;
		};
		let labels = controls.querySelectorAll("label");

		controls.classList.remove("js");

		const removed = !!controls.closest("#removed-classes");

		let classes = [];
		let parents = [];
		for (let li of tree.querySelectorAll("li")) {
			const link = li.querySelector(".entity-link");
			const text = link.textContent.trim();
			classes.push([li, text, !removed || li.matches(":scope:has(> .removed)")]);
			parents.push([li, li.parentNode]);
		};
		classes.sort(function(a, b) {
			return a[1].localeCompare(b[1]);
		});

		let methods = {
			"Tree": sortByTree,
			"Name": sortByName,
		};

		const settingName = "ClassSort";
		const setting = window.localStorage.getItem(settingName);
		for (let label of labels) {
			let input = document.getElementById(label.htmlFor);
			if (!input) {
				continue;
			};
			let method = methods[input.value];
			if (!method) {
				continue;
			};
			let update = function(event) {
				input.checked = true;
				method(tree, classes, parents);
				window.localStorage.setItem(settingName, input.value);
			}
			input.addEventListener("click", update);
			if (setting) {
				if (setting === input.value) {
					update();
				};
			} else if (input.checked) {
				update();
			};
		};
	};
});
