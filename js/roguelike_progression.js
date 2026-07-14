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


  const ROLE_PRIMARY_STATS = {
    FW: ["attack"],
    MF: ["control"],
    DF: ["defense"],
    GK: ["save"],
  };

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

  function distributeStatBoosts(stats, player, boostPoints) {
    const result = { ...stats };
    const points = Math.max(0, Math.round(Number(boostPoints || 0)));
    if (!points) return result;
    const primary = ROLE_PRIMARY_STATS[player?.position] || ROLE_PRIMARY_STATS[player?.normalizedRole] || [];
    const order = [...primary, ...FALLBACK_STAT_ORDER.filter((stat) => !primary.includes(stat))];
    for (let index = 0; index < points; index += 1) {
      const stat = order[index % order.length];
      result[stat] = Math.min(99, Number(result[stat] || 0) + 1);
    }
    return result;
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

  function getPlayerAtLevel(player, requestedLevel, database, options = {}) {
    if (!player || typeof player.progressionCode !== "string") {
      throw new Error("Invalid compact player: progressionCode is missing");
    }

    const format = (database && database.compactFormat) || {};
    const statOrder = format.statOrder || FALLBACK_STAT_ORDER;
    const codeWidth = format.codeWidth || 2;
    const maxLevel = Number(player.maxLevel ?? format.levelMax ?? 20);
    const level = clampLevel(requestedLevel, maxLevel);
    const stats = {};

    statOrder.forEach((stat, statIndex) => {
      stats[stat] = decodeStat(
        player.progressionCode,
        statIndex,
        level,
        maxLevel,
        codeWidth
      );
    });

    const baseOverall = Number(player.finalOverall) - (maxLevel - level);
    const visibleBoost = effectiveCurrentOverallBoost(player, options);
    const potential = effectivePotential(player, options);
    const overall = Math.min(potential, baseOverall + visibleBoost, 99);
    const boostedStats = distributeStatBoosts(stats, player, visibleBoost);
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
    RARITY_THRESHOLDS,
  };

  global.InazumaProgression = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
