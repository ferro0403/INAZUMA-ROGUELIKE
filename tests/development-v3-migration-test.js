"use strict";

const assert = require("assert");
const { webcrypto } = require("crypto");
const progression = require("../js/roguelike_progression.js");
global.InazumaProgression = progression;
const DevelopmentV2 = require("../js/development-v2.js");
const DevelopmentV3 = require("../js/development-v3.js");
const Migration = require("../js/development-v3-migration.js");
const cloud = require("../js/cloud-save-core.js");

const database = { compactFormat: { levelMax: 20, codeWidth: 2, statOrder: [...DevelopmentV3.STAT_ORDER] } };
const ratings = {
  GK: { attack: 1, control: 5, speed: 4, grit: 6, physical: 6, stamina: 4, defense: 6, save: 7 },
  DF: { attack: 4, control: 6, speed: 6, grit: 7, physical: 7, stamina: 6, defense: 7, save: 1 },
  MF: { attack: 6, control: 7, speed: 7, grit: 7, physical: 6, stamina: 7, defense: 6, save: 1 },
  FW: { attack: 7, control: 6, speed: 7, grit: 6, physical: 6, stamina: 6, defense: 3, save: 1 },
};
function base(id, role, potential) {
  return { playerId: id, id, name: `Fixture ${id}`, position: role, normalizedRole: role, element: "Wind", category: progression.categoryForPotential(potential), maxLevel: 20, finalOverall: potential, ratings: ratings[role] };
}
const bases = {
  normale: base("normale", "GK", 70), debole: base("debole", "DF", 66), scarso: base("scarso", "MF", 64),
  buono: base("buono", "FW", 75), elite: base("elite", "GK", 85),
};
const resolveBasePlayer = (id) => bases[id] || null;
function canonical() {
  return {
    schemaVersion: 7, coins: 123, legacyCups: 0, cupsBySeason: { ie1: 3, ie1_s2: 2, ie1_s3: 0, ie2: 1, orion: 0 },
    projects: { Buono: 4, Forte: 3, Elite: 2, Mondiale: 1, Leggenda: 0 }, legacyProjectBuild: { Buono: 0, Forte: 0, Elite: 0, Mondiale: 0, Leggenda: 0 },
    unlockedEmblems: ["a"], players: {}, evolutionHistory: [], redeemedRunIds: ["r"], victoryRewardRunIds: ["v"],
  };
}
function evolution(playerId, fromRarity, toRarity, fromPotential, toPotential, ordinal, overrides = {}) {
  return { id: `evo-${playerId}-${ordinal}`, playerId, playerNameSnapshot: "must not migrate", fromRarity, toRarity, fromPotential, toPotential,
    projectsConsumed: toRarity === "Normale" ? 0 : 1, cupsConsumed: ordinal, cupsConsumedBySource: ordinal ? { ie1_s2: ordinal } : {}, coinsConsumed: 100 * (ordinal + 1), timestamp: `2025-01-0${ordinal + 1}T00:00:00.000Z`, ...overrides };
}
function addChain(state, playerId, transitions) {
  state.evolutionHistory.push(...transitions.map((transition, index) => evolution(playerId, ...transition, index)));
  const last = transitions.at(-1);
  state.players[playerId] = { permanentTargetPotential: last[3], permanentPotentialBoost: last[3] - bases[playerId].finalOverall, currentPermanentRarity: last[1], evolutionCount: transitions.length, updatedAt: "2025-01-09T00:00:00.000Z" };
}
function convert(state) { return Migration.convertState({ v2State: state, resolveBasePlayer, database, progression, DevelopmentV2, DevelopmentV3 }); }
function active(chain) { return chain.steps.at(-1)?.profile || chain.legacyNormale?.profile || null; }
function gameplay(resolved) { return { level: resolved.level, overall: resolved.overall, potential: resolved.potential, category: resolved.category, stats: resolved.stats }; }

// A: canonical empty state and resource copying are deterministic and exact.
{
  const source = canonical(), one = convert(source), two = convert(source);
  assert(one.ok); assert.deepStrictEqual(one, two); assert.deepStrictEqual(one.state.players, {});
  for (const key of ["coins", "cupsBySeason", "projects", "unlockedEmblems", "redeemedRunIds", "victoryRewardRunIds"]) assert.deepStrictEqual(one.state[key], source[key]);
}

// B-G and H: natural and paid-Normale chains across all gameplay roles.
{
  const state = canonical();
  addChain(state, "normale", [["Normale", "Buono", 70, 75], ["Buono", "Forte", 75, 80]]);
  addChain(state, "debole", [["Debole", "Normale", 66, 70]]);
  addChain(state, "scarso", [["Scarso", "Normale", 64, 70], ["Normale", "Buono", 70, 75], ["Buono", "Forte", 75, 80]]);
  addChain(state, "buono", [["Buono", "Forte", 75, 80]]);
  addChain(state, "elite", [["Elite", "Mondiale", 85, 90]]);
  const result = convert(state); assert(result.ok, JSON.stringify(result.blockers));
  assert.equal(result.state.players.normale.legacyNormale, null); assert.deepStrictEqual(result.state.players.normale.steps.map((step) => step.rarity), ["Buono", "Forte"]);
  assert(result.state.players.debole.legacyNormale); assert.deepStrictEqual(result.state.players.debole.steps, []);
  assert(result.state.players.scarso.legacyNormale); assert.deepStrictEqual(result.state.players.scarso.steps.map((step) => step.rarity), ["Buono", "Forte"]);
  assert.equal(result.state.players.scarso.steps[0].fromRarity, "Normale"); assert.equal(result.state.players.scarso.steps[0].fromPotential, 70);
  assert.equal(result.state.players.buono.legacyNormale, null); assert.deepStrictEqual(result.state.players.buono.steps.map((step) => step.rarity), ["Forte"]);
  assert.equal(result.state.players.elite.legacyNormale, null); assert.deepStrictEqual(result.state.players.elite.steps.map((step) => step.rarity), ["Mondiale"]);
  for (const [id, chain] of Object.entries(result.state.players)) {
    const profile = active(chain), upgrade = state.players[id], options = DevelopmentV2.optionsFromUpgrade(bases[id], upgrade);
    for (let level = 0; level <= 20; level += 1) assert.deepStrictEqual(gameplay(DevelopmentV3.resolveMaterializedPlayer(bases[id], profile, level)), gameplay(progression.getPlayerAtLevel(bases[id], level, database, options)), `${id}/Lv${level}`);
    assert(!JSON.stringify(chain).includes("must not migrate"));
  }
}

// D separately locks the paid Normale -> one colored step representation.
{
  const state = canonical(); addChain(state, "debole", [["Debole", "Normale", 66, 70], ["Normale", "Buono", 70, 75]]);
  const chain = convert(state).state.players.debole; assert(chain.legacyNormale); assert.deepStrictEqual(chain.steps.map((step) => step.rarity), ["Buono"]);
}

// I/J: exact receipts survive; only unusable legacy attribution falls back to IE1.
{
  const state = canonical();
  addChain(state, "normale", [["Normale", "Buono", 70, 75]]);
  state.evolutionHistory[0] = evolution("normale", "Normale", "Buono", 70, 75, 0, { coinsConsumed: 987, cupsConsumed: 3, cupsConsumedBySource: { orion: 1, ie2: 2 }, projectsConsumed: 4 });
  let step = convert(state).state.players.normale.steps[0]; assert.deepStrictEqual(step.receipt, { coinsConsumed: 987, cupsConsumed: 3, cupsConsumedBySource: { ie2: 2, orion: 1 }, projectsConsumed: 4 });
  delete state.evolutionHistory[0].cupsConsumedBySource;
  step = convert(state).state.players.normale.steps[0]; assert.deepStrictEqual(step.receipt.cupsConsumedBySource, { ie1: 3 });
  state.evolutionHistory[0].cupsConsumedBySource = { ie1: 2 }; assert.equal(convert(state).ok, false, "a usable but mismatched distribution is never rewritten");
}

// K: legacy project-build progress is inert evidence, never owned projects.
{
  const zero = convert(canonical()).state; assert.equal(zero.migrationLegacy, undefined);
  const source = canonical(); source.legacyProjectBuild.Elite = 7; const migrated = convert(source).state;
  assert.equal(migrated.migrationLegacy.projectBuild.Elite, 7); assert.deepStrictEqual(migrated.projects, source.projects);
}

// Inactive history is classified but never activated.
{
  const state = canonical(); state.evolutionHistory.push(evolution("retired", "Normale", "Buono", 70, 75, 0));
  const result = convert(state); assert(result.ok); assert.deepStrictEqual(result.state.players, {}); assert.deepStrictEqual(result.ignoredHistory[0].playerId, "retired");
}

// L/M: every ambiguous or inconsistent active chain blocks the whole plan.
{
  const mutations = [
    (s) => { s.players.normale.permanentTargetPotential = 81; },
    (s) => { s.evolutionHistory.splice(1, 1); },
    (s) => { s.evolutionHistory[1].fromPotential = 74; },
    (s) => { s.evolutionHistory[1].fromRarity = "Normale"; },
    (s) => { s.evolutionHistory[1].toRarity = "Normale"; },
    (s) => { s.evolutionHistory[1].toPotential = 74; },
  ];
  for (const mutate of mutations) { const state = canonical(); addChain(state, "normale", [["Normale", "Buono", 70, 75], ["Buono", "Forte", 75, 80]]); mutate(state); const result = convert(state); assert.equal(result.ok, false); assert.equal(result.state, null); }
  const state = canonical(); addChain(state, "normale", [["Normale", "Buono", 70, 75]]); assert.equal(Migration.convertState({ v2State: state, resolveBasePlayer: () => null, database, progression, DevelopmentV2, DevelopmentV3 }).ok, false);
}

// Persisted/cloud validation is total: malformed legacyNormale children are
// validation errors, never exceptions, and normalize/validate remain pure and
// deterministic for the same malformed input.
{
  const malformedValues = [
    { profile: null },
    { profile: 7 },
    { receipt: null },
    { profile: null, name: "duplicated identity shape" },
  ];
  for (const overrides of malformedValues) {
    const raw = DevelopmentV3.empty();
    raw.players.malformed = { legacyNormale: {
      migrationId: "legacy-malformed", fromRarity: "Debole", fromPotential: 66, toPotential: 70,
      profile: {}, receipt: { coinsConsumed: 0, cupsConsumed: 0, cupsConsumedBySource: {}, projectsConsumed: 0 }, ...overrides,
    }, steps: [] };
    const before = JSON.stringify(raw);
    let first, second;
    assert.doesNotThrow(() => { first = DevelopmentV3.validate(raw); second = DevelopmentV3.validate(raw); });
    assert.equal(first.valid, false); assert.deepStrictEqual(first, second); assert.equal(JSON.stringify(raw), before);
    const normalizedOne = DevelopmentV3.normalize(raw), normalizedTwo = DevelopmentV3.normalize(raw);
    assert.deepStrictEqual(normalizedOne, normalizedTwo); assert.equal(JSON.stringify(raw), before);
    assert.doesNotThrow(() => DevelopmentV3.validate(normalizedOne));
  }
}

class Storage {
  constructor() { this.map = new Map(); this.writes = 0; this.onRead = null; }
  getItem(key) { const value = this.map.has(key) ? this.map.get(key) : null; if (this.onRead) this.onRead(key); return value; }
  setItem(key, value) { this.writes += 1; this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
function withStored(raw, body) {
  const previous = { storage: global.localStorage, guard: global.PersistenceRecoveryGuard, dispatch: global.dispatchEvent, event: global.CustomEvent };
  const storage = new Storage(); if (raw != null) storage.map.set(DevelopmentV2.STORAGE_KEY, raw);
  let reserves = 0, events = 0, blocked = false;
  global.localStorage = storage;
  global.PersistenceRecoveryGuard = { isBlocked: () => blocked, assertWritable: () => { if (blocked) throw Object.assign(new Error("blocked"), { code: "restore-recovery-required" }); }, reserve: () => { reserves += 1; } };
  global.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  global.dispatchEvent = (event) => { if (event.type === "inazuma:local-save-committed") events += 1; };
  const restore = () => { global.localStorage = previous.storage; global.PersistenceRecoveryGuard = previous.guard; global.dispatchEvent = previous.dispatch; global.CustomEvent = previous.event; };
  try {
    const result = body({ storage, setBlocked: (value) => { blocked = value; }, counts: () => ({ reserves, events }) });
    if (result && typeof result.then === "function") return result.finally(restore);
    restore(); return result;
  } catch (error) { restore(); throw error; }
}
const storedOptions = { resolveBasePlayer, database, progression, DevelopmentV2, DevelopmentV3 };

// N: recovery fencing precedes normalization, reservations, writes and events.
withStored(JSON.stringify(canonical()), ({ storage, setBlocked, counts }) => {
  setBlocked(true); const before = storage.getItem(DevelopmentV2.STORAGE_KEY), writes = storage.writes; const result = Migration.migrateStoredState(storedOptions);
  assert(result.deferred); assert.equal(storage.getItem(DevelopmentV2.STORAGE_KEY), before); assert.equal(storage.writes, writes); assert.deepStrictEqual(counts(), { reserves: 0, events: 0 });
});

// O: mutation during planning is a stale-source conflict with no migration commit.
withStored(JSON.stringify(canonical()), ({ storage, counts }) => {
  let calls = 0; const resolver = (id) => resolveBasePlayer(id); const source = canonical(); addChain(source, "normale", [["Normale", "Buono", 70, 75]]); storage.map.set(DevelopmentV2.STORAGE_KEY, JSON.stringify(source));
  storage.onRead = (key) => { if (key === DevelopmentV2.STORAGE_KEY && ++calls === 2) storage.map.set(key, `${storage.map.get(key)} `); };
  const result = Migration.migrateStoredState({ ...storedOptions, resolveBasePlayer: resolver }); assert.equal(result.reason, "development-v3-migration-stale"); assert.deepStrictEqual(counts(), { reserves: 0, events: 0 });
});

function shadowedSource({ conflicting = false, malformed = false } = {}) {
  const source = canonical();
  const candidate = convert(source).state;
  if (conflicting) candidate.coins += 1;
  if (malformed) candidate.players.bad = { legacyNormale: { migrationId: "bad", fromRarity: "Debole", fromPotential: 66, toPotential: 70, profile: null, receipt: null }, steps: [] };
  source.developmentV3 = candidate;
  return source;
}

// The immutable-source proof precedes every existing-shadow decision: stale
// wins over both idempotence and conflict/future/malformed shadow handling.
for (const source of [shadowedSource(), shadowedSource({ conflicting: true })]) withStored(JSON.stringify(source), ({ storage, counts }) => {
  let reads = 0;
  storage.onRead = (key) => { if (key === DevelopmentV2.STORAGE_KEY && ++reads === 2) storage.map.set(key, `${storage.map.get(key)} `); };
  const writes = storage.writes, result = Migration.migrateStoredState(storedOptions);
  assert.equal(result.reason, "development-v3-migration-stale"); assert.equal(storage.writes, writes); assert.deepStrictEqual(counts(), { reserves: 0, events: 0 });
});

// A malformed existing V3 shadow is rejected normally rather than escaping
// validate() as an exception.
withStored(JSON.stringify(shadowedSource({ malformed: true })), ({ storage, counts }) => {
  const writes = storage.writes; let result;
  assert.doesNotThrow(() => { result = Migration.migrateStoredState(storedOptions); });
  assert.equal(result.reason, "development-v3-migration-conflict"); assert.equal(storage.writes, writes); assert.deepStrictEqual(counts(), { reserves: 0, events: 0 });
});

// P/Q/R and successful single-write semantics, including a raw legacy V2 payload.
withStored(JSON.stringify({ schemaVersion: 4, coins: 9, cups: 2, projectBuild: { Elite: 3 } }), ({ storage, counts }) => {
  const beforeWrites = storage.writes; const first = Migration.migrateStoredState(storedOptions); assert(first.ok && first.migrated);
  assert.equal(storage.writes - beforeWrites, 1, "exactly one Development-sector write is performed");
  assert.deepStrictEqual(counts(), { reserves: 1, events: 1 });
  const bytes = storage.getItem(DevelopmentV2.STORAGE_KEY), parsed = JSON.parse(bytes); assert.equal(parsed.cupsBySeason.ie1, 2); assert.equal(parsed.developmentV3.migrationLegacy.projectBuild.Elite, 3);
  const writes = storage.writes, again = Migration.migrateStoredState(storedOptions); assert(again.ok && !again.migrated); assert.equal(storage.writes, writes); assert.deepStrictEqual(counts(), { reserves: 1, events: 1 });
  parsed.developmentV3.coins += 1; storage.map.set(DevelopmentV2.STORAGE_KEY, JSON.stringify(parsed)); assert.equal(Migration.migrateStoredState(storedOptions).reason, "development-v3-migration-conflict");
  parsed.developmentV3.schemaVersion = 99; storage.map.set(DevelopmentV2.STORAGE_KEY, JSON.stringify(parsed)); assert.equal(Migration.migrateStoredState(storedOptions).reason, "development-v3-schema-conflict");
});

// Caller-provided writeOptions are intentionally ignored: neither readOnly nor
// suppressCloudEvent can weaken the normal guarded Development write contract.
for (const writeOptions of [{ readOnly: true }, { restoreOwnershipToken: "foreign", suppressCloudEvent: true }]) withStored(JSON.stringify(canonical()), ({ storage, counts }) => {
  const writes = storage.writes;
  const result = Migration.migrateStoredState({ ...storedOptions, writeOptions });
  assert(result.ok && result.migrated); assert.equal(storage.writes - writes, 1); assert.deepStrictEqual(counts(), { reserves: 1, events: 1 });
});

// Invalid bytes and missing active base/history perform no Development write.
for (const raw of ["{bad", JSON.stringify({ players: { missing: { permanentTargetPotential: 80, currentPermanentRarity: "Forte" } } })]) withStored(raw, ({ storage }) => {
  const writes = storage.writes, result = Migration.migrateStoredState(storedOptions); assert.equal(result.ok, false); assert.equal(storage.writes, writes);
});

// S/T: DevelopmentV2's generic unknown-field preservation carries the shadow
// byte-for-byte through read/write and current cloud snapshot preparation.
(async () => {
  await withStored(JSON.stringify(canonical()), async ({ storage }) => {
    const migrated = Migration.migrateStoredState(storedOptions); assert(migrated.ok);
    const shadow = migrated.state, read = DevelopmentV2.read(); assert.deepStrictEqual(read.developmentV3, shadow);
    DevelopmentV2.write(read, { suppressCloudEvent: true }); assert.deepStrictEqual(DevelopmentV2.read().developmentV3, shadow);
    const snapshot = { profile: {}, runs: { ie1: null, ie2: null, ie1_s2: null, ie1_s3: null, orion: null }, album: {}, development: DevelopmentV2.read(), hallOfFame: { archiveSchemaVersion: 1, updatedAt: null, teams: [], index: [] }, runProvenance: {} };
    const writes = storage.writes, one = await cloud.prepareSnapshot(snapshot, webcrypto), two = await cloud.prepareSnapshot(snapshot, webcrypto);
    assert.deepStrictEqual(one.payloads.development.developmentV3, shadow); assert.deepStrictEqual(one.payloads.development, two.payloads.development); assert.equal(storage.writes, writes);
  });

  // U/V: after migration, all 21 levels decode without any solver.
  const source = canonical(); addChain(source, "debole", [["Debole", "Normale", 66, 70], ["Normale", "Buono", 70, 75]]);
  const result = convert(source), profile = active(result.state.players.debole), expected = Array.from({ length: 21 }, (_, level) => gameplay(DevelopmentV3.resolveMaterializedPlayer(bases.debole, profile, level)));
  const original = progression.getPlayerAtLevel; progression.getPlayerAtLevel = () => { throw new Error("solver disabled"); };
  try { for (let level = 0; level <= 20; level += 1) assert.deepStrictEqual(gameplay(DevelopmentV3.resolveMaterializedPlayer(bases.debole, profile, level)), expected[level]); }
  finally { progression.getPlayerAtLevel = original; }
  console.log("development-v3-migration-test: deterministic guarded V2 shadow migration OK");
})().catch((error) => { console.error(error); process.exit(1); });
