(function (global) {
  "use strict";

  const DEFAULT_SEASON_ID = "ie1";
  const SEASONS = Object.freeze({
    ie1: Object.freeze({ id: "ie1", name: "Inazuma Eleven 1", displaySeasonNumber: "1", database: "data/IE1_season_compact.json", albumCollectionId: "ie1" }),
    ie1_s2: Object.freeze({ id: "ie1_s2", name: "Inazuma Eleven 2", displaySeasonNumber: "2", database: "data/IE1_S2_season_compact.json", albumCollectionId: "ie1_s2" }),
    ie1_s3: Object.freeze({ id: "ie1_s3", name: "Inazuma Eleven 3", displaySeasonNumber: "3", database: "data/IE1_S3_season_compact.json", albumCollectionId: "ie1_s3" }),
    ie2: Object.freeze({ id: "ie2", name: "Inazuma Eleven Ares", displaySeasonNumber: "1", database: "data/IE2_season_compact.json", albumCollectionId: "ie2" }),
  });

  const DISPLAY_ORDER = Object.freeze(["ie1", "ie1_s2", "ie1_s3", "ie2"]);

  const DISPLAY_TEAM_NAME_OVERRIDES = Object.freeze({
    ie1_s2: Object.freeze({
      alpine_ie2: "Alpine",
      raimon_inazuma_eleven_2: "Raimon",
    }),
  });

  const dbBySeason = new Map();
  const playersBySeason = new Map();
  const teamsBySeason = new Map();
  let activeSeasonId = DEFAULT_SEASON_ID;

  function normalizeSeasonId(seasonId) { return SEASONS[String(seasonId || "")] ? String(seasonId) : DEFAULT_SEASON_ID; }
  function list() { return DISPLAY_ORDER.map((seasonId) => SEASONS[seasonId]).filter(Boolean); }
  function get(seasonId = activeSeasonId) { return SEASONS[normalizeSeasonId(seasonId)]; }
  function setActive(seasonId) { activeSeasonId = normalizeSeasonId(seasonId); return get(activeSeasonId); }
  function activeId() { return activeSeasonId; }
  function isSeasonSource(source) { return !!SEASONS[String(source || "")]; }
  function sourceForSeason(seasonId = activeSeasonId) { return normalizeSeasonId(seasonId); }

  function applyDisplayTeamNameOverrides(database, seasonId) {
    const overrides = DISPLAY_TEAM_NAME_OVERRIDES[String(seasonId || "")];
    if (!database || !overrides) return database;

    const applyToEntry = (entry) => {
      if (!entry) return;
      const teamId = String(entry.teamId ?? entry.id ?? "");
      if (overrides[teamId]) entry.teamName = overrides[teamId];
    };

    [database.teams, database.bossOrder, database.specialMatches, database.profiles]
      .filter(Array.isArray)
      .forEach((entries) => entries.forEach(applyToEntry));

    return database;
  }

  async function loadDatabase(seasonId = activeSeasonId) {
    const season = get(seasonId);
    if (dbBySeason.has(season.id)) { setActive(season.id); return dbBySeason.get(season.id); }
    const response = await fetch(season.database);
    if (!response.ok) throw new Error(`Database Season non raggiungibile: ${season.name}`);
    const database = await response.json();
    if (database.seasonId && String(database.seasonId) !== season.id) throw new Error(`Database Season non valido: atteso ${season.id}`);
    if (season.id === "ie1_s2") {
      const counts = database.validation?.counts || {};
      const formation253 = database.formations?.eleven?.some((formation) => formation.id === "2-5-3");
      const genesis = database.bossOrder?.find((boss) => boss.teamId === "genesis");
      const raimon = database.bossOrder?.find((boss) => boss.teamId === "raimon_inazuma_eleven_2");
      const valid = database.requiresProfileAwareRuntime === true && database.teams?.length === 17 && database.bossOrder?.length === 10 && database.specialMatches?.length === 7 && database.players?.length === 203 && database.profiles?.length === 230 && counts.multiProfilePlayers === 27 && counts.roleSwitchProfiles === 4 && database.warnings?.length === 0 && formation253 && genesis?.bossLevel === 15 && raimon?.bossLevel === 19;
      if (!valid) throw new Error("Database Inazuma Eleven 2 non supera la validazione runtime");
    }
    if (season.id === "ie1_s3") {
      const counts = database.validation?.counts || {};
      const valid = database.requiresProfileAwareRuntime === true
        && database.teams?.length === 41 && database.bossOrder?.length === 12
        && database.specialMatches?.length === 7 && database.players?.length === 584
        && database.profiles?.length === 584 && database.recruitmentPool?.entries?.length === 291
        && database.globalFreeAgentPatch?.players?.length === 3
        && counts.teams === 41 && counts.bosses === 12 && counts.specialMatches === 7
        && counts.canonicalPlayers === 584 && counts.profiles === 584
        && counts.recruitmentPoolPlayers === 291 && counts.newGlobalFreeAgents === 3
        && counts.combinedUniqueGameplayPlayers === 587 && counts.roleSwitchProfiles === 4
        && counts.warnings === 0 && counts.sourceValidationBossPlayers === 184
        && database.warnings?.length === 0 && database.validation?.status === "passed";
      if (!valid) throw new Error("Database Inazuma Eleven 3 non supera la validazione runtime");
    }
    applyDisplayTeamNameOverrides(database, season.id);
    dbBySeason.set(season.id, database);
    playersBySeason.set(season.id, new Map((database.players || []).map((player) => [String(player.playerId), player])));
    teamsBySeason.set(season.id, new Map((database.teams || []).map((team) => [String(team.teamId ?? team.id), team])));
    global.ProfiledSeasonRuntime?.register?.(season.id, database);
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
