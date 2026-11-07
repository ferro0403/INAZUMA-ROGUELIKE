"use strict";
// Parte 2 (a): un evento puo' avere piu' squadre e piu' monete. L'evento di prova ha 2 squadre (Angeli e Orchi di
// prova) e 2 monete (Gettoni e Stelle prova). Halloween resta con una squadra e una moneta, con lo stato di prima.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const { loadEventsWithDev } = require("./helpers/events");

const read = (file) => fs.readFileSync(file, "utf8");
const fetcher = async (url) => ({ ok: fs.existsSync(String(url)), json: async () => JSON.parse(read(String(url))) });
const plain = (value) => JSON.parse(JSON.stringify(value));

(async () => {
  const context = vm.createContext({ console: { warn() {}, log() {}, error() {} } });
  context.globalThis = context;
  vm.runInContext(read("js/events/event-registry.js"), context);
  for (const file of ["js/road-to-glory/rtg-config.js", "js/road-to-glory/rtg-coaches.js", "js/road-to-glory/rtg-coach-power-types.js",
    "js/road-to-glory/rtg-halloween-completion-reward.js", "js/road-to-glory/rtg-halloween-event.js"]) {
    vm.runInContext(read(file), context, { filename: file });
  }
  await loadEventsWithDev(context, "prova_dev");
  const events = context.GameEvents;
  const prova = events.get("prova_dev"), halloween = events.get("halloween2026");

  // Squadre.
  assert.deepStrictEqual(Array.from(events.teamsOf(prova)).map((t) => t.teamId), ["prova-angeli", "prova-orchi"]);
  assert.deepStrictEqual(Array.from(events.teamsOf(halloween)).map((t) => t.teamId), ["occult-2"], "Halloween: una squadra");
  assert.strictEqual(events.teamOfCard(prova, "2072").teamId, "prova-orchi");
  assert.strictEqual(events.teamOfCard(prova, "2050").teamId, "prova-angeli");
  const module = events.module("prova_dev");
  await module.prepare(fetcher);
  assert.strictEqual(module.eventPlayer("2072").teamName, "Orchi di prova", "carta della seconda squadra");
  assert.strictEqual(module.eventPlayer("2072").cardId, "prova_dev::2072");
  assert.strictEqual(module.eventPlayer("2050").teamName, "Angeli di prova");
  assert.strictEqual(module.eventPlayer("2072").halloweenMoves.length, 4);

  // Monete: ognuna nel suo campo dello stato dell'evento; uno stato vecchio senza la seconda parte da 0.
  assert.deepStrictEqual(Array.from(events.currenciesOf(prova)).map((c) => [c.id, c.field]),
    [["gettoni_prova", "balance"], ["stelle_prova", "stars"]]);
  assert.deepStrictEqual(plain(module.eventState(null)), { balance: 0, stars: 0, ownedIds: [], pullCount: 0, completedIds: [], luckyWins: 0 });
  assert.deepStrictEqual(plain(module.eventState({ balance: 5, ownedIds: [], pullCount: 0, completedIds: [], luckyWins: 0 })).stars, 0);
  assert.throws(() => module.eventState({ balance: 5, stars: -1, ownedIds: [], pullCount: 0, completedIds: [], luckyWins: 0 }));
  // Halloween: lo stato non riceve campi nuovi (salvataggio invariato).
  const hw = events.module("halloween2026");
  assert.deepStrictEqual(Object.keys(plain(hw.eventState(null))), ["pumpkins", "ownedIds", "pullCount", "completedIds", "luckyWins"]);
  const old = { pumpkins: 450, ownedIds: ["38"], pullCount: 2, completedIds: ["m1"], luckyWins: 1 };
  assert.deepStrictEqual(plain(hw.eventState(old)), old, "stato di Halloween identico");

  // Il file di un evento con squadre o monete sbagliate viene rifiutato.
  const bad = (patch) => Array.from(events.validate({ ...plain(prova), ...patch })).length > 0;
  assert(bad({ teams: [plain(prova.teams[1])] }), "teams deve iniziare con team");
  assert(bad({ cards: plain(prova.cards).slice(0, 20) }), "carte e squadre devono coincidere");
  assert(bad({ economy: { ...plain(prova.economy), luckyCurrency: "inesistente" } }), "moneta sconosciuta");
  assert(bad({ currencies: [{ id: "gettoni_prova" }, { id: "x", name: "X", field: "balance" }] }), "campo ripetuto");

  console.log("event-teams-currencies-test: PASS (2 squadre e 2 monete nell'evento di prova; Halloween invariato)");
})().catch((error) => { console.error(error); process.exit(1); });
