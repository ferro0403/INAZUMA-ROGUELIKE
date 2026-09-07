(function (global) {
  "use strict";

  const STORAGE_KEY = "inazumaRoguelike.albumProgress";
  const SCHEMA_VERSION = 2;
  const DEFAULT_COLLECTION_ID = "ie1";
  const ALBUM_COLLECTIONS = {
    ie1: {
      id: "ie1",
      name: "Inazuma Eleven 1",
      seasonId: "ie1",
      freeAgentsTeamId: "unaffiliated",
      coverUrl: "https://static.wikia.nocookie.net/inazuma-eleven/images/5/51/FF_%28Ares_Logo%29.png/revision/latest?cb=20190424144108",
    },
    ie2: {
      id: "ie2",
      name: "Inazuma Eleven Ares",
      seasonId: "ie2",
      freeAgentsTeamId: "unaffiliated",
      coverUrl: "https://static.wikia.nocookie.net/inazuma-eleven/images/4/45/Minodouzan_emblem.png/revision/latest?cb=20251118125410",
    },
    ie1_s2: {
      id: "ie1_s2",
      name: "Inazuma Eleven 2",
      seasonId: "ie1_s2",
      freeAgentsTeamId: "unaffiliated",
      coverUrl: "/assets/icons/icon-512.png",
    },
    ie1_s3: {
      id: "ie1_s3",
      name: "Inazuma Eleven 3",
      seasonId: "ie1_s3",
      freeAgentsTeamId: "unaffiliated",
      coverUrl: "/assets/icons/icon-512.png",
    },
    orion: {
      id: "orion",
      name: "Inazuma Eleven Orion",
      seasonId: "orion",
      freeAgentsTeamId: "unaffiliated",
      coverUrl: "https://i0.wp.com/nicolaraccasceneggiature.altervista.org/wp-content/uploads/2019/05/Dlhck3sVAAA2Lgd-1.jpg?fit=1200%2C896&ssl=1",
    },
  };
  let freeAgentIds = new Set();

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso() { return new Date().toISOString(); }
  function emptyProgress() { return { schemaVersion: SCHEMA_VERSION, sharedUnlockedPlayerIds: {}, collections: {} }; }
  function collectionEntry(progress, collectionId) {
    const id = String(collectionId || DEFAULT_COLLECTION_ID);
    progress.collections[id] = progress.collections[id] && typeof progress.collections[id] === "object" ? progress.collections[id] : { unlockedPlayerIds: {} };
    progress.collections[id].unlockedPlayerIds = progress.collections[id].unlockedPlayerIds && typeof progress.collections[id].unlockedPlayerIds === "object" ? progress.collections[id].unlockedPlayerIds : {};
    return progress.collections[id];
  }
  function expandSharedUnlocks(progress) {
    const shared = progress.sharedUnlockedPlayerIds || {};
    Object.keys(ALBUM_COLLECTIONS).forEach((collectionId) => {
      const entry = collectionEntry(progress, collectionId);
      Object.entries(shared).forEach(([playerId, record]) => { entry.unlockedPlayerIds[playerId] ||= { ...record }; });
    });
    return progress;
  }
  function normalizeProgress(raw) {
    const progress = raw && typeof raw === "object" ? raw : emptyProgress();
    progress.schemaVersion = SCHEMA_VERSION;
    progress.sharedUnlockedPlayerIds = progress.sharedUnlockedPlayerIds && typeof progress.sharedUnlockedPlayerIds === "object" ? progress.sharedUnlockedPlayerIds : {};
    progress.collections = progress.collections && typeof progress.collections === "object" ? progress.collections : {};
    Object.values(ALBUM_COLLECTIONS).forEach((collection) => {
      const entry = progress.collections[collection.id] && typeof progress.collections[collection.id] === "object" ? progress.collections[collection.id] : {};
      entry.unlockedPlayerIds = entry.unlockedPlayerIds && typeof entry.unlockedPlayerIds === "object" ? entry.unlockedPlayerIds : {};
      progress.collections[collection.id] = entry;
    });
    expandSharedUnlocks(progress);
    syncFreeAgentUnlocks(progress);
    return progress;
  }
  function canonicalUnlockRecord(records) {
    return records.filter(Boolean).slice().sort((a, b) => String(a.firstUnlockedAt || "").localeCompare(String(b.firstUnlockedAt || "")))[0] || null;
  }
  function syncFreeAgentUnlocks(progress) {
    if (!freeAgentIds.size) return 0;
    const entries = Object.keys(ALBUM_COLLECTIONS).map((id) => collectionEntry(progress, id));
    let changed = 0;
    freeAgentIds.forEach((playerId) => {
      const canonical = canonicalUnlockRecord([progress.sharedUnlockedPlayerIds[playerId], ...entries.map((entry) => entry.unlockedPlayerIds[playerId])]);
      if (!canonical) return;
      if (!progress.sharedUnlockedPlayerIds[playerId]) { progress.sharedUnlockedPlayerIds[playerId] = { ...canonical }; changed += 1; }
      entries.forEach((entry) => {
        if (!entry.unlockedPlayerIds[playerId]) { entry.unlockedPlayerIds[playerId] = { ...canonical }; changed += 1; }
      });
    });
    return changed;
  }
  function storageProgress(input) {
    const progress = normalizeProgress(clone(input));
    const stored = clone(progress);
    stored.schemaVersion = SCHEMA_VERSION;
    stored.sharedUnlockedPlayerIds = stored.sharedUnlockedPlayerIds || {};
    freeAgentIds.forEach((playerId) => {
      const canonical = canonicalUnlockRecord([
        stored.sharedUnlockedPlayerIds[playerId],
        ...Object.keys(ALBUM_COLLECTIONS).map((collectionId) => stored.collections?.[collectionId]?.unlockedPlayerIds?.[playerId]),
      ]);
      if (!canonical) return;
      stored.sharedUnlockedPlayerIds[playerId] = { ...canonical };
      Object.keys(ALBUM_COLLECTIONS).forEach((collectionId) => { delete stored.collections[collectionId].unlockedPlayerIds[playerId]; });
    });
    return stored;
  }
  function configureFreeAgentIds(playerIds, options = {}) {
    freeAgentIds = new Set(Array.from(playerIds || [], (id) => String(id || "")).filter(Boolean));
    const persist = options.persist ?? !global.PersistenceRecoveryGuard?.isBlocked?.();
    if (!persist) return freeAgentIds.size;
    const progress = readStorage();
    writeStorage(progress, { suppressCloudEvent: true, operation: "compact" });
    return freeAgentIds.size;
  }
  function readStorage() {
    try { return normalizeProgress(JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || "null")); }
    catch (error) { if (error?.name === "SecurityError") throw Object.assign(new Error("storage-access-error"), { code: "storage-access-error", stage: "album-read", cause: error }); return normalizeProgress(null); }
  }
  function writeStorage(progress, options = {}) {
    global.PersistenceRecoveryGuard?.assertWritable(options);
    global.PersistenceRecoveryGuard?.reserve(options);
    global.PersistenceRecoveryGuard?.assertWritable(options);
    const stored = storageProgress(progress);
    global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(stored));
    if (!options.suppressCloudEvent && typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("inazuma:local-save-committed", { detail: { sector: "album", seasonId: null, hallTeamId: null, operation: options.operation || "write", source: "gameplay" } }));
    return normalizeProgress(clone(stored));
  }
  function unlockAlbumPlayer(collectionId, playerId, metadata = {}) {
    const id = String(playerId || "");
    if (!id) return false;
    const progress = readStorage();
    const collection = collectionEntry(progress, collectionId);
    if (collection.unlockedPlayerIds[id]) return false;
    const record = { firstUnlockedAt: metadata.firstUnlockedAt || nowIso(), firstSource: metadata.firstSource || metadata.source || "unknown" };
    const targets = freeAgentIds.has(id) ? Object.keys(ALBUM_COLLECTIONS) : [String(collectionId || DEFAULT_COLLECTION_ID)];
    if (freeAgentIds.has(id)) progress.sharedUnlockedPlayerIds[id] ||= { ...record };
    targets.forEach((targetId) => { collectionEntry(progress, targetId).unlockedPlayerIds[id] ||= { ...record }; });
    writeStorage(progress);
    return true;
  }
  function unlockAlbumPlayers(collectionId, playerIds, metadata = {}) {
    const progress = readStorage(); const collection = collectionEntry(progress, collectionId); let changed = 0; const unlockedAt = metadata.firstUnlockedAt || nowIso();
    (Array.isArray(playerIds) ? playerIds : []).forEach((playerId) => {
      const id = String(playerId || "");
      if (!id || collection.unlockedPlayerIds[id]) return;
      const record = { firstUnlockedAt: unlockedAt, firstSource: metadata.firstSource || metadata.source || "unknown" };
      const targets = freeAgentIds.has(id) ? Object.keys(ALBUM_COLLECTIONS) : [String(collectionId || DEFAULT_COLLECTION_ID)];
      if (freeAgentIds.has(id)) progress.sharedUnlockedPlayerIds[id] ||= { ...record };
      targets.forEach((targetId) => { collectionEntry(progress, targetId).unlockedPlayerIds[id] ||= { ...record }; });
      changed += 1;
    });
    if (changed) writeStorage(progress);
    return changed;
  }
  function isAlbumPlayerUnlocked(collectionId, playerId, progress = readStorage()) {
    return !!collectionEntry(progress, collectionId).unlockedPlayerIds[String(playerId || "")];
  }
  function unlockedSet(collectionId, progress = readStorage()) { return new Set(Object.keys(collectionEntry(progress, collectionId).unlockedPlayerIds)); }
  function collectIdsFromRun(run) {
    const ids = new Set();
    (run?.roster || []).forEach((entry) => ids.add(String(entry.playerId || entry.id || "")));
    (run?.lineup || []).forEach((id) => ids.add(String(id || "")));
    (run?.bench || []).forEach((id) => ids.add(String(id || "")));
    Object.values(run?.fiveVFive?.assignments || {}).forEach((id) => ids.add(String(id || "")));
    return [...ids].filter(Boolean);
  }
  function collectIdsFromHallTeam(team) {
    const ids = new Set();
    [team?.fullRoster, team?.finalStartingEleven, team?.bench].forEach((list) => (list || []).forEach((p) => ids.add(String(p?.playerId || p?.id || ""))));
    Object.values(team?.savedFiveVFiveFormation?.assignments || {}).forEach((id) => ids.add(String(id || "")));
    return [...ids].filter(Boolean);
  }
  function backfillAlbumProgress({ run = null, hallTeams = [] } = {}) {
    let changed = 0;
    changed += unlockAlbumPlayers(run?.seasonId || DEFAULT_COLLECTION_ID, collectIdsFromRun(run), { source: "backfill-run" });
    (Array.isArray(hallTeams) ? hallTeams : []).forEach((team) => { changed += unlockAlbumPlayers(team?.seasonId || DEFAULT_COLLECTION_ID, collectIdsFromHallTeam(team), { source: "backfill-hall-of-fame" }); });
    return changed;
  }
  function compactStoredProgress(options = {}) {
    const before = String(global.localStorage?.getItem(STORAGE_KEY) || "").length * 2;
    const state = writeStorage(readStorage(), { ...options, suppressCloudEvent: true, operation: "compact" });
    const after = String(global.localStorage?.getItem(STORAGE_KEY) || "").length * 2;
    return { state, beforeBytes: before, afterBytes: after, savedBytes: Math.max(0, before - after) };
  }
  const api = { STORAGE_KEY, SCHEMA_VERSION, DEFAULT_COLLECTION_ID, ALBUM_COLLECTIONS, read: readStorage, write: writeStorage, configureFreeAgentIds, unlockAlbumPlayer, unlockAlbumPlayers, isAlbumPlayerUnlocked, unlockedSet, backfillAlbumProgress, collectIdsFromRun, collectIdsFromHallTeam, compactStoredProgress, _storageProgress: storageProgress };
  global.AlbumProgress = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
