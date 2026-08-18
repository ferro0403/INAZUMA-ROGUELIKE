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
  function playerIdForProfile(run, profileId, profiles = global.ProfiledSeasonRuntime) {
    const profile = profiles?.resolveProfile?.(run.seasonId, profileId);
    if (profile?.playerId != null) return id(profile.playerId);
    const raw = id(profileId);
    return raw.includes("@") ? raw.split("@")[0] : "";
  }
  function uniqueEligiblePool(run, profileIds, profiles, excludedProfileIds = [], excludedPlayerIds = []) {
    const excludedProfiles = new Set((excludedProfileIds || []).map(id));
    const excludedPlayers = new Set((excludedPlayerIds || []).map(id));
    const seenPlayers = new Set();
    const result = [];
    for (const rawProfileId of profileIds || []) {
      const profileId = id(rawProfileId);
      if (!profileId || excludedProfiles.has(profileId) || !eligibleProfile(run, profileId, profiles)) continue;
      const playerId = playerIdForProfile(run, profileId, profiles);
      if (playerId && (excludedPlayers.has(playerId) || seenPlayers.has(playerId))) continue;
      if (playerId) seenPlayers.add(playerId);
      result.push(profileId);
    }
    return result;
  }
  function rewardProfileIds(run, special, profiles = global.ProfiledSeasonRuntime, rewardNumber = 1, excludedProfileIds = [], excludedPlayerIds = []) {
    const count = Math.max(1, Number(special?.reward?.candidateCount || 1));
    const pool = special?.reward?.teamPullPoolProfileIds || [];
    const available = uniqueEligiblePool(run, pool, profiles, excludedProfileIds, excludedPlayerIds);
    if (!special?.reward?.guaranteedProfileId) {
      const seed = `${run.runId}:${special.specialMatchId}:reward:${Math.max(1, Number(rewardNumber || 1))}`;
      const random = global.DraftEngine?.randomFromSeed?.(seed) || Math.random;
      return (global.DraftEngine?.shuffle?.(available, random) || available).slice(0, count);
    }
    const guaranteed = id(special.reward.guaranteedProfileId);
    if (available.includes(guaranteed)) return [guaranteed];
    return available.length ? [available[0]] : [];
  }
  function totalRewardsFor(run) { return id(run?.seasonId) === "ie1_s3" ? 2 : 1; }

  function ensurePendingRewardCandidates(run, pending = run.pendingSpecialMatchReward) {
    if (!pending) return { changed: false, candidateProfileIds: [] };
    const database = global.SeasonRegistry?.database?.(run.seasonId);
    const special = byId(database, pending.specialMatchId);
    if (!special) return { changed: false, candidateProfileIds: pending.candidateProfileIds || [] };
    const currentReward = Math.max(1, Number(pending.currentReward || 1));
    const count = Math.max(1, Number(special.reward?.candidateCount || 1));
    const excludedProfiles = new Set((pending.excludedProfileIds || []).map(id));
    const excludedPlayers = new Set((pending.excludedPlayerIds || []).map(id));
    const current = Array.isArray(pending.candidateProfileIds) ? pending.candidateProfileIds.map(id) : [];
    const seenPlayers = new Set();
    let invalid = current.length !== Math.min(count, uniqueEligiblePool(run, special.reward?.teamPullPoolProfileIds || [], global.ProfiledSeasonRuntime, pending.excludedProfileIds, pending.excludedPlayerIds).length);
    for (const profileId of current) {
      const playerId = playerIdForProfile(run, profileId);
      if (excludedProfiles.has(profileId) || (playerId && excludedPlayers.has(playerId)) || (playerId && seenPlayers.has(playerId)) || !eligibleProfile(run, profileId)) {
        invalid = true;
        break;
      }
      if (playerId) seenPlayers.add(playerId);
    }
    if (!invalid) return { changed: false, candidateProfileIds: current };
    const repaired = rewardProfileIds(run, special, global.ProfiledSeasonRuntime, currentReward, pending.excludedProfileIds, pending.excludedPlayerIds);
    pending.candidateProfileIds = repaired;
    pending.selectedProfileId = repaired.includes(id(pending.selectedProfileId)) ? id(pending.selectedProfileId) : (repaired.length === 1 ? repaired[0] : null);
    pending.replacementPendingProfileId = pending.selectedProfileId && id(pending.replacementPendingProfileId) === id(pending.selectedProfileId) ? pending.replacementPendingProfileId : null;
    pending.actionId = `${run.runId}:${pending.specialMatchId}:reward:${currentReward}`;
    return { changed: true, candidateProfileIds: repaired };
  }

  function completeCurrentReward(run, pending = run.pendingSpecialMatchReward) {
    if (!pending) return { status: "no-pending-reward" };
    const totalRewards = Math.max(1, Number(pending.totalRewards || totalRewardsFor(run)));
    const currentReward = Math.max(1, Number(pending.currentReward || 1));
    const currentCandidateProfileIds = Array.isArray(pending.candidateProfileIds) ? pending.candidateProfileIds.map(id) : [];
    const currentCandidatePlayerIds = currentCandidateProfileIds.map((profileId) => playerIdForProfile(run, profileId)).filter(Boolean);
    pending.selectedProfileId = null;
    pending.replacementPendingProfileId = null;
    pending.excludedProfileIds = Array.from(new Set([...(pending.excludedProfileIds || []), ...currentCandidateProfileIds].map(id)));
    pending.excludedPlayerIds = Array.from(new Set([...(pending.excludedPlayerIds || []), ...currentCandidatePlayerIds].map(id)));
    pending.previousCandidateProfileIds = currentCandidateProfileIds;
    pending.previousCandidatePlayerIds = currentCandidatePlayerIds;
    if (currentReward < totalRewards) {
      const database = global.SeasonRegistry?.database?.(run.seasonId);
      const special = byId(database, pending.specialMatchId);
      pending.currentReward = currentReward + 1;
      pending.candidateProfileIds = rewardProfileIds(run, special, global.ProfiledSeasonRuntime, pending.currentReward, pending.excludedProfileIds, pending.excludedPlayerIds);
      pending.status = "pending";
      pending.actionId = `${run.runId}:${pending.specialMatchId}:reward:${pending.currentReward}`;
      ensurePendingRewardCandidates(run, pending);
      return { status: "next-reward", currentReward: pending.currentReward, totalRewards, candidateProfileIds: [...pending.candidateProfileIds] };
    }
    pending.status = "completed";
    const specialMatchId = id(pending.specialMatchId);
    run.claimedSpecialMatchRewardIds = Array.isArray(run.claimedSpecialMatchRewardIds) ? run.claimedSpecialMatchRewardIds : [];
    if (!run.claimedSpecialMatchRewardIds.includes(specialMatchId)) run.claimedSpecialMatchRewardIds.push(specialMatchId);
    run.pendingSpecialMatchReward = null;
    return { status: "completed", currentReward, totalRewards };
  }
  function complete(run, database, match, result) {
    const special = byId(database, match.specialMatchId);
    if (!special) throw new Error("Impossibile completare una partita speciale non configurata");
    if (result !== "victory") return { status: "defeat" };
    run.completedSpecialMatchIds = Array.isArray(run.completedSpecialMatchIds) ? run.completedSpecialMatchIds : [];
    run.claimedSpecialMatchRewardIds = Array.isArray(run.claimedSpecialMatchRewardIds) ? run.claimedSpecialMatchRewardIds : [];
    run.unlockedSpecialTeamIds = Array.isArray(run.unlockedSpecialTeamIds) ? run.unlockedSpecialTeamIds : [];
    run.unlockedTeamIds = Array.isArray(run.unlockedTeamIds) ? run.unlockedTeamIds : [];
    const actionId = `${run.runId}:${special.specialMatchId}:victory`;
    const first = !run.completedSpecialMatchIds.includes(id(special.specialMatchId));
    global.ProfiledSeasonRuntime.addLevelUnits(run, 6, actionId);
    if (!run.completedSpecialMatchIds.includes(id(special.specialMatchId))) run.completedSpecialMatchIds.push(id(special.specialMatchId));
    if (!run.unlockedSpecialTeamIds.includes(id(special.teamId))) run.unlockedSpecialTeamIds.push(id(special.teamId));
    if (!run.unlockedTeamIds.includes(id(special.teamId))) run.unlockedTeamIds.push(id(special.teamId));
    if (!run.claimedSpecialMatchRewardIds.includes(id(special.specialMatchId))) {
      const candidateProfileIds = rewardProfileIds(run, special, global.ProfiledSeasonRuntime, 1);
      const totalRewards = totalRewardsFor(run);
      run.pendingSpecialMatchReward = { specialMatchId: id(special.specialMatchId), nodeId: match.nodeId, teamId: id(special.teamId), guaranteedProfileId: special.reward?.guaranteedProfileId || null, totalRewards, currentReward: 1, excludedProfileIds: [], excludedPlayerIds: [], previousCandidateProfileIds: [], previousCandidatePlayerIds: [], candidateProfileIds, selectedProfileId: candidateProfileIds.length === 1 ? candidateProfileIds[0] : null, replacementPendingProfileId: null, status: "pending", actionId: `${run.runId}:${special.specialMatchId}:reward:1` };
    }
    return { status: first ? "completed" : "already-completed", pendingReward: run.pendingSpecialMatchReward };
  }
  function claim(run, pending = run.pendingSpecialMatchReward, options = {}) {
    if (!pending || pending.status === "claimed" || run.claimedSpecialMatchRewardIds.includes(id(pending.specialMatchId))) return { status: "already-claimed" };
    ensurePendingRewardCandidates(run, pending);
    if (!pending.selectedProfileId) {
      pending.status = "claimed-no-eligible-profile"; run.claimedSpecialMatchRewardIds.push(id(pending.specialMatchId)); run.pendingSpecialMatchReward = null;
      return { status: "no-eligible-profile", reason: pending.reason };
    }
    const profile = global.ProfiledSeasonRuntime.resolveProfile(run.seasonId, pending.selectedProfileId);
    const result = global.ProfiledSeasonRuntime.acquireOrUpgradeProfile(run, profile, { seasonId: run.seasonId, maxRoster: options.maxRoster || 15, level: options.level || 0 });
    if (result.status === "acquired") run.bench.push(id(result.player.playerId));
    if (result.status === "roster-full") return result;
    if (!["acquired", "upgraded"].includes(result.status)) return result;
    completeCurrentReward(run, pending);
    return result;
  }
  function selectRewardCandidate(run, profileId, pending = run.pendingSpecialMatchReward) {
    if (!pending) throw new Error("Ricompensa non disponibile");
    ensurePendingRewardCandidates(run, pending);
    if (!pending.candidateProfileIds?.map(id).includes(id(profileId))) throw new Error("Candidato ricompensa non valido");
    if (!eligibleProfile(run, profileId)) throw new Error("Profilo ricompensa non più eleggibile");
    pending.selectedProfileId = id(profileId);
    return pending;
  }
  function decline(run, pending = run.pendingSpecialMatchReward) {
    if (!pending) return { status: "no-pending-reward" };
    run.claimedSpecialMatchRewardIds = Array.isArray(run.claimedSpecialMatchRewardIds) ? run.claimedSpecialMatchRewardIds : [];
    const livePending = run.pendingSpecialMatchReward;
    if (!livePending) return { status: "already-resolved" };
    if (livePending !== pending) pending = livePending;
    const selectedProfileId = pending.selectedProfileId || null;
    const result = completeCurrentReward(run, pending);
    return { ...result, status: result.status === "next-reward" ? "next-reward" : "declined", specialMatchId: id(pending.specialMatchId), selectedProfileId };
  }
  global.SpecialMatchRuntime = { byId, forNode, teamPlayers, fromNode, eligibleProfile, playerIdForProfile, uniqueEligiblePool, rewardProfileIds, ensurePendingRewardCandidates, selectRewardCandidate, completeCurrentReward, complete, claim, decline };
})(globalThis);
