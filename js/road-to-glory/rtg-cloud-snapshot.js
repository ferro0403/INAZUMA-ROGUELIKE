(function (global) {
  "use strict";

  // Pure, read-only projection of RTG's permanent data. This module deliberately
  // knows nothing about Firebase, IndexedDB, localStorage, gameplay, or restores.
  // The caller must supply a stable, locally committed three-record snapshot.
  const SNAPSHOT_VERSION = 1;
  const CAMPAIGN_IDS = Object.freeze(["rtg-ie-trilogy", "rtg-ares-orion"]);
  const PROJECT_RARITIES = Object.freeze(["Buono", "Forte", "Elite", "Mondiale", "Leggenda", "Aurico"]);
  const DEVELOPMENT_RARITIES = Object.freeze(["Scarso", "Debole", "Normale", ...PROJECT_RARITIES]);
  const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
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
  function identifier(value) { return typeof value === "string" && value.trim().length > 0 && value === value.trim() && !["__proto__", "prototype", "constructor"].includes(value); }
  function count(value) { return Number.isSafeInteger(value) && value >= 0; }
  function intrinsicPrototype(prototype, constructor) {
    if (!prototype) return false;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "constructor");
    const actual = descriptor?.value;
    return typeof actual === "function" && actual.prototype === prototype
      && Function.prototype.toString.call(actual) === Function.prototype.toString.call(constructor);
  }
  function jsonCopy(value) {
    const stack = new Set();
    function check(input) {
      if (input === null || typeof input === "string" || typeof input === "boolean") return;
      if (typeof input === "number" && Number.isFinite(input)) return;
      if (!input || typeof input !== "object" || stack.has(input)) throw failure("rtg-cloud-non-json-data");
      const array = Array.isArray(input);
      const prototype = Object.getPrototypeOf(input);
      // A VM/iframe has its own intrinsic prototypes. Recognize the native
      // constructor and its actual prototype, never constructor.name or a
      // spoofable toString tag. Class instances/custom prototypes still fail.
      if (array ? !intrinsicPrototype(prototype, Array)
        : prototype !== null && !(Object.getPrototypeOf(prototype) === null && intrinsicPrototype(prototype, Object))) {
        throw failure("rtg-cloud-non-json-data");
      }
      stack.add(input);
      // JSON.stringify silently drops symbols, hidden properties and array
      // properties, and can execute getters/toJSON. Reject lossy data first.
      for (const key of Reflect.ownKeys(input)) {
        if (array && key === "length") continue;
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (typeof key !== "string" || !descriptor.enumerable || !owns(descriptor, "value")
          || (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= input.length))) {
          throw failure("rtg-cloud-non-json-data");
        }
        check(descriptor.value);
      }
      if (array) {
        for (let i = 0; i < input.length; i += 1) {
          if (!owns(input, i)) throw failure("rtg-cloud-non-json-data");
        }
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
    return jsonCopy(value);
  }
  function campaign(source, campaignId) {
    if (source == null) return null; // Campaign not yet started on this device.
    const invalid = field => failure("rtg-cloud-invalid-campaign", `${campaignId}:${field}`);
    if (!object(source)) throw invalid("record");
    const identityChecks = [
      ["campaignId", source.campaignId === campaignId],
      ["campaignSeed", identifier(source.campaignSeed)],
      ["activeSeasonId", SEASONS[campaignId].includes(source.activeSeasonId)],
      ["schemaVersion", Number.isSafeInteger(source.schemaVersion) && source.schemaVersion >= 1 && source.schemaVersion <= 3],
      ["seasonComplete", typeof source.seasonComplete === "boolean"],
      ["currentNodeId", identifier(source.currentNodeId)],
    ];
    for (const [field, valid] of identityChecks) if (!valid) throw invalid(field);
    // Do not publish transient match state, nor changes made during a match:
    // the last published manifest remains the safe cloud checkpoint.
    if (source.activeMatch != null) throw failure("rtg-cloud-match-in-progress", campaignId);
    const progressChecks = [
      ["coachPullCount", count(source.coachPullCount)],
      ["gacha", object(source.gacha)],
      ["gacha.pullCount", count(source.gacha?.pullCount)],
      ["gacha.recruitmentPullCount", !object(source.gacha) || !owns(source.gacha, "recruitmentPullCount") || count(source.gacha.recruitmentPullCount)],
      ["lives", count(source.lives) && source.lives <= 2],
      ["checkpointMainIndex", Number.isSafeInteger(source.checkpointMainIndex) && source.checkpointMainIndex >= -1],
      ["furthestNodeIndex", count(source.furthestNodeIndex)],
      ["projects", object(source.projects)],
      ["attemptsByNode", object(source.attemptsByNode)],
    ];
    for (const [field, valid] of progressChecks) if (!valid) throw invalid(field);
    for (const field of ["seasonTransitionRewardedIds", "defeatedTeamIds", "firstClearMatchIds"]) ids(source[field], field);
    for (const [rarity, amount] of Object.entries(source.projects)) {
      if (!PROJECT_RARITIES.includes(rarity) || !count(amount)) throw failure("rtg-cloud-invalid-projects", rarity);
    }
    for (const [nodeId, attempts] of Object.entries(source.attemptsByNode)) {
      // Production startMatch records {lastAttempt} for BOTH main and secondary
      // nodes before resolution. recordSecondaryResult adds lastResult/clears
      // after a secondary result; main nodes retain only lastAttempt.
      // Preserve valid partial history as-is; never fill in a fabricated
      // match result, rewrite a counter, or discard any attempt record.
      const gameplayRecord = object(attempts)
        && count(attempts.lastAttempt)
        && (!owns(attempts, "lastResult") || typeof attempts.lastResult === "string")
        && (!owns(attempts, "clears") || count(attempts.clears));
      if (!identifier(nodeId) || (!count(attempts) && !gameplayRecord)) {
        throw invalid("attemptsByNode");
      }
    }
    const result = {};
    for (const field of CAMPAIGN_FIELDS) result[field] = jsonCopy(source[field]);
    // Preserve absence for schema-1 cloud snapshots predating recruitment.
    // Both counters affect deterministic pulls; incidental UI fields stay local.
    result.gacha = { pullCount: source.gacha.pullCount };
    if (owns(source.gacha, "recruitmentPullCount")) result.gacha.recruitmentPullCount = source.gacha.recruitmentPullCount;
    return result;
  }
  // Optional 2026 Halloween permanent account ledger; older cloud snapshots
  // legitimately lack this field. Never silently repair corrupt rewards.
  function halloweenData(value) {
    if (!object(value) || !count(value.pumpkins) || !count(value.pullCount) ||
        !count(value.luckyWins) || !Array.isArray(value.ownedIds) ||
        !Array.isArray(value.completedIds)) throw failure("rtg-cloud-invalid-halloween");
    const ownedIds = ids(value.ownedIds, "halloween.ownedIds");
    const completedIds = ids(value.completedIds, "halloween.completedIds");
    if (ownedIds.length > 18 || ownedIds.some(id => !/^(?:[0-9]+|custom_000[12])$/.test(id)) ||
        completedIds.some(id => id.length > 120)) throw failure("rtg-cloud-invalid-halloween");
    return {pumpkins:value.pumpkins,ownedIds,pullCount:value.pullCount,
      completedIds,luckyWins:value.luckyWins};
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
    const acquired = jsonCopy(source.gachaAcquiredCards).map((card) => {
      if (!object(card) || !identifier(card.cardId) || seenCards.has(card.cardId)) {
        throw failure("rtg-cloud-invalid-card-collection");
      }
      seenCards.add(card.cardId);
      return jsonCopy(card);
    });
    const development = jsonCopy(source.developmentByCardId);
    for (const [cardId, value] of Object.entries(development)) {
      if (!identifier(cardId) || !object(value)
        || !Number.isSafeInteger(value.targetPotential) || value.targetPotential < 1 || value.targetPotential > 99
        || !DEVELOPMENT_RARITIES.includes(value.currentRarity)
        || (owns(value, "evolutionCount") && !count(value.evolutionCount))
        || (owns(value, "updatedAt") && value.updatedAt !== null && typeof value.updatedAt !== "string")) {
        throw failure("rtg-cloud-invalid-development");
      }
      // Development records contain progress only, never local configuration.
      development[cardId] = Object.fromEntries(["targetPotential", "currentRarity", "evolutionCount", "updatedAt"]
        .filter((field) => owns(value, field)).map((field) => [field, value[field]]));
    }
    // RTG already reads coach ownership from both legacy campaigns. Reproduce
    // that read-only union, without changing a store or merging devices.
    const coachSources = [owns(source, "coachOwnedIds") ? source.coachOwnedIds : [],
      ...campaigns.map((value) => value != null && owns(value, "coachOwnedIds") ? value.coachOwnedIds : [])];
    const coachIds = [];
    for (const list of coachSources) {
      if (!Array.isArray(list)) throw failure("rtg-cloud-invalid-coaches");
      jsonCopy(list);
      for (const id of list) {
        if (!identifier(id)) throw failure("rtg-cloud-invalid-coaches");
        if (!coachIds.includes(id)) coachIds.push(id);
      }
    }
    return {
      tokens: source.tokens,
      gachaAcquiredCards: acquired,
      developmentByCardId: development,
      coachOwnedIds: coachIds,
      ...(owns(source,"halloween") ? {halloween:halloweenData(source.halloween)} : {}),
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
    // Validate the entire received payload before projection can drop fields or
    // canonical comparison can hide non-JSON values. Never invoke accessors.
    jsonCopy(snapshot);
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
