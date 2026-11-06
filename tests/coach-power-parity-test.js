"use strict";
// Passo 3.3: i poteri degli allenatori passano da "if (coachId === ...)" a dati, con comportamento IDENTICO.
// Questo test prova OGNI allenatore del catalogo (piu' uno sconosciuto) su molti casi (selezioni valide e no, carte
// evento e normali, panchina, posseduto o no, partita in corso) e confronta tutti i risultati del motore dei poteri
// (squadra e prepartita) con tests/fixtures/coach-power-golden.json, registrato con il codice di PRIMA del cambio.
// Il file salva un'impronta (hash) di ogni risultato, non il valore intero: il confronto resta esatto.
// Rigenerare il file solo se un cambio di comportamento e' voluto e approvato: COACH_GOLDEN_WRITE=1 node <questo file>
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const vm = require("vm");

const GOLDEN = "tests/fixtures/coach-power-golden.json";
const moves = [
  { name: "Colpo A", type: "shot", element: "fire", power: 40, ptCost: 40 },
  { name: "Colpo B", type: "shot", element: "wind", power: 75, ptCost: 75 },
  { name: "Colpo C", type: "dribble", element: "forest", power: 52, ptCost: 52 },
  { name: "Colpo D", type: "block", element: "mountain", power: 101, ptCost: 101 },
];
const context = {
  console,
  RtgFourMovesRuntime: { movesFor: () => moves, isReady: () => true, error: () => null, ptBreakdown: () => ({ total: 200 }) },
};
context.globalThis = context;
vm.createContext(context);
const optional = (file) => fs.existsSync(file) && vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
for (const file of ["js/road-to-glory/rtg-config.js", "js/events/event-registry.js", "js/road-to-glory/rtg-coaches.js"]) optional(file);
if (context.GameEvents && fs.existsSync("data/events/halloween2026.json")) {
  context.GameEvents.register(JSON.parse(fs.readFileSync("data/events/halloween2026.json", "utf8")));
}
optional("js/road-to-glory/rtg-coach-power-types.js");
for (const file of ["js/road-to-glory/rtg-coach-powers-runtime.js", "js/road-to-glory/rtg-coach-powers-prematch.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
const squadRules = context.RoadToGloryCoachPowerRuntime;
const prematch = context.RoadToGloryCoachPreMatchRuntime;

const player = (cardId, extra = {}) => ({ cardId, playerId: cardId.split("::")[1], legacySeasonId: cardId.split("::")[0],
  category: "Forte", finalRarity: "Forte", position: "MF", normalizedRole: "MF", element: "fire", ...extra });
const lineup = [player("ie1::a"), player("ie1::b", { position: "FW", normalizedRole: "FW" }), player("ie1::c", { position: "GK", normalizedRole: "GK" }),
  player("halloween2026::38", { halloweenMoves: moves.map(({ ptCost, ...m }) => m) }), player("halloween2026::40", { halloweenMoves: moves }),
  player("free_agents::7", { activeMove: { name: "Libero", power: 30 } })];
const bench = [player("ie1::d"), player("ie1::e", { position: "GK", normalizedRole: "GK" }), player("halloween2026::41")];
const opponent = { lineup: [player("op::1", { position: "GK", normalizedRole: "GK" }), player("op::2"), player("op::3", { position: "FW", normalizedRole: "FW" })],
  bench: [player("op::4"), player("op::5", { position: "GK", normalizedRole: "GK" })] };

const COACHES = [...Array.from(context.RoadToGloryCoaches.CATALOG).map((c) => String(c.id)), "9999"];
const CARD_SETS = [[], ["ie1::a"], ["ie1::a", "ie1::b"], ["halloween2026::38"], ["halloween2026::38", "ie1::a"], ["ie1::d"],
  ["ie1::d", "ie1::a"], ["missing"], ["ie1::a", "ie1::a"], ["free_agents::7"], ["halloween2026::41"], ["ie1::c"]];
const EXTRAS = [{}, { element: "wind", moveIndices: [0, 3] },
  { targets: [{ cardId: "ie1::a", element: "wind", moveIndices: [0, 1] }, { cardId: "ie1::b", element: "mountain", moveIndices: [2] }] }];

const plain = (value) => JSON.parse(JSON.stringify(value === undefined ? null : value));
const safely = (fn) => { try { return plain(fn()); } catch (error) { return { error: String(error?.code || error?.message) }; } };
const baseMatch = () => ({ seasonId: "ie1", ptModeVersion: 1, matchId: "m1",
  ptCurrentByPlayerId: Object.fromEntries(lineup.map((p) => [`user:${p.cardId}`, 200])),
  ptMaxByPlayerId: Object.fromEntries(lineup.map((p) => [`user:${p.cardId}`, 200])),
  userSquad: { lineup: plain(lineup), bench: plain(bench) }, opponentSquad: plain(opponent) });
const options = { upgradeRarity: (p) => ({ ...p, finalRarity: "Elite", category: "Elite" }), ptBreakdown: () => ({ total: 260 }) };

const results = {};
for (const coachId of COACHES) {
  for (const cardIds of CARD_SETS) {
    for (const [extraIndex, extra] of EXTRAS.entries()) {
      for (const owned of [true, false]) {
        for (const mismatch of [false, true]) {
          const key = [coachId, cardIds.join("+") || "-", extraIndex, owned ? "own" : "no", mismatch ? "x" : "ok"].join("|");
          const squad = { coachId, lineup: plain(lineup), bench: plain(bench),
            coachPowerSelection: { coachId: mismatch ? "208" : coachId, cardIds, ...extra } };
          const state = { coachOwnedIds: owned ? [coachId] : [], activeSeasonId: "ie1", activeMatch: null,
            squads: { ie1: { coachId } } };
          const applied = safely(() => squadRules.applyToMatch(baseMatch(), squad, state, options));
          results[key] = {
            powerReady: safely(() => squadRules.powerReady(coachId)),
            selected: safely(() => squadRules.selected(squad)),
            valid: safely(() => squadRules.validConfig(squad, lineup, "ie1", bench)),
            cap: safely(() => squadRules.capOverrideFor(squad, state)),
            discount: safely(() => squadRules.overallDiscountFor(squad, state)),
            roster: safely(() => squadRules.eligibleRosterForCap(squad).length),
            applied,
            costs: safely(() => lineup.map((p) => [0, 3].map((i) => squadRules.moveCost(applied, "user", p.cardId, i, moves[i].ptCost)))),
            elements: safely(() => lineup.map((p) => [0, 2].map((i) => squadRules.moveElement(applied, "user", p.cardId, i, moves[i].element)))),
            pmCoach: safely(() => prematch.coachFor(state, "ie1")),
          };
        }
      }
    }
  }
}
// Poteri prepartita: partita con il potere "in attesa", selezioni di giocatori avversari e della propria panchina.
const PM_SELECTIONS = [["op::2", "op::4"], ["op::1", "op::5"], ["op::1", "op::4"], ["op::4", "ie1::d"], ["op::2", "op::3"],
  ["op::1", "op::2"], ["op::2"], ["op::3"], [], ["op::2", "op::2"], ["missing", "op::2"]];
const pmMatch = (coachId) => {
  const match = baseMatch();
  match.preMatchCoachId = coachId;
  match.presentation = { preMatchPowerStatus: "pending" };
  for (const p of [...opponent.lineup, ...opponent.bench]) {
    match.ptCurrentByPlayerId[`opponent:${p.cardId}`] = 180;
    match.ptMaxByPlayerId[`opponent:${p.cardId}`] = 180;
  }
  return match;
};
for (const coachId of COACHES) {
  for (const playerIds of PM_SELECTIONS) {
    const key = ["pm", coachId, playerIds.join("+") || "-"].join("|");
    const applied = safely(() => prematch.apply(pmMatch(coachId), coachId, { playerIds }));
    results[key] = {
      powerReady: safely(() => prematch.coachFor({ coachOwnedIds: [coachId], squads: { ie1: { coachId } } }, "ie1")),
      selected: null, valid: safely(() => prematch.validate(pmMatch(coachId), coachId, { playerIds })),
      cap: safely(() => prematch.validate({ ...pmMatch(coachId), preMatchCoachId: "altro" }, coachId, { playerIds })),
      discount: safely(() => prematch.skip(pmMatch(coachId))), roster: null, applied,
      costs: safely(() => opponent.lineup.map((p) => [0, 3].map((i) => prematch.blocked(applied, "opponent", p.cardId, i)))),
      elements: null, pmCoach: safely(() => prematch.coachFor({ coachOwnedIds: [], squads: { ie1: { coachId } } }, "ie1")),
    };
  }
}
// Caso partita in corso per Travis (1777): lo sconto resta anche all'intervallo.
const travis = { coachId: "1777", lineup: plain(lineup), bench: plain(bench), coachPowerSelection: { coachId: "1777", cardIds: ["ie1::d"] } };
results["1777|halftime"] = safely(() => squadRules.capOverrideFor(travis, { coachOwnedIds: ["1777"], activeSeasonId: "ie1",
  activeMatch: { seasonId: "ie1", coachPowerEffect: { coachId: "1777", cardIds: ["ie1::d"] } } }));

const FIELDS = ["powerReady", "selected", "valid", "cap", "discount", "roster", "applied", "costs", "elements", "pmCoach"];
const hash = (value) => crypto.createHash("sha1").update(JSON.stringify(value)).digest("base64").slice(0, 10);
const fingerprint = (entry) => (entry && typeof entry === "object" && "powerReady" in entry ? FIELDS.map((f) => hash(entry[f])) : [hash(entry)]);
const current = Object.fromEntries(Object.entries(results).map(([key, entry]) => [key, fingerprint(entry)]));

if (process.env.COACH_GOLDEN_WRITE === "1") {
  fs.mkdirSync("tests/fixtures", { recursive: true });
  fs.writeFileSync(GOLDEN, JSON.stringify({ fields: FIELDS, cases: current }));
  console.log(`coach-power-parity-test: registrati ${Object.keys(current).length} casi in ${GOLDEN}`);
  process.exit(0);
}
const golden = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));
assert.deepStrictEqual(golden.fields, FIELDS, "stessi campi del riferimento");
assert.deepStrictEqual(Object.keys(current).sort(), Object.keys(golden.cases).sort(), "stessi casi del riferimento");
let differences = 0;
for (const [key, prints] of Object.entries(golden.cases)) {
  prints.forEach((print, index) => {
    if (current[key][index] === print) return;
    if (differences < 10) console.error(`DIVERSO ${key} ${prints.length > 1 ? FIELDS[index] : ""}: ${JSON.stringify(
      prints.length > 1 ? results[key][FIELDS[index]] : results[key]).slice(0, 300)}`);
    differences += 1;
  });
}
assert.strictEqual(differences, 0, `${differences} risultati diversi dal comportamento di prima`);
console.log(`coach-power-parity-test: PASS (${Object.keys(golden.cases).length} casi identici)`);
