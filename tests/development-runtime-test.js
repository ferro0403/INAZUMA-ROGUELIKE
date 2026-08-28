"use strict";

const assert = require("assert");
const progression = require("../js/roguelike_progression.js");
global.InazumaProgression = progression;
const DevelopmentV2 = require("../js/development-v2.js");
const DevelopmentV3 = require("../js/development-v3.js");
require("../js/development-v3-migration.js");
const Runtime = require("../js/development-runtime.js");
const database = require("../data/FREE_AGENTS_compact.json");
Runtime.registerDatabase("free-agents", database);

function empty() {
  return { schemaVersion: 7, coins: 0, legacyCups: 0, cupsBySeason: Object.fromEntries(DevelopmentV2.SEASON_IDS.map((id) => [id, 0])), projects: Object.fromEntries(DevelopmentV2.PROJECT_RARITIES.map((id) => [id, 0])), legacyProjectBuild: Object.fromEntries(DevelopmentV2.PROJECT_RARITIES.map((id) => [id, 0])), unlockedEmblems: [], players: {}, evolutionHistory: [], redeemedRunIds: [], victoryRewardRunIds: [] };
}
function addEvolution(state, base, targets) {
  let fromPotential = Number(base.finalOverall), fromRarity = base.category;
  targets.forEach(([toRarity, toPotential], index) => {
    state.evolutionHistory.push({ id: `${base.playerId}-${index}`, playerId: String(base.playerId), fromRarity, toRarity, fromPotential, toPotential, projectsConsumed: 0, cupsConsumed: 0, cupsConsumedBySource: {}, coinsConsumed: 0, timestamp: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z` });
    fromPotential = toPotential; fromRarity = toRarity;
  });
  state.players[String(base.playerId)] = { permanentTargetPotential: fromPotential, currentPermanentRarity: fromRarity };
}
const fixture = (role) => database.players.find((player) => player.position === role && player.category === "Normale");
const projection = (player) => ({ level: player.level, overall: player.overall, potential: player.potential, category: player.category, stats: player.stats });
const fixtureRatings = { attack: 4, control: 6, speed: 6, grit: 7, physical: 7, stamina: 6, defense: 7, save: 1 };

// Empty accounts produce a canonical, deterministic dual snapshot.
{
  const one = Runtime.buildRunSnapshot({ v2State: empty() }), two = Runtime.buildRunSnapshot({ v2State: empty() });
  assert.deepStrictEqual(one, two);
  assert.deepStrictEqual(one.developmentV3PlayerSnapshot, { schemaVersion: 1, profileFormatVersion: 1, players: {} });
  assert.deepStrictEqual(one.developmentPlayerSnapshot, {});
}

// A paid Debole -> Normale migration freezes only the active migration-only
// baseline profile. It consumes no coloured step and remains exact V2 parity.
{
  const base = { playerId: "runtime-legacy-normale", name: "Legacy Normale", position: "DF", normalizedRole: "DF", category: "Debole", maxLevel: 20, finalOverall: 66, ratings: fixtureRatings };
  const legacyDatabase = { players: [base], compactFormat: database.compactFormat };
  Runtime.registerDatabase("legacy-normale-fixture", legacyDatabase);
  const state = empty(); addEvolution(state, base, [["Normale", 70]]);
  const converted = global.DevelopmentV3Migration.convertState({ v2State: state, resolveBasePlayer: Runtime.resolveBasePlayer, database: legacyDatabase, progression });
  assert(converted.ok); assert(converted.state.players[base.playerId].legacyNormale); assert.deepStrictEqual(converted.state.players[base.playerId].steps, []);
  const snapshots = Runtime.buildRunSnapshot({ v2State: state, database: legacyDatabase });
  const entry = snapshots.developmentV3PlayerSnapshot.players[base.playerId];
  assert.deepStrictEqual(Object.keys(entry), ["profile"]); assert.equal(entry.profile.category, "Normale"); assert.equal(entry.profile.finalOverall, 70);
  const frozenV2 = JSON.stringify(snapshots.developmentPlayerSnapshot[base.playerId]);
  state.players[base.playerId].permanentTargetPotential = 80;
  assert.equal(JSON.stringify(snapshots.developmentPlayerSnapshot[base.playerId]), frozenV2);
  for (let level = 0; level <= 20; level += 1) {
    const expected = progression.getPlayerAtLevel(base, level, legacyDatabase, DevelopmentV2.optionsFromUpgrade(base, { permanentTargetPotential: 70 }));
    const actual = Runtime.resolvePlayer(snapshots, base, level, legacyDatabase);
    assert.deepStrictEqual(projection(actual), projection(expected), `legacyNormale/Lv${level}`);
    assert.equal(actual.category, "Normale"); assert.equal(actual.potential, 70);
  }
}

// A naturally Buono player advances directly to Forte without an invented
// intermediate step and freezes the active Forte profile.
{
  const base = database.players.find((player) => player.category === "Buono");
  assert(base); const state = empty(); addEvolution(state, base, [["Forte", 80]]);
  const converted = global.DevelopmentV3Migration.convertState({ v2State: state, resolveBasePlayer: Runtime.resolveBasePlayer, database, progression });
  assert(converted.ok); assert.equal(converted.state.players[base.playerId].legacyNormale, null); assert.deepStrictEqual(converted.state.players[base.playerId].steps.map((step) => step.rarity), ["Forte"]);
  const snapshots = Runtime.buildRunSnapshot({ v2State: state });
  assert.equal(snapshots.developmentV3PlayerSnapshot.players[base.playerId].profile.category, "Forte");
}

// Paid and natural chains keep only their active profile, across all four roles,
// while the compatibility snapshot remains exact Lv0..Lv20 V2 parity.
{
  const state = empty(), roles = ["GK", "DF", "MF", "FW"];
  for (const role of roles) {
    const base = fixture(role);
    addEvolution(state, base, [["Buono", 75], ["Forte", 80]]);
  }
  const snapshots = Runtime.buildRunSnapshot({ v2State: state });
  assert.equal(Object.keys(snapshots.developmentV3PlayerSnapshot.players).length, 4);
  for (const role of roles) {
    const base = fixture(role), id = String(base.playerId), entry = snapshots.developmentV3PlayerSnapshot.players[id];
    assert(entry?.profile); assert.equal(entry.profile.category, "Forte"); assert.deepStrictEqual(Object.keys(entry), ["profile"]);
    const run = { ...snapshots };
    for (let level = 0; level <= 20; level += 1) {
      const expected = progression.getPlayerAtLevel(base, level, database, DevelopmentV2.optionsFromUpgrade(base, state.players[id]));
      assert.deepStrictEqual(projection(Runtime.resolvePlayer(run, base, level, database)), projection(expected), `${role}/Lv${level}`);
    }
  }
}

// V3 wins over an incompatible frozen V2 copy and playback never calls a solver.
{
  const base = fixture("GK"), state = empty(); addEvolution(state, base, [["Buono", 75]]);
  const snapshots = Runtime.buildRunSnapshot({ v2State: state });
  snapshots.developmentPlayerSnapshot[String(base.playerId)].permanentTargetPotential = 95;
  const original = progression.getPlayerAtLevel;
  progression.getPlayerAtLevel = () => { throw new Error("solver called"); };
  try { for (let level = 0; level <= 20; level += 1) assert.equal(Runtime.resolvePlayer(snapshots, base, level, database).category, "Buono"); }
  finally { progression.getPlayerAtLevel = original; }
}

// Snapshot validation is the one expensive boundary. Once cached, runtime V3
// playback uses only the already-validated, requested-level decoder.
{
  const base = fixture("GK"), state = empty(); addEvolution(state, base, [["Buono", 75]]);
  const originalValidate = DevelopmentV3.validateProfile;
  let validations = 0;
  DevelopmentV3.validateProfile = (...args) => { validations += 1; return originalValidate(...args); };
  const snapshots = Runtime.buildRunSnapshot({ v2State: state });
  const boundaryCount = validations;
  assert(boundaryCount > 0);
  const originalStrict = DevelopmentV3.resolveMaterializedPlayer;
  DevelopmentV3.validateProfile = () => { throw new Error("full profile validation repeated"); };
  DevelopmentV3.resolveMaterializedPlayer = () => { throw new Error("strict resolver entered"); };
  try {
    for (let pass = 0; pass < 3; pass += 1) for (let level = 0; level <= 20; level += 1) Runtime.resolvePlayer(snapshots, base, level, database);
    assert.equal(validations, boundaryCount);
  } finally {
    DevelopmentV3.validateProfile = originalValidate;
    DevelopmentV3.resolveMaterializedPlayer = originalStrict;
  }
}

// Legacy-only runs retain the production V2 oracle; malformed claimed V3 is a
// deterministic error and never falls through to either V2 or account state.
{
  const base = fixture("DF"), upgrade = { permanentTargetPotential: 80 }, legacy = { developmentPlayerSnapshot: { [base.playerId]: upgrade } };
  let calls = 0, original = progression.getPlayerAtLevel;
  progression.getPlayerAtLevel = (...args) => { calls += 1; return original(...args); };
  try { assert.deepStrictEqual(projection(Runtime.resolvePlayer(legacy, base, 7, database)), projection(original(base, 7, database, DevelopmentV2.optionsFromUpgrade(base, upgrade)))); }
  finally { progression.getPlayerAtLevel = original; }
  assert.equal(calls, 1);
  const corrupt = { ...legacy, developmentV3PlayerSnapshot: { schemaVersion: 1, profileFormatVersion: 1, players: { [base.playerId]: { profile: {} } } } };
  assert.throws(() => Runtime.resolvePlayer(corrupt, base, 0, database), (error) => error instanceof Runtime.DevelopmentSnapshotError && error.code === "development-v3-snapshot-invalid");
}

// A single frozen source read makes both snapshots. Later account replacement
// cannot affect Run A; Run B captures the later evolution.
{
  const base = fixture("MF"), a = empty(); addEvolution(a, base, [["Buono", 75]]);
  const b = empty(); addEvolution(b, base, [["Buono", 75], ["Forte", 80]]);
  let current = a, reads = 0; const originalRead = DevelopmentV2.read;
  DevelopmentV2.read = () => { reads += 1; return JSON.parse(JSON.stringify(current)); };
  try {
    const runA = Runtime.buildRunSnapshot(); current = b;
    assert.equal(Runtime.resolvePlayer(runA, base, 20, database).category, "Buono");
    const runB = Runtime.buildRunSnapshot();
    assert.equal(Runtime.resolvePlayer(runB, base, 20, database).category, "Forte"); assert.equal(reads, 2);
  } finally { DevelopmentV2.read = originalRead; }
}

// Missing immutable records block all-or-nothing creation.
{
  const state = empty(); state.players.missing = { permanentTargetPotential: 75, currentPermanentRarity: "Buono" }; state.evolutionHistory.push({ id: "x", playerId: "missing", fromRarity: "Normale", toRarity: "Buono", fromPotential: 70, toPotential: 75, projectsConsumed: 0, cupsConsumed: 0, cupsConsumedBySource: {}, coinsConsumed: 0 });
  assert.throws(() => Runtime.buildRunSnapshot({ v2State: state }), Runtime.DevelopmentSnapshotError);
}

// Synthetic 100-player fixture locks the real serialized footprint.
{
  const candidates = database.players.filter((player) => ["Normale", "Buono", "Forte", "Elite", "Mondiale"].includes(player.category)).slice(0, 100);
  assert.equal(candidates.length, 100);
  const state = empty();
  for (const base of candidates) { const target = DevelopmentV2.nextRarity(base.category), potential = DevelopmentV2.threshold(target); addEvolution(state, base, [[target, potential]]); }
  const bytes = Buffer.byteLength(JSON.stringify(Runtime.buildRunSnapshot({ v2State: state }).developmentV3PlayerSnapshot));
  assert(bytes > 0); console.log(`development-runtime-test: 100-player snapshot ${bytes} bytes`);
}

// Incompatible duplicate immutable records are never guessed.
{
  const base = fixture("GK"), incompatible = { players: [{ ...base, finalOverall: base.finalOverall + 1 }] };
  Runtime.registerDatabase("incompatible", incompatible);
  assert.throws(() => Runtime.resolveBasePlayer(base.playerId), (error) => error.code === "ambiguous-base-player");
}

console.log("development-runtime-test: ok");
