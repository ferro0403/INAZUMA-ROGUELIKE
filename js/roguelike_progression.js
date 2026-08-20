(function (global) {
  "use strict";

  const FALLBACK_STAT_ORDER = [
    "attack",
    "control",
    "speed",
    "grit",
    "physical",
    "stamina",
    "defense",
    "save",
  ];


  const ROLE_STAT_WEIGHTS = Object.freeze({
    FW: Object.freeze({ attack: 50, control: 12, speed: 10, grit: 8, physical: 10, stamina: 8, defense: 2, save: 0 }),
    MF: Object.freeze({ control: 40, stamina: 15, grit: 12, speed: 10, attack: 10, defense: 8, physical: 5, save: 0 }),
    DF: Object.freeze({ defense: 50, physical: 15, grit: 10, stamina: 8, speed: 8, control: 5, attack: 4, save: 0 }),
    GK: Object.freeze({ save: 70, grit: 10, physical: 8, defense: 5, control: 3, stamina: 2, speed: 2, attack: 0 }),
  });

  function clampPotential(value) {
    const numeric = Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;
    return Math.max(0, Math.min(99, numeric));
  }

  const RARITY_THRESHOLDS = Object.freeze([
    Object.freeze({ category: "Scarso", min: 0 }),
    Object.freeze({ category: "Debole", min: 66 }),
    Object.freeze({ category: "Normale", min: 70 }),
    Object.freeze({ category: "Buono", min: 75 }),
    Object.freeze({ category: "Forte", min: 80 }),
    Object.freeze({ category: "Elite", min: 85 }),
    Object.freeze({ category: "Mondiale", min: 90 }),
    Object.freeze({ category: "Leggenda", min: 95 }),
  ]);

  function normalizePotentialBoostApplications(options = {}, maxAllowedBoost = Number.POSITIVE_INFINITY) {
    const cap = Math.max(0, Number.isFinite(Number(maxAllowedBoost)) ? Number(maxAllowedBoost) : Number.POSITIVE_INFINITY);
    const savedPotentialBoost = Math.max(0, Number(options?.potentialBoost || 0));
    const applications = Array.isArray(options?.potentialBoostApplications)
      ? options.potentialBoostApplications
          .map((boost) => ({
            amount: Math.max(0, Number(boost.amount || 0)),
            appliedLevel: Math.max(0, Number(boost.appliedLevel || 0)),
            ...(boost.legacy ? { legacy: true } : {}),
          }))
          .filter((boost) => boost.amount > 0)
      : [];

    const validTotal = applications.reduce((sum, boost) => sum + boost.amount, 0);
    const targetTotal = Math.min(cap, Math.max(savedPotentialBoost, validTotal));
    const normalized = applications.map((boost) => ({ ...boost }));
    if (targetTotal > validTotal) {
      normalized.push({ amount: targetTotal - validTotal, appliedLevel: 0, legacy: true });
    }

    let accepted = 0;
    return normalized
      .map((boost) => {
        const amount = Math.min(boost.amount, Math.max(0, cap - accepted));
        accepted += amount;
        return { ...boost, amount };
      })
      .filter((boost) => boost.amount > 0);
  }

  function normalizedPotentialBoost(options = {}, maxAllowedBoost = Number.POSITIVE_INFINITY) {
    return normalizePotentialBoostApplications(options, maxAllowedBoost).reduce((sum, boost) => sum + boost.amount, 0);
  }

  function effectivePotential(player, options = {}) {
    const basePotential = clampPotential(player?.finalOverall);
    const maxAllowedBoost = Math.max(0, 99 - basePotential);
    const totalBoost = normalizedPotentialBoost(options, maxAllowedBoost);
    return clampPotential(basePotential + totalBoost);
  }

  function effectiveCurrentOverallBoost(player, options = {}) {
    const maxAllowedBoost = Math.max(0, 99 - clampPotential(player?.finalOverall));
    const potentialBoost = normalizedPotentialBoost(options, maxAllowedBoost);
    const rawBoost = options.currentOverallBoost ?? potentialBoost;
    return Math.min(potentialBoost, Math.min(maxAllowedBoost, Math.max(0, Number(rawBoost || 0))));
  }

  function boostProgressAtLevel(boost, level, maxLevel) {
    if (level <= boost.appliedLevel || maxLevel <= boost.appliedLevel) return 0;
    const remainingLevels = maxLevel - boost.appliedLevel;
    const progressedLevels = level - boost.appliedLevel;
    return Math.min(boost.amount, Math.floor((boost.amount * progressedLevels) / remainingLevels));
  }

  function totalBoostProgressAtLevel(boosts, level, maxLevel, maxAllowedBoost) {
    let progressed = 0;
    let accepted = 0;
    for (const boost of boosts) {
      const amount = Math.min(boost.amount, Math.max(0, maxAllowedBoost - accepted));
      if (amount <= 0) break;
      accepted += amount;
      progressed += boostProgressAtLevel({ ...boost, amount }, level, maxLevel);
    }
    return Math.min(progressed, maxAllowedBoost);
  }

  function weightedStatValue(stats, role) {
    const weights = ROLE_STAT_WEIGHTS[role];
    if (!weights) return 0;
    return Object.entries(weights).reduce((sum, [stat, weight]) => sum + Number(stats?.[stat] || 0) * weight / 100, 0);
  }

  // InaCodex overalls are authored independently from the rounded 1-10 ratings.
  // Consequently the raw player's overall is the calibration point, while all
  // growth is measured with the canonical role weights from that point.
  function calculateCanonicalOverall(stats, role, originalStats = stats, originalOverall = 0) {
    const delta = weightedStatValue(stats, role) - weightedStatValue(originalStats, role);
    return clampPotential(Number(originalOverall || 0) + Math.round(delta));
  }

  function growthPriority(stat, weight, roleWeights, result, originalStats, allocated, targetOverall) {
    const original = Number(originalStats[stat] || 0);
    const current = Number(result[stat] || 0);
    const profileValues = Object.entries(roleWeights).filter(([, candidateWeight]) => candidateWeight > 0).map(([key]) => Number(originalStats[key] || 0));
    const profileAverage = profileValues.reduce((sum, value) => sum + value, 0) / Math.max(1, profileValues.length);
    const predisposition = Math.max(0.55, 1 + (original - profileAverage) / 100);
    const weakStatPenalty = original + 20 < profileAverage ? 0.58 : 1;
    const growthFatigue = 1 / (1 + allocated * 0.22);
    const expectedTop = targetOverall >= 95 ? 100 : targetOverall >= 90 ? 95 : targetOverall >= 85 ? 90 : targetOverall >= 80 ? 85 : targetOverall >= 75 ? 80 : 75;
    // Bands guide ordering only. They never make a stat ineligible.
    const bandPenalty = current >= Math.max(original, expectedTop) ? 0.72 : 1;
    return weight * predisposition * weakStatPenalty * growthFatigue * bandPenalty;
  }

  function growPlayerStatsToTargetOverall({ role, originalStats, currentStats, originalOverall, currentOverall, targetOverall }) {
    const result = { ...(currentStats || {}) };
    const baselineStats = { ...(originalStats || currentStats || {}) };
    const weights = ROLE_STAT_WEIGHTS[role];
    const target = clampPotential(targetOverall);
    if (!weights) return result;

    const calibratedOriginalOverall = Number(originalOverall || 0);
    let calculated = calculateCanonicalOverall(result, role, baselineStats, calibratedOriginalOverall);
    // currentOverall is authoritative for level progression, but the stat delta
    // remains calibrated against the exact raw stats at that level.
    const calibration = Number(currentOverall || calculated) - calculated;
    const calculate = () => calculateCanonicalOverall(result, role, baselineStats, calibratedOriginalOverall) + calibration;
    const allocated = Object.fromEntries(Object.keys(weights).map((stat) => [stat, Math.max(0, Number(result[stat] || 0) - Number(baselineStats[stat] || 0))]));
    calculated = calculate();
    while (calculated < target) {
      const eligible = Object.entries(weights)
        .filter(([stat, weight]) => weight > 0 && Number(result[stat] || 0) < 100)
        .sort(([statA, weightA], [statB, weightB]) => {
          const difference = growthPriority(statB, weightB, weights, result, baselineStats, allocated[statB], target)
            - growthPriority(statA, weightA, weights, result, baselineStats, allocated[statA], target);
          return difference || FALLBACK_STAT_ORDER.indexOf(statA) - FALLBACK_STAT_ORDER.indexOf(statB);
        });
      if (!eligible.length) break;
      const stat = eligible[0][0];
      result[stat] = Number(result[stat] || 0) + 1;
      allocated[stat] += 1;
      calculated = calculate();
    }
    return result;
  }

  function distributeWeightedStatBoosts(stats, player, overallBoost) {
    const target = Math.max(0, Number(overallBoost || 0));
    const role = player?.position || player?.normalizedRole;
    const weights = ROLE_STAT_WEIGHTS[role];
    if (!target || !weights) return { ...stats };
    return growPlayerStatsToTargetOverall({ role, originalStats: stats, currentStats: stats, originalOverall: 0, currentOverall: 0, targetOverall: target });
  }

  function categoryForPotential(potential, fallbackCategory, _database) {
    const numericPotential = Number(potential);
    if (!Number.isFinite(numericPotential)) return fallbackCategory || "Scarso";

    const effectivePotential = clampPotential(numericPotential);
    let category = RARITY_THRESHOLDS[0].category;
    for (const threshold of RARITY_THRESHOLDS) {
      if (effectivePotential >= threshold.min) category = threshold.category;
    }
    return category;
  }

  function clampLevel(level, maxLevel) {
    const numericLevel = Number.isFinite(Number(level)) ? Math.round(Number(level)) : 0;
    return Math.max(0, Math.min(maxLevel, numericLevel));
  }

  function decodeStat(code, statIndex, level, maxLevel, codeWidth) {
    const offset = (statIndex * (maxLevel + 1) + level) * codeWidth;
    return parseInt(code.slice(offset, offset + codeWidth), 36);
  }

  // Least-squares calibration on an 80% player-level split of the IE1 and
  // Free Agents compact progressions. Inputs are normalized to keep the
  // coefficients readable; the remaining player-specific legacy jitter is
  // deliberately not reproduced. See scripts/analyze-legacy-progression.js.
  const LEGACY_LEVEL_ZERO_MODEL = Object.freeze({
    intercept: 0.13634777000187784,
    finalStat: 65.20194123389791,
    overall: -0.3383545296532767,
    interaction: 6.658850793123839,
    overallSquared: -0.7422114358370647,
  });

  function estimateLegacyLevel0Stat(finalStat, finalOverall) {
    const normalizedStat = Number(finalStat) / 100;
    const normalizedOverall = (Number(finalOverall) - 80) / 10;
    const model = LEGACY_LEVEL_ZERO_MODEL;
    return Math.round(
      model.intercept
      + (model.finalStat * normalizedStat)
      + (model.overall * normalizedOverall)
      + (model.interaction * normalizedStat * normalizedOverall)
      + (model.overallSquared * normalizedOverall * normalizedOverall)
    );
  }

  function interpolateLegacyStat(level0Stat, finalStat, level, maxLevel) {
    if (level >= maxLevel || maxLevel <= 0) return finalStat;
    return Math.round(level0Stat + ((finalStat - level0Stat) * level / maxLevel));
  }

  function statsFromRatings(player, level, maxLevel, statOrder) {
    const ratings = player?.ratings;
    const invalidStat = statOrder.find((stat) => {
      const rating = Number(ratings?.[stat]);
      return !Number.isFinite(rating) || !Number.isInteger(rating) || rating < 1 || rating > 10;
    });
    if (invalidStat) {
      throw new Error(`Invalid InaCodex rating for ${invalidStat}: expected an integer from 1 to 10`);
    }

    return Object.fromEntries(statOrder.map((stat) => [
      stat,
      interpolateLegacyStat(
        estimateLegacyLevel0Stat(Number(ratings[stat]) * 10, player.finalOverall),
        Number(ratings[stat]) * 10,
        level,
        maxLevel
      ),
    ]));
  }

  function getPlayerAtLevel(player, requestedLevel, database, options = {}) {
    if (!player || (typeof player.progressionCode !== "string" && !player.ratings)) {
      throw new Error("Invalid compact player: progression data is missing");
    }

    const format = (database && database.compactFormat) || {};
    const statOrder = format.statOrder || FALLBACK_STAT_ORDER;
    const codeWidth = format.codeWidth || 2;
    const maxLevel = Number(player.maxLevel ?? format.levelMax ?? 20);
    const level = clampLevel(requestedLevel, maxLevel);
    let stats = {};

    if (typeof player.progressionCode === "string") {
      statOrder.forEach((stat, statIndex) => {
        stats[stat] = decodeStat(
          player.progressionCode,
          statIndex,
          level,
          maxLevel,
          codeWidth
        );
      });
    } else {
      stats = statsFromRatings(player, level, maxLevel, statOrder);
    }

    const baseOverall = Number(player.finalOverall) - (maxLevel - level);
    const visibleBoost = effectiveCurrentOverallBoost(player, options);
    const potential = effectivePotential(player, options);
    const overall = Math.min(potential, baseOverall + visibleBoost, 99);
    const boostedStats = growPlayerStatsToTargetOverall({
      role: player.position || player.normalizedRole,
      originalStats: stats,
      currentStats: stats,
      originalOverall: baseOverall,
      currentOverall: baseOverall,
      targetOverall: overall,
    });
    const category = categoryForPotential(potential, player.category, database);
    return { ...player, ...boostedStats, level, overall, potential, category, stats: boostedStats };
  }

  function buildPlayerIndex(database) {
    return new Map(
      (database.players || []).map((player) => [String(player.playerId), player])
    );
  }

  function getTeamPlayers(database, teamId, level) {
    const team = (database.teams || []).find(
      (candidate) => String(candidate.teamId ?? candidate.id) === String(teamId)
    );
    if (!team) return [];

    const index = buildPlayerIndex(database);
    return (team.playerIds || [])
      .map((playerId) => index.get(String(playerId)))
      .filter(Boolean)
      .map((player) =>
        level === undefined ? player : getPlayerAtLevel(player, level, database)
      );
  }

  function getBossStartingXI(database, boss) {
    const index = buildPlayerIndex(database);
    return (boss.startingXI || []).map((entry) => {
      const player = index.get(String(entry.playerId));
      if (!player) throw new Error(`Missing boss player ${entry.playerId}`);
      return {
        slot: entry.slot,
        ...getPlayerAtLevel(player, entry.level ?? boss.bossLevel ?? 0, database),
      };
    });
  }

  const api = {
    getPlayerAtLevel,
    buildPlayerIndex,
    getTeamPlayers,
    getBossStartingXI,
    effectivePotential,
    effectiveCurrentOverallBoost,
    categoryForPotential,
    normalizePotentialBoostApplications,
    normalizedPotentialBoost,
    distributeWeightedStatBoosts,
    growPlayerStatsToTargetOverall,
    calculateCanonicalOverall,
    weightedStatValue,
    ROLE_STAT_WEIGHTS,
    RARITY_THRESHOLDS,
  };

  global.InazumaProgression = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
