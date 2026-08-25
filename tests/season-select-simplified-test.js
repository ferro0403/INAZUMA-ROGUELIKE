const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const registrySource = fs.readFileSync(require.resolve("../js/season-registry.js"), "utf8");
const context = { globalThis: {} };
vm.runInNewContext(registrySource, context);
const seasons = context.globalThis.SeasonRegistry.list();
assert.deepStrictEqual(Array.from(seasons, ({ id }) => id), ["ie1", "ie1_s2", "ie1_s3", "ie2", "orion"]);
assert.deepStrictEqual(Array.from(seasons, ({ displaySeasonNumber }) => displaySeasonNumber), ["1", "2", "3", "1", "1"]);

const cardRenderer = app.slice(app.indexOf("function seasonSelectCardMarkup"), app.indexOf("async function renderSeasonSelect"));
assert.match(cardRenderer, />CONTINUA<.*>INIZIA<.*>ELIMINA</s);
assert.match(cardRenderer, />INIZIA NUOVA RUN</);
for (const recap of ["NESSUNA RUN ATTIVA", "PROSSIMO BOSS", "STAGE", "ZONA", "LV", "VITE", "OVR", "MODULO", "PREVIEW ROSA", "RUN ATTIVA", "ULTIMA GIOCATA"]) assert.doesNotMatch(cardRenderer.toUpperCase(), new RegExp(recap));
assert.match(app, /global\.RunState\.remove\(season\.id, \{ expectedGeneration: observedGeneration \}\)/);
assert.match(app, /Vuoi eliminare la run di questa Season\? I progressi della run verranno cancellati\./);
assert.match(app, /data-cancel-delete-run>ANNULLA/);
console.log("season-select-simplified-test: order, labels, clean cards and isolated delete OK");
