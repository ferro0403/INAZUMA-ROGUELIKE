const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed) {
  let state = hashSeed(seed) || 1;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function selectCandidates(available, random, count = 3) {
  return shuffle(available, random).slice(0, count);
}

function selectWeightedCandidates(available, random, categoryWeights = {}, count = 3) {
  const remaining = available.slice();
  const selected = [];
  while (remaining.length && selected.length < count) {
    const weighted = remaining.map((player) => ({ player, weight: Math.max(0, Number(categoryWeights[player.category]) || 1) }));
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

const categoryRanks = { Scarso: 0, Debole: 1, Normale: 2, Buono: 3, Forte: 4, Elite: 5, Mondiale: 6, Leggenda: 7 };
const categoryRank = (category) => Number(categoryRanks[category] ?? 0);

function selectLegendaryCandidates(available, random, rank, eliteCategory = "Elite", count = 3) {
  const initiallySelected = selectCandidates(available, random, count);
  const eliteRank = rank(eliteCategory);
  if (initiallySelected.some((player) => rank(player.category) >= eliteRank)) return initiallySelected;
  const selectedIds = new Set(initiallySelected.map((player) => String(player.playerId)));
  const guaranteedPool = available.filter((player) => !selectedIds.has(String(player.playerId)) && rank(player.category) >= eliteRank);
  if (!guaranteedPool.length) return initiallySelected;
  const guaranteed = selectCandidates(guaranteedPool, random, 1)[0];
  if (!guaranteed) return initiallySelected;
  const candidates = initiallySelected.slice(0, Math.max(0, count - 1));
  candidates.push(guaranteed);
  return shuffle(candidates, random);
}

const identity = {
  canonicalPlayerId: (player) => String(player?.playerId ?? ""),
  candidateKey: (player) => String(player?.pullCandidateKind === "season_profile" || player?.profileId ? player.profileId : player?.playerId ?? ""),
  eligible: (run, player) => player.pullCandidateKind === "season_profile"
    ? Boolean(player.profileId && !run.blockedProfiles?.includes(player.profileId))
    : !(run.roster || []).some((entry) => String(entry.playerId) === String(player.playerId)),
};

function legacyGeneratedPullCandidates(activeRun, pool, node, deps) {
  const owned = new Set(activeRun.roster.map((entry) => String(entry.playerId)));
  const excluded = new Set(node.pullState.excludedCandidateIds || []);
  const available = pool.players.filter((player) => (
    pool.profileAware ? deps.identity.eligible(activeRun, player) : !owned.has(deps.identity.canonicalPlayerId(player))
  ) && !excluded.has(deps.identity.candidateKey(player)));
  const random = deps.randomFromSeed(`${activeRun.currentZone.seed}:${node.id}:pull:${node.pullState.rerolls}`);
  const weights = node.pullState.pullType === "pull_unlocked_teams" ? deps.unlockedWeights(activeRun.bossIndex) : null;
  const hasProgressionWeights = weights && Object.values(weights).some((weight) => Number(weight) !== 1);
  const candidates = node.pullState.pullType === "pull_legendary"
    ? deps.selectLegendary(available, random, categoryRank, "Elite", 3)
    : hasProgressionWeights
      ? deps.selectWeighted(available, random, weights, 3)
      : deps.selectBase(available, random, 3);
  return [...new Map(candidates.map((player) => [deps.identity.canonicalPlayerId(player), player])).values()];
}

function legacyPullCandidates(activeRun, pool, node, deps) {
  if (node.pullState?.candidateIds?.length) {
    return node.pullState.candidateIds.map((id) => pool.players.find((player) => deps.identity.candidateKey(player) === String(id))).filter(Boolean);
  }
  const deduplicated = legacyGeneratedPullCandidates(activeRun, pool, node, deps);
  node.pullState.candidateIds = deduplicated.map(deps.identity.candidateKey);
  return deduplicated;
}

const unlockedWeights = () => ({ Normale: 1, Buono: 2, Forte: 4, Elite: 8, Mondiale: 10, Leggenda: 12 });
const deps = { identity, randomFromSeed, selectLegendary: selectLegendaryCandidates, selectWeighted: selectWeightedCandidates, selectBase: selectCandidates, unlockedWeights };
const context = {
  console,
  globalThis: null,
  RecruitmentPoolRuntime: identity,
  DraftEngine: {
    randomFromSeed,
    selectCandidates,
    selectWeightedCandidates,
    selectLegendaryCandidates,
  },
  RoguelikeRules: { unlockedTeamPullCategoryWeights: unlockedWeights },
  SEASON1_CONFIG: { categoryRanks },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/pulls/pull-candidates.js", "utf8"), context);

const basePlayers = [
  { playerId: "1", category: "Normale", pullCandidateKind: "free_agent" },
  { playerId: "2", category: "Buono", pullCandidateKind: "free_agent" },
  { playerId: "3", category: "Forte", pullCandidateKind: "free_agent" },
  { playerId: "4", category: "Elite", pullCandidateKind: "free_agent" },
  { playerId: "5", category: "Mondiale", pullCandidateKind: "free_agent" },
  { playerId: "6", category: "Leggenda", pullCandidateKind: "free_agent" },
];

const scenarios = [
  {
    label: "free agents",
    run: { roster: [{ playerId: "1" }], bossIndex: 2, currentZone: { seed: "zone-a" } },
    pool: { players: basePlayers, profileAware: false },
    node: { id: "n1", pullState: { pullType: "pull_free_agents", rerolls: 0, excludedCandidateIds: ["2"], candidateIds: [] } },
  },
  {
    label: "weighted unlocked teams",
    run: { roster: [], bossIndex: 5, currentZone: { seed: "zone-b" } },
    pool: { players: basePlayers, profileAware: false },
    node: { id: "n2", pullState: { pullType: "pull_unlocked_teams", rerolls: 2, excludedCandidateIds: [], candidateIds: [] } },
  },
  {
    label: "legendary canonical dedupe parity",
    run: { roster: [], bossIndex: 7, currentZone: { seed: "zone-c" } },
    pool: {
      profileAware: true,
      players: [
        { playerId: "50", profileId: "p50-a", category: "Elite", pullCandidateKind: "season_profile" },
        { playerId: "50", profileId: "p50-b", category: "Mondiale", pullCandidateKind: "season_profile" },
        { playerId: "51", profileId: "p51", category: "Elite", pullCandidateKind: "season_profile" },
        { playerId: "52", profileId: "p52", category: "Leggenda", pullCandidateKind: "season_profile" },
      ],
    },
    node: { id: "n3", pullState: { pullType: "pull_legendary", rerolls: 0, excludedCandidateIds: [], candidateIds: [] } },
  },
];

for (const scenario of scenarios) {
  const oldNode = JSON.parse(JSON.stringify(scenario.node));
  const newNode = JSON.parse(JSON.stringify(scenario.node));
  const expected = legacyPullCandidates(scenario.run, scenario.pool, oldNode, deps);
  const actual = context.PullCandidatesRuntime.pullCandidates(scenario.run, scenario.pool, newNode);
  if (scenario.label === "legendary canonical dedupe parity") {
    assert.strictEqual(actual.length, 3, "canonical dedupe happens before selection and keeps all three slots");
    assert.strictEqual(new Set(actual.map((candidate) => String(candidate.playerId))).size, 3, "legendary candidates have distinct canonical playerIds");
  } else {
    assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), `${scenario.label}: candidates preserve legacy behavior`);
    assert.strictEqual(JSON.stringify(newNode.pullState.candidateIds), JSON.stringify(oldNode.pullState.candidateIds), `${scenario.label}: persisted candidateIds preserve legacy behavior`);
  }
}

const savedPool = {
  profileAware: true,
  players: [
    { playerId: "80", profileId: "profile-a", category: "Elite", pullCandidateKind: "season_profile" },
    { playerId: "80", profileId: "profile-b", category: "Mondiale", pullCandidateKind: "season_profile" },
    { playerId: "81", profileId: "profile-c", category: "Elite", pullCandidateKind: "season_profile" },
  ],
};
const savedRun = { roster: [], bossIndex: 0, currentZone: { seed: "saved" } };
const savedNode = { id: "saved-node", pullState: { pullType: "pull_legendary", rerolls: 0, excludedCandidateIds: [], candidateIds: ["profile-b", "profile-c"] } };
const expectedSaved = legacyPullCandidates(savedRun, savedPool, JSON.parse(JSON.stringify(savedNode)), deps);
const actualSaved = context.PullCandidatesRuntime.pullCandidates(savedRun, savedPool, JSON.parse(JSON.stringify(savedNode)));
assert.strictEqual(JSON.stringify(actualSaved), JSON.stringify(expectedSaved), "saved candidateId resolution preserves legacy behavior");

console.log("pull candidates characterization: legacy generation, dedupe and saved-id resolution parity passed");
