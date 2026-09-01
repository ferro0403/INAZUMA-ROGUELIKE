(function (global) {
  "use strict";

  function selectCandidates(available, random, categoryRank, eliteCategory = "Elite", count = 3, helpers = {}) {
    const selectBaseCandidates = helpers.selectCandidates;
    const shuffle = helpers.shuffle;
    if (typeof selectBaseCandidates !== "function" || typeof shuffle !== "function") {
      throw new Error("LegendaryPullRuntime requires selectCandidates and shuffle helpers");
    }

    const initiallySelected = selectBaseCandidates(available, random, count);
    const eliteRank = categoryRank(eliteCategory);
    if (initiallySelected.some((player) => categoryRank(player.category) >= eliteRank)) {
      return initiallySelected;
    }

    const selectedIds = new Set(initiallySelected.map((player) => String(player.playerId)));
    const guaranteedPool = available.filter(
      (player) => !selectedIds.has(String(player.playerId)) && categoryRank(player.category) >= eliteRank
    );
    if (!guaranteedPool.length) return initiallySelected;

    const guaranteed = selectBaseCandidates(guaranteedPool, random, 1)[0];
    if (!guaranteed) return initiallySelected;

    const candidates = initiallySelected.slice(0, Math.max(0, count - 1));
    candidates.push(guaranteed);
    return shuffle(candidates, random);
  }

  global.LegendaryPullRuntime = Object.freeze({ selectCandidates });
})(globalThis);
