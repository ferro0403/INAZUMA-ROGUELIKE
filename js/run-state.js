(function (global) {
  "use strict";

  const config = () => global.SEASON1_CONFIG;
  const PROFILE_KEY = "inazuma_roguelike_profile";
  const DEFAULT_TEAM_NAME = "La tua squadra";
  const runLivesLimit = () => Number(global.SEASON1_CONFIG?.maxRunLives ?? global.SEASON1_CONFIG?.startingLives ?? 2);
  const initialRunLives = () => Number(global.SEASON1_CONFIG?.startingLives ?? runLivesLimit());
  const LIFE_DAMAGE_BY_MATCH_TYPE = Object.freeze({ five_v_five: 0.5, boss: 1, special_match: 1 });
  const DEFAULT_EMBLEM_ID = "default-lightning";

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function makeId(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`; }
  function seasonIdOf(runOrId = null) { return global.SeasonRegistry?.normalizeSeasonId?.(typeof runOrId === "object" ? runOrId?.seasonId : runOrId) || "ie1"; }
  function seasonSaveKey(seasonId = null) { return `${config().saveKey}:${seasonIdOf(seasonId)}`; }
  function primaryKey(seasonId = null) { return seasonSaveKey(seasonId); }
  function legacyKeys() { return Array.from(new Set([...(config().legacySaveKeys || []), "inazumaRoguelikeSeason1Run_v1"].filter((key) => key && key !== primaryKey()))); }
  function backupKey(seasonId = null) { return `${primaryKey(seasonId)}_backup`; }
  function tempKey(seasonId = null) { return `${primaryKey(seasonId)}_tmp`; }
  function headKey(seasonId = null) { return `${primaryKey(seasonId)}_head`; }
  function lockKey(seasonId = null) { return `${primaryKey(seasonId)}_lock`; }
  const STORAGE_SCHEMA_VERSION = 1;

  class RunPersistenceError extends Error {
    constructor(code, stage, details = {}, cause = null) {
      super(code); this.name = "RunPersistenceError"; this.code = code; this.stage = stage;
      Object.assign(this, { seasonId: details.seasonId || null, runId: details.runId || null, generation: details.generation ?? null, recoverable: details.recoverable === true, canonicalCommitted: details.canonicalCommitted === true });
      if (cause) this.cause = cause;
    }
  }
  function persistenceError(code, stage, details, cause) { return new RunPersistenceError(code, stage, details, cause); }
  function stableLegacyId(raw, sid) { let hash = 2166136261; for (const char of `${sid}:${raw}`) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `legacy_${sid}_${(hash >>> 0).toString(36)}`; }
  function rawSeasonId(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }
  function knownSeasonId(value) { const listed = global.SeasonRegistry?.list?.(); if (Array.isArray(listed)) return listed.some((season) => season.id === value); return value === "ie1" || global.SeasonRegistry?.normalizeSeasonId?.(value) === value; }
  function makeCommitId(generation) { return `commit_${generation}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`; }

  function normalizeTeamIdentity(teamIdentity = {}) {
    const name = String(teamIdentity.name || DEFAULT_TEAM_NAME).trim() || DEFAULT_TEAM_NAME;
    const emblemId = String(teamIdentity.emblemId || "").trim() || DEFAULT_EMBLEM_ID;
    return { name, emblemId };
  }
  function validTeamName(value) {
    const name = String(value || "").trim();
    return name.length >= 2 && name.length <= 24 && name !== DEFAULT_TEAM_NAME ? name : "";
  }
  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const name = validTeamName(parsed?.teamIdentity?.name || parsed?.teamName || parsed?.name);
      const emblemId = parsed?.teamIdentity?.emblemId || parsed?.emblemId || parsed?.emblem || DEFAULT_EMBLEM_ID;
      return { teamIdentity: name ? normalizeTeamIdentity({ ...parsed?.teamIdentity, name, emblemId }) : null, preferences: { smartAutoLineup: parsed?.preferences?.smartAutoLineup === true } };
    } catch (error) { console.error("Unable to load profile", error); return { teamIdentity: null, preferences: { smartAutoLineup: false } }; }
  }
  function emitSave(sector, seasonId, operation, options = {}) { if (!options.suppressCloudEvent && typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("inazuma:local-save-committed", { detail: { sector, seasonId: seasonId || null, hallTeamId: null, operation, generation: options.generation ?? null, commitId: options.commitId || null, source: "gameplay" } })); }
  function saveProfileTeamIdentity(teamIdentity, options = {}) {
    global.PersistenceRecoveryGuard?.assertWritable(options);
    const cleanIdentity = normalizeTeamIdentity(teamIdentity);
    const current = loadProfile();
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, teamIdentity: cleanIdentity, preferences: current.preferences }));
    emitSave("profile", null, "write", options);
    global.PersistenceRecoveryGuard?.bump(options);
    return cleanIdentity;
  }
  function saveProfilePreferences(preferences = {}, options = {}) {
    global.PersistenceRecoveryGuard?.assertWritable(options);
    const current = loadProfile();
    const cleanPreferences = { smartAutoLineup: preferences.smartAutoLineup === true };
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, teamIdentity: current.teamIdentity, preferences: cleanPreferences }));
    emitSave("profile", null, "write", options);
    global.PersistenceRecoveryGuard?.bump(options);
    return cleanPreferences;
  }
  function restoreProfile(profile, options = {}) {
    global.PersistenceRecoveryGuard?.assertWritable(options);
    if (!profile?.teamIdentity && !profile?.preferences) { localStorage.removeItem(PROFILE_KEY); emitSave("profile", null, "remove", options); return { teamIdentity: null, preferences: { smartAutoLineup: false } }; }
    if (profile.teamIdentity) saveProfileTeamIdentity(profile.teamIdentity, { ...options, suppressCloudEvent: true });
    saveProfilePreferences(profile.preferences, options);
    return loadProfile();
  }

  function createRun(teamIdentity = {}, seasonId = null) {
    const now = new Date().toISOString();
    const normalizedSeasonId = seasonIdOf(seasonId || global.SeasonRegistry?.activeId?.());
    let storageGeneration = 0; try { const raw = localStorage.getItem(primaryKey(normalizedSeasonId)); storageGeneration = raw ? Number(parseEnvelope(raw, normalizedSeasonId).generation) : 0; } catch (_) {}
    return { version: config().saveVersion, seasonId: normalizedSeasonId, runId: makeId("run"), storageGeneration, createdAt: now, updatedAt: now, lastPlayedAt: now, phase: "formation", teamIdentity: normalizeTeamIdentity(teamIdentity), lives: initialRunLives(), consecutiveLosses: 0, formationId: null, roster: [], lineup: [], bench: [], draft: null, bossIndex: 0, completedBossIds: [], unlockedTeamIds: [], teamLevel: 0, teamLevelUnits: 0, completedSpecialMatchIds: [], claimedSpecialMatchRewardIds: [], unlockedSpecialTeamIds: [], pendingSpecialMatchReward: null, inventory: [], effects: {}, randomEventHistory: [], fiveVFive: null, activeMatch: null, pendingBossVictory: null, postBossFlow: null, currentZone: null, checkpoint: null, gameOver: false, messages: [] };
  }

  function defaultPostBossFlowFromPending(run) {
    const pending = run?.pendingBossVictory;
    if (!pending) return null;
    const remaining = Math.max(0, Number(pending.rewardsRemaining ?? pending.remainingRewards ?? 2));
    return { status: remaining > 0 ? "reward" : "next-zone", bossIndex: Number(pending.bossIndex ?? run.bossIndex ?? 0), bossTeamId: pending.bossId || pending.bossTeamId || null, matchNodeId: pending.nodeId || pending.matchNodeId || null, remainingRewards: remaining, rewardNumber: Math.max(1, 3 - remaining), excludedIds: Array.isArray(pending.excludedIds) ? pending.excludedIds.map(String) : [], rerolls: Number(pending.rerolls || 0), candidateIds: Array.isArray(pending.candidateIds) ? pending.candidateIds.map(String) : [], completed: false };
  }

  function normalizePostBossFlow(run) {
    let flow = run.postBossFlow || defaultPostBossFlowFromPending(run);
    const match = run.activeMatch;
    if (!flow && match?.type === "boss" && match.result === "victory" && String(match.state || "").startsWith("completed")) {
      flow = { status: "result", bossIndex: Number(match.bossIndex ?? run.bossIndex ?? 0), bossTeamId: match.bossId || null, matchNodeId: match.nodeId || null, remainingRewards: 2, rewardNumber: 1, excludedIds: [], rerolls: 0, candidateIds: [], completed: false };
    }
    if (!flow) return null;
    const remaining = Math.max(0, Math.min(2, Number(flow.remainingRewards ?? flow.rewardsRemaining ?? 2)));
    return { status: ["result", "reward", "next-zone", "season-complete"].includes(flow.status) ? flow.status : (remaining > 0 ? "reward" : "next-zone"), bossIndex: Number(flow.bossIndex ?? run.bossIndex ?? 0), bossTeamId: flow.bossTeamId || flow.bossId || null, matchNodeId: flow.matchNodeId || flow.nodeId || null, remainingRewards: remaining, rewardNumber: Math.max(1, Math.min(2, Number(flow.rewardNumber ?? (3 - remaining)))), excludedIds: Array.isArray(flow.excludedIds) ? Array.from(new Set(flow.excludedIds.map(String))) : [], rerolls: Math.max(0, Number(flow.rerolls || 0)), candidateIds: Array.isArray(flow.candidateIds) ? flow.candidateIds.map(String) : [], completed: Boolean(flow.completed) };
  }

  function migrateV1ToV2(input) { const run = clone(input); run.version = 2; run.postBossFlow = normalizePostBossFlow(run); return run; }
  const SAVE_MIGRATIONS = { 1: migrateV1ToV2 };
  function migrate(input, options = {}) {
    let run = clone(input);
    let version = Number(run.version || 1);
    if (Number.isInteger(version) && version > Number(config().saveVersion)) throw persistenceError("unsupported-run-save-version", "payload-version", { seasonId: options.requestedSeasonId || rawSeasonId(run.seasonId) });
    if (!Number.isInteger(version) || version < 1) throw new Error("Unsupported run save version");
    while (version < config().saveVersion) { const step = SAVE_MIGRATIONS[version]; if (!step) throw new Error(`Missing save migration ${version}`); run = step(run); version = Number(run.version); }
    return normalize(run, options);
  }
  function normalize(run, options = {}) {
    const explicitSeason = rawSeasonId(run.seasonId);
    if (explicitSeason && !knownSeasonId(explicitSeason)) throw new Error("Invalid run season");
    run.seasonId = explicitSeason || options.requestedSeasonId || seasonIdOf(null);
    run.version = config().saveVersion;
    const profileIdentity = options.storageRead ? null : loadProfile().teamIdentity;
    const followsProfile = !run.gameOver && !["complete", "final-summary", "final-celebration", "gameover"].includes(String(run.phase || ""));
    run.teamIdentity = normalizeTeamIdentity(followsProfile && profileIdentity ? profileIdentity : run.teamIdentity);
    run.runId = run.runId || options.stableRunId || makeId("run");
    run.phase = run.phase || "formation";
    run.lastPlayedAt = run.lastPlayedAt || run.updatedAt || run.savedAt || run.timestamp || run.createdAt || null;
    const rawLives = Number(run.lives);
    const fallbackLives = run.gameOver || ["gameover", "complete", "final-summary", "final-celebration"].includes(String(run.phase || "")) ? 0 : initialRunLives();
    run.lives = Math.max(0, Math.min(runLivesLimit(), Number.isFinite(rawLives) ? rawLives : fallbackLives));
    const rawConsecutiveLosses = Number(run.consecutiveLosses);
    run.consecutiveLosses = Math.max(0, Math.min(2, Math.floor(Number.isFinite(rawConsecutiveLosses) ? rawConsecutiveLosses : 0)));
    run.bossIndex = Number.isFinite(Number(run.bossIndex)) ? Number(run.bossIndex) : 0;
    for (const key of ["roster", "lineup", "bench", "inventory", "completedBossIds", "unlockedTeamIds"]) run[key] = Array.isArray(run[key]) ? run[key] : [];
    if (!options.storageRead && global.SeasonRegistry?.database?.(run.seasonId)?.requiresProfileAwareRuntime) global.ProfiledSeasonRuntime?.normalizeRun?.(run);
    run.activeMatch = run.activeMatch || null; run.currentZone = run.currentZone || null;
    if (!options.storageRead && global.SeasonRegistry?.database?.(run.seasonId)?.requiresProfileAwareRuntime && run.currentZone) global.MapEngine?.normalizeSpecialMatchNode?.(run, global.SeasonRegistry?.database?.(run.seasonId));
    if (!run.developmentPlayerSnapshot) run.developmentPlayerSnapshot = options.storageRead ? {} : clone(global.DevelopmentV2?.read?.().players || {});
    run.postBossFlow = normalizePostBossFlow(run);
    run.pendingBossVictory = run.pendingBossVictory || null;
    run.permanentEffectOutbox = Array.isArray(run.permanentEffectOutbox) ? run.permanentEffectOutbox : [];
    if (run.checkpoint) { run.checkpoint.version = config().saveVersion; run.checkpoint.teamIdentity = normalizeTeamIdentity(run.teamIdentity); }
    return run;
  }
  function validate(run) {
    return !!(run && typeof run === "object" && Number(run.version) === Number(config().saveVersion) && run.runId && run.phase && Number.isFinite(Number(run.lives)) && Number.isFinite(Number(run.bossIndex)) && Array.isArray(run.roster) && Array.isArray(run.lineup) && Array.isArray(run.bench) && Array.isArray(run.inventory) && Array.isArray(run.completedBossIds) && Array.isArray(run.unlockedTeamIds) && (run.activeMatch === null || typeof run.activeMatch === "object") && (run.currentZone === null || typeof run.currentZone === "object") && (run.postBossFlow === null || typeof run.postBossFlow === "object"));
  }
  function rawSanity(parsed) { return !!parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed.version == null || Number.isInteger(Number(parsed.version))); }
  function looksLikeStorageEnvelope(value) {
    return !!value && typeof value === "object" && !Array.isArray(value) && ["storageSchemaVersion", "generation", "commitId", "state", "payload"].some((key) => Object.prototype.hasOwnProperty.call(value, key));
  }
  function parseLegacy(raw, sid) { const parsed = JSON.parse(raw); if (looksLikeStorageEnvelope(parsed)) throw persistenceError(Number(parsed.storageSchemaVersion) > STORAGE_SCHEMA_VERSION ? "unsupported-storage-schema" : "corrupt-storage-envelope", "legacy-guard", { seasonId: sid }); if (!rawSanity(parsed)) throw new Error("Invalid raw run save"); const explicit = rawSeasonId(parsed.seasonId); if (explicit && explicit !== sid) throw new Error("Wrong run season"); const migrated = migrate(parsed, { storageRead: true, requestedSeasonId: sid, stableRunId: stableLegacyId(raw, sid) }); if (!validate(migrated)) throw new Error("Invalid run save"); return migrated; }
  function parseEnvelope(raw, sid) { const envelope = JSON.parse(raw); if (Number(envelope?.storageSchemaVersion) > STORAGE_SCHEMA_VERSION) throw persistenceError("unsupported-storage-schema", "envelope-parse", { seasonId: sid }); if (!envelope || envelope.storageSchemaVersion !== STORAGE_SCHEMA_VERSION || envelope.seasonId !== sid || !Number.isInteger(envelope.generation) || envelope.generation < 1 || typeof envelope.commitId !== "string" || !["active", "deleted"].includes(envelope.state)) throw persistenceError("corrupt-storage-envelope", "envelope-parse", { seasonId: sid }); if (envelope.state === "active") { if (!rawSanity(envelope.payload)) throw persistenceError("corrupt-storage-envelope", "payload-parse", { seasonId: sid }); const run = migrate(envelope.payload, { storageRead: true, requestedSeasonId: sid }); if (run.seasonId !== sid || run.runId !== envelope.runId || !validate(run)) throw persistenceError("corrupt-storage-envelope", "payload-validate", { seasonId: sid }); run.storageGeneration = envelope.generation; run.storageCommitId = envelope.commitId; envelope.payload = run; } else if (envelope.payload !== null || envelope.runId !== null) throw persistenceError("corrupt-storage-envelope", "tombstone-validate", { seasonId: sid }); return envelope; }
  function stableSerializeForStorage(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number") return JSON.stringify(Number.isFinite(value) ? value : null);
    if (Array.isArray(value)) return `[${value.map(stableSerializeForStorage).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stableSerializeForStorage(value[key])}`).join(",")}}`;
    return "null";
  }
  function semanticLegacyFingerprint(run) { const value = clone(run); for (const key of ["runId", "storageGeneration", "storageCommitId", "updatedAt", "lastPlayedAt"]) delete value[key]; return stableSerializeForStorage(value); }
  function withStorageLease(sid, operation) {
    const key = lockKey(sid), ownerId = makeId("writer"), now = Date.now(); let existing = null;
    try { const raw = localStorage.getItem(key); existing = raw ? JSON.parse(raw) : null; } catch (error) { throw persistenceError("storage-read-failed", "lock-read", { seasonId: sid }, error); }
    if (existing && Number(existing.expiresAt) > now) throw persistenceError("write-locked", "lock-acquire", { seasonId: sid, recoverable: true });
    const lease = { ownerId, fence: Math.max(Number(existing?.fence || 0) + 1, now), expiresAt: now + 5000 };
    try { localStorage.setItem(key, JSON.stringify(lease)); const verified = JSON.parse(localStorage.getItem(key)); if (verified.ownerId !== ownerId || verified.fence !== lease.fence) throw new Error("lease ownership lost"); } catch (error) { throw persistenceError("storage-unavailable", "lock-acquire", { seasonId: sid, recoverable: true }, error); }
    try { return operation(() => { const current = JSON.parse(localStorage.getItem(key) || "null"); return current?.ownerId === ownerId && current?.fence === lease.fence && Number(current.expiresAt) > Date.now(); }); }
    finally { try { const current = JSON.parse(localStorage.getItem(key) || "null"); if (current?.ownerId === ownerId) { localStorage.setItem(key, JSON.stringify({ ...current, expiresAt: 0 })); localStorage.removeItem(key); } } catch (_) {} }
  }
  function save(run, options) { return RunStorage.save(run, options); }
  function load(seasonId = null, options = {}) { return RunStorage.load(seasonId, options); }
  function hasSave(seasonId = null) { return !!RunStorage.load(seasonId, { readOnly: true }); }
  function isActiveRun(run) { return validate(run) && !run.gameOver && !["complete", "final-summary", "final-celebration", "gameover"].includes(String(run.phase || "")); }
  function runSortTime(run, fallbackIndex = 0) { const value = run?.lastPlayedAt || run?.updatedAt || run?.savedAt || run?.timestamp || run?.createdAt || ""; const time = Date.parse(value); return Number.isFinite(time) ? time : fallbackIndex; }
  function touch(run) { if (!run) return run; run.lastPlayedAt = new Date().toISOString(); return save(run); }
  function activeSaves() { return (global.SeasonRegistry?.list?.() || [{ id: "ie1" }]).map((season, index) => { try { return { season, run: load(season.id, { readOnly: true }), index }; } catch (error) { return { season, run: null, index, recovery: { code: error?.code || "storage-read-failed", recoverable: error?.recoverable === true } }; } }).filter((entry) => (entry.run && isActiveRun(entry.run)) || entry.recovery).sort((a, b) => runSortTime(b.run, b.index) - runSortTime(a.run, a.index)); }
  function recoverySaves() { return activeSaves().filter((entry) => entry.recovery); }
  function latestActiveSave() { return activeSaves().find((entry) => entry.run && isActiveRun(entry.run)) || null; }
  function remove(seasonId = null, options = {}) {
    global.PersistenceRecoveryGuard?.assertWritable(options);
    const sid = seasonIdOf(seasonId);
    if (options.expectedGeneration == null) throw persistenceError("missing-expected-generation", "delete-concurrency", { seasonId: sid, recoverable: true });
    const expected = Number(options.expectedGeneration); let generation, commitId, envelope, headValue;
    try { withStorageLease(sid, (ownsLease) => { let primary = null; const raw = localStorage.getItem(primaryKey(sid)); if (raw) primary = parseEnvelope(raw, sid); const currentGeneration = Number(primary?.generation || 0); if (expected !== currentGeneration) throw persistenceError("stale-write", "delete-locked-recheck", { seasonId: sid, generation: currentGeneration, recoverable: true }); generation = currentGeneration + 1; commitId = makeCommitId(generation); envelope = { storageSchemaVersion: STORAGE_SCHEMA_VERSION, seasonId: sid, generation, commitId, state: "deleted", runId: null, payload: null }; headValue = { storageSchemaVersion: STORAGE_SCHEMA_VERSION, seasonId: sid, generation, commitId, state: "deleted", runId: null }; if (!ownsLease()) throw persistenceError("write-locked", "delete-fence", { seasonId: sid, recoverable: true }); localStorage.setItem(primaryKey(sid), JSON.stringify(envelope)); const verified = parseEnvelope(localStorage.getItem(primaryKey(sid)), sid); if (verified.commitId !== commitId) throw new Error("delete readback mismatch"); }); } catch (error) { if (error instanceof RunPersistenceError) throw error; throw persistenceError("delete-write-failed", "delete-primary", { seasonId: sid, generation }, error); }
    try { localStorage.setItem(headKey(sid), JSON.stringify(headValue)); const verified = JSON.parse(localStorage.getItem(headKey(sid))); if (verified.commitId !== commitId) throw new Error("delete head mismatch"); } catch (error) { console.warn("Run head witness unavailable", { code: "head-write-failed", seasonId: sid, generation, canonicalCommitted: true }); }
    try { localStorage.setItem(backupKey(sid), JSON.stringify(envelope)); } catch (_) {}
    try { localStorage.removeItem(tempKey(sid)); if (sid === "ie1") [config().saveKey, `${config().saveKey}_backup`, `${config().saveKey}_tmp`, ...legacyKeys()].forEach((key) => localStorage.removeItem(key)); } catch (error) { console.warn("Run delete cleanup unavailable", { code: "cleanup-failed", seasonId: sid, generation }); }
    emitSave(`run_${sid}`, sid, "remove", { ...options, generation, commitId }); global.PersistenceRecoveryGuard?.bump(options); return { seasonId: sid, generation, commitId, deleted: true };
  }
  function restoreBackup(seasonId = null) { return RunStorage.repairCanonicalFromExactBackup(seasonId); }
  function loadBackup(seasonId = null) { const sid = seasonIdOf(seasonId); try { const envelope = parseEnvelope(localStorage.getItem(backupKey(sid)), sid); return envelope.state === "active" ? envelope.payload : null; } catch (_) { return null; } }
  function forceDeleteForRestore(seasonId = null, options = {}) { if (options.expectedGeneration == null) throw persistenceError("missing-expected-generation", "restore-delete", { seasonId: seasonIdOf(seasonId), recoverable: true }); return remove(seasonId, options); }
  function forceReplaceCanonicalFromSnapshot(run, options = {}) { const sid = seasonIdOf(run); if (options.expectedGeneration == null) throw persistenceError("missing-expected-generation", "restore-replace", { seasonId: sid, recoverable: true }); const candidate = clone(run); candidate.storageGeneration = Number(options.expectedGeneration); return save(candidate, { ...options, replaceRun: true }); }
  function persistMutationOrRecover(run, mutate, options = {}) {
    const sid = seasonIdOf(run), before = clone(run);
    try { mutate(run); return { ok: true, run: save(run, options) }; }
    catch (error) {
      let canonical = null;
      try { canonical = load(sid, { readOnly: true }); } catch (_) {}
      const recovered = canonical || before;
      for (const key of Object.keys(run)) delete run[key]; Object.assign(run, clone(recovered));
      if (typeof options.onRecover === "function") options.onRecover(run, error);
      return { ok: false, stale: error?.code === "stale-write" || error?.code === "lineage-mismatch", run, error, message: error?.code === "stale-write" ? "La run è stata aggiornata in un'altra scheda. Ho ricaricato l'ultima versione salvata." : "Salvataggio non riuscito. L'azione non è stata registrata." };
    }
  }

  const RunStorage = {
    keys: (seasonId = null) => ({ primary: primaryKey(seasonId), head: headKey(seasonId), backup: backupKey(seasonId), temp: tempKey(seasonId), lock: lockKey(seasonId), legacy: legacyKeys() }),
    validate, migrate,
    loadBackup,
    restoreBackup,
    repairCanonicalFromExactBackup(seasonId = null) {
      const sid = seasonIdOf(seasonId); let result = null;
      withStorageLease(sid, (ownsLease) => { let primaryRaw = null; try { primaryRaw = localStorage.getItem(primaryKey(sid)); if (primaryRaw) { parseEnvelope(primaryRaw, sid); throw persistenceError("canonical-primary-already-valid", "backup-repair-guard", { seasonId: sid }); } } catch (error) { if (error instanceof RunPersistenceError && ["canonical-primary-already-valid", "unsupported-storage-schema", "unsupported-run-save-version"].includes(error.code)) throw error; }
        let head, backup, backupRaw; try { head = JSON.parse(localStorage.getItem(headKey(sid)) || "null"); backupRaw = localStorage.getItem(backupKey(sid)); backup = parseEnvelope(backupRaw, sid); } catch (error) { throw persistenceError("recovery-proof-invalid", "backup-repair-read", { seasonId: sid }, error); }
        if (!head || head.generation !== backup.generation || head.commitId !== backup.commitId || head.state !== backup.state || head.runId !== backup.runId) throw persistenceError("recovery-proof-invalid", "backup-repair-proof", { seasonId: sid, recoverable: true });
        if (!ownsLease()) throw persistenceError("write-locked", "backup-repair-fence", { seasonId: sid, recoverable: true });
        try { localStorage.setItem(primaryKey(sid), backupRaw); if (localStorage.getItem(primaryKey(sid)) !== backupRaw) throw new Error("repair exact readback mismatch"); const verified = parseEnvelope(backupRaw, sid); result = verified.state === "deleted" ? null : verified.payload; } catch (error) { throw persistenceError("canonical-write-failed", "backup-repair-write", { seasonId: sid, generation: backup.generation }, error); }
      }); return result;
    },
    isActiveRun, runSortTime, touch, activeSaves, recoverySaves, latestActiveSave,
    load(seasonId = null, options = {}) {
      const sid = seasonId == null ? seasonIdOf(null) : seasonIdOf(seasonId); let head = null; let primary = null; let primaryError = null; let primaryLooksEnvelope = false;
      try { const raw = localStorage.getItem(headKey(sid)); head = raw ? JSON.parse(raw) : null; } catch (error) { throw persistenceError("storage-read-failed", "head-read", { seasonId: sid }, error); }
      try { const raw = localStorage.getItem(primaryKey(sid)); if (raw) { try { primaryLooksEnvelope = looksLikeStorageEnvelope(JSON.parse(raw)); } catch (_) {} primary = parseEnvelope(raw, sid); } } catch (error) { primary = null; primaryError = error; }
      if (primary) {
        if (head && (!Number.isInteger(head.generation) || head.storageSchemaVersion !== STORAGE_SCHEMA_VERSION || head.seasonId !== sid)) throw persistenceError("invalid-head", "head-validate", { seasonId: sid });
        if (head && head.generation > primary.generation) throw persistenceError("canonical-unrecoverable", "recovery", { seasonId: sid, generation: head.generation, recoverable: false });
        return primary.state === "deleted" ? null : primary.payload;
      }
      if (head) {
        if (head.storageSchemaVersion !== STORAGE_SCHEMA_VERSION || head.seasonId !== sid || !Number.isInteger(head.generation)) throw persistenceError("invalid-head", "head-validate", { seasonId: sid });
        if (primary && primary.generation === head.generation && primary.commitId === head.commitId && primary.state === head.state) return primary.state === "deleted" ? null : primary.payload;
        let backup = null; try { const raw = localStorage.getItem(backupKey(sid)); if (raw) backup = parseEnvelope(raw, sid); } catch (_) {}
        if (backup && backup.generation === head.generation && backup.commitId === head.commitId && backup.state === head.state) return backup.state === "deleted" ? null : backup.payload;
        throw persistenceError("canonical-unrecoverable", "recovery", { seasonId: sid, generation: head.generation, recoverable: false });
      }
      if (primaryLooksEnvelope && primaryError) throw primaryError;
      const scopedPrimary = primaryKey(sid), recoveryKeys = [tempKey(sid), backupKey(sid), ...(sid === "ie1" ? [config().saveKey, `${config().saveKey}_tmp`, `${config().saveKey}_backup`, ...legacyKeys()] : [])];
      let authoritative = null; try { const raw = localStorage.getItem(scopedPrimary); if (raw) authoritative = { key: scopedPrimary, raw, run: parseLegacy(raw, sid) }; } catch (_) {}
      const candidates = authoritative ? [authoritative] : recoveryKeys.map((key) => { try { const raw = localStorage.getItem(key); return raw ? { key, raw, run: parseLegacy(raw, sid) } : null; } catch (_) { return null; } }).filter(Boolean);
      if (!candidates.length) return null;
      if (!authoritative && candidates.length > 1 && new Set(candidates.map((item) => semanticLegacyFingerprint(item.run))).size > 1) throw persistenceError("legacy-recovery-required", "migration", { seasonId: sid, recoverable: true });
      if (options.readOnly) return candidates[0].run;
      return this.save(candidates[0].run, { preserveTimestamps: true, suppressCloudEvent: true, source: "legacy-migration", expectedGeneration: 0 });
    },
    save(run, options = {}) {
      global.PersistenceRecoveryGuard?.assertWritable(options);
      const sidHint = rawSeasonId(run?.seasonId) || seasonIdOf(null); let normalized; let json;
      try {
        normalized = normalize(clone(run));
        const stamp = new Date().toISOString();
        if (!options.preserveTimestamps) normalized.updatedAt = stamp;
        normalized.lastPlayedAt = normalized.lastPlayedAt || stamp;
        delete normalized.storageGeneration; delete normalized.storageCommitId; json = JSON.stringify(normalized);
      } catch (error) { throw persistenceError("serialization-failed", "serialize", { seasonId: sidHint, runId: run?.runId }, error); }
      const sid = normalized.seasonId; let primary = null;
      try { const rawPrimary = localStorage.getItem(primaryKey(sid)); primary = rawPrimary ? parseEnvelope(rawPrimary, sid) : null; } catch (error) { if (options.source !== "legacy-migration") throw persistenceError("canonical-unrecoverable", "concurrency-read", { seasonId: sid, runId: normalized.runId }, error); }
      const currentGeneration = Number(primary?.generation || 0);
      const expected = options.expectedGeneration ?? run.storageGeneration ?? (primary ? null : 0);
      if (expected == null || Number(expected) !== currentGeneration) throw persistenceError("stale-write", "concurrency", { seasonId: sid, runId: normalized.runId, generation: currentGeneration, recoverable: true });
      if (primary?.state === "active" && primary.runId !== normalized.runId && !options.replaceRun) throw persistenceError("lineage-mismatch", "concurrency", { seasonId: sid, runId: normalized.runId, generation: currentGeneration, recoverable: true });
      if (primary?.state === "deleted" && !options.replaceRun) throw persistenceError("lineage-mismatch", "concurrency", { seasonId: sid, runId: normalized.runId, generation: currentGeneration, recoverable: true });
      const generation = currentGeneration + 1, commitId = makeCommitId(generation);
      const envelope = { storageSchemaVersion: STORAGE_SCHEMA_VERSION, seasonId: sid, generation, commitId, state: "active", runId: normalized.runId, payload: JSON.parse(json) };
      const rawEnvelope = JSON.stringify(envelope), headValue = { storageSchemaVersion: STORAGE_SCHEMA_VERSION, seasonId: sid, generation, commitId, state: "active", runId: normalized.runId };
      try { withStorageLease(sid, (ownsLease) => { const latestRaw = localStorage.getItem(primaryKey(sid)); let latest = null; if (latestRaw) { try { latest = parseEnvelope(latestRaw, sid); } catch (error) { if (options.source !== "legacy-migration") throw error; } } if (Number(latest?.generation || 0) !== currentGeneration) throw persistenceError("stale-write", "locked-recheck", { seasonId: sid, runId: normalized.runId, generation: Number(latest?.generation || 0), recoverable: true }); if (!ownsLease()) throw persistenceError("write-locked", "lock-fence", { seasonId: sid, recoverable: true }); localStorage.setItem(primaryKey(sid), rawEnvelope); }); } catch (error) { if (error instanceof RunPersistenceError) throw error; throw persistenceError("canonical-write-failed", "primary-write", { seasonId: sid, runId: normalized.runId, generation }, error); }
      try { const verified = parseEnvelope(localStorage.getItem(primaryKey(sid)), sid); if (verified.commitId !== commitId || verified.generation !== generation) throw new Error("readback mismatch"); } catch (error) { throw persistenceError("canonical-verification-failed", "primary-readback", { seasonId: sid, runId: normalized.runId, generation }, error); }
      try { localStorage.setItem(headKey(sid), JSON.stringify(headValue)); const verifiedHead = JSON.parse(localStorage.getItem(headKey(sid))); if (verifiedHead.commitId !== commitId || verifiedHead.generation !== generation) throw new Error("head mismatch"); } catch (error) { console.warn("Run head witness unavailable", { code: "head-write-failed", seasonId: sid, generation, canonicalCommitted: true }); }
      try { localStorage.setItem(backupKey(sid), rawEnvelope); } catch (error) { console.warn("Run backup unavailable", { code: "backup-write-failed", seasonId: sid, generation }); }
      try { localStorage.removeItem(tempKey(sid)); if (sid === "ie1") { localStorage.removeItem(`${config().saveKey}_tmp`); } } catch (error) { console.warn("Run cleanup unavailable", { code: "cleanup-failed", seasonId: sid, generation }); }
      const reparsed = parseEnvelope(rawEnvelope, sid).payload;
      Object.assign(run, reparsed);
      emitSave(`run_${sid}`, sid, "write", { ...options, generation, commitId });
      global.PersistenceRecoveryGuard?.bump(options);
      return run;
    },
    remove, forceDeleteForRestore, forceReplaceCanonicalFromSnapshot, looksLikeStorageEnvelope,
  };

  function diagnostics(seasonId = null) {
    const sid = seasonIdOf(seasonId), sizes = {}; let head = null, primary = null, backup = null;
    for (const [name, key] of Object.entries(RunStorage.keys(sid))) {
      if (Array.isArray(key)) { sizes[name] = key.reduce((sum, item) => sum + String(localStorage.getItem(item) || "").length * 2, 0); continue; }
      sizes[name] = String(localStorage.getItem(key) || "").length * 2;
    }
    try { head = JSON.parse(localStorage.getItem(headKey(sid))); } catch (_) {}
    try { primary = parseEnvelope(localStorage.getItem(primaryKey(sid)), sid); } catch (_) {}
    try { backup = parseEnvelope(localStorage.getItem(backupKey(sid)), sid); } catch (_) {}
    return { seasonId: sid, canonicalGeneration: primary?.generation || 0, canonicalCommitId: primary?.commitId || null, canonicalState: primary?.state || "empty-or-corrupt", canonicalRunId: primary?.runId || null, headGeneration: head?.generation || 0, headMatchesCanonical: !!(primary && head && primary.generation === head.generation && primary.commitId === head.commitId), backupGeneration: backup?.generation || 0, recoveryStatus: primary ? "canonical" : (head && backup && head.commitId === backup.commitId ? "exact-backup-available" : "unavailable"), bytes: sizes, totalKnownBytes: Object.values(sizes).reduce((sum, value) => sum + value, 0) };
  }

  function createCheckpoint(run) {
    run.checkpoint = clone({ version: config().saveVersion, formationId: run.formationId, teamIdentity: run.teamIdentity, roster: run.roster, lineup: run.lineup, bench: run.bench, bossIndex: run.bossIndex, completedBossIds: run.completedBossIds, unlockedTeamIds: run.unlockedTeamIds, teamLevel: run.teamLevel, inventory: run.inventory, effects: run.effects, randomEventHistory: run.randomEventHistory, fiveVFive: run.fiveVFive, activeMatch: run.activeMatch || null, pendingBossVictory: run.pendingBossVictory || null, postBossFlow: run.postBossFlow || null, currentZone: run.currentZone });
    return save(run);
  }
  function getLifeDamageForMatch(matchType) { return LIFE_DAMAGE_BY_MATCH_TYPE[matchType] ?? 1; }
  function restoreAfterLoss(run, previousNodeId = null, matchType = run?.activeMatch?.type, options = {}) { run.lives = Math.max(0, Math.min(runLivesLimit(), Number(run.lives) || 0) - getLifeDamageForMatch(matchType)); if (run.lives <= 0) { run.lives = 0; run.gameOver = true; run.phase = "gameover"; return options.save === false ? run : save(run); } const targetNodeId = previousNodeId || run.activeMatch?.previousNodeId || run.currentZone?.currentNodeId || null; if (!targetNodeId) throw new Error("Previous match node unavailable"); if (run.currentZone) { run.currentZone.currentNodeId = targetNodeId; run.currentZone.pendingNodeId = null; } run.phase = "map"; run.gameOver = false; return options.save === false ? run : save(run); }

  global.RunPersistenceError = RunPersistenceError;
  global.RunStorage = Object.assign(RunStorage, { STORAGE_SCHEMA_VERSION, diagnostics });
  global.RunState = { clone, createRun, save, load, hasSave, runLivesLimit, initialRunLives, getLifeDamageForMatch, normalizeTeamIdentity, validTeamName, loadProfile, saveProfileTeamIdentity, saveProfilePreferences, restoreProfile, remove, forceDeleteForRestore, forceReplaceCanonicalFromSnapshot, persistMutationOrRecover, createCheckpoint, restoreAfterLoss, validate, isActiveRun, touch, activeSaves, recoverySaves, latestActiveSave };
})(globalThis);
