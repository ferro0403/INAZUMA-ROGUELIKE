"use strict";

const assert = require("assert");
const Management = require("../js/development-management-v3.js");

const capacities = { Buono: 50, Forte: 20, Elite: 15, Mondiale: 10, Leggenda: 5 };
const Account = {
  slotUsage(state) {
    const usage = Object.fromEntries(Object.keys(capacities).map((rarity) => [rarity, 0]));
    Object.values(state.players || {}).forEach((chain) => { const rarity = chain.steps?.at(-1)?.rarity; if (rarity in usage) usage[rarity] += 1; });
    return usage;
  },
  slotCapacity: (rarity) => capacities[rarity] || 0,
};
const profile = (rarity) => ({ category: rarity, maxLevel: 20 });
const step = (rarity, potential) => ({ rarity, toPotential: potential, profile: profile(rarity) });
const legacy = { toPotential: 70, profile: profile("Normale") };
const database = { players: [
  { playerId: "a", name: "Alfa", position: "FW", category: "Debole", finalOverall: 68 },
  { playerId: "b", name: "Beta", position: "MF", category: "Buono", finalOverall: 77 },
  { playerId: "c", name: "Charlie", position: "DF", category: "Forte", finalOverall: 83 },
] };
let decodeCalls = 0, materializeCalls = 0, solverCalls = 0;
const V3 = {
  resolveValidatedMaterializedPlayer(base, activeProfile) { decodeCalls += 1; return { ...base, category: activeProfile.category, overall: 85, potential: 85, stats: { attack: 85 } }; },
  materializeProfile() { materializeCalls += 1; },
};

const state = { players: {
  a: { legacyNormale: null, steps: [step("Buono", 75)] },
  b: { legacyNormale: null, steps: [step("Buono", 78), step("Forte", 80)] },
  c: { legacyNormale: null, steps: [step("Buono", 79), step("Forte", 84), step("Elite", 85)] },
} };
assert.deepStrictEqual(Account.slotUsage(state), { Buono: 1, Forte: 1, Elite: 1, Mondiale: 0, Leggenda: 0 });
assert.deepStrictEqual(Management.buildSlotSummary(state, Account).map(({ rarity, capacity }) => [rarity, capacity]), Object.entries(capacities));
assert.equal(Account.slotUsage({ players: { a: { legacyNormale: legacy, steps: [] } } }).Buono, 0);
assert.equal(Account.slotUsage({ players: { a: { legacyNormale: legacy, steps: [step("Buono", 75)] } } }).Buono, 1);
assert.deepStrictEqual(Account.slotUsage({ players: { b: { legacyNormale: null, steps: [step("Forte", 80)] } } }), { Buono: 0, Forte: 1, Elite: 0, Mondiale: 0, Leggenda: 0 });
const overflowAccount = { ...Account, slotUsage: () => ({ Buono: 51 }) };
assert.deepStrictEqual(Management.buildSlotSummary({ players: {} }, overflowAccount)[0], { rarity: "Buono", used: 51, capacity: 50, display: "51 / 50", overCapacity: true });

const rowState = { players: {
  baseOnly: { legacyNormale: null, steps: [] },
  a: { legacyNormale: legacy, steps: [] },
  b: { legacyNormale: null, steps: [step("Forte", 80)] },
  c: { legacyNormale: null, steps: [step("Elite", 85)] },
} };
const rows = Management.buildRows(rowState, database, V3);
assert.equal(rows.length, 3);
assert.deepStrictEqual(rows.map((row) => row.activeRarity), ["Elite", "Forte", "Normale"]);
assert.equal(rows.find((row) => row.playerId === "a").activePotential, 70);
assert.deepStrictEqual(rows.find((row) => row.playerId === "a").path.map(({ rarity }) => rarity), ["Debole", "Normale"]);
assert.deepStrictEqual(rows.find((row) => row.playerId === "b").path.map(({ rarity }) => rarity), ["Buono", "Forte"]);
assert.equal(Management.filterRows(rows, "Elite")[0].playerId, "c");
assert.equal(Management.filterRows(rows, "Buono").length, 0);
assert.equal(Management.buildRows({ players: { unavailable: { legacyNormale: legacy, steps: [] } } }, database, V3)[0].missingIdentity, true);

const hundredPlayers = Array.from({ length: 100 }, (_, index) => ({ playerId: `p${index}`, name: `Player ${String(index).padStart(3, "0")}`, position: "FW", category: "Buono", finalOverall: 77 }));
const hundredState = { players: Object.fromEntries(hundredPlayers.map((player) => [player.playerId, { legacyNormale: null, steps: [step("Forte", 80)] }])) };
decodeCalls = materializeCalls = solverCalls = 0;
const hundred = Management.buildModel({ state: hundredState, database: { players: hundredPlayers }, account: Account, V3 });
assert.equal(hundred.rows.length, 100); assert.equal(decodeCalls, 100);
assert.equal(materializeCalls, 0); assert.equal(solverCalls, 0);
assert.equal(hundred.rows[0].detailPlayer.category, "Forte");
assert.equal(hundred.rows[0].detailPlayer.potential, 85);

console.log("development-management-v3-test: canonical slots, exact chains, sorting/filtering, overflow, fallback and 100-player zero-solver model OK");
