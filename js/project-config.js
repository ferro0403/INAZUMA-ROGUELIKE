(function (global) {
  "use strict";

  const GROUP_WEIGHTS = Object.freeze({ usage: 0.25, role: 0.25, boss: 0.30, final: 0.20 });
  const ROLE_TARGETS = (FW, MF, DF, GK) => Object.freeze({ FW, MF, DF, GK });
  const stages = [
    { id: "pre-white", from: ["Scarso", "Debole"], to: "Normale", cost: 100, wins: 3, bossWins: 1, role: ROLE_TARGETS(1, 3, 2, 2), finalRoster: true },
    { id: "white-green", from: ["Normale"], to: "Buono", cost: 400, wins: 5, bossWins: 2, bossStreak: 2, role: ROLE_TARGETS(2, 5, 3, 3), finalRoster: true },
    { id: "green-blue", from: ["Buono"], to: "Forte", cost: 800, wins: 7, bossWins: 3, bossStreak: 2, firstAttempts: 1, role: ROLE_TARGETS(4, 8, 5, 5), finalStarter: true },
    { id: "blue-purple", from: ["Forte"], to: "Elite", cost: 1500, wins: 10, bossWins: 5, bossStreak: 3, firstAttempts: 2, maxDefeats: 1, role: ROLE_TARGETS(6, 12, 7, 7), finalStarter: true },
    { id: "purple-red", from: ["Elite"], to: "Mondiale", cost: 2000, wins: 12, bossWins: 6, bossStreak: 4, firstAttempts: 3, minLives: 2, importantStarts: 3, role: ROLE_TARGETS(9, 16, 10, 10), finalStarter: true },
    { id: "red-gold", from: ["Mondiale"], to: "Leggenda", cost: 3000, wins: 15, bossWins: 8, bossStreak: 6, firstAttempts: 5, maxDefeats: 0, allInitialLives: true, importantStarts: 3, role: ROLE_TARGETS(12, 22, 14, 14), finalStarter: true, noTestTools: true },
  ].map(Object.freeze);

  const DEFAULT_MODE = Object.freeze({ id: "default", minimumBossesForCoins: 5, coinsPerBoss: 10, finalPhaseMatches: 3, importantMatchTypes: ["boss", "final"], legitimateEndReasons: ["victory", "lives-exhausted"] });

  function mode(overrides = {}) {
    return { ...DEFAULT_MODE, ...overrides, importantMatchTypes: [...(overrides.importantMatchTypes || DEFAULT_MODE.importantMatchTypes)] };
  }
  function stageForRarity(rarity) { return stages.find((stage) => stage.from.includes(rarity)) || null; }
  function thresholdFor(rarity) { return global.InazumaProgression?.RARITY_THRESHOLDS?.find((entry) => entry.category === rarity)?.min ?? null; }

  const api = Object.freeze({ schemaVersion: 1, GROUP_WEIGHTS, stages: Object.freeze(stages), DEFAULT_MODE, mode, stageForRarity, thresholdFor });
  global.ProjectConfig = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
