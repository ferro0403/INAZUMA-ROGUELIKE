"use strict";
// Parte 2 (c): un evento puo' usare le carte di un altro evento solo se il suo file lo dice (uses.cardsFrom), e in
// sola lettura: i poteri restano del proprio evento, lo scambio di carte rifiuta carte di altri eventi.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const { loadEventsWithDev } = require("./helpers/events");

(async () => {
  const context = vm.createContext({ console: { warn() {}, log() {} } });
  context.globalThis = context;
  vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-coaches.js", "utf8"), context);
  await loadEventsWithDev(context, "prova_dev");
  vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-coach-power-types.js", "utf8"), context);
  const events = context.GameEvents;
  assert.deepStrictEqual(Array.from(events.get("prova_dev").uses.cardsFrom), ["halloween2026"]);
  assert.strictEqual(events.canUseCardsFrom("prova_dev", "halloween2026"), true, "l'evento di prova usa le carte di Halloween");
  assert.strictEqual(events.canUseCardsFrom("halloween2026", "prova_dev"), false, "Halloween non usa quelle di prova");
  assert.strictEqual(events.canUseCardsFrom("prova_dev", "prova_dev"), true);
  const bad = (uses) => Array.from(events.validate({ ...JSON.parse(JSON.stringify(events.get("prova_dev"))), uses })).length > 0;
  assert(bad({ cardsFrom: ["prova_dev"] }), "non se stesso");
  assert(bad({ cardsFrom: "halloween2026" }), "un elenco");
  // Isolamento: i poteri restano del proprio evento.
  assert.strictEqual(context.RoadToGloryCoachPowerTypes.powerFor("prova-coach-1").eventCardPrefix, "prova_dev::");
  assert.strictEqual(context.RoadToGloryCoachPowerTypes.powerFor("halloween-coach-54").eventCardPrefix, "halloween2026::");
  // Le carte di un altro evento passano solo se il file lo permette.
  const source = fs.readFileSync("js/road-to-glory/rtg-halloween-event.js", "utf8");
  assert.doesNotMatch(source, /exchangeCards|ownEventCard/, "nessuno scambio di carte nella parte comune");
  assert.match(source, /if\(!global\.GameEvents\?\.canUseCardsFrom\?\.\(EVENT_ID,from\)\)return \[\];/);
  console.log("event-uses-cards-test: PASS (carte di altri eventi solo se permesse, in sola lettura)");
})().catch((error) => { console.error(error); process.exit(1); });
