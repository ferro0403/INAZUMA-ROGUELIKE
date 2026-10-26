(function (global) {
  "use strict";

  // RTG persistence -> existing cloud sector adapter. This file contains
  // no Firestore calls and intentionally performs NO local writes.
  const ALBUM_KEY = "inazuma.rtg.album.v1";
  const RECORD_KEYS = Object.freeze(["state", "state:rtg-ares-orion", "shared:account"]);
  const RARITIES = Object.freeze(["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]);
  const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  function fail(code) { return Object.assign(new Error(code), { code }); }
  function albumRead(local) {
    let raw;
    try { raw = local.getItem(ALBUM_KEY); }
    catch (_) { throw fail("rtg-cloud-album-read-failed"); }
    if (raw == null) return { version: 1, cardIds: [] };
    let value;
    try { value = JSON.parse(raw); }
    catch (_) { throw fail("rtg-cloud-album-corrupt"); }
    if (!value || typeof value !== "object" || Array.isArray(value)
        || (value.version != null && value.version !== 1) || !Array.isArray(value.cardIds)) {
      throw fail("rtg-cloud-album-corrupt");
    }
    return value;
  }

  function recordWins(candidate, current) {
    if (!current) return true;
    const r = RARITIES.indexOf(String(candidate.currentRarity || ""));
    const old = RARITIES.indexOf(String(current.currentRarity || ""));
    if (r !== old) return r > old;
    if (candidate.targetPotential !== current.targetPotential) return candidate.targetPotential > current.targetPotential;
    if (candidate.evolutionCount !== current.evolutionCount) return candidate.evolutionCount > current.evolutionCount;
    return String(candidate.updatedAt || "") > String(current.updatedAt || "");
  }
  function developmentRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const { targetPotential, currentRarity } = value;
    const evolutionCount = owns(value, "evolutionCount") ? value.evolutionCount : 0;
    const updatedAt = owns(value, "updatedAt") ? value.updatedAt : null;
    if (!Number.isSafeInteger(targetPotential) || targetPotential < 1 || targetPotential > 99
        || !RARITIES.includes(currentRarity) || !Number.isSafeInteger(evolutionCount) || evolutionCount < 0
        || (updatedAt !== null && typeof updatedAt !== "string")) return null;
    return {
      ...value, targetPotential, currentRarity, evolutionCount, updatedAt,
    };
  }

  // Only absent fields introduced after the first saves get defaults. Do not
  // call State.normalize/validate: those coerce corrupt counters and rewrite
  // squads. This view never changes a persisted record or schema version.
  function legacyCampaign(source) {
    if (source == null || typeof source !== "object" || Array.isArray(source)) return source;
    const defaults = {
      projects: { Buono: 0, Forte: 0, Elite: 0, Mondiale: 0, Leggenda: 0, Aurico: 0 },
      seasonTransitionRewardedIds: [], coachPullCount: 0,
    };
    let result = source;
    for (const [field, value] of Object.entries(defaults)) {
      if (!owns(source, field)) {
        if (result === source) result = { ...source };
        result[field] = value;
      }
    }
    return result;
  }

  // Legacy versions stored player development in individual campaigns. This
  // reconstruction matches RTG repository's winner policy but never migrates.
  function reconstructShared(records, projector) {
    const trilogy = records.state;
    const ares = records["state:rtg-ares-orion"];
    const original = records["shared:account"];
    if (original == null && trilogy == null && ares == null) return null;
    if (original != null && (typeof original !== "object" || Array.isArray(original))) {
      throw fail("rtg-cloud-shared-corrupt");
    }
    const fallback = trilogy || ares || {};
    const shared = original ?? fallback;
    const winner = Object.create(null);
    const fromLegacy = original == null || !owns(original, "developmentByCardId");
    const sourceRecords = fromLegacy ? [trilogy, ares] : [shared];
    for (const record of sourceRecords) {
      if (record == null || !owns(record, "developmentByCardId")) continue;
      const entries = record.developmentByCardId;
      if (entries == null || typeof entries !== "object" || Array.isArray(entries)) throw fail("rtg-cloud-development-corrupt");
      // Check raw records before defaults/winner selection can hide malformed
      // values or non-JSON properties (including a losing legacy record).
      projector.project({ shared: { tokens: 0, gachaAcquiredCards: [],
        developmentByCardId: entries, coachOwnedIds: [] } });
      for (const [key, raw] of Object.entries(entries)) {
        const normalized = developmentRecord(raw);
        if (!key || !normalized) throw fail("rtg-cloud-development-corrupt");
        if (recordWins(normalized, winner[key])) winner[key] = normalized;
      }
    }
    return {
      tokens: owns(shared, "tokens") ? shared.tokens : 0,
      gachaAcquiredCards: ownedCards(shared),
      developmentByCardId: winner,
      coachOwnedIds: owns(shared, "coachOwnedIds") ? shared.coachOwnedIds : [],
    };
  }

  function ownedCards(source) {
    if (owns(source, "gachaAcquiredCards")) return source.gachaAcquiredCards;
    if (!owns(source, "gachaAcquiredPlayerIds")) return [];
    const players = source.gachaAcquiredPlayerIds;
    if (!Array.isArray(players) || players.some(value => typeof value !== "string" || !value.trim())
      || new Set(players).size !== players.length) throw fail("rtg-cloud-invalid-card-collection");
    const identity = global.RoadToGloryCardIdentity;
    if (!identity?.record) throw fail("rtg-cloud-card-identity-required");
    // This is the canonical legacy identity migration, in memory only. The
    // identity API emits optional profileId: undefined; omit that known field
    // rather than using a lossy JSON clone on arbitrary persisted data.
    return players.map(playerId => {
      const { profileId, ...record } = identity.record({ playerId, legacySeasonId: "ie1" });
      return profileId === undefined ? record : { ...record, profileId };
    });
  }

  function create({ storage, localStorage: local = global.localStorage,
                    projector = global.RoadToGloryCloudSnapshot } = {}) {
    if (!storage || typeof storage.readMany !== "function") throw new TypeError("RTG cloud storage.readMany required");
    if (!local || typeof local.getItem !== "function") throw new TypeError("RTG cloud localStorage required");
    if (!projector?.project || !projector?.validate) throw new TypeError("RTG cloud snapshot projector required");

    async function captureOnce() {
      const records = await storage.readMany(RECORD_KEYS);
      const album = albumRead(local);
      // Presence of an encounter always defers RTG, even if other permanent
      // fields need repair. Capture remains read-only in either case.
      if (records.state?.activeMatch != null || records["state:rtg-ares-orion"]?.activeMatch != null) {
        return { status: "deferred", reason: "rtg-cloud-match-in-progress" };
      }
      const input = {
        trilogy: legacyCampaign(records.state ?? null),
        aresOrion: legacyCampaign(records["state:rtg-ares-orion"] ?? null),
        shared: reconstructShared(records, projector),
        album,
      };
      // Match repository ownership: union shared and both campaign lists,
      // including legacy saves with an empty shared list. Restore replaces
      // all three records atomically; preserved squads never grant ownership.
      const snapshot = projector.project(input);
      projector.validate(snapshot);
      return { status: "ready", snapshot };
    }

    async function captureStable(maxAttempts = 3) {
      if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
        throw new RangeError("RTG cloud snapshot attempts invalid");
      }
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const before = await captureOnce();
        if (before.status === "deferred") return before;
        const after = await captureOnce();
        if (after.status === "deferred") return after;
        if (JSON.stringify(before.snapshot) === JSON.stringify(after.snapshot)) return before;
      }
      throw fail("rtg-cloud-local-snapshot-unstable");
    }

    return Object.freeze({ captureStable });
  }

  global.RoadToGloryCloudLocalAdapter = Object.freeze({ create, ALBUM_KEY, RECORD_KEYS });
  if (typeof module !== "undefined" && module.exports) module.exports = global.RoadToGloryCloudLocalAdapter;
})(globalThis);
