(function (global) {
  "use strict";

  let ran = false;

  function rawSchemaVersion(key) {
    try {
      const raw = global.localStorage?.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Number(parsed?.schemaVersion || 0) || 0;
    } catch (_) { return null; }
  }

  function compactHallIfLegacy() {
    const api = global.HallOfFameStorage;
    if (!api?.compactStoredArchive) return { ok: true, compacted: false, reason: "hall-unavailable" };
    const version = rawSchemaVersion(api.STORAGE_KEY);
    if (version == null || version >= Number(api.ARCHIVE_SCHEMA_VERSION || 0)) return { ok: true, compacted: false, reason: version == null ? "hall-empty" : "hall-current" };
    try {
      const result = api.compactStoredArchive({ source: "hall-schema-compaction" });
      return { ok: true, compacted: true, ...result };
    } catch (error) {
      return { ok: false, compacted: false, reason: "hall-compaction-failed", error };
    }
  }

  function compactAlbumIfLegacy() {
    const api = global.AlbumProgress;
    if (!api?.compactStoredProgress) return { ok: true, compacted: false, reason: "album-unavailable" };
    const version = rawSchemaVersion(api.STORAGE_KEY);
    if (version == null || version >= Number(api.SCHEMA_VERSION || 0)) return { ok: true, compacted: false, reason: version == null ? "album-empty" : "album-current" };
    try {
      const result = api.compactStoredProgress({ source: "album-schema-compaction" });
      return { ok: true, compacted: true, ...result };
    } catch (error) {
      return { ok: false, compacted: false, reason: "album-compaction-failed", error };
    }
  }

  function runOnce(options = {}) {
    if (ran && !options.force) return { ok: true, skipped: true, reason: "already-ran" };
    if (global.PersistenceRecoveryGuard?.isBlocked?.()) return { ok: false, skipped: true, reason: "restore-recovery-required" };
    ran = true;
    const hall = compactHallIfLegacy();
    const album = compactAlbumIfLegacy();
    const terminalRuns = global.TerminalRunCleanup?.cleanupStored?.({ source: "home-terminal-cleanup", excludeRunId: options.excludeRunId || null }) || [];
    return {
      ok: hall.ok !== false && album.ok !== false && terminalRuns.every((entry) => entry.ok !== false),
      skipped: false,
      hall,
      album,
      terminalRuns,
    };
  }

  global.PermanentStorageMaintenance = Object.freeze({ runOnce, compactHallIfLegacy, compactAlbumIfLegacy, _rawSchemaVersion: rawSchemaVersion });
})(globalThis);
