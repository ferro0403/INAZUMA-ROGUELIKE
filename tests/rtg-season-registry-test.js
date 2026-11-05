"use strict";
// Passo 3, PR 1: registro unico delle Season RTG (rtg-config.js). Etichette, sigle e campagne devono restare
// IDENTICHE a quelle che prima erano copiate nei singoli file (valori attesi scritti qui sotto, una volta sola).
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { console };
context.globalThis = context;
vm.createContext(context);
for (const file of ["js/road-to-glory/rtg-config.js", "js/road-to-glory/rtg-card-identity.js", "js/road-to-glory/rtg-coaches.js",
  "js/road-to-glory/rtg-rng.js", "js/road-to-glory/rtg-state.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
const config = context.RoadToGloryConfig;
const identity = context.RoadToGloryCardIdentity;

const EXPECTED = {
  ie1: ["Season 1", "S1", "rtg-ie-trilogy"],
  ie1_s2: ["Season 2", "S2", "rtg-ie-trilogy"],
  ie1_s3: ["Season 3", "S3", "rtg-ie-trilogy"],
  ie2: ["Ares", "AR", "rtg-ares-orion"],
  orion: ["Orion", "OR", "rtg-ares-orion"],
};
assert.deepStrictEqual(Array.from(config.SEASON_IDS), Object.keys(EXPECTED), "ordine delle Season");
for (const [id, [label, short, campaign]] of Object.entries(EXPECTED)) {
  assert.strictEqual(config.seasonLabel(id), label, `etichetta di ${id}`);
  assert.strictEqual(config.seasonShortLabel(id), short, `sigla di ${id}`);
  assert.strictEqual(config.season(id).campaignId, campaign, `campagna di ${id}`);
  assert.strictEqual(identity.legacyLabel(id), short, `sigla carta di ${id}`);
}
// Svincolati ed evento restano come prima.
assert.strictEqual(identity.legacyLabel("free_agents"), "FA");
assert.strictEqual(identity.legacyLabel("halloween2026"), "HW");
assert.strictEqual(config.seasonLabel("halloween2026"), "", "un evento non e' una Season del registro");

// Campagne: stesso contenuto e stesso ordine di prima (allenatori e ricominciare la campagna le usano).
const campaigns = JSON.parse(JSON.stringify(config.CAMPAIGN_SEASONS));
assert.deepStrictEqual(campaigns, { "rtg-ie-trilogy": ["ie1", "ie1_s2", "ie1_s3"], "rtg-ares-orion": ["ie2", "orion"] });
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.RoadToGloryCoaches.CAMPAIGN_SEASONS)), campaigns);
assert.deepStrictEqual(Array.from(config.campaignSeasonIds("sconosciuta")), []);
// rtg-state.js valida i salvataggi con la sua lista (non toccata per non cambiare il salvataggio): deve coincidere.
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.RoadToGloryState.CAMPAIGN_SEASONS)), campaigns,
  "registro delle Season e validazione dei salvataggi devono avere le stesse campagne");

// Nessuna copia delle etichette rimasta nei file che ora leggono il registro.
for (const file of ["js/road-to-glory/rtg-squad-controller.js", "js/road-to-glory/rtg-card-identity.js",
  "js/road-to-glory/rtg-development-controller.js", "js/road-to-glory/rtg-halloween-event.js"]) {
  const text = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(text, /ie1_s2\s*:\s*"(Season 2|S2)"/, `${file}: etichette copiate`);
}
console.log("rtg-season-registry-test: PASS");
