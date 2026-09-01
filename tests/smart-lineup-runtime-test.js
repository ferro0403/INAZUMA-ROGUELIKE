const assert = require("assert");

require("../js/smart-lineup.js");

const roles = { blue: "FW", purple: "FW", mf83: "MF", mf84: "MF", gk: "GK", df: "DF" };
const overalls = { blue: 78, purple: 76, mf83: 80, mf84: 80, gk: 70, df: 70 };
const potentials = { blue: 80, purple: 90, mf83: 83, mf84: 84, gk: 70, df: 70 };

globalThis.InazumaProgression = {
  getPlayerAtLevel(player) {
    return { overall: overalls[player.playerId], potential: potentials[player.playerId] };
  },
};

globalThis.ProfiledSeasonRuntime = {
  resolveEffectivePlayerAtLevel(entry) {
    return { overall: overalls[entry.playerId], potential: potentials[entry.playerId] };
  },
};

globalThis.RunState = {
  loadProfile() { return { preferences: { smartAutoLineup: true } }; },
  save(run) { return run; },
};

globalThis.DraftEngine = {
  choose(run) {
    run.draft = null;
    return true;
  },
};

globalThis.FiveVFive = {
  formationById() {
    return { slots: [
      { key: "FW", role: "FW" },
      { key: "MF", role: "MF" },
      { key: "GK", role: "GK" },
      { key: "DF", role: "DF" },
    ] };
  },
  ensure(run) {
    run.fiveVFive = run.fiveVFive || {
      formation: "test",
      slots: { FW: "purple", MF: "mf83", GK: "gk", DF: "df" },
    };
    return run.fiveVFive;
  },
};

require("../js/smart-lineup-runtime.js");

const run = {
  runId: "smart-runtime-test",
  formationId: "old",
  draft: {},
  roster: Object.keys(roles).map((playerId) => ({ playerId, level: 0, levelUnits: 0 })),
  lineup: ["blue", "mf83", "gk", "df"],
  bench: ["purple", "mf84"],
};

const getRole = (id) => roles[id];
const getOverall = (id) => globalThis.InazumaProgression.getPlayerAtLevel({ playerId: id }).overall;

globalThis.DraftEngine.choose(run);
globalThis.FiveVFive.ensure(run, getRole, getOverall);
assert.strictEqual(run.fiveVFive.slots.FW, "blue", "Draft completion must immediately optimize 5v5 by current Overall");
assert.strictEqual(run.fiveVFive.slots.MF, "mf84", "Draft completion must use potential as equal-Overall tiebreaker");
assert.strictEqual(run.lineup[1], "mf84", "Draft completion must also normalize equal-Overall starter ties");

overalls.purple = 79;
run.roster.find((entry) => entry.playerId === "purple").level = 1;
globalThis.RunState.save(run);
assert.strictEqual(run.lineup[0], "purple", "A level/Overall change must trigger full 11v11 reevaluation");
assert.strictEqual(run.fiveVFive.slots.FW, "purple", "A level/Overall change must trigger full 5v5 reevaluation");

run.lineup = ["blue", "mf83", "gk", "df"];
run.bench = ["purple", "mf84"];
run.fiveVFive.slots.FW = "blue";
run.fiveVFive.slots.MF = "mf83";
run.formationId = "new";
globalThis.RunState.save(run);
assert.strictEqual(run.lineup[0], "purple", "Changing 11v11 formation must restore the strongest FW");
assert.strictEqual(run.lineup[1], "mf84", "Changing 11v11 formation must use potential to break equal-Overall ties");
assert.strictEqual(run.fiveVFive.slots.FW, "blue", "Changing only the 11v11 formation must not rewrite the 5v5 lineup");
assert.strictEqual(run.fiveVFive.slots.MF, "mf83", "Changing only the 11v11 formation must leave 5v5 untouched");

console.log("smart-lineup-runtime-test: ok");
