"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const orion = require("../data/ORION_season_compact.json");
const storage = new BudgetStorage(Infinity);
const run = { runId: "gameover-quota-order", seasonId: "orion", lives: 0, gameOver: true, phase: "map", bossIndex: 2, completedBossIds: orion.bossOrder.slice(0, 2).map(x => x.teamId), roster: [], lineup: [], bench: [], inventory: [], statistics: {}, teamIdentity: { name: "Raimon" } };
let runtime = load(storage, { run, seasonDb: orion });
storage.budget = storage.bytes();
assert.doesNotThrow(() => runtime.seam.renderGameOver(), "the fail-stop boundary owns and reports the persistence failure");
assert.equal(runtime.context.RunState.load("orion").phase, "map");
assert(!runtime.context.DevelopmentV2.read().redeemedRunIds.includes(run.runId));
storage.budget = Infinity;
runtime = runtime.reopen({ seasonDb: orion });
runtime.seam.getRun().gameOver = true;
runtime.seam.renderGameOver();
runtime = runtime.reopen({ seasonDb: orion });
assert.equal(runtime.canonical.phase, "gameover");
assert.equal(runtime.context.DevelopmentV2.read().redeemedRunIds.filter(id => id === run.runId).length, 1);
runtime.seam.renderGameOver();
assert.equal(runtime.context.DevelopmentV2.read().redeemedRunIds.filter(id => id === run.runId).length, 1);

// A legacy canonical game-over without an outbox entry must remain visibly pending
// when the terminal enqueue cannot be saved; it cannot expose New Run/Menu as if paid.
const legacyStorage = new BudgetStorage(Infinity);
const legacyRun = { ...run, runId: "legacy-gameover-missing-effect", phase: "gameover", permanentEffectOutbox: [] };
let legacyRuntime = load(legacyStorage, { run: legacyRun, seasonDb: orion });
legacyStorage.budget = legacyStorage.bytes();
legacyRuntime.seam.renderGameOver();
assert.match(legacyRuntime.seam.getAppMarkup(), /FINALIZZAZIONE NON SALVATA/);
assert.doesNotMatch(legacyRuntime.seam.getAppMarkup(), /NUOVA RUN|id="home"/);
assert(!legacyRuntime.context.DevelopmentV2.read().redeemedRunIds.includes(legacyRun.runId));
legacyStorage.budget = Infinity;
legacyRuntime.seam.renderGameOver();
assert.equal(legacyRuntime.context.DevelopmentV2.read().redeemedRunIds.filter(id => id === legacyRun.runId).length, 1);
console.log("gameover canonical-save ordering and retry: ok");
