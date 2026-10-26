"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const vm = require("node:vm");
const snapshot = require("../js/road-to-glory/rtg-cloud-snapshot.js");
const adapter = require("../js/road-to-glory/rtg-cloud-local-adapter.js");

function campaign() {
  return {
    schemaVersion: 3, campaignId: "rtg-ie-trilogy", campaignSeed: "seed",
    activeSeasonId: "ie1", seasonComplete: false,
    seasonTransitionRewardedIds: [], projects: { Buono: 0 },
    coachPullCount: 0, lives: 2, checkpointMainIndex: -1,
    currentNodeId: "main:occult", furthestNodeIndex: 0,
    defeatedTeamIds: [], firstClearMatchIds: [], attemptsByNode: { node: 1 },
    gacha: { pullCount: 4, recruitmentPullCount: 17 },
    squads: { ie1: { coachId: "unowned", coachPowerSelection: { cardIds: ["unowned-card"] } } },
    activeMatch: null,
  };
}
function fixture() {
  return {
    trilogy: campaign(), aresOrion: null,
    shared: { tokens: 0, gachaAcquiredCards: [], coachOwnedIds: [],
      developmentByCardId: { hero: { targetPotential: 70, currentRarity: "Forte", evolutionCount: 2, updatedAt: null } } },
    album: { version: 1, cardIds: [] },
  };
}
function capture(records) {
  return adapter.create({
    storage: { async readMany() { return records; } },
    localStorage: { getItem() { return null; } }, projector: snapshot,
  }).captureStable();
}
const invalidCounts = [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "2", null, undefined, true];
const counters = {
  coachPullCount: (f, value) => { f.trilogy.coachPullCount = value; },
  lives: (f, value) => { f.trilogy.lives = value; },
  furthestNodeIndex: (f, value) => { f.trilogy.furthestNodeIndex = value; },
  pullCount: (f, value) => { f.trilogy.gacha.pullCount = value; },
  recruitmentPullCount: (f, value) => { f.trilogy.gacha.recruitmentPullCount = value; },
  attempts: (f, value) => { f.trilogy.attemptsByNode.node = value; },
  projects: (f, value) => { f.trilogy.projects.Buono = value; },
  tokens: (f, value) => { f.shared.tokens = value; },
  evolutionCount: (f, value) => { f.shared.developmentByCardId.hero.evolutionCount = value; },
};
for (const [name, set] of Object.entries(counters)) {
  for (const [index, value] of invalidCounts.entries()) test(`${name} rejects malformed counter ${index}`, () => {
    const input = fixture(); set(input, value);
    assert.throws(() => snapshot.project(input), e => /^rtg-cloud-/.test(e.code));
  });
  test(`${name} transports its semantic integer boundary`, () => {
    const input = fixture(); set(input, name === "lives" ? 2 : Number.MAX_SAFE_INTEGER);
    const payload = snapshot.project(input);
    assert.deepEqual(snapshot.validate(payload), payload);
  });
}
for (const value of [-2, 0.1, Number.MAX_SAFE_INTEGER + 1, "0", null]) test(`checkpoint rejects ${value}`, () => {
  const input = fixture(); input.trilogy.checkpointMainIndex = value;
  assert.throws(() => snapshot.project(input));
});
for (const [field, values] of Object.entries({
  targetPotential: [0, 100, 3.5, "70", null, undefined],
  currentRarity: ["bogus", "", 2, null, undefined],
  updatedAt: [23, {}, [], false, undefined],
})) for (const [index, value] of values.entries()) test(`development ${field} rejects malformed value ${index}`, () => {
  const input = fixture(); input.shared.developmentByCardId.hero[field] = value;
  assert.throws(() => snapshot.project(input));
});
test("legacy cloud omits recruitment and development optional fields without schema bump", () => {
  const input = fixture(); delete input.trilogy.gacha.recruitmentPullCount;
  delete input.shared.developmentByCardId.hero.evolutionCount;
  delete input.shared.developmentByCardId.hero.updatedAt;
  const payload = snapshot.project(input);
  assert.equal(payload.schemaVersion, 1);
  assert.deepEqual(payload.campaigns["rtg-ie-trilogy"].gacha, { pullCount: 4 });
  assert.deepEqual(payload.shared.developmentByCardId.hero, { targetPotential: 70, currentRarity: "Forte" });
  assert.deepEqual(snapshot.validate(payload), payload);
});
test("recruitment zero is present and source remains untouched", () => {
  const input = fixture(); input.trilogy.gacha.recruitmentPullCount = 0;
  const before = structuredClone(input), payload = snapshot.project(input);
  assert.deepEqual(payload.campaigns["rtg-ie-trilogy"].gacha, { pullCount: 4, recruitmentPullCount: 0 });
  assert.deepEqual(input, before);
  assert.deepEqual(payload.shared.coachOwnedIds, []);
  assert.ok(!("squads" in payload.campaigns["rtg-ie-trilogy"]));
});
test("project keys and attempt node IDs must be meaningful", () => {
  const input = fixture(); input.trilogy.projects.Bogus = 1;
  assert.throws(() => snapshot.project(input));
  delete input.trilogy.projects.Bogus; input.trilogy.attemptsByNode[" "] = 2;
  assert.throws(() => snapshot.project(input));
});
const nonJson = {
  date: () => new Date(), map: () => new Map(), boxed: () => new Number(1),
  bigint: () => 1n, function: () => () => 1, symbol: () => Symbol("hidden"),
  undefined: () => undefined, infinity: () => Infinity, sparse: () => new Array(1),
  arrayProperty: () => Object.assign([], { hidden: 1 }),
  symbolProperty: () => ({ [Symbol("hidden")]: 1 }),
  nonenumerable: () => Object.defineProperty({}, "hidden", { value: 1 }),
  accessor: () => Object.defineProperty({}, "hidden", { enumerable: true, get() { throw new Error("getter invoked"); } }),
  toJSON: () => ({ toJSON() { return {}; } }),
  cycle: () => { const value = {}; value.self = value; return value; },
};
for (const [name, make] of Object.entries(nonJson)) test(`cloud rejects ${name} rather than losing data during serialization`, () => {
  const payload = snapshot.project(fixture());
  payload.shared.gachaAcquiredCards = [{ cardId: "hero", metadata: make() }];
  assert.throws(() => snapshot.validate(payload), e => e.code === "rtg-cloud-non-json-data");
});
test("cloud rejects non JSON top-level data even on excluded fields", () => {
  const payload = snapshot.project(fixture()); payload.extra = new Map();
  assert.throws(() => snapshot.validate(payload), e => e.code === "rtg-cloud-non-json-data");
});
test("cloud rejects local fields and extra gacha data", () => {
  for (const field of ["squads", "activeMatch", "coachPowerSelection", "slotId"]) {
    const payload = snapshot.project(fixture()); payload.campaigns["rtg-ie-trilogy"][field] = {};
    assert.throws(() => snapshot.validate(payload));
  }
  const payload = snapshot.project(fixture()); payload.campaigns["rtg-ie-trilogy"].gacha.uiTab = "recruit";
  assert.throws(() => snapshot.validate(payload));
});
test("reserved dictionary keys cannot reach gameplay maps that cannot retain them", async () => {
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const input = fixture();
    input.shared.developmentByCardId = Object.fromEntries([[key, { targetPotential: 70, currentRarity: "Forte", evolutionCount: 2 }]]);
    assert.throws(() => snapshot.project(input));
    await assert.rejects(capture({ state: input.trilogy, "shared:account": input.shared }));
    const attempts = fixture(); attempts.trilogy.attemptsByNode = Object.fromEntries([[key, 2]]);
    assert.throws(() => snapshot.project(attempts));
  }
});
test("lives above the gameplay maximum never enter an account snapshot", () => {
  for (const lives of [3, 7, Number.MAX_SAFE_INTEGER]) {
    const input = fixture(); input.trilogy.lives = lives;
    assert.throws(() => snapshot.project(input));
  }
});
test("capture preserves earned campaign coaches when legacy shared ownership is empty", async () => {
  const input = fixture(); input.trilogy.coachOwnedIds = ["36"];
  const before = structuredClone(input);
  const result = await capture({ state: input.trilogy, "shared:account": input.shared });
  assert.deepEqual(result.snapshot.shared.coachOwnedIds, ["36"]);
  assert.deepEqual(result.snapshot.shared.gachaAcquiredCards, []);
  assert.deepEqual(input, before);
});
test("capture after empty restore derives no ownership from preserved local squads", async () => {
  const input = fixture(); input.trilogy.coachOwnedIds = [];
  const result = await capture({ state: input.trilogy, "shared:account": input.shared });
  assert.deepEqual(result.snapshot.shared.coachOwnedIds, []);
  assert.deepEqual(result.snapshot.shared.gachaAcquiredCards, []);
});
test("capture accepts only absent legacy defaults, never malformed present fields", async () => {
  for (const field of ["coachPullCount", "projects", "seasonTransitionRewardedIds"]) {
    for (const value of [null, "0", false]) {
      const input = fixture(); input.trilogy.schemaVersion = 1; input.trilogy[field] = value;
      await assert.rejects(capture({ state: input.trilogy, "shared:account": input.shared }));
    }
  }
});
test("capture rejects malformed shared development without coercion", async () => {
  for (const [field, value] of [["targetPotential", "70"], ["evolutionCount", -1],
    ["evolutionCount", Number.MAX_SAFE_INTEGER + 1], ["evolutionCount", null], ["updatedAt", 23]]) {
    const input = fixture(); input.shared.developmentByCardId.hero[field] = value;
    await assert.rejects(capture({ state: input.trilogy, "shared:account": input.shared }));
  }
});
test("capture rejects falsy corrupt records instead of converting them to missing", async () => {
  for (const value of [false, 0, ""]) await assert.rejects(capture({ state: value }));
});
test("active match defers before interpreting corrupt shared progression", async () => {
  const input = fixture(); input.trilogy.activeMatch = {};
  const result = await capture({ state: input.trilogy, "shared:account": false });
  assert.deepEqual(result, { status: "deferred", reason: "rtg-cloud-match-in-progress" });
});
test("present undefined development map and null coach ownership are corrupt", async () => {
  for (const [field, value] of [["developmentByCardId", undefined], ["coachOwnedIds", null], ["coachOwnedIds", false]]) {
    const input = fixture(); input.shared[field] = value;
    await assert.rejects(capture({ state: input.trilogy, "shared:account": input.shared }));
  }
});
test("project never emits lossy collection arrays", () => {
  for (const field of ["cards", "album", "coaches"]) {
    for (const value of [new Array(1), Object.assign([], { hidden: 1 })]) {
      const input = fixture();
      if (field === "cards") input.shared.gachaAcquiredCards = value;
      if (field === "album") input.album.cardIds = value;
      if (field === "coaches") input.shared.coachOwnedIds = value;
      assert.throws(() => snapshot.project(input));
    }
  }
});
test("development local metadata is excluded and rejected in cloud payloads", () => {
  const input = fixture(); input.shared.developmentByCardId.hero.squads = { local: true };
  const payload = snapshot.project(input);
  assert.ok(!("squads" in payload.shared.developmentByCardId.hero));
  payload.shared.developmentByCardId.hero.squads = { local: true };
  assert.throws(() => snapshot.validate(payload), e => e.code === "rtg-cloud-noncanonical-snapshot");
});
test("raw legacy player IDs are reconstructed using canonical identity without changing squads", async () => {
  require("../js/road-to-glory/rtg-card-identity.js");
  const state = campaign(); state.schemaVersion = 1;
  delete state.projects; delete state.coachPullCount; delete state.seasonTransitionRewardedIds;
  state.gachaAcquiredPlayerIds = ["mark"];
  const before = structuredClone(state);
  const result = await capture({ state });
  assert.equal(result.snapshot.shared.gachaAcquiredCards[0].cardId, "ie1::mark");
  assert.deepEqual(result.snapshot.shared.coachOwnedIds, []);
  assert.deepEqual(state, before);
});
test("plain records and arrays from another realm remain valid JSON data", () => {
  const payload = snapshot.project(fixture());
  const foreign = vm.runInNewContext(`JSON.parse(${JSON.stringify(JSON.stringify(payload))})`);
  assert.deepEqual(snapshot.validate(foreign), payload);
});
test("cross-realm support still rejects class instances and forged constructors", () => {
  for (const code of ["new (class Object {})()", "new Date()", "new Map()", "new (class extends Array {})()",
    "Object.create({ constructor: Object })", "Object.create(Object.assign(Object.create(null), { constructor: Object }))"]) {
    const payload = snapshot.project(fixture());
    payload.shared.gachaAcquiredCards = [{ cardId: "hero", metadata: vm.runInNewContext(code) }];
    assert.throws(() => snapshot.validate(payload), e => e.code === "rtg-cloud-non-json-data");
  }
});
