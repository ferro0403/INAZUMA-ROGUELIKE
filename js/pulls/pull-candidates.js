(function (global) {
  "use strict";

  function canonicalCandidatePlayerId(player) {
    return global.RecruitmentPoolRuntime.canonicalPlayerId(player);
  }

  function pullCandidateKey(player) {
    return global.RecruitmentPoolRuntime.candidateKey(player);
  }

  function isPullCandidateEligible(activeRun, player) {
    return global.RecruitmentPoolRuntime.eligible(activeRun, player);
  }

  function selectWeightedCandidates(available, random, categoryWeights = null) {
    const hasProgressionWeights = categoryWeights && Object.values(categoryWeights).some((weight) => Number(weight) !== 1);
    if (hasProgressionWeights) return global.DraftEngine.selectWeightedCandidates(available, random, categoryWeights, 3);
    return global.DraftEngine.selectCandidates(available, random, 3);
  }

  function categoryRank(category) {
    return Number(global.SEASON1_CONFIG.categoryRanks[category] ?? 0);
  }

  function selectLegendaryCandidates(available, random) {
    return global.DraftEngine.selectLegendaryCandidates(available, random, categoryRank, "Elite", 3);
  }

  function generatedPullCandidates(activeRun, pool, node) {
    const owned = new Set(activeRun.roster.map((entry) => String(entry.playerId)));
    const excluded = new Set(node.pullState.excludedCandidateIds || []);
    const available = pool.players.filter((player) => (
      pool.profileAware
        ? isPullCandidateEligible(activeRun, player)
        : !owned.has(canonicalCandidatePlayerId(player))
    ) && !excluded.has(pullCandidateKey(player)));
    const random = global.DraftEngine.randomFromSeed(`${activeRun.currentZone.seed}:${node.id}:pull:${node.pullState.rerolls}`);
    const candidates = node.pullState.pullType === "pull_legendary"
      ? selectLegendaryCandidates(available, random)
      : selectWeightedCandidates(
          available,
          random,
          node.pullState.pullType === "pull_unlocked_teams"
            ? global.RoguelikeRules.unlockedTeamPullCategoryWeights(activeRun.bossIndex)
            : null
        );
    return [...new Map(candidates.map((player) => [canonicalCandidatePlayerId(player), player])).values()];
  }

  function pullCandidates(activeRun, pool, node) {
    if (node.pullState?.candidateIds?.length) {
      return node.pullState.candidateIds
        .map((id) => pool.players.find((player) => pullCandidateKey(player) === String(id)))
        .filter(Boolean);
    }
    const deduplicated = generatedPullCandidates(activeRun, pool, node);
    node.pullState.candidateIds = deduplicated.map(pullCandidateKey);
    return deduplicated;
  }

  global.PullCandidatesRuntime = Object.freeze({
    canonicalCandidatePlayerId,
    pullCandidateKey,
    isPullCandidateEligible,
    generatedPullCandidates,
    pullCandidates,
  });
})(globalThis);
