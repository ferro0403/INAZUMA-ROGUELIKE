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

  function clampLevel(level, maxLevel) {
    const numericLevel = Number.isFinite(Number(level)) ? Math.round(Number(level)) : 0;
    return Math.max(0, Math.min(maxLevel, numericLevel));
  }

  function decodeStat(code, statIndex, level, maxLevel, codeWidth) {
    const offset = (statIndex * (maxLevel + 1) + level) * codeWidth;
    return parseInt(code.slice(offset, offset + codeWidth), 36);
  }

  function getPlayerAtLevel(player, requestedLevel, database) {
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

    const overall = Number(player.finalOverall) - (maxLevel - level);
    return { ...player, ...stats, level, overall, stats };
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
  };

  global.InazumaProgression = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
