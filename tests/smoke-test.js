"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};

require(path.join(root, "js/season1-config.js"));
require(path.join(root, "js/run-state.js"));
require(path.join(root, "js/draft.js"));
require(path.join(root, "js/map-generator.js"));
require(path.join(root, "js/roguelike_progression.js"));
require(path.join(root, "js/game-rules.js"));
require(path.join(root, "js/five-v-five.js"));

const season = JSON.parse(fs.readFileSync(path.join(root, "data/IE1_season_compact.json"), "utf8"));
const free = JSON.parse(fs.readFileSync(path.join(root, "data/FREE_AGENTS_compact.json"), "utf8"));
assert(season.formations.eleven.some((item) => item.id === "4-2-4"), "4-2-4 must exist");

const fiveFormations = global.FiveVFive.formations.map((formation) => formation.id);
assert.deepEqual(fiveFormations, ["1-2-1", "1-1-2"], "only the two 5v5 formations should be available");

const css = fs.readFileSync(path.join(root, "css/game.css"), "utf8");
const appJs = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const mobileMedia = css.slice(css.indexOf("@media (max-width: 780px)"));
assert(mobileMedia.includes(".route-map"), "mobile route map rules must exist");
assert(mobileMedia.includes("min-width: 0"), "mobile route map must remove the 620px minimum width");
assert(mobileMedia.includes("overflow-x: hidden"), "mobile map container must prevent horizontal overflow");
assert(mobileMedia.includes("touch-action: pan-y"), "mobile map must keep vertical panning without horizontal dragging");
assert(mobileMedia.includes("--pitch-card-size"), "mobile squad cards must use a constant base card size");
assert(mobileMedia.includes("var(--pitch-card-size)"), "mobile squad rows must not stretch cards based on row count");
assert(mobileMedia.includes("width: min(100%, calc(100vw - 24px))"), "mobile player detail modal must fit and center inside viewport");
assert(appJs.includes("--players-in-row:${row.ids.length || 1}"), "squad rows must expose player count to CSS grid");
assert(appJs.includes('["five", "5v5", "five"]'), "bottom navigation must include the 5v5 section");
assert(appJs.includes("Completa la Formazione 5v5"), "incomplete 5v5 formations must block 5v5 match nodes");
assert(appJs.includes("trade-squad-layout"), "trade screen must reuse the tactical squad layout");
assert(appJs.includes("showPullConfirmation"), "player pulls must open a confirmation before picking a candidate");
assert(appJs.includes("Il Gettone scout non può essere utilizzato nelle pull leggendarie."), "legendary pulls must block scout token rerolls in logic and UI");
assert(css.includes("width: min(94%, 470px)"), "desktop fullbody player art must be enlarged");
assert(mobileMedia.includes("width: min(88%, 330px)"), "mobile fullbody player art must be moderately enlarged");

const expectedFormationRows = {
  "4-3-3": [3, 3, 4, 1],
  "4-4-2": [2, 4, 4, 1],
  "4-2-4": [4, 2, 4, 1],
  "3-4-3": [3, 4, 3, 1],
  "5-4-1": [1, 4, 5, 1],
  "4-5-1": [1, 5, 4, 1],
};
for (const formation of season.formations.eleven) {
  assert.deepEqual(
    [formation.requirements.FW, formation.requirements.MF, formation.requirements.DF, formation.requirements.GK],
    expectedFormationRows[formation.id],
    `${formation.id} must render tactical rows without wrapping/reordering`
  );
}

assert.equal(global.RoguelikeRules.defeatedBossRewardLevel(season.bossOrder[0]), 1);
assert.equal(global.RoguelikeRules.defeatedBossRewardLevel(season.bossOrder[1]), 3);
assert.equal(global.RoguelikeRules.unlockedPullLevel(season, 2), 3);
const wildTeam = season.teams.find((team) => team.teamId === "wild");
const migratedRun = {
  completedBossIds: ["occult", "wild"],
  roster: [{ playerId: String(wildTeam.playerIds[0]), source: "season1", level: 1 }],
};
assert.equal(global.RoguelikeRules.migrateDefeatedBossPlayerLevels(migratedRun, season), 1);
assert.equal(migratedRun.roster[0].level, 3);
assert.equal(Object.values(global.SEASON1_CONFIG.nodeWeights).reduce((sum, value) => sum + value, 0), 100);
assert.equal(Object.values(global.SEASON1_CONFIG.hiddenNodeWeights).reduce((sum, value) => sum + value, 0), 100);
assert.equal(global.SEASON1_CONFIG.maxInventory, 20);

const outgoing = free.players.find((player) => player.position === "FW" && player.finalOverall >= 74);
const tradeCandidates = global.RoguelikeRules.getTradeCandidates({
  outgoingPlayer: outgoing,
  rosterIds: [outgoing.playerId],
  freeAgents: free.players,
  seasonPlayers: season.players,
  unlockedTeamIds: ["occult", "wild"],
  teams: season.teams,
});
assert(tradeCandidates.length > 0);
assert(tradeCandidates.every(({ player }) => player.position === outgoing.position));
assert(tradeCandidates.every(({ player }) => player.finalOverall >= outgoing.finalOverall));

const equippedStats = global.RoguelikeRules.applyEquipment(
  { attack: 99, control: 70 },
  { stat: "attack", bonus: 5 }
);
assert.equal(equippedStats.attack, 104);
assert.equal(equippedStats.control, 70);

let run;
for (const formation of season.formations.eleven) {
  run = global.RunState.createRun();
  run.formationId = formation.id;
  global.DraftEngine.start(run, formation, free.players);
  while (run.draft) {
    const candidate = run.draft.candidates[0];
    global.DraftEngine.choose(run, candidate, free.players, formation);
  }

  assert.equal(run.roster.length, 11);
  assert.equal(run.lineup.length, 11);
  assert.equal(new Set(run.roster.map((entry) => entry.playerId)).size, 11);
  const roleCounts = run.lineup.reduce((counts, id) => {
    const player = free.players.find((candidate) => String(candidate.playerId) === String(id));
    counts[player.position] = (counts[player.position] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(roleCounts, formation.requirements);
}


const roleOf = (id) => free.players.find((player) => String(player.playerId) === String(id))?.position;
const fiveState = global.FiveVFive.ensure(run, roleOf);
assert.equal(fiveState.formation, "1-2-1", "new drafted runs default to the 1-2-1 5v5 formation");
assert.equal(Object.keys(fiveState.slots).length, 5, "5v5 formation must have exactly five slots");
let fiveStatus = global.FiveVFive.validate(run, roleOf);
assert.equal(fiveStatus.valid, true, fiveStatus.messages.join("; "));
assert.equal(new Set(Object.values(fiveState.slots)).size, 5, "5v5 formation must not duplicate players");
const originalLineup = run.lineup.join(",");
global.FiveVFive.changeFormation(run, "1-1-2", roleOf);
fiveStatus = global.FiveVFive.validate(run, roleOf);
assert.equal(Object.keys(run.fiveVFive.slots).length, 5);
assert.equal(run.lineup.join(","), originalLineup, "changing 5v5 formation must not modify 11v11 lineup");
global.FiveVFive.clearSlot(run, "FW2");
assert.equal(global.FiveVFive.validate(run, roleOf).valid, false, "incomplete 5v5 formations are not valid");
global.RunState.save(run);
const loadedFive = global.RunState.load().fiveVFive;
assert.deepEqual(loadedFive, run.fiveVFive, "5v5 formation must persist through save/load");
const removedFiveId = Object.values(run.fiveVFive.slots).find(Boolean);
run.roster = run.roster.filter((entry) => String(entry.playerId) !== String(removedFiveId));
global.FiveVFive.removeUnavailable(run);
assert(!Object.values(run.fiveVFive.slots).includes(removedFiveId), "removed roster players must leave the 5v5 formation");
const legacyRun = { roster: run.roster, fiveVFive: undefined };
global.FiveVFive.ensure(legacyRun, roleOf);
assert.equal(legacyRun.fiveVFive.formation, "1-2-1", "legacy runs receive a default 5v5 state");

const sampleEntry = run.roster[0];
const sample = free.players.find((player) => String(player.playerId) === sampleEntry.playerId);
const atZero = global.InazumaProgression.getPlayerAtLevel(sample, 0, free);
assert.equal(atZero.overall, sample.finalOverall - 20);

run.currentZone = global.MapEngine.generate(run, season.bossOrder[0]);
assert(run.currentZone.nodes.some((node) => node.type === "boss"));
assert(global.MapEngine.reachableNodeIds(run.currentZone).length > 0);
const hiddenNode = { id: "hidden-test", type: "random" };
const hiddenType = global.MapEngine.resolveRandomNodeType(run, hiddenNode);
assert(["five_v_five", "item", "pull_free_agents", "trade"].includes(hiddenType));
assert.equal(global.MapEngine.resolveRandomNodeType(run, hiddenNode), hiddenType);

run.bossIndex = 4;
run.unlockedTeamIds = ["occult", "wild", "brainwashing", "otaku"];
run.currentZone.seed = "hidden-distribution";
run.randomEventHistory = [];
const hiddenCounts = {};
let previousHiddenType = null;
for (let index = 0; index < 10000; index += 1) {
  const type = global.MapEngine.resolveRandomNodeType(run, { id: `hidden-${index}` });
  assert.notEqual(type, previousHiddenType, "hidden events must not repeat consecutively");
  previousHiddenType = type;
  hiddenCounts[type] = (hiddenCounts[type] || 0) + 1;
}
for (const type of Object.keys(global.SEASON1_CONFIG.hiddenNodeWeights)) {
  const actualShare = hiddenCounts[type] / 10000;
  assert(actualShare > 0.08, `${type} hidden share too low: ${actualShare}`);
  assert(actualShare < 0.28, `${type} hidden share too high: ${actualShare}`);
}
run.bossIndex = 0;
run.unlockedTeamIds = [];
global.RunState.createCheckpoint(run);
const originalStart = run.currentZone.currentNodeId;
run.currentZone.currentNodeId = "changed";
global.RunState.restoreAfterLoss(run);
assert.equal(run.lives, 2);
assert.equal(run.currentZone.currentNodeId, originalStart);

console.log("Smoke test passed: all formations, progression, map and checkpoint loss.");
