(function (global) {
  "use strict";

  const PROFILED_MIXED_COLLECTION_IDS = new Set(["ie1_s3", "orion"]);
  const SEASON_3_COLLECTION_ID = "ie1_s3";
  const SEASON_3_FREE_AGENT_MINIMUM_OVERALL = 75;

  function effectiveFinalOverall(player) {
    const base = Number(player?.finalOverall || 0);
    const permanent = Number(global.DevelopmentRuntime?.resolveAccountPlayer?.(player, Number(player?.maxLevel || 20))?.potential || 0);
    return Math.max(base, permanent);
  }

  function freeAgentPlayers(players, collectionId) {
    const freeAgents = Array.isArray(players) ? players : [];
    if (!PROFILED_MIXED_COLLECTION_IDS.has(collectionId)) return freeAgents;
    return freeAgents.filter((player) => effectiveFinalOverall(player) >= SEASON_3_FREE_AGENT_MINIMUM_OVERALL);
  }

  const api = { SEASON_3_COLLECTION_ID, SEASON_3_FREE_AGENT_MINIMUM_OVERALL, effectiveFinalOverall, freeAgentPlayers };
  global.AlbumCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
