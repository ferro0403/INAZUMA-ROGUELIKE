(function (global) {
  "use strict";

  const STORAGE_KEY = "inazuma.hallOfFame.v1";
  const BACKUP_KEY = `${STORAGE_KEY}.backup`;
  const TEMP_KEY = `${STORAGE_KEY}.tmp`;
  const ARCHIVE_SCHEMA_VERSION = 3;
  const IDB_STORE = "hall";
  const IDB_STATE_KEY = "state";
  const IDB_MIGRATION_KEY = "migration:hall:localstorage-to-indexeddb:v1";
  const IDB_MIGRATION_SCHEMA_VERSION = 1;

  let indexedDbAuthority = false;
  let indexedDbCache = null;
  let indexedDbReadyPromise = null;
  let permanentEffectsBridgeInstalled = false;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso() { return new Date().toISOString(); }
  function stableId(key) { return `hall_${String(key || "unknown").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")}`; }
  function archiveKeyFor(snapshot) { return [snapshot.runId, snapshot.modeId, snapshot.seasonId, snapshot.finalBossId].map((part) => String(part || "unknown")).join("::"); }
  function emptyArchive() { return { schemaVersion: ARCHIVE_SCHEMA_VERSION, updatedAt: null, teams: [], index: [] }; }
  function isQuotaError(error) {
    return !!error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || Number(error.code) === 22 || Number(error.code) === 1014 || /quota/i.test(String(error.code || "")) || /quota/i.test(String(error.message || "")));
  }
  function stripTechnicalRunStatistics(input) {
    const stats = input && typeof input === "object" ? clone(input) : {};
    delete stats.processedMatchIds;
    delete stats.processedActionIds;
    return stats;
  }
  function compactPlayerStatistics(input, emergency = false) {
    const source = input && typeof input === "object" ? input : {};
    const essentialKeys = new Set([
      "playerId", "role", "appearances", "appearancesTotal", "wins", "goals", "shots", "saves", "cleanSheets",
      "defensiveActions", "defensiveStops", "averageRating", "bestRating", "overallGrowth", "finalLevel", "finalOverall",
      "recruitedAtLevel", "recruitedOverall", "finalAppearances", "finalMatchRating", "finalMatchGoals", "finalMatchSaves",
      "finalMatchDefensiveActions", "bossWins", "playerNameSnapshot", "portraitUrlSnapshot"
    ]);
    return Object.fromEntries(Object.entries(source).map(([playerId, raw]) => {
      const stats = raw && typeof raw === "object" ? clone(raw) : {};
      if (!emergency) return [playerId, stats];
      return [playerId, Object.fromEntries(Object.entries(stats).filter(([key, value]) => essentialKeys.has(key) && value !== null && value !== undefined && value !== ""))];
    }));
  }
  function compactPlayer(input, emergency = false) {
    const player = input && typeof input === "object" ? clone(input) : input;
    if (!player || typeof player !== "object") return player;
    if (emergency) {
      delete player.fullbodyUrl;
      delete player.traits;
    }
    return player;
  }
  function playerIdOf(player) { return player?.playerId == null ? null : String(player.playerId); }
  function expandStoredTeam(input) {
    const team = input && typeof input === "object" ? clone(input) : {};
    const roster = Array.isArray(team.fullRoster) ? team.fullRoster : [];
    const byId = new Map(roster.map((player) => [playerIdOf(player), player]).filter(([id]) => id));
    if (!Array.isArray(team.finalStartingEleven) && Array.isArray(team.finalStartingElevenIds)) {
      team.finalStartingEleven = team.finalStartingElevenIds.map((id) => byId.get(String(id))).filter(Boolean).map(clone);
    }
    if (!Array.isArray(team.bench) && Array.isArray(team.benchIds)) {
      team.bench = team.benchIds.map((id) => byId.get(String(id))).filter(Boolean).map(clone);
    }
    delete team.finalStartingElevenIds;
    delete team.benchIds;
    return team;
  }
  function compactTeam(input, { emergency = false } = {}) {
    const team = expandStoredTeam(input);
    team.archiveSchemaVersion = ARCHIVE_SCHEMA_VERSION;
    delete team.matchHistory;
    team.runStatistics = stripTechnicalRunStatistics(team.runStatistics);
    team.playerStatistics = compactPlayerStatistics(team.playerStatistics, emergency);
    team.finalStartingEleven = (Array.isArray(team.finalStartingEleven) ? team.finalStartingEleven : []).map((player) => compactPlayer(player, emergency));
    team.fullRoster = (Array.isArray(team.fullRoster) ? team.fullRoster : []).map((player) => compactPlayer(player, emergency));
    team.bench = (Array.isArray(team.bench) ? team.bench : []).map((player) => compactPlayer(player, emergency));
    if (emergency) {
      delete team.finalFormationTactics;
      delete team.rulesetVersion;
      delete team.databaseVersion;
      delete team.formationTacticsVersion;
      delete team.equipmentVersion;
      delete team.traitSystemVersion;
      delete team.sourceAppVersion;
    }
    return team;
  }
  function storageTeam(input, options = {}) {
    const team = compactTeam(input, options);
    const stored = clone(team);
    stored.finalStartingElevenIds = team.finalStartingEleven.map(playerIdOf).filter(Boolean);
    stored.benchIds = team.bench.map(playerIdOf).filter(Boolean);
    delete stored.finalStartingEleven;
    delete stored.bench;
    return stored;
  }
  function isValidTeam(team) { return !!(team && typeof team === "object" && team.hallTeamId && team.archiveKey && team.runId && Array.isArray(team.finalStartingEleven) && Array.isArray(team.fullRoster)); }
  function lightSummary(team, index = null) {
    const mvp = (team.awards || []).find((award) => award.id === "mvp") || (team.awards || [])[0] || null;
    return {
      hallTeamId: team.hallTeamId,
      archiveKey: team.archiveKey,
      teamName: team.teamName,
      teamLogo: team.teamLogo || null,
      modeName: team.modeName,
      seasonName: team.seasonName,
      victoryDate: team.victoryDate,
      finalFormation: team.finalFormation,
      finalAverageOverall: team.finalAverageOverall,
      wins: team.runStatistics?.winsTotal ?? null,
      losses: team.runStatistics?.lossesTotal ?? null,
      livesRemaining: team.livesRemaining ?? null,
      mvp: mvp ? { playerId: mvp.playerId, name: mvp.playerName, portraitUrl: mvp.portraitUrl } : null,
      portraits: (team.finalStartingEleven || []).slice(0, 4).map((player) => player.portraitUrl).filter(Boolean),
      ordinal: index == null ? null : index + 1,
    };
  }
  function sanitizeArchive(input, options = {}) {
    const archive = input && typeof input === "object" ? input : emptyArchive();
    const seen = new Set();
    const teams = (Array.isArray(archive.teams) ? archive.teams : []).map((team) => compactTeam(team, options)).filter(isValidTeam).filter((team) => {
      if (seen.has(team.archiveKey)) return false;
      seen.add(team.archiveKey);
      return true;
    });
    teams.sort((a, b) => String(b.victoryDate || "").localeCompare(String(a.victoryDate || "")));
    return { schemaVersion: ARCHIVE_SCHEMA_VERSION, updatedAt: archive.updatedAt ?? null, teams, index: teams.map(lightSummary) };
  }
  function serializeArchive(input, options = {}) {
    const clean = sanitizeArchive(input, options);
    return { schemaVersion: ARCHIVE_SCHEMA_VERSION, updatedAt: clean.updatedAt, teams: clean.teams.map((team) => storageTeam(team, options)), index: clean.index };
  }
  function materializeStoredArchive(input) { return sanitizeArchive(input && typeof input === "object" ? input : emptyArchive()); }
  function stable(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number") return JSON.stringify(Number.isFinite(value) ? value : null);
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return "null";
  }
  function parse(raw) { return sanitizeArchive(raw ? JSON.parse(raw) : emptyArchive()); }
  function loadLegacyArchive() {
    for (const key of [STORAGE_KEY, BACKUP_KEY, TEMP_KEY]) {
      try { const raw = localStorage.getItem(key); if (raw) return parse(raw); } catch (error) { if (error?.name === "SecurityError") throw Object.assign(new Error("storage-access-error"), { code: "storage-access-error", stage: "hall-read", cause: error }); }
    }
    return emptyArchive();
  }
  function loadArchive() {
    if (indexedDbAuthority) {
      if (!indexedDbCache) throw Object.assign(new Error("Hall IndexedDB authority non idratata"), { code: "hall-indexeddb-authority-corrupt", stage: "hall-indexeddb-read" });
      return clone(indexedDbCache);
    }
    return loadLegacyArchive();
  }
  function writePrimaryArchive(archive, options = {}) {
    const json = JSON.stringify(serializeArchive(archive, options));
    localStorage.removeItem(TEMP_KEY);
    localStorage.removeItem(BACKUP_KEY);
    localStorage.setItem(STORAGE_KEY, json);
    return parse(localStorage.getItem(STORAGE_KEY));
  }
  function emitSave(options = {}, hallTeamId = options.hallTeamId || null, operation = options.operation || "write") {
    if (!options.suppressCloudEvent && typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
      global.dispatchEvent(new global.CustomEvent("inazuma:local-save-committed", { detail: { domain: "account-permanent", sector: "hall_index", seasonId: null, hallTeamId, operation, source: options.source || "gameplay" } }));
    }
  }
  function guardMutation(options = {}) {
    global.PersistenceRecoveryGuard?.assertWritable?.(options);
    global.PersistenceRecoveryGuard?.reserve?.(options);
    global.PersistenceRecoveryGuard?.assertWritable?.(options);
  }
  function saveLegacyArchive(archive, options = {}) {
    guardMutation(options);
    const clean = sanitizeArchive({ ...archive, updatedAt: options.preserveTimestamp ? archive?.updatedAt : nowIso() });
    global.InazumaPersistenceDiagnostics?.removeExactTechnicalDuplicates?.();
    try {
      const saved = writePrimaryArchive(clean); emitSave(options); return saved;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      const emergency = sanitizeArchive(clean, { emergency: true });
      try {
        const saved = writePrimaryArchive(emergency, { emergency: true }); emitSave(options); return saved;
      } catch (retryError) {
        retryError.hallOfFameSaveFailed = true;
        retryError.code = "storage-quota-exceeded";
        retryError.stage = "hall-finalization";
        retryError.problemSector = "hall_index";
        throw retryError;
      }
    }
  }
  function failAsyncRequired(stage = "hall-write") {
    return Object.assign(new Error("Hall IndexedDB richiede il percorso asincrono"), { code: "hall-indexeddb-async-required", stage, problemSector: "hall_index", recoverable: true });
  }
  function db() {
    if (!global.PermanentIndexedDb) throw Object.assign(new Error("PermanentIndexedDb non disponibile"), { code: "indexeddb-unavailable", stage: "hall-indexeddb-open" });
    return global.PermanentIndexedDb;
  }
  function mergeForInterruptedMigration(legacyArchive, partialArchive) {
    const legacyClean = sanitizeArchive(legacyArchive);
    const partialClean = sanitizeArchive(partialArchive || emptyArchive());
    const seen = new Set(legacyClean.teams.map((team) => team.archiveKey));
    const teams = [...legacyClean.teams.map(clone)];
    for (const team of partialClean.teams) if (!seen.has(team.archiveKey)) { seen.add(team.archiveKey); teams.push(clone(team)); }
    return sanitizeArchive({ schemaVersion: ARCHIVE_SCHEMA_VERSION, updatedAt: legacyClean.updatedAt || partialClean.updatedAt || null, teams });
  }
  async function refreshIndexedDbArchive() {
    if (!indexedDbAuthority) return loadArchive();
    const stored = await db().read(IDB_STORE, IDB_STATE_KEY);
    if (!stored) throw Object.assign(new Error("Hall IndexedDB authority priva dello stato"), { code: "hall-indexeddb-authority-corrupt", stage: "hall-indexeddb-refresh" });
    indexedDbCache = materializeStoredArchive(stored);
    return clone(indexedDbCache);
  }
  async function ensureIndexedDbReady() {
    if (indexedDbAuthority && indexedDbCache) return { authority: "indexeddb", migrated: false, archive: clone(indexedDbCache) };
    if (indexedDbReadyPromise) return indexedDbReadyPromise;
    indexedDbReadyPromise = (async () => {
      let marker;
      try { marker = await db().read("meta", IDB_MIGRATION_KEY); }
      catch (error) {
        const unavailable = ["indexeddb-unavailable", "indexeddb-open-failed", "indexeddb-open-blocked", "storage-access-error"].includes(error?.code);
        if (unavailable) {
          if (global.PermanentLegacyCleanup?.wasCleaned?.("hall")) {
            throw global.PermanentLegacyCleanup.authorityUnavailable("hall", error);
          }
          return { authority: "legacy", migrated: false, deferred: true, error };
        }
        throw error;
      }
      if (marker?.complete === true) {
        const stored = await db().read(IDB_STORE, IDB_STATE_KEY);
        if (!stored) throw Object.assign(new Error("Marker Hall IndexedDB completo ma stato assente"), { code: "hall-indexeddb-authority-corrupt", stage: "hall-indexeddb-authority-read" });
        indexedDbCache = materializeStoredArchive(stored);
        indexedDbAuthority = true;
        installPermanentEffectsBridge();
        return { authority: "indexeddb", migrated: false, marker: clone(marker), archive: clone(indexedDbCache) };
      }
      if (global.PersistenceRecoveryGuard?.isBlocked?.()) return { authority: "legacy", migrated: false, deferred: true, reason: "restore-recovery-required" };
      global.PersistenceRecoveryGuard?.assertWritable?.();
      const legacyArchive = loadLegacyArchive();
      let partial = null;
      try { partial = await db().read(IDB_STORE, IDB_STATE_KEY); } catch (_) {}
      const merged = mergeForInterruptedMigration(legacyArchive, partial);
      const stored = serializeArchive(merged);
      const pending = { schemaVersion: IDB_MIGRATION_SCHEMA_VERSION, complete: false, startedAt: marker?.startedAt || nowIso(), source: "localStorage", legacyKey: STORAGE_KEY };
      await db().write("meta", pending, IDB_MIGRATION_KEY);
      await db().write(IDB_STORE, stored, IDB_STATE_KEY);
      const readback = await db().read(IDB_STORE, IDB_STATE_KEY);
      const verified = materializeStoredArchive(readback);
      if (stable(serializeArchive(verified)) !== stable(stored)) throw Object.assign(new Error("Verifica migrazione Hall IndexedDB fallita"), { code: "hall-indexeddb-migration-verification-failed", stage: "hall-indexeddb-migration-readback" });
      const complete = { ...pending, complete: true, completedAt: nowIso(), archiveSchemaVersion: ARCHIVE_SCHEMA_VERSION };
      await db().write("meta", complete, IDB_MIGRATION_KEY);
      const markerReadback = await db().read("meta", IDB_MIGRATION_KEY);
      if (markerReadback?.complete !== true) throw Object.assign(new Error("Marker migrazione Hall IndexedDB non verificato"), { code: "hall-indexeddb-migration-marker-failed", stage: "hall-indexeddb-migration-marker" });
      indexedDbCache = verified;
      indexedDbAuthority = true;
      installPermanentEffectsBridge();
      return { authority: "indexeddb", migrated: true, marker: clone(markerReadback), archive: clone(indexedDbCache) };
    })().finally(() => { indexedDbReadyPromise = null; });
    return indexedDbReadyPromise;
  }
  async function saveIndexedDbArchive(archive, options = {}) {
    if (!indexedDbAuthority) return saveLegacyArchive(archive, options);
    guardMutation(options);
    const clean = sanitizeArchive({ ...archive, updatedAt: options.preserveTimestamp ? archive?.updatedAt : nowIso() });
    let serialized = serializeArchive(clean);
    try {
      await db().write(IDB_STORE, serialized, IDB_STATE_KEY);
    } catch (error) {
      if (!isQuotaError(error) && error?.code !== "storage-quota-exceeded") throw error;
      serialized = serializeArchive(clean, { emergency: true });
      try { await db().write(IDB_STORE, serialized, IDB_STATE_KEY); }
      catch (retryError) {
        retryError.hallOfFameSaveFailed = true;
        retryError.code ||= "storage-quota-exceeded";
        retryError.stage ||= "hall-finalization";
        retryError.problemSector ||= "hall_index";
        throw retryError;
      }
    }
    const readback = await db().read(IDB_STORE, IDB_STATE_KEY);
    if (stable(readback) !== stable(serialized)) throw Object.assign(new Error("Hall IndexedDB readback mismatch"), { code: "hall-indexeddb-verification-failed", stage: "hall-indexeddb-write-readback", problemSector: "hall_index" });
    indexedDbCache = materializeStoredArchive(readback);
    emitSave(options);
    return clone(indexedDbCache);
  }
  async function addChampionAsync(snapshot, options = {}) {
    if (!indexedDbAuthority) return addChampion(snapshot);
    const archiveKey = snapshot.archiveKey || archiveKeyFor(snapshot);
    const hallTeamId = snapshot.hallTeamId || stableId(archiveKey);
    let created = false;
    let persistedTeam = null;
    try {
      const stored = await db().update(IDB_STORE, (current) => {
        const archive = materializeStoredArchive(current || indexedDbCache || emptyArchive());
        const existing = archive.teams.find((team) => team.archiveKey === archiveKey);
        if (existing) { persistedTeam = clone(existing); return serializeArchive(archive); }
        guardMutation(options);
        const team = compactTeam({ ...snapshot, archiveSchemaVersion: ARCHIVE_SCHEMA_VERSION, archiveKey, hallTeamId, createdAt: nowIso() });
        archive.teams.push(team);
        archive.updatedAt = nowIso();
        const clean = sanitizeArchive(archive);
        persistedTeam = clone(clean.teams.find((item) => item.archiveKey === archiveKey));
        created = true;
        return serializeArchive(clean);
      }, IDB_STATE_KEY);
      indexedDbCache = materializeStoredArchive(stored);
      const verified = indexedDbCache.teams.find((item) => item.archiveKey === archiveKey);
      if (!verified) throw Object.assign(new Error("Campione Hall non verificato dopo commit IndexedDB"), { code: "hall-indexeddb-verification-failed", stage: "hall-champion-readback", problemSector: "hall_index" });
      if (created) emitSave({ ...options, hallTeamId, operation: "write" }, hallTeamId, "write");
      return { team: clone(verified), created, persisted: true };
    } catch (error) {
      console.error("Unable to save Hall of Fame archive", error);
      return { team: persistedTeam ? clone(persistedTeam) : clone(compactTeam({ ...snapshot, archiveSchemaVersion: ARCHIVE_SCHEMA_VERSION, archiveKey, hallTeamId }, { emergency: true })), created, persisted: false, error: { name: error?.name || "Error", message: error?.message || String(error), code: error?.code || null, stage: error?.stage || null, problemSector: error?.problemSector || "hall_index" } };
    }
  }
  async function removeTeamAsync(hallTeamId, options = {}) {
    if (!indexedDbAuthority) return removeTeam(hallTeamId, options);
    let changed = false;
    const stored = await db().update(IDB_STORE, (current) => {
      const archive = materializeStoredArchive(current || indexedDbCache || emptyArchive());
      const teams = archive.teams.filter((item) => item.hallTeamId !== hallTeamId);
      changed = teams.length !== archive.teams.length;
      if (changed) guardMutation(options);
      return serializeArchive(sanitizeArchive({ ...archive, teams, updatedAt: changed ? nowIso() : archive.updatedAt }));
    }, IDB_STATE_KEY);
    indexedDbCache = materializeStoredArchive(stored);
    if (changed) emitSave({ ...options, hallTeamId, operation: "remove" }, hallTeamId, "remove");
    return clone(indexedDbCache);
  }

  function award(id, label, player, reason, score) { return player ? { id, label, playerId: player.playerId, playerName: player.name, portraitUrl: player.portraitUrl || null, reason, score } : null; }
  function calculateAwards(players, playerStats) {
    const stat = (p) => playerStats[String(p.playerId)] || {};
    const appeared = players.filter((p) => Number(stat(p).appearancesTotal || 0) > 0 || p.formationSlot != null);
    const withGrowth = appeared.map((player) => ({ player, growth: Number(player.finalOverall) - Number(player.recruitedOverall) })).filter(({ growth }) => Number.isFinite(growth) && growth > 0);
    const improved = withGrowth.sort((a, b) => b.growth - a.growth || String(a.player.name).localeCompare(String(b.player.name)) || String(a.player.playerId).localeCompare(String(b.player.playerId)))[0];
    return improved ? [award("most_improved", "Giocatore più cresciuto", improved.player, "Premio basato sulla crescita di overall realmente salvata nella run", improved.growth)] : [];
  }
  function addChampion(snapshot) {
    if (indexedDbAuthority) return { team: null, created: false, persisted: false, error: { code: "hall-indexeddb-async-required", stage: "hall-finalization", problemSector: "hall_index", message: "Hall IndexedDB richiede addChampionAsync" } };
    const archive = loadLegacyArchive();
    const archiveKey = snapshot.archiveKey || archiveKeyFor(snapshot);
    const existing = archive.teams.find((team) => team.archiveKey === archiveKey);
    if (existing) return { team: clone(existing), created: false, persisted: true };
    const hallTeamId = snapshot.hallTeamId || stableId(archiveKey);
    const team = compactTeam({ ...snapshot, archiveSchemaVersion: ARCHIVE_SCHEMA_VERSION, archiveKey, hallTeamId, createdAt: nowIso() });
    archive.teams.push(team);
    try {
      const saved = saveLegacyArchive(archive, { hallTeamId, operation: "write" });
      return { team: clone(saved.teams.find((item) => item.archiveKey === archiveKey)), created: true, persisted: true };
    } catch (error) {
      console.error("Unable to save Hall of Fame archive", error);
      return { team: clone(compactTeam(team, { emergency: true })), created: true, persisted: false, error: { name: error?.name || "Error", message: error?.message || String(error), code: error?.code || null, stage: error?.stage || null, problemSector: error?.problemSector || null } };
    }
  }
  function listTeams() { return loadArchive().teams.map(lightSummary); }
  function listSummaries() { return loadArchive().index.map((item, index) => ({ ...item, ordinal: index + 1 })); }
  function getTeam(hallTeamId) { const team = loadArchive().teams.find((item) => item.hallTeamId === hallTeamId); return team ? clone(team) : null; }
  function removeTeam(hallTeamId, options = {}) {
    if (indexedDbAuthority) throw failAsyncRequired("hall-remove");
    const archive = loadLegacyArchive();
    const teams = archive.teams.filter((item) => item.hallTeamId !== hallTeamId);
    return saveLegacyArchive({ ...archive, teams }, { ...options, hallTeamId, operation: "remove" });
  }
  function compactStoredArchive(options = {}) {
    if (indexedDbAuthority) return { archive: loadArchive(), beforeBytes: 0, afterBytes: 0, savedBytes: 0, skipped: true, reason: "indexeddb-authority" };
    const archive = loadLegacyArchive();
    const before = String(localStorage.getItem(STORAGE_KEY) || "").length * 2;
    const saved = saveLegacyArchive(archive, { ...options, operation: "compact", preserveTimestamp: true, suppressCloudEvent: true });
    const after = String(localStorage.getItem(STORAGE_KEY) || "").length * 2;
    return { archive: saved, beforeBytes: before, afterBytes: after, savedBytes: Math.max(0, before - after) };
  }

  function installPermanentEffectsBridge() {
    if (permanentEffectsBridgeInstalled || !global.PermanentEffects?.resumeFinalization) return;
    const base = global.PermanentEffects;
    const baseResumeFinalization = base.resumeFinalization.bind(base);
    const baseRunSave = global.RunState?.save?.bind(global.RunState);
    if (!baseRunSave) return;

    async function applyPendingHall(run, options = {}) {
      const hallType = base.TYPES?.HALL || "hall-champion";
      const effect = (run.permanentEffectOutbox || []).find((entry) => entry.type === hallType && entry.status === "pending");
      if (!effect) return { applied: false, reason: "hall-effect-missing" };
      const outcome = await addChampionAsync(effect.payload?.snapshot || {}, { source: "hall-permanent-effect" });
      if (outcome?.persisted !== true) {
        const details = outcome?.error || {};
        throw Object.assign(new Error(details.message || "Hall effect remains pending"), { name: details.name || "Error", code: details.code || "hall-finalization-failed", stage: details.stage || "hall-finalization", problemSector: details.problemSector || "hall_index" });
      }
      const markerBefore = { status: effect.status, appliedAt: effect.appliedAt, hallTeamId: run.hallTeamId, finalizationStatus: run.finalization?.status, finalizationHallTeamId: run.finalization?.hallTeamId };
      effect.status = "applied";
      effect.appliedAt = nowIso();
      run.hallTeamId = outcome.team?.hallTeamId || effect.payload?.snapshot?.hallTeamId;
      if (run.finalization) { run.finalization.status = "hall-written"; run.finalization.hallTeamId = run.hallTeamId; }
      try { baseRunSave(run, { effectMarker: effect.id, source: "hall-indexeddb-effect-marker" }); }
      catch (error) {
        effect.status = markerBefore.status; effect.appliedAt = markerBefore.appliedAt;
        if (markerBefore.hallTeamId === undefined) delete run.hallTeamId; else run.hallTeamId = markerBefore.hallTeamId;
        if (run.finalization) { run.finalization.status = markerBefore.finalizationStatus; if (markerBefore.finalizationHallTeamId === undefined) delete run.finalization.hallTeamId; else run.finalization.hallTeamId = markerBefore.finalizationHallTeamId; }
        throw error;
      }
      const payload = effect.payload, createdAt = effect.createdAt;
      delete effect.payload; delete effect.createdAt;
      try { baseRunSave(run, { effectCompaction: effect.id, source: "hall-indexeddb-effect-compaction" }); }
      catch (_) { effect.payload = payload; if (createdAt !== undefined) effect.createdAt = createdAt; }
      return { applied: true, team: outcome.team };
    }

    async function resumeFinalizationAsync(run, options = {}) {
      if (options.readOnly) return { run, status: "read-only", completed: false };
      if (run?.finalization?.status === "pending") {
        try { await applyPendingHall(run, options); }
        catch (error) { return { run, status: "pending", completed: false, error }; }
      }
      return baseResumeFinalization(run, options);
    }

    function resumeFinalization(run, options = {}) {
      if (!indexedDbAuthority || run?.finalization?.status !== "pending") return baseResumeFinalization(run, options);
      return resumeFinalizationAsync(run, options);
    }

    global.PermanentEffects = Object.freeze({ ...base, resumeFinalization, resumeFinalizationAsync });
    permanentEffectsBridgeInstalled = true;
  }

  if (typeof global.addEventListener === "function") {
    global.addEventListener("storage", (event) => {
      if (!indexedDbAuthority || event?.key !== global.PersistenceRecoveryGuard?.EPOCH_KEY) return;
      void refreshIndexedDbArchive().catch((error) => console.warn("Hall IndexedDB cross-tab refresh failed", error?.code || error));
    });
  }

  global.HallOfFameStorage = {
    STORAGE_KEY, BACKUP_KEY, TEMP_KEY, ARCHIVE_SCHEMA_VERSION,
    IDB_STORE, IDB_STATE_KEY, IDB_MIGRATION_KEY, IDB_MIGRATION_SCHEMA_VERSION,
    archiveKeyFor, stableId, addChampion, addChampionAsync, listTeams, listSummaries, getTeam, removeTeam, removeTeamAsync, calculateAwards, compactStoredArchive,
    ensureIndexedDbReady, refreshIndexedDbArchive, isIndexedDbAuthority: () => indexedDbAuthority,
    _loadArchive: loadArchive,
    _loadLegacyArchive: loadLegacyArchive,
    _saveArchive: (archive, options = {}) => indexedDbAuthority ? saveIndexedDbArchive(archive, options) : saveLegacyArchive(archive, options),
    _saveArchiveAsync: saveIndexedDbArchive,
    _compactTeam: compactTeam,
    _serializeArchive: serializeArchive,
    _sanitizeArchive: sanitizeArchive,
    _mergeForInterruptedMigration: mergeForInterruptedMigration,
  };
})(globalThis);
