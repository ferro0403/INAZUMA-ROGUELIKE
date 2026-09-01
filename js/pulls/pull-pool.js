(function (global) {
  "use strict";

  function create(dependencies) {
    const { getRun, getSeasonDb, getFreeAgentsDb, isProfileAwareSeason } = dependencies;
  function previousBossLevel() {
    return global.RoguelikeRules.unlockedPullLevel(getSeasonDb(), getRun().bossIndex);
  }

  function pullPool(type) {
    if (type === "pull_free_agents" && getSeasonDb()?.recruitmentPool?.entries && isProfileAwareSeason()) {
      const minimums = getSeasonDb().recruitmentRules?.pullFreeAgents?.minimumFinalOverallByBossIndex || getSeasonDb().rules?.pullFreeAgentsMinimumFinalOverallByBossIndex || [];
      const minimum = Number(minimums[Math.min(Number(getRun().bossIndex || 0), minimums.length - 1)] || 0);
      const effectivePool = global.RecruitmentPoolRuntime.effectiveProfiledPlayers(getSeasonDb(), getFreeAgentsDb());
      return { players: global.RecruitmentPoolRuntime.eligibleFreeAgentPullPlayers(effectivePool, getRun().bossIndex, getSeasonDb()), source: "mixed", sourceForPlayer: (player) => global.RecruitmentPoolRuntime.candidateSource(player, getRun().seasonId), database: getSeasonDb(), profileAware: true, minimumFinalOverall: minimum };
    }
    if (type === "pull_free_agents") return { players: getFreeAgentsDb().players, source: "free_agents", database: getFreeAgentsDb() };
    if (type === "pull_unlocked_teams") {
      const unlocked = new Set([...(getRun().unlockedTeamIds || []), ...(getRun().unlockedSpecialTeamIds || [])].map(String));
      const teams = getSeasonDb().teams.filter((team) => unlocked.has(String(team.teamId)));
      if (isProfileAwareSeason()) {
        const specialPool = new Map((getSeasonDb().specialMatches || []).map((match) => [String(match.teamId), match.reward?.teamPullPoolProfileIds || []]));
        const profileIds = teams.flatMap((team) => specialPool.get(String(team.teamId)) || team.playerProfileIds || []);
        return { players: profileIds.map((profileId) => global.ProfiledSeasonRuntime.resolveProfile(getRun().seasonId, profileId)).filter((profile) => profile && global.SpecialMatchRuntime.eligibleProfile(getRun(), profile.profileId)), source: global.SeasonRegistry.sourceForSeason(getRun().seasonId), database: getSeasonDb(), profileAware: true };
      }
      const ids = new Set(teams.flatMap((team) => team.playerIds.map(String)));
      return { players: getSeasonDb().players.filter((player) => ids.has(String(player.playerId))), source: global.SeasonRegistry.sourceForSeason(getRun()?.seasonId), database: getSeasonDb() };
    }
    const legendaryById = new Map();
    const legendarySources = new Map();
    getFreeAgentsDb().players
      .filter((player) => global.SEASON1_CONFIG.legendaryCategories.includes(global.DevelopmentRuntime.resolveEffectiveMetadata(getRun(), player, getFreeAgentsDb()).category))
      .forEach((player) => {
        legendaryById.set(String(player.playerId), { ...player, pullCandidateKind: "free_agent" });
        legendarySources.set(String(player.playerId), "free_agents");
      });
    const seasonalLegendaryPlayers = isProfileAwareSeason()
      ? (getSeasonDb().profiles || []).filter((profile) => global.SpecialMatchRuntime.eligibleProfile(getRun(), profile.profileId))
      : getSeasonDb().players;
    seasonalLegendaryPlayers
      .filter((player) => global.SEASON1_CONFIG.legendaryCategories.includes(player.category))
      .forEach((player) => {
        const previous = legendaryById.get(String(player.playerId));
        if (!previous || Number(player.profileRank || 0) > Number(previous.profileRank || 0)) {
          legendaryById.set(String(player.playerId), { ...player, pullCandidateKind: "season_profile" });
          legendarySources.set(String(player.profileId || player.playerId), global.SeasonRegistry.sourceForSeason(getRun()?.seasonId));
        }
      });
    return {
      players: [...legendaryById.values()],
      source: "mixed",
      sourceForPlayer: (player) => legendarySources.get(String(player.profileId || player.playerId)) || legendarySources.get(String(player.playerId)),
      database: getFreeAgentsDb(),
      profileAware: isProfileAwareSeason(),
    };
  }

  function canonicalCandidatePlayerId(player) {
    return global.RecruitmentPoolRuntime.canonicalPlayerId(player);
  }

  function isSeasonProfileCandidate(player) {
    return global.RecruitmentPoolRuntime.isSeasonProfileCandidate(player);
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


    return { previousBossLevel, pullPool, canonicalCandidatePlayerId, isSeasonProfileCandidate, pullCandidateKey, isPullCandidateEligible, selectWeightedCandidates };
  }

  global.PullPoolRuntime = { create };
})(globalThis);
