const assert = require("assert");

require("../js/smart-lineup.js");

const roleById = {
  blue: "FW",
  purple: "FW",
  mf83: "MF",
  mf84: "MF",
  gk: "GK",
  df: "DF",
};

const overallById = {
  blue: 78,
  purple: 76,
  mf83: 80,
  mf84: 80,
  gk: 70,
  df: 70,
};

const potentialById = {
  blue: 80,
  purple: 90,
  mf83: 83,
  mf84: 84,
  gk: 70,
  df: 70,
};

const run = {
  roster: Object.keys(roleById).map((playerId) => ({ playerId })),
  lineup: ["blue", "mf83", "gk", "df"],
  bench: ["purple", "mf84"],
  fiveVFive: {
    formation: "test",
    slots: { FW: "purple", MF: "mf83", GK: "gk", DF: "df" },
  },
};

const fiveFormation = {
  slots: [
    { key: "FW", role: "FW" },
    { key: "MF", role: "MF" },
    { key: "GK", role: "GK" },
    { key: "DF", role: "DF" },
  ],
};

const options = {
  enabled: true,
  getRole: (id) => roleById[id],
  getOverall: (id) => overallById[id],
  getPotential: (id) => potentialById[id],
  elevenSlotRoles: ["FW", "MF", "GK", "DF"],
  fiveFormation,
};

globalThis.SmartLineup.optimizeAllLineups(run, options);
assert.strictEqual(run.lineup[0], "blue", "Higher current Overall must beat higher rarity/potential");
assert.strictEqual(run.lineup[1], "mf84", "Equal Overall must prefer higher potential");
assert.strictEqual(run.fiveVFive.slots.FW, "blue", "5v5 must immediately use the strongest current Overall");
assert.strictEqual(run.fiveVFive.slots.MF, "mf84", "5v5 tie must use higher potential");

overallById.purple = 79;
globalThis.SmartLineup.optimizeAllLineups(run, options);
assert.strictEqual(run.lineup[0], "purple", "Bench player must become starter after overtaking current Overall");
assert.strictEqual(run.fiveVFive.slots.FW, "purple", "5v5 must also promote a player after an Overall overtake");

const unchanged = JSON.stringify(run);
globalThis.SmartLineup.optimizeAllLineups(run, { ...options, enabled: false });
assert.strictEqual(JSON.stringify(run), unchanged, "Disabled smart lineup must never change the formation");

console.log("smart-lineup-regression-test: ok");
