(function (global) {
  "use strict";

  const config = () => global.RoadToGloryConfig.SEASON1;
  const id = (value) => String(value ?? "");
  const roleOf = (player) => String(player?.normalizedRole || player?.position || player?.role || "").toUpperCase();
  const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

  function accessiblePlayerIds({ freeAgentIds = [], state } = {}) {
    return Array.from(new Set([
      ...(freeAgentIds || []).map(id),
      ...(state?.gachaAcquiredPlayerIds || []).map(id),
    ].filter(Boolean)));
  }

  function activeSquad(state) {
    const seasonId = id(state?.activeSeasonId || "ie1");
    return { seasonId, squad: state?.squads?.[seasonId] || state?.squads?.ie1 || null };
  }

  function validateSquad({ state, seasonDb, freeAgentIds = [], freeAgentsDb = null, playerResolver } = {}) {
    const reasons = [];
    const { seasonId, squad } = activeSquad(state);
    if (!squad) return { valid: false, reasons: ["missing-squad"], lineupPlayers: [], benchPlayers: [], formation: null };
    const formationCatalog = config().formations || seasonDb?.formations?.eleven || [];
    const formation = formationCatalog.find((entry) => id(entry?.id) === id(squad.formationId)) || null;
    if (!formation) reasons.push("invalid-formation");

    const lineup = Array.isArray(squad.lineup) ? squad.lineup.map(id) : [];
    const bench = Array.isArray(squad.bench) ? squad.bench.map(id) : [];
    if (lineup.length !== 11) reasons.push("lineup-size");
    if (bench.length !== 4) reasons.push("bench-size");
    const all = [...lineup, ...bench];
    if (new Set(all).size !== all.length) reasons.push("duplicate-player");

    const accessible = new Set(accessiblePlayerIds({ freeAgentIds, state }));
    if (all.some((playerId) => !accessible.has(playerId))) reasons.push("inaccessible-player");

    const variants = squad.activeRoleVariantByPlayerId || {};
    const resolve = (playerId) => playerResolver?.resolveAtLevel20?.(playerId, seasonId, variants[playerId] || null, freeAgentsDb) || null;
    const lineupPlayers = lineup.map(resolve);
    const benchPlayers = bench.map(resolve);
    if ([...lineupPlayers, ...benchPlayers].some((player) => !player)) reasons.push("unresolved-player");

    if (formation && lineupPlayers.every(Boolean)) {
      const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
      for (const player of lineupPlayers) {
        const role = roleOf(player);
        if (Object.prototype.hasOwnProperty.call(counts, role)) counts[role] += 1;
      }
      for (const [role, required] of Object.entries(formation.requirements || {})) {
        if (Number(counts[String(role).toUpperCase()] || 0) !== Number(required || 0)) reasons.push(`role:${String(role).toUpperCase()}`);
      }
      const requiredTotal = Object.values(formation.requirements || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      if (requiredTotal !== lineup.length) reasons.push("formation-total");
    }

    return { valid: reasons.length === 0, reasons, lineupPlayers, benchPlayers, formation, seasonId };
  }

  function playerIdFromLineupEntry(entry) {
    return id(entry && typeof entry === "object" ? (entry.playerId || entry.id) : entry);
  }

  function teamPower({ lineup = [], activeSeasonId = "ie1", playerResolver, freeAgentsDb = null, activeRoleVariantByPlayerId = {} } = {}) {
    const entries = Array.isArray(lineup) ? lineup : [];
    if (!entries.length) return 0;
    let overallTotal = 0;
    let moveBonusTotal = 0;
    for (const entry of entries) {
      const playerId = playerIdFromLineupEntry(entry);
      const explicitVariant = entry && typeof entry === "object" ? (entry.roleVariantId || entry.activeRoleVariantId) : null;
      const variant = explicitVariant || activeRoleVariantByPlayerId?.[playerId] || null;
      const player = playerResolver?.resolveAtLevel20?.(playerId, activeSeasonId, variant, freeAgentsDb);
      if (!player) throw Object.assign(new Error(`RTG player unresolved: ${playerId}`), { code: "rtg-squad-player-unresolved", playerId });
      const overall = Number(player.overall ?? player.displayOverall ?? player.finalOverall ?? 0);
      overallTotal += Number.isFinite(overall) ? overall : 0;
      const role = String((entry && typeof entry === "object" ? entry.role : null) || roleOf(player));
      const move = playerResolver?.resolveMove?.(playerId, activeSeasonId, role, freeAgentsDb) || null;
      const power = Number(move?.power);
      if (Number.isFinite(power)) moveBonusTotal += Math.max(0, Math.min(2, (power - 50) / 30));
    }
    return round1((overallTotal / entries.length) + (moveBonusTotal / entries.length));
  }

  function recentDefeatedTeamIds(teamId, state, window) {
    const targetIndex = config().mainTeams.indexOf(id(teamId));
    if (targetIndex <= 0 || Number(window) <= 0) return [];
    const defeated = new Set((state?.defeatedTeamIds || []).map(id));
    return config().mainTeams.slice(0, targetIndex).filter((candidate) => defeated.has(candidate)).slice(-Math.max(0, Number(window) || 0));
  }

  function seasonPlayerById(seasonDb, playerId) {
    return (seasonDb?.players || []).find((player) => id(player?.playerId || player?.id) === id(playerId)) || null;
  }

  function mainEligibility({ teamId, state, seasonDb, freeAgentIds = [], freeAgentsDb = null, playerResolver } = {}) {
    const validation = validateSquad({ state, seasonDb, freeAgentIds, freeAgentsDb, playerResolver });
    const constraint = config().constraints[id(teamId)] || null;
    if (!constraint) return { eligible: false, reasons: ["unknown-main-team"], validation };
    const { seasonId, squad } = activeSquad(state);
    const lineup = squad?.lineup || [];
    const bench = squad?.bench || [];
    const activeRoster = [...lineup, ...bench];
    const power = validation.valid ? teamPower({ lineup, activeSeasonId: seasonId, playerResolver, freeAgentsDb, activeRoleVariantByPlayerId: squad.activeRoleVariantByPlayerId || {} }) : null;
    const recruitSet = new Set((state?.gachaAcquiredPlayerIds || []).map(id));
    const recruits = activeRoster.map(id).filter((playerId) => recruitSet.has(playerId));
    const recentTeams = recentDefeatedTeamIds(teamId, state, constraint.recentWindow);
    const recentTeamSet = new Set(recentTeams);
    const recentRecruits = recruits.filter((playerId) => {
      const player = seasonPlayerById(seasonDb, playerId);
      const teamIds = [player?.teamId, ...(player?.teamIds || [])].filter(Boolean).map(id);
      return teamIds.some((candidate) => recentTeamSet.has(candidate));
    });

    const reasons = [...validation.reasons];
    if (power != null && power > Number(constraint.cap)) reasons.push("team-power-cap");
    if (recruits.length < Number(constraint.minRecruit || 0)) reasons.push("min-s1-recruits");
    if (recentRecruits.length < Number(constraint.recentCount || 0)) reasons.push("recent-s1-recruits");

    return {
      eligible: reasons.length === 0,
      reasons,
      teamPower: power,
      cap: Number(constraint.cap),
      recruitCount: recruits.length,
      minRecruit: Number(constraint.minRecruit || 0),
      recentRecruitCount: recentRecruits.length,
      recentCount: Number(constraint.recentCount || 0),
      recentWindow: Number(constraint.recentWindow || 0),
      recentTeamIds: recentTeams,
      requirementRosterSize: activeRoster.length,
      validation,
    };
  }

  global.RoadToGlorySquadRuntime = Object.freeze({
    accessiblePlayerIds,
    validateSquad,
    teamPower,
    recentDefeatedTeamIds,
    mainEligibility,
  });
})(globalThis);
