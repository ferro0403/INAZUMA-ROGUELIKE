const fs = require("fs");
const vm = require("vm");
function expect(value, message) { if (!value) throw new Error(message); }
const values = new Map();
const localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
const context = { console, Date, Math, JSON, localStorage, globalThis: { localStorage, SEASON1_CONFIG: { saveVersion: 2, startingLives: 2, maxRunLives: 2, saveKey: "run" }, SeasonRegistry: { normalizeSeasonId: () => "ie1" } } };
vm.runInNewContext(fs.readFileSync("js/run-state.js", "utf8"), context);
const state = context.globalThis.RunState;
expect(state.loadProfile().preferences.smartAutoLineup === false, "legacy/missing preference must default OFF");
state.saveProfilePreferences({ smartAutoLineup: true });
expect(state.loadProfile().preferences.smartAutoLineup === true, "ON must persist across reloads");
state.saveProfileTeamIdentity({ name: "Raimon", emblemId: "default-lightning" });
expect(state.loadProfile().preferences.smartAutoLineup === true, "team identity saves must preserve preferences");
state.saveProfilePreferences({ smartAutoLineup: false });
expect(state.loadProfile().preferences.smartAutoLineup === false, "OFF must persist across reloads");
console.log("smart lineup preference regression tests OK");
