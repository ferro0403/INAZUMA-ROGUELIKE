"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync("js/level-progression.js", "utf8"), context);
const levels = context.globalThis.LevelProgression;

function cleanRun(seasonId, level = 0, units = 0) {
  return { seasonId, teamLevel: level, teamLevelUnits: units, roster: [{ playerId: "test", level, levelUnits: units }] };
}

function apply(run, amount, units = null) {
  return levels.applyRewardToRun(run, { amount, units });
}

// This exercises the same season-aware source of truth consumed by completeFiveMatch().
for (const seasonId of ["ie1", "ie2"]) {
  const run = cleanRun(seasonId);
  for (const expected of [0.5, 1, 1.5, 2]) {
    levels.applyRewardToRun(run, levels.fiveVFiveLevelReward(seasonId));
    assert.strictEqual(run.teamLevel, expected, `${seasonId} team 5v5 progression`);
    assert.strictEqual(run.roster[0].level, expected, `${seasonId} player 5v5 progression`);
    assert.strictEqual(run.roster[0].levelUnits, 0, `${seasonId} remains on the legacy level model`);
  }
}

{
  const run = cleanRun("ie1_s2");
  const expected = [[0, 2], [0, 4], [1, 0], [1, 2]];
  expected.forEach(([level, units]) => {
    levels.applyRewardToRun(run, levels.fiveVFiveLevelReward("ie1_s2"));
    assert.deepStrictEqual([run.teamLevel, run.teamLevelUnits], [level, units]);
    assert.deepStrictEqual([run.roster[0].level, run.roster[0].levelUnits], [level, units]);
  });
}

// Fascia (+0.5 / +3 units), boss (+1 / +6 units), and IE1 S2 special (+6 units).
for (const seasonId of ["ie1", "ie2"]) {
  const run = cleanRun(seasonId);
  apply(run, 0.5); apply(run, 0.5);
  assert.strictEqual(run.teamLevel, 1, `${seasonId} two motivation bands`);
  apply(run, 1);
  assert.strictEqual(run.teamLevel, 2, `${seasonId} boss reward`);
}
{
  const run = cleanRun("ie1_s2");
  apply(run, 0.5, 3); assert.deepStrictEqual([run.teamLevel, run.teamLevelUnits], [0, 3]);
  apply(run, 0.5, 3); assert.deepStrictEqual([run.teamLevel, run.teamLevelUnits], [1, 0]);
  apply(run, 1, 6); assert.deepStrictEqual([run.teamLevel, run.teamLevelUnits], [2, 0], "boss is +6/6");
  apply(run, 1, 6); assert.deepStrictEqual([run.teamLevel, run.teamLevelUnits], [3, 0], "special match is +6/6");
}

// Onigiri changes one player by two whole levels and preserves an IE1 S2 remainder.
{
  const run = cleanRun("ie1_s2", 4, 2);
  run.roster[0].level = Math.min(20, run.roster[0].level + 2);
  assert.deepStrictEqual([run.roster[0].level, run.roster[0].levelUnits], [6, 2]);
}

for (const seasonId of ["ie1", "ie2"]) {
  const run = cleanRun(seasonId, 19.5);
  apply(run, 0.5); apply(run, 0.5);
  assert.strictEqual(run.teamLevel, 20);
  assert.strictEqual(run.roster[0].level, 20);
}
{
  const run = cleanRun("ie1_s2", 19, 4);
  apply(run, 1 / 3, 2); assert.deepStrictEqual([run.teamLevel, run.teamLevelUnits], [20, 0]);
  apply(run, 1, 6); assert.deepStrictEqual([run.teamLevel, run.teamLevelUnits], [20, 0]);
}

assert.strictEqual(levels.formatLegacyLevel(0.5), "0,5");
assert.strictEqual(levels.formatLegacyLevel(1), "1");
assert.strictEqual(levels.formatLegacyLevel(1.5), "1,5");
assert.strictEqual(levels.formatLegacyLevel(3.0000000000000004), "3");
assert.strictEqual(levels.formatLegacyLevel(0.3333333333333333), "0,33");
assert.strictEqual(levels.formatLevel({ level: 0, levelUnits: 2 }, "ie1_s2"), "0 + 1/3");
assert.strictEqual(levels.formatLevel({ level: 0, levelUnits: 3 }, "ie1_s2"), "0 + 0,5");

const app = fs.readFileSync("js/app.js", "utf8");
assert(app.includes("fiveVFiveLevelReward(current.seasonId)"), "completeFiveMatch consumes the transaction-owned season-aware source of truth");

console.log("level-reward-regression-test: season rewards, items, caps and finite Italian formatting OK");
