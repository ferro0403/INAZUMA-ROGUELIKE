(function (global) {
  "use strict";

  const STORE = "album";
  const STATE_KEY = "state";
  const MIGRATION_KEY = "migration:album:localstorage-to-indexeddb:v1";
  const MIGRATION_SCHEMA_VERSION = 1;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();

  const legacy = {
    read: global.AlbumProgress?.read?.bind(global.AlbumProgress),
    write: global.AlbumProgress?.write?.bind(global.AlbumProgress),
    configureFreeAgentIds: global.AlbumProgress?.configureFreeAgentIds?.bind(global.AlbumProgress),
    unlockAlbumPlayer: global.AlbumProgress?.unlockAlbumPlayer?.bind(global.AlbumProgress),
    unlockAlbumPlayers: global.AlbumProgress?.unlockAlbumPlayers?.bind(global.AlbumProgress),
    backfillAlbumProgress: global.AlbumProgress?.backfillAlbumProgress?.bind(global.AlbumProgress),
    compactStoredProgress: global.AlbumProgress?.compactStoredProgress?.bind(global.AlbumProgress),
    unlockedSet: global.AlbumProgress?.unlockedSet?.bind(global.AlbumProgress),
    isAlbumPlayerUnlocked: global.AlbumProgress?.isAlbumPlayerUnlocked?.bind(global.AlbumProgress),
  };

  let authority = "legacy";
  let cache = null;
  let readyPromise = null;
  let facadeInstalled = false;

  function albumApi() {
    if (!global.AlbumProgress || !legacy.read) {
      throw Object.assign(new Error("AlbumProgress non disponibile"), {
        code: "album-storage-api-unavailable",
        stage: "album-indexeddb-bootstrap",
      });
    }
    return global.AlbumProgress;
  }

  function db() {
    if (!global.PermanentIndexedDb) {
      throw Object.assign(new Error("PermanentIndexedDb non disponibile"), {
        code: "indexeddb-unavailable",
        stage: "album-indexeddb-bootstrap",
      });
    }
    return global.PermanentIndexedDb;
  }

  function emptyProgress() {
    return { schemaVersion: Number(albumApi().SCHEMA_VERSION || 2), sharedUnlockedPlayerIds: {}, collections: {} };
  }

  function collectionIds() {
    return Object.keys(albumApi().ALBUM_COLLECTIONS || {});
  }

  function normalizeRecord(record) {
    if (!record || typeof record !== "object") return null;
    return {
      firstUnlockedAt: record.firstUnlockedAt || null,
      firstSource: record.firstSource || record.source || "unknown",
    };
  }

  function chooseRecord(a, b) {
    const left = normalizeRecord(a);
    const right = normalizeRecord(b);
    if (!left) return right;
    if (!right) return left;
    const leftTime = Date.parse(left.firstUnlockedAt || "") || Number.MAX_SAFE_INTEGER;
    const rightTime = Date.parse(right.firstUnlockedAt || "") || Number.MAX_SAFE_INTEGER;
    return clone(leftTime <= rightTime ? left : right);
  }

  function materialize(raw) {
    const source = raw && typeof raw === "object" ? clone(raw) : emptyProgress();
    if (Number(source.schemaVersion || albumApi().SCHEMA_VERSION) > Number(albumApi().SCHEMA_VERSION || 2)) {
      throw Object.assign(new Error("Versione Album IndexedDB non supportata"), {
        code: "album-indexeddb-unsupported-schema",
        stage: "album-indexeddb-validate",
      });
    }
    const progress = emptyProgress();
    progress.sharedUnlockedPlayerIds = source.sharedUnlockedPlayerIds && typeof source.sharedUnlockedPlayerIds === "object"
      ? clone(source.sharedUnlockedPlayerIds)
      : {};
    const sourceCollections = source.collections && typeof source.collections === "object" ? source.collections : {};
    const ids = new Set([...collectionIds(), ...Object.keys(sourceCollections)]);
    ids.forEach((collectionId) => {
      const unlocked = sourceCollections[collectionId]?.unlockedPlayerIds;
      progress.collections[collectionId] = {
        unlockedPlayerIds: unlocked && typeof unlocked === "object" ? clone(unlocked) : {},
      };
    });
    for (const collectionId of collectionIds()) {
      progress.collections[collectionId] ||= { unlockedPlayerIds: {} };
      const target = progress.collections[collectionId].unlockedPlayerIds;
      Object.entries(progress.sharedUnlockedPlayerIds).forEach(([playerId, record]) => {
        target[playerId] = chooseRecord(target[playerId], record);
      });
    }
    return progress;
  }

  function compact(progress) {
    const api = albumApi();
    const normalized = materialize(progress);
    if (typeof api._storageProgress === "function") return api._storageProgress(normalized);
    return normalized;
  }

  function stable(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
    if (typeof value === "number") return JSON.stringify(Number.isFinite(value) ? value : null);
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    }
    return "null";
  }

  function validateStored(raw) {
    return materialize(raw);
  }

  function mergeProgress(...values) {
    const merged = emptyProgress();
    values.filter(Boolean).forEach((value) => {
      const current = materialize(value);
      Object.entries(current.sharedUnlockedPlayerIds || {}).forEach(([playerId, record]) => {
        merged.sharedUnlockedPlayerIds[playerId] = chooseRecord(merged.sharedUnlockedPlayerIds[playerId], record);
      });
      Object.entries(current.collections || {}).forEach(([collectionId, collection]) => {
        merged.collections[collectionId] ||= { unlockedPlayerIds: {} };
        Object.entries(collection?.unlockedPlayerIds || {}).forEach(([playerId, record]) => {
          const target = merged.collections[collectionId].unlockedPlayerIds;
          target[playerId] = chooseRecord(target[playerId], record);
        });
      });
    });
    return materialize(merged);
  }

  function addUnlock(progress, collectionId, playerId, metadata = {}) {
    const id = String(playerId || "");
    if (!id) return false;
    const collection = String(collectionId || albumApi().DEFAULT_COLLECTION_ID || "ie1");
    progress.collections[collection] ||= { unlockedPlayerIds: {} };
    const target = progress.collections[collection].unlockedPlayerIds;
    if (target[id]) return false;
    target[id] = {
      firstUnlockedAt: metadata.firstUnlockedAt || nowIso(),
      firstSource: metadata.firstSource || metadata.source || "unknown",
    };
    return true;
  }

  function backfillInto(progress) {
    const api = albumApi();
    const stamp = nowIso();
    try {
      (global.SeasonRegistry?.list?.() || []).forEach((season) => {
        let run = null;
        try { run = global.RunState?.load?.(season.id, { readOnly: true }) || null; } catch (_) {}
        (api.collectIdsFromRun?.(run) || []).forEach((playerId) => {
          addUnlock(progress, run?.seasonId || season.id || api.DEFAULT_COLLECTION_ID, playerId, { firstUnlockedAt: stamp, source: "backfill-run" });
        });
      });
    } catch (_) {}
    try {
      (global.HallOfFameStorage?.listSummaries?.() || []).forEach((summary) => {
        const team = global.HallOfFameStorage?.getTeam?.(summary.hallTeamId);
        (api.collectIdsFromHallTeam?.(team) || []).forEach((playerId) => {
          addUnlock(progress, team?.seasonId || api.DEFAULT_COLLECTION_ID, playerId, { firstUnlockedAt: stamp, source: "backfill-hall-of-fame" });
        });
      });
    } catch (_) {}
    return progress;
  }

  function emitCommitted(operation, options = {}) {
    if (options.suppressCloudEvent) return;
    if (typeof global.dispatchEvent !== "function" || typeof global.CustomEvent !== "function") return;
    global.dispatchEvent(new global.CustomEvent("inazuma:local-save-committed", {
      detail: {
        domain: "account-permanent",
        sector: "album",
        seasonId: null,
        hallTeamId: null,
        operation,
        source: options.source || "gameplay",
      },
    }));
  }

  function guardMutation(options = {}) {
    global.PersistenceRecoveryGuard?.assertWritable?.(options);
    global.PersistenceRecoveryGuard?.reserve?.(options);
    global.PersistenceRecoveryGuard?.assertWritable?.(options);
  }

  function installFacade() {
    if (facadeInstalled) return;
    const api = albumApi();
    api.read = () => read();
    api.unlockedSet = (collectionId, progress = null) => {
      const state = progress ? materialize(progress) : read();
      return new Set(Object.keys(state.collections?.[String(collectionId || api.DEFAULT_COLLECTION_ID)]?.unlockedPlayerIds || {}));
    };
    api.isAlbumPlayerUnlocked = (collectionId, playerId, progress = null) => api.unlockedSet(collectionId, progress).has(String(playerId || ""));
    api.write = (progress, options = {}) => replace(progress, options);
    api.unlockAlbumPlayer = (collectionId, playerId, metadata = {}) => applyUnlock(collectionId, playerId, metadata);
    api.unlockAlbumPlayers = (collectionId, playerIds, metadata = {}) => applyUnlocks(collectionId, playerIds, metadata);
    api.backfillAlbumProgress = () => 0;
    api.compactStoredProgress = () => ({ state: read(), beforeBytes: 0, afterBytes: 0, savedBytes: 0, skipped: true, reason: "indexeddb-authority" });
    if (legacy.configureFreeAgentIds) {
      api.configureFreeAgentIds = (playerIds, options = {}) => legacy.configureFreeAgentIds(playerIds, { ...options, persist: false });
    }
    facadeInstalled = true;
  }

  function read() {
    if (authority !== "indexeddb" || !cache) return legacy.read();
    return clone(cache);
  }

  function isAuthority() {
    return authority === "indexeddb";
  }

  async function refresh() {
    if (!isAuthority()) return read();
    const stored = await db().read(STORE, STATE_KEY);
    if (!stored) {
      throw Object.assign(new Error("Album IndexedDB authority priva dello stato"), {
        code: "album-indexeddb-authority-corrupt",
        stage: "album-indexeddb-refresh",
      });
    }
    cache = validateStored(stored);
    return clone(cache);
  }

  async function migrate() {
    let marker;
    try { marker = await db().read("meta", MIGRATION_KEY); }
    catch (error) {
      if (!isAuthority()) return { authority: "legacy", migrated: false, deferred: true, error };
      throw error;
    }

    if (marker?.complete === true) {
      const stored = await db().read(STORE, STATE_KEY);
      if (!stored) {
        throw Object.assign(new Error("Marker Album IndexedDB completo ma stato assente"), {
          code: "album-indexeddb-authority-corrupt",
          stage: "album-indexeddb-authority-read",
        });
      }
      cache = validateStored(stored);
      authority = "indexeddb";
      installFacade();
      return { authority, migrated: false, marker: clone(marker), state: clone(cache) };
    }

    if (global.PersistenceRecoveryGuard?.isBlocked?.()) {
      return { authority: "legacy", migrated: false, deferred: true, reason: "restore-recovery-required" };
    }

    global.PersistenceRecoveryGuard?.assertWritable?.();
    const legacyState = materialize(legacy.read());
    let previousCandidate = null;
    try { previousCandidate = await db().read(STORE, STATE_KEY); } catch (_) {}
    const merged = backfillInto(mergeProgress(legacyState, previousCandidate));
    const stored = compact(merged);
    const pending = { schemaVersion: MIGRATION_SCHEMA_VERSION, complete: false, startedAt: marker?.startedAt || nowIso(), source: "localStorage", legacyKey: albumApi().STORAGE_KEY };
    await db().write("meta", pending, MIGRATION_KEY);
    await db().write(STORE, stored, STATE_KEY);
    const readback = await db().read(STORE, STATE_KEY);
    const verified = validateStored(readback);
    if (stable(compact(verified)) !== stable(stored)) {
      throw Object.assign(new Error("Verifica migrazione Album IndexedDB fallita"), {
        code: "album-indexeddb-migration-verification-failed",
        stage: "album-indexeddb-migration-readback",
      });
    }
    const complete = { ...pending, complete: true, completedAt: nowIso(), albumSchemaVersion: Number(albumApi().SCHEMA_VERSION || 2) };
    await db().write("meta", complete, MIGRATION_KEY);
    const markerReadback = await db().read("meta", MIGRATION_KEY);
    if (markerReadback?.complete !== true) {
      throw Object.assign(new Error("Marker migrazione Album IndexedDB non verificato"), {
        code: "album-indexeddb-migration-marker-failed",
        stage: "album-indexeddb-migration-marker",
      });
    }
    cache = verified;
    authority = "indexeddb";
    installFacade();
    return { authority, migrated: true, marker: clone(markerReadback), state: clone(cache) };
  }

  async function ensureReady() {
    if (isAuthority() && cache) return { authority, migrated: false, state: clone(cache) };
    if (readyPromise) return readyPromise;
    readyPromise = migrate().catch((error) => {
      if (isAuthority()) throw error;
      const unavailable = ["indexeddb-unavailable", "indexeddb-open-failed", "indexeddb-open-blocked", "storage-access-error"].includes(error?.code);
      if (unavailable) return { authority: "legacy", migrated: false, deferred: true, error };
      throw error;
    }).finally(() => { readyPromise = null; });
    return readyPromise;
  }

  async function recompact() {
    if (!isAuthority()) return { authority: "legacy", compacted: false };
    let changed = false;
    const stored = await db().update(STORE, (current) => {
      const before = current || compact(cache || emptyProgress());
      const after = compact(materialize(before));
      changed = stable(before) !== stable(after);
      return after;
    }, STATE_KEY);
    cache = materialize(stored);
    return { authority, compacted: changed, state: clone(cache) };
  }

  async function replace(progress, options = {}) {
    if (!isAuthority()) return legacy.write(progress, options);
    const target = compact(materialize(progress));
    let changed = false;
    const stored = await db().update(STORE, (current) => {
      changed = stable(current || emptyProgress()) !== stable(target);
      if (changed) guardMutation(options);
      return target;
    }, STATE_KEY);
    cache = materialize(stored);
    if (changed) emitCommitted(options.operation || "write", options);
    return clone(cache);
  }

  async function applyUnlock(collectionId, playerId, metadata = {}) {
    if (!isAuthority()) return legacy.unlockAlbumPlayer(collectionId, playerId, metadata);
    let changed = false;
    const stored = await db().update(STORE, (current) => {
      const progress = materialize(current || cache || emptyProgress());
      changed = addUnlock(progress, collectionId, playerId, metadata);
      if (!changed) return compact(progress);
      guardMutation(metadata);
      return compact(progress);
    }, STATE_KEY);
    cache = materialize(stored);
    if (changed) emitCommitted(metadata.operation || "unlock", metadata);
    return changed;
  }

  async function applyUnlocks(collectionId, playerIds, metadata = {}) {
    if (!isAuthority()) return legacy.unlockAlbumPlayers(collectionId, playerIds, metadata);
    let changed = 0;
    const stored = await db().update(STORE, (current) => {
      const progress = materialize(current || cache || emptyProgress());
      const stamp = metadata.firstUnlockedAt || nowIso();
      for (const playerId of Array.isArray(playerIds) ? playerIds : []) {
        if (addUnlock(progress, collectionId, playerId, { ...metadata, firstUnlockedAt: stamp })) changed += 1;
      }
      if (changed) guardMutation(metadata);
      return compact(progress);
    }, STATE_KEY);
    cache = materialize(stored);
    if (changed) emitCommitted(metadata.operation || "unlock-many", metadata);
    return changed;
  }

  async function backfillFrom({ run = null, hallTeams = [] } = {}, options = {}) {
    if (!isAuthority()) return legacy.backfillAlbumProgress({ run, hallTeams });
    const api = albumApi();
    let changed = 0;
    const stored = await db().update(STORE, (current) => {
      const progress = materialize(current || cache || emptyProgress());
      const stamp = nowIso();
      (api.collectIdsFromRun?.(run) || []).forEach((playerId) => {
        if (addUnlock(progress, run?.seasonId || api.DEFAULT_COLLECTION_ID, playerId, { firstUnlockedAt: stamp, source: "backfill-run" })) changed += 1;
      });
      (Array.isArray(hallTeams) ? hallTeams : []).forEach((team) => {
        (api.collectIdsFromHallTeam?.(team) || []).forEach((playerId) => {
          if (addUnlock(progress, team?.seasonId || api.DEFAULT_COLLECTION_ID, playerId, { firstUnlockedAt: stamp, source: "backfill-hall-of-fame" })) changed += 1;
        });
      });
      if (changed) guardMutation(options);
      return compact(progress);
    }, STATE_KEY);
    cache = materialize(stored);
    if (changed) emitCommitted("backfill", options);
    return changed;
  }

  if (typeof global.addEventListener === "function") {
    global.addEventListener("storage", (event) => {
      if (!isAuthority() || event?.key !== global.PersistenceRecoveryGuard?.EPOCH_KEY) return;
      void refresh().catch((error) => console.warn("Album IndexedDB cross-tab refresh failed", error?.code || error));
    });
  }

  const api = Object.freeze({
    STORE,
    STATE_KEY,
    MIGRATION_KEY,
    MIGRATION_SCHEMA_VERSION,
    ensureReady,
    refresh,
    recompact,
    read,
    replace,
    applyUnlock,
    applyUnlocks,
    backfillFrom,
    isAuthority,
    _materialize: materialize,
    _compact: compact,
    _mergeProgress: mergeProgress,
    _legacy: legacy,
  });

  global.AlbumIndexedDbStorage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
