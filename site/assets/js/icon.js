"use strict";

let resources = null;
function getResources() {
	if (resources) {
		return resources;
	}
	resources = new Promise((resolve, reject) => {
		let resPath = document.head.querySelector("meta[name=\"resources\"]");
		if (resPath === null) {
			reject();
			return;
		};
		resolve(resPath.content);
	})
	.then((res) => {
		return fetch(res)
			.then((resp) => {
				if (!resp.ok) {
					return null;
				};
				return resp.json();
			})
	})
	.then((res) => {
		console.log("RESOURCES", res);
		return res;
	});
	return resources;
}

export function entityIcon(row, kind) {
	const picture = document.createElement("span");
	picture.classList.add("picture");

	return getResources()
		.then((res) => {
			let light;
			let dark;

			kind ||= "link";
			switch (kind) {
			case "hub":
				light = res.Hub;
				dark = res.Hub;
			case "doc":
				//TODO: GitHub icon
				light = res.Hub;
				dark = res.Hub;
			};

			let protec = false;
			const type = row.type;
			switch (type) {
			case "Class":
				const primary = row.primary;
				light = res.Entity.Class[primary].Light;
				dark = res.Entity.Class[primary].Dark;
				break;
			case "Property":
				if (row.field_name("READ_SECURITY") || row.field_name("READ_SECURITY")) {
					protec = true;
				};
			case "Function":
			case "Event":
			case "Callback":
				if (row.field_name("SECURITY")) {
					protec = true;
				};
				if (protec) {
					light = res.Protected[type].Light;
					dark = res.Protected[type].Dark;
					break;
				};
			case "Enum":
			case "EnumItem":
				light = res.Entity[type].Light;
				dark = res.Entity[type].Dark;
				break;
			case "Type":
				let cat = res.Entity[type][row.field_name("TYPE_CAT")];
				if (!cat) {
					cat = res.Entity[type].Primitive;
				};
				light = cat.Light;
				dark = cat.Dark;
				break;
			};

			picture.setAttribute("data-type", type);

			if (light || dark) {
				const icon = document.createElement("span");
				icon.classList.add("icon");
				if (light) {
					icon.style.setProperty("--light", `url('${light}')`);
				};
				if (dark) {
					icon.style.setProperty("--dark", `url('${dark}')`);
				};
				picture.appendChild(icon);
			};
			return picture;
		})
		.catch(() => {
			return picture;
		})
};
