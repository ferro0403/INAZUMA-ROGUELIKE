(function (global) {
  "use strict";

  function create({
    getRun,
    setRun,
    getUi,
    setUiMatch,
    getAppMarkup,
    setSeasonDb,
    setActiveSeason,
    setSeasonPlayersById,
    setFreeAgentsDb,
    setFreeAgentsById,
    uiTest,
    recruitment,
    initialDraft,
    terminal,
  }) {
    function applyContext(context = {}, { includeFreeAgents = false, syncUiMatch = false, seasonFallbackToRun = false } = {}) {
      if (context.run) {
        setRun(context.run);
        if (syncUiMatch) setUiMatch(context.run.activeMatch || null);
      }
      if (context.seasonDb) {
        setSeasonDb(context.seasonDb);
        setActiveSeason({ id: context.seasonDb.seasonId || (seasonFallbackToRun ? context.run?.seasonId : undefined) });
        setSeasonPlayersById(new Map((context.seasonDb.players || []).map((player) => [String(player.playerId), player])));
      }
      if (includeFreeAgents && context.freeAgentsDb) {
        setFreeAgentsDb(context.freeAgentsDb);
        setFreeAgentsById(new Map((context.freeAgentsDb.players || []).map((player) => [String(player.playerId), player])));
      }
    }

    function install() {
      global.__INAZUMA_UI_TEST__ = { ...uiTest, getRun };
      if (global.__INAZUMA_TEST_MODE__ !== true) return;

      global.__INAZUMA_RECRUITMENT_TEST__ = {
        ...recruitment,
        setContext: (context = {}) => applyContext(context, { includeFreeAgents: true }),
        getRun,
      };

      global.__INAZUMA_INITIAL_DRAFT_TEST__ = Object.freeze({
        ...initialDraft,
        setContext: (context = {}) => applyContext(context, { includeFreeAgents: true, seasonFallbackToRun: true }),
        getRun,
      });

      global.__INAZUMA_TERMINAL_FLOW_TEST__ = Object.freeze({
        ...terminal,
        setContext: (context = {}) => applyContext(context, { syncUiMatch: true, seasonFallbackToRun: true }),
        getRun,
        getUi,
        getAppMarkup,
      });
    }

    return Object.freeze({ install, applyContext });
  }

  global.AppTestSeams = Object.freeze({ create });
})(globalThis);
