"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const season = require("../data/IE2_season_compact.json");
const visuals = require("../data/PLAYER_VISUALS.json");

const players = new Map(season.players.map((player) => [String(player.playerId), player]));
const legacyPlayers = new Map((season.legacyPlayers || []).map((player) => [String(player.playerId), player]));
const teams = new Map(season.teams.map((team) => [String(team.teamId), team]));
const bosses = new Map(season.bossOrder.map((boss) => [String(boss.teamId), boss]));

assert.strictEqual(season.seasonId, "ie2");
assert.strictEqual(players.size, season.players.length, "Ares active player IDs must remain unique");
assert.strictEqual(season.players.length, 166, "Ares active player cardinality must stay unchanged");

const corrected = new Map([
  ["163", ["4465", "Ricky Clover", "kirkwood"]],
  ["165", ["4467", "York Nashmith", "kirkwood"]],
  ["167", ["4469", "Marvin Murdock", "kirkwood"]],
  ["168", ["4470", "Thomas Murdock", "kirkwood"]],
  ["169", ["4471", "Tyler Murdock", "kirkwood"]],

  ["21", ["4499", "Peter Drent", "royal_academy_ares"]],
  ["22", ["4500", "Ben Simmons", "royal_academy_ares"]],
  ["24", ["4502", "Gus Martin", "royal_academy_ares"]],
  ["25", ["4503", "Herman Waldon", "royal_academy_ares"]],
  ["26", ["4504", "John Bloom", "royal_academy_ares"]],
  ["27", ["4505", "Derek Swing", "royal_academy_ares"]],
  ["28", ["4506", "Daniel Hatch", "royal_academy_ares"]],
  ["30", ["4507", "David Samford", "royal_academy_ares"]],

  ["1157", ["4533", "Spike Gleeson", "alpine"]],
  ["1159", ["4535", "Kerry Bootgaiter", "alpine"]],
  ["1168", ["4540", "Quentin Rackner", "alpine"]],
]);

for (const [oldId, [newId, expectedName, teamId]] of corrected) {
  assert.strictEqual(players.has(oldId), false, `old Ares ID ${oldId} must not remain active`);
  const player = players.get(newId);
  const legacy = legacyPlayers.get(oldId);
  const visual = visuals.players[newId];
  const team = teams.get(teamId);
  const boss = bosses.get(teamId);

  assert.ok(player, `canonical Ares player ${newId} must exist`);
  assert.ok(legacy, `legacy Ares lookup ${oldId} must exist`);
  assert.strictEqual(player.name, expectedName);
  assert.strictEqual(legacy.name, expectedName);
  assert.ok(visual, `visual master must contain ${newId}`);
  assert.strictEqual(visual.name, expectedName, `mapping must be name-matched for ${expectedName}`);
  assert.strictEqual(player.portraitUrl, visual.portraitUrl, `${expectedName} portrait must come from ${newId}`);
  assert.strictEqual(player.frontFullbodyUrl, visual.frontFullbodyUrl, `${expectedName} fullbody must come from ${newId}`);
  assert.strictEqual(legacy.portraitUrl, visual.portraitUrl, `historical ${expectedName} must display corrected portrait`);
  assert.strictEqual(legacy.frontFullbodyUrl, visual.frontFullbodyUrl, `historical ${expectedName} must display corrected fullbody`);
  assert.strictEqual(season.legacyPlayerIdAliases?.[oldId], newId, `legacy alias ${oldId} -> ${newId} missing`);

  for (const field of ["name", "position", "element", "category", "finalOverall", "progressionCode"]) {
    assert.deepStrictEqual(player[field], legacy[field], `${expectedName} gameplay field ${field} must not change during identity correction`);
  }
  assert.deepStrictEqual(player.finalStats, legacy.finalStats, `${expectedName} finalStats must stay unchanged`);

  assert.ok(team.playerIds.map(String).includes(newId), `${teamId} must contain canonical ${newId}`);
  assert.strictEqual(team.playerIds.map(String).includes(oldId), false, `${teamId} must not contain legacy ${oldId}`);
  assert.ok(boss.rewardPoolPlayerIds.map(String).includes(newId), `${teamId} reward pool must contain ${newId}`);
  assert.strictEqual(boss.rewardPoolPlayerIds.map(String).includes(oldId), false, `${teamId} reward pool must not contain ${oldId}`);

  if (boss.startingXIPlayerIds.map(String).includes(newId)) {
    assert.strictEqual(boss.startingXIPlayerIds.map(String).includes(oldId), false);
  }
}

const unchangedLowIds = new Map([
  ["kirkwood", ["159", "170", "171", "172", "173", "174"]],
  ["royal_academy_ares", ["16"]],
  ["alpine", ["1169", "1170", "1171", "1172"]],
]);
for (const [teamId, ids] of unchangedLowIds) {
  const team = teams.get(teamId);
  for (const id of ids) {
    assert.ok(players.has(id), `${teamId} unmatched low ID ${id} must remain active because no same-name target exists in the requested high-ID range`);
    assert.ok(team.playerIds.map(String).includes(id), `${teamId} must retain unmatched ${id}`);
  }
}

for (const teamId of ["kirkwood", "royal_academy_ares", "alpine"]) {
  const team = teams.get(teamId);
  const boss = bosses.get(teamId);
  assert.ok(team && boss);
  assert.strictEqual(new Set(team.playerIds.map(String)).size, team.playerIds.length, `${teamId} active roster must remain unique`);
  for (const id of team.playerIds) assert.ok(players.has(String(id)), `${teamId} player ${id} must resolve`);
  assert.deepStrictEqual(
    boss.startingXI.map((entry) => String(entry.playerId)),
    boss.startingXIPlayerIds.map(String),
    `${teamId} boss XI representations must stay aligned`,
  );
  for (const id of boss.startingXIPlayerIds) assert.ok(players.has(String(id)), `${teamId} XI player ${id} must resolve`);
  for (const id of boss.rewardPoolPlayerIds) assert.ok(players.has(String(id)), `${teamId} reward player ${id} must resolve`);
}

async function verifyAresRegistryAndLegacyCompatibility() {
  const context = {
    console,
    fetch: async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(season)) }),
    ProfiledSeasonRuntime: { register: () => {} },
  };
  context.globalThis = context;
  vm.createContext(context);

  vm.runInContext(fs.readFileSync("js/season-registry.js", "utf8"), context, {
    filename: "js/season-registry.js",
  });

  assert.strictEqual(
    context.SeasonRegistry.get("ie2").name,
    "Inazuma Eleven Ares",
    "the target season must be identified by its in-game registry name, not by the JSON internal seasonName",
  );

  const loaded = await context.SeasonRegistry.loadDatabase("ie2");
  const index = context.SeasonRegistry.playersIndex("ie2");
  assert.strictEqual(index.size, loaded.players.length, "legacy Ares records must remain non-enumerable");
  assert.strictEqual(index.get("167")?.name, "Marvin Murdock", "old Ares run ID must still resolve");
  assert.strictEqual(index.get("4469")?.name, "Marvin Murdock", "new Ares canonical ID must resolve");
  assert.strictEqual(index.get("22")?.name, "Ben Simmons");
  assert.strictEqual(index.get("4500")?.name, "Ben Simmons");
  assert.strictEqual(index.get("1157")?.name, "Spike Gleeson");
  assert.strictEqual(index.get("4533")?.name, "Spike Gleeson");

  const identityContext = {
    console,
    SeasonRegistry: {
      database: (seasonId) => String(seasonId) === "ie2" ? season : null,
      isSeasonSource: (source) => String(source) === "ie2",
    },
  };
  identityContext.globalThis = identityContext;
  vm.createContext(identityContext);
  vm.runInContext(fs.readFileSync("js/recruitment/player-identity.js", "utf8"), identityContext, {
    filename: "js/recruitment/player-identity.js",
  });

  assert.strictEqual(identityContext.PlayerIdentity.canonicalPlayerId({ playerId: "167", source: "ie2" }), "4469");
  assert.strictEqual(identityContext.PlayerIdentity.canonicalPlayerId({ playerId: "22", source: "ie2" }), "4500");
  assert.strictEqual(identityContext.PlayerIdentity.canonicalPlayerId({ playerId: "1157", source: "ie2" }), "4533");
  assert.strictEqual(identityContext.PlayerIdentity.canonicalPlayerId({ playerId: "167", source: "free_agents" }), "167", "Ares aliases must stay season-scoped");

  context.AlbumProgress = {
    DEFAULT_COLLECTION_ID: "ie1",
    unlockedSet: () => new Set(["167", "22", "1157"]),
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
    getSeasonPlayersById: () => index,
    getActiveSeason: () => ({ id: "ie2" }),
    loadSeason: async () => loaded,
    isProfileAwareSeason: () => false,
    closeModal: () => {},
    resetRenderedViewScroll: () => {},
    bindSectionRootNav: () => {},
    showPlayerDetailsFor: () => {},
    scrollSnapshot: () => ({}),
    view: { escapeHtml: String, sectionRootButton: () => "", playerCard: () => "" },
  });
  const unlocked = controller.unlockedSet("ie2", {});
  assert.ok(unlocked.has("167") && unlocked.has("4469"), "old Kirkwood Album ID must read as canonical");
  assert.ok(unlocked.has("22") && unlocked.has("4500"), "old Royal Album ID must read as canonical");
  assert.ok(unlocked.has("1157") && unlocked.has("4533"), "old Alpine Album ID must read as canonical");
}

verifyAresRegistryAndLegacyCompatibility()
  .then(() => console.log("Ares Kirkwood/Royal/Alpine canonical IDs, visuals, gameplay preservation and legacy compatibility: ok"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
