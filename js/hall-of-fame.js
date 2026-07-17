(function (global) {
  "use strict";

  const STORAGE_KEY = "inazuma.hallOfFame.v1";
  const BACKUP_KEY = `${STORAGE_KEY}.backup`;
  const TEMP_KEY = `${STORAGE_KEY}.tmp`;
  const ARCHIVE_SCHEMA_VERSION = 1;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso() { return new Date().toISOString(); }
  function stableId(key) { return `hall_${String(key || "unknown").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")}`; }
  function archiveKeyFor(snapshot) { return [snapshot.runId, snapshot.modeId, snapshot.seasonId, snapshot.finalBossId].map((part) => String(part || "unknown")).join("::"); }
  function emptyArchive() { return { schemaVersion: ARCHIVE_SCHEMA_VERSION, updatedAt: nowIso(), teams: [], index: [] }; }
  function isValidTeam(team) { return !!(team && typeof team === "object" && team.hallTeamId && team.archiveKey && team.runId && Array.isArray(team.finalStartingEleven) && Array.isArray(team.fullRoster)); }
  function sanitizeArchive(input) {
    const archive = input && typeof input === "object" ? input : emptyArchive();
    const seen = new Set();
    const teams = (Array.isArray(archive.teams) ? archive.teams : []).filter(isValidTeam).filter((team) => {
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
  function saveArchive(archive) {
    const clean = sanitizeArchive({ ...archive, updatedAt: nowIso() });
    const json = JSON.stringify(clean);
    localStorage.setItem(TEMP_KEY, json);
    parse(localStorage.getItem(TEMP_KEY));
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) localStorage.setItem(BACKUP_KEY, existing);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.removeItem(TEMP_KEY);
    return clean;
  }
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
  function award(id, label, player, reason, score) { return player ? { id, label, playerId: player.playerId, playerName: player.name, portraitUrl: player.portraitUrl || null, reason, score } : null; }
  function calculateAwards(players, playerStats) {
    const stat = (p) => playerStats[String(p.playerId)] || {};
    const appeared = players.filter((p) => Number(stat(p).appearancesTotal || 0) > 0 || p.formationSlot != null);
    const best = (scoreFn) => appeared.slice().sort((a, b) => scoreFn(b) - scoreFn(a) || String(a.name).localeCompare(String(b.name)) || String(a.playerId).localeCompare(String(b.playerId)))[0] || null;
    const topScorer = best((p) => Number(stat(p).goals || 0));
    const keeper = best((p) => (p.role === "GK" ? Number(stat(p).saves || 0) + Number(p.finalOverall || 0) / 100 : -1));
    const defender = best((p) => (p.role === "DF" ? Number(stat(p).defensiveStops || 0) + Number(p.finalStats?.defense || 0) / 100 : -1));
    const improved = best((p) => Number(p.finalOverall || 0) - Number(p.recruitedOverall ?? p.finalOverall ?? 0));
    const finalHero = best((p) => Number(stat(p).goals || 0) * 3 + Number(stat(p).saves || 0) + Number(stat(p).defensiveStops || 0));
    const mvp = best((p) => Number(stat(p).goals || 0) * 4 + Number(stat(p).saves || 0) * 2 + Number(stat(p).defensiveStops || 0) * 2 + Number(stat(p).winsAsStarter || 0) + Number(p.finalOverall || 0) / 10);
    return [award("mvp", "MVP della run", mvp, "Impatto combinato su presenze, eventi e overall finale", null), award("top_scorer", "Capocannoniere", topScorer, "Maggior numero di gol registrati", stat(topScorer || {}).goals), award("best_keeper", "Miglior portiere", keeper, "Parate e valore finale da portiere", null), award("defensive_pillar", "Pilastro difensivo", defender, "Chiusure difensive e difesa finale", null), award("most_improved", "Giocatore più cresciuto", improved, "Crescita di overall dal reclutamento", null), award("final_hero", "Eroe della finale", finalHero, "Miglior impatto negli eventi congelati", null)].filter(Boolean);
  }
  function addChampion(snapshot) {
    const archive = loadArchive();
    const archiveKey = snapshot.archiveKey || archiveKeyFor(snapshot);
    const existing = archive.teams.find((team) => team.archiveKey === archiveKey);
    if (existing) return { team: clone(existing), created: false };
    const hallTeamId = snapshot.hallTeamId || stableId(archiveKey);
    const team = clone({ ...snapshot, archiveSchemaVersion: ARCHIVE_SCHEMA_VERSION, archiveKey, hallTeamId, createdAt: nowIso() });
    archive.teams.push(team);
    const saved = saveArchive(archive);
    return { team: clone(saved.teams.find((item) => item.archiveKey === archiveKey)), created: true };
  }
  function listTeams() { return loadArchive().teams.map(lightSummary); }
  function listSummaries() { return loadArchive().index.map((item, index) => ({ ...item, ordinal: index + 1 })); }
  function getTeam(hallTeamId) { const team = loadArchive().teams.find((item) => item.hallTeamId === hallTeamId); return team ? clone(team) : null; }
  function removeTeam(hallTeamId) { const archive = loadArchive(); const teams = archive.teams.filter((item) => item.hallTeamId !== hallTeamId); saveArchive({ ...archive, teams }); }

  global.HallOfFameStorage = { STORAGE_KEY, BACKUP_KEY, TEMP_KEY, ARCHIVE_SCHEMA_VERSION, archiveKeyFor, stableId, addChampion, listTeams, listSummaries, getTeam, removeTeam, calculateAwards, _loadArchive: loadArchive };
})(globalThis);
