(function (global) {
  "use strict";

  // RTG persistence -> existing cloud sector adapter. This file contains
  // no Firestore calls and intentionally performs NO local writes.
  const ALBUM_KEY = "inazuma.rtg.album.v1";
  const RECORD_KEYS = Object.freeze(["state", "state:rtg-ares-orion", "shared:account"]);
  const RARITIES = Object.freeze(["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]);

  function fail(code) { return Object.assign(new Error(code), { code }); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
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
    const targetPotential = Number(value.targetPotential);
    const evolutionCount = Number(value.evolutionCount);
    const currentRarity = String(value.currentRarity || "");
    if (!Number.isInteger(targetPotential) || targetPotential < 1 || targetPotential > 99
        || !RARITIES.includes(currentRarity)) return null;
    return {
      targetPotential, currentRarity,
      evolutionCount: Number.isInteger(evolutionCount) && evolutionCount >= 0 ? evolutionCount : 0,
      updatedAt: value.updatedAt ? String(value.updatedAt) : null,
    };
  }

  // Legacy versions stored player development in individual campaigns. This
  // reconstruction matches RTG repository's winner policy but never migrates.
  function reconstructShared(records) {
    const trilogy = records.state;
    const ares = records["state:rtg-ares-orion"];
    const original = records["shared:account"];
    if (original == null && trilogy == null && ares == null) return null;
    if (original != null && (typeof original !== "object" || Array.isArray(original))) {
      throw fail("rtg-cloud-shared-corrupt");
    }
    const fallback = trilogy || ares || {};
    const shared = original || {
      tokens: fallback.tokens,
      gachaAcquiredCards: fallback.gachaAcquiredCards,
    };
    const winner = {};
    const fromLegacy = !Object.prototype.hasOwnProperty.call(shared, "developmentByCardId");
    const sourceMaps = fromLegacy
      ? [trilogy?.developmentByCardId, ares?.developmentByCardId]
      : [shared.developmentByCardId];
    for (const entries of sourceMaps) {
      if (entries == null) continue;
      if (typeof entries !== "object" || Array.isArray(entries)) throw fail("rtg-cloud-development-corrupt");
      for (const [key, raw] of Object.entries(entries)) {
        const normalized = developmentRecord(raw);
        if (!key || !normalized) throw fail("rtg-cloud-development-corrupt");
        if (recordWins(normalized, winner[key])) winner[key] = normalized;
      }
    }
    return {
      tokens: shared.tokens == null ? 0 : shared.tokens,
      gachaAcquiredCards: shared.gachaAcquiredCards == null ? [] : clone(shared.gachaAcquiredCards),
      developmentByCardId: winner,
      coachOwnedIds: shared.coachOwnedIds == null ? [] : clone(shared.coachOwnedIds),
    };
  }

  function create({ storage, localStorage: local = global.localStorage,
                    projector = global.RoadToGloryCloudSnapshot } = {}) {
    if (!storage || typeof storage.readMany !== "function") throw new TypeError("RTG cloud storage.readMany required");
    if (!local || typeof local.getItem !== "function") throw new TypeError("RTG cloud localStorage required");
    if (!projector?.project || !projector?.validate) throw new TypeError("RTG cloud snapshot projector required");

    async function captureOnce() {
      const records = await storage.readMany(RECORD_KEYS);
      const album = albumRead(local);
      const input = {
        trilogy: records.state || null,
        aresOrion: records["state:rtg-ares-orion"] || null,
        shared: reconstructShared(records),
        album,
      };
      // A live encounter must NOT advance the cloud checkpoint. No other
      // domain should be blocked on this result; caller must defer RTG only.
      if (input.trilogy?.activeMatch != null || input.aresOrion?.activeMatch != null) {
        return { status: "deferred", reason: "rtg-cloud-match-in-progress" };
      }
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
