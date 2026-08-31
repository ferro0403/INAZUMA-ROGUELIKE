"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const formation = { id: "1-2-1", slots: [{ key: "g", role: "GK" }, { key: "d", role: "DF" }, { key: "m1", role: "MF" }, { key: "m2", role: "MF" }, { key: "f", role: "FW" }] };
const seasonDb = { seasonId: "ie1", players: [], bossOrder: [{ teamId: "b", teamName: "B" }], formations: { eleven: [] } };
const pullPlayers = [...formation.slots.map((slot, index) => ({ playerId: `opponent-${index}`, name: `opponent-${index}`, position: slot.role, category: "Normale" })), ...["a", "b", "c", "x", "y", "z"].map(playerId => ({ playerId, name: playerId, position: "MF", category: "Normale" })), ...["ua", "ub", "uc"].map(playerId => ({ playerId, name: playerId, position: "MF", category: "Buono" }))];
function baseRun(node) {
  return { runId: "entry", seasonId: "ie1", phase: "map", bossIndex: 0, teamLevel: 0, lives: 2,
    fiveVFive: { formation: "1-2-1", slots: {} }, roster: [], lineup: [], bench: [], inventory: [], statistics: {},
    currentZone: { bossIndex: 0, bossId: "b", seed: "z", currentNodeId: "start", pendingNodeId: null, startNodeId: "start", path: ["start"], completedNodeIds: [],
      nodes: [{ id: "start", type: "start", layer: 0 }, node], edges: [["start", node.id]] }, activeMatch: null };
}
function harness(node, valid = true) {
  const storage = new BudgetStorage(Infinity); const rt = load(storage, { run: baseRun(node), seasonDb }); const c = rt.context;
  c.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb: { players: pullPlayers } });
  c.RecruitmentPoolRuntime.candidateKey = player => String(player.profileId || player.playerId);
  c.RecruitmentPoolRuntime.canonicalPlayerId = player => String(player.profileId || player.playerId);
  c.RecruitmentPoolRuntime.eligible = () => true;
  c.DraftEngine.shuffle = values => values.slice();
  c.RoguelikeRules.unlockedPullLevel = () => 1;
  c.FiveVFive = { formations: [formation], formationById: () => formation, ensure: () => {}, validate: () => ({ valid, formation, assignedCount: valid ? 5 : 0, messages: valid ? [] : ["incomplete"] }) };
  c.RunStatistics.createStableMatchId = () => "stable";
  c.RunStatistics.ACTIONS = { REROLL_USED: "REROLL_USED", LUCKY_CHARM_USED: "LUCKY_CHARM_USED" };
  return { rt, c, storage };
}

// Direct and Random 5v5 preserve the pre-existing formation guard.
for (const node of [{ id: "five", type: "five_v_five", layer: 1 }, { id: "random", type: "random", revealedType: "five_v_five", layer: 1 }]) {
  const { rt } = harness(node, false);
  if (node.type === "random") rt.seam.dispatchNode(rt.seam.getRun().currentZone.nodes[1], "five_v_five", { previousNodeId: "start" });
  else rt.seam.enterNode(node.id);
  assert.equal(rt.canonical.activeMatch, null); assert.equal(rt.canonical.phase, "five");
}
{
  const { rt } = harness({ id: "five", type: "five_v_five", layer: 1 }, true);
  rt.seam.enterNode("five"); assert.equal(rt.canonical.activeMatch.matchId, "stable"); assert.equal(rt.canonical.phase, "match");
}

// Random selection and reveal rollback together; retry preserves the deterministic reveal.
{
  const { rt, c } = harness({ id: "random", type: "random", layer: 1 }, true);
  c.MapEngine.resolveRandomNodeType = (_run, node) => (node.revealedType ||= "five_v_five");
  const save = c.RunState.save.bind(c.RunState); let fail = true;
  c.RunState.save = (value) => { if (fail) { fail = false; throw Object.assign(new Error("stale"), { code: "stale-write" }); } return save(value); };
  const oldNode = rt.seam.getRun().currentZone.nodes[1]; rt.seam.enterNode("random");
  assert.equal(rt.canonical.currentZone.pendingNodeId, null); assert.equal(rt.canonical.currentZone.nodes[1].revealedType, undefined);
  assert.notStrictEqual(oldNode, rt.seam.getRun().currentZone.nodes[1]);
  rt.seam.enterNode("random"); assert.equal(rt.canonical.currentZone.pendingNodeId, "random"); assert.equal(rt.canonical.currentZone.nodes[1].revealedType, "five_v_five");
}

// Random -> match creation remains independently atomic after the reveal checkpoint.
{
  const { rt, c } = harness({ id: "random", type: "random", revealedType: "five_v_five", layer: 1 }, true);
  rt.seam.getRun().currentZone.pendingNodeId = "random"; c.RunState.save(rt.seam.getRun());
  const old = rt.seam.getRun().currentZone.nodes[1]; const save = c.RunState.save.bind(c.RunState); let failed = false;
  c.RunState.save = (value) => { if (!failed) { failed = true; throw Object.assign(new Error("stale"), { code: "stale-write" }); } return save(value); };
  rt.seam.dispatchNode(old, "five_v_five", { previousNodeId: "start" }); assert.equal(rt.canonical.activeMatch, null); assert.notStrictEqual(old, rt.seam.getRun().currentZone.nodes[1]);
  c.RunState.save = save; rt.seam.dispatchNode(rt.seam.getRun().currentZone.nodes[1], "five_v_five", { previousNodeId: "start" });
  assert.equal(rt.canonical.activeMatch.matchId, "stable"); assert.equal(rt.canonical.phase, "match");
}

// Canonical pull semantics reject completed nodes and stale candidate sets before consuming a token.
{
  const pull = { id: "pull", type: "pull_free_agents", layer: 1, pullState: { pullType: "pull_free_agents", rerolls: 0, excludedCandidateIds: [], candidateIds: ["a", "b", "c"] } };
  const { rt, c } = harness(pull, true); const current = rt.seam.getRun(); current.currentZone.pendingNodeId = "pull"; current.inventory = [{ id: "scout", instanceId: "token", effect: "pull_reroll" }]; c.RunState.save(current);
  const candidates = ["a", "b", "c"].map(playerId => ({ playerId }));
  current.currentZone.completedNodeIds.push("pull"); c.RunState.save(current);
  assert.equal(rt.seam.activePullNodeById(current, "pull", "pull_free_agents"), null);
  const blocked = rt.seam.useScoutTokenOnPull(pull, "pull_free_agents", candidates, current.inventory[0], { source: "free_agents" });
  assert.equal(blocked.ok, false); assert.equal(rt.canonical.inventory.length, 1); assert.equal(rt.canonical.currentZone.nodes[1].pullState.rerolls, 0);
  const canonical = rt.seam.getRun(); canonical.currentZone.completedNodeIds = []; canonical.currentZone.nodes[1].pullState.candidateIds = ["x", "y", "z"]; c.RunState.save(canonical);
  const mismatch = rt.seam.useScoutTokenOnPull(pull, "pull_free_agents", candidates, canonical.inventory[0], { source: "free_agents" });
  assert.equal(mismatch.ok, false); assert.equal(rt.canonical.inventory.length, 1); assert.deepEqual(rt.canonical.currentZone.nodes[1].pullState.candidateIds, ["x", "y", "z"]);
}

// Scout consumes the token and persists the deterministic replacement offer in one write.
{
  const pull = { id: "scout-pull", type: "pull_free_agents", layer: 1, pullState: { pullType: "pull_free_agents", rerolls: 0, excludedCandidateIds: [], luckyCharmUsed: false, candidateIds: ["a", "b", "c"] } };
  const { rt, c } = harness(pull, true); const current = rt.seam.getRun(); current.currentZone.pendingNodeId = pull.id; current.inventory = [{ id: "scout", instanceId: "scout-token", effect: "pull_reroll" }]; c.RunState.save(current);
  const candidates = ["a", "b", "c"].map(playerId => ({ playerId, name: playerId, position: "MF", category: "Normale" })); const pool = { players: pullPlayers, source: "free_agents" };
  const save = c.RunState.save.bind(c.RunState); let fail = true, writes = 0; c.RunState.save = value => { writes += 1; if (fail) { fail = false; throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); } return save(value); };
  const failed = rt.seam.useScoutTokenOnPull(pull, "pull_free_agents", candidates, current.inventory[0], pool); assert.equal(failed.ok, false); assert.equal(writes, 1); assert.equal(rt.canonical.inventory.length, 1); assert.deepEqual(rt.canonical.currentZone.nodes[1].pullState.candidateIds, ["a", "b", "c"]); assert.equal(rt.canonical.currentZone.nodes[1].pullState.rerolls, 0);
  writes = 0; const canonical = rt.seam.getRun(); const committed = rt.seam.useScoutTokenOnPull(canonical.currentZone.nodes[1], "pull_free_agents", candidates, canonical.inventory[0], pool); assert.equal(committed.ok, true); assert.equal(writes, 1, "rendering the committed offer requires no second save");
  assert.equal(rt.canonical.inventory.length, 0); assert.equal(rt.canonical.currentZone.nodes[1].pullState.rerolls, 1); assert.deepEqual(rt.canonical.currentZone.nodes[1].pullState.excludedCandidateIds, ["a", "b", "c"]); assert.equal(rt.canonical.currentZone.nodes[1].pullState.candidateIds.length, 3); assert.notDeepEqual(rt.canonical.currentZone.nodes[1].pullState.candidateIds, ["a", "b", "c"]);
}

// Lucky Charm rollback preserves the old offer; success persists upgraded IDs without a render save.
{
  const pull = { id: "lucky-pull", type: "pull_free_agents", layer: 1, pullState: { pullType: "pull_free_agents", rerolls: 0, excludedCandidateIds: [], luckyCharmUsed: false, candidateIds: ["a", "b", "c"] } };
  const { rt, c } = harness(pull, true); const current = rt.seam.getRun(); current.currentZone.pendingNodeId = pull.id; current.inventory = [{ id: "lucky_charm", instanceId: "lucky-token", effect: "lucky_pull" }]; c.RunState.save(current);
  const candidates = ["a", "b", "c"].map(playerId => pullPlayers.find(player => player.playerId === playerId)); const save = c.RunState.save.bind(c.RunState); let fail = true, writes = 0; c.RunState.save = value => { writes += 1; if (fail) { fail = false; throw Object.assign(new Error("security"), { name: "SecurityError" }); } return save(value); };
  const failed = rt.seam.useLuckyCharmOnPull(pull, "pull_free_agents", candidates); assert.equal(failed.ok, false); assert.equal(writes, 1); assert.equal(rt.canonical.inventory.length, 1); assert.equal(rt.canonical.currentZone.nodes[1].pullState.luckyCharmUsed, false); assert.deepEqual(rt.canonical.currentZone.nodes[1].pullState.candidateIds, ["a", "b", "c"]);
  writes = 0; const canonical = rt.seam.getRun(); const committed = rt.seam.useLuckyCharmOnPull(canonical.currentZone.nodes[1], "pull_free_agents", candidates); assert.equal(committed.ok, true); assert.equal(writes, 1); assert.equal(rt.canonical.inventory.length, 0); assert.equal(rt.canonical.currentZone.nodes[1].pullState.luckyCharmUsed, true); assert.equal(rt.canonical.currentZone.nodes[1].pullState.candidateIds.length, 3); assert.notDeepEqual(rt.canonical.currentZone.nodes[1].pullState.candidateIds, ["a", "b", "c"]);
}

// A completed item node cannot resurrect an offer, while an existing claimed result remains recoverable.
{
  const itemNode = { id: "item", type: "item", layer: 1, completed: true }; const { rt, c } = harness(itemNode, true); const current = rt.seam.getRun(); current.currentZone.pendingNodeId = null; current.currentZone.completedNodeIds = ["item"]; current.pendingItemReward = null; c.RunState.save(current);
  const staleNode = itemNode; assert.equal(rt.seam.ensurePendingItemReward(staleNode), null); assert.equal(rt.seam.ensurePendingItemReward(staleNode), null); assert.equal(rt.canonical.pendingItemReward, null); assert.equal(rt.canonical.inventory.length, 0);
  const canonical = rt.seam.getRun(); canonical.pendingItemReward = { nodeId: "item", sourceNodeType: "item", candidateIds: ["energy_drink"], selectedItemId: "energy_drink", status: "claimed", claimedItemId: "energy_drink", claimedInstanceId: "claimed-instance" }; c.RunState.save(canonical);
  const recovered = rt.seam.ensurePendingItemReward(rt.seam.getRun().currentZone.nodes[1]); assert.equal(recovered.pending.status, "claimed"); assert.deepEqual(recovered.pending.candidateIds, ["energy_drink"]); assert.equal(rt.canonical.inventory.length, 0);
}

// Interrupted Special/Boss access commits phase repair or match creation atomically.
for (const type of ["special_match", "boss"]) {
  const node = { id: `${type}-node`, type, layer: 1 };
  const { rt, c } = harness(node, true);
  if (type === "special_match") c.SpecialMatchRuntime.fromNode = (_run, _db, currentNode, previousNodeId) => ({ matchId: "stable-special", type, nodeId: currentNode.id, previousNodeId, state: "pre-match", log: [] });
  let current = rt.seam.getRun(); current.currentZone.pendingNodeId = node.id; c.RunState.save(current);
  const recover = type === "special_match" ? rt.seam.recoverInterruptedSpecialMatchAccess : rt.seam.recoverInterruptedBossAccess;
  const save = c.RunState.save.bind(c.RunState); c.RunState.save = () => { throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); };
  assert.equal(recover(), false, `${type}: failed creation stays canonical`); assert.equal(rt.canonical.activeMatch, null); assert.equal(rt.canonical.phase, "map");
  c.RunState.save = save; assert.equal(recover(), true); const matchId = rt.canonical.activeMatch.matchId; assert.equal(rt.canonical.phase, "match");
  current = rt.seam.getRun(); current.phase = "map"; c.RunState.save(current); c.RunState.save = () => { throw Object.assign(new Error("stale"), { code: "stale-write" }); };
  assert.equal(recover(), false, `${type}: failed phase repair rolls back`); assert.equal(rt.canonical.phase, "map"); assert.equal(rt.canonical.activeMatch.matchId, matchId);
  c.RunState.save = save; assert.equal(recover(), true); assert.equal(rt.canonical.phase, "match"); assert.equal(rt.canonical.activeMatch.matchId, matchId, `${type}: retry preserves match identity`);
}

console.log("transactional entry, 5v5 guard, Random rollback and active-pull fencing: ok");
