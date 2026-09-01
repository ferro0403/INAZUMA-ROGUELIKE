const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function legacySelectLegendaryCandidates(available, random, categoryRank, eliteCategory = "Elite", count = 3) {
  function shuffle(items) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }
  function selectCandidates(items, amount = 3) { return shuffle(items).slice(0, amount); }

  const initiallySelected = selectCandidates(available, count);
  const eliteRank = categoryRank(eliteCategory);
  if (initiallySelected.some((player) => categoryRank(player.category) >= eliteRank)) return initiallySelected;

  const selectedIds = new Set(initiallySelected.map((player) => String(player.playerId)));
  const guaranteedPool = available.filter(
    (player) => !selectedIds.has(String(player.playerId)) && categoryRank(player.category) >= eliteRank
  );
  if (!guaranteedPool.length) return initiallySelected;

  const guaranteed = selectCandidates(guaranteedPool, 1)[0];
  if (!guaranteed) return initiallySelected;

  const candidates = initiallySelected.slice(0, Math.max(0, count - 1));
  candidates.push(guaranteed);
  return shuffle(candidates);
}

const context = { console, globalThis: null };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/pulls/legendary-pull.js", "utf8"), context);
vm.runInContext(fs.readFileSync("js/draft.js", "utf8"), context);

const categories = { Scarso: 0, Normale: 1, Buono: 2, Forte: 3, Elite: 4, Mondiale: 5, Leggenda: 6 };
const categoryRank = (category) => categories[category] ?? 0;
const players = [
  { playerId: "1", category: "Normale" },
  { playerId: "2", category: "Buono" },
  { playerId: "3", category: "Forte" },
  { playerId: "4", category: "Elite" },
  { playerId: "5", category: "Mondiale" },
  { playerId: "6", category: "Normale" },
];

for (const seed of ["legendary-a", "legendary-b", "legendary-c", "legendary-d", "legendary-e"]) {
  const legacyRandom = context.DraftEngine.randomFromSeed(seed);
  const extractedRandom = context.DraftEngine.randomFromSeed(seed);
  const expected = legacySelectLegendaryCandidates(players, legacyRandom, categoryRank).map((player) => player.playerId);
  const actual = context.DraftEngine.selectLegendaryCandidates(players, extractedRandom, categoryRank).map((player) => player.playerId);
  assert.deepStrictEqual(actual, expected, `legendary selection parity for ${seed}`);
}

const index = fs.readFileSync("index.html", "utf8");
const legendaryPos = index.indexOf("js/pulls/legendary-pull.js");
const draftPos = index.indexOf("js/draft.js");
assert(legendaryPos >= 0, "LegendaryPullRuntime is loaded by index.html");
assert(draftPos >= 0, "DraftEngine is loaded by index.html");
assert(legendaryPos < draftPos, "LegendaryPullRuntime loads before DraftEngine");

console.log("legendary pull extraction: legacy selection parity and load order passed");
