// Resolves to a map that pairs a layout name with a MediaQueryList that can be
// used to detect if the layout is active. A style sheet should define media
// queries that contain one selector matching "#LAYOUT_name", where "name" is
// the name of the layout.
export const getLayouts = new Promise(resolve => {
	// Wait for stylsheets to load.
	if (document.readyState === "complete") {
		resolve();
	} else {
		window.addEventListener("load", resolve);
	};
})
.then(() => {
	// Discover layouts.
	const layouts = new Map();
	for (let sheet of document.styleSheets) {
		for (let rule of sheet.cssRules) {
			if (!(rule instanceof CSSMediaRule)) {
				continue
			};
			const sub = rule.cssRules.item(0);
			if (!sub || !sub.selectorText.startsWith("#LAYOUT_")) {
				continue
			};
			layouts.set(
				sub.selectorText.replace("#LAYOUT_", ""),
				window.matchMedia(rule.conditionText)
			);
		};
	};
	return layouts;
});
