(function (global) {
  "use strict";

  const databases = new Map();
  const indexes = new Map();
  const id = (value) => String(value ?? "");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const VISUAL_FIELDS = ["portraitUrl", "frontFullbodyUrl", "fullbodyUrl", "cardImageUrl", "imageUrl", "logoUrl"];
  const nonEmpty = (value) => value !== null && value !== undefined && (typeof value !== "string" || value.trim() !== "");

  function register(seasonId, database) {
    databases.set(id(seasonId), database);
    indexes.set(id(seasonId), {
      players: new Map((database.players || []).map((player) => [id(player.playerId), player])),
      profiles: new Map((database.profiles || []).map((profile) => [id(profile.profileId), profile])),
      paths: new Map((database.profileUpgradePaths || []).map((path) => [id(path.playerId), path])),
    });
    return database;
  }

  function databaseFor(seasonId) { return databases.get(id(seasonId)) || global.SeasonRegistry?.database?.(seasonId) || null; }
  function indexFor(seasonId) {
    if (!indexes.has(id(seasonId)) && databaseFor(seasonId)) register(seasonId, databaseFor(seasonId));
    return indexes.get(id(seasonId)) || null;
  }
  function resolveCanonicalPlayer(seasonId, playerId) { return indexFor(seasonId)?.players.get(id(playerId)) || null; }
  function resolveProfile(seasonId, profileId) { return indexFor(seasonId)?.profiles.get(id(profileId)) || null; }
  function implicitProfile(seasonId, playerId) {
    const player = resolveCanonicalPlayer(seasonId, playerId) || global.SeasonRegistry?.player?.(playerId, seasonId);
    return player ? { ...player, profileId: id(player.playerId), playerId: id(player.playerId), defaultRoleVariantId: id(player.position || player.normalizedRole).toLowerCase(), roleVariants: [] } : null;
  }
  function ownedProfile(runPlayer, seasonId) {
    return resolveProfile(seasonId, runPlayer?.activeProfileId) || implicitProfile(seasonId, runPlayer?.playerId);
  }
  function activeVariant(runPlayer, profile) {
    const variants = profile?.roleVariants || [];
    return variants.find((variant) => id(variant.roleVariantId || variant.variantId) === id(runPlayer?.activeRoleVariantId))
      || variants.find((variant) => id(variant.roleVariantId || variant.variantId) === id(profile?.defaultRoleVariantId))
      || null;
  }
  function effectiveBase(runPlayer, seasonId) {
    const canonical = resolveCanonicalPlayer(seasonId, runPlayer.playerId) || {};
    const profile = ownedProfile(runPlayer, seasonId) || canonical;
    const variant = activeVariant(runPlayer, profile);
    const effective = { ...canonical, ...profile, ...(variant || {}), playerId: id(runPlayer.playerId), profileId: profile.profileId, roleVariantId: variant?.roleVariantId || variant?.variantId || profile.defaultRoleVariantId || null };
    VISUAL_FIELDS.forEach((field) => {
      effective[field] = [variant?.[field], profile?.[field], canonical?.[field]].find(nonEmpty) ?? null;
    });
    return effective;
  }
  function resolveEffectivePlayerAtLevel(runPlayer, context = {}) {
    const seasonId = context.seasonId || context.run?.seasonId || "ie1";
    const base = effectiveBase(runPlayer, seasonId);
    const database = context.database || databaseFor(seasonId);
    return global.InazumaProgression?.getPlayerAtLevel
      ? global.InazumaProgression.getPlayerAtLevel(base, Math.floor(Number(runPlayer.level || 0)), database, runPlayer)
      : base;
  }
  function compareProfileProgression(seasonId, currentProfileId, candidateProfileId) {
    if (id(currentProfileId) === id(candidateProfileId)) return 0;
    const current = resolveProfile(seasonId, currentProfileId);
    const candidate = resolveProfile(seasonId, candidateProfileId);
    if (!candidate) return -1;
    if (!current) return 1;
    if (id(current.playerId) !== id(candidate.playerId)) return null;
    const path = indexFor(seasonId)?.paths.get(id(candidate.playerId));
    const forward = path?.steps?.some((step) => id(step.fromProfileId) === id(currentProfileId) && id(step.toProfileId) === id(candidateProfileId));
    const backward = path?.steps?.some((step) => id(step.toProfileId) === id(currentProfileId) && id(step.fromProfileId) === id(candidateProfileId));
    if (forward) return 1;
    if (backward) return -1;
    return Math.sign(Number(candidate.profileRank || 0) - Number(current.profileRank || 0));
  }
  function roleIdForUpgrade(entry, nextProfile, seasonId) {
    const current = activeVariant(entry, ownedProfile(entry, seasonId));
    const currentRole = id(current?.position || current?.normalizedRole).toUpperCase();
    const preserved = (nextProfile.roleVariants || []).find((variant) => id(variant.position || variant.normalizedRole).toUpperCase() === currentRole);
    return id(preserved?.roleVariantId || preserved?.variantId || nextProfile.defaultRoleVariantId);
  }
  function acquireOrUpgradeProfile(run, candidate, options = {}) {
    const seasonId = options.seasonId || run.seasonId;
    const profile = resolveProfile(seasonId, candidate.profileId || candidate.activeProfileId);
    if (!profile) throw new Error(`Profilo non trovato: ${candidate.profileId || candidate.activeProfileId}`);
    const existing = (run.roster || []).find((entry) => id(entry.playerId) === id(profile.playerId));
    if (existing) {
      if (compareProfileProgression(seasonId, existing.activeProfileId, profile.profileId) !== 1) return { status: "ineligible", player: existing };
      existing.activeRoleVariantId = roleIdForUpgrade(existing, profile, seasonId);
      existing.activeProfileId = profile.profileId;
      return { status: "upgraded", player: existing, profile };
    }
    if ((run.roster || []).length >= Number(options.maxRoster || 15)) return { status: "roster-full", profile };
    const entry = { playerId: id(profile.playerId), source: seasonId, activeProfileId: profile.profileId, activeRoleVariantId: id(profile.defaultRoleVariantId), level: Math.max(0, Math.floor(Number(options.level || 0))), levelUnits: 0, equippedItem: null, potentialBoost: 0, currentOverallBoost: 0, potentialBoostApplications: [] };
    run.roster.push(entry);
    return { status: "acquired", player: entry, profile };
  }
  function addLevelUnits(run, units, actionId = null) {
    if (!databaseFor(run.seasonId)?.requiresProfileAwareRuntime) return false;
    run.processedLevelUnitActionIds = run.processedLevelUnitActionIds || [];
    if (actionId && run.processedLevelUnitActionIds.includes(id(actionId))) return false;
    const apply = (target, levelKey, unitKey) => {
      let level = Math.min(20, Math.max(0, Math.floor(Number(target[levelKey] || 0))));
      let remainder = level >= 20 ? 0 : Math.max(0, Math.floor(Number(target[unitKey] || 0))) + Math.max(0, Math.floor(Number(units || 0)));
      level = Math.min(20, level + Math.floor(remainder / 6));
      remainder = level >= 20 ? 0 : remainder % 6;
      target[levelKey] = level; target[unitKey] = remainder;
    };
    apply(run, "teamLevel", "teamLevelUnits");
    (run.roster || []).forEach((entry) => apply(entry, "level", "levelUnits"));
    if (actionId) run.processedLevelUnitActionIds.push(id(actionId));
    return true;
  }
  function canSwitchRole(run, playerId) {
    const entry = run.roster?.find((player) => id(player.playerId) === id(playerId));
    const profile = entry && ownedProfile(entry, run.seasonId);
    return Boolean(entry && run.bench?.map(id).includes(id(playerId)) && profile?.roleSwitchEnabled && profile.roleVariants?.length === 2);
  }
  function switchBenchRole(run, playerId, roleVariantId) {
    if (!canSwitchRole(run, playerId)) throw new Error("SPOSTA IL GIOCATORE IN PANCHINA PER CAMBIARE RUOLO");
    const entry = run.roster.find((player) => id(player.playerId) === id(playerId));
    const profile = ownedProfile(entry, run.seasonId);
    const variant = profile.roleVariants.find((item) => id(item.roleVariantId || item.variantId) === id(roleVariantId));
    if (!variant) throw new Error("Variante ruolo non valida");
    entry.activeRoleVariantId = id(variant.roleVariantId || variant.variantId);
    return entry;
  }
  function normalizeRun(run) {
    run.teamLevelUnits = Math.max(0, Math.min(5, Math.floor(Number(run.teamLevelUnits || 0))));
    for (const key of ["completedSpecialMatchIds", "claimedSpecialMatchRewardIds", "unlockedSpecialTeamIds", "processedLevelUnitActionIds"]) run[key] = Array.isArray(run[key]) ? Array.from(new Set(run[key].map(id))) : [];
    run.pendingSpecialMatchReward = run.pendingSpecialMatchReward || null;
    if (run.pendingSpecialMatchReward) {
      const pending = run.pendingSpecialMatchReward;
      pending.totalRewards = Math.max(1, Number(pending.totalRewards || 1));
      pending.currentReward = Math.max(1, Math.min(pending.totalRewards, Number(pending.currentReward || 1)));
      pending.excludedPlayerIds = Array.isArray(pending.excludedPlayerIds) ? Array.from(new Set(pending.excludedPlayerIds.map(id))) : [];
      pending.replacementPendingProfileId = pending.replacementPendingProfileId || null;
    }
    run.roster = (run.roster || []).filter((entry, index, all) => all.findIndex((item) => id(item.playerId) === id(entry.playerId)) === index).map((entry) => {
      const canonical = resolveCanonicalPlayer(run.seasonId, entry.playerId);
      const profileId = entry.activeProfileId || canonical?.baseProfileId;
      const profile = resolveProfile(run.seasonId, profileId);
      return { ...entry, activeProfileId: profileId || null, activeRoleVariantId: entry.activeRoleVariantId || profile?.defaultRoleVariantId || null, level: Math.min(20, Math.max(0, Math.floor(Number(entry.level || 0)))), levelUnits: Math.max(0, Math.min(5, Math.floor(Number(entry.levelUnits || 0)))) };
    });
    return run;
  }

  global.ProfiledSeasonRuntime = { register, resolveCanonicalPlayer, resolveProfile, resolveOwnedPlayerProfile: ownedProfile, resolveActiveRoleVariant: activeVariant, resolveEffectiveBase: effectiveBase, resolveEffectivePlayerAtLevel, compareProfileProgression, acquireOrUpgradeProfile, addLevelUnits, canSwitchRole, switchBenchRole, normalizeRun };
})(globalThis);
