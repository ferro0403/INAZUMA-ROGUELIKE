(function (global) {
  "use strict";

  // Dormant Development V3 data contract. This module deliberately has no
  // storage adapter and is not loaded by index.html.
  const SCHEMA_VERSION = 1;
  const PROFILE_FORMAT_VERSION = 1;
  const GROWTH_ALGORITHM_VERSION = "development-v2-production-v1";
  const MAX_LEVEL = 20;
  const STAT_ORDER = Object.freeze(["attack", "control", "speed", "grit", "physical", "stamina", "defense", "save"]);
  // Only colored upgrades are V3 steps. Migration of a V2 chain that includes
  // a Normale upgrade (for example Debole -> Normale -> Buono) is intentionally
  // unresolved and must be decided by the later migration PR.
  const COLORED_RARITIES = Object.freeze(["Buono", "Forte", "Elite", "Mondiale", "Leggenda"]);
  const PROJECT_RARITIES = COLORED_RARITIES;
  const SEASON_IDS = Object.freeze(["ie1", "ie1_s2", "ie1_s3", "ie2", "orion"]);
  const CODEC = "base36-fixed2-stat-major-v1";

  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = (value) => value && typeof value === "object" && !Array.isArray(value);
  const integer = (value, minimum = 0) => Number.isInteger(value) && value >= minimum;
  const counters = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));
  const cleanCounter = (source, keys) => Object.fromEntries(keys.map((key) => [key, integer(Number(source?.[key])) ? Number(source[key]) : 0]));
  function cleanOpenCounter(source, requiredKeys) {
    const keys = [...new Set([...requiredKeys, ...(record(source) ? Object.keys(source) : [])])].sort();
    return Object.fromEntries(keys.map((key) => [key, integer(Number(source?.[key])) ? Number(source[key]) : 0]));
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function empty() {
    return {
      schemaVersion: SCHEMA_VERSION,
      coins: 0,
      cupsBySeason: counters(SEASON_IDS),
      projects: counters(PROJECT_RARITIES),
      unlockedEmblems: [],
      players: {},
      redeemedRunIds: [],
      victoryRewardRunIds: [],
    };
  }

  function normalizeReceipt(source) {
    const origins = record(source?.cupsConsumedBySource) ? source.cupsConsumedBySource : {};
    const cupsConsumedBySource = {};
    Object.keys(origins).sort().forEach((key) => {
      const amount = Number(origins[key]);
      if (integer(amount) && amount > 0) cupsConsumedBySource[String(key)] = amount;
    });
    return {
      coinsConsumed: integer(Number(source?.coinsConsumed)) ? Number(source.coinsConsumed) : 0,
      cupsConsumed: integer(Number(source?.cupsConsumed)) ? Number(source.cupsConsumed) : 0,
      cupsConsumedBySource,
      projectsConsumed: integer(Number(source?.projectsConsumed)) ? Number(source.projectsConsumed) : 0,
    };
  }

  function normalizeProfile(source) {
    if (!record(source)) return null;
    return {
      finalOverall: Number(source.finalOverall),
      category: String(source.category || ""),
      progressionCode: clone(source.progressionCode),
      maxLevel: Number(source.maxLevel),
      formatVersion: Number(source.formatVersion),
      growthAlgorithmVersion: String(source.growthAlgorithmVersion || ""),
    };
  }

  function normalizeStep(source) {
    if (!record(source)) return null;
    const step = {
      stepId: String(source.stepId || ""),
      rarity: String(source.rarity || ""),
      fromRarity: String(source.fromRarity || ""),
      fromPotential: Number(source.fromPotential),
      toPotential: Number(source.toPotential),
      profile: normalizeProfile(source.profile),
      receipt: normalizeReceipt(source.receipt),
    };
    if (own(source, "createdAt") && source.createdAt != null) step.createdAt = String(source.createdAt);
    return step;
  }

  function normalize(raw) {
    const source = record(raw) ? raw : {};
    const state = empty();
    state.coins = integer(Number(source.coins)) ? Number(source.coins) : 0;
    // Cup source identifiers are open-ended so a future/new season is not
    // silently collapsed or discarded in an account payload.
    state.cupsBySeason = cleanOpenCounter(source.cupsBySeason, SEASON_IDS);
    state.projects = cleanCounter(source.projects, PROJECT_RARITIES);
    state.unlockedEmblems = [...new Set(Array.isArray(source.unlockedEmblems) ? source.unlockedEmblems.map(String) : [])];
    state.redeemedRunIds = [...new Set(Array.isArray(source.redeemedRunIds) ? source.redeemedRunIds.map(String) : [])];
    state.victoryRewardRunIds = [...new Set(Array.isArray(source.victoryRewardRunIds) ? source.victoryRewardRunIds.map(String) : [])];
    if (record(source.players)) Object.keys(source.players).sort().forEach((playerId) => {
      const steps = Array.isArray(source.players[playerId]?.steps) ? source.players[playerId].steps.map(normalizeStep).filter(Boolean) : [];
      state.players[String(playerId)] = { steps };
    });
    return state;
  }

  function profileErrors(profile, path = "profile") {
    const errors = [];
    if (!record(profile)) return [`${path}:object-required`];
    if (!integer(profile.finalOverall) || profile.finalOverall > 99) errors.push(`${path}.finalOverall:invalid`);
    if (typeof profile.category !== "string" || !profile.category) errors.push(`${path}.category:invalid`);
    if (profile.maxLevel !== MAX_LEVEL) errors.push(`${path}.maxLevel:unsupported`);
    if (profile.formatVersion !== PROFILE_FORMAT_VERSION) errors.push(`${path}.formatVersion:unsupported`);
    if (profile.growthAlgorithmVersion !== GROWTH_ALGORITHM_VERSION) errors.push(`${path}.growthAlgorithmVersion:unsupported`);
    const code = profile.progressionCode;
    const expectedChars = STAT_ORDER.length * (MAX_LEVEL + 1) * 2;
    if (!record(code) || code.codec !== CODEC || code.statOrder !== STAT_ORDER.join(",") || code.codeWidth !== 2 ||
        typeof code.stats !== "string" || code.stats.length !== expectedChars || !/^[0-9a-z]+$/.test(code.stats) ||
        typeof code.overalls !== "string" || code.overalls.length !== (MAX_LEVEL + 1) * 2 || !/^[0-9a-z]+$/.test(code.overalls) ||
        typeof code.potentials !== "string" || code.potentials.length !== (MAX_LEVEL + 1) * 2 || !/^[0-9a-z]+$/.test(code.potentials)) errors.push(`${path}.progressionCode:invalid`);
    return errors;
  }

  function validate(raw) {
    const errors = [];
    if (!record(raw)) return { valid: false, errors: ["state:object-required"] };
    if (raw.schemaVersion !== SCHEMA_VERSION) errors.push("schemaVersion:unsupported");
    for (const key of ["coins"]) if (!integer(raw[key])) errors.push(`${key}:invalid`);
    for (const key of ["cupsBySeason", "projects"]) if (!record(raw[key]) || Object.values(raw[key]).some((value) => !integer(value))) errors.push(`${key}:invalid`);
    for (const key of ["unlockedEmblems", "redeemedRunIds", "victoryRewardRunIds"]) if (!Array.isArray(raw[key]) || raw[key].some((value) => typeof value !== "string")) errors.push(`${key}:invalid`);
    if (!record(raw.players)) errors.push("players:invalid");
    else Object.entries(raw.players).forEach(([playerId, chain]) => {
      if (!playerId || !record(chain) || !Array.isArray(chain.steps)) { errors.push(`players.${playerId}:invalid`); return; }
      if (chain.steps.length > COLORED_RARITIES.length) errors.push(`players.${playerId}.steps:too-many`);
      chain.steps.forEach((step, index) => {
        const path = `players.${playerId}.steps.${index}`;
        if (!record(step) || !step.stepId || !COLORED_RARITIES.includes(step.rarity) || !integer(step.fromPotential) || !integer(step.toPotential) || step.toPotential < step.fromPotential || step.toPotential > 99) errors.push(`${path}:invalid`);
        errors.push(...profileErrors(step?.profile, `${path}.profile`));
        const receipt = step?.receipt;
        if (!record(receipt) || !integer(receipt.coinsConsumed) || !integer(receipt.cupsConsumed) || !integer(receipt.projectsConsumed) || !record(receipt.cupsConsumedBySource) || Object.values(receipt.cupsConsumedBySource).some((value) => !integer(value)) || Object.values(receipt.cupsConsumedBySource || {}).reduce((sum, value) => sum + value, 0) !== receipt?.cupsConsumed) errors.push(`${path}.receipt:invalid`);
      });
    });
    return { valid: errors.length === 0, errors };
  }

  function encode(value) {
    if (!integer(value) || value >= 36 * 36) throw new Error("Development V3 progression value is outside the fixed-width codec");
    return value.toString(36).padStart(2, "0");
  }

  function materializeProfile({ basePlayer, targetPotential, database, maxLevel = MAX_LEVEL, category, progression } = {}) {
    if (!record(basePlayer) || !String(basePlayer.playerId || "")) throw new TypeError("basePlayer with playerId is required");
    if (maxLevel !== MAX_LEVEL) throw new RangeError(`Development V3 currently requires maxLevel ${MAX_LEVEL}`);
    const target = Number(targetPotential);
    const basePotential = Number(basePlayer.finalOverall);
    if (!integer(target) || target > 99 || !integer(basePotential) || target < basePotential) throw new RangeError("targetPotential must be an integer from base finalOverall through 99");
    const oracle = progression || global.InazumaProgression;
    if (!oracle || typeof oracle.getPlayerAtLevel !== "function") throw new TypeError("production progression oracle is required");
    const player = { ...basePlayer, maxLevel };
    const boost = target - basePotential;
    const options = { potentialBoost: boost, currentOverallBoost: boost, potentialBoostApplications: boost ? [{ amount: boost, appliedLevel: 0, permanent: true }] : [] };
    const levels = Array.from({ length: maxLevel + 1 }, (_, level) => oracle.getPlayerAtLevel(player, level, database, options));
    const progressionCode = {
      codec: CODEC,
      statOrder: STAT_ORDER.join(","),
      codeWidth: 2,
      stats: STAT_ORDER.map((stat) => levels.map((resolved) => encode(Number(resolved.stats?.[stat]))).join("")).join(""),
      overalls: levels.map((resolved) => encode(Number(resolved.overall))).join(""),
      potentials: levels.map((resolved) => encode(Number(resolved.potential))).join(""),
    };
    const oracleCategory = String(levels[maxLevel].category);
    if (category != null && String(category) !== oracleCategory) throw new RangeError("category must match the production progression result");
    const profile = { finalOverall: target, category: oracleCategory, progressionCode, maxLevel, formatVersion: PROFILE_FORMAT_VERSION, growthAlgorithmVersion: GROWTH_ALGORITHM_VERSION };
    const errors = profileErrors(profile);
    if (errors.length) throw new Error(`Materialized profile is invalid: ${errors.join(", ")}`);
    return profile;
  }

  function decodeAt(code, index) {
    return parseInt(code.slice(index * 2, index * 2 + 2), 36);
  }

  function resolveMaterializedPlayer(basePlayer, profile, requestedLevel) {
    const errors = profileErrors(profile);
    if (errors.length) throw new TypeError(`Invalid Development V3 profile: ${errors.join(", ")}`);
    if (!record(basePlayer) || !String(basePlayer.playerId || "")) throw new TypeError("basePlayer with playerId is required");
    const numericLevel = Number.isFinite(Number(requestedLevel)) ? Math.round(Number(requestedLevel)) : 0;
    const level = Math.max(0, Math.min(profile.maxLevel, numericLevel));
    const stats = Object.fromEntries(STAT_ORDER.map((stat, statIndex) => [stat, decodeAt(profile.progressionCode.stats, statIndex * (profile.maxLevel + 1) + level)]));
    const overall = decodeAt(profile.progressionCode.overalls, level);
    const potential = decodeAt(profile.progressionCode.potentials, level);
    return { ...basePlayer, ...stats, level, overall, potential, category: profile.category, stats };
  }

  const api = { SCHEMA_VERSION, PROFILE_FORMAT_VERSION, GROWTH_ALGORITHM_VERSION, MAX_LEVEL, STAT_ORDER, COLORED_RARITIES, PROJECT_RARITIES, SEASON_IDS, CODEC, empty, normalize, validate, clone, materializeProfile, resolveMaterializedPlayer };
  global.DevelopmentV3 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
