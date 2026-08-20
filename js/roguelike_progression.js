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
            ...(boost.permanent ? { permanent: true } : {}),
            ...(boost.codexDeltas && typeof boost.codexDeltas === "object" ? { codexDeltas: Object.fromEntries(FALLBACK_STAT_ORDER.map((stat) => [stat, Math.max(0, Math.floor(Number(boost.codexDeltas[stat]) || 0))]).filter(([, value]) => value > 0)) } : {}),
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

  function toCodexRatings(stats) {
    return Object.fromEntries(FALLBACK_STAT_ORDER.map((stat) => {
      const value = Number(stats?.[stat] || 0);
      return [stat, Math.max(1, Math.min(10, Math.round(value > 10 ? value / 10 : value)))];
    }));
  }

  // Exact manual-rating formula from InaCodex player-ratings.js. Ratings are
  // integers from 1 to 10; this function is deliberately unrelated to its
  // automatic/random profile generator.
  function overallForRole(role, ratings) {
    if (!ROLE_STAT_WEIGHTS[role]) return 1;
    const roleScore = weightedStatValue(toCodexRatings(ratings), role);
    return Math.max(1, Math.min(99, Math.round(30 + ((roleScore - 1) * 69 / 9))));
  }

  function calculateCanonicalOverall(stats, role) {
    return overallForRole(role, toCodexRatings(stats));
  }

  function coherenceScore(candidate, original, current, role, target) {
    const weights = ROLE_STAT_WEIGHTS[role];
    const eligible = FALLBACK_STAT_ORDER.filter((stat) => weights[stat] > 0);
    const average = eligible.reduce((sum, stat) => sum + original[stat], 0) / eligible.length;
    let score = 0, totalGrowth = 0, squaredGrowth = 0;
    for (const stat of eligible) {
      const growth = candidate[stat] - current[stat];
      totalGrowth += growth; squaredGrowth += growth * growth;
      const strength = original[stat] - average;
      score += growth * (weights[stat] * 0.34 + strength * 3);
      if (original[stat] <= average - 2) score -= growth * growth * 24;
      const desired = target >= 95 ? 10 : target >= 90 ? 9 : target >= 85 ? 8.5 : target >= 80 ? 8 : 7;
      score -= Math.max(0, candidate[stat] - Math.max(original[stat], desired)) * 5;
    }
    score -= squaredGrowth * 5 + Math.max(0, squaredGrowth - totalGrowth * totalGrowth / eligible.length) * 4;
    for (const stronger of eligible) for (const weaker of eligible) {
      if (original[stronger] >= original[weaker] + 2 && candidate[stronger] < candidate[weaker]) score -= 90;
    }
    return score;
  }

  function findBestCodexGrowthProfile({ role, originalRatings, currentRatings, targetOverall }) {
    const weights = ROLE_STAT_WEIGHTS[role];
    const original = toCodexRatings(originalRatings);
    const current = toCodexRatings(currentRatings);
    if (!weights) return current;
    const target = clampPotential(targetOverall);
    const primary = { FW: "attack", MF: "control", DF: "defense", GK: "save" }[role];
    let primaryMinimum = current[primary];
    if (target >= 95) primaryMinimum = 10;
    else if (target >= 90 && original[primary] >= 9) primaryMinimum = 10;
    else if (target >= 90 && original[primary] >= 8) primaryMinimum = 9;
    const eligible = FALLBACK_STAT_ORDER.filter((stat) => weights[stat] > 0);
    const minimums = Object.fromEntries(eligible.map((stat) => [stat, stat === primary ? Math.max(current[stat], primaryMinimum) : current[stat]]));
    const eligibleIndex = Object.fromEntries(eligible.map((stat, index) => [stat, index]));
    const weightEntries = Object.entries(weights);
    function boundOverall(index, candidate, maximize) {
      let roleScore = 0;
      for (const [stat, weight] of weightEntries) {
        const position = eligibleIndex[stat];
        const value = weight > 0 && position >= index ? (maximize ? 10 : minimums[stat]) : candidate[stat];
        roleScore += Number(value || 0) * weight / 100;
      }
      return Math.max(1, Math.min(99, Math.round(30 + ((roleScore - 1) * 69 / 9))));
    }
    let best = null;
    function visit(index, candidate) {
      const minOverall = boundOverall(index, candidate, false);
      const maxOverall = boundOverall(index, candidate, true);
      if (maxOverall < target) return;
      if (best) {
        if (best.rank[0] === 0 && minOverall > target) return;
        if (best.rank[0] === 1 && minOverall - target > best.rank[1]) return;
      }
      if (index === eligible.length) {
        const overall = overallForRole(role, candidate);
        if (overall < target) return;
        const score = coherenceScore(candidate, original, current, role, target);
        const rank = [overall === target ? 0 : 1, overall - target, -score, eligible.map((stat) => candidate[stat]).join("")];
        if (!best || rank[0] < best.rank[0] || (rank[0] === best.rank[0] && (rank[1] < best.rank[1] || (rank[1] === best.rank[1] && (rank[2] < best.rank[2] || (rank[2] === best.rank[2] && rank[3] < best.rank[3])))))) best = { ratings: { ...candidate }, rank };
        return;
      }
      const stat = eligible[index];
      const minimum = minimums[stat];
      for (let value = minimum; value <= 10; value += 1) {
        candidate[stat] = value;
        const branchMin = boundOverall(index + 1, candidate, false);
        if (best) {
          if (best.rank[0] === 0 && branchMin > target) break;
          if (best.rank[0] === 1 && branchMin - target > best.rank[1]) break;
        }
        visit(index + 1, candidate);
      }
    }
    visit(0, { ...current });
    return best?.ratings || current;
  }

  function growPlayerStatsToTargetOverall({ role, originalStats, currentStats, currentOverall, targetOverall }) {
    if (Number(targetOverall) <= Number(currentOverall)) return { ...(currentStats || {}) };
    const originalRatings = toCodexRatings(originalStats || currentStats);
    const currentRatings = toCodexRatings(currentStats);
    const ratings = findBestCodexGrowthProfile({ role, originalRatings, currentRatings, targetOverall });
    const result = { ...(currentStats || {}) };
    for (const stat of FALLBACK_STAT_ORDER) {
      if (ratings[stat] > currentRatings[stat]) result[stat] = Number(result[stat] || 0) + ((ratings[stat] - currentRatings[stat]) * 10);
    }
    return result;
  }

  function planCodexTrainingGrowth(player, options = {}, addedBoost = 3) {
    const role=player?.position||player?.normalizedRole, original=toCodexRatings(player?.ratings||player?.stats||player);
    const applications=normalizePotentialBoostApplications(options,Math.max(0,99-clampPotential(player?.finalOverall)));
    const permanentBoost=applications.filter((entry)=>entry.permanent).reduce((sum,entry)=>sum+entry.amount,0);
    let current=findBestCodexGrowthProfile({role,originalRatings:original,currentRatings:original,targetOverall:clampPotential(Number(player?.finalOverall||0)+permanentBoost)});
    for(const application of applications)for(const[stat,delta]of Object.entries(application.codexDeltas||{}))current[stat]=Math.min(10,current[stat]+Number(delta||0));
    const targetOverall=clampPotential(Number(player?.finalOverall||0)+applications.reduce((sum,entry)=>sum+entry.amount,0)+Number(addedBoost||0));
    const next=findBestCodexGrowthProfile({role,originalRatings:original,currentRatings:current,targetOverall});
    return { currentRatings:current, ratings:next, targetOverall, codexDeltas:Object.fromEntries(FALLBACK_STAT_ORDER.map((stat)=>[stat,Math.max(0,next[stat]-current[stat])]).filter(([,delta])=>delta>0)) };
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
    const applications=normalizePotentialBoostApplications(options,Math.max(0,99-clampPotential(player.finalOverall)));
    const trainingApplications=applications.filter((entry)=>entry.codexDeltas);
    const trainingBoost=trainingApplications.reduce((sum,entry)=>sum+entry.amount,0);
    const boostedStats = growPlayerStatsToTargetOverall({
      role: player.position || player.normalizedRole,
      originalStats: stats,
      currentStats: stats,
      originalOverall: baseOverall,
      currentOverall: baseOverall,
      targetOverall: Math.max(baseOverall,overall-trainingBoost),
    });
    for(const application of trainingApplications)for(const[stat,delta]of Object.entries(application.codexDeltas))boostedStats[stat]=Math.min(99,Number(boostedStats[stat]||0)+(Number(delta)||0)*10);
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
    findBestCodexGrowthProfile,
    planCodexTrainingGrowth,
    overallForRole,
    toCodexRatings,
    calculateCanonicalOverall,
    weightedStatValue,
    ROLE_STAT_WEIGHTS,
    RARITY_THRESHOLDS,
  };

  global.InazumaProgression = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);