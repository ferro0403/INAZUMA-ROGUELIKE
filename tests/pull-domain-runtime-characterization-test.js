"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function load(files, extras = {}) {
  const context = { console, Math, Date, Set, Map, ...extras };
  context.globalThis = context;
  vm.createContext(context);
  files.forEach((file) => vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file }));
  return context;
}

const json = (value) => JSON.parse(JSON.stringify(value));
const player = (playerId, extra = {}) => ({ playerId, name: playerId, position: "FW", category: "Forte", ...extra });
const pullState = (candidateIds = ["a", "b", "c"], extra = {}) => ({ pullType: "pull_free_agents", rerolls: 0, excludedCandidateIds: [], luckyCharmUsed: false, candidateIds, ...extra });

function controllerHarness({ state = null, persistFails = false, type = "pull_free_agents" } = {}) {
  const node = { id: "pull-1", type };
  if (state) node.pullState = state;
  const run = { runId: "run-1", bossIndex: 1, inventory: [], currentZone: { seed: "zone-seed", nodes: [node] } };
  const candidates = [player("a"), player("b"), player("c")];
  const events = { generated: 0, resolved: 0, offers: [], recovery: 0, records: [], mutations: 0, finished: [], recruited: [] };
  const context = load(["js/pulls/pull-controller.js"], {
    SEASON1_CONFIG: { nodeLabels: { [type]: { label: "Pull" } } },
    RunStatistics: { ACTIONS: { PULL_OPENED: "PULL_OPENED" }, recordRunAction: (_run, action, data) => events.records.push({ action, data }) },
    PullCandidatesRuntime: {
      generatedPullCandidates: (_run, _pool, currentNode) => { events.generated += 1; return candidates; },
      pullCandidates: (_run, pool, currentNode) => { events.resolved += 1; return currentNode.pullState.candidateIds.map((id) => pool.players.find((entry) => entry.playerId === id)).filter(Boolean); },
    },
  });
  const pool = { players: candidates, source: "free_agents", database: { id: "free-agents" } };
  let runtime;
  const deps = {
    getRun: () => run,
    getUi: () => ({ devLegendaryPullSequence: 0 }),
    pullPool: () => pool,
    luckyCharmPoolForPull: () => pool,
    pullCandidateKey: (entry) => String(entry.profileId || entry.playerId),
    previousBossLevel: () => 7,
    useScoutTokenOnPull: (...args) => { events.scoutArgs = args; },
    useLuckyCharmOnPull: (...args) => { events.luckyArgs = args; },
    pendingPullNodeById: (activeRun, id, pullType) => activeRun.currentZone.nodes.find((entry) => String(entry.id) === String(id) && entry.type === pullType),
    activePullNodeById: () => node,
    persistGameplayMutation: (request) => {
      events.mutations += 1;
      if (persistFails) { request.rerender?.({ ok: false }); return { ok: false }; }
      request.mutate(run);
      request.onCommitted?.();
      return { ok: true };
    },
    renderMapFailureRecovery: () => { events.recovery += 1; },
    renderMap: () => {},
    canonicalNodeById: () => node,
    showPlayerOffer: (options) => { events.offers.push({ options, snapshot: json(node.pullState) }); },
    toast: () => {}, closeModal: () => {},
    finishNonMatchNode: (finishedNode, message) => events.finished.push({ finishedNode, message }),
    recruitPlayer: (...args) => events.recruited.push(args),
    completePullNodeMutation: (...args) => events.completeArgs = args,
    rerenderCanonicalPull: (...args) => { events.rerenderArgs = args; },
    isDevMode: () => false,
  };
  runtime = context.PullControllerRuntime.create(deps);
  return { context, runtime, node, run, pool, candidates, events };
}

// 1. Initial opening commits canonical state before rendering any offer.
{
  const h = controllerHarness();
  h.runtime.openPull(h.node);
  assert.strictEqual(h.events.mutations, 1);
  assert.deepStrictEqual(json(h.node.pullState), pullState());
  assert.strictEqual(h.events.generated, 1);
  assert.strictEqual(h.events.records.length, 1);
  assert.strictEqual(h.events.records[0].action, "PULL_OPENED");
  assert.strictEqual(h.events.offers.length, 1);
  assert.deepStrictEqual(h.events.offers[0].snapshot, pullState());
}

// 2. Resume uses persisted ids and performs no generation/RNG-producing call.
{
  const saved = pullState(["c", "a", "b"], { rerolls: 2, excludedCandidateIds: ["old"] });
  const h = controllerHarness({ state: saved });
  h.runtime.openPull(h.node);
  assert.strictEqual(h.events.mutations, 0);
  assert.strictEqual(h.events.generated, 0);
  assert.strictEqual(h.events.resolved, 1);
  assert.deepStrictEqual(h.events.offers[0].options.candidates.map((entry) => entry.playerId), ["c", "a", "b"]);
  assert.deepStrictEqual(json(h.node.pullState), saved);
}

// 3. Failed initial persistence shows no speculative offer and invokes recovery.
{
  const h = controllerHarness({ persistFails: true });
  h.run.inventory.push({ instanceId: "scout", effect: "pull_reroll" });
  h.runtime.openPull(h.node);
  assert.strictEqual(h.events.offers.length, 0);
  assert.strictEqual(h.events.generated, 0);
  assert.strictEqual(h.events.recovery, 1);
  assert.strictEqual(h.run.inventory.length, 1);
  assert.strictEqual(h.node.pullState, undefined);
  assert.strictEqual(h.events.finished.length, 0);
}

function itemsHarness({ fail = false, beforeMutate = null } = {}) {
  const node = { id: "pull-1", type: "pull_free_agents", pullState: pullState() };
  const run = { runId: "run-1", seasonId: "ie1", roster: [], inventory: [], currentZone: { seed: "zone-seed", nodes: [node] } };
  const events = { records: [], generated: 0, rerenders: 0, recovery: 0, mutationCalls: 0 };
  const context = load(["js/pulls/pull-items.js"], {
    SEASON1_CONFIG: { categoryRanks: { Comune: 1, Forte: 2, Elite: 3, Leggenda: 4 } },
    SeasonRegistry: { sourceForSeason: () => "season" },
    DraftEngine: { randomFromSeed: (seed) => { events.seed = seed; return () => 0; }, shuffle: (entries) => entries.slice() },
    PullCandidatesRuntime: { generatedPullCandidates: (_run, _pool, currentNode) => { events.generated += 1; events.generatedRerolls = currentNode.pullState.rerolls; return [player("d"), player("e"), player("f")]; } },
    RunStatistics: { ACTIONS: { REROLL_USED: "REROLL_USED", LUCKY_CHARM_USED: "LUCKY_CHARM_USED" }, recordRunAction: (_run, action, data) => events.records.push({ action, data }) },
  });
  const persistGameplayMutation = (request) => {
    events.mutationCalls += 1;
    if (fail) { request.rerender?.({ ok: false }); return { ok: false }; }
    beforeMutate?.(run);
    try {
      request.mutate(run); request.onCommitted?.(); return { ok: true };
    } catch (error) {
      events.mutationError = error;
      request.rerender?.({ ok: false });
      return { ok: false };
    }
  };
  const runtime = context.PullItemsRuntime.create({
    getRun: () => run, getSeasonDb: () => ({ players: [] }), isProfileAwareSeason: () => false,
    pullPool: () => events.luckyPool,
    canonicalCandidatePlayerId: (entry) => String(entry.playerId), pullCandidateKey: (entry) => String(entry.profileId || entry.playerId),
    isPullCandidateEligible: () => true, toast: (message) => { events.toast = message; }, persistGameplayMutation,
    activePullNodeById: (activeRun) => activeRun.currentZone.nodes[0],
    rerenderCanonicalPull: () => { events.rerenders += 1; }, renderMapFailureRecovery: () => { events.recovery += 1; },
  });
  return { context, runtime, node, run, events };
}

// 4. Scout Token changes inventory/exclusions/reroll/candidates only inside a successful mutation.
{
  const h = itemsHarness();
  const scout = { id: "scout_token", instanceId: "scout-1", effect: "pull_reroll" };
  h.run.inventory.push(scout);
  h.runtime.useScoutTokenOnPull(h.node, h.node.type, [player("a"), player("b"), player("c")], scout, { players: [] });
  assert.strictEqual(h.run.inventory.length, 0);
  assert.deepStrictEqual(json(h.node.pullState.excludedCandidateIds), ["a", "b", "c"]);
  assert.strictEqual(h.node.pullState.rerolls, 1);
  assert.deepStrictEqual(json(h.node.pullState.candidateIds), ["d", "e", "f"]);
  assert.strictEqual(h.events.generatedRerolls, 1);
  assert.strictEqual(h.events.records[0].action, "REROLL_USED");
  assert.strictEqual(h.events.rerenders, 1);
}
{
  const h = itemsHarness({ fail: true });
  const scout = { id: "scout_token", instanceId: "scout-1", effect: "pull_reroll" };
  h.run.inventory.push(scout);
  h.runtime.useScoutTokenOnPull(h.node, h.node.type, [player("a"), player("b"), player("c")], scout, { players: [] });
  assert.strictEqual(h.run.inventory.length, 1);
  assert.deepStrictEqual(json(h.node.pullState), pullState());
  assert.strictEqual(h.events.generated, 0);
  assert.strictEqual(h.events.rerenders, 0);
  assert.strictEqual(h.events.recovery, 1);
}

// Scout reroll delegates seed construction to the real PullCandidatesRuntime exactly once.
{
  const node = { id: "pull-1", type: "pull_free_agents", pullState: pullState() };
  const run = { runId: "run-1", bossIndex: 0, roster: [], inventory: [], currentZone: { seed: "zone-seed", nodes: [node] } };
  const seeds = [];
  let selectionCalls = 0;
  const context = load(["js/pulls/pull-candidates.js", "js/pulls/pull-items.js"], {
    RecruitmentPoolRuntime: {
      canonicalPlayerId: (entry) => String(entry.playerId), candidateKey: (entry) => String(entry.profileId || entry.playerId), eligible: () => true,
    },
    DraftEngine: {
      randomFromSeed: (seed) => { seeds.push(seed); return () => 0; },
      unlockedPullCategoryWeights: () => null,
      selectCandidates: (available) => { selectionCalls += 1; return available.slice(0, 3); },
      selectWeightedCandidates: (available) => available.slice(0, 3),
    },
    LegendaryPullRuntime: { select: (available) => available.slice(0, 3) },
    RunStatistics: { ACTIONS: { REROLL_USED: "REROLL_USED" }, recordRunAction: () => {} },
  });
  const scout = { id: "scout_token", instanceId: "scout-1", effect: "pull_reroll" };
  run.inventory.push(scout);
  const pool = { players: [player("a"), player("b"), player("c"), player("d"), player("e"), player("f")], profileAware: false };
  const runtime = context.PullItemsRuntime.create({
    getRun: () => run, getSeasonDb: () => ({ players: [] }), isProfileAwareSeason: () => false, pullPool: () => pool,
    canonicalCandidatePlayerId: (entry) => String(entry.playerId), pullCandidateKey: (entry) => String(entry.profileId || entry.playerId),
    isPullCandidateEligible: () => true, toast: () => {},
    persistGameplayMutation: (request) => { request.mutate(run); request.onCommitted?.(); return { ok: true }; },
    activePullNodeById: (activeRun) => activeRun.currentZone.nodes[0], rerenderCanonicalPull: () => {}, renderMapFailureRecovery: () => {},
  });
  runtime.useScoutTokenOnPull(node, node.type, [player("a"), player("b"), player("c")], scout, pool);
  assert.strictEqual(node.pullState.rerolls, 1);
  assert.deepStrictEqual(seeds, ["zone-seed:pull-1:pull:1"]);
  assert.strictEqual(selectionCalls, 1, "Scout Token performs exactly one new candidate generation");
}

// 5. Legendary offers never expose Scout Token reroll.
{
  const h = controllerHarness({ state: pullState(["a", "b", "c"], { pullType: "pull_legendary" }), type: "pull_legendary" });
  h.run.inventory.push({ instanceId: "scout", effect: "pull_reroll" });
  h.runtime.openPull(h.node);
  assert.strictEqual(h.events.offers[0].options.onReroll, null);
}

// 6. Lucky Charm validates ids, commits item consumption and cannot be reused.
{
  const h = itemsHarness();
  const lucky = { id: "lucky_charm", instanceId: "lucky-1", effect: "lucky_pull" };
  h.run.inventory.push(lucky);
  h.events.luckyPool = { players: [player("ua", { category: "Elite" }), player("ub", { category: "Elite" }), player("uc", { category: "Elite" })] };
  h.runtime.useLuckyCharmOnPull(h.node, h.node.type, [player("a"), player("b"), player("c")]);
  assert.strictEqual(h.run.inventory.length, 0);
  assert.strictEqual(h.node.pullState.luckyCharmUsed, true);
  assert.deepStrictEqual(json(h.node.pullState.candidateIds), ["ua", "ub", "uc"]);
  assert.strictEqual(h.events.records[0].action, "LUCKY_CHARM_USED");
  const calls = h.events.mutationCalls;
  h.runtime.useLuckyCharmOnPull(h.node, h.node.type, [player("ua"), player("ub"), player("uc")]);
  assert.strictEqual(h.events.mutationCalls, calls);
  assert.match(h.events.toast, /già utilizzato/);
}
{
  const h = itemsHarness({ fail: true });
  const lucky = { id: "lucky_charm", instanceId: "lucky-1", effect: "lucky_pull" };
  h.run.inventory.push(lucky);
  h.events.luckyPool = { players: [player("ua", { category: "Elite" }), player("ub", { category: "Elite" }), player("uc", { category: "Elite" })] };
  h.runtime.useLuckyCharmOnPull(h.node, h.node.type, [player("a"), player("b"), player("c")]);
  assert.strictEqual(h.run.inventory.length, 1);
  assert.strictEqual(h.node.pullState.luckyCharmUsed, false);
  assert.deepStrictEqual(json(h.node.pullState.candidateIds), ["a", "b", "c"]);
  assert.strictEqual(h.events.rerenders, 0);
}
{
  const h = itemsHarness({ beforeMutate: (current) => { current.currentZone.nodes[0].pullState.candidateIds = ["a", "b", "d"]; } });
  const lucky = { id: "lucky_charm", instanceId: "lucky-stale", effect: "lucky_pull" };
  h.run.inventory.push(lucky);
  h.events.luckyPool = { players: [player("ua", { category: "Elite" }), player("ub", { category: "Elite" }), player("uc", { category: "Elite" })] };
  h.runtime.useLuckyCharmOnPull(h.node, h.node.type, [player("a"), player("b"), player("c")]);
  assert.match(h.events.mutationError?.message || "", /Lucky Charm state changed/);
  assert.strictEqual(h.run.inventory.length, 1);
  assert.strictEqual(h.node.pullState.luckyCharmUsed, false);
  assert.deepStrictEqual(json(h.node.pullState.candidateIds), ["a", "b", "d"]);
  assert.strictEqual(h.events.rerenders, 0, "no stale upgrade is presented as committed");
  assert.strictEqual(h.events.recovery, 1);
}

// 7. Skip delegates exactly once to the existing finishNonMatchNode boundary.
{
  const h = controllerHarness({ state: pullState() });
  h.runtime.openPull(h.node);
  h.events.offers[0].options.onSkip();
  assert.strictEqual(h.events.finished.length, 1);
  assert.strictEqual(h.events.finished[0].finishedNode, h.node);
  assert.strictEqual(h.events.mutations, 0);
}

// 8. Pick delegates once to Recruitment, passing the transaction and canonical recovery callbacks.
{
  const h = controllerHarness({ state: pullState() });
  h.runtime.openPull(h.node);
  const offer = h.events.offers[0].options;
  offer.onPick(h.candidates[0]);
  assert.strictEqual(h.events.recruited.length, 1);
  const [picked, source, level, done, options] = h.events.recruited[0];
  assert.strictEqual(picked.playerId, "a"); assert.strictEqual(source, "free_agents"); assert.strictEqual(level, 7);
  options.transactionMutate(h.run);
  assert.deepStrictEqual(h.events.completeArgs, [h.run, "pull-1", "pull_free_agents", "a"]);
  done({ status: "failed" }); options.onRecover();
  assert.deepStrictEqual(json(h.events.rerenderArgs), ["pull-1", "pull_free_agents", {}]);
  assert.strictEqual(h.events.finished.length, 0);
  done({ status: "committed-acquired" });
  assert.strictEqual(h.events.finished.length, 0, "committed recruitment uses its post-commit map path, not finishNonMatchNode");
}

// 9. Profile-aware pool/source/key semantics, including the current profileId/playerId split, are frozen.
{
  const seasonDb = { recruitmentPool: { entries: [{}] }, recruitmentRules: { pullFreeAgents: { minimumFinalOverallByBossIndex: [50, 60] } } };
  const run = { seasonId: "ie-profile", bossIndex: 1, unlockedTeamIds: [], unlockedSpecialTeamIds: [] };
  const profiled = player("antoni", { profileId: "antoni-profile", pullCandidateKind: "season_profile" });
  const context = load(["js/pulls/pull-pool.js"], {
    RoguelikeRules: { unlockedPullLevel: () => 2 }, DraftEngine: {}, SEASON1_CONFIG: { legendaryCategories: ["Leggenda"] },
    RecruitmentPoolRuntime: {
      effectiveProfiledPlayers: () => [profiled], eligibleFreeAgentPullPlayers: (entries) => entries,
      candidateSource: (entry) => `source:${entry.profileId}`, canonicalPlayerId: (entry) => String(entry.playerId),
      isSeasonProfileCandidate: (entry) => Boolean(entry.profileId), candidateKey: (entry) => String(entry.profileId || entry.playerId), eligible: () => true,
    },
  });
  const runtime = context.PullPoolRuntime.create({ getRun: () => run, getSeasonDb: () => seasonDb, getFreeAgentsDb: () => ({ players: [] }), isProfileAwareSeason: () => true });
  const pool = runtime.pullPool("pull_free_agents");
  assert.strictEqual(pool.profileAware, true); assert.strictEqual(pool.database, seasonDb);
  assert.strictEqual(pool.sourceForPlayer(profiled), "source:antoni-profile");
  assert.strictEqual(runtime.pullCandidateKey(profiled), "antoni-profile");
  assert.strictEqual(runtime.canonicalCandidatePlayerId(profiled), "antoni");
}

// 10. The view's confirm guard suppresses a second click/onPick call.
{
  let gridListener; let picks = 0;
  const candidate = player("a");
  const option = { dataset: { candidateKey: "a" } };
  const action = { dataset: { pullAction: "confirm" }, disabled: false };
  const grid = { addEventListener: (_type, listener) => { gridListener = listener; }, querySelectorAll: () => [] };
  const document = { getElementById: () => null };
  const context = load(["js/pulls/pull-view.js"], { document, RecruitmentPoolRuntime: { choiceDatabase: (_src, season) => season }, DevelopmentRuntime: { resolvePlayer: (_run, entry) => entry, resolveEffectiveMetadata: (_run, entry) => entry } });
  const runtime = context.PullViewRuntime.create({
    getRun: () => ({}), getSeasonDb: () => ({}), getFreeAgentsDb: () => ({}), escapeHtml: String,
    resolveItem: (id) => ({ id, name: id }), itemIcon: () => "", openModal: () => {}, getModalRoot: () => ({ querySelector: () => grid }),
    rarityClass: () => "", playerCard: () => "<button data-player-id='a'>A</button>", showPlayerDetailsFor: () => {}, scrollSnapshot: () => ({}),
    afterNextPaint: (callback) => callback(), restoreScroll: () => {}, cssEscape: String, toast: () => {}, closeModal: () => {}, renderMap: () => {},
  });
  runtime.showPlayerOffer({ title: "Pull", subtitle: "", candidates: [candidate], source: "free_agents", level: 1, allowSkip: true, onPick: () => { picks += 1; } });
  const event = { target: { closest: (selector) => selector === "[data-pull-action]" ? action : option } };
  gridListener(event); gridListener(event);
  assert.strictEqual(picks, 1); assert.strictEqual(action.disabled, true);
}

// PullCandidatesRuntime directly preserves the pull seed and resolves saved ids without RNG.
{
  const seeds = []; let selectionCalls = 0;
  const context = load(["js/pulls/pull-candidates.js"], {
    RecruitmentPoolRuntime: { canonicalPlayerId: (entry) => String(entry.playerId), candidateKey: (entry) => String(entry.profileId || entry.playerId), eligible: () => true },
    DraftEngine: {
      randomFromSeed: (seed) => { seeds.push(seed); return () => 0; },
      unlockedPullCategoryWeights: () => null,
      selectCandidates: (available) => { selectionCalls += 1; return available.slice(0, 3); },
      selectWeightedCandidates: (available) => available.slice(0, 3),
    },
    LegendaryPullRuntime: { select: (available) => available.slice(0, 3) },
  });
  const run = { roster: [], bossIndex: 0, currentZone: { seed: "zone-seed" } };
  const pool = { players: [player("a"), player("b"), player("c"), player("d")], profileAware: false };
  const fresh = { id: "pull-1", pullState: pullState([]) };
  const generated = context.PullCandidatesRuntime.generatedPullCandidates(run, pool, fresh);
  assert.deepStrictEqual(json(generated.map((entry) => entry.playerId)), ["a", "b", "c"]);
  assert.deepStrictEqual(seeds, ["zone-seed:pull-1:pull:0"]);
  const saved = { id: "pull-1", pullState: pullState(["c", "a", "b"]) };
  const resumed = context.PullCandidatesRuntime.pullCandidates(run, pool, saved);
  assert.deepStrictEqual(json(resumed.map((entry) => entry.playerId)), ["c", "a", "b"]);
  assert.strictEqual(selectionCalls, 1); assert.strictEqual(seeds.length, 1);
}

console.log("pull domain runtime characterization: initial/resume/failures/items/skip/recruitment/profile/UI guard passed");
