const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const catalog = require(path.join(root, "js/album-catalog.js"));
const freeAgents = require(path.join(root, "data/FREE_AGENTS_compact.json")).players;
const season3 = require(path.join(root, "data/IE1_S3_season_compact.json"));
const appSource = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

const low = freeAgents.find((player) => Number(player.finalOverall) === 74);
const threshold = freeAgents.find((player) => Number(player.finalOverall) === 75);
const high = freeAgents.find((player) => Number(player.finalOverall) > 75);
assert(low && threshold && high, "fixtures must cover the S3 Album threshold");

const s3FreeAgents = catalog.freeAgentPlayers(freeAgents, "ie1_s3");
const s3FreeAgentIds = new Set(s3FreeAgents.map((player) => String(player.playerId)));
assert(!s3FreeAgentIds.has(String(low.playerId)), "OVR 74 global FA must be absent from the S3 collection/team roster");
assert(s3FreeAgentIds.has(String(threshold.playerId)), "OVR 75 global FA must remain in the S3 Album");
assert(s3FreeAgentIds.has(String(high.playerId)), "global FA above OVR 75 must remain in the S3 Album");

for (const collectionId of ["ie1", "ie2", "ie1_s2"]) {
  assert.strictEqual(catalog.freeAgentPlayers(freeAgents, collectionId), freeAgents, `${collectionId} must retain the original FA catalog`);
}

const lowProfile = season3.recruitmentPool.entries.find((profile) => profile.sourceKind === "season3_recruitment_profile" && Number(profile.finalOverall) === 72);
assert(lowProfile, "S3 must contain an OVR 72 team recruitment profile fixture");
const profileTeam = season3.teams.find((team) => (team.playerProfileIds || []).includes(lowProfile.profileId));
assert(profileTeam, "the OVR 72 profile must remain assigned to its real team");
const collectionIds = new Set([...season3.players.map((player) => String(player.playerId)), ...s3FreeAgentIds]);
assert(collectionIds.has(String(lowProfile.playerId)), "the OVR 72 team profile's player must remain counted in S3");

const legacyUnlockedIds = new Set([String(low.playerId), String(threshold.playerId), String(lowProfile.playerId)]);
const unlockedInS3Catalog = [...collectionIds].filter((id) => legacyUnlockedIds.has(id));
assert(!unlockedInS3Catalog.includes(String(low.playerId)), "legacy OVR 74 FA unlock must not count in S3 progress");
assert(legacyUnlockedIds.has(String(low.playerId)), "filtering must not delete the stored legacy unlock");

assert.match(appSource, /albumCollectionPlayers[\s\S]*?albumFreeAgentPlayers\(collectionId\)\.forEach/);
assert.match(appSource, /teamId: "__free_agents"[\s\S]*?playerIds: albumFreeAgentPlayers\(collectionId\)\.map/);
assert.match(appSource, /if \(team\?\.freeAgents\) return albumFreeAgentPlayers\(collectionId\)/);
assert.deepStrictEqual(
  s3FreeAgents.map((player) => String(player.playerId)),
  catalog.freeAgentPlayers(freeAgents, "ie1_s3").map((player) => String(player.playerId)),
  "the S3 virtual team IDs must exactly match the central helper catalog",
);

console.log(`ie1-s3-album-free-agents-test: excluded ${freeAgents.length - s3FreeAgents.length}, retained ${s3FreeAgents.length}`);
