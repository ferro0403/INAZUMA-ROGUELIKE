"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function harness(initialCandidateIds, { injectCanonicalChange = false } = {}) {
  const players = [
    { playerId: "antoni", profileId: "antoni-a", pullCandidateKind: "season_profile", category: "Elite" },
    { playerId: "antoni", profileId: "antoni-b", pullCandidateKind: "season_profile", category: "Elite" },
    { playerId: "bob", profileId: "bob", pullCandidateKind: "season_profile", category: "Elite" },
    { playerId: "carl", profileId: "carl", pullCandidateKind: "season_profile", category: "Elite" },
    { playerId: "dave", profileId: "dave", pullCandidateKind: "season_profile", category: "Elite" },
  ];
  const node = { id: "pending-pull", type: "pull_legendary", pullState: { pullType: "pull_legendary", rerolls: 0, excludedCandidateIds: [], candidateIds: initialCandidateIds.slice() } };
  const run = { roster: [], inventory: [], bossIndex: 0, currentZone: { seed: "seed", pendingNodeId: node.id, nodes: [node] } };
  const pool = { players, profileAware: true, source: "mixed", database: {} };
  const context = {
    console,
    SEASON1_CONFIG: { categoryRanks: { Elite: 1 }, nodeLabels: { pull_legendary: { label: "Legendary" } } },
    SpecialMatchRuntime: { eligibleProfile: () => true },
    RoguelikeRules: { unlockedTeamPullCategoryWeights: () => null },
    DraftEngine: {
      randomFromSeed: () => () => 0,
      selectCandidates: (available, _random, count) => available.slice(0, count),
      selectWeightedCandidates: (available, _random, _weights, count) => available.slice(0, count),
      selectLegendaryCandidates: (available, _random, _rank, _elite, count) => available.slice(0, count),
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  for (const file of ["js/recruitment/player-identity.js", "js/pulls/pull-invariants.js", "js/pulls/pull-candidates.js", "js/pulls/pull-controller.js"]) {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  }
  context.RecruitmentPoolRuntime = {
    canonicalPlayerId: context.PlayerIdentity.canonicalPlayerId,
    candidateKey: context.PlayerIdentity.candidateKey,
    eligible: () => true,
  };

  let mutationAttempts = 0;
  let committedRepairs = 0;
  let recoveryRenders = 0;
  const offers = [];
  const pending = (current, id, type) => {
    const candidate = current.currentZone.nodes.find((entry) => String(entry.id) === String(id));
    return candidate?.pullState?.pullType === type ? candidate : null;
  };
  const persistGameplayMutation = (options) => {
    mutationAttempts += 1;
    if (injectCanonicalChange && mutationAttempts === 1) node.pullState.candidateIds = ["carl", "bob", "dave"];
    try {
      options.mutate(run);
      committedRepairs += 1;
      options.onCommitted?.();
      options.rerender?.({ ok: true });
      return { ok: true };
    } catch (error) {
      options.onMutationError?.({ error });
      options.rerender?.({ ok: false, stage: "mutation", error });
      return { ok: false, error };
    }
  };
  const controller = context.PullControllerRuntime.create({
    getRun: () => run,
    getUi: () => ({}),
    pullPool: () => pool,
    luckyCharmPoolForPull: () => null,
    pullCandidateKey: context.PlayerIdentity.candidateKey,
    previousBossLevel: () => 1,
    useScoutTokenOnPull: () => {},
    useLuckyCharmOnPull: () => {},
    pendingPullNodeById: pending,
    persistGameplayMutation,
    renderMapFailureRecovery: () => { recoveryRenders += 1; },
    renderMap: () => {},
    canonicalNodeById: (id) => pending(run, id, "pull_legendary"),
    showPlayerOffer: (offer) => { offers.push(offer.candidates.map(context.PlayerIdentity.candidateKey)); },
    toast: () => {},
    closeModal: () => {},
    finishNonMatchNode: () => {},
    recruitPlayer: () => {},
    completePullNodeMutation: () => {},
    rerenderCanonicalPull: () => {},
    isDevMode: () => false,
  });
  return { controller, node, offers, stats: () => ({ mutationAttempts, committedRepairs, recoveryRenders }) };
}

// A stale closure cannot overwrite a newer canonical pending offer.
const stale = harness(["antoni-a", "antoni-b", "bob"], { injectCanonicalChange: true });
const rejected = stale.controller.openPull(stale.node, "pull_legendary");
assert.strictEqual(rejected.ok, false, "stale repair mutation is rejected");
assert.match(rejected.error.message, /Pull repair state changed/);
assert.deepStrictEqual(stale.node.pullState.candidateIds, ["carl", "bob", "dave"], "new canonical candidateIds are preserved");
assert.deepStrictEqual(stale.offers, [], "no offer derived from stale state is rendered");
assert.deepStrictEqual(stale.stats(), { mutationAttempts: 1, committedRepairs: 0, recoveryRenders: 1 });
stale.controller.openPull(stale.node, "pull_legendary");
assert.strictEqual(JSON.stringify(stale.offers), JSON.stringify([["carl", "bob", "dave"]]), "retry renders the current canonical offer");
assert.strictEqual(stale.stats().mutationAttempts, 1, "retry does not repair an already valid canonical offer");

// An unchanged legacy offer is compare-and-committed exactly once.
const normal = harness(["antoni-a", "antoni-b", "bob"]);
normal.controller.openPull(normal.node, "pull_legendary");
assert.strictEqual(JSON.stringify(normal.node.pullState.candidateIds), JSON.stringify(["antoni-a", "bob", "carl"]));
assert.strictEqual(JSON.stringify(normal.offers), JSON.stringify([["antoni-a", "bob", "carl"]]));
assert.deepStrictEqual(normal.stats(), { mutationAttempts: 1, committedRepairs: 1, recoveryRenders: 0 });
normal.controller.openPull(normal.node, "pull_legendary");
assert.strictEqual(normal.stats().mutationAttempts, 1, "subsequent open does not repeat the repair");
assert.strictEqual(normal.offers.length, 2, "subsequent open renders without another mutation");
console.log("legacy Pull repair compare-and-commit stale-state safety passed");
