"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const season = require("../data/IE1_season_compact.json");
const visuals = require("../data/PLAYER_VISUALS.json");

const byId = new Map(season.players.map((player) => [String(player.playerId), player]));
assert.strictEqual(byId.size, season.players.length, "IE1 playerId values must stay unique");

const corrected = new Map([
  ["4483", ["87", "Francis Tell"]],
  ["4478", ["77", "Harry Leading"]],
  ["4485", ["91", "Jonathan Seller"]],
  ["4487", ["95", "Neil Turner"]],
  ["4480", ["81", "Philip Marvel"]],
  ["4463", ["161", "Alfred Meenan"]],
  ["4464", ["162", "Dan Mirthful"]],
  ["4462", ["160", "Malcolm Night"]],
  ["4466", ["164", "Toby Damian"]],
  ["4468", ["166", "Zachary Moore"]],
  ["4501", ["23", "Alan Master"]],
  ["4500", ["22", "Ben Simmons"]],
  ["4506", ["28", "Daniel Hatch"]],
  ["4507", ["30", "David Samford"]],
  ["4505", ["27", "Derek Swing"]],
  ["4502", ["24", "Gus Martin"]],
  ["4503", ["25", "Herman Waldon"]],
  ["4504", ["26", "John Bloom"]],
  ["4499", ["21", "Peter Drent"]],
]);

for (const [oldId, [newId, expectedName]] of corrected) {
  assert.strictEqual(byId.has(oldId), false, `legacy duplicate id ${oldId} must be gone`);
  const player = byId.get(newId);
  assert.ok(player, `canonical player ${newId} must exist`);
  assert.strictEqual(player.name, expectedName, `canonical id ${newId} must resolve to ${expectedName}`);
  assert.ok(visuals.players[newId], `visual master must contain ${newId}`);
  assert.strictEqual(visuals.players[newId].name, expectedName);
  assert.strictEqual(player.portraitUrl, visuals.players[newId].portraitUrl, `portrait must use canonical visual for ${newId}`);
  assert.ok(visuals.players[newId].frontFullbodyUrl, `fullbody visual must exist for ${newId}`);
}

const legacyById = new Map((season.legacyPlayers || []).map((player) => [String(player.playerId), player]));
assert.strictEqual(legacyById.size, 23, "IE1 must retain exactly the 23 pre-correction records needed by historical runs");
for (const [oldId, [newId, expectedName]] of corrected) {
  assert.strictEqual(season.legacyPlayerIdAliases?.[oldId], newId, `legacy alias ${oldId} must point to ${newId}`);
  const legacy = legacyById.get(oldId);
  const canonical = byId.get(newId);
  assert.ok(legacy, `legacy lookup record ${oldId} must exist`);
  assert.strictEqual(legacy.name, expectedName);
  for (const field of ["position", "element", "category", "finalOverall", "progressionCode"]) {
    assert.deepStrictEqual(canonical[field], legacy[field], `${expectedName} must preserve gameplay field ${field}`);
  }
  assert.deepStrictEqual(canonical.finalStats, legacy.finalStats, `${expectedName} finalStats must not change during identity correction`);
}

const removed = new Map([
  ["4484", "Darren Gouger"],
  ["4482", "Electra Faraday"],
  ["4477", "Gideon Poe"],
  ["4461", "Trice Topper"],
]);
for (const [id, name] of removed) {
  assert.strictEqual(byId.has(id), false, `${name} (${id}) must be removed from IE1 players`);
}

const teamById = new Map(season.teams.map((team) => [String(team.teamId || team.id), team]));
const bossById = new Map(season.bossOrder.map((boss) => [String(boss.teamId), boss]));

function assertNoIds(collection, ids, label) {
  for (const id of ids) assert.strictEqual(collection.includes(id), false, `${label} must not contain ${id}`);
}

const brainwashing = teamById.get("brainwashing");
const kirkwood = teamById.get("kirkwood");
assert.ok(brainwashing && kirkwood);
assertNoIds(brainwashing.playerIds, ["4484", "4482", "4477"], "Brainwashing roster");
assertNoIds(kirkwood.playerIds, ["4461"], "Kirkwood roster");
assert.strictEqual(brainwashing.ratedPlayers, brainwashing.playerIds.length);
assert.strictEqual(kirkwood.ratedPlayers, kirkwood.playerIds.length);

const formationRequirements = new Map(
  season.formations.eleven.map((formation) => [formation.id, formation.requirements]),
);

for (const boss of season.bossOrder) {
  assert.strictEqual(boss.startingXIPlayerIds.length, 11, `${boss.teamId} needs 11 starting ids`);
  assert.strictEqual(boss.startingXI.length, 11, `${boss.teamId} needs 11 starting records`);
  assert.deepStrictEqual(
    boss.startingXI.map((entry) => String(entry.playerId)),
    boss.startingXIPlayerIds.map(String),
    `${boss.teamId} starting XI representations must match`,
  );

  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const id of boss.startingXIPlayerIds) {
    const player = byId.get(String(id));
    assert.ok(player, `${boss.teamId} starting player ${id} must resolve`);
    counts[player.position] += 1;
  }

  const requirements = formationRequirements.get(boss.bossFormation);
  assert.ok(requirements, `formation ${boss.bossFormation} must exist`);
  for (const [role, amount] of Object.entries(requirements)) {
    assert.strictEqual(counts[role], amount, `${boss.teamId} must satisfy ${boss.bossFormation} ${role}`);
  }

  for (const id of boss.rewardPoolPlayerIds || []) {
    assert.ok(byId.has(String(id)), `${boss.teamId} reward player ${id} must resolve`);
  }
}

for (const team of season.teams) {
  assert.strictEqual(new Set(team.playerIds).size, team.playerIds.length, `${team.teamId} roster must not contain duplicate ids`);
  for (const id of team.playerIds) assert.ok(byId.has(String(id)), `${team.teamId} player ${id} must resolve`);
}

const brainBoss = bossById.get("brainwashing");
const brainNames = brainBoss.startingXIPlayerIds.map((id) => byId.get(String(id)).name);
assert.ok(brainNames.includes("Victor Kind"), "Victor Kind must fill one removed Brainwashing MF slot");
assert.ok(brainNames.includes("Samuel Buster"), "Samuel Buster must fill one removed Brainwashing MF slot");
for (const removedName of ["Darren Gouger", "Electra Faraday", "Gideon Poe"]) {
  assert.strictEqual(brainNames.includes(removedName), false);
}

assert.strictEqual(season.summary.players, season.players.length);
assert.strictEqual(season.validation.players, season.players.length);
assert.strictEqual(season.validation.exactValuesChecked, season.players.length * 21 * 9);

async function verifyLegacyReadCompatibility() {
  const context = {
    console,
    fetch: async () => ({
      ok: true,
      json: async () => structuredClone(season),
    }),
    ProfiledSeasonRuntime: { register: () => {} },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/season-registry.js", "utf8"), context, {
    filename: "js/season-registry.js",
  });

  const loaded = await context.SeasonRegistry.loadDatabase("ie1");
  assert.strictEqual(
    loaded.players.some((player) => String(player.playerId) === "4483"),
    false,
    "legacy IDs must stay outside the active IE1 player catalog",
  );
  const lookupIndex = context.SeasonRegistry.playersIndex("ie1");
  assert.strictEqual(
    lookupIndex.size,
    loaded.players.length,
    "legacy lookup records must not increase the active playersIndex size",
  );
  assert.strictEqual(
    [...lookupIndex.values()].some((player) => String(player.playerId) === "4483"),
    false,
    "legacy lookup records must not be enumerable by new-content consumers",
  );
  assert.strictEqual(
    lookupIndex.get("4483")?.name,
    "Francis Tell",
    "playersIndex direct lookup falls back to the historical record",
  );
  assert.strictEqual(
    context.SeasonRegistry.player("87", "ie1")?.name,
    "Francis Tell",
    "new runs resolve the corrected canonical ID",
  );
  assert.strictEqual(
    context.SeasonRegistry.player("4483", "ie1")?.name,
    "Francis Tell",
    "pre-correction runs can still resolve the historical ID",
  );
  assert.strictEqual(
    context.SeasonRegistry.player("4484", "ie1")?.name,
    "Darren Gouger",
    "a removed player remains resolvable only for an already-started run",
  );
  assert.strictEqual(
    context.SeasonRegistry.player("4483", "ie1")?.frontFullbodyUrl,
    visuals.players["87"].frontFullbodyUrl,
    "historical remapped entries use the corrected fullbody visual",
  );

  context.AlbumProgress = {
    DEFAULT_COLLECTION_ID: "ie1",
    unlockedSet: () => new Set(["4483", "4484"]),
  };
  context.HallOfFameStorage = { listSummaries: () => [] };
  vm.runInContext(fs.readFileSync("js/album/album-controller.js", "utf8"), context, {
    filename: "js/album/album-controller.js",
  });
  const controller = context.AlbumController.create({
    app: {},
    getUi: () => ({}),
    getRun: () => null,
    prepareAlbumLegacyContext: () => {},
    getSeasonDb: () => loaded,
    getFreeAgentsDb: () => ({ players: [] }),
    getSeasonPlayersById: () => context.SeasonRegistry.playersIndex("ie1"),
    getActiveSeason: () => ({ id: "ie1" }),
    loadSeason: async () => loaded,
    isProfileAwareSeason: () => false,
    closeModal: () => {},
    resetRenderedViewScroll: () => {},
    bindSectionRootNav: () => {},
    showPlayerDetailsFor: () => {},
    scrollSnapshot: () => ({}),
    view: { escapeHtml: String, sectionRootButton: () => "", playerCard: () => "" },
  });
  const unlocked = controller.unlockedSet("ie1", {});
  assert.ok(unlocked.has("4483"), "stored legacy Album unlock remains untouched");
  assert.ok(unlocked.has("87"), "legacy Album unlock is recognized as the corrected canonical ID at read time");
  assert.strictEqual(unlocked.has("4482"), false, "unrelated IDs are not synthesized");
}

verifyLegacyReadCompatibility()
  .then(() => console.log("IE1 corrected IDs, visuals, legacy run resolution and Album read aliases: ok"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
