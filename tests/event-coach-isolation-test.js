"use strict";
// Passo 4.1. (1) Con ?dev=1&evento=prova_dev Hekyll Jyde riconosce di nuovo le carte di Halloween: il potere di un
// allenatore si legge dal SUO evento e lo stesso allenatore non puo' stare in due eventi. (2) L'allenatore
// dell'evento finto (sconto 10) riconosce solo le carte dell'evento finto, compare solo in sviluppo e non entra mai
// nel catalogo reale ne' nel salvataggio dell'account. (3) ?oraEvento= sposta solo l'ora usata dagli eventi.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const { loadEvents, loadEventsWithDev } = require("./helpers/events");

const read = (file) => fs.readFileSync(file, "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const moves = [{ name: "A", power: 40 }, { name: "B", power: 50 }, { name: "C", power: 60 }, { name: "D", power: 70 }];
function sandbox() {
  const context = vm.createContext({ console: { warn() {}, log() {} },
    RtgFourMovesRuntime: { movesFor: () => moves, isReady: () => true, error: () => null, ptBreakdown: () => ({ total: 200 }) } });
  context.globalThis = context;
  for (const file of ["js/road-to-glory/rtg-config.js", "js/road-to-glory/rtg-coaches.js"]) vm.runInContext(read(file), context);
  return context;
}
function engine(context) {
  for (const file of ["js/road-to-glory/rtg-coach-power-types.js", "js/road-to-glory/rtg-coach-powers-runtime.js",
    "js/road-to-glory/rtg-card-identity.js", "js/road-to-glory/rtg-rng.js", "js/road-to-glory/rtg-state.js"]) {
    vm.runInContext(read(file), context, { filename: file });
  }
  return context;
}
const card = (cardId, extra = {}) => ({ cardId, playerId: cardId.split("::")[1], legacySeasonId: cardId.split("::")[0],
  position: "MF", normalizedRole: "MF", category: "Forte", ...extra });
const lineup = [card("halloween2026::38"), card("prova_dev::38"), card("ie1::a"), card("ie1::b", { position: "GK", normalizedRole: "GK" })];
const discount = (context, coachId, cardIds) => plain(context.RoadToGloryCoachPowerRuntime.overallDiscountFor(
  { coachId, lineup, bench: [], coachPowerSelection: { coachId, cardIds } },
  { coachOwnedIds: [coachId], activeSeasonId: "ie1" }));

(async () => {
  // --- Gioco con ?dev=1&evento=prova_dev: Halloween e l'evento finto caricati insieme.
  const dev = engine(await loadEventsWithDev(sandbox(), "prova_dev"));
  const types = dev.RoadToGloryCoachPowerTypes;
  assert.strictEqual(types.powerFor("halloween-coach-54").eventCardPrefix, "halloween2026::",
    "con l'evento di prova attivo Hekyll resta l'allenatore di Halloween");
  assert.strictEqual(types.powerFor("prova-coach-1").eventCardPrefix, "prova_dev::");
  assert.strictEqual(types.powerFor("prova-coach-1").params.amount, 10, "sconto dell'allenatore finto: 10");
  assert.deepStrictEqual(discount(dev, "halloween-coach-54", ["halloween2026::38"]), { cardId: "halloween2026::38", amount: 15 },
    "Hekyll riconosce i giocatori Halloween anche con l'evento di prova attivo");
  assert.strictEqual(discount(dev, "halloween-coach-54", ["prova_dev::38"]), null, "Hekyll non riconosce le carte di prova");
  assert.deepStrictEqual(discount(dev, "prova-coach-1", ["prova_dev::38"]), { cardId: "prova_dev::38", amount: 10 });
  assert.strictEqual(discount(dev, "prova-coach-1", ["halloween2026::38"]), null,
    "l'allenatore di prova riconosce solo le carte del suo evento");

  // --- Gioco normale: stesso risultato di prima per Hekyll, nessun allenatore finto.
  const normal = engine(loadEvents(sandbox()));
  assert.deepStrictEqual(discount(normal, "halloween-coach-54", ["halloween2026::38"]), { cardId: "halloween2026::38", amount: 15 });
  assert.strictEqual(normal.RoadToGloryCoaches.lookup("prova-coach-1"), null, "senza ?evento= l'allenatore finto non esiste");
  assert.strictEqual(normal.RoadToGloryCoachPowerTypes.powerFor("prova-coach-1"), null);

  // --- L'allenatore finto non entra mai nel catalogo reale ne' nel salvataggio dell'account.
  for (const context of [dev, normal]) {
    const coaches = context.RoadToGloryCoaches;
    assert(!coaches.CATALOG.some((c) => c.id === "prova-coach-1"), "fuori da CATALOG");
    assert.strictEqual(coaches.BY_ID["prova-coach-1"], undefined, "fuori da BY_ID");
    assert(!coaches.catalog({}).some((c) => c.id === "prova-coach-1"), "fuori dal catalogo delle campagne RTG");
    assert(!coaches.eligible({ campaignId: "rtg-ie-trilogy", activeSeasonId: "ie1", seasonComplete: true })
      .some((c) => c.id === "prova-coach-1"), "mai nel distributore allenatori RTG");
    const saved = context.RoadToGloryState.normalize({ coachOwnedIds: ["208", "prova-coach-1"] });
    assert.deepStrictEqual(plain(saved.coachOwnedIds), ["208"], "il salvataggio dell'account non tiene l'allenatore finto");
    assert.throws(() => context.RoadToGloryState.validate({ ...plain(saved), coachOwnedIds: ["prova-coach-1"] }),
      /allenatori|coach/i, "un account con l'allenatore finto non e' valido");
  }
  const devCoach = dev.RoadToGloryCoaches.lookup("prova-coach-1");
  assert.strictEqual(devCoach?.devCoach, true, "in sviluppo l'allenatore finto si trova");
  assert(dev.RoadToGloryCoaches.catalog({}, { eventId: "prova_dev" }).some((c) => c.id === "prova-coach-1"),
    "e compare solo nella collezione del suo evento finto");
  assert.strictEqual(dev.RoadToGloryCoaches.status({ coachOwnedIds: ["prova-coach-1"] }, "prova-coach-1"), "owned");

  // --- Lo stesso allenatore in due eventi viene rifiutato (era la causa del problema di Hekyll).
  const halloween = JSON.parse(read("data/events/halloween2026.json"));
  const copy = { ...halloween, id: "altro", labels: { ...halloween.labels, badge: "AL" },
    save: { ...halloween.save, key: undefined, cardIdPrefix: "altro::" }, completionReward: undefined };
  assert.throws(() => normal.GameEvents.register(plain(copy)), (error) => error.code === "event-coach-duplicate");

  // --- ?oraEvento=: sposta solo l'ora degli eventi, il tempo continua a scorrere.
  const clock = loadEvents(sandbox());
  const events = clock.GameEvents;
  assert.strictEqual(events.eventTimeShifted(), false);
  assert.strictEqual(events.setEventTime("domani"), false, "valore non valido: nessun cambio");
  assert.strictEqual(events.eventTimeShifted(), false);
  assert.strictEqual(events.setEventTime("2026-11-07"), true);
  const shifted = events.now();
  assert(Math.abs(shifted - Date.parse("2026-11-07T00:00:00+01:00")) < 5000, "2026-11-07 = mezzanotte ora italiana");
  assert(shifted > events.endMs("halloween2026"), "con 2026-11-07 Halloween e' concluso");
  assert.strictEqual(events.setEventTime("2026-11-06T23:59:00+01:00"), true);
  assert(events.now() < events.endMs("halloween2026"), "un minuto prima della fine e' ancora aperto");
  const moduleSource = read("js/road-to-glory/rtg-halloween-event.js");
  assert(!/Date\.now\(\) <= EVENT_END_MS|EVENT_END_MS - Date\.now\(\)/.test(moduleSource), "il modulo usa l'ora degli eventi");
  assert.match(moduleSource, /global\.GameEvents\?\.now\?\.\(\)/);
  assert.match(read("js/app.js"), /if \(DEV_MODE && params\.get\("oraEvento"\)/, "oraEvento solo con ?dev=1");

  console.log("event-coach-isolation-test: PASS (Hekyll con l'evento di prova, allenatore finto isolato, ora evento)");
})().catch((error) => { console.error(error); process.exit(1); });
