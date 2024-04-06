"use strict";
{
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

function initUpdates() {
	// Inject pointer style.
	function initStyle() {
		let style = document.createElement("style");
		style.innerHTML = ".change-list-toggle {cursor: pointer}";
		document.head.appendChild(style);
	};
	if (document.readyState === "complete") {
		initStyle();
	} else {
		window.addEventListener("load", initStyle);
	};

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
			if (target.parentElement.matches(".change-list")) {
				target.parentElement.style.display = "";
				// TODO: The browser should automatically scroll to the target
				// at some point, but this might race.

				// Enabling scrollIntoView cancels the automatic scroll by the
				// browser, but then misses the target. Probably because the
				// scroll position is set before the list expansion is rendered.

				// target.scrollIntoView(true);
				return;
			};
			let list = target.querySelector(".change-list")
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
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initUpdates);
} else {
	initUpdates();
};
};
