const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const context = { MatchSimulatorConfig: {
  phases: {
    offense: { roles: { FW: 1, MF: 1, DF: 1, GK: 1 }, stats: { attack: 1 } },
    midfield: { roles: { FW: 1, MF: 1, DF: 1, GK: 1 }, stats: { control: 1 } },
    defense: { roles: { FW: 1, MF: 1, DF: 1, GK: 1 }, stats: { defense: 1 } },
    goalkeeper: { stats: { save: 1 } },
  },
  forceWeights: { overall: 0, profile: 1 },
  tacticalComponentWeights: { attack: 1, control: 1, defense: 1, save: 1, speed: 1, physical: 1, stamina: 1 },
} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/match-simulator.js", "utf8"), context);
const tactic = context.MatchSimulator.formationTactic("4-3-1-2");
assert.strictEqual(tactic.id, "narrow_playmaker");
assert.deepStrictEqual(JSON.parse(JSON.stringify(tactic.modifiers)), { attack: 0.04, control: 0.04, defense: -0.03, speed: -0.02 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.MatchSimulator.formationTactic("2-5-3").modifiers)), {});
const base = { attack: 100, control: 100, defense: 100, save: 100, speed: 100, physical: 100, stamina: 100 };
const applied = context.MatchSimulator.applyFormationTactics(base, "4-3-1-2");
assert.deepStrictEqual(JSON.parse(JSON.stringify(applied.effective)), { attack: 104, control: 104, defense: 97, save: 100, speed: 98, physical: 100, stamina: 100 });
console.log("formation-4312-tactics-test: tactical resolver and effective components OK");
