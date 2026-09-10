(function (global) {
  "use strict";

  const SENTINEL_KEY = "inazuma.permanentIndexedDbCleanup.v1";
  const SCHEMA_VERSION = 1;
  const DOMAINS = Object.freeze(["album", "hall", "development"]);
  const nowIso = () => new Date().toISOString();

  function safeParse(raw, fallback = null) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }

  function readSentinel() {
    try {
      const parsed = safeParse(global.localStorage?.getItem(SENTINEL_KEY), null);
      if (!parsed || Number(parsed.schemaVersion) !== SCHEMA_VERSION || !parsed.domains || typeof parsed.domains !== "object") {
        return { schemaVersion: SCHEMA_VERSION, domains: {} };
      }
      return { schemaVersion: SCHEMA_VERSION, domains: { ...parsed.domains } };
    } catch (_) {
      return { schemaVersion: SCHEMA_VERSION, domains: {} };
    }
  }

  function wasCleaned(domain) {
    const name = String(domain || "");
    return DOMAINS.includes(name) && readSentinel().domains?.[name]?.cleaned === true;
  }

  function descriptor(domain) {
    if (domain === "album") {
      const repository = global.AlbumIndexedDbStorage;
      return {
        domain,
        authority: repository?.isAuthority?.() === true,
        markerKey: repository?.MIGRATION_KEY,
        store: repository?.STORE || "album",
        stateKey: repository?.STATE_KEY || "state",
        legacyKeys: [global.AlbumProgress?.STORAGE_KEY || "inazumaRoguelike.albumProgress"],
      };
    }
    if (domain === "hall") {
      const repository = global.HallOfFameStorage;
      return {
        domain,
        authority: repository?.isIndexedDbAuthority?.() === true,
        markerKey: repository?.IDB_MIGRATION_KEY,
        store: repository?.IDB_STORE || "hall",
        stateKey: repository?.IDB_STATE_KEY || "state",
        legacyKeys: [
          repository?.BACKUP_KEY || "inazuma.hallOfFame.v1.backup",
          repository?.TEMP_KEY || "inazuma.hallOfFame.v1.tmp",
          repository?.STORAGE_KEY || "inazuma.hallOfFame.v1",
        ],
      };
    }
    if (domain === "development") {
      const repository = global.DevelopmentIndexedDbStorage;
      return {
        domain,
        authority: repository?.isAuthority?.() === true,
        markerKey: repository?.MIGRATION_KEY,
        store: repository?.STORE || "development",
        stateKey: repository?.STATE_KEY || "state",
        legacyKeys: [global.DevelopmentV2?.STORAGE_KEY || "inazumaRoguelike.developmentV2"],
      };
    }
    return null;
  }

  function measuredBytes(keys) {
    let total = 0;
    for (const key of keys || []) {
      try {
        const value = global.localStorage?.getItem(key);
        if (value != null) total += 2 * (String(key).length + String(value).length);
      } catch (_) {}
    }
    return total;
  }

  function authorityUnavailable(domain, cause = null) {
    return Object.assign(new Error(`IndexedDB richiesto dopo cleanup legacy: ${domain}`), {
      code: `${domain}-indexeddb-authority-unavailable`,
      stage: `${domain}-legacy-cleanup-certification`,
      problemSector: domain === "hall" ? "hall_index" : domain,
      cause,
      recoverable: true,
    });
  }

  async function certify(domain) {
    const item = descriptor(domain);
    if (!item) return { ok: false, certified: false, reason: "unknown-domain", domain };
    if (global.PersistenceRecoveryGuard?.isBlocked?.()) return { ok: false, certified: false, reason: "restore-recovery-required", domain };
    if (!item.authority) return { ok: false, certified: false, reason: "indexeddb-not-authority", domain };
    if (!item.markerKey || !global.PermanentIndexedDb?.read) return { ok: false, certified: false, reason: "indexeddb-certification-unavailable", domain };
    try {
      const marker = await global.PermanentIndexedDb.read("meta", item.markerKey);
      if (marker?.complete !== true) return { ok: false, certified: false, reason: "migration-marker-incomplete", domain };
      const record = await global.PermanentIndexedDb.read(item.store, item.stateKey);
      if (record == null) return { ok: false, certified: false, reason: "indexeddb-record-missing", domain };
      return { ok: true, certified: true, domain, item, marker };
    } catch (error) {
      return { ok: false, certified: false, reason: error?.code || "indexeddb-certification-failed", domain, error };
    }
  }

  function markCleaned(domain) {
    if (wasCleaned(domain)) return readSentinel();
    const current = readSentinel();
    const next = {
      schemaVersion: SCHEMA_VERSION,
      domains: {
        ...(current.domains || {}),
        [domain]: { cleaned: true, cleanedAt: nowIso() },
      },
    };
    global.localStorage?.setItem(SENTINEL_KEY, JSON.stringify(next));
    const verified = readSentinel();
    if (verified.domains?.[domain]?.cleaned !== true) {
      throw Object.assign(new Error(`Sentinel cleanup non verificato: ${domain}`), {
        code: "legacy-cleanup-sentinel-verification-failed",
        stage: `${domain}-legacy-cleanup-sentinel`,
      });
    }
    return verified;
  }

  function removeLegacyKeys(item) {
    const removed = [];
    const absent = [];
    const beforeBytes = measuredBytes(item.legacyKeys);
    for (const key of item.legacyKeys) {
      const present = global.localStorage?.getItem(key) != null;
      if (!present) { absent.push(key); continue; }
      global.localStorage.removeItem(key);
      if (global.localStorage.getItem(key) != null) {
        throw Object.assign(new Error(`Chiave legacy non rimossa: ${key}`), {
          code: "legacy-cleanup-remove-verification-failed",
          stage: `${item.domain}-legacy-cleanup-remove`,
          key,
        });
      }
      removed.push(key);
    }
    return { removed, absent, beforeBytes, afterBytes: measuredBytes(item.legacyKeys) };
  }

  async function cleanupDomain(domain) {
    const certification = await certify(domain);
    if (!certification.certified) return { ok: true, cleaned: false, skipped: true, domain, reason: certification.reason, error: certification.error || null };
    if (global.PersistenceRecoveryGuard?.isBlocked?.()) return { ok: true, cleaned: false, skipped: true, domain, reason: "restore-recovery-required" };
    try {
      markCleaned(domain);
      const removal = removeLegacyKeys(certification.item);
      return {
        ok: true,
        cleaned: removal.removed.length > 0,
        skipped: false,
        domain,
        removed: removal.removed,
        alreadyAbsent: removal.absent,
        bytesFreed: Math.max(0, removal.beforeBytes - removal.afterBytes),
        sentinel: true,
      };
    } catch (error) {
      return { ok: false, cleaned: false, skipped: false, domain, reason: error?.code || "legacy-cleanup-failed", error };
    }
  }

  async function cleanup() {
    if (global.PersistenceRecoveryGuard?.isBlocked?.()) {
      return { ok: true, skipped: true, reason: "restore-recovery-required", bytesFreed: 0, domains: [] };
    }
    const domains = [];
    for (const domain of DOMAINS) domains.push(await cleanupDomain(domain));
    const result = {
      ok: domains.every((entry) => entry.ok !== false),
      skipped: domains.every((entry) => entry.skipped === true),
      bytesFreed: domains.reduce((sum, entry) => sum + Number(entry.bytesFreed || 0), 0),
      domains,
      sentinel: readSentinel(),
    };
    global.__INAZUMA_PERMANENT_LEGACY_CLEANUP_RESULT__ = result;
    return result;
  }

  const api = Object.freeze({
    SENTINEL_KEY,
    SCHEMA_VERSION,
    DOMAINS,
    readSentinel,
    wasCleaned,
    certify,
    cleanupDomain,
    cleanup,
    authorityUnavailable,
    _descriptor: descriptor,
    _measuredBytes: measuredBytes,
  });

  global.PermanentLegacyCleanup = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
