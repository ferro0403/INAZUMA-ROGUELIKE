"use strict";

const assert = require("assert");
const fs = require("fs");
const progression = require("../js/roguelike_progression.js");
const DevelopmentV2 = require("../js/development-v2.js");
const DevelopmentV3 = require("../js/development-v3.js");
const Migration = require("../js/development-v3-migration.js");
global.DevelopmentV2 = DevelopmentV2;
global.DevelopmentV3 = DevelopmentV3;
global.DevelopmentV3Migration = Migration;
global.InazumaProgression = progression;
const Runtime = require("../js/development-runtime.js");

const ratings = { attack: 6, control: 6, speed: 6, grit: 6, physical: 6, stamina: 6, defense: 6, save: 6 };
const database = { compactFormat: { levelMax: 20 }, players: [] };
for (const [index, role] of ["GK", "DF", "MF", "FW"].entries()) database.players.push({ playerId: `pr4-${role}`, name: role, position: role, category: "Normale", finalOverall: 74 + index, maxLevel: 20, ratings });
Runtime.registerDatabase("pr4-consumers", database);
const evolutionHistory = database.players.flatMap((player, index) => [
  { id: `receipt-${player.playerId}-1`, playerId: player.playerId, fromRarity: "Normale", toRarity: "Buono", fromPotential: player.finalOverall, toPotential: 75 + index, projectsConsumed: 0, cupsConsumed: 0, cupsConsumedBySource: {}, coinsConsumed: 0, timestamp: "2026-08-27T00:00:00.000Z" },
  { id: `receipt-${player.playerId}-2`, playerId: player.playerId, fromRarity: "Buono", toRarity: "Forte", fromPotential: 75 + index, toPotential: 80 + index, projectsConsumed: 0, cupsConsumed: 0, cupsConsumedBySource: {}, coinsConsumed: 0, timestamp: "2026-08-28T00:00:00.000Z" },
]);
const state = { schemaVersion: 7, coins: 0, cupsBySeason: {}, projects: {}, evolutionHistory, players: Object.fromEntries(database.players.map((player, index) => [player.playerId, { permanentTargetPotential: 80 + index, currentPermanentRarity: "Forte" }])) };
const snapshots = Runtime.buildRunSnapshot({ v2State: state, database });
const v3Run = { ...snapshots };

const expected = new Map();
for (const player of database.players) {
  const values = Array.from({ length: 21 }, (_, level) => Runtime.resolvePlayer(v3Run, player, level, database));
  expected.set(player.playerId, values);
  assert(values.every((value) => value.category === "Forte"), `${player.position} Lv0..Lv20 card/runtime rarity`);
}

const originalOptions = DevelopmentV2.optionsFromUpgrade;
DevelopmentV2.optionsFromUpgrade = () => { throw new Error("old permanent solver called"); };
try {
  delete v3Run.developmentPlayerSnapshot;
  for (const player of database.players) for (let level = 0; level <= 20; level += 1) {
    assert.deepStrictEqual(Runtime.resolvePlayer(v3Run, player, level, database), expected.get(player.playerId)[level], `${player.position}/Lv${level} ignores compatibility V2`);
  }
  const player = database.players[3];
  assert.strictEqual(Runtime.resolveEffectiveMetadata(v3Run, player, database).category, "Forte", "pull/trade/legendary metadata uses V3");
  const entry = { playerId: player.playerId, level: 5, potentialBoost: 3, currentOverallBoost: 3, potentialBoostApplications: [{ amount: 3, appliedLevel: 5, codexDeltas: { attack: 1 } }], equippedItem: { stat: "speed", bonus: 2 } };
  const permanent = Runtime.resolvePlayer(v3Run, player, 5, database);
  const roster = Runtime.resolveRosterPlayer(v3Run, player, entry, database);
  assert.strictEqual(roster.potential, permanent.potential + 3, "Intensive Training layers once above V3 permanent potential");
  assert.strictEqual(roster.overall, permanent.overall + 3, "Intensive Training layers once above V3 permanent overall");
  assert.strictEqual(roster.stats.attack, permanent.stats.attack + 10, "only run-local codex delta layers above materialized stats");
  assert.deepStrictEqual(entry.equippedItem, { stat: "speed", bonus: 2 }, "equipment is not consumed or changed by DevelopmentRuntime");
} finally { DevelopmentV2.optionsFromUpgrade = originalOptions; }

const legacyPlayer = database.players[0];
const legacyRun = { developmentPlayerSnapshot: { [legacyPlayer.playerId]: state.players[legacyPlayer.playerId] } };
assert.deepStrictEqual(
  Runtime.resolvePlayer(legacyRun, legacyPlayer, 7, database),
  progression.getPlayerAtLevel(legacyPlayer, 7, database, DevelopmentV2.optionsFromUpgrade(legacyPlayer, state.players[legacyPlayer.playerId])),
  "V2-only frozen runs retain exact playback"
);
const legacyEntries = [
  { name: "aggregate-only", entry: { potentialBoost: 6, currentOverallBoost: 6 } },
  { name: "normalized-legacy", entry: { potentialBoost: 6, currentOverallBoost: 6, potentialBoostApplications: [{ amount: 6, appliedLevel: 0, legacy: true }] } },
  { name: "permanent-plus-codex-training", entry: { potentialBoost: 9, currentOverallBoost: 9, potentialBoostApplications: [{ amount: 6, appliedLevel: 0, permanent: true }, { amount: 3, appliedLevel: 4, codexDeltas: { defense: 1 } }] } },
  { name: "run-local-without-codex", entry: { potentialBoost: 9, currentOverallBoost: 9, potentialBoostApplications: [{ amount: 6, appliedLevel: 0, permanent: true }, { amount: 3, appliedLevel: 4 }] } },
];
for (const { name, entry } of legacyEntries) for (let level = 0; level <= 20; level += 1) {
  const expectedLegacy = progression.getPlayerAtLevel(legacyPlayer, level, database, entry);
  assert.deepStrictEqual(Runtime.resolveRosterPlayer(legacyRun, legacyPlayer, { ...entry, level }, database), expectedLegacy, `${name}/Lv${level} preserves pre-PR4 roster playback`);
}

const v3TrainingPlayer = database.players[0];
const v3TrainingRun = Runtime.buildRunSnapshot({ v2State: state, database });
const emptyTrainingEntry = { playerId: v3TrainingPlayer.playerId, level: 20, potentialBoost: 0, currentOverallBoost: 0, potentialBoostApplications: [] };
const trainingPlan = Runtime.planIntensiveTraining(v3TrainingRun, v3TrainingPlayer, emptyTrainingEntry, 3, database);
assert.strictEqual(v3TrainingPlayer.finalOverall, 74, "training fixture starts at immutable BASE 74");
assert.strictEqual(trainingPlan.permanentPotential, 80, "planner starts from frozen V3 permanent 80");
assert.strictEqual(trainingPlan.targetOverall, 83, "V3 Intensive Training targets permanent 80 + 3, never BASE 74 + 3");
const trainedEntry = { ...emptyTrainingEntry, potentialBoost: 3, currentOverallBoost: 3, potentialBoostApplications: [{ amount: 3, appliedLevel: 20, codexDeltas: trainingPlan.codexDeltas }] };
const trained = Runtime.resolveRosterPlayer(v3TrainingRun, v3TrainingPlayer, trainedEntry, database);
const permanentAtMax = Runtime.resolvePlayer(v3TrainingRun, v3TrainingPlayer, 20, database);
const expectedRatings = { ...progression.toCodexRatings(permanentAtMax.stats) };
for (const [stat, delta] of Object.entries(trainingPlan.codexDeltas)) expectedRatings[stat] += delta;
assert.strictEqual(trained.potential, 83);
assert.strictEqual(trained.overall, 83);
assert.deepStrictEqual(progression.toCodexRatings(trained.stats), expectedRatings, "resolved stats are the exact Codex 80 -> 83 run-local delta");

const pr3CopiedEntry = { playerId: v3TrainingPlayer.playerId, level: 20, potentialBoost: 9, currentOverallBoost: 9, potentialBoostApplications: [{ amount: 6, appliedLevel: 0, permanent: true }, { amount: 3, appliedLevel: 20, codexDeltas: trainingPlan.codexDeltas }] };
assert.deepStrictEqual(Runtime.resolveRosterPlayer(v3TrainingRun, v3TrainingPlayer, pr3CopiedEntry, database), trained, "PR3 copied permanent fields are ignored while run-local training layers once");
const serializedRun = JSON.parse(JSON.stringify({ ...v3TrainingRun, roster: [trainedEntry], checkpoint: { developmentV3PlayerSnapshot: v3TrainingRun.developmentV3PlayerSnapshot, roster: [trainedEntry] } }));
assert.deepStrictEqual(Runtime.resolveRosterPlayer(serializedRun, v3TrainingPlayer, serializedRun.roster[0], database), trained, "save/refresh/load preserves V3 runtime playback");
assert.deepStrictEqual(Runtime.resolveRosterPlayer(serializedRun.checkpoint, v3TrainingPlayer, serializedRun.checkpoint.roster[0], database), trained, "checkpoint restoration preserves V3 runtime playback");
const incompatible = Runtime.buildRunSnapshot({ v2State: state, database });
incompatible.developmentPlayerSnapshot[legacyPlayer.playerId].permanentTargetPotential = 99;
assert.strictEqual(Runtime.resolvePlayer(incompatible, legacyPlayer, 20, database).potential, 80, "V3 has precedence over incompatible V2 compatibility data");
assert.throws(() => Runtime.resolvePlayer({ developmentV3PlayerSnapshot: { schemaVersion: 1, profileFormatVersion: 1, players: { bad: { profile: {} } } } }, legacyPlayer, 0, database), /development-v3-snapshot-invalid/, "malformed claimed V3 fails deterministically");

const app = fs.readFileSync("js/app.js", "utf8");
const draft = fs.readFileSync("js/draft.js", "utf8");
for (const [file, source] of [["js/app.js", app], ["js/draft.js", draft]]) {
  assert(!/developmentPlayerSnapshot/.test(source), `${file} must not interpret the legacy snapshot`);
  assert(!/DevelopmentV2\.optionsFromUpgrade/.test(source.replace(/function albumPlayerView[\s\S]*?\n  }/, "").replace(/function renderEvolutionConfirmation[\s\S]*?\n  }/, "")), `${file} must not resolve run Development through V2`);
}
assert.match(app, /DevelopmentRuntime\.resolvePlayer\(run, player/, "cards and pull choices use DevelopmentRuntime");
assert.match(app, /DevelopmentRuntime\.resolveRosterPlayer/, "roster, lineup and match inputs share the runtime boundary");
assert.match(app, /DevelopmentRuntime\.resolveEffectiveMetadata/, "pull, legendary and trade eligibility use runtime metadata");
assert.match(app, /DevelopmentRuntime\.planIntensiveTraining\(current,trainingBase,currentEntry,addedBoost/, "production Intensive Training uses the real centralized runtime planner boundary");

console.log("development-runtime-consumers-test: V3/V2/base, roles, zero-solver, roster/training, pull/trade/legendary static guard OK");
