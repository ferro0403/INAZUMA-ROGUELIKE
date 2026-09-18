(function (global) {
  "use strict";

  const ORDER = Object.freeze(["ie1", "ie1_s2", "ie1_s3"]);
  const id = (value) => String(value ?? "");

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
        player = global.DevelopmentRuntime.resolveAccountPlayer(
          evolved.base,
          level,
          freeAgentsDb,
          { state: evolved.state }
        );
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

  function resolveVersion(playerId, activeSeasonId = "ie1", freeAgentsDb = null) {
    const requestedId = id(playerId);
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
    const evolved = resolveEvolvedFreeAgent(playerId, freeAgentsDb, 20);
    if (evolved) return evolved;
    const resolved = resolveVersion(playerId, activeSeasonId, freeAgentsDb);
    if (!resolved) return null;
    const database = resolved.seasonId === "free_agents"
      ? freeAgentsDb
      : (global.SeasonRegistry?.database?.(resolved.seasonId) || null);
    const canonicalPlayerId = id(resolved.player.playerId || playerId);
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
    return { ...player, playerId: canonicalPlayerId, level: 20, resolvedSeasonId: resolved.seasonId };
  }

  function resolveMove(playerId, activeSeasonId = "ie1", role = null, freeAgentsDb = null) {
    const resolved = resolveVersion(playerId, activeSeasonId, freeAgentsDb);
    if (!resolved || resolved.seasonId === "free_agents") return null;
    const player = resolveAtLevel20(playerId, activeSeasonId, role ? String(role).toLowerCase() : null, freeAgentsDb) || resolved.player;
    return global.MatchMoveRuntime?.moveForPlayer?.(resolved.seasonId, player, role) || null;
  }

  function rarity(playerId, activeSeasonId = "ie1", freeAgentsDb = null) {
    const evolved = evolvedFreeAgent(playerId, freeAgentsDb);
    if (evolved) return evolved.profile?.category || evolved.active?.rarity || evolved.base?.category || null;
    return resolveVersion(playerId, activeSeasonId, freeAgentsDb)?.player?.category || null;
  }

  global.RoadToGloryPlayerResolver = Object.freeze({ ORDER, resolveVersion, resolveAtLevel20, resolveMove, rarity });
})(globalThis);
