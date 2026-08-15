(function (global) {
  "use strict";

  const SEASON_3_COLLECTION_ID = "ie1_s3";
  const SEASON_3_FREE_AGENT_MINIMUM_OVERALL = 75;

  function freeAgentPlayers(players, collectionId) {
    const freeAgents = Array.isArray(players) ? players : [];
    if (collectionId !== SEASON_3_COLLECTION_ID) return freeAgents;
    return freeAgents.filter((player) => Number(player?.finalOverall) >= SEASON_3_FREE_AGENT_MINIMUM_OVERALL);
  }

  const api = { SEASON_3_COLLECTION_ID, SEASON_3_FREE_AGENT_MINIMUM_OVERALL, freeAgentPlayers };
  global.AlbumCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
