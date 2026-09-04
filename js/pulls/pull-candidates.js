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

  function invariants() {
    return global.PullInvariants || {
      uniqueCandidates: (candidates) => [...new Map((candidates || []).map((candidate) => [canonicalCandidatePlayerId(candidate), candidate])).values()],
      assertUniqueCandidates: (candidates) => candidates,
    };
  }

  function generatedPullCandidates(activeRun, pool, node) {
    const owned = new Set(activeRun.roster.map(canonicalCandidatePlayerId));
    const excludedKeys = new Set(node.pullState.excludedCandidateIds || []);
    const excludedCanonicalIds = new Set(
      [
        ...(node.pullState.excludedCanonicalPlayerIds || []).map(String),
        ...pool.players.filter((player) => excludedKeys.has(pullCandidateKey(player))).map(canonicalCandidatePlayerId),
      ]
    );
    const eligible = pool.players.filter((player) => (
      pool.profileAware
        ? isPullCandidateEligible(activeRun, player)
        : !owned.has(canonicalCandidatePlayerId(player))
    ) && !excludedCanonicalIds.has(canonicalCandidatePlayerId(player)));
    const available = invariants().uniqueCandidates(eligible);
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
    return invariants().assertUniqueCandidates(candidates);
  }

  function resolveCandidateIds(activeRun, pool, node) {
    const requested = node.pullState?.candidateIds || [];
    const resolved = requested
      .map((id) => pool.players.find((player) => pullCandidateKey(player) === String(id)))
      .filter(Boolean);
    const unique = invariants().uniqueCandidates(resolved);
    const generated = unique.length < 3 ? generatedPullCandidates(activeRun, pool, node) : [];
    const repaired = invariants().uniqueCandidates([...unique, ...generated]).slice(0, 3);
    const candidateIds = repaired.map(pullCandidateKey);
    return { candidates: repaired, candidateIds, repaired: candidateIds.length !== requested.length || candidateIds.some((id, index) => id !== String(requested[index])) };
  }

  function pullCandidates(activeRun, pool, node) {
    if (node.pullState?.candidateIds?.length) {
      return resolveCandidateIds(activeRun, pool, node).candidates;
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
    resolveCandidateIds,
    pullCandidates,
  });
})(globalThis);
