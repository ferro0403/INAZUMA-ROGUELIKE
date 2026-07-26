(function (global) {
  "use strict";

  const STORAGE_KEY = "inazuma.hallOfFame.v1";
  const BACKUP_KEY = `${STORAGE_KEY}.backup`;
  const TEMP_KEY = `${STORAGE_KEY}.tmp`;
  const ARCHIVE_SCHEMA_VERSION = 2;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso() { return new Date().toISOString(); }
  function stableId(key) { return `hall_${String(key || "unknown").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")}`; }
  function archiveKeyFor(snapshot) { return [snapshot.runId, snapshot.modeId, snapshot.seasonId, snapshot.finalBossId].map((part) => String(part || "unknown")).join("::"); }
  function emptyArchive() { return { schemaVersion: ARCHIVE_SCHEMA_VERSION, updatedAt: nowIso(), teams: [], index: [] }; }
  function isQuotaError(error) {
    return !!error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || Number(error.code) === 22 || Number(error.code) === 1014);
  }
  function stripTechnicalRunStatistics(input) {
    const stats = input && typeof input === "object" ? clone(input) : {};
    delete stats.processedMatchIds;
    delete stats.processedActionIds;
    return stats;
  }
  function compactPlayerStatistics(input, emergency = false) {
    const source = input && typeof input === "object" ? input : {};
    const essentialKeys = new Set([
      "playerId", "role", "appearances", "appearancesTotal", "wins", "goals", "shots", "saves", "cleanSheets",
      "defensiveActions", "defensiveStops", "averageRating", "bestRating", "overallGrowth", "finalLevel", "finalOverall",
      "recruitedAtLevel", "recruitedOverall", "finalAppearances", "finalMatchRating", "finalMatchGoals", "finalMatchSaves",
      "finalMatchDefensiveActions", "bossWins", "playerNameSnapshot", "portraitUrlSnapshot"
    ]);
    return Object.fromEntries(Object.entries(source).map(([playerId, raw]) => {
      const stats = raw && typeof raw === "object" ? clone(raw) : {};
      if (!emergency) return [playerId, stats];
      return [playerId, Object.fromEntries(Object.entries(stats).filter(([key, value]) => essentialKeys.has(key) && value !== null && value !== undefined && value !== ""))];
    }));
  }
  function compactPlayer(input, emergency = false) {
    const player = input && typeof input === "object" ? clone(input) : input;
    if (!player || typeof player !== "object") return player;
    if (emergency) {
      delete player.fullbodyUrl;
      delete player.traits;
    }
    return player;
  }
  function compactTeam(input, { emergency = false } = {}) {
    const team = input && typeof input === "object" ? clone(input) : {};
    team.archiveSchemaVersion = ARCHIVE_SCHEMA_VERSION;
    delete team.matchHistory;
    team.runStatistics = stripTechnicalRunStatistics(team.runStatistics);
    team.playerStatistics = compactPlayerStatistics(team.playerStatistics, emergency);
    team.finalStartingEleven = (Array.isArray(team.finalStartingEleven) ? team.finalStartingEleven : []).map((player) => compactPlayer(player, emergency));
    team.fullRoster = (Array.isArray(team.fullRoster) ? team.fullRoster : []).map((player) => compactPlayer(player, emergency));
    team.bench = (Array.isArray(team.bench) ? team.bench : []).map((player) => compactPlayer(player, emergency));
    if (emergency) {
      delete team.finalFormationTactics;
      delete team.rulesetVersion;
      delete team.databaseVersion;
      delete team.formationTacticsVersion;
      delete team.equipmentVersion;
      delete team.traitSystemVersion;
      delete team.sourceAppVersion;
    }
    return team;
  }
  function isValidTeam(team) { return !!(team && typeof team === "object" && team.hallTeamId && team.archiveKey && team.runId && Array.isArray(team.finalStartingEleven) && Array.isArray(team.fullRoster)); }
  function lightSummary(team, index = null) {
    const mvp = (team.awards || []).find((award) => award.id === "mvp") || (team.awards || [])[0] || null;
    return {
      hallTeamId: team.hallTeamId,
      archiveKey: team.archiveKey,
      teamName: team.teamName,
      teamLogo: team.teamLogo || null,
      modeName: team.modeName,
      seasonName: team.seasonName,
      victoryDate: team.victoryDate,
      finalFormation: team.finalFormation,
      finalAverageOverall: team.finalAverageOverall,
      wins: team.runStatistics?.winsTotal ?? null,
      losses: team.runStatistics?.lossesTotal ?? null,
      livesRemaining: team.livesRemaining ?? null,
      mvp: mvp ? { playerId: mvp.playerId, name: mvp.playerName, portraitUrl: mvp.portraitUrl } : null,
      portraits: (team.finalStartingEleven || []).slice(0, 4).map((player) => player.portraitUrl).filter(Boolean),
      ordinal: index == null ? null : index + 1,
    };
  }
  function sanitizeArchive(input, options = {}) {
    const archive = input && typeof input === "object" ? input : emptyArchive();
    const seen = new Set();
    const teams = (Array.isArray(archive.teams) ? archive.teams : []).map((team) => compactTeam(team, options)).filter(isValidTeam).filter((team) => {
      if (seen.has(team.archiveKey)) return false;
      seen.add(team.archiveKey);
      return true;
    });
    teams.sort((a, b) => String(b.victoryDate || "").localeCompare(String(a.victoryDate || "")));
    return { schemaVersion: ARCHIVE_SCHEMA_VERSION, updatedAt: archive.updatedAt || nowIso(), teams, index: teams.map(lightSummary) };
  }
  function parse(raw) { return sanitizeArchive(raw ? JSON.parse(raw) : emptyArchive()); }
  function loadArchive() {
    for (const key of [STORAGE_KEY, BACKUP_KEY, TEMP_KEY]) {
      try { const raw = localStorage.getItem(key); if (raw) return parse(raw); } catch (_) {}
    }
    return emptyArchive();
  }
  function writePrimaryArchive(archive) {
    const json = JSON.stringify(archive);
    localStorage.removeItem(TEMP_KEY);
    localStorage.removeItem(BACKUP_KEY);
    localStorage.setItem(STORAGE_KEY, json);
    return parse(localStorage.getItem(STORAGE_KEY));
  }
  function saveArchive(archive) {
    const clean = sanitizeArchive({ ...archive, updatedAt: nowIso() });
    try {
      return writePrimaryArchive(clean);
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      const emergency = sanitizeArchive(clean, { emergency: true });
      try {
        return writePrimaryArchive(emergency);
      } catch (retryError) {
        retryError.hallOfFameSaveFailed = true;
        throw retryError;
      }
    }
  }
  function award(id, label, player, reason, score) { return player ? { id, label, playerId: player.playerId, playerName: player.name, portraitUrl: player.portraitUrl || null, reason, score } : null; }
  function calculateAwards(players, playerStats) {
    const stat = (p) => playerStats[String(p.playerId)] || {};
    const appeared = players.filter((p) => Number(stat(p).appearancesTotal || 0) > 0 || p.formationSlot != null);
    const withGrowth = appeared.map((player) => ({ player, growth: Number(player.finalOverall) - Number(player.recruitedOverall) })).filter(({ growth }) => Number.isFinite(growth) && growth > 0);
    const improved = withGrowth.sort((a, b) => b.growth - a.growth || String(a.player.name).localeCompare(String(b.player.name)) || String(a.player.playerId).localeCompare(String(b.player.playerId)))[0];
    return improved ? [award("most_improved", "Giocatore più cresciuto", improved.player, "Premio basato sulla crescita di overall realmente salvata nella run", improved.growth)] : [];
  }
  function addChampion(snapshot) {
    const archive = loadArchive();
    const archiveKey = snapshot.archiveKey || archiveKeyFor(snapshot);
    const existing = archive.teams.find((team) => team.archiveKey === archiveKey);
    if (existing) return { team: clone(existing), created: false, persisted: true };
    const hallTeamId = snapshot.hallTeamId || stableId(archiveKey);
    const team = compactTeam({ ...snapshot, archiveSchemaVersion: ARCHIVE_SCHEMA_VERSION, archiveKey, hallTeamId, createdAt: nowIso() });
    archive.teams.push(team);
    try {
      const saved = saveArchive(archive);
      return { team: clone(saved.teams.find((item) => item.archiveKey === archiveKey)), created: true, persisted: true };
    } catch (error) {
      console.error("Unable to save Hall of Fame archive", error);
      return { team: clone(compactTeam(team, { emergency: true })), created: true, persisted: false, error: { name: error?.name || "Error", message: error?.message || String(error) } };
    }
  }
  function listTeams() { return loadArchive().teams.map(lightSummary); }
  function listSummaries() { return loadArchive().index.map((item, index) => ({ ...item, ordinal: index + 1 })); }
  function getTeam(hallTeamId) { const team = loadArchive().teams.find((item) => item.hallTeamId === hallTeamId); return team ? clone(team) : null; }
  function removeTeam(hallTeamId) { const archive = loadArchive(); const teams = archive.teams.filter((item) => item.hallTeamId !== hallTeamId); saveArchive({ ...archive, teams }); }

  global.HallOfFameStorage = { STORAGE_KEY, BACKUP_KEY, TEMP_KEY, ARCHIVE_SCHEMA_VERSION, archiveKeyFor, stableId, addChampion, listTeams, listSummaries, getTeam, removeTeam, calculateAwards, _loadArchive: loadArchive, _saveArchive: saveArchive, _compactTeam: compactTeam };
})(globalThis);
