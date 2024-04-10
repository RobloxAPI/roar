"use strict";
{
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

function initSortClasses() {
	for (let controls of document.getElementsByClassName("class-sort")) {
		let tree = controls.parentElement.querySelector(".class-tree");
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
				method(tree, classes, parents);
			}
			input.addEventListener("click", update);
			if (input.checked) {
				update();
			};
		};
	};
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initSortClasses);
} else {
	initSortClasses();
};
};
