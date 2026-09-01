"use strict";
const assert = require("assert");
const fs = require("fs");

const rules = fs.readFileSync("firestore.rules", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const db = JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json", "utf8"));

assert.match(rules, /function isRunSector\(name\)\s*\{\s*return name in \[\s*'run_ie1',\s*'run_ie2',\s*'run_ie1_s2',\s*'run_ie1_s3'\s*\];\s*\}/);
assert.match(rules, /allowedSector\(sectorId\)/);
assert.match(rules, /validSectorRevisionStep\(old, fresh, 'run_ie1_s2'\)/);
assert.match(rules, /!isRunSector\(sectorId\)/);
assert.doesNotMatch(rules, /sectorId in \['run_ie1','run_ie2'\]/);
assert.match(rules, /name in old\.sectorRevisions/, "legacy manifests may introduce the new revision key on their next update");

const teamsById = new Map(db.teams.map((team) => [String(team.teamId), team]));
const ordered = [
  ...db.bossOrder.map((boss) => teamsById.get(String(boss.teamId))),
  ...db.specialMatches.map((match) => teamsById.get(String(match.teamId))),
];
assert.strictEqual(ordered.length, 17);
assert.strictEqual(new Set(ordered.map((team) => team.teamId)).size, 17);
assert.deepStrictEqual(ordered.slice(0, 10).map((team) => team.teamId), db.bossOrder.map((boss) => boss.teamId));
assert.deepStrictEqual(ordered.slice(10).map((team) => team.teamId), db.specialMatches.map((match) => match.teamId));
for (const name of ["Secret Service", "Alpine ie2", "Cloister Divinity", "Super Triple C", "Fauxshore", "Mary Times", "Zeus"]) {
  assert(ordered.some((team) => team.teamName === name), `${name} is visible in the Album`);
}
assert.match(app, /isProfileAwareSeason\(collectionId\) && team\?\.playerProfileIds\?\.length/);
assert.doesNotMatch(app, /run\?\.seasonId === "ie1_s2" && team\?\.playerProfileIds/);
assert.match(app, /Promise\.all\(Object\.values\(global\.AlbumProgress\.ALBUM_COLLECTIONS\)/);
assert.match(app, /albumTeamsView\(collectionId\)/);
assert.match(app, /albumTeamPlayers\(team, collectionId\)/);

for (const [teamId, profileId] of [["fauxshore", "1226@fauxshore"], ["raimon_inazuma_eleven_2", "1226@raimon_inazuma_eleven_2"], ["epsilon", "1070@epsilon"], ["epsilon_plus", "1070@epsilon_plus"]]) {
  assert(teamsById.get(teamId).playerProfileIds.includes(profileId), `${profileId} belongs to ${teamId}`);
}
assert(db.players.some((player) => String(player.playerId) === "1162"));
assert(db.players.some((player) => String(player.playerId) === "1166"));

assert.match(app, /pullCandidateKind: "free_agent"/);
assert.match(app, /pullCandidateKind: "season_profile"/);
assert.match(app, /function canonicalCandidatePlayerId/);
assert.match(app, /function isPullCandidateEligible/);
assert.match(app, /isSeasonProfileCandidate\(player\)/);
assert.match(app, /new Map\(candidates\.map\(\(player\) => \[canonicalCandidatePlayerId\(player\), player\]\)\)/);
assert.match(app, /candidateIds = deduplicated\.map\(pullCandidateKey\)/);
assert.match(app, /playerCard\(candidate, \{ button: true, context: "pull"[^\n]+resolvedPlayer: candidate/);
assert.doesNotMatch(app, /benchPlayers\.map\(\(candidate\) => playerCard\(sourcePlayer/);

console.log("ie1-s2-final-fixes-test: rules, 17-team Album, mixed pull and resolved bench cards OK");
