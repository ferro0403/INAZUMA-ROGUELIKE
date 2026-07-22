(function (global) {
  "use strict";

  const DEFAULT_SEASON_ID = "ie1";
  const SEASONS = Object.freeze({
    ie1: Object.freeze({ id: "ie1", name: "Inazuma Eleven 1", database: "data/IE1_season_compact.json", albumCollectionId: "ie1" }),
    ie2: Object.freeze({ id: "ie2", name: "Inazuma Eleven Ares", database: "data/IE2_season_compact.json", albumCollectionId: "ie2" }),
  });

  const dbBySeason = new Map();
  const playersBySeason = new Map();
  const teamsBySeason = new Map();
  let activeSeasonId = DEFAULT_SEASON_ID;

  function normalizeSeasonId(seasonId) { return SEASONS[String(seasonId || "")] ? String(seasonId) : DEFAULT_SEASON_ID; }
  function list() { return Object.values(SEASONS); }
  function get(seasonId = activeSeasonId) { return SEASONS[normalizeSeasonId(seasonId)]; }
  function setActive(seasonId) { activeSeasonId = normalizeSeasonId(seasonId); return get(activeSeasonId); }
  function activeId() { return activeSeasonId; }
  function isSeasonSource(source) { return !!SEASONS[String(source || "")]; }
  function sourceForSeason(seasonId = activeSeasonId) { return normalizeSeasonId(seasonId); }

  async function loadDatabase(seasonId = activeSeasonId) {
    const season = get(seasonId);
    if (dbBySeason.has(season.id)) { setActive(season.id); return dbBySeason.get(season.id); }
    const response = await fetch(season.database);
    if (!response.ok) throw new Error(`Database Season non raggiungibile: ${season.name}`);
    const database = await response.json();
    dbBySeason.set(season.id, database);
    playersBySeason.set(season.id, new Map((database.players || []).map((player) => [String(player.playerId), player])));
    teamsBySeason.set(season.id, new Map((database.teams || []).map((team) => [String(team.teamId ?? team.id), team])));
    setActive(season.id);
    return database;
  }
  function database(seasonId = activeSeasonId) { return dbBySeason.get(normalizeSeasonId(seasonId)) || null; }
  function playersIndex(seasonId = activeSeasonId) { return playersBySeason.get(normalizeSeasonId(seasonId)) || new Map(); }
  function teamsIndex(seasonId = activeSeasonId) { return teamsBySeason.get(normalizeSeasonId(seasonId)) || new Map(); }
  function player(playerId, seasonId = activeSeasonId) { return playersIndex(seasonId).get(String(playerId)); }
  function team(teamId, seasonId = activeSeasonId) { return teamsIndex(seasonId).get(String(teamId)) || null; }

  global.SeasonRegistry = { DEFAULT_SEASON_ID, SEASONS, list, get, normalizeSeasonId, setActive, activeId, isSeasonSource, sourceForSeason, loadDatabase, database, playersIndex, teamsIndex, player, team };
})(globalThis);
