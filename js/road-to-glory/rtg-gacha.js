(function (global) {
  "use strict";

  const cfg = () => global.RoadToGloryConfig.SEASON1;
  const rng = () => global.RoadToGloryRng;
  const id = (value) => String(value ?? "");
  const legacyCardApi = Object.freeze({
    FREE_AGENTS: "free_agents",
    cardIdForFreeAgent: (playerId) => id(playerId),
    cardIdForSeason: (playerId) => id(playerId),
    normalizeSeasonId: (seasonId) => id(seasonId),
    record(value) { return this.parse(value); },
    parse(value) {
      if (value && typeof value === "object") {
        const cardId = id(value.cardId || value.playerId || value.id);
        const playerId = id(value.playerId || value.id || cardId);
        return { cardId, playerId, legacySeasonId: value.legacySeasonId || null, sourceKind: value.sourceKind || "legacy" };
      }
      const raw = id(value);
      const split = raw.indexOf("::");
      return split > 0
        ? { cardId: raw, playerId: raw.slice(split + 2), legacySeasonId: raw.slice(0, split), sourceKind: raw.startsWith("free_agents::") ? "free_agents" : "season" }
        : { cardId: raw, playerId: raw, legacySeasonId: null, sourceKind: "legacy" };
    },
  });
  const cards = () => global.RoadToGloryCardIdentity || legacyCardApi;
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function teamPlayerIds(seasonDb, teamId) {
    const team = (seasonDb?.teams || []).find((entry) => id(entry?.teamId || entry?.id) === id(teamId));
    if (team?.playerIds?.length) return team.playerIds.map(id);
    const boss = (seasonDb?.bossOrder || []).find((entry) => id(entry?.teamId) === id(teamId));
    return (boss?.rewardPoolPlayerIds || []).map(id);
  }

  function unlockedCandidates(state, seasonDb) {
    const api = cards();
    const seasonId = api.normalizeSeasonId(state?.activeSeasonId || seasonDb?.seasonId || "ie1");
    const defeated = new Set((state?.defeatedTeamIds || []).map(id));
    const allowedIds = new Set();
    for (const teamId of defeated) {
      for (const playerId of teamPlayerIds(seasonDb, teamId)) allowedIds.add(playerId);
    }
    const seen = new Set();
    const output = [];
    for (const player of seasonDb?.players || []) {
      const playerId = id(player?.playerId || player?.id);
      if (!allowedIds.has(playerId)) continue;
      const cardId = api.cardIdForSeason(playerId, seasonId);
      if (!cardId || seen.has(cardId)) continue;
      seen.add(cardId);
      output.push(Object.freeze({
        ...player,
        playerId: api.parse(cardId).playerId,
        cardId,
        legacySeasonId: seasonId,
      }));
    }
    return output;
  }

  function ownedCardIds(state, accessibleCardIds = []) {
    return new Set([
      ...(accessibleCardIds || []).map((value) => cards().parse(value).cardId || id(value)),
      ...(state?.gachaAcquiredCards || []).map((entry) => cards().parse(entry).cardId),
    ].filter(Boolean));
  }

  function unownedCandidates(state, seasonDb, accessibleCardIds = []) {
    const owned = ownedCardIds(state, accessibleCardIds);
    return unlockedCandidates(state, seasonDb).filter((player) => !owned.has(id(player?.cardId)));
  }

  function rarityWeightsForCandidates(candidates) {
    const configured = cfg().rarityWeights || {};
    const available = new Set((candidates || []).map((player) => String(player?.category || "Normale")));
    const entries = Object.entries(configured)
      .filter(([rarity, weight]) => Number(weight) > 0 && available.has(rarity))
      .map(([rarity, weight]) => ({ rarity, weight: Number(weight) }));
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (!total) return [];
    return entries.map((entry) => Object.freeze({ rarity: entry.rarity, weight: entry.weight / total * 100 }));
  }

  function availableRarityWeights(state, seasonDb) {
    return rarityWeightsForCandidates(unlockedCandidates(state, seasonDb));
  }

  function previewPool(state, seasonDb, accessibleCardIds = []) {
    const candidates = unownedCandidates(state, seasonDb, accessibleCardIds);
    return Object.freeze({
      candidates: Object.freeze(candidates),
      rarities: Object.freeze(rarityWeightsForCandidates(candidates)),
    });
  }

  function pull(inputState, { seasonDb, accessibleCardIds = [], accessiblePlayerIds = [] } = {}) {
    const state = clone(inputState || {});
    const cost = Number(cfg().pullCost || 300);
    if ((Number(state.tokens) || 0) < cost) {
      throw Object.assign(new Error("Gettoni RTG insufficienti"), { code: "rtg-gacha-insufficient-tokens" });
    }
    const accessible = accessibleCardIds.length
      ? accessibleCardIds
      : (accessiblePlayerIds || []).map((playerId) => cards().cardIdForFreeAgent(playerId));
    const candidates = unownedCandidates(state, seasonDb, accessible);
    if (!candidates.length) {
      throw Object.assign(new Error("Nessun nuovo giocatore RTG disponibile"), { code: "rtg-gacha-empty-pool" });
    }
    const rarities = rarityWeightsForCandidates(candidates);
    const activeRarities = rarities.filter((entry) => Number(entry.weight) > 0);
    if (!activeRarities.length) {
      throw Object.assign(new Error("Nessuna rarità RTG disponibile"), { code: "rtg-gacha-empty-pool" });
    }
    const pullIndex = Math.max(0, Number(state.gacha?.pullCount) || 0);
    const rarity = rng().weightedPick(activeRarities, (entry) => entry.weight, rng().float(state.campaignSeed, "gacha-rarity", pullIndex))?.rarity;
    const rarityPool = candidates.filter((player) => String(player?.category || "Normale") === String(rarity));
    const playerRoll = rng().float(state.campaignSeed, `gacha-player:${rarity}`, pullIndex);
    const player = rarityPool[Math.min(rarityPool.length - 1, Math.floor(playerRoll * rarityPool.length))] || rarityPool[0];
    if (!player) throw Object.assign(new Error("Nessun giocatore RTG disponibile"), { code: "rtg-gacha-empty-pool" });

    const card = cards().record(player);
    state.tokens = (Number(state.tokens) || 0) - cost;
    state.gacha = { ...(state.gacha || {}), pullCount: pullIndex + 1 };
    state.gachaAcquiredCards = [
      ...(state.gachaAcquiredCards || []).filter((entry) => cards().parse(entry).cardId !== card.cardId),
      clone(card),
    ];

    return {
      state,
      result: Object.freeze({
        cardId: card.cardId,
        playerId: card.playerId,
        legacySeasonId: card.legacySeasonId,
        rarity: String(player.category || rarity || "Normale"),
        duplicate: false,
        refund: 0,
        balanceAfter: state.tokens,
      }),
    };
  }

  global.RoadToGloryGacha = Object.freeze({ unlockedCandidates, ownedCardIds, unownedCandidates, availableRarityWeights, previewPool, pull });
})(globalThis);
