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
      const profile = profiles?.resolveProfile?.(database.seasonId, slot.profileId);
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
  function isIe3SecondaryTeamReward(database, special) {
    return id(database?.seasonId) === "ie1_s3"
      && special?.reward?.rewardFlow === "choose_one_of_three_from_defeated_secondary_team";
  }
  function rewardProfileIds(run, special, profiles = global.ProfiledSeasonRuntime, options = {}) {
    const count = Math.max(1, Number(special.reward?.candidateCount || 1));
    if (!special.reward?.guaranteedProfileId) {
      const rewardNumber = Math.max(1, Number(options.rewardNumber || 1));
      const seed = `${run.runId}:${special.specialMatchId}:reward${options.indexedSeed ? `:${rewardNumber}` : ""}`;
      const random = global.DraftEngine?.randomFromSeed?.(seed) || Math.random;
      const excludedPlayerIds = new Set((options.excludedPlayerIds || []).map(id));
      const seenPlayerIds = new Set();
      const available = (special.reward?.teamPullPoolProfileIds || []).filter((profileId) => {
        const profile = profiles.resolveProfile(run.seasonId, profileId);
        const playerId = id(profile?.playerId);
        if (!profile || !eligibleProfile(run, profileId, profiles) || excludedPlayerIds.has(playerId) || seenPlayerIds.has(playerId)) return false;
        seenPlayerIds.add(playerId);
        return true;
      });
      return (global.DraftEngine?.shuffle?.(available, random) || available).slice(0, count);
    }
    const guaranteed = special.reward?.guaranteedProfileId;
    if (eligibleProfile(run, guaranteed, profiles)) return [guaranteed];
    const fallback = (special.reward?.teamPullPoolProfileIds || []).find((profileId) => eligibleProfile(run, profileId, profiles));
    return fallback ? [fallback] : [];
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
      if (id(run.pendingSpecialMatchReward?.specialMatchId) === id(special.specialMatchId)) {
        return { status: first ? "completed" : "already-completed", pendingReward: run.pendingSpecialMatchReward };
      }
      const totalRewards = isIe3SecondaryTeamReward(database, special) ? 2 : 1;
      const indexedSeed = totalRewards > 1;
      const candidateProfileIds = rewardProfileIds(run, special, global.ProfiledSeasonRuntime, { rewardNumber: 1, indexedSeed });
      run.pendingSpecialMatchReward = { specialMatchId: id(special.specialMatchId), nodeId: match.nodeId, teamId: id(special.teamId), guaranteedProfileId: special.reward?.guaranteedProfileId || null, totalRewards, currentReward: 1, indexedSeed, candidateProfileIds, selectedProfileId: candidateProfileIds.length === 1 ? candidateProfileIds[0] : null, excludedPlayerIds: [], replacementPendingProfileId: null, status: "pending", actionId: `${run.runId}:${special.specialMatchId}:reward${indexedSeed ? ":1" : ""}` };
    }
    return { status: first ? "completed" : "already-completed", pendingReward: run.pendingSpecialMatchReward };
  }
  function completeCurrentReward(run, database, pending = run.pendingSpecialMatchReward) {
    if (!pending || pending !== run.pendingSpecialMatchReward || pending.status !== "pending") return { status: "already-resolved" };
    const selectedProfile = pending.selectedProfileId && global.ProfiledSeasonRuntime.resolveProfile(run.seasonId, pending.selectedProfileId);
    if (selectedProfile) pending.excludedPlayerIds = Array.from(new Set([...(pending.excludedPlayerIds || []).map(id), id(selectedProfile.playerId)]));
    pending.replacementPendingProfileId = null;
    const currentReward = Math.max(1, Number(pending.currentReward || 1));
    const totalRewards = Math.max(1, Number(pending.totalRewards || 1));
    if (currentReward < totalRewards) {
      const special = byId(database, pending.specialMatchId);
      if (!special) throw new Error("Ricompensa speciale non configurata");
      pending.currentReward = currentReward + 1;
      pending.candidateProfileIds = rewardProfileIds(run, special, global.ProfiledSeasonRuntime, { rewardNumber: pending.currentReward, excludedPlayerIds: pending.excludedPlayerIds, indexedSeed: pending.indexedSeed });
      pending.selectedProfileId = pending.candidateProfileIds.length === 1 ? pending.candidateProfileIds[0] : null;
      pending.actionId = `${run.runId}:${special.specialMatchId}:reward:${pending.currentReward}`;
      return { status: "next-reward", pendingReward: pending };
    }
    pending.status = "resolved";
    run.claimedSpecialMatchRewardIds = Array.isArray(run.claimedSpecialMatchRewardIds) ? run.claimedSpecialMatchRewardIds : [];
    if (!run.claimedSpecialMatchRewardIds.includes(id(pending.specialMatchId))) run.claimedSpecialMatchRewardIds.push(id(pending.specialMatchId));
    run.pendingSpecialMatchReward = null;
    return { status: "completed", specialMatchId: id(pending.specialMatchId) };
  }
  function claim(run, pending = run.pendingSpecialMatchReward, options = {}) {
    if (!pending || pending.status === "claimed" || run.claimedSpecialMatchRewardIds.includes(id(pending.specialMatchId))) return { status: "already-claimed" };
    if (!pending.selectedProfileId) {
      const transition = completeCurrentReward(run, options.database, pending);
      return { status: "no-eligible-profile", reason: pending.reason, transition };
    }
    const profile = global.ProfiledSeasonRuntime.resolveProfile(run.seasonId, pending.selectedProfileId);
    const result = global.ProfiledSeasonRuntime.acquireOrUpgradeProfile(run, profile, { seasonId: run.seasonId, maxRoster: options.maxRoster || 15, level: options.level || 0 });
    if (result.status === "acquired") run.bench.push(id(result.player.playerId));
    if (result.status === "roster-full") return result;
    if (!["acquired", "upgraded"].includes(result.status)) return result;
    result.transition = completeCurrentReward(run, options.database, pending);
    return result;
  }
  function selectRewardCandidate(run, profileId, pending = run.pendingSpecialMatchReward) {
    if (!pending || !pending.candidateProfileIds?.map(id).includes(id(profileId))) throw new Error("Candidato ricompensa non valido");
    if (!eligibleProfile(run, profileId)) throw new Error("Profilo ricompensa non più eleggibile");
    pending.selectedProfileId = id(profileId);
    pending.replacementPendingProfileId = id(profileId);
    return pending;
  }
  function decline(run, pending = run.pendingSpecialMatchReward, database) {
    if (!pending) return { status: "no-pending-reward" };
    pending.selectedProfileId = null;
    pending.replacementPendingProfileId = null;
    const transition = completeCurrentReward(run, database, pending);
    return { status: transition.status === "already-resolved" ? "already-resolved" : "declined", specialMatchId: id(pending.specialMatchId), selectedProfileId: null, transition };
  }
  global.SpecialMatchRuntime = { byId, forNode, teamPlayers, fromNode, eligibleProfile, isIe3SecondaryTeamReward, rewardProfileIds, selectRewardCandidate, completeCurrentReward, complete, claim, decline };
})(globalThis);
