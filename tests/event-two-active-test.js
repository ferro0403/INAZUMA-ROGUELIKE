"use strict";
// Passo 4.3: due eventi attivi insieme (Halloween + evento di prova con ?dev=1&evento=prova_dev). Un'istanza del
// modulo per evento, un ingresso per evento nelle campagne con la sua scadenza, carte e salvataggi separati.
// Halloween resta identico (RoadToGloryHalloween e' sempre l'istanza di Halloween).
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { loadEvents, loadEventsWithDev } = require("./helpers/events");

const read = (file) => fs.readFileSync(file, "utf8");
const fetcher = async (url) => ({ ok: fs.existsSync(String(url)), json: async () => JSON.parse(read(String(url))) });
function withModule(context) {
  context.RoadToGloryCardIdentity = { record: ({ playerId, legacySeasonId }) => ({ playerId, legacySeasonId,
    cardId: `${legacySeasonId}::${playerId}` }) };
  for (const file of ["js/road-to-glory/rtg-config.js", "js/road-to-glory/rtg-coaches.js",
    "js/road-to-glory/rtg-coach-power-types.js", "js/road-to-glory/rtg-halloween-completion-reward.js",
    "js/road-to-glory/rtg-halloween-event.js"]) vm.runInContext(read(file), context, { filename: file });
  return context;
}
const fresh = () => {
  const context = vm.createContext({ console: { warn() {}, log() {}, error() {} } });
  context.globalThis = context;
  return context;
};

(async () => {
  // Gioco normale: un solo evento, come prima.
  const normal = withModule(loadEvents(fresh()));
  assert.deepStrictEqual(Array.from(normal.GameEvents.modules()).map((m) => m.EVENT_ID), ["halloween2026"]);
  assert.strictEqual(normal.RoadToGloryHalloween.EVENT_ID, "halloween2026");
  assert.strictEqual(normal.GameEvents.module("prova_dev"), null);

  // ?dev=1&evento=prova_dev: due istanze, Halloween prima. Il modulo si carica DOPO il registro, come nel gioco
  // (il registro carica i file con GameEvents.load() all'avvio, quando gli script sono gia' tutti caricati).
  const both = fresh();
  vm.runInContext(read("js/events/event-registry.js"), both);
  withModule(both);
  await loadEventsWithDev(both, "prova_dev");
  const events = both.GameEvents;
  const modules = Array.from(events.modules());
  assert.deepStrictEqual(modules.map((m) => m.EVENT_ID), ["halloween2026", "prova_dev"], "due eventi attivi insieme");
  const [halloween, prova] = modules;
  assert.strictEqual(both.RoadToGloryHalloween, halloween, "RoadToGloryHalloween resta l'istanza di Halloween");
  assert.strictEqual(events.isActive("halloween2026") && events.isActive("prova_dev"), true);

  // Un ingresso per evento, ognuno con la sua scadenza.
  assert.notStrictEqual(halloween.EVENT_END_MS, prova.EVENT_END_MS, "date di fine diverse");
  assert.strictEqual(halloween.EVENT_END_MS, Date.parse("2026-11-06T23:59:59+01:00"));
  assert.strictEqual(prova.EVENT_END_MS, Date.parse("2027-01-29T23:59:59+01:00"));
  events.setEventTime("2026-11-03T13:00:00+01:00");
  const entries = modules.map((m) => m.eventCard());
  assert.match(entries[0], /data-rtg-event-open="halloween2026"/);
  assert.match(entries[1], /data-rtg-event-open="prova_dev"/);
  assert.match(entries[0], /data-halloween-countdown>3g 10h 59m/, "Halloween: la sua scadenza");
  assert.match(entries[1], /data-halloween-countdown>87g 10h 59m/, "evento di prova: la sua scadenza");
  events.setEventTime("2026-11-07");
  assert.strictEqual(halloween.isOpen(), false, "Halloween concluso");
  assert.strictEqual(prova.isOpen(), true, "l'evento di prova resta aperto");
  assert.match(halloween.eventCard(), /disabled[\s\S]*EVENTO TERMINATO/);
  assert.doesNotMatch(prova.eventCard(), /EVENTO TERMINATO|disabled/);

  // Carte: ogni carta va al modulo del suo evento, con i suoi giocatori.
  await Promise.all(modules.map((m) => m.prepare(fetcher)));
  assert.strictEqual(events.moduleForCard("halloween2026::38"), halloween);
  assert.strictEqual(events.moduleForCard("prova_dev::2050"), prova);
  assert.strictEqual(events.moduleForCard("ie1::38"), null);
  assert.strictEqual(halloween.eventPlayer("38").cardId, "halloween2026::38");
  assert.strictEqual(halloween.eventPlayer("38").teamName, "Occult Halloween");
  assert.strictEqual(prova.eventPlayer("2050").cardId, "prova_dev::2050");
  assert.strictEqual(prova.eventPlayer("2050").teamName, "Angeli di prova");
  assert.strictEqual(prova.eventPlayer("38"), null, "l'evento di prova non conosce i giocatori di Halloween");
  assert.strictEqual(halloween.eventPlayer("2050"), null, "Halloween non conosce i giocatori di prova");
  assert.strictEqual(prova.eventPlayer("2050").halloweenMoves.length, 4);

  // Poteri: con i due moduli installati ogni allenatore resta del suo evento.
  const types = both.RoadToGloryCoachPowerTypes;
  assert.strictEqual(types.powerFor("halloween-coach-54").eventCardPrefix, "halloween2026::");
  assert.strictEqual(types.powerFor("prova-coach-1").eventCardPrefix, "prova_dev::");

  // Salvataggi: chiavi separate; l'evento di prova solo in chiavi locali dev:.
  const h = events.get("halloween2026").save, d = events.get("prova_dev").save;
  for (const key of ["matchKey", "squadKey", "cardIdPrefix"]) assert.notStrictEqual(h[key], d[key], `${key} diverso`);
  assert(d.matchKey.startsWith("dev:") && d.squadKey.startsWith("dev:"));
  assert.deepStrictEqual(Array.from(events.ledgerPath(events.get("halloween2026"))), ["halloween"]);

  // Premio finale (Shawn) solo per Halloween, con l'ora di Halloween.
  assert.strictEqual(both.RoadToGloryHalloweenCompletion.CARD_ID, "halloween2026::custom_0003");
  assert.match(read("js/road-to-glory/rtg-halloween-completion-reward.js"), /GameEvents\?\.module\?\.\(EVENT_ID\)/);

  // I 5 file che usano il modulo scelgono l'istanza dell'evento giusto (con Halloween come prima se il registro manca).
  assert.match(read("js/road-to-glory/rtg-run-view.js"), /GameEvents\?\.modules\?\.\(\)/, "un ingresso per evento");
  const controller = read("js/road-to-glory/rtg-controller.js");
  assert.match(controller, /querySelectorAll\?\.\("\[data-rtg-halloween-open\]"\)\?\.forEach/, "ogni ingresso apre il suo evento");
  assert.match(controller, /openHalloween\(button\.dataset\.rtgEventOpen\)/);
  assert.match(controller, /for\(const \[key,mode\] of eventModes\)if\(key!==eventModule\.EVENT_ID\)mode\?\.dispose\?\.\(\)/,
    "aprendo un evento si chiude l'altro");
  assert.match(read("js/road-to-glory/rtg-player-resolver.js"), /GameEvents\.moduleForCard\?\.\(rawRef\)/);

  console.log("event-two-active-test: PASS (2 eventi, 2 ingressi, scadenze diverse, carte/poteri/salvataggi separati)");
})().catch((error) => { console.error(error); process.exit(1); });
