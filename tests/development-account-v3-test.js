"use strict";

const assert = require("assert");
const progression = require("../js/roguelike_progression.js");
global.InazumaProgression = progression;
const V2 = require("../js/development-v2.js");
const V3 = require("../js/development-v3.js");
const Migration = require("../js/development-v3-migration.js");
const Runtime = require("../js/development-runtime.js");
const Account = require("../js/development-account-v3.js");
const database = require("../data/FREE_AGENTS_compact.json");
Runtime.registerDatabase("free-agents", database);
const bases = database.players.filter((player) => V2.RARITIES.includes(player.category));
const syntheticScarso = { ...bases.find((player) => player.category === "Debole"), playerId: "pr5a-scarso", name: "PR5A Scarso", category: "Scarso", finalOverall: 64 };
const base = (rarity) => rarity === "Scarso" ? syntheticScarso : bases.find((player) => player.category === rarity);
const resolve = (id) => String(id) === syntheticScarso.playerId ? syntheticScarso : Runtime.resolveBasePlayer(id);

class Storage {
  constructor(raw = null) { this.value = raw; this.writes = 0; this.fail = false; this.afterRead = null; }
  getItem() { const value = this.value; if (this.afterRead) this.afterRead(); return value; }
  setItem(_key, value) { if (this.fail) throw new Error("disk-full"); this.value = String(value); this.writes += 1; }
}
function environment(raw, body) {
  const previous = { storage: global.localStorage, guard: global.PersistenceRecoveryGuard, dispatch: global.dispatchEvent, event: global.CustomEvent };
  const storage = new Storage(raw); let blocked = false, ownershipLost = false, reserves = 0, events = 0;
  global.localStorage = storage;
  global.PersistenceRecoveryGuard = { isBlocked: () => blocked, reserve: () => { reserves += 1; }, assertWritable: () => { if (blocked) throw Object.assign(new Error("blocked"), { code: "restore-recovery-required" }); if (ownershipLost) throw Object.assign(new Error("lost"), { code: "restore-ownership-lost" }); } };
  global.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  global.dispatchEvent = (event) => { if (event.type === "inazuma:local-save-committed") events += 1; };
  Account.resetSessionCache();
  try { return body({ storage, block: (value) => { blocked = value; }, lose: () => { ownershipLost = true; }, counts: () => ({ reserves, events }) }); }
  finally { Object.assign(global, { localStorage: previous.storage, PersistenceRecoveryGuard: previous.guard, dispatchEvent: previous.dispatch, CustomEvent: previous.event }); Account.resetSessionCache(); }
}
const options = { DevelopmentV2: V2, DevelopmentV3: V3, DevelopmentV3Migration: Migration, progression, database, resolveBasePlayer: resolve };
function legacy(wallet = {}) { return V2.normalize({ ...V2.empty(), ...wallet }); }
function input(player) { return { playerId: String(player.playerId), basePlayer: player, unlocked: true, freeAgentEligible: true, cupSelection: {} }; }
function canonicalChain(player, rarities) {
  const state = V3.empty(); let fromRarity = player.category, fromPotential = Number(player.finalOverall);
  state.players[String(player.playerId)] = { legacyNormale: null, steps: rarities.map((rarity, index) => {
    const toPotential = V2.threshold(rarity), profile = V3.materializeProfile({ basePlayer: player, targetPotential: toPotential, category: rarity, database, progression });
    const step = { stepId: `authority-${index}-${rarity}`, rarity, fromRarity, fromPotential, toPotential, profile, receipt: { coinsConsumed: V2.COSTS[rarity].coins, cupsConsumed: V2.COSTS[rarity].cups, cupsConsumedBySource: V2.COSTS[rarity].cups ? { ie1: V2.COSTS[rarity].cups } : {}, projectsConsumed: V2.COSTS[rarity].projects }, createdAt: `2026-08-28T01:00:0${index}.000Z` };
    fromRarity = rarity; fromPotential = toPotential; return step;
  }) };
  return state;
}

// Empty/V2-only initialization is guarded, one-write, one-event and idempotent.
environment(null, ({ storage, counts }) => {
  const first = Account.ensureMigrated(options); assert(first.ok && first.migrated); assert.deepStrictEqual(first.state, V3.empty());
  assert.deepStrictEqual(counts(), { reserves: 1, events: 1 }); const writes = storage.writes;
  const second = Account.ensureMigrated(options); assert(second.ok && !second.migrated); assert.equal(storage.writes, writes);
  assert.deepStrictEqual(JSON.parse(storage.value).developmentV3, V3.empty());
});
environment(JSON.stringify(legacy({ coins: 321 })), () => { const result = Account.ensureMigrated(options); assert(result.ok && result.migrated); assert.equal(result.state.coins, 321); });

// An unmarked shadow is pre-cutover evidence, never authority. A stale Forte
// shadow conflicts with the current Elite V2 mirror without changing either;
// an equivalent shadow is adopted once and receives the authority marker.
{
  const player = base("Normale"), elite = canonicalChain(player, ["Buono", "Forte", "Elite"]), forte = canonicalChain(player, ["Buono", "Forte"]);
  const currentMirror = Account.projectV2Compatibility(elite, resolve, options), conflicting = { ...currentMirror, developmentV3: forte };
  environment(JSON.stringify(conflicting), ({ storage, counts }) => {
    const before = storage.value, result = Account.ensureMigrated(options); assert.equal(result.ok, false); assert.equal(result.reason, "development-v3-migration-conflict");
    assert.deepStrictEqual(counts(), { reserves: 0, events: 0 }); assert.equal(storage.value, before); const persisted = JSON.parse(storage.value);
    assert.equal(persisted.players[player.playerId].currentPermanentRarity, "Elite"); assert.equal(persisted.developmentV3.players[player.playerId].steps.at(-1).rarity, "Forte");
  });
  const equivalent = { ...currentMirror, developmentV3: elite };
  environment(JSON.stringify(equivalent), ({ storage, counts }) => {
    const first = Account.ensureMigrated(options); assert(first.ok && first.migrated && first.adopted); assert.deepStrictEqual(first.state, elite);
    assert.equal(JSON.parse(storage.value)[Account.AUTHORITY_FIELD], Account.AUTHORITY_VERSION); assert.deepStrictEqual(counts(), { reserves: 1, events: 1 }); const writes = storage.writes;
    const second = Account.ensureMigrated(options); assert(second.ok && !second.migrated); assert.equal(storage.writes, writes); assert.deepStrictEqual(counts(), { reserves: 1, events: 1 });
  });
}

// Recovery, stale bytes, malformed/future shadows and write failures never partially commit.
environment(JSON.stringify(legacy()), ({ storage, block, counts }) => { block(true); const before = storage.value; const result = Account.ensureMigrated(options); assert(result.deferred); assert.equal(storage.value, before); assert.deepStrictEqual(counts(), { reserves: 0, events: 0 }); });
environment(JSON.stringify(legacy()), ({ storage, counts }) => { const staleOptions = { ...options, resolveBasePlayer(id) { storage.value += " "; return Runtime.resolveBasePlayer(id); } }; const source = legacy(); const player = base("Normale"); source.players[player.playerId] = { permanentTargetPotential: 75, currentPermanentRarity: "Buono" }; source.evolutionHistory = [{ id: "stale", playerId: String(player.playerId), fromRarity: "Normale", toRarity: "Buono", fromPotential: Number(player.finalOverall), toPotential: 75, projectsConsumed: 1, cupsConsumed: 1, cupsConsumedBySource: { ie1: 1 }, coinsConsumed: 200 }]; storage.value = JSON.stringify(source); const result = Account.ensureMigrated(staleOptions); assert.equal(result.reason, "development-v3-migration-stale"); assert.deepStrictEqual(counts(), { reserves: 0, events: 0 }); });
for (const shadow of [{ schemaVersion: 999 }, { schemaVersion: 1, players: "bad" }]) environment(JSON.stringify({ ...legacy(), developmentV3: shadow }), ({ storage, counts }) => { const before = storage.value; const result = Account.ensureMigrated(options); assert.equal(result.reason, "development-v3-schema-conflict"); assert.equal(storage.value, before); assert.deepStrictEqual(counts(), { reserves: 0, events: 0 }); });
for (const marker of [0, 2, "1", null]) environment(JSON.stringify({ ...legacy(), developmentV3: V3.empty(), [Account.AUTHORITY_FIELD]: marker }), ({ storage, counts }) => { const before = storage.value, result = Account.ensureMigrated(options); assert.equal(result.reason, "development-v3-authority-version-conflict"); assert.equal(storage.value, before); assert.deepStrictEqual(counts(), { reserves: 0, events: 0 }); });
environment(JSON.stringify(legacy()), ({ storage, counts }) => { storage.fail = true; const result = Account.ensureMigrated(options); assert.equal(result.reason, "persistence"); assert.deepStrictEqual(counts(), { reserves: 1, events: 0 }); });

// Unknown-field preservation is the generic cloud/restore contract: normalize,
// write, snapshot-shaped JSON, and read all preserve canonical V3 unchanged.
environment(null, ({ storage }) => {
  const canonical = V3.empty(); canonical.coins = 77;
  const envelope = { ...legacy({ coins: 77 }), developmentV3: canonical };
  assert.deepStrictEqual(V2.normalize(envelope).developmentV3, canonical);
  V2.write(envelope); assert.deepStrictEqual(V2.read().developmentV3, canonical);
  const cloudSnapshot = JSON.parse(JSON.stringify({ development: V2.read() })); storage.value = JSON.stringify(cloudSnapshot.development); Account.resetSessionCache();
  assert.deepStrictEqual(Account.read(options), canonical);
});
environment(JSON.stringify(legacy({ coins: 12 })), ({ block }) => { block(true); assert(Account.ensureMigrated(options).deferred); block(false); assert(Account.ensureMigrated(options).migrated); });

// Exact economy, receipts, zero-coloured Normale, all coloured transitions,
// and deterministic projection/conversion round trip.
environment(JSON.stringify(legacy({ coins: 10000, cupsBySeason: { ie1: 20, ie2: 20 }, projects: { Buono: 5, Forte: 5, Elite: 5, Mondiale: 5, Leggenda: 5 } })), ({ counts }) => {
  Account.ensureMigrated(options); const player = base("Scarso"); let selection = {};
  let result = Account.evolve({ ...input(player), cupSelection: selection }, { ...options, timestamp: "2026-08-28T00:00:00.000Z" });
  assert(result.ok); assert.equal(result.target, "Normale"); assert.deepStrictEqual(result.receipt, { coinsConsumed: 100, cupsConsumed: 0, cupsConsumedBySource: {}, projectsConsumed: 0 });
  assert(Account.read(options).players[player.playerId].legacyNormale); assert.deepStrictEqual(Account.slotUsage(Account.read(options)), { Buono: 0, Forte: 0, Elite: 0, Mondiale: 0, Leggenda: 0 });
  for (const [index, target] of ["Buono", "Forte", "Elite", "Mondiale", "Leggenda"].entries()) {
    const cost = V2.COSTS[target]; selection = cost.cups ? { ie1: Math.min(cost.cups, 20), ie2: Math.max(0, cost.cups - 20) } : {};
    result = Account.evolve({ ...input(player), cupSelection: selection }, { ...options, timestamp: `2026-08-28T00:00:0${index + 1}.000Z` }); assert(result.ok, result.reason); assert.equal(result.target, target); assert.equal(result.targetPotential, V2.threshold(target)); assert.equal(result.receipt.coinsConsumed, cost.coins); assert.equal(result.receipt.projectsConsumed, cost.projects); assert.deepStrictEqual(result.receipt.cupsConsumedBySource, Object.fromEntries(Object.entries(selection).filter(([, amount]) => amount > 0)));
  }
  const state = Account.read(options), mirror = Account.projectV2Compatibility(state, resolve, options);
  const roundTrip = Migration.convertState({ v2State: mirror, resolveBasePlayer: resolve, database, progression, DevelopmentV2: V2, DevelopmentV3: V3 });
  assert(roundTrip.ok, JSON.stringify(roundTrip.blockers)); assert.deepStrictEqual(roundTrip.state, state);
  assert.equal(counts().events, 7, "migration plus six mutations each emit exactly once");
});

// Debole -> Normale and natural Buono -> Forte preserve production paths.
for (const rarity of ["Debole", "Buono"]) environment(JSON.stringify(legacy({ coins: 1000, cupsBySeason: { ie1: 5 }, projects: { Forte: 1 } })), () => {
  Account.ensureMigrated(options); const player = base(rarity), target = V2.nextRarity(rarity), cups = V2.COSTS[target].cups;
  const result = Account.evolve({ ...input(player), cupSelection: cups ? { ie1: cups } : {} }, options); assert(result.ok); const chain = Account.read(options).players[player.playerId];
  if (target === "Normale") assert(chain.legacyNormale && chain.steps.length === 0); else assert.deepStrictEqual(chain.steps.map((step) => step.rarity), ["Forte"]);
});

// Caller-supplied player data cannot override the canonical immutable BASE.
environment(JSON.stringify(legacy({ coins: 1000, cupsBySeason: { ie1: 2 }, projects: { Buono: 1 } })), () => {
  Account.ensureMigrated(options); const player = base("Normale"), fake = { ...player, finalOverall: 90, category: "Mondiale", ratings: Object.fromEntries(Object.keys(player.ratings || {}).map((key) => [key, 9])) };
  const result = Account.evolve({ ...input(player), basePlayer: fake, cupSelection: { ie1: 1 } }, options); assert(result.ok); assert.equal(result.target, "Buono"); assert.equal(result.targetPotential, 75);
  const profile = Account.read(options).players[player.playerId].steps[0].profile;
  const expected = V3.materializeProfile({ basePlayer: player, targetPotential: 75, category: "Buono", database, progression }); assert.deepStrictEqual(profile, expected);
});


// Regression removes one canonical node, refunds only its stored receipt, never
// refunds projects, never invokes either materializer, and rejects stale IDs.
environment(null, ({ storage, counts }) => {
  const player = base("Normale"), state = canonicalChain(player, ["Buono", "Forte", "Elite"]), id = String(player.playerId);
  state.coins = 10; state.cupsBySeason.ie2 = 4; state.cupsBySeason.ie1_s3 = 5; state.projects.Elite = 0;
  state.players[id].steps[2].receipt = { coinsConsumed: 800, cupsConsumed: 3, cupsConsumedBySource: { ie2: 1, ie1_s3: 2 }, projectsConsumed: 1 };
  state.players[id].steps[1].receipt = { coinsConsumed: 400, cupsConsumed: 2, cupsConsumedBySource: { ie1: 2 }, projectsConsumed: 1 };
  storage.value = JSON.stringify(Account.envelopeFor(state, options)); Account.resetSessionCache();
  const beforeWrites = storage.writes, preview = Account.previewRegression({ playerId: id }, options); assert(preview.ok); assert.equal(storage.writes, beforeWrites);
  const first = Account.regress({ playerId: id, expectedActiveId: preview.removedId }, options); assert(first.ok); assert.deepStrictEqual(first.from, { rarity: "Elite", potential: 85, isBase: false, isBaseline: false }); assert.equal(first.to.rarity, "Forte");
  assert.deepStrictEqual(first.refund, { coins: 800, cups: 3, cupsBySource: { ie2: 1, ie1_s3: 2 }, projects: 0 });
  assert.equal(first.state.coins, 810); assert.equal(first.state.cupsBySeason.ie2, 5); assert.equal(first.state.cupsBySeason.ie1_s3, 7); assert.equal(first.state.projects.Elite, 0); assert.equal(storage.writes, beforeWrites + 1);
  const stale = Account.regress({ playerId: id, expectedActiveId: preview.removedId }, options); assert.equal(stale.reason, "stale-regression"); assert.equal(storage.writes, beforeWrites + 1);
  const secondId = first.state.players[id].steps.at(-1).stepId, second = Account.regress({ playerId: id, expectedActiveId: secondId }, options); assert(second.ok); assert.equal(second.to.rarity, "Buono"); assert.deepStrictEqual(second.refund, { coins: 400, cups: 2, cupsBySource: { ie1: 2 }, projects: 0 });
  const withoutProject = Account.evolve({ ...input(player), cupSelection: { ie1: 2 } }, options); assert.equal(withoutProject.reason, "resources"); assert.equal(withoutProject.missing.projects, 1);
  Account.mutate((candidate) => { candidate.projects.Forte += 1; }, options); const paidAgain = Account.evolve({ ...input(player), cupSelection: { ie1: 2 } }, options); assert(paidAgain.ok); assert.equal(paidAgain.receipt.projectsConsumed, 1); assert.notEqual(paidAgain.state.players[id].steps.at(-1).stepId, secondId);
});

// A first coloured node returns to the actual preceding baseline or immutable
// BASE, without synthesizing intermediate rarity nodes; empty chains disappear.
for (const [rarity, colored] of [["Buono", "Forte"], ["Forte", "Elite"]]) environment(null, ({ storage }) => {
  const player = base(rarity), state = canonicalChain(player, [colored]), id = String(player.playerId);
  storage.value = JSON.stringify(Account.envelopeFor(state, options)); Account.resetSessionCache();
  const result = Account.regress({ playerId: id, expectedActiveId: state.players[id].steps[0].stepId }, options);
  assert(result.ok); assert.equal(result.to.isBase, true); assert.equal(result.to.rarity, rarity); assert.equal(result.to.potential, Number(player.finalOverall)); assert.equal(result.state.players[id], undefined);
});
environment(null, ({ storage }) => {
  const player = base("Debole"), state = canonicalChain(player, ["Buono"]), id = String(player.playerId), profile = V3.materializeProfile({ basePlayer: player, targetPotential: 70, category: "Normale", database, progression });
  state.players[id].steps[0].fromRarity = "Normale"; state.players[id].steps[0].fromPotential = 70;
  state.players[id].legacyNormale = { migrationId: "legacy-normal", fromRarity: "Debole", fromPotential: Number(player.finalOverall), toPotential: 70, profile, receipt: { coinsConsumed: 100, cupsConsumed: 0, cupsConsumedBySource: {}, projectsConsumed: 0 } };
  storage.value = JSON.stringify(Account.envelopeFor(state, options)); Account.resetSessionCache();
  const colored = Account.regress({ playerId: id, expectedActiveId: state.players[id].steps[0].stepId }, options); assert(colored.ok); assert(colored.to.isBaseline); assert.equal(colored.to.rarity, "Normale");
  const baseline = Account.regress({ playerId: id, expectedActiveId: "legacy-normal" }, options); assert(baseline.ok); assert(baseline.to.isBase); assert.equal(baseline.to.rarity, "Debole"); assert.equal(baseline.state.players[id], undefined);
});

// Regression ignores target capacity, permitting temporary overflow. Normal
// evolve still blocks entry while the destination is full/overfull.
environment(null, ({ storage }) => {
  const player = base("Normale"), state = canonicalChain(player, ["Buono", "Forte", "Elite"]), profile = state.players[player.playerId].steps[1].profile;
  for (let i = 0; i < 20; i += 1) state.players[`full-forte-${i}`] = { legacyNormale: null, steps: [{ ...state.players[player.playerId].steps[1], stepId: `full-${i}`, profile }] };
  const resolveFull = (id) => String(id).startsWith("full-forte-") ? { ...player, playerId: String(id) } : resolve(id);
  const fullOptions = { ...options, resolveBasePlayer: resolveFull }; storage.value = JSON.stringify(Account.envelopeFor(state, fullOptions)); Account.resetSessionCache();
  const result = Account.regress({ playerId: String(player.playerId), expectedActiveId: state.players[player.playerId].steps.at(-1).stepId }, fullOptions); assert(result.ok); assert.equal(Account.slotUsage(result.state).Forte, 21); assert.equal(Account.slotUsage(result.state).Elite, 0);
  const blocked = Account.evolve({ ...input(base("Buono")), cupSelection: { ie1: 2 } }, fullOptions); assert.equal(blocked.reason, "rarity-capacity-full"); assert.equal(blocked.used, 21);
});

// A failed canonical commit reports failure and leaves the persisted account.
environment(null, ({ storage }) => {
  const player = base("Buono"), state = canonicalChain(player, ["Forte"]), id = String(player.playerId); storage.value = JSON.stringify(Account.envelopeFor(state, options)); Account.resetSessionCache();
  const before = storage.value; storage.fail = true; const result = Account.regress({ playerId: id, expectedActiveId: state.players[id].steps[0].stepId }, options); assert.equal(result.reason, "persistence"); assert.equal(storage.value, before);
});

// DEV reset is a single canonical commit, not a V2 reset followed by migration.
environment(JSON.stringify(legacy({ coins: 999 })), ({ storage, counts }) => {
  Account.ensureMigrated(options); const beforeWrites = storage.writes, beforeEvents = counts().events, reset = Account.reset(options), envelope = JSON.parse(storage.value);
  assert.deepStrictEqual(reset, V3.empty()); assert.deepStrictEqual(envelope.developmentV3, V3.empty()); assert.equal(envelope[Account.AUTHORITY_FIELD], Account.AUTHORITY_VERSION);
  assert.equal(storage.writes, beforeWrites + 1); assert.equal(counts().events, beforeEvents + 1);
});

// Capacity is derived solely from each chain's last coloured step. Full target
// capacity rejects before solver/resource/persistence; over-cap states read.
assert.deepStrictEqual(Account.SLOT_CAPACITIES, { Buono: 50, Forte: 20, Elite: 15, Mondiale: 10, Leggenda: 5 });
environment(null, ({ storage, counts }) => {
  const state = V3.empty(), forteBase = base("Buono"), profile = V3.materializeProfile({ basePlayer: forteBase, targetPotential: 80, category: "Forte", database, progression });
  for (let index = 0; index < 21; index += 1) state.players[`capacity-${index}`] = { legacyNormale: null, steps: [{ stepId: `s-${index}`, rarity: "Forte", fromRarity: "Buono", fromPotential: 75, toPotential: 80, profile, receipt: { coinsConsumed: 0, cupsConsumed: 0, cupsConsumedBySource: {}, projectsConsumed: 0 } }] };
  // Projection needs immutable identities; use a fixture resolver for synthetic ids.
  const synthetic = (id) => String(id).startsWith("capacity-") ? { ...forteBase, playerId: String(id), name: String(id) } : Runtime.resolveBasePlayer(id);
  storage.value = JSON.stringify(Account.envelopeFor(state, { ...options, resolveBasePlayer: synthetic })); Account.resetSessionCache();
  assert.equal(Account.slotUsage(Account.read({ ...options, resolveBasePlayer: synthetic })).Forte, 21);
  const before = storage.value, prior = counts(); let solverCalls = 0; const oracle = { ...progression, getPlayerAtLevel(...args) { solverCalls += 1; return progression.getPlayerAtLevel(...args); } };
  const result = Account.evolve({ ...input(forteBase), cupSelection: { ie1: 2 } }, { ...options, resolveBasePlayer: synthetic, progression: oracle });
  assert.deepStrictEqual({ reason: result.reason, rarity: result.rarity, used: result.used, capacity: result.capacity }, { reason: "rarity-capacity-full", rarity: "Forte", used: 21, capacity: 20 });
  assert.equal(solverCalls, 0); assert.equal(storage.value, before); assert.deepStrictEqual(counts(), prior);
});

// Canonical snapshot freezes Run A; Run B reads the later active V3 profile,
// while a deliberately corrupted compatibility mirror is never authoritative.
environment(JSON.stringify(legacy({ coins: 5000, cupsBySeason: { ie1: 10 }, projects: { Buono: 2, Forte: 2, Elite: 2 } })), ({ storage }) => {
  Account.ensureMigrated(options); const player = base("Normale");
  for (const target of ["Buono", "Forte"]) { const cups = V2.COSTS[target].cups; assert(Account.evolve({ ...input(player), cupSelection: { ie1: cups } }, options).ok); }
  const runA = Runtime.buildRunSnapshot({ v3State: Account.read(options), v2Compatibility: Account.readCompatibility(options) }); assert.equal(runA.developmentV3PlayerSnapshot.players[player.playerId].profile.finalOverall, 80);
  assert(Account.evolve({ ...input(player), cupSelection: { ie1: 3 } }, options).ok);
  const eliteState = Account.read(options), runElite = Runtime.buildRunSnapshot({ v3State: eliteState, v2Compatibility: Account.readCompatibility(options) });
  const eliteId = eliteState.players[player.playerId].steps.at(-1).stepId; assert(Account.regress({ playerId: String(player.playerId), expectedActiveId: eliteId }, options).ok);
  const envelope = JSON.parse(storage.value); envelope.players[player.playerId].permanentTargetPotential = 99;
  const runB = Runtime.buildRunSnapshot({ v3State: Account.read(options), v2Compatibility: envelope });
  assert.equal(runElite.developmentV3PlayerSnapshot.players[player.playerId].profile.finalOverall, 85, "existing run remains frozen"); assert.equal(runB.developmentV3PlayerSnapshot.players[player.playerId].profile.finalOverall, 80);
  assert.equal(Runtime.resolvePlayer(runB, player, 20, database).potential, 80);
  assert.equal(Account.read(options).players[player.playerId].steps.at(-1).toPotential, 80, "regressed marked V3 remains canonical over a corrupt mirror");
});

// Account failures are normalized into the controlled run-snapshot boundary.
{
  const original = global.DevelopmentAccountV3; global.DevelopmentAccountV3 = { read() { throw Object.assign(new Error("conflict"), { code: "development-v3-migration-conflict", details: ["stale-shadow"] }); } };
  try { assert.throws(() => Runtime.buildRunSnapshot(), (error) => error instanceof Runtime.DevelopmentSnapshotError && error.code === "development-v3-account-unavailable" && error.details[0].code === "development-v3-migration-conflict" && error.details[0].details[0] === "stale-shadow"); }
  finally { global.DevelopmentAccountV3 = original; }
}

// Representative 100x5 canonical+mirror envelope remains well under 850 KiB.
{
  const state = V3.empty(), templateBase = base("Normale"), profiles = {};
  for (const rarity of V3.COLORED_RARITIES) profiles[rarity] = V3.materializeProfile({ basePlayer: templateBase, targetPotential: V2.threshold(rarity), category: rarity, database, progression });
  const synthetic = (id) => ({ ...templateBase, playerId: String(id), name: `Player ${id}` });
  for (let player = 0; player < 100; player += 1) { let fromRarity = "Normale", fromPotential = 70; const steps = V3.COLORED_RARITIES.map((rarity, index) => { const toPotential = V2.threshold(rarity), step = { stepId: `stress-${player}-${index}`, rarity, fromRarity, fromPotential, toPotential, profile: profiles[rarity], receipt: { coinsConsumed: V2.COSTS[rarity].coins, cupsConsumed: V2.COSTS[rarity].cups, cupsConsumedBySource: V2.COSTS[rarity].cups ? { ie1: V2.COSTS[rarity].cups } : {}, projectsConsumed: 1 }, createdAt: `2026-08-28T00:${String(player).padStart(2, "0")}:${String(index).padStart(2, "0")}.000Z` }; fromRarity = rarity; fromPotential = toPotential; return step; }); state.players[`stress-${player}`] = { legacyNormale: null, steps }; }
  assert(V3.validate(state).valid); const bytes = Buffer.byteLength(JSON.stringify(Account.envelopeFor(state, { ...options, resolveBasePlayer: synthetic })), "utf8");
  assert(bytes < 850 * 1024, `${bytes} bytes exceeds cloud budget`); console.log(`development-account-v3 stress envelope bytes: ${bytes}`);
}

console.log("development-account-v3 tests passed");
