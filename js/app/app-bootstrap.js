(function (global) {
  "use strict";

  function create({ app, fetchResource = (...args) => global.fetch(...args), escapeHtml, persistenceWritesAllowed, renderHome, setRun, getActiveSeason, setActiveSeason, setSeasonDb, setSeasonPlayersById, setSeasonTeamsById, setFreeAgentsDb, setFreeAgentsById, setPlayerVisualsById }) {
    async function loadSeason(seasonId) {
      let activeSeason = global.SeasonRegistry.setActive(seasonId);
      setActiveSeason(activeSeason);
      const seasonDb = await global.SeasonRegistry.loadDatabase(activeSeason.id);
      setSeasonDb(seasonDb);
      global.DevelopmentRuntime?.registerDatabase?.(activeSeason.id, seasonDb);
      activeSeason = global.SeasonRegistry.get(activeSeason.id);
      setActiveSeason(activeSeason);
      setSeasonPlayersById(global.SeasonRegistry.playersIndex(activeSeason.id));
      setSeasonTeamsById(global.SeasonRegistry.teamsIndex(activeSeason.id));
      return seasonDb;
    }

    function showLoadError(error) {
      console.error(error);
      const code = String(error?.code || error?.message || "unknown-load-error");
      const persistenceError = /restore-recovery-required|restore-repair-needed|canonical-unrecoverable|storage-access-error|legacy-cloud-target-not-immutable|restore-terminal-error/i.test(code);
      const databaseError = !persistenceError && (global.location?.protocol === "file:" || /database|fetch|network|json|load failed|failed to fetch/i.test(code));
      const heading = databaseError ? "Caricamento database non riuscito" : "Avvio temporaneamente non disponibile";
      const guidance = databaseError
        ? "I browser possono bloccare i database JSON quando index.html viene aperto direttamente. Usa Live Server oppure il file AVVIA_GIOCO.bat."
        : "Apri Account per controllare lo stato del salvataggio o usare le operazioni di recupero disponibili.";
      const accountEntry = databaseError ? "" : `<div class="button-row">${global.InazumaAccountUI?.buttonMarkup?.() || ""}</div>`;
      app.innerHTML = `
      <main class="hero-screen"><div><p class="eyebrow">Caricamento non riuscito</p><h2>${heading}</h2>
      <p class="muted">${guidance}</p>
      <pre class="panel">${escapeHtml(code)}</pre>${accountEntry}</div></main>`;
      return app.innerHTML;
    }

    function configureAlbumForBootstrap(playerIds) {
      return global.AlbumProgress.configureFreeAgentIds(playerIds, { persist: persistenceWritesAllowed() });
    }

    async function init() {
      try {
        const [activeDb, freeAgentsResponse, visualsResponse] = await Promise.all([
          loadSeason(global.SeasonRegistry.DEFAULT_SEASON_ID),
          fetchResource("data/FREE_AGENTS_compact.json"),
          fetchResource("data/PLAYER_VISUALS.json"),
        ]);
        if (!activeDb || !freeAgentsResponse.ok || !visualsResponse.ok) throw new Error("Database non raggiungibili");
        const visualsDb = await visualsResponse.json();
        const freeAgentsDb = await freeAgentsResponse.json();
        setFreeAgentsDb(freeAgentsDb);
        global.DevelopmentRuntime?.registerDatabase?.("free-agents", freeAgentsDb);
        configureAlbumForBootstrap((freeAgentsDb.players || []).map((player) => player.playerId));
        setFreeAgentsById(new Map(freeAgentsDb.players.map((player) => [String(player.playerId), player])));
        setPlayerVisualsById(new Map(Object.entries(visualsDb.players || {})));
        await renderHome();
      } catch (error) {
        showLoadError(error);
      }
    }

    function setPermanentClubTestContext(context = {}) {
      if (global.__INAZUMA_TEST_MODE__ !== true) return false;
      if (Object.hasOwn(context, "run")) setRun(context.run);
      if (context.seasonDb) {
        setSeasonDb(context.seasonDb);
        setSeasonPlayersById(new Map((context.seasonDb.players || []).map((player) => [String(player.playerId), player])));
        setSeasonTeamsById(new Map((context.seasonDb.teams || []).map((team) => [String(team.teamId), team])));
      }
      if (context.freeAgentsDb) {
        setFreeAgentsDb(context.freeAgentsDb);
        setFreeAgentsById(new Map((context.freeAgentsDb.players || []).map((player) => [String(player.playerId), player])));
        global.DevelopmentRuntime?.registerDatabase?.("free-agents", context.freeAgentsDb);
        configureAlbumForBootstrap((context.freeAgentsDb.players || []).map((player) => player.playerId));
      }
      setActiveSeason(context.activeSeason || getActiveSeason());
      return true;
    }

    return Object.freeze({ loadSeason, showLoadError, configureAlbumForBootstrap, init, setPermanentClubTestContext });
  }

  global.AppBootstrapRuntime = Object.freeze({ create });
})(globalThis);
