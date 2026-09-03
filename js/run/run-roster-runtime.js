(function (global) {
  "use strict";

  function create(deps) {
    const getRun = deps.getRun;
    const getSeasonDb = deps.getSeasonDb;
    const getFreeAgentsDb = deps.getFreeAgentsDb;
    const getFreeAgentsById = deps.getFreeAgentsById;
    const getSeasonPlayersById = deps.getSeasonPlayersById;
    const getSeasonTeamsById = deps.getSeasonTeamsById;

    function isProfileAwareSeason(seasonId = getRun()?.seasonId) {
      return global.SeasonRegistry?.database?.(seasonId)?.requiresProfileAwareRuntime === true;
    }

    function formationById(id) {
      return getSeasonDb()?.formations?.eleven?.find((formation) => formation.id === id);
    }

    function sourcePlayer(entryOrId, preferredSource) {
      const id = String(entryOrId && typeof entryOrId === "object" ? entryOrId.playerId : entryOrId);
      const source = preferredSource || (entryOrId && entryOrId.source);
      if (global.SeasonRegistry?.isSeasonSource?.(source)) return global.SeasonRegistry.player(id, source);
      return getSeasonPlayersById().get(id) || getFreeAgentsById().get(id);
    }

    function legacyRosterPlayer(entry, currentRun = getRun()) {
      if (isProfileAwareSeason(currentRun?.seasonId)) return getFreeAgentsById().get(String(entry?.playerId));
      return sourcePlayer(entry);
    }

    function rosterEntry(playerId, currentRun = getRun()) {
      return currentRun?.roster?.find((entry) => String(entry.playerId) === String(playerId));
    }

    function runtimeTrainingState(entry, currentRun = getRun()) {
      const profileAware = global.RoguelikeRules.isProfileAwareRosterEntry(entry, currentRun);
      const player = profileAware ? global.ProfiledSeasonRuntime.resolveEffectiveBase(entry, currentRun.seasonId) : sourcePlayer(entry);
      const seasonDb = getSeasonDb();
      const database = profileAware ? seasonDb : (global.SeasonRegistry?.isSeasonSource?.(entry?.source) ? (global.SeasonRegistry.database(entry.source) || seasonDb) : getFreeAgentsDb());
      return global.DevelopmentRuntime.trainingState(currentRun, player, entry, database, profileAware ? { permanentMode: "provided-base" } : undefined);
    }

    function resolvedRosterPlayer(playerId, currentRun = getRun()) {
      const entry = rosterEntry(playerId, currentRun);
      if (!entry) return null;
      const profileAware = global.RoguelikeRules.isProfileAwareRosterEntry(entry, currentRun);
      const player = profileAware ? sourcePlayer(entry) : legacyRosterPlayer(entry, currentRun);
      const seasonDb = getSeasonDb();
      const database = profileAware
        ? seasonDb
        : (isProfileAwareSeason(currentRun?.seasonId)
          ? getFreeAgentsDb()
          : (global.SeasonRegistry?.isSeasonSource?.(entry.source) ? (global.SeasonRegistry.database(entry.source) || seasonDb) : getFreeAgentsDb()));
      if (!player && !profileAware) return null;
      const resolved = profileAware
        ? global.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(entry, { seasonId: currentRun.seasonId, database })
        : global.DevelopmentRuntime.resolveRosterPlayer(currentRun, player, entry, database);
      const effectiveStats = global.RoguelikeRules.applyEquipment(resolved.stats, entry.equippedItem);
      return {
        ...resolved,
        ...effectiveStats,
        stats: effectiveStats,
        baseStats: resolved.stats,
        equipment: entry.equippedItem,
        displayLevel: Number(entry.level || 0),
        displayLevelUnits: Number(entry.levelUnits || 0),
        displayLevelText: global.LevelProgression.formatLevel(entry, currentRun.seasonId),
        source: entry.source,
      };
    }

    function roleForPlayerId(playerId, currentRun = getRun()) {
      const entry = rosterEntry(playerId, currentRun);
      return entry ? (resolvedRosterPlayer(playerId, currentRun)?.position || sourcePlayer(entry)?.position) : null;
    }

    function overallForPlayerId(playerId, currentRun = getRun()) {
      return resolvedRosterPlayer(playerId, currentRun)?.overall || 0;
    }

    function activeBasePotential(entry, currentRun = getRun()) {
      if (!entry) return 0;
      if (global.RoguelikeRules.isProfileAwareRosterEntry(entry, currentRun)) {
        return Number(global.ProfiledSeasonRuntime.resolveEffectiveBase(entry, currentRun.seasonId)?.finalOverall || 0);
      }
      return Number(legacyRosterPlayer(entry, currentRun)?.finalOverall || 0);
    }

    function permanentRosterFields(player, currentRun = getRun()) {
      return global.DevelopmentRuntime.rosterEntryPermanentFields(currentRun, player);
    }

    function averageOverall(players = null, currentRun = getRun()) {
      const list = Array.isArray(players) ? players : (currentRun?.roster || []).map((entry) => resolvedRosterPlayer(entry.playerId || entry.id, currentRun)).filter(Boolean);
      if (!list.length) return "-";
      const total = list.reduce((sum, player) => sum + Number(player.displayOverall ?? player.overall ?? player.finalOverall ?? 0), 0);
      return Math.round(total / list.length);
    }

    function addLevels(amount, actionId = null, explicitUnits = null, currentRun = getRun()) {
      if (isProfileAwareSeason(currentRun?.seasonId)) {
        const units = explicitUnits == null ? Math.round(Number(amount || 0) * 6) : Number(explicitUnits);
        const before = currentRun.roster.map((entry) => Number(entry.level || 0));
        global.ProfiledSeasonRuntime.addLevelUnits(currentRun, units, actionId);
        return currentRun.roster.filter((entry, index) => Number(entry.level || 0) > before[index]).length;
      }
      let updatedPlayers = 0;
      const numericAmount = Number(amount || 0);
      currentRun.teamLevel = Math.min(20, Number(currentRun.teamLevel) + numericAmount);
      currentRun.roster.forEach((entry) => {
        const currentLevel = Number(entry.level || 0);
        const nextLevel = Math.min(20, currentLevel + numericAmount);
        if (nextLevel > currentLevel) updatedPlayers += 1;
        entry.level = nextLevel;
      });
      return updatedPlayers;
    }

    function playerTeamIdentity(player, playerId, currentRun = getRun()) {
      const entry = playerId && Array.isArray(currentRun?.roster) ? rosterEntry(playerId, currentRun) : null;
      const ids = [entry?.teamId, player.teamId, ...(player.teamIds || [])].filter(Boolean);
      const seasonTeamsById = getSeasonTeamsById();
      const seasonDb = getSeasonDb();
      let team = ids.map((id) => seasonTeamsById.get(String(id))).find(Boolean);
      let teamName = team?.teamName || entry?.teamName || player.teamName || (player.teams || []).find((name) => name && name !== "Unaffiliated") || (player.teamId === "unaffiliated" ? "Svincolato" : "");
      if (!team && teamName) team = (seasonDb?.teams || []).find((candidate) => candidate.teamName === teamName);
      if (!teamName) teamName = "Svincolato";
      return { name: teamName === "Unaffiliated" ? "Svincolato" : teamName, logoUrl: team?.logoUrl || "", logo: team?.logo || "" };
    }

    function historicalTeamIdentity(player, team, sourceFallback) {
      const ids = [player.teamId, player.originTeamId, sourceFallback.teamId, ...(sourceFallback.teamIds || [])].filter(Boolean);
      const dbTeam = ids.map((id) => getSeasonTeamsById().get(String(id))).find(Boolean);
      const name = player.teamName || player.originTeamName || player.recruitmentTeamName || sourceFallback.teamName || dbTeam?.teamName || (team?.teamName ? `Rosa campione: ${team.teamName}` : "Svincolato");
      return { name: name === "Unaffiliated" ? "Svincolato" : name, logoUrl: player.teamLogoUrl || player.logoUrl || dbTeam?.logoUrl || "", logo: player.teamLogo || player.logo || "" };
    }

    return Object.freeze({
      isProfileAwareSeason,
      formationById,
      sourcePlayer,
      legacyRosterPlayer,
      rosterEntry,
      runtimeTrainingState,
      resolvedRosterPlayer,
      roleForPlayerId,
      overallForPlayerId,
      activeBasePotential,
      permanentRosterFields,
      averageOverall,
      addLevels,
      playerTeamIdentity,
      historicalTeamIdentity,
    });
  }

  global.RunRosterRuntime = Object.freeze({ create });
})(globalThis);
