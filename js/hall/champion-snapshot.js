(function (global) {
  "use strict";

  function create(deps = {}) {
    const {
      getRun,
      getSeasonDb,
      sourcePlayer,
      resolvedRosterPlayer,
      rosterEntry,
      playerPortraitUrl,
      resolvePlayerVisual,
      normalizeTeamIdentity,
    } = deps;

    if (typeof getRun !== "function" || typeof getSeasonDb !== "function") {
      throw new Error("ChampionSnapshotRuntime requires dynamic run/database getters");
    }

    function snapshotPlayer(entry, area, slot) {
      const run = getRun();
      const source = sourcePlayer(entry);
      const resolved = resolvedRosterPlayer(entry.playerId) || source || {};
      return {
        playerId: String(entry.playerId),
        profileId: entry.activeProfileId || null,
        roleVariantId: entry.activeRoleVariantId || null,
        name: resolved.name || source?.name || String(entry.playerId),
        nickname: resolved.nickname || null,
        role: resolved.position || source?.position || null,
        element: resolved.element || resolved.type || source?.element || null,
        portraitUrl: playerPortraitUrl(resolved || source),
        fullbodyUrl: resolvePlayerVisual(resolved || source, { playerId: entry.playerId }).frontFullbodyUrl || null,
        teamId: entry.teamId || source?.teamId || null,
        teamName: entry.teamName || source?.teamName || null,
        originalRarity: source?.category || null,
        finalRarity: resolved.category || source?.category || null,
        recruitedAtLevel: entry.recruitedAtLevel ?? null,
        finalLevel: Number(entry.level || 0),
        finalLevelUnits: Number(entry.levelUnits || 0),
        seasonId: run.seasonId,
        recruitedOverall: entry.recruitedOverall ?? null,
        finalOverall: resolved.overall ?? source?.finalOverall ?? null,
        finalPotential: resolved.potential ?? null,
        finalStats: resolved.stats || null,
        equippedItem: entry.equippedItem ? { ...entry.equippedItem } : null,
        formationSlot: area === "lineup" ? slot : null,
        benchSlot: area === "bench" ? slot : null,
        recruitmentSource: entry.source || null,
        traits: Array.isArray(entry.traits) ? entry.traits.slice() : [],
      };
    }

    function collectPlayerStatistics(players) {
      const run = getRun();
      const stats = {};
      players.forEach((player) => {
        stats[player.playerId] = {
          appearancesTotal: player.formationSlot != null ? 1 : 0,
          appearances5v5: 0,
          appearances11v11: player.formationSlot != null ? 1 : 0,
          winsAsStarter: player.formationSlot != null ? 1 : 0,
          goals: 0,
          saves: 0,
          defensiveStops: 0,
          shots: null,
          posts: null,
          crossbars: null,
          bossMatches: player.formationSlot != null ? 1 : 0,
          recruitedAtLevel: player.recruitedAtLevel,
          finalLevel: player.finalLevel,
          recruitedOverall: player.recruitedOverall,
          finalOverall: player.finalOverall,
          overallGrowth: player.recruitedOverall == null || player.finalOverall == null ? null : Number(player.finalOverall) - Number(player.recruitedOverall),
          equipmentUsed: player.equippedItem ? [player.equippedItem] : [],
        };
      });
      const timeline = run.activeMatch?.simulation?.timeline || [];
      timeline.forEach((event) => {
        const id = String(event.playerId || "");
        if (!stats[id]) return;
        if (event.type === "goal") stats[id].goals += 1;
        if (event.type === "save") stats[id].saves += 1;
        if (event.type === "defense") stats[id].defensiveStops += 1;
      });
      return stats;
    }

    function buildChampionSnapshot(finalBoss) {
      const run = getRun();
      const seasonDb = getSeasonDb();
      const identity = normalizeTeamIdentity(run.teamIdentity);
      const starters = run.lineup.map((id, index) => snapshotPlayer(rosterEntry(id), "lineup", index + 1)).filter(Boolean);
      const bench = run.bench.slice(0, 4).map((id, index) => snapshotPlayer(rosterEntry(id), "bench", index + 1)).filter(Boolean);
      const fullRoster = run.roster.map((entry) => snapshotPlayer(
        entry,
        run.lineup.includes(String(entry.playerId)) ? "lineup" : (run.bench.includes(String(entry.playerId)) ? "bench" : "roster"),
        run.lineup.indexOf(String(entry.playerId)) + 1 || run.bench.indexOf(String(entry.playerId)) + 1 || null,
      ));
      const avg = starters.length ? Math.round(starters.reduce((sum, player) => sum + Number(player.finalOverall || 0), 0) / starters.length) : null;
      global.RunStatistics?.snapshotFinalPlayerStats?.(run, fullRoster);
      const statsSnapshot = global.RunStatistics?.buildHallOfFameStatisticsSnapshot?.(run) || {
        runStatistics: {},
        playerStatistics: {},
        matchHistory: [],
        awards: [],
      };
      const seasonMeta = global.SeasonRegistry.get(run?.seasonId);
      const runStatistics = {
        ...statsSnapshot.runStatistics,
        mode: seasonMeta.name,
        season: seasonMeta.name,
        victoryDate: run.completedAt || new Date().toISOString(),
        seed: run.runId,
        durationMs: run.createdAt ? Date.now() - new Date(run.createdAt).getTime() : statsSnapshot.runStatistics.durationMs,
        finalTeamLevel: run.teamLevel ?? null,
        finalTeamLevelUnits: run.teamLevelUnits ?? 0,
        finalAverageOverall: avg,
        finalFormation: run.formationId,
        livesRemaining: run.lives ?? null,
        recruitedPlayers: run.roster.length,
        bossesDefeated: (run.completedBossIds || []).slice(),
      };
      const snapshot = {
        archiveSchemaVersion: 1,
        runId: run.runId,
        teamName: identity.name,
        teamLogo: identity.logo || "inazuma-lightning",
        modeId: seasonMeta.id,
        modeName: seasonMeta.name,
        seasonId: seasonMeta.id,
        seasonName: seasonMeta.name,
        difficultyId: null,
        victoryDate: run.completedAt || new Date().toISOString(),
        seed: run.runId,
        finalBossId: String(finalBoss?.teamId || "raimon"),
        finalBossName: finalBoss?.teamName || "Raimon",
        finalFormation: run.formationId,
        finalFormationTactics: global.MatchSimulator?.formationTactic?.(run.formationId) || null,
        finalStartingEleven: starters,
        fullRoster,
        bench,
        savedFiveVFiveFormation: run.fiveVFive ? JSON.parse(JSON.stringify(run.fiveVFive)) : null,
        finalTeamLevel: run.teamLevel ?? null,
        finalTeamLevelUnits: run.teamLevelUnits ?? 0,
        finalAverageOverall: avg,
        livesRemaining: run.lives ?? null,
        statisticsSchemaVersion: statsSnapshot.statisticsSchemaVersion || 1,
        statisticsComplete: statsSnapshot.statisticsComplete,
        statisticsStartedAt: statsSnapshot.statisticsStartedAt,
        runStatistics,
        playerStatistics: statsSnapshot.playerStatistics,
        matchHistory: statsSnapshot.matchHistory,
        awards: statsSnapshot.awards,
        rulesetVersion: "season1-config-v2",
        databaseVersion: seasonDb?.version || null,
        formationTacticsVersion: "match-simulator-config-v1",
        equipmentVersion: "season1-item-pool-v1",
        traitSystemVersion: null,
        sourceAppVersion: "hall-of-fame-v2-run-statistics",
      };
      snapshot.archiveKey = global.HallOfFameStorage.archiveKeyFor(snapshot);
      snapshot.hallTeamId = global.HallOfFameStorage.stableId(snapshot.archiveKey);
      return snapshot;
    }

    return Object.freeze({ snapshotPlayer, collectPlayerStatistics, buildChampionSnapshot });
  }

  global.ChampionSnapshotRuntime = Object.freeze({ create });
})(globalThis);
