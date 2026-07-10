(function (global) {
  "use strict";

  function unlockedPullLevel(seasonDatabase, currentBossIndex) {
    if (currentBossIndex <= 0) return 0;
    return Number(seasonDatabase.bossOrder[currentBossIndex - 1]?.bossLevel || 0);
  }

  function defeatedBossRewardLevel(boss) {
    return Number(boss?.bossLevel || 0);
  }

  function migrateDefeatedBossPlayerLevels(run, seasonDatabase) {
    if (!run || !Array.isArray(run.roster)) return 0;
    const completed = new Set((run.completedBossIds || []).map(String));
    const defeatedBosses = (seasonDatabase.bossOrder || []).filter((boss) =>
      completed.has(String(boss.teamId))
    );
    const teamsById = new Map(
      (seasonDatabase.teams || []).map((team) => [String(team.teamId), team])
    );
    let changed = 0;

    run.roster.forEach((entry) => {
      if (entry.source !== "season1") return;
      const playerId = String(entry.playerId);
      const minimumLevel = defeatedBosses.reduce((highest, boss) => {
        const team = teamsById.get(String(boss.teamId));
        if (!team?.playerIds?.map(String).includes(playerId)) return highest;
        return Math.max(highest, defeatedBossRewardLevel(boss));
      }, 0);
      if (Number(entry.level || 0) < minimumLevel) {
        entry.level = minimumLevel;
        changed += 1;
      }
    });
    return changed;
  }

  global.RoguelikeRules = {
    unlockedPullLevel,
    defeatedBossRewardLevel,
    migrateDefeatedBossPlayerLevels,
  };
})(globalThis);
