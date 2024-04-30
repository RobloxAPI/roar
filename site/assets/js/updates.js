function toggleList(event) {
	let parent = event.target.closest(".update");
	if (parent === null) {
		return;
	};
	let list = parent.querySelector(".change-list");
	if (list === null) {
		return;
	};
	if (list.style.display === "none") {
		list.style.display = "";
	} else {
		list.style.display = "none";
	};
};

function toggleAll(show, scroll) {
	let scrollTo;
	for (let item of document.querySelectorAll("#update-list > li .change-list")) {
		let anchor = item.parentElement.querySelector(":target");
		if (anchor !== null) {
			scrollTo = anchor;
		}
		if (show) {
			item.style.display = "";
		} else {
			if (anchor !== null) {
				item.style.display = "";
			} else {
				item.style.display = "none";
			};
		};
	};
	if (scroll && scrollTo !== undefined) {
		scrollTo.scrollIntoView(true);
	};
};

new Promise(resolve => {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", resolve);
	} else {
		resolve();
	};
}).then(() => {
	if (!document.body.matches(".type-updates")) {
		return;
	};

	// Inject pointer style.
	new Promise(resolve => {
		if (document.readyState === "complete") {
			resolve();
		} else {
			window.addEventListener("load", resolve);
		};
	}).then(() => {
		let style = document.createElement("style");
		style.innerHTML = ".change-list-toggle {cursor: pointer}";
		document.head.appendChild(style);
	});

	// Show update controls and instructions.
	for (let item of document.querySelectorAll(".expand-all-changes")) {
		item.classList.remove("js");
	};

	// Init visibility toggle.
	for (let item of document.querySelectorAll("#update-list > li .change-list-toggle")) {
		item.addEventListener("click", toggleList);
	};

	// Init expand-all control.
	let expandAll = document.getElementById("expand-all");
	if (expandAll !== null) {
		expandAll.addEventListener("click", function(event) {
			toggleAll(event.target.checked, false);
		});
		toggleAll(expandAll.checked, true);
	} else {;
		toggleAll(false, true);
	};

	// Scroll to targeted change item.
	let targetID = document.location.hash.slice(1);
	if (targetID !== "") {
		let target = document.getElementById(targetID);
		if (target) {
			let list = target.closest(".change-list")
			if (list) {
				list.style.display = "";
				target.scrollIntoView(true);
				return;
			};
			list = target.querySelector(".change-list")
			if (list) {
				list.style.display = "";
				return;
			};
		};
	};

	// No specific update is being targeted; expand latest updates.
	for (let update of document.querySelectorAll("#update-list .update")) {
		let list = update.querySelector(".change-list");
		if (list === null) {
			continue;
		};
		list.style.display = "";
		// Expand up to first non-empty update.
		if (list.querySelector(".no-changes") === null) {
			break;
		};
	};
});
