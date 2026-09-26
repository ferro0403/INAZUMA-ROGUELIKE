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
    const explicitProfile = parsed.playerId.includes("@") ? global.ProfiledSeasonRuntime?.resolveProfile?.(seasonId,parsed.playerId) : null;
    const sourcePlayerId = explicitProfile?.playerId || parsed.playerId;
    const canonicalId = canonicalIdFor(seasonId, sourcePlayerId);
    const player = playerInSeason(canonicalId, seasonId) || playerInSeason(sourcePlayerId, seasonId);
    if (!player) return null;
    const canonicalPlayerId = canonicalIdFor(seasonId, player.playerId || explicitProfile?.playerId || parsed.canonicalPlayerId || parsed.playerId);
    const exactPlayerId = explicitProfile?.profileId || parsed.profileId || parsed.playerId;
    const cardId = parsed.cardId;
    return Object.freeze({
      cardId,
      playerId: exactPlayerId,
      canonicalPlayerId,
      profileId: explicitProfile?.profileId || parsed.profileId || null,
      legacySeasonId: seasonId,
      seasonId,
      player: Object.freeze({ ...player, playerId: canonicalPlayerId, cardId, legacySeasonId: seasonId }),
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

  function teamPresentation(player, database) {
    if (!player || !database) return { resolvedTeamId:"", teamName:player?.teamName || "", teamLogoUrl:player?.teamLogoUrl || "" };
    const ids=[player.resolvedTeamId,player.teamId,...(player.teamIds||[])].map(id).filter(Boolean);
    let team=ids.map(teamId=>(database?.teams||[]).find(entry=>id(entry?.teamId||entry?.id)===teamId)).find(Boolean)||null;
    const playerTeamName=id(player.teamName);
    if(!team&&playerTeamName)team=(database?.teams||[]).find(entry=>id(entry?.teamName||entry?.name)===playerTeamName)||null;
    return {
      resolvedTeamId:id(team?.teamId||team?.id||player.teamId||player.teamIds?.[0]),
      teamName:id(player.teamName||team?.teamName||team?.name),
      teamLogoUrl:id(team?.logoUrl||player.teamLogoUrl),
    };
  }

  function resolveBaseAtLevel20(playerId, activeSeasonId = "ie1", roleVariantId = null, freeAgentsDb = null, progressionOptions = null) {
    const api = cardIdentity();
    const rawRef = id(playerId?.cardId || playerId);
    const exactCard = api?.isCardId?.(rawRef);
    const parsed = exactCard ? api.parse(rawRef) : null;
    const resolved = resolveVersion(playerId, activeSeasonId, freeAgentsDb);
    if (!resolved) return null;
    const database = resolved.seasonId === "free_agents" ? freeAgentsDb : (global.SeasonRegistry?.database?.(resolved.seasonId) || null);
    const canonicalPlayerId = id(resolved.canonicalPlayerId || resolved.player.playerId || parsed?.canonicalPlayerId || parsed?.playerId || playerId);
    const options = progressionOptions && typeof progressionOptions === "object" ? progressionOptions : {};
    let player;
    if (database?.requiresProfileAwareRuntime && global.ProfiledSeasonRuntime?.resolveEffectivePlayerAtLevel) {
      player = global.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel({
        playerId: canonicalPlayerId,
        activeProfileId: resolved.profileId || resolved.player?.profileId || undefined,
        level: 20,
        levelUnits: 0,
        activeRoleVariantId: roleVariantId || undefined,
        ...options,
      }, {
        seasonId: resolved.seasonId,
        database,
      });
    } else if (global.InazumaProgression?.getPlayerAtLevel) {
      player = global.InazumaProgression.getPlayerAtLevel(resolved.player, 20, database, options);
    } else {
      player = { ...resolved.player, level: 20 };
    }
    if (!player) return null;
    const teamMeta=teamPresentation(player,database);
    const result = {
      ...player,
      ...teamMeta,
      playerId: canonicalPlayerId,
      level: 20,
      resolvedSeasonId: resolved.seasonId,
    };
    if (resolved.cardId) {
      result.cardId = resolved.cardId;
      result.legacySeasonId = resolved.legacySeasonId;
    }
    return result;
  }

  function resolveStandardAtLevel20(playerId, activeSeasonId = "ie1", roleVariantId = null, freeAgentsDb = null) {
    return resolveBaseAtLevel20(playerId, activeSeasonId, roleVariantId, freeAgentsDb, null);
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
    return resolveBaseAtLevel20(playerId, activeSeasonId, roleVariantId, freeAgentsDb, null);
  }

  function resolveOwnedAtLevel20(playerId, activeSeasonId = "ie1", roleVariantId = null, freeAgentsDb = null, developmentByCardId = null) {
    const standard = resolveStandardAtLevel20(playerId, activeSeasonId, roleVariantId, freeAgentsDb);
    if (!standard) return null;
    const api = cardIdentity();
    const rawRef = id(playerId?.cardId || playerId);
    const parsed = api?.isCardId?.(rawRef) ? api.parse(rawRef) : null;
    const cardId = id(standard.cardId || parsed?.cardId || rawRef);
    const upgrade = developmentByCardId && typeof developmentByCardId === "object" ? developmentByCardId[cardId] : null;
    const targetPotential = Math.max(0, Math.min(99, Number(upgrade?.targetPotential) || 0));
    const currentPotential = Math.max(0, Number(standard.potential ?? standard.finalOverall ?? standard.overall) || 0);
    const boost = Math.max(0, targetPotential - currentPotential);
    if (!boost) return standard;
    return resolveBaseAtLevel20(playerId, activeSeasonId, roleVariantId, freeAgentsDb, {
      potentialBoost: boost,
      currentOverallBoost: boost,
      potentialBoostApplications: [{ amount: boost, appliedLevel: 0, permanent: true }],
    });
  }

  function resolveMove(playerId, activeSeasonId = "ie1", role = null, freeAgentsDb = null, roleVariantId = null) {
    const api = cardIdentity();
    const rawRef = id(playerId?.cardId || playerId);
    const parsed = api?.isCardId?.(rawRef) ? api.parse(rawRef) : null;
    if ((parsed?.sourceKind === api?.FREE_AGENTS || !parsed) && evolvedFreeAgent(parsed?.playerId || id(playerId?.playerId || playerId), freeAgentsDb)) return null;
    const resolved = resolveVersion(playerId, activeSeasonId, freeAgentsDb);
    if (!resolved || resolved.seasonId === "free_agents") return null;
    const player = resolveAtLevel20(playerId, activeSeasonId, roleVariantId, freeAgentsDb) || resolved.player;
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

  global.RoadToGloryPlayerResolver = Object.freeze({ ORDER, resolveExactCard, resolveVersion, resolveBaseAtLevel20, resolveStandardAtLevel20, resolveAtLevel20, resolveOwnedAtLevel20, resolveMove, rarity });
})(globalThis);
