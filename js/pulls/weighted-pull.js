(function (global) {
  "use strict";

  function selectCandidates(available, random, categoryWeights = {}, count = 3) {
    const remaining = available.slice();
    const selected = [];
    while (remaining.length && selected.length < count) {
      const weighted = remaining.map((player) => ({
        player,
        weight: Math.max(0, Number(categoryWeights[player.category]) || 1),
      }));
      const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
      if (!total) break;
      let cursor = random() * total;
      const index = weighted.findIndex((entry) => {
        cursor -= entry.weight;
        return cursor <= 0;
      });
      const pickedIndex = index >= 0 ? index : weighted.length - 1;
      selected.push(weighted[pickedIndex].player);
      remaining.splice(pickedIndex, 1);
    }
    return selected;
  }

  global.WeightedPullRuntime = Object.freeze({ selectCandidates });
})(globalThis);
