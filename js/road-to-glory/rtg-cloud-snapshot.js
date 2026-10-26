(function (global) {
  "use strict";

  // Pure, read-only projection of RTG's permanent data. This module deliberately
  // knows nothing about Firebase, IndexedDB, localStorage, gameplay, or restores.
  // The caller must supply a stable, locally committed three-record snapshot.
  const SNAPSHOT_VERSION = 1;
  const CAMPAIGN_IDS = Object.freeze(["rtg-ie-trilogy", "rtg-ares-orion"]);
  const SEASONS = Object.freeze({
    "rtg-ie-trilogy": Object.freeze(["ie1", "ie1_s2", "ie1_s3"]),
    "rtg-ares-orion": Object.freeze(["ie2", "orion"]),
  });
  const CAMPAIGN_FIELDS = Object.freeze([
    "schemaVersion", "campaignId", "campaignSeed", "activeSeasonId",
    "seasonComplete", "seasonTransitionRewardedIds", "projects",
    "coachPullCount", "lives", "checkpointMainIndex", "currentNodeId",
    "furthestNodeIndex", "defeatedTeamIds", "firstClearMatchIds",
    "attemptsByNode",
  ]);

  function failure(code, detail) {
    return Object.assign(new Error(code), { code, ...(detail ? { detail } : {}) });
  }
  function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function identifier(value) { return typeof value === "string" && value.trim().length > 0; }
  function count(value) { return Number.isSafeInteger(value) && value >= 0; }
  function jsonCopy(value) {
    const stack = new Set();
    function check(input) {
      if (input === null || typeof input === "string" || typeof input === "boolean") return;
      if (typeof input === "number" && Number.isFinite(input)) return;
      if (!input || typeof input !== "object" || stack.has(input)) throw failure("rtg-cloud-non-json-data");
      if (!Array.isArray(input) && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) throw failure("rtg-cloud-non-json-data");
      stack.add(input);
      if (Array.isArray(input)) {
        for (let i = 0; i < input.length; i += 1) {
          if (!Object.prototype.hasOwnProperty.call(input, i)) throw failure("rtg-cloud-non-json-data");
          check(input[i]);
        }
      } else {
        for (const key of Object.keys(input)) check(input[key]);
      }
      stack.delete(input);
    }
    check(value);
    return JSON.parse(JSON.stringify(value));
  }
  function ids(value, label) {
    if (!Array.isArray(value) || value.some((entry) => !identifier(entry)) || new Set(value).size !== value.length) {
      throw failure("rtg-cloud-invalid-ids", label);
    }
    return [...value];
  }
  function campaign(source, campaignId) {
    if (source == null) return null; // Campaign not yet started on this device.
    if (!object(source) || source.campaignId !== campaignId || !identifier(source.campaignSeed)
      || !SEASONS[campaignId].includes(source.activeSeasonId)
      || !Number.isSafeInteger(source.schemaVersion) || source.schemaVersion < 1 || source.schemaVersion > 3
      || typeof source.seasonComplete !== "boolean" || !identifier(source.currentNodeId)) {
      throw failure("rtg-cloud-invalid-campaign", campaignId);
    }
    // Do not publish transient match state, nor changes made during a match:
    // the last published manifest remains the safe cloud checkpoint.
    if (source.activeMatch != null) throw failure("rtg-cloud-match-in-progress", campaignId);
    if (!count(source.coachPullCount) || !count(source.gacha?.pullCount)
      || !count(source.lives) || !Number.isSafeInteger(source.checkpointMainIndex)
      || source.checkpointMainIndex < -1 || !count(source.furthestNodeIndex)
      || !object(source.projects) || !object(source.attemptsByNode)) {
      throw failure("rtg-cloud-invalid-campaign", campaignId);
    }
    for (const field of ["seasonTransitionRewardedIds", "defeatedTeamIds", "firstClearMatchIds"]) ids(source[field], field);
    for (const [rarity, amount] of Object.entries(source.projects)) if (!count(amount)) throw failure("rtg-cloud-invalid-projects", rarity);
    const result = {};
    for (const field of CAMPAIGN_FIELDS) result[field] = jsonCopy(source[field]);
    // Only the permanent pull counter is transported; no incidental gacha UI fields.
    result.gacha = { pullCount: source.gacha.pullCount };
    return result;
  }
  function sharedData(source, campaigns) {
    if (source == null) {
      if (campaigns.some(Boolean)) throw failure("rtg-cloud-shared-missing");
      return null;
    }
    if (!object(source) || !count(source.tokens)
      || !Array.isArray(source.gachaAcquiredCards) || !object(source.developmentByCardId)) {
      throw failure("rtg-cloud-invalid-shared");
    }
    const seenCards = new Set();
    const acquired = source.gachaAcquiredCards.map((card) => {
      if (!object(card) || !identifier(card.cardId) || seenCards.has(card.cardId)) {
        throw failure("rtg-cloud-invalid-card-collection");
      }
      seenCards.add(card.cardId);
      return jsonCopy(card);
    });
    for (const [cardId, value] of Object.entries(source.developmentByCardId)) {
      if (!identifier(cardId) || !object(value)) throw failure("rtg-cloud-invalid-development");
    }
    // RTG already reads coach ownership from both legacy campaigns. Reproduce
    // that read-only union, without changing a store or merging devices.
    const coachSources = [source.coachOwnedIds || [], ...campaigns.map((value) => value?.coachOwnedIds || [])];
    const coachIds = [];
    for (const list of coachSources) {
      if (!Array.isArray(list)) throw failure("rtg-cloud-invalid-coaches");
      for (const id of list) {
        if (!identifier(id)) throw failure("rtg-cloud-invalid-coaches");
        if (!coachIds.includes(id)) coachIds.push(id);
      }
    }
    return {
      tokens: source.tokens,
      gachaAcquiredCards: acquired,
      developmentByCardId: jsonCopy(source.developmentByCardId),
      coachOwnedIds: coachIds,
    };
  }
  function albumData(source) {
    if (source == null) return { version: 1, cardIds: [] };
    if (!object(source) || (source.version != null && source.version !== 1)) throw failure("rtg-cloud-invalid-album");
    return { version: 1, cardIds: ids(source.cardIds, "album.cardIds") };
  }
  function project(input) {
    if (!object(input)) throw failure("rtg-cloud-invalid-input");
    const sources = [input.trilogy, input.aresOrion];
    const campaigns = {
      [CAMPAIGN_IDS[0]]: campaign(sources[0], CAMPAIGN_IDS[0]),
      [CAMPAIGN_IDS[1]]: campaign(sources[1], CAMPAIGN_IDS[1]),
    };
    return {
      schemaVersion: SNAPSHOT_VERSION,
      campaigns,
      shared: sharedData(input.shared, sources),
      album: albumData(input.album),
    };
  }
  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }
  function validate(snapshot) {
    if (!object(snapshot) || snapshot.schemaVersion !== SNAPSHOT_VERSION
      || !object(snapshot.campaigns)
      || !Object.prototype.hasOwnProperty.call(snapshot.campaigns, CAMPAIGN_IDS[0])
      || !Object.prototype.hasOwnProperty.call(snapshot.campaigns, CAMPAIGN_IDS[1])) {
      throw failure("rtg-cloud-unsupported-snapshot");
    }
    // A cloud payload is itself an untrusted input; run exactly the same
    // projection/validation path as local captures before any restore.
    const clean = project({
      trilogy: snapshot.campaigns[CAMPAIGN_IDS[0]],
      aresOrion: snapshot.campaigns[CAMPAIGN_IDS[1]],
      shared: snapshot.shared,
      album: snapshot.album,
    });
    // Reject local-only or unknown fields rather than silently accepting them
    // from a malformed cloud document. The producer always strips them.
    if (canonicalJson(clean) !== canonicalJson(snapshot)) throw failure("rtg-cloud-noncanonical-snapshot");
    return clean;
  }

  const api = Object.freeze({ SNAPSHOT_VERSION, CAMPAIGN_IDS, project, validate });
  global.RoadToGloryCloudSnapshot = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
