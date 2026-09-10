(function (global) {
  "use strict";

  function create({ app, fetchResource = (...args) => global.fetch(...args), escapeHtml, persistenceWritesAllowed, renderHome, setRun, getActiveSeason, setActiveSeason, setSeasonDb, setSeasonPlayersById, setSeasonTeamsById, setFreeAgentsDb, setFreeAgentsById, setPlayerVisualsById }) {
    let developmentDatabasesSignaled = false;
    function signalDevelopmentDatabasesReady(ok = true) {
      if (ok) global.__INAZUMA_DEVELOPMENT_DATABASES_READY__ = true;
      else global.__INAZUMA_DEVELOPMENT_DATABASES_FAILED__ = true;
      if (developmentDatabasesSignaled) return;
      developmentDatabasesSignaled = true;
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent("inazuma:development-databases-ready", { detail: { ok } }));
      }
    }

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
      const persistenceError = /restore-recovery-required|restore-repair-needed|canonical-unrecoverable|storage-access-error|legacy-cloud-target-not-immutable|restore-terminal-error|album-indexeddb-authority|hall-indexeddb-authority|development-indexeddb-authority/i.test(code);
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
      const indexedDbAlbumAvailable = Boolean(global.AlbumIndexedDbStorage);
      return global.AlbumProgress.configureFreeAgentIds(playerIds, { persist: indexedDbAlbumAvailable ? false : persistenceWritesAllowed() });
    }

    async function preparePermanentAlbumStorage() {
      if (!global.AlbumIndexedDbStorage) return { authority: "legacy", migrated: false, unavailable: true };
      const result = await global.AlbumIndexedDbStorage.ensureReady();
      if (result?.authority === "indexeddb") {
        await global.AlbumIndexedDbStorage.recompact();
        await global.AlbumPermanentEffects?.resumeStoredRuns?.();
      }
      return result;
    }

    async function preparePermanentHallStorage() {
      if (!global.HallOfFameStorage?.ensureIndexedDbReady) return { authority: "legacy", migrated: false, unavailable: true };
      const result = await global.HallOfFameStorage.ensureIndexedDbReady();
      if (result?.authority === "indexeddb") await global.HallOfFameStorage.refreshIndexedDbArchive();
      return result;
    }

    async function preparePermanentDevelopmentStorage() {
      if (!global.DevelopmentIndexedDbStorage?.ensureReady) return { authority: "legacy", migrated: false, unavailable: true };
      const result = await global.DevelopmentIndexedDbStorage.ensureReady();
      if (result?.authority === "indexeddb") await global.DevelopmentIndexedDbStorage.refresh();
      return result;
    }

    async function preparePermanentStorage() {
      const album = await preparePermanentAlbumStorage();
      const hall = await preparePermanentHallStorage();
      const development = await preparePermanentDevelopmentStorage();
      let cleanup = { ok: true, skipped: true, reason: "cleanup-unavailable" };
      if (global.PermanentLegacyCleanup?.cleanup) {
        try { cleanup = await global.PermanentLegacyCleanup.cleanup(); }
        catch (error) {
          cleanup = { ok: false, skipped: false, reason: error?.code || "legacy-cleanup-failed", error };
          global.console?.warn?.("Permanent legacy localStorage cleanup failed", error?.code || error);
        }
      }
      return { album, hall, development, cleanup };
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
        signalDevelopmentDatabasesReady(true);
        configureAlbumForBootstrap((freeAgentsDb.players || []).map((player) => player.playerId));
        await preparePermanentStorage();
        setFreeAgentsById(new Map(freeAgentsDb.players.map((player) => [String(player.playerId), player])));
        setPlayerVisualsById(new Map(Object.entries(visualsDb.players || {})));
        await renderHome();
      } catch (error) {
        signalDevelopmentDatabasesReady(false);
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
        signalDevelopmentDatabasesReady(true);
        configureAlbumForBootstrap((context.freeAgentsDb.players || []).map((player) => player.playerId));
      }
      setActiveSeason(context.activeSeason || getActiveSeason());
      return true;
    }

    return Object.freeze({ loadSeason, showLoadError, configureAlbumForBootstrap, preparePermanentAlbumStorage, preparePermanentHallStorage, preparePermanentDevelopmentStorage, preparePermanentStorage, init, setPermanentClubTestContext, signalDevelopmentDatabasesReady });
  }

  global.AppBootstrapRuntime = Object.freeze({ create });
})(globalThis);
