(function (global) {
  "use strict";
  // A consumer of the existing account restore journal, never a second sync
  // manager. The journal remains active across IDB + localStorage boundaries.
  const CAMPAIGNS = ["rtg-ie-trilogy", "rtg-ares-orion"];
  const KEYS = ["state", "state:rtg-ares-orion", "shared:account"];
  const BACKUPS = CAMPAIGNS.map(id => `local:squads:${id}`);
  const PROOF_KEY = "cloud:restore-proof";
  const ALBUM_KEY = "inazuma.rtg.album.v1";
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }
  function error(code) { return Object.assign(new Error(code), { code, problemSector: "rtg" }); }
  function create({ storage, localStorage: local = global.localStorage, stateApi = global.RoadToGloryState,
    projector = global.RoadToGloryCloudSnapshot } = {}) {
    if (!storage?.updateMany || !projector?.validate || !stateApi?.validate) throw new TypeError("RTG restore dependencies required");
    const capture = global.RoadToGloryCloudLocalAdapter.create({ storage, localStorage: local, projector });
    const allKeys = [...KEYS, ...BACKUPS, PROOF_KEY];
    function assertNoMatch(records) {
      if (records[KEYS[0]]?.activeMatch != null || records[KEYS[1]]?.activeMatch != null) throw error("rtg-cloud-match-in-progress");
    }
    function materialize(campaign, shared, squads) {
      const candidate = { ...clone(campaign), tokens: shared.tokens,
        gachaAcquiredCards: clone(shared.gachaAcquiredCards), developmentByCardId: clone(shared.developmentByCardId),
        coachOwnedIds: clone(shared.coachOwnedIds), squads, activeMatch: null, localSquadsPreserved: true };
      // Validate every target before the journal applies any account store.
      // Device preferences never pass through gameplay's squad normalization.
      const checked = stateApi.validate({ ...candidate, squads: {} });
      if (checked.gachaAcquiredCards.length !== candidate.gachaAcquiredCards.length) throw error("rtg-cloud-invalid-card-collection");
      return candidate;
    }
    function validateTarget(snapshot) {
      const target = projector.validate(snapshot);
      for (const id of CAMPAIGNS) if (target.campaigns[id] != null) materialize(target.campaigns[id], target.shared, {});
      if (target.shared && CAMPAIGNS.every(id => target.campaigns[id] == null)) {
        materialize(stateApi.createInitial({ campaignId: CAMPAIGNS[0], campaignSeed: "cloud-validation-only" }), target.shared, {});
      }
      return target;
    }
    async function preflight(snapshot) {
      validateTarget(snapshot);
      assertNoMatch(await storage.readMany(KEYS));
      return true;
    }
    async function equals(snapshot) {
      const expected = projector.validate(snapshot), current = await capture.captureStable();
      return current.status === "ready" && canonical(current.snapshot) === canonical(expected);
    }
    async function apply(snapshot, journal) {
      const target = validateTarget(snapshot);
      if (!journal?.operationId) throw error("restore-ownership-lost");
      const options = { restoreOwnershipToken: journal.operationId, suppressCloudEvent: true };
      // Guard and generation are checked again by storage inside the write
      // transaction. Both campaigns and every legacy ownership replica change
      // together, including the backups for an unstarted cloud campaign.
      await storage.updateMany(allKeys, records => {
        global.PersistenceRecoveryGuard?.assertWritable(options);
        assertNoMatch(records);
        const writes = {}, localSquads = {};
        for (let i = 0; i < CAMPAIGNS.length; i += 1) {
          const id = CAMPAIGNS[i], key = KEYS[i], raw = records[key];
          const squads = clone(raw?.squads ?? records[BACKUPS[i]] ?? {});
          localSquads[id] = squads;
          writes[BACKUPS[i]] = squads;
          const campaign = target.campaigns[id];
          if (campaign == null) { writes[key] = null; continue; }
          writes[key] = materialize(campaign, target.shared, squads);
        }
        writes[KEYS[2]] = clone(target.shared);
        writes[PROOF_KEY] = { operationId: journal.operationId, localSquads };
        return { writes, value: true };
      }, options);
      global.PersistenceRecoveryGuard?.assertWritable(options);
      global.RoadToGloryPersistence?.assertWritable(options);
      local.setItem(ALBUM_KEY, JSON.stringify(target.album));
      if (canonical(JSON.parse(local.getItem(ALBUM_KEY) || "null")) !== canonical(target.album)) throw error("rtg-cloud-album-verification-failed");
      return true;
    }
    async function verify(snapshot, journal) {
      if (!await equals(snapshot)) return false;
      const records = await storage.readMany(allKeys), proof = records[PROOF_KEY];
      if (proof?.operationId !== journal?.operationId) return true; // No RTG store changed when already equal.
      return CAMPAIGNS.every((id, i) => canonical(records[KEYS[i]]?.squads ?? records[BACKUPS[i]] ?? {}) === canonical(proof.localSquads[id]));
    }
    return Object.freeze({ validateTarget, preflight, equals, apply, verify, captureStable: capture.captureStable });
  }
  global.RoadToGloryCloudRestoreAdapter = Object.freeze({ create });
})(globalThis);
