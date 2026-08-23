(function (global) {
  "use strict";

  const once = (items, value) => { if (!items.includes(value)) items.push(value); };

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

  function applyBossVictoryHandoffMutation({ run, seasonDb, ensureCurrentZone, buildFinalization }) {
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
    ensureCurrentZone(); run.postBossFlow = null; run.phase = "map";
    return { destination: "map" };
  }

  global.BossGameOverRuntime = Object.freeze({ applyBossResolutionMutation, applyBossVictoryHandoffMutation });
})(typeof window !== "undefined" ? window : globalThis);
