(function (global) {
  "use strict";

  function create(deps) {
    function opponentMeta(match) {
      const special = deps.runtime.byId(deps.getSeasonDb(), match?.specialMatchId);
      return special ? {
        special,
        name: special.teamName,
        logoUrl: special.logoUrl,
        formation: special.matchFormation,
        level: special.matchLevel,
        players: deps.runtime.teamPlayers(deps.getSeasonDb(), special),
      } : null;
    }

    return { opponentMeta };
  }

  global.SpecialMatchViewRuntime = { create };
})(globalThis);
