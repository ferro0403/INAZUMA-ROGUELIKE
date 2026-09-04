(function (global) {
  "use strict";

  function create(dependencies) {
    const { getRun, getSeasonDb, isProfileAwareSeason, pullPool, canonicalCandidatePlayerId, pullCandidateKey, isPullCandidateEligible, toast, persistGameplayMutation, activePullNodeById, rerenderCanonicalPull, renderMapFailureRecovery } = dependencies;
  function improvedCategory(category) {
  const ranks = global.SEASON1_CONFIG.categoryRanks;
  const ordered = Object.keys(ranks).sort((left, right) => ranks[left] - ranks[right]);
  const index = ordered.indexOf(category);
  if (index < 0 || index >= ordered.length - 1) return null;
  return ordered[index + 1] || null;
}

  function luckyCharmPoolForPull(pullType) {
  if (pullType === "pull_free_agents") return pullPool(pullType);
  if (pullType !== "pull_unlocked_teams") return null;

  const source = global.SeasonRegistry.sourceForSeason(getRun()?.seasonId);
  if (isProfileAwareSeason()) {
    const players = (getSeasonDb().profiles || [])
      .map((profile) => global.ProfiledSeasonRuntime.resolveProfile(getRun().seasonId, profile.profileId))
      .filter((profile) => profile && global.SpecialMatchRuntime.eligibleProfile(getRun(), profile.profileId));
    return { players, source, database: getSeasonDb(), profileAware: true };
  }
  return { players: getSeasonDb().players || [], source, database: getSeasonDb() };
}

  function chooseLuckyUpgrade(original, available, usedIds, random) {
  const requiredCategory = improvedCategory(original.category);
  if (!requiredCategory) return null;
  const role = original.position;
  const shuffled = global.DraftEngine.shuffle(
    available.filter((player) => !usedIds.has(canonicalCandidatePlayerId(player))),
    random
  );
  const exactUpgrade = shuffled.filter((player) => player.category === requiredCategory);
  const preferred = exactUpgrade.filter((player) => player.position === role);
  return preferred[0] || exactUpgrade[0] || null;
}

function buildLuckyCharmUpgrades(currentCandidates, available, random) {
  if (!Array.isArray(currentCandidates) || currentCandidates.length !== 3) return null;
  try { global.PullInvariants?.assertUniqueCandidates(currentCandidates); } catch (_) { return null; }
  const usedIds = new Set(currentCandidates.map((candidate) => canonicalCandidatePlayerId(candidate)));
  const upgradedCandidates = [];
  let upgradedCount = 0;

  currentCandidates.forEach((candidate) => {
    const selected = chooseLuckyUpgrade(candidate, available, usedIds, random);
    if (!selected) {
      upgradedCandidates.push(candidate);
      return;
    }
    usedIds.add(canonicalCandidatePlayerId(selected));
    upgradedCandidates.push(selected);
    upgradedCount += 1;
  });

  const uniqueIds = new Set(upgradedCandidates.map((candidate) => canonicalCandidatePlayerId(candidate)));
  if (uniqueIds.size !== upgradedCandidates.length) return null;
  global.PullInvariants?.assertUniqueCandidates(upgradedCandidates);
  return { candidates: upgradedCandidates, upgradedCount };
}

  function useLuckyCharmOnPull(node, pullType, currentCandidates) {
    const nodeId = String(node.id);
    const expectedCandidateIds = currentCandidates.map((player) => pullCandidateKey(player));
    if (!["pull_free_agents", "pull_unlocked_teams"].includes(pullType)) return toast("Portafortuna non utilizzabile in questa selezione.");
    if (node.pullState.luckyCharmUsed) return toast("Portafortuna già utilizzato in questa pull.");
    const luckyCharm = getRun().inventory.find((item) => item.effect === "lucky_pull");
    if (!luckyCharm) return toast("Nessun Portafortuna disponibile.");
    if (!Array.isArray(currentCandidates) || currentCandidates.length !== 3) return toast("Il Portafortuna richiede una selezione completa di 3 candidati.");
    const pool = luckyCharmPoolForPull(pullType);
    if (!pool) return toast("Portafortuna non utilizzabile in questa selezione.");
    const owned = new Set(getRun().roster.map((entry) => canonicalCandidatePlayerId(entry)));
    const eligible = pool.players.filter((player) => pool.profileAware ? isPullCandidateEligible(getRun(), player) : !owned.has(canonicalCandidatePlayerId(player)));
    const available = global.PullInvariants ? global.PullInvariants.uniqueCandidates(eligible) : [...new Map(eligible.map((player) => [canonicalCandidatePlayerId(player), player])).values()];
    const random = global.DraftEngine.randomFromSeed(`${getRun().currentZone.seed}:${node.id}:lucky:${node.pullState.rerolls}`);
    const upgradeResult = buildLuckyCharmUpgrades(currentCandidates, available, random);
  if (!upgradeResult || upgradeResult.upgradedCount < 1) return toast("Nessun candidato può salire di rarità con il Portafortuna.");
  const upgradedCandidates = upgradeResult.candidates;
    const committed = persistGameplayMutation({
      label: "lucky-charm-reroll",
      mutate: (current) => {
        const currentNode = activePullNodeById(current, nodeId, pullType);
        const index = current.inventory.findIndex((item) => String(item.instanceId) === String(luckyCharm.instanceId));
        const canonicalIds = (currentNode?.pullState?.candidateIds || []).map(String);
        if (!currentNode?.pullState || currentNode.pullState.pullType !== pullType || currentNode.pullState.luckyCharmUsed || index < 0 || canonicalIds.length !== expectedCandidateIds.length || canonicalIds.some((id, index) => id !== expectedCandidateIds[index])) throw new Error("Lucky Charm state changed");
        current.inventory.splice(index, 1);
        global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.LUCKY_CHARM_USED, { nodeId: node.id, itemId: luckyCharm.id, instanceId: luckyCharm.instanceId, upgradedCount: upgradeResult.upgradedCount, actionId: `${current.runId}:${node.id}:lucky_charm` });
        currentNode.pullState.luckyCharmUsed = true;
        currentNode.pullState.candidateIds = upgradedCandidates.map((player) => pullCandidateKey(player, pool));
      },
      onCommitted: () => rerenderCanonicalPull(nodeId, pullType),
      rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
    });
    return committed;
  }

  function useScoutTokenOnPull(node, pullType, candidates, scoutToken, pool, options = {}) {
    const nodeId = String(node.id);
    const expectedCandidateIds = candidates.map((player) => pullCandidateKey(player));
    return persistGameplayMutation({
      label: "scout-token-reroll",
      mutate: (current) => {
        const currentNode = activePullNodeById(current, nodeId, pullType);
        const index = current.inventory.findIndex((item) => String(item.instanceId) === String(scoutToken.instanceId));
        const canonicalIds = (currentNode?.pullState?.candidateIds || []).map(String);
        if (!currentNode || index < 0 || canonicalIds.length !== expectedCandidateIds.length || canonicalIds.some((id, candidateIndex) => id !== expectedCandidateIds[candidateIndex])) throw new Error("Scout Token state changed");
        current.inventory.splice(index, 1);
        global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.REROLL_USED, { nodeId, itemId: scoutToken.id, instanceId: scoutToken.instanceId, actionId: `${current.runId}:${nodeId}:reroll:${currentNode.pullState.rerolls + 1}` });
        currentNode.pullState.excludedCandidateIds.push(...candidates.map((player) => pullCandidateKey(player, pool)));
        currentNode.pullState.excludedCanonicalPlayerIds = [...new Set([
          ...(currentNode.pullState.excludedCanonicalPlayerIds || []).map(String),
          ...candidates.map((player) => canonicalCandidatePlayerId(player)),
        ])];
        currentNode.pullState.rerolls += 1;
        currentNode.pullState.candidateIds = global.PullCandidatesRuntime.generatedPullCandidates(current, pool, currentNode).map(pullCandidateKey);
      },
      onCommitted: () => rerenderCanonicalPull(nodeId, pullType, options),
      rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
    });
  }


    return { improvedCategory, luckyCharmPoolForPull, chooseLuckyUpgrade, buildLuckyCharmUpgrades, useLuckyCharmOnPull, useScoutTokenOnPull };
  }

  global.PullItemsRuntime = { create };
})(globalThis);
