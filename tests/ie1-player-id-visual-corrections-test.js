"use strict";

const assert = require("assert");
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

console.log("IE1 corrected canonical ids, removals, portraits, fullbody mappings and boss lineups: ok");
