(function (global) {
  "use strict";
  const id = (value) => String(value ?? "");

  function byId(database, specialMatchId) {
    return (database?.specialMatches || []).find((match) => id(match.specialMatchId) === id(specialMatchId)) || null;
  }
  function forNode(database, node) {
    return node?.type === "special_match" ? byId(database, node.specialMatchId) : null;
  }
  function teamPlayers(database, specialMatch, progression = global.InazumaProgression, profiles = global.ProfiledSeasonRuntime) {
    if (!specialMatch) throw new Error("Partita speciale non configurata");
    const slots = specialMatch.startingXI?.length
      ? specialMatch.startingXI
      : (specialMatch.startingXIProfileIds || []).map((profileId, index) => ({ profileId, playerId: specialMatch.startingXIPlayerIds?.[index] }));
    const players = slots.slice(0, 11).map((slot) => {
      const profile = profiles?.resolveProfile?.("ie1_s2", slot.profileId);
      if (!profile) throw new Error(`Profilo avversario mancante: ${slot.profileId}`);
      const variant = (profile.roleVariants || []).find((item) => id(item.roleVariantId || item.variantId) === id(profile.defaultRoleVariantId));
      const base = { ...(database.players || []).find((player) => id(player.playerId) === id(profile.playerId)), ...profile, ...(variant || {}), playerId: id(profile.playerId), profileId: id(profile.profileId), roleVariantId: id(variant?.roleVariantId || variant?.variantId || profile.defaultRoleVariantId) || null };
      const level = Math.floor(Number(specialMatch.matchLevel ?? slot.level ?? 0));
      return { ...progression.getPlayerAtLevel(base, level, database), playerId: id(profile.playerId), profileId: id(profile.profileId), roleVariantId: base.roleVariantId, displayLevel: level, level };
    });
    if (players.length !== 11 || new Set(players.map((player) => player.profileId)).size !== 11) throw new Error(`Formazione speciale non valida: attesi 11 profili, trovati ${players.length}`);
    return players;
  }
  function fromNode(run, database, node, previousNodeId) {
    const special = forNode(database, node);
    if (!special) throw new Error(`Partita speciale sconosciuta: ${node?.specialMatchId || node?.id}`);
    teamPlayers(database, special);
    const attemptNumber = Math.max(1, Number(run.specialMatchAttempts?.[special.specialMatchId] || 0) + 1);
    run.specialMatchAttempts = run.specialMatchAttempts || {};
    run.specialMatchAttempts[special.specialMatchId] = attemptNumber;
    const match = { type: "special_match", nodeId: node.id, previousNodeId: previousNodeId || run.currentZone?.currentNodeId || run.currentZone?.startNodeId || null, specialMatchId: special.specialMatchId, teamId: special.teamId, matchLevel: special.matchLevel, matchFormation: special.matchFormation, attemptNumber, state: "pre-match", log: [] };
    match.matchId = [run.runId, node.id, "special_match", attemptNumber].join("::");
    return match;
  }
  function eligibleProfile(run, profileId, profiles = global.ProfiledSeasonRuntime) {
    const profile = profiles.resolveProfile(run.seasonId, profileId);
    if (!profile) return false;
    const owned = run.roster?.find((entry) => id(entry.playerId) === id(profile.playerId));
    return !owned || profiles.compareProfileProgression(run.seasonId, owned.activeProfileId, profile.profileId) === 1;
  }
  function rewardProfileId(run, special, profiles = global.ProfiledSeasonRuntime) {
    const guaranteed = special.reward?.guaranteedProfileId;
    if (eligibleProfile(run, guaranteed, profiles)) return { profileId: guaranteed, fallback: false, reason: "guaranteed" };
    const fallback = (special.reward?.teamPullPoolProfileIds || []).find((profileId) => eligibleProfile(run, profileId, profiles));
    return fallback ? { profileId: fallback, fallback: true, reason: "guaranteed_ineligible" } : { profileId: null, fallback: true, reason: "no_eligible_profile" };
  }
  function complete(run, database, match, result) {
    const special = byId(database, match.specialMatchId);
    if (!special) throw new Error("Impossibile completare una partita speciale non configurata");
    if (result !== "victory") return { status: "defeat" };
    const actionId = `${run.runId}:${special.specialMatchId}:victory`;
    const first = !run.completedSpecialMatchIds.includes(id(special.specialMatchId));
    global.ProfiledSeasonRuntime.addLevelUnits(run, 6, actionId);
    if (!run.completedSpecialMatchIds.includes(id(special.specialMatchId))) run.completedSpecialMatchIds.push(id(special.specialMatchId));
    if (!run.unlockedSpecialTeamIds.includes(id(special.teamId))) run.unlockedSpecialTeamIds.push(id(special.teamId));
    if (!run.unlockedTeamIds.includes(id(special.teamId))) run.unlockedTeamIds.push(id(special.teamId));
    if (!run.claimedSpecialMatchRewardIds.includes(id(special.specialMatchId))) {
      const selected = rewardProfileId(run, special);
      run.pendingSpecialMatchReward = { specialMatchId: id(special.specialMatchId), nodeId: match.nodeId, teamId: id(special.teamId), guaranteedProfileId: special.reward?.guaranteedProfileId || null, selectedProfileId: selected.profileId, fallback: selected.fallback, reason: selected.reason, status: "pending", actionId: `${run.runId}:${special.specialMatchId}:reward` };
    }
    return { status: first ? "completed" : "already-completed", pendingReward: run.pendingSpecialMatchReward };
  }
  function claim(run, pending = run.pendingSpecialMatchReward, options = {}) {
    if (!pending || pending.status === "claimed" || run.claimedSpecialMatchRewardIds.includes(id(pending.specialMatchId))) return { status: "already-claimed" };
    if (!pending.selectedProfileId) {
      pending.status = "claimed-no-eligible-profile"; run.claimedSpecialMatchRewardIds.push(id(pending.specialMatchId)); run.pendingSpecialMatchReward = null;
      return { status: "no-eligible-profile", reason: pending.reason };
    }
    const profile = global.ProfiledSeasonRuntime.resolveProfile(run.seasonId, pending.selectedProfileId);
    const result = global.ProfiledSeasonRuntime.acquireOrUpgradeProfile(run, profile, { seasonId: run.seasonId, maxRoster: options.maxRoster || 15, level: options.level || 0 });
    if (result.status === "acquired") run.bench.push(id(result.player.playerId));
    if (result.status === "roster-full") return result;
    if (!["acquired", "upgraded"].includes(result.status)) return result;
    pending.status = "claimed";
    if (!run.claimedSpecialMatchRewardIds.includes(id(pending.specialMatchId))) run.claimedSpecialMatchRewardIds.push(id(pending.specialMatchId));
    run.pendingSpecialMatchReward = null;
    return result;
  }
  global.SpecialMatchRuntime = { byId, forNode, teamPlayers, fromNode, eligibleProfile, rewardProfileId, complete, claim };
})(globalThis);
