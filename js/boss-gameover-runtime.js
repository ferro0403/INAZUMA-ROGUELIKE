(function (global) {
  "use strict";

  const once = (items, value) => { if (!items.includes(value)) items.push(value); };

  function derivePostBossFlow(run, seasonDb) {
    const match = run.activeMatch?.type === "boss" && run.activeMatch?.result === "victory" ? run.activeMatch : null;
    const pending = run.pendingBossVictory;
    const source = run.postBossFlow || (pending ? {
      status: Number(pending.rewardsRemaining ?? pending.remainingRewards ?? 2) > 0 ? "reward" : "next-zone",
      bossIndex: pending.bossIndex, bossTeamId: pending.bossId || pending.bossTeamId,
      matchNodeId: pending.nodeId || pending.matchNodeId,
      remainingRewards: pending.rewardsRemaining ?? pending.remainingRewards,
      excludedIds: pending.excludedIds, rerolls: pending.rerolls, candidateIds: pending.candidateIds,
    } : match ? { status: "result", bossIndex: match.bossIndex, matchNodeId: match.nodeId, remainingRewards: 2 } : null);
    if (!source) return null;
    const remainingRewards = Math.max(0, Math.min(2, Number(source.remainingRewards ?? source.rewardsRemaining ?? 2)));
    const bossIndex = Number(source.bossIndex ?? run.bossIndex);
    return {
      ...source,
      status: source.status || (remainingRewards > 0 ? "reward" : "next-zone"),
      bossIndex,
      bossTeamId: String(source.bossTeamId || seasonDb.bossOrder[bossIndex]?.teamId || ""),
      matchNodeId: source.matchNodeId || null,
      remainingRewards,
      rewardNumber: Math.max(1, Math.min(2, Number(source.rewardNumber ?? (3 - remainingRewards)))),
      excludedIds: Array.from(new Set((Array.isArray(source.excludedIds) ? source.excludedIds : []).map(String))),
      candidateIds: (Array.isArray(source.candidateIds) ? source.candidateIds : []).map(String),
      rerolls: Math.max(0, Number(source.rerolls || 0)), completed: Boolean(source.completed),
    };
  }

  function syncPending(run, flow) {
    if (!run.pendingBossVictory) return;
    Object.assign(run.pendingBossVictory, { rewardsRemaining: flow.remainingRewards, excludedIds: [...flow.excludedIds], rerolls: flow.rerolls, candidateIds: [...flow.candidateIds] });
  }

  function applyPostBossResumeMutation({ run, seasonDb, clearMatch = false }) {
    const flow = derivePostBossFlow(run, seasonDb);
    if (!flow) return { destination: "none" };
    run.postBossFlow = flow;
    if (clearMatch && run.activeMatch?.type === "boss" && run.activeMatch?.result === "victory") {
      run.activeMatch.postMatchNavigationApplied = true;
      run.activeMatch = null;
      if (flow.status === "result") flow.status = "reward";
    }
    if (!seasonDb.bossOrder[flow.bossIndex]) flow.status = "season-complete";
    if (flow.status === "result") return { destination: "boss-result" };
    if (flow.status === "reward" && flow.remainingRewards > 0) return { destination: "boss-rewards" };
    flow.status = flow.status === "season-complete" ? "season-complete" : "next-zone";
    return { destination: flow.status };
  }

  function prepareBossRewardCandidatesMutation({ run, seasonDb, candidateIds }) {
    const flow = derivePostBossFlow(run, seasonDb);
    if (!flow) throw new Error("Post-boss reward unavailable");
    flow.status = "reward";
    if (!flow.candidateIds.length) flow.candidateIds = candidateIds.map(String);
    run.postBossFlow = flow; syncPending(run, flow); return flow;
  }

  function applyBossRewardRerollMutation({ run, tokenInstanceId, nextCandidateIds, recordAction }) {
    const flow = run.postBossFlow;
    const index = run.inventory.findIndex((item) => String(item.instanceId) === String(tokenInstanceId));
    if (!flow || index < 0) throw new Error("Boss reward reroll unavailable");
    const token = run.inventory.splice(index, 1)[0];
    flow.excludedIds = Array.from(new Set([...flow.excludedIds, ...flow.candidateIds].map(String)));
    flow.rerolls += 1; flow.candidateIds = nextCandidateIds(flow).map(String);
    recordAction?.(run, flow, token); syncPending(run, flow); return flow;
  }

  function applyBossRewardPickMetadataMutation({ run, playerId, recordAction }) {
    const flow = run.postBossFlow;
    if (!flow) throw new Error("Boss reward pick unavailable");
    flow.excludedIds = Array.from(new Set([...flow.excludedIds, String(playerId)]));
    recordAction?.(run, flow); syncPending(run, flow); return flow;
  }

  // The recruit transaction calls this after its roster mutation; headless production
  // flows may supply acquire to exercise the same atomic acquisition boundary.
  function applyBossRewardPickMutation({ run, playerId, acquire, recordAction }) {
    const recruitedEntry = acquire?.(run) || null;
    const flow = applyBossRewardPickMetadataMutation({ run, playerId, recordAction });
    return { flow, recruitedEntry };
  }

  function advanceBossRewardMutation({ run, recordAction }) {
    const flow = run.postBossFlow;
    if (!flow) throw new Error("Post-boss reward unavailable");
    flow.remainingRewards = Math.max(0, Number(flow.remainingRewards || 0) - 1);
    flow.rewardNumber = Math.min(2, Number(flow.rewardNumber || 1) + 1);
    flow.rerolls = 0; flow.candidateIds = [];
    if (flow.remainingRewards <= 0) flow.status = "next-zone";
    recordAction?.(run, flow); syncPending(run, flow); return flow;
  }

  function applyBossResolutionMutation({ run, matchId, result, seasonDb, deps }) {
    const match = run.activeMatch;
    if (!match || String(match.matchId) !== String(matchId) || !match.simulation) throw new Error("Boss match unavailable");
    if (match.simulation.resolutionApplied) return { applied: false, match };
    match.simulation.resolutionApplied = true;
    match.state = result === "victory" ? "completed-victory" : "completed-defeat";
    match.result = result;
    run.consecutiveLosses = result === "victory" ? 0 : Math.min(2, Number(run.consecutiveLosses || 0) + 1);
    if (match.simulation.score) match.score = [match.simulation.score.user, match.simulation.score.opponent];
    deps.applyStatistics(match, result);
    const node = run.currentZone?.nodes?.find((item) => item.id === match.nodeId);
    if (result === "victory") {
      deps.addLevels(1, `${run.runId}:${match.nodeId}:boss:victory`, 6);
      if (node) deps.completeNode(run.currentZone, node.id);
      const bossIndex = Number(match.bossIndex ?? run.bossIndex);
      const bossId = String(seasonDb.bossOrder[bossIndex]?.teamId || "");
      match.pendingPostMatchAction = { type: "boss-rewards" };
      run.pendingBossVictory = { bossIndex, bossId, nodeId: match.nodeId || null, rewardsRemaining: 2, excludedIds: [], rerolls: 0, candidateIds: [] };
      run.postBossFlow ||= { status: "result", bossIndex, bossTeamId: bossId, matchNodeId: match.nodeId || null, remainingRewards: 2, rewardNumber: 1, excludedIds: [], rerolls: 0, candidateIds: [], completed: false };
    } else {
      deps.restoreAfterLoss(run, match.previousNodeId, match.type, { save: false });
      match.pendingPostMatchAction = { type: run.gameOver ? "game-over" : "map", toast: deps.lossToast(run) };
    }
    run.phase = "match";
    run.activeMatch = match;
    deps.appendFinalMessage(result, "boss");
    return { applied: true, match };
  }

  function ensureCurrentZoneMutation({ run, seasonDb, mapEngine = global.MapEngine }) {
    const result = mapEngine.ensureCurrentZone(run, seasonDb);
    if (result.generated) run.phase = "map";
    return result;
  }

  function applyBossVictoryHandoffMutation({ run, seasonDb, ensureCurrentZoneMutation: ensureZone, buildFinalization }) {
    const flow = run.postBossFlow;
    const bossIndex = Number(flow?.bossIndex ?? run.bossIndex);
    const boss = seasonDb.bossOrder[bossIndex];
    if (!boss) { run.postBossFlow = null; run.pendingBossVictory = null; run.phase = "complete"; return { destination: "season-complete" }; }
    const bossId = String(boss.teamId);
    once(run.completedBossIds, bossId); once(run.unlockedTeamIds, bossId);
    if (run.bossIndex <= bossIndex) run.bossIndex = bossIndex + 1;
    run.pendingBossVictory = null; run.currentZone = null; run.activeMatch = null;
    if (run.bossIndex >= seasonDb.bossOrder.length) {
      run.postBossFlow = null; run.completedAt ||= new Date().toISOString();
      if (run.statistics) run.statistics.completedAt = run.completedAt;
      run.phase = "finalization";
      buildFinalization(boss);
      return { destination: "finalization-pending" };
    }
    ensureZone(run); run.postBossFlow = null; run.phase = "map";
    return { destination: "map" };
  }

  global.BossGameOverRuntime = Object.freeze({ derivePostBossFlow, applyPostBossResumeMutation, prepareBossRewardCandidatesMutation, applyBossRewardRerollMutation, applyBossRewardPickMetadataMutation, applyBossRewardPickMutation, advanceBossRewardMutation, applyBossResolutionMutation, ensureCurrentZoneMutation, applyBossVictoryHandoffMutation });
})(typeof window !== "undefined" ? window : globalThis);
