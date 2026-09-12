"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const season = require("../data/IE1_S3_season_compact.json");
const visuals = require("../data/PLAYER_VISUALS.json");

assert.strictEqual(season.seasonId, "ie1_s3");
assert.strictEqual(season.seasonName, "Inazuma Eleven 3");
assert.strictEqual(season.requiresProfileAwareRuntime, true);

const players = new Map(season.players.map((player) => [String(player.playerId), player]));
const profiles = new Map(season.profiles.map((profile) => [String(profile.profileId), profile]));
const legacyPlayers = new Map((season.legacyPlayers || []).map((player) => [String(player.playerId), player]));
const legacyProfiles = new Map((season.legacyProfiles || []).map((profile) => [String(profile.profileId), profile]));
const kirkwood = season.teams.find((team) => String(team.teamId) === "kirkwood");

assert.ok(kirkwood, "Kirkwood must be found from the IE3 in-game team identity");
assert.strictEqual(kirkwood.teamName, "Kirkwood");
assert.strictEqual(kirkwood.playerIds.length, 15);
assert.strictEqual(new Set(kirkwood.playerIds.map(String)).size, 15);
assert.strictEqual(kirkwood.playerProfileIds.length, 15);
assert.strictEqual(new Set(kirkwood.playerProfileIds.map(String)).size, 15);

const expected = new Map([
  ["161", "Alfred Meenan"],
  ["162", "Dan Mirthful"],
  ["160", "Malcolm Night"],
  ["164", "Toby Damian"],
  ["166", "Zachary Moore"],
]);

for (const [playerId, name] of expected) {
  const player = players.get(playerId);
  const profile = profiles.get(`${playerId}@kirkwood`);
  const visual = visuals.players[playerId];
  assert.ok(player, `${name} must exist as active player ${playerId}`);
  assert.ok(profile, `${name} must exist as active Kirkwood profile`);
  assert.strictEqual(player.name, name);
  assert.strictEqual(profile.name, name);
  assert.strictEqual(player.portraitUrl, visual.portraitUrl, `${name} portrait must use canonical visual`);
  assert.strictEqual(player.frontFullbodyUrl, visual.frontFullbodyUrl, `${name} fullbody must use canonical visual`);
  assert.strictEqual(profile.portraitUrl, visual.portraitUrl, `${name} profile portrait must use canonical visual`);
  assert.strictEqual(profile.frontFullbodyUrl, visual.frontFullbodyUrl, `${name} profile fullbody must use canonical visual`);
  assert.ok(kirkwood.playerIds.map(String).includes(playerId), `${name} must be in Kirkwood playerIds`);
  assert.ok(kirkwood.playerProfileIds.map(String).includes(`${playerId}@kirkwood`), `${name} must be in Kirkwood profileIds`);
}

for (const badId of ["4462", "4464", "4466"]) {
  assert.strictEqual(players.has(badId), false, `legacy player ${badId} must not stay in active IE3 players`);
  assert.strictEqual(kirkwood.playerIds.map(String).includes(badId), false, `legacy player ${badId} must not stay in active Kirkwood`);
}
for (const badProfile of ["4462@kirkwood", "4464@kirkwood", "4466@kirkwood"]) {
  assert.strictEqual(profiles.has(badProfile), false, `legacy profile ${badProfile} must not stay active`);
  assert.strictEqual(kirkwood.playerProfileIds.map(String).includes(badProfile), false, `legacy profile ${badProfile} must not stay in Kirkwood`);
}

assert.strictEqual(
  season.players.filter((player) => player.name === "Toby Damian").length,
  1,
  "IE3 active catalog must contain only one Toby Damian",
);
assert.strictEqual(players.get("164").name, "Toby Damian", "the retained Toby Damian must be ID 164");

const moore = players.get("166");
const mooreProfile = profiles.get("166@kirkwood");
assert.strictEqual(moore.finalOverall, 77, "Zachary Moore must have requested overall 77");
assert.strictEqual(mooreProfile.finalOverall, 77);
assert.strictEqual(moore.position, "MF");
assert.strictEqual(moore.element, "Forest");
assert.deepStrictEqual(moore.ratings, {
  attack: 7,
  physical: 7,
  stamina: 9,
  control: 8,
  defense: 8,
  speed: 8,
  grit: 9,
  save: 1,
});

assert.strictEqual(season.legacyPlayerIdAliases["4462"], "160");
assert.strictEqual(season.legacyPlayerIdAliases["4464"], "162");
assert.strictEqual(season.legacyPlayerIdAliases["4466"], "164");

const legacyNight = legacyPlayers.get("4462");
const legacyNightProfile = legacyProfiles.get("4462@kirkwood");
const canonicalNight = players.get("160");
const canonicalNightProfile = profiles.get("160@kirkwood");
assert.ok(legacyNight && legacyNightProfile, "pre-correction Malcolm Night snapshot must remain lookup-only");
for (const field of ["name", "position", "normalizedRole", "element", "type", "category", "finalOverall", "maxLevel"]) {
  assert.deepStrictEqual(canonicalNight[field], legacyNight[field], `Night gameplay field ${field} must survive the ID correction`);
  assert.deepStrictEqual(canonicalNightProfile[field], legacyNightProfile[field], `Night profile field ${field} must survive the ID correction`);
}
assert.deepStrictEqual(canonicalNight.ratings, legacyNight.ratings, "Night player ratings must be unchanged");
assert.deepStrictEqual(canonicalNightProfile.ratings, legacyNightProfile.ratings, "Night profile ratings must be unchanged");
assert.strictEqual(legacyNight.portraitUrl, visuals.players["160"].portraitUrl);
assert.strictEqual(legacyNight.frontFullbodyUrl, visuals.players["160"].frontFullbodyUrl);

const legacyMirthful = legacyPlayers.get("4464");
const legacyMirthfulProfile = legacyProfiles.get("4464@kirkwood");
const canonicalMirthful = players.get("162");
const canonicalMirthfulProfile = profiles.get("162@kirkwood");
assert.ok(legacyMirthful && legacyMirthfulProfile, "pre-correction Dan Mirthful snapshot must remain lookup-only");
for (const field of ["name", "position", "normalizedRole", "element", "type", "category", "finalOverall", "maxLevel"]) {
  assert.deepStrictEqual(canonicalMirthful[field], legacyMirthful[field], `Mirthful gameplay field ${field} must survive the ID correction`);
  assert.deepStrictEqual(canonicalMirthfulProfile[field], legacyMirthfulProfile[field], `Mirthful profile field ${field} must survive the ID correction`);
}
assert.deepStrictEqual(canonicalMirthful.ratings, legacyMirthful.ratings, "Mirthful player ratings must stay IE3-specific");
assert.deepStrictEqual(canonicalMirthfulProfile.ratings, legacyMirthfulProfile.ratings, "Mirthful profile ratings must stay IE3-specific");
assert.strictEqual(canonicalMirthful.finalOverall, 75, "IE3 Mirthful keeps his IE3 overall instead of importing Ares/other-season gameplay data");
assert.strictEqual(legacyMirthful.portraitUrl, visuals.players["162"].portraitUrl);
assert.strictEqual(legacyMirthful.frontFullbodyUrl, visuals.players["162"].frontFullbodyUrl);

const legacyToby = legacyPlayers.get("4466");
const legacyTobyProfile = legacyProfiles.get("4466@kirkwood");
assert.ok(legacyToby && legacyTobyProfile, "pre-correction duplicate Toby snapshot must remain lookup-only");
assert.strictEqual(legacyToby.finalOverall, 77, "historical high Toby keeps historical run stats");
assert.strictEqual(players.get("164").finalOverall, 75, "active canonical Toby 164 keeps its own requested profile");
assert.strictEqual(legacyToby.portraitUrl, visuals.players["164"].portraitUrl);
assert.strictEqual(legacyToby.frontFullbodyUrl, visuals.players["164"].frontFullbodyUrl);

const kirkwoodPool = season.recruitmentPool.entries.filter((entry) => entry.sourceTeamId === "kirkwood");
assert.strictEqual(kirkwoodPool.length, 15, "Kirkwood recruitment pool cardinality must stay stable");
assert.strictEqual(kirkwoodPool.some((entry) => String(entry.playerId) === "4462"), false);
assert.strictEqual(kirkwoodPool.some((entry) => String(entry.playerId) === "4464"), false);
assert.strictEqual(kirkwoodPool.some((entry) => String(entry.playerId) === "4466"), false);
assert.ok(kirkwoodPool.some((entry) => String(entry.playerId) === "160" && entry.profileId === "160@kirkwood"));
assert.ok(kirkwoodPool.some((entry) => String(entry.playerId) === "162" && entry.profileId === "162@kirkwood"));
assert.ok(kirkwoodPool.some((entry) => String(entry.playerId) === "164" && entry.profileId === "164@kirkwood"));
assert.ok(kirkwoodPool.some((entry) => String(entry.playerId) === "166" && entry.profileId === "166@kirkwood" && entry.finalOverall === 77));

assert.strictEqual(season.players.length, 584);
assert.strictEqual(season.profiles.length, 584);
assert.strictEqual(season.recruitmentPool.entries.length, 291);
assert.strictEqual(season.summary.canonicalPlayers, 584);
assert.strictEqual(season.summary.profiles, 584);
assert.strictEqual(season.summary.recruitmentPoolPlayers, 291);
assert.strictEqual(season.validation.counts.canonicalPlayers, 584);
assert.strictEqual(season.validation.counts.profiles, 584);
assert.strictEqual(season.validation.counts.recruitmentPoolPlayers, 291);

const context = {
  console,
  InazumaProgression: {
    getPlayerAtLevel: (base) => ({ ...base }),
  },
  SeasonRegistry: {
    database: (seasonId) => String(seasonId) === "ie1_s3" ? season : null,
    player: () => null,
    isSeasonSource: (source) => String(source) === "ie1_s3",
  },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/recruitment/player-identity.js", "utf8"), context, {
  filename: "js/recruitment/player-identity.js",
});
assert.strictEqual(
  context.PlayerIdentity.canonicalPlayerId({ playerId: "4462", source: "ie1_s3" }),
  "160",
  "historical Night ownership must canonicalize to 160 without rewriting the run",
);
assert.strictEqual(
  context.PlayerIdentity.canonicalPlayerId({ playerId: "4464", source: "ie1_s3" }),
  "162",
  "historical Mirthful ownership must canonicalize to 162",
);
assert.strictEqual(
  context.PlayerIdentity.canonicalPlayerId({ playerId: "4466", source: "ie1_s3" }),
  "164",
  "historical duplicate Toby ownership must canonicalize to 164",
);
assert.strictEqual(
  context.PlayerIdentity.canonicalPlayerId({ playerId: "4462", source: "free_agents" }),
  "4462",
  "aliases must be season-scoped and must not affect unrelated sources",
);

vm.runInContext(fs.readFileSync("js/profiled-season.js", "utf8"), context, {
  filename: "js/profiled-season.js",
});
context.ProfiledSeasonRuntime.register("ie1_s3", JSON.parse(JSON.stringify(season)));

assert.strictEqual(context.ProfiledSeasonRuntime.resolveCanonicalPlayer("ie1_s3", "160").name, "Malcolm Night");
assert.strictEqual(context.ProfiledSeasonRuntime.resolveCanonicalPlayer("ie1_s3", "4462").name, "Malcolm Night");
assert.strictEqual(context.ProfiledSeasonRuntime.resolveProfile("ie1_s3", "160@kirkwood").name, "Malcolm Night");
assert.strictEqual(context.ProfiledSeasonRuntime.resolveProfile("ie1_s3", "4462@kirkwood").name, "Malcolm Night");
assert.strictEqual(context.ProfiledSeasonRuntime.resolveCanonicalPlayer("ie1_s3", "4464").name, "Dan Mirthful");
assert.strictEqual(context.ProfiledSeasonRuntime.resolveProfile("ie1_s3", "4464@kirkwood").name, "Dan Mirthful");
assert.strictEqual(context.ProfiledSeasonRuntime.resolveCanonicalPlayer("ie1_s3", "4466").name, "Toby Damian");
assert.strictEqual(context.ProfiledSeasonRuntime.resolveProfile("ie1_s3", "4466@kirkwood").finalOverall, 77);

const oldNightRun = {
  seasonId: "ie1_s3",
  roster: [{
    playerId: "4462",
    source: "ie1_s3",
    activeProfileId: "4462@kirkwood",
    activeRoleVariantId: "df",
    level: 5,
    levelUnits: 0,
  }],
};
const duplicateNightAttempt = context.ProfiledSeasonRuntime.acquireOrUpgradeProfile(
  oldNightRun,
  { playerId: "160", profileId: "160@kirkwood" },
  { seasonId: "ie1_s3", maxRoster: 15, level: 5 },
);
assert.strictEqual(duplicateNightAttempt.status, "ineligible", "old Night must block recruiting canonical Night as a second card");
assert.strictEqual(oldNightRun.roster.length, 1, "duplicate canonicalization must not mutate the historical roster");

const oldMirthfulRun = {
  seasonId: "ie1_s3",
  roster: [{
    playerId: "4464",
    source: "ie1_s3",
    activeProfileId: "4464@kirkwood",
    activeRoleVariantId: "df",
    level: 3,
    levelUnits: 0,
  }],
};
const duplicateMirthfulAttempt = context.ProfiledSeasonRuntime.acquireOrUpgradeProfile(
  oldMirthfulRun,
  { playerId: "162", profileId: "162@kirkwood" },
  { seasonId: "ie1_s3", maxRoster: 15, level: 3 },
);
assert.strictEqual(duplicateMirthfulAttempt.status, "ineligible", "old Mirthful must block recruiting canonical Mirthful 162 as a second card");
assert.strictEqual(oldMirthfulRun.roster.length, 1);

const oldTobyRun = {
  seasonId: "ie1_s3",
  roster: [{
    playerId: "4466",
    source: "ie1_s3",
    activeProfileId: "4466@kirkwood",
    activeRoleVariantId: "mf",
    level: 4,
    levelUnits: 0,
  }],
};
const duplicateTobyAttempt = context.ProfiledSeasonRuntime.acquireOrUpgradeProfile(
  oldTobyRun,
  { playerId: "164", profileId: "164@kirkwood" },
  { seasonId: "ie1_s3", maxRoster: 15, level: 4 },
);
assert.strictEqual(duplicateTobyAttempt.status, "ineligible", "old high Toby must block recruiting Toby 164 as a duplicate");
assert.strictEqual(oldTobyRun.roster.length, 1);

const historicalNight = context.ProfiledSeasonRuntime.resolveEffectiveBase({
  playerId: "4462",
  activeProfileId: "4462@kirkwood",
  activeRoleVariantId: "df",
}, "ie1_s3");
assert.strictEqual(historicalNight.name, "Malcolm Night");
assert.strictEqual(historicalNight.finalOverall, 80);
assert.strictEqual(historicalNight.portraitUrl, visuals.players["160"].portraitUrl);
assert.strictEqual(historicalNight.frontFullbodyUrl, visuals.players["160"].frontFullbodyUrl);

const historicalToby = context.ProfiledSeasonRuntime.resolveEffectiveBase({
  playerId: "4466",
  activeProfileId: "4466@kirkwood",
  activeRoleVariantId: "mf",
}, "ie1_s3");
assert.strictEqual(historicalToby.name, "Toby Damian");
assert.strictEqual(historicalToby.finalOverall, 77, "old run must keep the historical high Toby stats");
assert.strictEqual(historicalToby.frontFullbodyUrl, visuals.players["164"].frontFullbodyUrl);

context.AlbumProgress = {
  DEFAULT_COLLECTION_ID: "ie1",
  unlockedSet: () => new Set(["4462", "4464", "4466"]),
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
  getSeasonDb: () => season,
  getFreeAgentsDb: () => ({ players: [] }),
  getSeasonPlayersById: () => players,
  getActiveSeason: () => ({ id: "ie1_s3" }),
  loadSeason: async () => season,
  isProfileAwareSeason: () => true,
  closeModal: () => {},
  resetRenderedViewScroll: () => {},
  bindSectionRootNav: () => {},
  showPlayerDetailsFor: () => {},
  scrollSnapshot: () => ({}),
  view: { escapeHtml: String, sectionRootButton: () => "", playerCard: () => "" },
});
const unlocked = controller.unlockedSet("ie1_s3", {});
assert.ok(unlocked.has("4462"), "stored old Night unlock remains untouched");
assert.ok(unlocked.has("4464"), "stored old Mirthful unlock remains untouched");
assert.ok(unlocked.has("4466"), "stored old Toby unlock remains untouched");
assert.ok(unlocked.has("160"), "old Night unlock is recognized as canonical 160");
assert.ok(unlocked.has("162"), "old Mirthful unlock is recognized as canonical 162");
assert.ok(unlocked.has("164"), "old duplicate Toby unlock is recognized as canonical 164");
assert.strictEqual(unlocked.has("166"), false, "Moore is not synthesized as unlocked");

console.log("IE3 Kirkwood canonical IDs, Moore 77, visuals, pool and historical compatibility: ok");
