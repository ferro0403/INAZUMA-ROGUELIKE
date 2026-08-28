(function (global) {
  "use strict";

  // Dormant Development V3 data contract. This module deliberately has no
  // storage adapter and is not loaded by index.html.
  const SCHEMA_VERSION = 1;
  const PROFILE_FORMAT_VERSION = 1;
  const GROWTH_ALGORITHM_VERSION = "development-v2-production-v1";
  const MAX_LEVEL = 20;
  const STAT_ORDER = Object.freeze(["attack", "control", "speed", "grit", "physical", "stamina", "defense", "save"]);
  // Only colored upgrades are V3 steps. A paid legacy Normale upgrade is an
  // optional migration baseline and never consumes a colored slot.
  const COLORED_RARITIES = Object.freeze(["Buono", "Forte", "Elite", "Mondiale", "Leggenda"]);
  const RARITY_POTENTIAL_BANDS = Object.freeze({
    Buono: Object.freeze({ min: 75, max: 79 }),
    Forte: Object.freeze({ min: 80, max: 84 }),
    Elite: Object.freeze({ min: 85, max: 89 }),
    Mondiale: Object.freeze({ min: 90, max: 94 }),
    Leggenda: Object.freeze({ min: 95, max: 99 }),
  });
  const PROJECT_RARITIES = COLORED_RARITIES;
  const SEASON_IDS = Object.freeze(["ie1", "ie1_s2", "ie1_s3", "ie2", "orion"]);
  const CODEC = "base36-fixed2-stat-major-v1";
  // Production stats start in the 0..100 compact/rating range. Permanent
  // Codex growth can add one final 10-point unit to a 94 stat (rounded rating
  // 9), so the production solver's actual output ceiling is 104.
  const STAT_RANGE = Object.freeze({ min: 0, max: 104 });
  const OVERALL_RANGE = Object.freeze({ min: 0, max: 99 });
  const POTENTIAL_RANGE = Object.freeze({ min: 0, max: 99 });

  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = (value) => value && typeof value === "object" && !Array.isArray(value);
  const integer = (value, minimum = 0) => Number.isInteger(value) && value >= minimum;
  const counters = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));
  const potentialMatchesRarity = (rarity, potential) => {
    const band = RARITY_POTENTIAL_BANDS[rarity];
    return Boolean(band && integer(potential) && potential >= band.min && potential <= band.max);
  };
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

  function normalizeLegacyNormale(source) {
    if (!record(source)) return null;
    const value = {
      migrationId: String(source.migrationId || ""),
      fromRarity: String(source.fromRarity || ""),
      fromPotential: Number(source.fromPotential),
      toPotential: Number(source.toPotential),
      profile: normalizeProfile(source.profile),
      receipt: normalizeReceipt(source.receipt),
    };
    if (own(source, "createdAt") && source.createdAt != null) value.createdAt = String(source.createdAt);
    return value;
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
      const legacyNormale = normalizeLegacyNormale(source.players[playerId]?.legacyNormale);
      state.players[String(playerId)] = { legacyNormale, steps };
    });
    if (record(source.migrationLegacy?.projectBuild)) {
      const projectBuild = cleanCounter(source.migrationLegacy.projectBuild, PROJECT_RARITIES);
      if (Object.values(projectBuild).some(Boolean)) state.migrationLegacy = { projectBuild };
    }
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
        typeof code.potentials !== "string" || code.potentials.length !== (MAX_LEVEL + 1) * 2 || !/^[0-9a-z]+$/.test(code.potentials)) {
      errors.push(`${path}.progressionCode:invalid`);
      return errors;
    }
    const decodeTokens = (encoded) => Array.from({ length: encoded.length / 2 }, (_, index) => parseInt(encoded.slice(index * 2, index * 2 + 2), 36));
    const stats = decodeTokens(code.stats);
    const overalls = decodeTokens(code.overalls);
    const potentials = decodeTokens(code.potentials);
    const outside = (values, range) => values.some((value) => !Number.isInteger(value) || value < range.min || value > range.max);
    if (outside(stats, STAT_RANGE)) errors.push(`${path}.progressionCode.stats:out-of-range`);
    if (outside(overalls, OVERALL_RANGE)) errors.push(`${path}.progressionCode.overalls:out-of-range`);
    if (outside(potentials, POTENTIAL_RANGE)) errors.push(`${path}.progressionCode.potentials:out-of-range`);
    if (overalls.at(-1) !== profile.finalOverall) errors.push(`${path}.progressionCode.finalOverall:mismatch`);
    if (potentials.at(-1) !== profile.finalOverall) errors.push(`${path}.progressionCode.finalPotential:mismatch`);
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
      const stepIds = new Set();
      const rarities = new Set();
      const legacy = chain.legacyNormale;
      if (legacy != null) {
        const path = `players.${playerId}.legacyNormale`;
        const forbidden = ["playerId", "id", "name", "playerName", "playerNameSnapshot", "portraitUrl", "frontFullbodyUrl", "description", "element", "position", "teams", "ratings"];
        const validOrigin = legacy?.fromRarity === "Scarso" ? integer(legacy.fromPotential) && legacy.fromPotential <= 65 : legacy?.fromRarity === "Debole" ? integer(legacy.fromPotential) && legacy.fromPotential >= 66 && legacy.fromPotential <= 69 : false;
        if (!record(legacy) || typeof legacy.migrationId !== "string" || !legacy.migrationId || !validOrigin ||
            !integer(legacy.toPotential) || legacy.toPotential < legacy.fromPotential || legacy.toPotential < 70 || legacy.toPotential > 74 ||
            (own(legacy, "createdAt") && typeof legacy.createdAt !== "string")) errors.push(`${path}:invalid`);
        errors.push(...profileErrors(legacy?.profile, `${path}.profile`));
        if (legacy?.profile?.category !== "Normale") errors.push(`${path}.profile.category:mismatch`);
        if (legacy?.profile?.finalOverall !== legacy?.toPotential) errors.push(`${path}.profile.finalOverall:mismatch`);
        if (record(legacy) && forbidden.some((key) => own(legacy, key) || (record(legacy.profile) && own(legacy.profile, key)))) errors.push(`${path}:duplicated-identity`);
        const receipt = legacy?.receipt;
        if (!record(receipt) || !integer(receipt.coinsConsumed) || !integer(receipt.cupsConsumed) || !integer(receipt.projectsConsumed) || !record(receipt.cupsConsumedBySource) || Object.values(receipt.cupsConsumedBySource).some((value) => !integer(value)) || Object.values(receipt.cupsConsumedBySource || {}).reduce((sum, value) => sum + value, 0) !== receipt?.cupsConsumed) errors.push(`${path}.receipt:invalid`);
        if (chain.steps[0] && (chain.steps[0].fromRarity !== "Normale" || chain.steps[0].fromPotential !== legacy?.toPotential)) errors.push(`${path}:first-step-discontinuous`);
      }
      chain.steps.forEach((step, index) => {
        const path = `players.${playerId}.steps.${index}`;
        if (!record(step) || !step.stepId || !COLORED_RARITIES.includes(step.rarity) || !integer(step.fromPotential) || !integer(step.toPotential) || step.toPotential < step.fromPotential || step.toPotential > 99) errors.push(`${path}:invalid`);
        errors.push(...profileErrors(step?.profile, `${path}.profile`));
        if (record(step)) {
          if (stepIds.has(step.stepId)) errors.push(`${path}.stepId:duplicate`);
          stepIds.add(step.stepId);
          if (rarities.has(step.rarity)) errors.push(`${path}.rarity:duplicate`);
          rarities.add(step.rarity);
          if (step.profile?.finalOverall !== step.toPotential) errors.push(`${path}.profile.finalOverall:mismatch`);
          if (step.profile?.category !== step.rarity) errors.push(`${path}.profile.category:mismatch`);
          if (!potentialMatchesRarity(step.rarity, step.toPotential)) errors.push(`${path}.toPotential:rarity-band-mismatch`);
          const previous = chain.steps[index - 1];
          if (index > 0 && step.fromPotential !== previous?.toPotential) errors.push(`${path}.fromPotential:discontinuous`);
          if (index > 0 && step.fromRarity !== previous?.rarity) errors.push(`${path}.fromRarity:discontinuous`);
          if (index > 0 && COLORED_RARITIES.indexOf(step.rarity) <= COLORED_RARITIES.indexOf(previous?.rarity)) errors.push(`${path}.rarity:not-forward`);
        }
        const receipt = step?.receipt;
        if (!record(receipt) || !integer(receipt.coinsConsumed) || !integer(receipt.cupsConsumed) || !integer(receipt.projectsConsumed) || !record(receipt.cupsConsumedBySource) || Object.values(receipt.cupsConsumedBySource).some((value) => !integer(value)) || Object.values(receipt.cupsConsumedBySource || {}).reduce((sum, value) => sum + value, 0) !== receipt?.cupsConsumed) errors.push(`${path}.receipt:invalid`);
      });
    });
    if (raw.migrationLegacy != null) {
      const projectBuild = raw.migrationLegacy?.projectBuild;
      if (!record(raw.migrationLegacy) || !record(projectBuild) || Object.keys(raw.migrationLegacy).some((key) => key !== "projectBuild") ||
          Object.keys(projectBuild || {}).sort().join(",") !== [...PROJECT_RARITIES].sort().join(",") || Object.values(projectBuild || {}).some((value) => !integer(value))) errors.push("migrationLegacy:invalid");
    }
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

  function resolveValidatedMaterializedPlayer(basePlayer, profile, requestedLevel) {
    if (!record(basePlayer) || !String(basePlayer.playerId || "")) throw new TypeError("basePlayer with playerId is required");
    const numericLevel = Number.isFinite(Number(requestedLevel)) ? Math.round(Number(requestedLevel)) : 0;
    const level = Math.max(0, Math.min(profile.maxLevel, numericLevel));
    const stats = Object.fromEntries(STAT_ORDER.map((stat, statIndex) => [stat, decodeAt(profile.progressionCode.stats, statIndex * (profile.maxLevel + 1) + level)]));
    const overall = decodeAt(profile.progressionCode.overalls, level);
    const potential = decodeAt(profile.progressionCode.potentials, level);
    return { ...basePlayer, ...stats, level, overall, potential, category: profile.category, stats };
  }

  function resolveMaterializedPlayer(basePlayer, profile, requestedLevel) {
    const errors = profileErrors(profile);
    if (errors.length) throw new TypeError(`Invalid Development V3 profile: ${errors.join(", ")}`);
    return resolveValidatedMaterializedPlayer(basePlayer, profile, requestedLevel);
  }

  function validateProfile(profile) {
    const errors = profileErrors(profile);
    return { valid: errors.length === 0, errors };
  }

  const api = { SCHEMA_VERSION, PROFILE_FORMAT_VERSION, GROWTH_ALGORITHM_VERSION, MAX_LEVEL, STAT_ORDER, STAT_RANGE, OVERALL_RANGE, POTENTIAL_RANGE, COLORED_RARITIES, RARITY_POTENTIAL_BANDS, PROJECT_RARITIES, SEASON_IDS, CODEC, empty, normalize, validate, validateProfile, clone, materializeProfile, resolveMaterializedPlayer, resolveValidatedMaterializedPlayer };
  global.DevelopmentV3 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
