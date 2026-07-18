(function (global) {
  "use strict";

  const STORAGE_KEY = "inazumaRoguelike.albumProgress";
  const SCHEMA_VERSION = 1;
  const DEFAULT_COLLECTION_ID = "ie1";
  const ALBUM_COLLECTIONS = {
    ie1: { id: "ie1", name: "Inazuma Eleven 1", seasonId: "season1", freeAgentsTeamId: "unaffiliated" },
  };

  function nowIso() { return new Date().toISOString(); }
  function emptyProgress() { return { schemaVersion: SCHEMA_VERSION, collections: {} }; }
  function normalizeProgress(raw) {
    const progress = raw && typeof raw === "object" ? raw : emptyProgress();
    progress.schemaVersion = SCHEMA_VERSION;
    progress.collections = progress.collections && typeof progress.collections === "object" ? progress.collections : {};
    Object.values(ALBUM_COLLECTIONS).forEach((collection) => {
      const entry = progress.collections[collection.id] && typeof progress.collections[collection.id] === "object" ? progress.collections[collection.id] : {};
      entry.unlockedPlayerIds = entry.unlockedPlayerIds && typeof entry.unlockedPlayerIds === "object" ? entry.unlockedPlayerIds : {};
      progress.collections[collection.id] = entry;
    });
    return progress;
  }
  function readStorage() {
    try { return normalizeProgress(JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || "null")); }
    catch (_) { return normalizeProgress(null); }
  }
  function writeStorage(progress) { global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalizeProgress(progress))); }
  function collectionEntry(progress, collectionId) {
    const id = String(collectionId || DEFAULT_COLLECTION_ID);
    progress.collections[id] = progress.collections[id] && typeof progress.collections[id] === "object" ? progress.collections[id] : { unlockedPlayerIds: {} };
    progress.collections[id].unlockedPlayerIds = progress.collections[id].unlockedPlayerIds && typeof progress.collections[id].unlockedPlayerIds === "object" ? progress.collections[id].unlockedPlayerIds : {};
    return progress.collections[id];
  }
  function unlockAlbumPlayer(collectionId, playerId, metadata = {}) {
    const id = String(playerId || "");
    if (!id) return false;
    const progress = readStorage();
    const collection = collectionEntry(progress, collectionId);
    if (collection.unlockedPlayerIds[id]) return false;
    collection.unlockedPlayerIds[id] = { firstUnlockedAt: metadata.firstUnlockedAt || nowIso(), firstSource: metadata.firstSource || metadata.source || "unknown" };
    writeStorage(progress);
    return true;
  }
  function unlockAlbumPlayers(collectionId, playerIds, metadata = {}) {
    let changed = 0;
    (Array.isArray(playerIds) ? playerIds : []).forEach((id) => { if (unlockAlbumPlayer(collectionId, id, metadata)) changed += 1; });
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
    changed += unlockAlbumPlayers(DEFAULT_COLLECTION_ID, collectIdsFromRun(run), { source: "backfill-run" });
    (Array.isArray(hallTeams) ? hallTeams : []).forEach((team) => { changed += unlockAlbumPlayers(DEFAULT_COLLECTION_ID, collectIdsFromHallTeam(team), { source: "backfill-hall-of-fame" }); });
    return changed;
  }
  global.AlbumProgress = { STORAGE_KEY, SCHEMA_VERSION, DEFAULT_COLLECTION_ID, ALBUM_COLLECTIONS, read: readStorage, write: writeStorage, unlockAlbumPlayer, unlockAlbumPlayers, isAlbumPlayerUnlocked, unlockedSet, backfillAlbumProgress, collectIdsFromRun, collectIdsFromHallTeam };
})(globalThis);
