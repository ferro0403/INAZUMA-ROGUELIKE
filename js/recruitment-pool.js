(function (global) {
  "use strict";

  const id = (value) => String(value ?? "");

  function isSeasonProfileCandidate(player) {
    return /_recruitment_profile$/.test(String(player?.sourceKind || ""))
      || player?.pullCandidateKind === "season_profile"
      || (player?.pullCandidateKind !== "free_agent" && Boolean(player?.profileId));
  }

  function canonicalPlayerId(player) { return id(player?.playerId); }
  function candidateKey(player) { return id(isSeasonProfileCandidate(player) ? player.profileId : player?.playerId); }
  function candidateSource(player, seasonId = "ie1_s3") { return isSeasonProfileCandidate(player) ? seasonId : "free_agents"; }

  function effectiveFinalOverall(candidate) {
    const base = Number(candidate?.finalOverall || 0);
    const permanent = Number(global.DevelopmentRuntime?.resolveAccountPlayer?.(candidate, Number(candidate?.maxLevel || 20))?.potential || 0);
    return Math.max(base, permanent);
  }

  function effectiveProfiledPlayers(seasonDb, freeAgentsDb, profiles = global.ProfiledSeasonRuntime) {
    const seasonId = id(seasonDb?.seasonId || "ie1_s3");
    const excluded = new Set(["1196"]);
    const byPlayerId = new Map();
    (freeAgentsDb?.players || []).forEach((player) => {
      const playerId = canonicalPlayerId(player);
      if (!playerId || excluded.has(playerId)) return;
      byPlayerId.set(playerId, { ...player, playerId, sourceKind: "global_free_agent", source: "free_agents", pullCandidateKind: "free_agent" });
    });
    (seasonDb?.recruitmentPool?.entries || [])
      .filter((entry) => isSeasonProfileCandidate(entry) && !excluded.has(canonicalPlayerId(entry)))
      .forEach((entry) => {
        const profile = profiles?.resolveProfile?.(seasonId, entry.profileId);
        const base = profile && profiles?.resolveEffectiveBase?.({ playerId: entry.playerId, activeProfileId: entry.profileId, activeRoleVariantId: profile.defaultRoleVariantId }, seasonId);
        const candidate = { ...(base || profile || {}), ...entry, playerId: canonicalPlayerId(entry), source: seasonId, pullCandidateKind: "season_profile", defaultRoleVariantId: profile?.defaultRoleVariantId || null };
        if (candidate.playerId && candidate.profileId) byPlayerId.set(candidate.playerId, candidate);
      });
    return [...byPlayerId.values()];
  }

  function effectiveSeason3Players(seasonDb, freeAgentsDb, profiles) { return effectiveProfiledPlayers(seasonDb, freeAgentsDb, profiles); }

  function eligibleForSeason3InitialDraft(candidate) {
    if (candidate?.eligibleInitialDraft === false) return false;
    return isSeasonProfileCandidate(candidate) || effectiveFinalOverall(candidate) >= 75;
  }

  function eligibleForSeason3FreeAgentPull(candidate, bossIndex, seasonDb) {
    if (candidate?.eligiblePullFreeAgents === false) return false;
    if (isSeasonProfileCandidate(candidate)) return true;
    const minimums = seasonDb?.recruitmentRules?.pullFreeAgents?.minimumFinalOverallByBossIndex
      || seasonDb?.rules?.pullFreeAgentsMinimumFinalOverallByBossIndex || [];
    const index = Math.max(0, Math.min(Number(bossIndex || 0), Math.max(0, minimums.length - 1)));
    const minimum = Math.max(75, Number(minimums[index] || 0));
    return effectiveFinalOverall(candidate) >= minimum;
  }

  const eligibleForProfiledInitialDraft = eligibleForSeason3InitialDraft;
  const eligibleForProfiledFreeAgentPull = eligibleForSeason3FreeAgentPull;

  function eligible(run, player, eligibleProfile = global.SpecialMatchRuntime?.eligibleProfile) {
    if (isSeasonProfileCandidate(player)) return Boolean(player.profileId && eligibleProfile?.(run, player.profileId));
    return !(run?.roster || []).some((entry) => id(entry.playerId) === canonicalPlayerId(player));
  }

  function choiceDatabase(source, seasonDb, freeAgentsDb, registry = global.SeasonRegistry) {
    if (source === "free_agents") return freeAgentsDb;
    return registry?.isSeasonSource?.(source) ? (registry.database(source) || seasonDb) : seasonDb;
  }

  function orderedAlbumTeams(database, includeSourceTeams = false, includeSpecialTeams = true) {
    const teamsById = new Map((database?.teams || []).map((team) => [id(team.teamId), team]));
    const bosses = (database?.bossOrder || []).map((boss) => teamsById.get(id(boss.teamId))).filter(Boolean);
    const specials = includeSpecialTeams ? (database?.specialMatches || []).map((match) => teamsById.get(id(match.teamId))).filter(Boolean) : [];
    const ordered = bosses.length ? [...bosses, ...specials, ...(includeSourceTeams ? (database?.teams || []) : [])] : (database?.teams || []);
    return [...new Map(ordered.map((team) => [id(team.teamId), team])).values()];
  }

  global.RecruitmentPoolRuntime = { effectiveProfiledPlayers, effectiveSeason3Players, eligibleForProfiledInitialDraft, eligibleForProfiledFreeAgentPull, eligibleForSeason3InitialDraft, eligibleForSeason3FreeAgentPull, effectiveFinalOverall, canonicalPlayerId, isSeasonProfileCandidate, candidateKey, candidateSource, eligible, choiceDatabase, orderedAlbumTeams };
})(globalThis);
