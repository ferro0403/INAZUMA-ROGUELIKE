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

  function getTradeCandidates({ outgoingPlayer, rosterIds, freeAgents, seasonPlayers, unlockedTeamIds, teams }) {
    if (!outgoingPlayer) return [];
    const owned = new Set((rosterIds || []).map(String));
    const unlocked = new Set((unlockedTeamIds || []).map(String));
    const unlockedPlayerIds = new Set(
      (teams || [])
        .filter((team) => unlocked.has(String(team.teamId)))
        .flatMap((team) => (team.playerIds || []).map(String))
    );
    const combined = [
      ...(freeAgents || []).map((player) => ({ player, source: "free_agents" })),
      ...(seasonPlayers || [])
        .filter((player) => unlockedPlayerIds.has(String(player.playerId)))
        .map((player) => ({ player, source: "season1" })),
    ];
    const unique = new Map();
    combined.forEach((candidate) => {
      const id = String(candidate.player.playerId);
      if (owned.has(id)) return;
      if (candidate.player.position !== outgoingPlayer.position) return;
      if (Number(candidate.player.finalOverall) < Number(outgoingPlayer.finalOverall)) return;
      if (!unique.has(id)) unique.set(id, candidate);
    });
    return [...unique.values()];
  }

  function applyEquipment(stats, equipment) {
    const result = { ...stats };
    if (equipment?.stat && Number.isFinite(Number(equipment.bonus))) {
      result[equipment.stat] = Number(result[equipment.stat] || 0) + Number(equipment.bonus);
    }
    return result;
  }

  global.RoguelikeRules = {
    unlockedPullLevel,
    defeatedBossRewardLevel,
    migrateDefeatedBossPlayerLevels,
    getTradeCandidates,
    applyEquipment,
  };
})(globalThis);
