(function (global) {
  "use strict";

  const cfg = () => global.RoadToGloryConfig.SEASON1;
  const rng = () => global.RoadToGloryRng;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const id = (value) => String(value ?? "");

  function teamPlayerIds(seasonDb, teamId) {
    const team = (seasonDb?.teams || []).find((entry) => id(entry?.teamId || entry?.id) === id(teamId));
    if (team?.playerIds?.length) return team.playerIds.map(id);
    const boss = (seasonDb?.bossOrder || []).find((entry) => id(entry?.teamId) === id(teamId));
    return (boss?.rewardPoolPlayerIds || []).map(id);
  }

  function unlockedCandidates(state, seasonDb) {
    const defeated = new Set((state?.defeatedTeamIds || []).map(id));
    const allowedIds = new Set();
    for (const teamId of defeated) {
      for (const playerId of teamPlayerIds(seasonDb, teamId)) allowedIds.add(playerId);
    }
    const seen = new Set();
    const result = [];
    for (const player of seasonDb?.players || []) {
      const playerId = id(player?.playerId || player?.id);
      if (!allowedIds.has(playerId) || seen.has(playerId)) continue;
      seen.add(playerId);
      result.push(player);
    }
    return result;
  }

  function availableRarityWeights(state, seasonDb) {
    const candidates = unlockedCandidates(state, seasonDb);
    const available = new Set(candidates.map((player) => String(player?.category || "")));
    const entries = Object.entries(cfg().rarityWeights)
      .map(([rarity, rawWeight]) => ({ rarity, rawWeight: Math.max(0, Number(rawWeight) || 0) }))
      .filter((entry) => entry.rawWeight > 0 && available.has(entry.rarity));
    const total = entries.reduce((sum, entry) => sum + entry.rawWeight, 0);
    if (!(total > 0)) return [];
    return entries.map((entry) => Object.freeze({ rarity: entry.rarity, weight: entry.rawWeight * 100 / total }));
  }

  function previewPool(state, seasonDb) {
    const candidates = unlockedCandidates(state, seasonDb);
    const rarities = availableRarityWeights(state, seasonDb);
    return Object.freeze({ candidates: Object.freeze(candidates.slice()), rarities: Object.freeze(rarities.slice()), totalCandidates: candidates.length });
  }

  function pull(inputState, { seasonDb, accessiblePlayerIds = [] } = {}) {
    const state = clone(inputState || {});
    const config = cfg();
    const cost = Number(config.pullCost || 0);
    if ((Number(state.tokens) || 0) < cost) {
      throw Object.assign(new Error("Gettoni RTG insufficienti"), { code: "rtg-gacha-insufficient-tokens" });
    }
    const candidates = unlockedCandidates(state, seasonDb);
    if (!candidates.length) {
      throw Object.assign(new Error("Nessun giocatore disponibile nel distributore RTG"), { code: "rtg-gacha-empty-pool" });
    }
    const activeRarities = availableRarityWeights(state, seasonDb);
    if (!activeRarities.length) {
      throw Object.assign(new Error("Nessuna rarità disponibile nel distributore RTG"), { code: "rtg-gacha-empty-rarity-pool" });
    }

    const pullIndex = Math.max(0, Number(state.gacha?.pullCount) || 0);
    const rarity = rng().weightedPick(activeRarities, (entry) => entry.weight, rng().float(state.campaignSeed, "gacha-rarity", pullIndex))?.rarity;
    const rarityCandidates = candidates.filter((player) => String(player?.category || "") === rarity);
    if (!rarityCandidates.length) {
      throw Object.assign(new Error("Pool rarità RTG inconsistente"), { code: "rtg-gacha-rarity-pool-empty", rarity });
    }
    const playerRoll = rng().float(state.campaignSeed, `gacha-player:${rarity}`, pullIndex);
    const player = rarityCandidates[Math.min(rarityCandidates.length - 1, Math.floor(playerRoll * rarityCandidates.length))];
    const playerId = id(player?.playerId || player?.id);
    const ownedBefore = new Set([...(accessiblePlayerIds || []).map(id), ...(state.gachaAcquiredPlayerIds || []).map(id)]);
    const duplicate = ownedBefore.has(playerId);
    const refund = duplicate ? Number(config.duplicateRefunds[rarity] || 0) : 0;

    state.tokens = (Number(state.tokens) || 0) - cost + refund;
    state.gacha = { ...(state.gacha || {}), pullCount: pullIndex + 1 };
    state.gachaAcquiredPlayerIds = Array.from(new Set([...(state.gachaAcquiredPlayerIds || []).map(id), playerId]));

    return {
      state,
      result: Object.freeze({
        playerId,
        rarity,
        duplicate,
        refund,
        cost,
        balanceAfter: state.tokens,
        pullNumber: pullIndex + 1,
      }),
    };
  }

  global.RoadToGloryGacha = Object.freeze({ unlockedCandidates, availableRarityWeights, previewPool, pull });
})(globalThis);
