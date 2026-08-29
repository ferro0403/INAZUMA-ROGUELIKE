"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const formation = { id: "1-2-1", slots: [{ key: "g", role: "GK" }, { key: "d", role: "DF" }, { key: "m1", role: "MF" }, { key: "m2", role: "MF" }, { key: "f", role: "FW" }] };
const seasonDb = { seasonId: "ie1", players: [], bossOrder: [{ teamId: "b", teamName: "B" }], formations: { eleven: [] } };
function baseRun(node) {
  return { runId: "entry", seasonId: "ie1", phase: "map", bossIndex: 0, teamLevel: 0, lives: 2,
    fiveVFive: { formation: "1-2-1", slots: {} }, roster: [], lineup: [], bench: [], inventory: [], statistics: {},
    currentZone: { bossIndex: 0, bossId: "b", seed: "z", currentNodeId: "start", pendingNodeId: null, startNodeId: "start", path: ["start"], completedNodeIds: [],
      nodes: [{ id: "start", type: "start", layer: 0 }, node], edges: [["start", node.id]] }, activeMatch: null };
}
function harness(node, valid = true) {
  const storage = new BudgetStorage(Infinity); const rt = load(storage, { run: baseRun(node), seasonDb }); const c = rt.context;
  c.__INAZUMA_RECRUITMENT_TEST__.setContext({ freeAgentsDb: { players: [...formation.slots.map((slot, index) => ({ playerId: `opponent-${index}`, position: slot.role })), ...["a", "b", "c", "x", "y", "z"].map(playerId => ({ playerId, name: playerId, position: "MF", category: "Normale" }))] } });
  c.RecruitmentPoolRuntime.candidateKey = player => String(player.profileId || player.playerId);
  c.RecruitmentPoolRuntime.canonicalPlayerId = player => String(player.profileId || player.playerId);
  c.RoguelikeRules.unlockedPullLevel = () => 1;
  c.FiveVFive = { formations: [formation], formationById: () => formation, ensure: () => {}, validate: () => ({ valid, formation, assignedCount: valid ? 5 : 0, messages: valid ? [] : ["incomplete"] }) };
  c.RunStatistics.createStableMatchId = () => "stable";
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

console.log("transactional entry, 5v5 guard, Random rollback and active-pull fencing: ok");
