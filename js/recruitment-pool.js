(function (global) {
  "use strict";

  const id = (value) => String(value ?? "");

  function isSeasonProfileCandidate(player) {
    return player?.sourceKind === "season3_recruitment_profile"
      || player?.pullCandidateKind === "season_profile"
      || (player?.pullCandidateKind !== "free_agent" && Boolean(player?.profileId));
  }

  function canonicalPlayerId(player) { return id(player?.playerId); }
  function candidateKey(player) { return id(isSeasonProfileCandidate(player) ? player.profileId : player?.playerId); }
  function candidateSource(player, seasonId = "ie1_s3") { return isSeasonProfileCandidate(player) ? seasonId : "free_agents"; }

  function effectiveSeason3Players(seasonDb, freeAgentsDb, profiles = global.ProfiledSeasonRuntime) {
    const excluded = new Set(["1196"]);
    const byPlayerId = new Map();
    (freeAgentsDb?.players || []).forEach((player) => {
      const playerId = canonicalPlayerId(player);
      if (!playerId || excluded.has(playerId)) return;
      byPlayerId.set(playerId, { ...player, playerId, sourceKind: "global_free_agent", source: "free_agents", pullCandidateKind: "free_agent" });
    });
    (seasonDb?.recruitmentPool?.entries || [])
      .filter((entry) => entry.sourceKind === "season3_recruitment_profile" && !excluded.has(canonicalPlayerId(entry)))
      .forEach((entry) => {
        const profile = profiles?.resolveProfile?.("ie1_s3", entry.profileId);
        const base = profile && profiles?.resolveEffectiveBase?.({ playerId: entry.playerId, activeProfileId: entry.profileId, activeRoleVariantId: profile.defaultRoleVariantId }, "ie1_s3");
        const candidate = { ...(base || profile || {}), ...entry, playerId: canonicalPlayerId(entry), source: "ie1_s3", pullCandidateKind: "season_profile", defaultRoleVariantId: profile?.defaultRoleVariantId || null };
        if (candidate.playerId && candidate.profileId) byPlayerId.set(candidate.playerId, candidate);
      });
    return [...byPlayerId.values()];
  }

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

  global.RecruitmentPoolRuntime = { effectiveSeason3Players, canonicalPlayerId, isSeasonProfileCandidate, candidateKey, candidateSource, eligible, choiceDatabase, orderedAlbumTeams };
})(globalThis);
