"use strict";

const securityIdentities = [
	"All",
	"Server",
	"CoreScript",
	"BuiltinPlugin",
	"Command",
	"Plugin",
	"Script",
];
const securityPermissions = new Map([
	//                          ALL SVR CSC BPL CMD PLG SCR
	["None"                  , [ 1 , 1 , 1 , 1 , 1 , 1 , 1 ]],
	["RobloxPlaceSecurity"   , [ 1 , 1 , 1 , 1 , 1 , 1 , 0 ]],
	["PluginSecurity"        , [ 1 , 1 , 1 , 1 , 1 , 1 , 0 ]],
	["LocalUserSecurity"     , [ 1 , 1 , 1 , 0 , 1 , 0 , 0 ]],
	["RobloxScriptSecurity"  , [ 1 , 1 , 1 , 1 , 0 , 0 , 0 ]],
	["RobloxSecurity"        , [ 1 , 1 , 0 , 0 , 0 , 0 , 0 ]],
	["NotAccessibleSecurity" , [ 1 , 0 , 0 , 0 , 0 , 0 , 0 ]],
]);

const settings = [
	{
		"name": "Theme",
		"type": "radio",
		"default": "Auto",
		"options": [
			{"text": "Auto", "value": "Auto"},
			{"text": "Light", "value": "Light"},
			{"text": "Dark",  "value": "Dark"},
		],
	},
	{
		"name": "SecurityIdentity",
		"type": "select",
		"default": "0",
		"text": "Permission",
		"options": securityIdentities.map((v) => ({"value": v})),
	},
	{
		"name": "ExpandMembers",
		"type": "checkbox",
		"default": false,
		"text": "Expand all members",
	},
	{
		"name": "ShowDeprecated",
		"type": "checkbox",
		"default": true,
		"text": "Show deprecated",
	},
	{
		"name": "ShowNotBrowsable",
		"type": "checkbox",
		"default": true,
		"text": "Show unbrowsable",
	},
	{
		"name": "ShowNotScriptable",
		"type": "checkbox",
		"default": true,
		"text": "Show unscriptable",
	},
	{
		"name": "ShowHidden",
		"type": "checkbox",
		"default": true,
		"text": "Show hidden",
	},
	{
		"name": "ShowRemoved",
		"type": "checkbox",
		"default": true,
		"text": "Show removed",
	}
];

function generateMenu(parent, settings, changed) {
	let form = document.createElement("form");
	const idPrefix = "setting-";
	for (let setting of settings) {
		let value = window.localStorage.getItem(setting.name);
		if (value === null) {
			value = setting.default;
		};
		let section = document.createElement("div");
		section.className = setting.type;
		if (setting.type === "checkbox") {
			value = value === true || value === "true";
			let input = document.createElement("input");
			input.type = "checkbox";
			input.id = idPrefix + setting.name;
			input.name = setting.name;
			input.disabled = setting.disabled;
			input.defaultChecked = value;
			// Fires on toggle.
			input.addEventListener("change", function(event) {
				changed(event.target.name, event.target.checked, false);
			});

			let label = document.createElement("label");
			label.htmlFor = input.id;
			label.textContent = setting.text;

			section.appendChild(input);
			section.appendChild(label);
		} else if (setting.type === "radio") {
			for (let option of setting.options) {
				let input = document.createElement("input");
				input.type = "radio";
				input.id = idPrefix + setting.name + "-" + option.value;
				input.name = setting.name;
				input.value = option.value;
				input.disabled = setting.disabled || option.disabled;
				input.defaultChecked = value === option.value;
				// Fires on checked.
				input.addEventListener("change", function(event) {
					changed(event.target.name, event.target.value, false);
				});

				let label = document.createElement("label");
				label.htmlFor = input.id;
				label.textContent = option.text || option.value;

				section.appendChild(input);
				section.appendChild(label);
			};
		} else if (setting.type === "select") {
			let select = document.createElement("select");
			select.id = idPrefix + setting.name;
			select.disabled = setting.disabled;
			for (let option of setting.options) {
				let element = document.createElement("option");
				element.value = option.value;
				element.text = option.text || option.value;
				element.disabled = setting.disabled || option.disabled;
				element.defaultSelected = value === option.value;
				select.appendChild(element);
			};
			// Fires on select.
			select.addEventListener("change", function(event) {
				// Unknown support for HTMLSelectElement.name.
				changed(setting.name, event.target.value, false);
			});

			let label = document.createElement("label");
			label.htmlFor = select.id;
			label.textContent = setting.text;

			section.appendChild(select);
			section.appendChild(label);
		};
		form.appendChild(section);
	};
	parent.appendChild(form);
};

class Settings {
	constructor() {
		this.settings = new Map();
	};
	Listen(name, listener) {
		let setting = this.settings.get(name);
		if (setting === undefined) {
			throw "unknown setting " + name;
		};
		if (typeof(listener) !== "function") {
			throw "listener must be a function";
		};
		setting.listeners.push(listener);

		let value = window.localStorage.getItem(name);
		if (value === null) {
			value = setting.config.default;
		};
		if (setting.config.type === "checkbox") {
			value = value === true || value === "true";
		};
		listener(name, value, true);
	};
	Changed(name, value, initial) {
		let setting = this.settings.get(name);
		if (setting === undefined) {
			return;
		};
		window.localStorage.setItem(name, value);
		for (let listener of setting.listeners) {
			listener(name, value, initial);
		};
	};
}

function initSettingsMenu() {
	let container = document.getElementById("settings-container");
	if (container === null) {
		return;
	};

	let button = container.querySelector(".button");
	if (button === null) {
		return;
	};
	let menu = document.getElementById("settings-menu");
	if (menu === null) {
		return;
	};

	container.classList.remove("js");
	menu.classList.remove("js");

	generateMenu(menu, settings, function(name, value, initial) {
		rbxapiSettings.Changed(name, value, initial)
	});

	button.addEventListener("click", function(event) {
		menu.style.display = "block";
		const onClick = function(event) {
			if (!menu.contains(event.target) && menu.style.display !== "none") {
				menu.style.display = "none";
				document.removeEventListener("click", onClick, true);
				event.preventDefault();
				event.stopPropagation();
			};
		};
		document.addEventListener("click", onClick, true);
		event.stopPropagation();
	});
};

function initSettings() {
	initSettingsMenu();

	rbxapiSettings.Listen("ExpandMembers", function(name, value, initial) {
		if (initial && value) {
			let id = document.location.hash.slice(1);
			if (id !== "") {
				if (document.getElementById(id)) {
					// Don't auto-expand if there's a target.
					return;
				};
			};
		};
		for (const input of document.querySelectorAll(".inherited-members input")) {
			input.checked = value;
		};
	});
};

let rbxapiSettings = new Settings()
for (let setting of settings) {
	rbxapiSettings.settings.set(setting.name, {
		"config": setting,
		"listeners": [],
	});
	if (setting.migrate) {
		setting.migrate(window.localStorage);
	};
	if (setting.disabled) {
		continue;
	};
	if (window.localStorage.getItem(setting.name) === null) {
		window.localStorage.setItem(setting.name, setting.default);
	};
};

rbxapiSettings.Listen("Theme", function(name, value, initial) {
	if (initial) {
		// Handled by quick-theme.js.
		return;
	};
	document.documentElement.className = value;
});

let showDeprecated = document.createElement("style");
showDeprecated.innerHTML = `
	.set.deprecated { display:none }
	.class-tree .set.deprecated + ul { padding-left:0; border-left:none }
`;
rbxapiSettings.Listen("ShowDeprecated", function(name, value, initial) {
	if (value) {
		showDeprecated.remove();
	} else {
		document.head.appendChild(showDeprecated);
	};
});

let showNotBrowsable = document.createElement("style");
showNotBrowsable.innerHTML = `
	.set.unbrowsable { display: none }
	.class-tree .set.unbrowsable + ul { padding-left:0; border-left:none }
`;
rbxapiSettings.Listen("ShowNotBrowsable", function(name, value, initial) {
	if (value) {
		showNotBrowsable.remove();
	} else {
		document.head.appendChild(showNotBrowsable);
	};
});

let showNotScriptable = document.createElement("style");
showNotScriptable.innerHTML = `
	.set.unscriptable { display: none }
	.class-tree .set.unscriptable + ul { padding-left:0; border-left:none }
`;
rbxapiSettings.Listen("ShowNotScriptable", function(name, value, initial) {
	if (value) {
		showNotScriptable.remove();
	} else {
		document.head.appendChild(showNotScriptable);
	};
});

let showHidden = document.createElement("style");
showHidden.innerHTML = `
	.set.hidden { display:none }
	.class-tree .set.hidden + ul { padding-left:0; border-left:none }
`;
rbxapiSettings.Listen("ShowHidden", function(name, value, initial) {
	if (value) {
		showHidden.remove();
	} else {
		document.head.appendChild(showHidden);
	};
});

let showRemoved = document.createElement("style");
showRemoved.innerHTML = `
	.set.removed { display:none }
	.class-tree .set.removed + ul { padding-left:0; border-left:none }
`;
rbxapiSettings.Listen("ShowRemoved", function(name, value, initial) {
	if (value) {
		showRemoved.remove();
	} else {
		document.head.appendChild(showRemoved);
	};
});

let security = new Map();
for (let i = 0; i < securityIdentities.length; i++) {
	let content = "";
	for (let primary of securityPermissions) {
		if (primary[1][i] !== 0) {
			continue;
		};
		content += ".set.sec-" + primary[0];
		for (let secondary of securityPermissions) {
			if (secondary[1][i] !== 1) {
				continue;
			};
			content += ":not(.sec-" + secondary[0] + ")";
		};
		content += ",\n";
	};
	if (content === "") {
		continue;
	};
	content = content.slice(0, -2) + " {\n\tdisplay: none;\n}\n";
	let style = document.createElement("style");
	style.innerHTML = content;
	security.set(securityIdentities[i], style);
	// console.log("CHECK", securityIdentities[i]);
	// console.log(content);
	// console.log("---------------------------------------------------");
};
rbxapiSettings.Listen("SecurityIdentity", function(name, value, initial) {
	for (let entry of security) {
		if (value === entry[0]) {
			document.head.appendChild(entry[1]);
		} else {
			entry[1].remove();
		};
	};
});

window.rbxapiSettings = rbxapiSettings;
window.dispatchEvent(new Event("rbxapiSettings"));

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initSettings);
} else {
	initSettings();
};
