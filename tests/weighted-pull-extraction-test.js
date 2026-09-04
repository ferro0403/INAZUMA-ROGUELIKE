const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function legacySelectWeightedCandidates(available, random, categoryWeights = {}, count = 3) {
  const remaining = available.slice();
  const selected = [];
  while (remaining.length && selected.length < count) {
    const weighted = remaining.map((player) => ({
      player,
      weight: Math.max(0, Number(categoryWeights[player.category]) || 1),
    }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (!total) break;
    let cursor = random() * total;
    const index = weighted.findIndex((entry) => {
      cursor -= entry.weight;
      return cursor <= 0;
    });
    const pickedIndex = index >= 0 ? index : weighted.length - 1;
    selected.push(weighted[pickedIndex].player);
    remaining.splice(pickedIndex, 1);
  }
  return selected;
}

const context = { console, globalThis: null };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/pulls/weighted-pull.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/pulls/legendary-pull.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/draft.js", "utf8"), context);

const players = [
  { playerId: "1", category: "Normale" },
  { playerId: "2", category: "Buono" },
  { playerId: "3", category: "Forte" },
  { playerId: "4", category: "Elite" },
  { playerId: "5", category: "Mondiale" },
];
const weights = { Normale: 1, Buono: 2, Forte: 3, Elite: 6, Mondiale: 8 };

for (const seed of ["weighted-a", "weighted-b", "weighted-c", "weighted-d", "weighted-e"]) {
  const oldRandom = context.DraftEngine.randomFromSeed(seed);
  const newRandom = context.DraftEngine.randomFromSeed(seed);
  const expected = legacySelectWeightedCandidates(players, oldRandom, weights, 3).map((player) => player.playerId);
  const actual = context.DraftEngine.selectWeightedCandidates(players, newRandom, weights, 3).map((player) => player.playerId);
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), `weighted selection parity for ${seed}`);
}

const index = fs.readFileSync("index.html", "utf8");
const weightedPos = index.indexOf("js/pulls/weighted-pull.js");
const draftPos = index.indexOf("js/draft.js");
assert(weightedPos >= 0, "WeightedPullRuntime is loaded by index.html");
assert(draftPos >= 0, "DraftEngine is loaded by index.html");
assert(weightedPos < draftPos, "WeightedPullRuntime loads before DraftEngine");

console.log("weighted pull extraction: legacy selection parity and load order passed");
