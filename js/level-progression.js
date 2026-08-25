(function (global) {
  "use strict";

  const LEVEL_UNITS_PER_LEVEL = 6;
  const MAX_LEVEL = 20;
  const FIVE_V_FIVE_REWARDS = Object.freeze({
    ie1: Object.freeze({ amount: 0.5, units: null, text: "+0,5 livello" }),
    ie2: Object.freeze({ amount: 0.5, units: null, text: "+0,5 livello" }),
    ie1_s2: Object.freeze({ amount: 1 / 3, units: 2, text: "+1/3 livello" }),
    ie1_s3: Object.freeze({ amount: 1 / 3, units: 2, text: "+1/3 livello" }),
    orion: Object.freeze({ amount: 1 / 3, units: 2, text: "+1/3 livello" }),
  });

  function fiveVFiveLevelReward(seasonId) {
    return FIVE_V_FIVE_REWARDS[String(seasonId)] || FIVE_V_FIVE_REWARDS.ie1;
  }

  function formatLegacyLevel(value) {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return "0";
    const rounded = Math.round(numeric * 100) / 100;
    const stable = Math.abs(rounded - Math.round(rounded)) < 1e-9 ? Math.round(rounded) : rounded;
    return String(stable).replace(".", ",");
  }

  function normalizedLevelParts(level, units) {
    const safeLevel = Math.max(0, Math.floor(Number(level || 0)));
    const safeUnits = Math.max(0, Math.round(Number(units || 0)));
    const totalUnits = Math.min(MAX_LEVEL * LEVEL_UNITS_PER_LEVEL, safeLevel * LEVEL_UNITS_PER_LEVEL + safeUnits);
    return { level: Math.floor(totalUnits / LEVEL_UNITS_PER_LEVEL), units: totalUnits % LEVEL_UNITS_PER_LEVEL };
  }

  function formatLevel(levelOrEntry, seasonId, explicitUnits = null) {
    const entry = levelOrEntry && typeof levelOrEntry === "object" ? levelOrEntry : null;
    const level = entry ? (entry.level ?? entry.teamLevel ?? 0) : levelOrEntry;
    const resolvedSeason = seasonId || entry?.seasonId;
    if (!["ie1_s2", "ie1_s3", "orion"].includes(resolvedSeason)) return formatLegacyLevel(level);
    const units = explicitUnits == null ? (entry?.levelUnits ?? entry?.teamLevelUnits ?? 0) : explicitUnits;
    const parts = normalizedLevelParts(level, units);
    if (!parts.units) return String(parts.level);
    const fraction = parts.units === 2 ? "1/3" : parts.units === 3 ? "0,5" : parts.units === 4 ? "2/3" : `${parts.units}/6`;
    return `${parts.level} + ${fraction}`;
  }

  function applyRewardToRun(run, reward) {
    if (["ie1_s2", "ie1_s3", "orion"].includes(run.seasonId)) {
      const units = Number(reward.units ?? Math.round(Number(reward.amount || 0) * LEVEL_UNITS_PER_LEVEL));
      const apply = (target, levelKey, unitsKey) => {
        const parts = normalizedLevelParts(target[levelKey], Number(target[unitsKey] || 0) + units);
        target[levelKey] = parts.level;
        target[unitsKey] = parts.units;
      };
      apply(run, "teamLevel", "teamLevelUnits");
      (run.roster || []).forEach((entry) => apply(entry, "level", "levelUnits"));
    } else {
      const amount = Number(reward.amount || 0);
      run.teamLevel = Math.min(MAX_LEVEL, Number(run.teamLevel || 0) + amount);
      (run.roster || []).forEach((entry) => { entry.level = Math.min(MAX_LEVEL, Number(entry.level || 0) + amount); });
    }
    return run;
  }

  global.LevelProgression = { LEVEL_UNITS_PER_LEVEL, MAX_LEVEL, fiveVFiveLevelReward, formatLegacyLevel, formatLevel, normalizedLevelParts, applyRewardToRun };
})(globalThis);
