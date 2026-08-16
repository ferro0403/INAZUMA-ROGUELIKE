(function (global) {
  "use strict";

  const SEASON_3_COLLECTION_ID = "ie1_s3";
  const SEASON_3_FREE_AGENT_MINIMUM_OVERALL = 75;

  function effectiveFinalOverall(player) {
    const base = Number(player?.finalOverall || 0);
    const playerId = String(player?.playerId || player?.id || "");
    const permanent = Number(global.DevelopmentV2?.playerUpgrade?.(playerId)?.permanentTargetPotential || 0);
    return Math.max(base, permanent);
  }

  function freeAgentPlayers(players, collectionId) {
    const freeAgents = Array.isArray(players) ? players : [];
    if (collectionId !== SEASON_3_COLLECTION_ID) return freeAgents;
    return freeAgents.filter((player) => effectiveFinalOverall(player) >= SEASON_3_FREE_AGENT_MINIMUM_OVERALL);
  }

  const api = { SEASON_3_COLLECTION_ID, SEASON_3_FREE_AGENT_MINIMUM_OVERALL, effectiveFinalOverall, freeAgentPlayers };
  global.AlbumCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
