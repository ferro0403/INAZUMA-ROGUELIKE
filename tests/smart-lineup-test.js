const fs = require("fs");
const vm = require("vm");

function expect(value, message) { if (!value) throw new Error(message); }
const context = { globalThis: {} };
vm.runInNewContext(fs.readFileSync("js/smart-lineup.js", "utf8"), context);
const optimize = context.globalThis.SmartLineup.optimizeLineupsForNewPlayer;
const roles = {};
const overall = {};
const roster = [];
function add(id, role, value) { roster.push({ playerId: id }); roles[id] = role; overall[id] = value; }
add("gk", "GK", 80); add("df1", "DF", 80); add("df2", "DF", 81); add("df3", "DF", 82); add("df4", "DF", 83);
add("mf1", "MF", 80); add("mf2", "MF", 81); add("mf3", "MF", 82);
add("fw87", "FW", 87); add("fw84", "FW", 84); add("fw81", "FW", 81); add("new85", "FW", 85);
const slots433 = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
function makeRun(fiveFormation = "1-1-2") {
  return { roster: roster.map((entry) => ({ ...entry })), lineup: ["gk", "df1", "df2", "df3", "df4", "mf1", "mf2", "mf3", "fw87", "fw84", "fw81"], bench: ["new85"], fiveVFive: { formation: fiveFormation, slots: fiveFormation === "1-1-2" ? { GK: "gk", DF: "df1", MF: "mf1", FW1: "fw87", FW2: "fw81" } : { GK: "gk", DF: "df1", MF1: "mf1", MF2: "mf2", FW: "fw87" } } };
}
const formations = { "1-1-2": { slots: [{ key: "GK", role: "GK" }, { key: "DF", role: "DF" }, { key: "MF", role: "MF" }, { key: "FW1", role: "FW" }, { key: "FW2", role: "FW" }] }, "1-2-1": { slots: [{ key: "GK", role: "GK" }, { key: "DF", role: "DF" }, { key: "MF1", role: "MF" }, { key: "MF2", role: "MF" }, { key: "FW", role: "FW" }] } };
function invoke(run, id, enabled = true) { return optimize(run, id, { enabled, getRole: (key) => roles[key], getOverall: (key) => overall[key], elevenSlotRoles: slots433, fiveFormation: formations[run.fiveVFive.formation], assignFive: (slot, key) => { run.fiveVFive.slots[slot] = key; } }); }

let run = makeRun();
let result = invoke(run, "new85", false);
expect(!result.elevenChanged && !result.fiveChanged && run.lineup.includes("fw81"), "OFF must leave both lineups unchanged");
run = makeRun(); result = invoke(run, "new85");
expect(result.elevenChanged && result.elevenReplacedPlayerId === "fw81", "85 must replace weakest 81 FW in 11v11");
expect(run.lineup.includes("fw87"), "87 FW must remain a starter in 11v11");
expect(run.lineup.includes("new85") && !run.lineup.includes("fw81"), "85 FW must replace 81 FW in 11v11");
expect(run.lineup.includes("fw84"), "84 FW must remain a starter in 11v11");
expect(result.fiveChanged && run.fiveVFive.slots.FW2 === "new85", "1-1-2 must promote the stronger FW");
expect(run.bench.includes("fw81") && !run.bench.includes("new85") && new Set([...run.lineup, ...run.bench]).size === run.roster.length, "bench must remain complete and duplicate-free");
run = makeRun("1-2-1"); result = invoke(run, "new85");
expect(result.elevenChanged && result.elevenReplacedPlayerId === "fw81", "11v11 optimization must remain independent of the 5v5 formation");
expect(result.fiveChanged && run.fiveVFive.slots.MF1 === "mf3", "1-2-1 must independently promote its stronger midfielder");
expect(run.fiveVFive.slots.FW === "fw87", "1-2-1 must keep its stronger sole FW");
overall.new85 = 81; run = makeRun(); result = invoke(run, "new85");
expect(!result.elevenChanged && !run.lineup.includes("new85") && !Object.values(run.fiveVFive.slots).includes("new85"), "equal Overall must never replace an incumbent");
overall.new85 = 70; run = makeRun(); result = invoke(run, "new85");
expect(!result.elevenChanged && !run.lineup.includes("new85") && !Object.values(run.fiveVFive.slots).includes("new85"), "weaker player must not replace an incumbent");
overall.new85 = 85; run = makeRun(); run.lineup[10] = null; run.fiveVFive.slots.FW2 = null; result = invoke(run, "new85");
expect(result.elevenChanged && !result.elevenReplacedPlayerId && run.lineup.includes("new85"), "compatible empty 11v11 slots must be filled without replacing a starter");
expect(result.fiveChanged && run.fiveVFive.slots.FW2 === "new85", "compatible empty 5v5 slots must be filled independently");

for (const role of ["GK", "DF", "MF", "FW"]) {
  const id = `new-${role}`; add(id, role, 99); run = makeRun();
  result = invoke(run, id);
  expect(result.elevenChanged && result.fiveChanged, `${role} must be supported independently in both lineups`);
}
run = makeRun(); invoke(run, "new85"); const snapshot = JSON.stringify(run); invoke(run, "new85");
expect(JSON.stringify(run) === snapshot, "repeated calls must be idempotent and preserve the roster");
console.log("smart lineup regression tests OK");
