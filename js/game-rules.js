(function (global) {
  "use strict";

  function isProfileAwareRosterEntry(entry, run) {
    return (["ie1_s2", "ie1_s3"].includes(String(run?.seasonId)) || global.SeasonRegistry?.database?.(run?.seasonId)?.requiresProfileAwareRuntime === true)
      && entry?.source !== "free_agents"
      && typeof entry?.activeProfileId === "string"
      && entry.activeProfileId.length > 0;
  }

  function resolveRosterEntryBase(entry, run, resolvers = {}) {
    return isProfileAwareRosterEntry(entry, run)
      ? resolvers.profile?.(entry)
      : resolvers.legacy?.(entry);
  }

  function unlockedPullLevel(seasonDatabase, currentBossIndex) {
    if (currentBossIndex <= 0) return 0;
    return Number(seasonDatabase.bossOrder[currentBossIndex - 1]?.bossLevel || 0);
  }

  function defeatedBossRewardLevel(boss) {
    return Number(boss?.bossLevel || 0);
  }

  function migrateDefeatedBossPlayerLevels(run, seasonDatabase) {
    if (!run || !Array.isArray(run.roster)) return 0;
    const completed = new Set((run.completedBossIds || []).map(String));
    const defeatedBosses = (seasonDatabase.bossOrder || []).filter((boss) =>
      completed.has(String(boss.teamId))
    );
    const teamsById = new Map(
      (seasonDatabase.teams || []).map((team) => [String(team.teamId), team])
    );
    let changed = 0;

    run.roster.forEach((entry) => {
      if (entry.source !== "season1") return;
      const playerId = String(entry.playerId);
      const minimumLevel = defeatedBosses.reduce((highest, boss) => {
        const team = teamsById.get(String(boss.teamId));
        if (!team?.playerIds?.map(String).includes(playerId)) return highest;
        return Math.max(highest, defeatedBossRewardLevel(boss));
      }, 0);
      if (Number(entry.level || 0) < minimumLevel) {
        entry.level = minimumLevel;
        changed += 1;
      }
    });
    return changed;
  }

  function unlockedTeamPullCategoryWeights(currentBossIndex) {
    const stage = Number(currentBossIndex || 0) + 1;
    const base = {
      Scarso: 1,
      Debole: 1,
      Normale: 1,
      Buono: 1,
      Forte: 1,
      Elite: 1,
      Mondiale: 1,
      Leggenda: 1,
    };
    if (stage <= 3) return base;
    if (stage <= 5) return { ...base, Buono: 1.05, Forte: 1.12, Elite: 1.08 };
    if (stage <= 7) return { ...base, Buono: 1.04, Forte: 1.25, Elite: 1.12 };
    return { ...base, Buono: 1.04, Forte: 1.35, Elite: 1.2, Mondiale: 1.05 };
  }

  function resolveDevelopmentEffectiveMetadata(player, developmentSnapshot = {}) {
    if (!player) return null;
    const upgrade = developmentSnapshot?.[String(player.playerId)];
    const target = Number(upgrade?.permanentTargetPotential);
    return {
      ...player,
      finalOverall: Number.isFinite(target) ? Math.max(Number(player.finalOverall || 0), target) : Number(player.finalOverall || 0),
      category: upgrade?.currentPermanentRarity || player.category,
    };
  }

  function isLegendaryEffectivePlayer(player, legendaryCategories, developmentSnapshot = {}) {
    const effective = resolveDevelopmentEffectiveMetadata(player, developmentSnapshot);
    return !!effective && (legendaryCategories || []).includes(effective.category);
  }

  function getTradeCandidates({ outgoingPlayer, rosterIds, freeAgents, seasonPlayers, unlockedTeamIds, teams, resolveCandidate = (player) => player }) {
    if (!outgoingPlayer) return [];
    const owned = new Set((rosterIds || []).map(String));
    const unlocked = new Set((unlockedTeamIds || []).map(String));
    const unlockedPlayerIds = new Set(
      (teams || [])
        .filter((team) => unlocked.has(String(team.teamId)))
        .flatMap((team) => (team.playerIds || []).map(String))
    );
    const combined = [
      ...(freeAgents || []).map((player) => ({ player, source: "free_agents" })),
      ...(seasonPlayers || [])
        .filter((player) => unlockedPlayerIds.has(String(player.playerId)))
        .map((player) => ({ player, source: "season1" })),
    ];
    const unique = new Map();
    combined.forEach((candidate) => {
      const id = String(candidate.player.playerId);
      const effective = resolveCandidate(candidate.player, candidate.source) || candidate.player;
      if (owned.has(id)) return;
      if (effective.position !== outgoingPlayer.position) return;
      if (Number(effective.finalOverall) < Number(outgoingPlayer.finalOverall)) return;
      if (!unique.has(id)) unique.set(id, candidate);
    });
    return [...unique.values()];
  }

  function resolveTradeCandidateOutcome({ candidate, rosterEntries = [], outgoingPlayerId = null }) {
    const candidatePlayer = candidate?.player || candidate;
    const candidatePlayerId = String(candidate?.playerId || candidatePlayer?.playerId || "");
    if (!candidatePlayerId) return null;
    const owned = rosterEntries.find((entry) => String(entry.playerId) === candidatePlayerId);
    // Trade deliberately excludes every owned player, including a self-upgrade: every
    // accepted offer therefore replaces one roster slot with one different player.
    if (owned) return { eligible: false, reason: String(outgoingPlayerId) === candidatePlayerId ? "self-upgrade" : "already-owned" };
    const variantId = candidate?.activeRoleVariantId || candidate?.profile?.defaultRoleVariantId || null;
    const variant = (candidate?.profile?.roleVariants || []).find((item) => String(item.roleVariantId || item.variantId) === String(variantId));
    const outcome = { ...candidatePlayer, ...(variant || {}) };
    return {
      eligible: true,
      resultingRole: String(outcome.position || outcome.normalizedRole || outcome.role || "").toUpperCase(),
      resultingProfileId: candidate?.profileId || candidate?.profile?.profileId || null,
      resultingRoleVariantId: variantId,
      resultingBasePotential: Number(outcome.finalOverall || 0),
      player: outcome,
    };
  }

  // Trade consumes the fully resolved roster player. Potential is the
  // contract value; current overall is level-dependent presentation only.
  function tradeOutgoingEffectiveMetadata(resolvedPlayer) {
    if (!resolvedPlayer) return null;
    const finalOverall = Number(resolvedPlayer.potential);
    const position = String(resolvedPlayer.position || resolvedPlayer.normalizedRole || resolvedPlayer.role || "").toUpperCase();
    if (!String(resolvedPlayer.playerId || "") || !position || !Number.isFinite(finalOverall)) return null;
    return { playerId: String(resolvedPlayer.playerId), position, finalOverall };
  }

  function getProfileAwareTradeCandidates({ outgoingPlayer, outgoingPlayerId = null, rosterEntries, freeAgents, profiles, unlockedTeamIds, teams, seasonId = "ie1_s2", compareProfileProgression, resolveCandidate = (player) => player }) {
    if (!outgoingPlayer) return [];
    const role = String(outgoingPlayer.position || outgoingPlayer.role || "").toUpperCase();
    const potential = Number(outgoingPlayer.finalOverall || 0);
    const ownedByPlayerId = new Map((rosterEntries || []).map((entry) => [String(entry.playerId), entry]));
    const unlocked = new Set((unlockedTeamIds || []).map(String));
    const unlockedProfileIds = new Set((teams || [])
      .filter((team) => unlocked.has(String(team.teamId)))
      .flatMap((team) => [...(team.playerProfileIds || []), ...(team.teamPullPoolProfileIds || [])].map(String)));
    const candidates = [];
    (freeAgents || []).forEach((player) => {
      const candidate = { player, source: "free_agents", playerId: String(player.playerId), profileId: null, activeRoleVariantId: null, kind: "new" };
      const outcome = resolveTradeCandidateOutcome({ candidate, rosterEntries, outgoingPlayerId });
      const effective = resolveCandidate(player, candidate.source) || player;
      if (!outcome?.eligible || outcome.resultingRole !== role || Number(effective.finalOverall) < potential) return;
      candidates.push({ ...candidate, outcome, player: outcome.player });
    });
    (profiles || []).forEach((profile) => {
      if (!unlockedProfileIds.has(String(profile.profileId))) return;
      const defaultVariant = (profile.roleVariants || []).find((variant) => String(variant.roleVariantId || variant.variantId) === String(profile.defaultRoleVariantId));
      const player = { ...profile, ...(defaultVariant || {}), playerId: String(profile.playerId), profileId: String(profile.profileId) };
      const owned = ownedByPlayerId.get(String(profile.playerId));
      const candidate = { player, profile, source: seasonId, playerId: String(profile.playerId), profileId: String(profile.profileId), activeRoleVariantId: String(profile.defaultRoleVariantId || "") || null, kind: owned ? "upgrade" : "new", profileRank: Number(profile.profileRank || 0) };
      const outcome = resolveTradeCandidateOutcome({ candidate, rosterEntries, outgoingPlayerId });
      if (!outcome?.eligible || outcome.resultingRole !== role || outcome.resultingBasePotential < potential) return;
      candidates.push({ ...candidate, outcome, player: outcome.player });
    });
    const bestByPlayerId = new Map();
    candidates.forEach((candidate) => {
      const current = bestByPlayerId.get(candidate.playerId);
      if (!current || Number(candidate.profileRank || 0) > Number(current.profileRank || 0)) bestByPlayerId.set(candidate.playerId, candidate);
    });
    return [...bestByPlayerId.values()];
  }

  function executeProfileAwareTrade(run, outgoingId, incoming, options = {}) {
    const roster = run.roster || [];
    const outgoingIndex = roster.findIndex((entry) => String(entry.playerId) === String(outgoingId));
    if (outgoingIndex < 0) return { status: "missing-outgoing" };
    const outgoing = roster[outgoingIndex];
    const incomingId = String(incoming.playerId || incoming.player?.playerId);
    const outcome = resolveTradeCandidateOutcome({ candidate: incoming, rosterEntries: roster, outgoingPlayerId: outgoingId });
    if (!outcome?.eligible) return { status: "ineligible", reason: outcome?.reason || "invalid-candidate", player: null, recruited: false };
    if (options.resolveOutgoingBase) {
      const outgoingBase = options.resolveOutgoingBase(outgoing);
      const outgoingRole = String(outgoingBase?.position || outgoingBase?.role || "").toUpperCase();
      const outgoingPotential = Number(outgoingBase?.finalOverall);
      const incomingEffective = options.resolveIncomingCandidate?.(incoming.player, incoming.source) || outcome.player;
      const incomingPotential = Number(incomingEffective?.finalOverall || 0);
      if (!outgoingRole || !Number.isFinite(outgoingPotential)
        || outcome.resultingRole !== outgoingRole
        || incomingPotential < outgoingPotential) {
        return { status: "ineligible", reason: "trade-conditions-changed", player: null, recruited: false };
      }
    }
    const existingIndex = roster.findIndex((entry) => String(entry.playerId) === incomingId);
    const nextLevel = Math.min(20, Number(outgoing.level || 0) + 1);
    if (existingIndex === outgoingIndex) {
      const nextRoleVariantId = options.roleVariantForUpgrade?.(outgoing, incoming.profile) || incoming.activeRoleVariantId || outgoing.activeRoleVariantId;
      outgoing.activeProfileId = incoming.profileId;
      outgoing.activeRoleVariantId = nextRoleVariantId;
      outgoing.level = nextLevel;
      return { status: "upgraded-self", player: outgoing, recruited: false };
    }
    if (existingIndex >= 0) {
      const existing = roster[existingIndex];
      const nextRoleVariantId = options.roleVariantForUpgrade?.(existing, incoming.profile) || incoming.activeRoleVariantId || existing.activeRoleVariantId;
      existing.activeProfileId = incoming.profileId;
      existing.activeRoleVariantId = nextRoleVariantId;
      if (outgoing.equippedItem) (run.inventory || (run.inventory = [])).push(outgoing.equippedItem);
      roster.splice(outgoingIndex, 1);
      run.lineup = (run.lineup || []).filter((id) => String(id) !== String(outgoingId));
      run.bench = (run.bench || []).filter((id) => String(id) !== String(outgoingId));
      return { status: "upgraded", player: existing, recruited: false };
    }
    if (outgoing.equippedItem) (run.inventory || (run.inventory = [])).push(outgoing.equippedItem);
    const replacement = incoming.profileId
      ? { playerId: incomingId, source: incoming.source, activeProfileId: incoming.profileId, activeRoleVariantId: incoming.activeRoleVariantId, level: nextLevel, levelUnits: 0, equippedItem: null, potentialBoost: 0, currentOverallBoost: 0, potentialBoostApplications: [], recruitedAtLevel: nextLevel, recruitmentSource: "trade" }
      : { playerId: incomingId, source: incoming.source, level: nextLevel, levelUnits: 0, equippedItem: null, potentialBoost: 0, currentOverallBoost: 0, potentialBoostApplications: [], recruitedAtLevel: nextLevel, recruitmentSource: "trade" };
    roster[outgoingIndex] = replacement;
    run.lineup = (run.lineup || []).map((id) => String(id) === String(outgoingId) ? incomingId : String(id));
    run.bench = (run.bench || []).map((id) => String(id) === String(outgoingId) ? incomingId : String(id));
    return { status: "acquired", player: replacement, recruited: true };
  }

  function applyEquipment(stats, equipment) {
    const result = { ...stats };
    if (equipment?.stat && Number.isFinite(Number(equipment.bonus))) {
      result[equipment.stat] = Number(result[equipment.stat] || 0) + Number(equipment.bonus);
    }
    return result;
  }

  global.RoguelikeRules = {
    isProfileAwareRosterEntry,
    resolveRosterEntryBase,
    unlockedPullLevel,
    unlockedTeamPullCategoryWeights,
    defeatedBossRewardLevel,
    migrateDefeatedBossPlayerLevels,
    getTradeCandidates,
    resolveDevelopmentEffectiveMetadata,
    isLegendaryEffectivePlayer,
    resolveTradeCandidateOutcome,
    tradeOutgoingEffectiveMetadata,
    getProfileAwareTradeCandidates,
    executeProfileAwareTrade,
    applyEquipment,
  };
})(globalThis);
