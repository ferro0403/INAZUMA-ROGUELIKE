(function (global) {
  "use strict";

  const ORDER = Object.freeze(["ie1", "ie1_s2", "ie1_s3"]);
  const id = (value) => String(value ?? "");
  const cardIdentity = () => global.RoadToGloryCardIdentity;

  function seasonIndex(seasonId) {
    const index = ORDER.indexOf(id(seasonId));
    return index >= 0 ? index : 0;
  }

  function playerInSeason(playerId, seasonId) {
    const direct = global.SeasonRegistry?.player?.(playerId, seasonId);
    if (direct) return direct;
    const db = global.SeasonRegistry?.database?.(seasonId);
    return (db?.players || []).find((player) => id(player?.playerId) === id(playerId)) || null;
  }

  function canonicalIdFor(seasonId, playerId) {
    return id(global.ProfiledSeasonRuntime?.canonicalPlayerId?.(seasonId, playerId) || playerId);
  }

  function freeAgentById(playerId, freeAgentsDb) {
    return (freeAgentsDb?.players || []).find((player) => id(player?.playerId || player?.id) === id(playerId)) || null;
  }

  function developmentState() {
    try {
      return global.DevelopmentAccountV3?.read?.() || null;
    } catch (_) {
      return null;
    }
  }

  function evolvedFreeAgent(playerId, freeAgentsDb) {
    const base = freeAgentById(playerId, freeAgentsDb);
    if (!base) return null;
    const playerIdKey = id(base.playerId || base.id || playerId);
    const state = developmentState();
    const chain = state?.players?.[playerIdKey];
    const active = chain?.steps?.at?.(-1) || chain?.legacyNormale || null;
    const profile = active?.profile || null;
    if (!profile) return null;
    return { base, playerId: playerIdKey, state, active, profile };
  }

  function resolveEvolvedFreeAgent(playerId, freeAgentsDb, level = 20) {
    const evolved = evolvedFreeAgent(playerId, freeAgentsDb);
    if (!evolved) return null;
    let player = null;
    if (global.DevelopmentRuntime?.resolveAccountPlayer) {
      try {
        player = global.DevelopmentRuntime.resolveAccountPlayer(evolved.base, level, freeAgentsDb, { state: evolved.state });
      } catch (_) {
        player = null;
      }
    }
    if (!player && global.DevelopmentV3?.resolveValidatedMaterializedPlayer) {
      try {
        player = global.DevelopmentV3.resolveValidatedMaterializedPlayer(evolved.base, evolved.profile, level);
      } catch (_) {
        player = null;
      }
    }
    if (!player) return null;
    return {
      ...player,
      playerId: evolved.playerId,
      level,
      category: evolved.profile.category || evolved.active?.rarity || player.category,
      resolvedSeasonId: "free_agents",
      developmentApplied: true,
    };
  }

  function resolveExactCard(cardRef, freeAgentsDb = null) {
    const api = cardIdentity();
    if (!api) return null;
    const parsed = api.parse(cardRef);
    if (!parsed.cardId || !api.isCardId(parsed.cardId)) return null;
    if (parsed.sourceKind === api.FREE_AGENTS) {
      const freeAgent = freeAgentById(parsed.playerId, freeAgentsDb);
      if (!freeAgent) return null;
      return Object.freeze({
        cardId: parsed.cardId,
        playerId: parsed.playerId,
        legacySeasonId: api.FREE_AGENTS,
        seasonId: api.FREE_AGENTS,
        player: Object.freeze({ ...freeAgent, playerId: parsed.playerId, cardId: parsed.cardId, legacySeasonId: api.FREE_AGENTS }),
      });
    }
    const seasonId = parsed.legacySeasonId;
    const canonicalId = canonicalIdFor(seasonId, parsed.playerId);
    const player = playerInSeason(canonicalId, seasonId) || playerInSeason(parsed.playerId, seasonId);
    if (!player) return null;
    const playerId = canonicalIdFor(seasonId, player.playerId || parsed.playerId);
    const cardId = api.cardIdForSeason(playerId, seasonId);
    return Object.freeze({
      cardId,
      playerId,
      legacySeasonId: seasonId,
      seasonId,
      player: Object.freeze({ ...player, playerId, cardId, legacySeasonId: seasonId }),
    });
  }

  function resolveVersion(playerId, activeSeasonId = "ie1", freeAgentsDb = null) {
    const api = cardIdentity();
    const rawRef = id(playerId?.cardId || playerId);
    if (api?.isCardId?.(rawRef)) return resolveExactCard(rawRef, freeAgentsDb);

    const requestedId = id(playerId?.playerId || playerId);
    if (!requestedId) return null;
    const maxIndex = seasonIndex(activeSeasonId);
    for (let index = maxIndex; index >= 0; index -= 1) {
      const seasonId = ORDER[index];
      const canonicalId = canonicalIdFor(seasonId, requestedId);
      const player = playerInSeason(canonicalId, seasonId) || playerInSeason(requestedId, seasonId);
      if (!player) continue;
      return Object.freeze({
        seasonId,
        player: Object.freeze({ ...player, playerId: canonicalIdFor(seasonId, player.playerId || requestedId) }),
      });
    }
    const freeAgent = freeAgentById(requestedId, freeAgentsDb);
    if (!freeAgent) return null;
    return Object.freeze({
      seasonId: "free_agents",
      player: Object.freeze({ ...freeAgent, playerId: id(freeAgent.playerId || freeAgent.id || requestedId) }),
    });
  }

  function resolveAtLevel20(playerId, activeSeasonId = "ie1", roleVariantId = null, freeAgentsDb = null) {
    const api = cardIdentity();
    const rawRef = id(playerId?.cardId || playerId);
    const exactCard = api?.isCardId?.(rawRef);
    const parsed = exactCard ? api.parse(rawRef) : null;

    if (!exactCard || parsed?.sourceKind === api.FREE_AGENTS) {
      const evolvedId = parsed && parsed.sourceKind === api?.FREE_AGENTS ? parsed.playerId : id(playerId?.playerId || playerId);
      const evolved = resolveEvolvedFreeAgent(evolvedId, freeAgentsDb, 20);
      if (evolved) {
        return exactCard ? { ...evolved, cardId: parsed.cardId, legacySeasonId: api.FREE_AGENTS } : evolved;
      }
    }

    const resolved = resolveVersion(playerId, activeSeasonId, freeAgentsDb);
    if (!resolved) return null;
    const database = resolved.seasonId === "free_agents" ? freeAgentsDb : (global.SeasonRegistry?.database?.(resolved.seasonId) || null);
    const canonicalPlayerId = id(resolved.player.playerId || parsed?.playerId || playerId);
    let player;
    if (database?.requiresProfileAwareRuntime && global.ProfiledSeasonRuntime?.resolveEffectivePlayerAtLevel) {
      player = global.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel({
        playerId: canonicalPlayerId,
        level: 20,
        levelUnits: 0,
        activeRoleVariantId: roleVariantId || undefined,
      }, {
        seasonId: resolved.seasonId,
        database,
      });
    } else if (global.InazumaProgression?.getPlayerAtLevel) {
      player = global.InazumaProgression.getPlayerAtLevel(resolved.player, 20, database);
    } else {
      player = { ...resolved.player, level: 20 };
    }
    if (!player) return null;
    const result = { ...player, playerId: canonicalPlayerId, level: 20, resolvedSeasonId: resolved.seasonId };
    if (resolved.cardId) {
      result.cardId = resolved.cardId;
      result.legacySeasonId = resolved.legacySeasonId;
    }
    return result;
  }

  function resolveMove(playerId, activeSeasonId = "ie1", role = null, freeAgentsDb = null) {
    const api = cardIdentity();
    const rawRef = id(playerId?.cardId || playerId);
    const parsed = api?.isCardId?.(rawRef) ? api.parse(rawRef) : null;
    if ((parsed?.sourceKind === api?.FREE_AGENTS || !parsed) && evolvedFreeAgent(parsed?.playerId || id(playerId?.playerId || playerId), freeAgentsDb)) return null;
    const resolved = resolveVersion(playerId, activeSeasonId, freeAgentsDb);
    if (!resolved || resolved.seasonId === "free_agents") return null;
    const player = resolveAtLevel20(playerId, activeSeasonId, role ? String(role).toLowerCase() : null, freeAgentsDb) || resolved.player;
    return global.MatchMoveRuntime?.moveForPlayer?.(resolved.seasonId, player, role) || null;
  }

  function rarity(playerId, activeSeasonId = "ie1", freeAgentsDb = null) {
    const api = cardIdentity();
    const rawRef = id(playerId?.cardId || playerId);
    const parsed = api?.isCardId?.(rawRef) ? api.parse(rawRef) : null;
    if (parsed?.sourceKind === api?.FREE_AGENTS || !parsed) {
      const evolved = evolvedFreeAgent(parsed?.playerId || id(playerId?.playerId || playerId), freeAgentsDb);
      if (evolved) return evolved.profile?.category || evolved.active?.rarity || evolved.base?.category || null;
    }
    return resolveVersion(playerId, activeSeasonId, freeAgentsDb)?.player?.category || null;
  }

  global.RoadToGloryPlayerResolver = Object.freeze({ ORDER, resolveExactCard, resolveVersion, resolveAtLevel20, resolveMove, rarity });
})(globalThis);
