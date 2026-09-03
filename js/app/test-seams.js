(function (global) {
  "use strict";

  function install({
    testMode = false,
    app,
    getRun,
    setRun,
    getUi,
    setUiMatch,
    setSeasonDb,
    setActiveSeason,
    setSeasonPlayersById,
    setFreeAgentsDb,
    setFreeAgentsById,
    uiApi = {},
    recruitmentApi = {},
    initialDraftApi = {},
    terminalApi = {},
  } = {}) {
    global.__INAZUMA_UI_TEST__ = { ...uiApi, getRun: () => getRun?.() || null };
    if (!testMode) return false;

    function setContext(context = {}, mode = "recruitment") {
      if (context.run) {
        setRun?.(context.run);
        if (mode === "terminal") setUiMatch?.(context.run.activeMatch || null);
      }
      if (context.seasonDb) {
        setSeasonDb?.(context.seasonDb);
        const seasonId = mode === "recruitment"
          ? context.seasonDb.seasonId
          : (context.seasonDb.seasonId || context.run?.seasonId);
        setActiveSeason?.({ id: seasonId });
        setSeasonPlayersById?.(new Map((context.seasonDb.players || []).map((player) => [String(player.playerId), player])));
      }
      if (mode !== "terminal" && context.freeAgentsDb) {
        setFreeAgentsDb?.(context.freeAgentsDb);
        setFreeAgentsById?.(new Map((context.freeAgentsDb.players || []).map((player) => [String(player.playerId), player])));
      }
    }

    global.__INAZUMA_RECRUITMENT_TEST__ = {
      ...recruitmentApi,
      setContext: (context = {}) => setContext(context, "recruitment"),
      getRun: () => getRun?.() || null,
    };

    global.__INAZUMA_INITIAL_DRAFT_TEST__ = Object.freeze({
      ...initialDraftApi,
      setContext: (context = {}) => setContext(context, "initial-draft"),
      getRun: () => getRun?.() || null,
    });

    global.__INAZUMA_TERMINAL_FLOW_TEST__ = Object.freeze({
      ...terminalApi,
      setContext: (context = {}) => setContext(context, "terminal"),
      getRun: () => getRun?.() || null,
      getUi: () => getUi?.() || null,
      getAppMarkup: () => app?.innerHTML || "",
    });
    return true;
  }

  global.AppTestSeams = Object.freeze({ install });
})(globalThis);
