(function (global) {
  "use strict";

  const SNAPSHOT_SCHEMA_VERSION = 1;
  const databases = new Map();
  const validatedSnapshots = new WeakMap();
  const record = (value) => value && typeof value === "object" && !Array.isArray(value);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  class DevelopmentSnapshotError extends Error {
    constructor(code, details = []) {
      super(code);
      this.name = "DevelopmentSnapshotError";
      this.code = code;
      this.details = details;
    }
  }

  function registerDatabase(id, database) {
    if (!String(id || "") || !record(database) || !Array.isArray(database.players)) throw new TypeError("Development database id and players are required");
    databases.set(String(id), database);
    return database;
  }

  function progressionFingerprint(player) {
    const stats = global.DevelopmentV3.STAT_ORDER.map((key) => Number(player?.[key] ?? player?.stats?.[key] ?? player?.ratings?.[key]));
    return JSON.stringify([String(player?.playerId), Number(player?.finalOverall), Number(player?.maxLevel || 20), String(player?.position || player?.normalizedRole || ""), String(player?.progressionCode || ""), stats]);
  }

  function baseMatches(playerId) {
    const id = String(playerId || "");
    const matches = [];
    for (const [databaseId, database] of databases) for (const player of database.players) {
      if (String(player?.playerId) === id) matches.push({ databaseId, database, player });
    }
    return matches;
  }

  function resolveBasePlayer(playerId) {
    const matches = baseMatches(playerId);
    if (!matches.length) return null;
    if (new Set(matches.map(({ player }) => progressionFingerprint(player))).size !== 1) throw new DevelopmentSnapshotError("ambiguous-base-player", matches.map(({ databaseId }) => databaseId));
    return matches[0].player;
  }

  function conversionDatabase(playerIds) {
    const freeAgents = databases.get("free-agents");
    if (freeAgents && playerIds.every((id) => freeAgents.players.some((player) => String(player?.playerId) === id))) return freeAgents;
    for (const database of databases.values()) if (playerIds.every((id) => database.players.some((player) => String(player?.playerId) === id))) return database;
    return databases.values().next().value || null;
  }

  function validateSnapshot(snapshot) {
    if (record(snapshot) && validatedSnapshots.has(snapshot)) return validatedSnapshots.get(snapshot);
    const errors = [];
    if (!record(snapshot)) errors.push("snapshot:object-required");
    if (snapshot?.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) errors.push("schemaVersion:unsupported");
    if (snapshot?.profileFormatVersion !== global.DevelopmentV3?.PROFILE_FORMAT_VERSION) errors.push("profileFormatVersion:unsupported");
    if (!record(snapshot?.players)) errors.push("players:invalid");
    else for (const [playerId, entry] of Object.entries(snapshot.players)) {
      if (!playerId || !record(entry) || Object.keys(entry).some((key) => key !== "profile")) errors.push(`players.${playerId}:invalid`);
      const result = global.DevelopmentV3?.validateProfile?.(entry?.profile) || { valid: false, errors: ["validator-missing"] };
      if (!result.valid) errors.push(...result.errors.map((error) => `players.${playerId}.profile.${error}`));
    }
    const result = { valid: errors.length === 0, errors };
    if (record(snapshot)) validatedSnapshots.set(snapshot, result);
    return result;
  }

  function buildRunSnapshot(options = {}) {
    let canonical;
    try { canonical = options.v3State || (!options.v2State && global.DevelopmentAccountV3?.read?.(options.accountOptions)); }
    catch (error) { throw new DevelopmentSnapshotError("development-v3-account-unavailable", [{ code: error?.code || "development-v3-account-error", details: error?.details || error?.result?.blockers || [] }]); }
    if (record(canonical)) {
      const validation = global.DevelopmentV3.validate(canonical);
      if (!validation.valid) throw new DevelopmentSnapshotError("development-v3-snapshot-invalid", validation.errors);
      const players = {};
      for (const playerId of Object.keys(canonical.players).sort()) {
        const chain = canonical.players[playerId], profile = chain.steps.at(-1)?.profile || chain.legacyNormale?.profile;
        if (!profile) throw new DevelopmentSnapshotError("development-v3-active-profile-missing", [playerId]);
        players[playerId] = { profile: clone(profile) };
      }
      const developmentV3PlayerSnapshot = { schemaVersion: SNAPSHOT_SCHEMA_VERSION, profileFormatVersion: global.DevelopmentV3.PROFILE_FORMAT_VERSION, players };
      const snapshotValidation = validateSnapshot(developmentV3PlayerSnapshot);
      if (!snapshotValidation.valid) throw new DevelopmentSnapshotError("development-v3-snapshot-invalid", snapshotValidation.errors);
      let legacyEnvelope;
      try { legacyEnvelope = options.v2Compatibility || global.DevelopmentAccountV3?.projectV2Compatibility?.(canonical, resolveBasePlayer) || { players: {} }; }
      catch (error) { throw new DevelopmentSnapshotError("development-v3-account-unavailable", [{ code: error?.code || "development-v3-compatibility-error", details: error?.details || [] }]); }
      return { developmentV3PlayerSnapshot, developmentPlayerSnapshot: clone(legacyEnvelope.players || {}) };
    }
    const v2State = options.v2State || global.DevelopmentV2?.read?.();
    if (!record(v2State)) throw new DevelopmentSnapshotError("development-v2-read-failed");
    const legacy = clone(record(v2State.players) ? v2State.players : {});
    const playerIds = Object.keys(legacy).sort();
    const result = global.DevelopmentV3Migration?.convertState?.({
      v2State, resolveBasePlayer, database: options.database || conversionDatabase(playerIds),
      progression: options.progression || global.InazumaProgression,
    });
    if (!result?.ok) throw new DevelopmentSnapshotError("development-v3-snapshot-conversion-blocked", result?.blockers || []);
    const players = {};
    for (const playerId of Object.keys(result.state.players).sort()) {
      const chain = result.state.players[playerId];
      const profile = chain.steps.at(-1)?.profile || chain.legacyNormale?.profile;
      if (!profile) throw new DevelopmentSnapshotError("development-v3-active-profile-missing", [playerId]);
      players[playerId] = { profile: clone(profile) };
    }
    const developmentV3PlayerSnapshot = { schemaVersion: SNAPSHOT_SCHEMA_VERSION, profileFormatVersion: global.DevelopmentV3.PROFILE_FORMAT_VERSION, players };
    const validation = validateSnapshot(developmentV3PlayerSnapshot);
    if (!validation.valid) throw new DevelopmentSnapshotError("development-v3-snapshot-invalid", validation.errors);
    return { developmentV3PlayerSnapshot, developmentPlayerSnapshot: legacy };
  }

  function activeSnapshotKind(run, playerId) {
    if (Object.prototype.hasOwnProperty.call(run || {}, "developmentV3PlayerSnapshot")) {
      const validation = validateSnapshot(run.developmentV3PlayerSnapshot);
      if (!validation.valid) throw new DevelopmentSnapshotError("development-v3-snapshot-invalid", validation.errors);
      if (run.developmentV3PlayerSnapshot.players[String(playerId)]) return "v3";
    }
    if (record(run?.developmentPlayerSnapshot?.[String(playerId)])) return "v2";
    return "base";
  }

  function resolvePlayer(run, basePlayer, level, database) {
    const kind = activeSnapshotKind(run, basePlayer?.playerId);
    if (kind === "v3") return global.DevelopmentV3.resolveValidatedMaterializedPlayer(basePlayer, run.developmentV3PlayerSnapshot.players[String(basePlayer.playerId)].profile, level);
    const options = kind === "v2" ? global.DevelopmentV2.optionsFromUpgrade(basePlayer, run.developmentPlayerSnapshot[String(basePlayer.playerId)]) : undefined;
    return global.InazumaProgression.getPlayerAtLevel(basePlayer, level, database, options);
  }

  function resolvePermanentPlayer(run, playerId, level, database) {
    const base = resolveBasePlayer(playerId);
    if (!base) throw new DevelopmentSnapshotError("base-player-missing", [String(playerId)]);
    return resolvePlayer(run, base, level, database || baseMatches(playerId)[0]?.database);
  }

  function resolveEffectiveMetadata(run, basePlayer, database) {
    const resolved = resolvePlayer(run, basePlayer, Number(basePlayer?.maxLevel || 20), database);
    return { ...basePlayer, finalOverall: resolved.potential, potential: resolved.potential, category: resolved.category };
  }

  function rosterEntryPermanentFields(run, basePlayer) {
    if (activeSnapshotKind(run, basePlayer?.playerId) !== "v2") return { potentialBoost: 0, currentOverallBoost: 0, potentialBoostApplications: [], intensiveTrainingMigrated: true };
    return { ...global.DevelopmentV2.optionsFromUpgrade(basePlayer, run.developmentPlayerSnapshot[String(basePlayer.playerId)]), intensiveTrainingMigrated: true };
  }

  function trainingState(run, basePlayer, entry, database, options = {}) {
    const providedBase = options.permanentMode === "provided-base";
    const kind = providedBase ? "provided-base" : activeSnapshotKind(run, basePlayer?.playerId);
    if (kind !== "v3") {
      const permanentPotential = Number(basePlayer?.finalOverall || 0);
      const maxLocalBoost = Math.max(0, 99 - permanentPotential);
      const applications = global.InazumaProgression.normalizePotentialBoostApplications(entry, maxLocalBoost);
      const currentLocalBoost = applications.reduce((sum, application) => sum + Number(application.amount || 0), 0);
      return { kind, permanentPotential, maxLocalBoost, applications, currentLocalBoost, currentOverallBoost: Math.min(currentLocalBoost, Math.max(0, Number(entry?.currentOverallBoost ?? currentLocalBoost))), remainingBoost: Math.max(0, maxLocalBoost - currentLocalBoost) };
    }
    const permanent = resolvePlayer(run, basePlayer, Number(basePlayer?.maxLevel || 20), database);
    const maxLocalBoost = Math.max(0, 99 - Number(permanent.potential || 0));
    const savedApplications = Array.isArray(entry?.potentialBoostApplications) ? entry.potentialBoostApplications : [];
    const localApplications = savedApplications.filter((application) => !application?.permanent);
    const savedLocalBoost = savedApplications.some((application) => application?.permanent)
      ? localApplications.reduce((sum, application) => sum + Math.max(0, Number(application?.amount || 0)), 0)
      : Math.max(0, Number(entry?.potentialBoost || 0));
    const applications = global.InazumaProgression.normalizePotentialBoostApplications({ ...entry, potentialBoost: savedLocalBoost, potentialBoostApplications: localApplications }, maxLocalBoost);
    const currentLocalBoost = applications.reduce((sum, application) => sum + Number(application.amount || 0), 0);
    return { kind, permanentPotential: permanent.potential, maxLocalBoost, applications, currentLocalBoost, currentOverallBoost: Math.min(currentLocalBoost, Math.max(0, Number(entry?.currentOverallBoost ?? currentLocalBoost))), remainingBoost: Math.max(0, maxLocalBoost - currentLocalBoost) };
  }

  function resolveRosterPlayer(run, basePlayer, entry, database) {
    const level = Math.floor(Number(entry?.level || 0));
    const kind = activeSnapshotKind(run, basePlayer?.playerId);
    if (kind !== "v3") return global.InazumaProgression.getPlayerAtLevel(basePlayer, level, database, {
      potentialBoost: entry?.potentialBoost, currentOverallBoost: entry?.currentOverallBoost, potentialBoostApplications: entry?.potentialBoostApplications,
    });
    const permanent = resolvePlayer(run, basePlayer, level, database);
    const state = trainingState(run, basePlayer, entry, database);
    const applications = state.applications;
    const trainingBoost = state.currentLocalBoost;
    const visibleBoost = state.currentOverallBoost;
    const stats = { ...(permanent.stats || {}) };
    for (const application of applications) for (const [stat, delta] of Object.entries(application.codexDeltas || {})) {
      stats[stat] = Math.min(99, Number(stats[stat] || 0) + Number(delta || 0) * 10);
    }
    const potential = Math.min(99, Number(permanent.potential || 0) + trainingBoost);
    const overall = Math.min(potential, Number(permanent.overall || 0) + visibleBoost);
    return { ...permanent, ...stats, stats, potential, overall, category: global.InazumaProgression.categoryForPotential(potential, permanent.category, database) };
  }

  function planIntensiveTraining(run, basePlayer, entry, addedBoost, database, options = {}) {
    if (options.permanentMode === "provided-base") {
      const state = trainingState(run, basePlayer, entry, database, options);
      const appliedBoost = Math.min(Math.max(0, Number(addedBoost || 0)), state.remainingBoost);
      return { ...global.InazumaProgression.planCodexTrainingGrowth(basePlayer, { ...entry, potentialBoost: state.currentLocalBoost, currentOverallBoost: state.currentOverallBoost, potentialBoostApplications: state.applications }, appliedBoost), permanentPotential: state.permanentPotential, existingTrainingBoost: state.currentLocalBoost, appliedBoost, remainingBoost: state.remainingBoost };
    }
    if (activeSnapshotKind(run, basePlayer?.playerId) !== "v3") {
      return global.InazumaProgression.planCodexTrainingGrowth(basePlayer, entry, addedBoost);
    }
    const state = trainingState(run, basePlayer, entry, database, options);
    const permanent = resolvePlayer(run, basePlayer, Number(basePlayer?.maxLevel || 20), database);
    const applications = state.applications;
    const localBoost = state.currentLocalBoost;
    const appliedBoost = Math.min(Math.max(0, Number(addedBoost || 0)), state.remainingBoost);
    const trainingBase = { ...basePlayer, finalOverall: permanent.potential, ratings: global.InazumaProgression.toCodexRatings(permanent.stats), stats: permanent.stats };
    const plan = global.InazumaProgression.planCodexTrainingGrowth(trainingBase, {
      potentialBoost: localBoost,
      currentOverallBoost: Math.min(localBoost, Math.max(0, Number(entry?.currentOverallBoost ?? localBoost))),
      potentialBoostApplications: applications,
    }, appliedBoost);
    return { ...plan, permanentPotential: permanent.potential, existingTrainingBoost: localBoost, appliedBoost, remainingBoost: state.remainingBoost };
  }

  const api = { SNAPSHOT_SCHEMA_VERSION, registerDatabase, resolveBasePlayer, validateSnapshot, buildRunSnapshot, activeSnapshotKind, resolvePlayer, resolvePermanentPlayer, resolveEffectiveMetadata, rosterEntryPermanentFields, trainingState, resolveRosterPlayer, planIntensiveTraining, DevelopmentSnapshotError };
  global.DevelopmentRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
