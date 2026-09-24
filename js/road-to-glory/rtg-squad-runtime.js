(function (global) {
  "use strict";

  const config = (seasonId="ie1") => global.RoadToGloryConfig.season?.(seasonId) || global.RoadToGloryConfig.SEASON1;
  const id = (value) => String(value ?? "");
  const legacyCardApi = Object.freeze({
    FREE_AGENTS: "free_agents",
    cardIdForFreeAgent: (playerId) => id(playerId),
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
  const round1 = (value) => Math.round(Number(value || 0) * 10) / 10;

  function accessibleCardIds({ freeAgentIds = [], state } = {}) {
    return Array.from(new Set([
      ...(freeAgentIds || []).map((playerId) => cards().cardIdForFreeAgent(playerId)),
      ...(state?.gachaAcquiredCards || []).map((entry) => cards().parse(entry).cardId),
    ].filter(Boolean)));
  }

  function accessiblePlayerIds({ freeAgentIds = [], state } = {}) {
    return Array.from(new Set(accessibleCardIds({ freeAgentIds, state }).map((cardId) => cards().parse(cardId).playerId).filter(Boolean)));
  }

  function activeSquad(state) {
    const seasonId = id(state?.activeSeasonId || "ie1");
    return { seasonId, squad: state?.squads?.[seasonId] || state?.squads?.ie1 || null };
  }

  function validateSquad({ state, seasonDb, freeAgentIds = [], freeAgentsDb = null, playerResolver } = {}) {
    const reasons = [];
    const { seasonId, squad } = activeSquad(state);
    if (!squad) return { valid: false, reasons: ["missing-squad"], lineupPlayers: [], benchPlayers: [], formation: null };
    const formationCatalog = config(seasonId).formations || seasonDb?.formations?.eleven || [];
    const formation = formationCatalog.find((entry) => id(entry?.id) === id(squad.formationId)) || null;
    if (!formation) reasons.push("missing-formation");
    const lineup = Array.isArray(squad.lineup) ? squad.lineup.map(id) : [];
    const bench = Array.isArray(squad.bench) ? squad.bench.map(id) : [];
    if (lineup.length !== 11) reasons.push("lineup-size");
    if (bench.length !== 4) reasons.push("bench-size");
    const all = [...lineup, ...bench];
    if (new Set(all).size !== all.length) reasons.push("duplicate-card");
    const accessible = new Set(accessibleCardIds({ freeAgentIds, state }));
    if (all.some((cardId) => !accessible.has(cardId))) reasons.push("inaccessible-card");

    const variants = squad.activeRoleVariantByCardId || {};
    const resolve = (cardId) => playerResolver?.resolveAtLevel20?.(cardId, seasonId, variants[cardId] || null, freeAgentsDb) || null;
    const lineupPlayers = lineup.map(resolve);
    const benchPlayers = bench.map(resolve);
    if ([...lineupPlayers, ...benchPlayers].some((player) => !player)) reasons.push("unresolved-card");

    if (formation && lineupPlayers.every(Boolean)) {
      const counts = { GK:0, DF:0, MF:0, FW:0 };
      for (const player of lineupPlayers) {
        const role = String(player?.normalizedRole || player?.position || player?.role || "").toUpperCase();
        if (Object.prototype.hasOwnProperty.call(counts, role)) counts[role] += 1;
      }
      for (const [role, required] of Object.entries(formation.requirements || {})) {
        if (Number(counts[String(role).toUpperCase()] || 0) !== Number(required || 0)) reasons.push(`formation-${String(role).toLowerCase()}`);
      }
      const requiredTotal = Object.values(formation.requirements || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      if (requiredTotal !== lineup.length) reasons.push("formation-total");
    }

    return { valid: reasons.length === 0, reasons, lineupPlayers, benchPlayers, formation, seasonId };
  }

  function cardIdFromLineupEntry(entry) {
    if (entry && typeof entry === "object") return id(entry.cardId || entry.playerId || entry.id);
    return id(entry);
  }

  function teamPower({ lineup = [], activeSeasonId = "ie1", playerResolver, freeAgentsDb = null, activeRoleVariantByCardId = {}, activeRoleVariantByPlayerId = {} } = {}) {
    const entries = Array.isArray(lineup) ? lineup : [];
    if (!entries.length) return 0;
    let overallTotal = 0;
    let moveBonusTotal = 0;
    for (const entry of entries) {
      const cardId = cardIdFromLineupEntry(entry);
      const explicitVariant = entry && typeof entry === "object" ? (entry.activeRoleVariantId || entry.roleVariantId) : null;
      const variant = explicitVariant || activeRoleVariantByCardId?.[cardId] || activeRoleVariantByPlayerId?.[cardId] || null;
      const player = playerResolver?.resolveAtLevel20?.(cardId, activeSeasonId, variant, freeAgentsDb);
      if (!player) throw Object.assign(new Error(`RTG card unresolved: ${cardId}`), { code: "rtg-squad-player-unresolved", cardId });
      const overall = Number(player.overall ?? player.displayOverall ?? player.finalOverall ?? 0);
      overallTotal += Number.isFinite(overall) ? overall : 0;
      const role = String(player.normalizedRole || player.position || player.role || "").toUpperCase();
      const move = playerResolver?.resolveMove?.(cardId, activeSeasonId, role, freeAgentsDb) || null;
      const power = Number(move?.power);
      moveBonusTotal += Number.isFinite(power) ? Math.max(0, Math.min(2, (power - 50) / 30)) : 0;
    }
    return round1((overallTotal / entries.length) + (moveBonusTotal / entries.length));
  }

  function recentDefeatedTeamIds(teamId, state, window) {
    const teams = config(state?.activeSeasonId).mainTeams || [];
    const targetIndex = teams.indexOf(id(teamId));
    if (targetIndex <= 0) return [];
    const defeated = new Set((state?.defeatedTeamIds || []).map(id));
    return teams.slice(Math.max(0, targetIndex - Math.max(0, Number(window) || 0)), targetIndex).filter((entry) => defeated.has(entry));
  }

  function teamIdsForCard(cardId, activeSeasonId, playerResolver, freeAgentsDb, seasonDb = null) {
    const parsed = cards().parse(cardId);
    const resolved = playerResolver?.resolveVersion?.(cardId, activeSeasonId, freeAgentsDb);
    const player = resolved?.player || playerResolver?.resolveAtLevel20?.(cardId, activeSeasonId, null, freeAgentsDb);
    const seasonPlayer = (seasonDb?.players || []).find((entry) => id(entry?.playerId || entry?.id) === id(parsed.playerId));
    return [
      player?.teamId,
      ...(player?.teamIds || []),
      seasonPlayer?.teamId,
      ...(seasonPlayer?.teamIds || []),
    ].filter(Boolean).map(id);
  }

  function mainEligibility({ teamId, state, seasonDb, freeAgentIds = [], freeAgentsDb = null, playerResolver } = {}) {
    const validation = validateSquad({ state, seasonDb, freeAgentIds, freeAgentsDb, playerResolver });
    const constraint = config(state?.activeSeasonId).constraints?.[id(teamId)];
    if (!constraint) return { eligible: false, reasons: ["missing-constraint"] };
    const { seasonId, squad } = activeSquad(state);
    const lineup = squad?.lineup || [];
    const bench = squad?.bench || [];
    const activeRoster = [...lineup, ...bench];
    const power = validation.valid ? teamPower({ lineup: activeRoster, activeSeasonId: seasonId, playerResolver, freeAgentsDb, activeRoleVariantByCardId: squad.activeRoleVariantByCardId || {} }) : null;
    const recruitSet = new Set([
      ...(state?.gachaAcquiredCards || []).map((entry) => cards().parse(entry).cardId),
      ...(state?.gachaAcquiredPlayerIds || []).map(id),
    ].filter(Boolean));
    const recruits = activeRoster.map(id).filter((cardId) => recruitSet.has(cardId));
    const recentTeams = recentDefeatedTeamIds(teamId, state, constraint.recentWindow);
    const recentTeamSet = new Set(recentTeams);
    const recentRecruits = recruits.filter((cardId) => teamIdsForCard(cardId, seasonId, playerResolver, freeAgentsDb, seasonDb).some((team) => recentTeamSet.has(team)));
    const reasons = [...(validation.reasons || [])];
    if (power != null && power > Number(constraint.cap)) reasons.push("team-power-cap");
    const activeSeason=id(state?.activeSeasonId||"ie1");
    const seasonRecruits=recruits.filter(cardId=>cards().parse(cardId).legacySeasonId===activeSeason);
    const eligibleRecruits=activeSeason==="ie1"?recruits:seasonRecruits;
    const eligibleRecent=recentRecruits.filter(cardId=>activeSeason==="ie1"||cards().parse(cardId).legacySeasonId===activeSeason);
    if (eligibleRecruits.length < Number(constraint.minRecruit || 0)) reasons.push("min-season-recruits");
    if (eligibleRecent.length < Number(constraint.recentCount || 0)) reasons.push("recent-season-recruits");
    return {
      eligible: reasons.length === 0,
      reasons,
      teamPower: power,
      cap: Number(constraint.cap),
      recruitCount: eligibleRecruits.length,
      minRecruit: Number(constraint.minRecruit || 0),
      recentRecruitCount: eligibleRecent.length,
      recentCount: Number(constraint.recentCount || 0),
      recentWindow: Number(constraint.recentWindow || 0),
      recentTeamIds: recentTeams,
      lineupPlayers: validation.lineupPlayers,
      benchPlayers: validation.benchPlayers,
      requirementRosterSize: activeRoster.length,
      formation: validation.formation,
    };
  }

  global.RoadToGlorySquadRuntime = Object.freeze({
    accessibleCardIds,
    accessiblePlayerIds,
    validateSquad,
    teamPower,
    recentDefeatedTeamIds,
    mainEligibility,
  });
})(globalThis);
