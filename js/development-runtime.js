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
    if (kind === "v3") return global.DevelopmentV3.resolveMaterializedPlayer(basePlayer, run.developmentV3PlayerSnapshot.players[String(basePlayer.playerId)].profile, level);
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
    return { potential: resolved.potential, category: resolved.category };
  }

  const api = { SNAPSHOT_SCHEMA_VERSION, registerDatabase, resolveBasePlayer, validateSnapshot, buildRunSnapshot, activeSnapshotKind, resolvePlayer, resolvePermanentPlayer, resolveEffectiveMetadata, DevelopmentSnapshotError };
  global.DevelopmentRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
