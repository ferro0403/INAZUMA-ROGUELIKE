(function (global) {
  "use strict";

  const CAPACITY_RARITIES = Object.freeze(["Buono", "Forte", "Elite", "Mondiale", "Leggenda"]);
  const FILTER_RARITIES = Object.freeze(["Tutti", "Normale", ...CAPACITY_RARITIES]);
  const SORT_WEIGHT = Object.freeze({ Normale: 0, Buono: 1, Forte: 2, Elite: 3, Mondiale: 4, Leggenda: 5 });

  function playerIndex(database) {
    return new Map((database?.players || []).map((player) => [String(player.playerId), player]));
  }

  function buildSlotSummary(state, account) {
    const usage = account.slotUsage(state);
    return CAPACITY_RARITIES.map((rarity) => {
      const used = Number(usage?.[rarity] || 0);
      const capacity = Number(account.slotCapacity(rarity));
      return { rarity, used, capacity, display: `${used} / ${capacity}`, overCapacity: used > capacity };
    });
  }

  function buildRows(state, database, V3) {
    const byId = playerIndex(database);
    return Object.entries(state?.players || {}).flatMap(([playerId, chain]) => {
      const steps = Array.isArray(chain?.steps) ? chain.steps : [];
      const activeColored = steps.at(-1);
      const active = activeColored || chain?.legacyNormale;
      if (!active) return [];
      const base = byId.get(String(playerId));
      if (!base) return [{ playerId: String(playerId), name: `Giocatore non disponibile (${playerId})`, role: "—", missingIdentity: true, detailPlayer: null, activeRarity: activeColored?.rarity || "Normale", activePotential: Number(active.toPotential), path: [] }];
      const activeRarity = activeColored?.rarity || "Normale";
      const path = [{ kind: "base", rarity: String(base.category), potential: Number(base.finalOverall) }];
      if (chain.legacyNormale) path.push({ kind: "legacyNormale", rarity: "Normale", potential: Number(chain.legacyNormale.toPotential) });
      steps.forEach((step) => path.push({ kind: "step", rarity: String(step.rarity), potential: Number(step.toPotential) }));
      let detailPlayer = null;
      try {
        const decoded = V3.resolveValidatedMaterializedPlayer(base, active.profile, active.profile.maxLevel);
        detailPlayer = { ...decoded, baseStats: decoded.stats, displayLevel: active.profile.maxLevel, albumDatabase: database };
      } catch (_) { /* A malformed materialized profile remains visible but cannot open a misleading sheet. */ }
      const destination = path.at(-2);
      const receipt = active.receipt || { coinsConsumed: 0, cupsConsumed: 0, cupsConsumedBySource: {} };
      const regression = {
        activeId: String(activeColored?.stepId || active.migrationId),
        from: { rarity: activeRarity, potential: Number(active.toPotential) },
        to: { rarity: destination.rarity, potential: destination.potential, isBase: destination.kind === "base", isBaseline: destination.kind === "legacyNormale" },
        refund: { coins: Number(receipt.coinsConsumed), cups: Number(receipt.cupsConsumed), cupsBySource: { ...(receipt.cupsConsumedBySource || {}) }, projects: 0 },
      };
      return [{ playerId: String(playerId), name: String(base.name || playerId), role: String(base.position || base.role || "—"), base, missingIdentity: false, detailPlayer, activeRarity, activePotential: Number(active.toPotential), path, regression }];
    }).sort((a, b) => (SORT_WEIGHT[b.activeRarity] || 0) - (SORT_WEIGHT[a.activeRarity] || 0) || a.name.localeCompare(b.name, "it", { sensitivity: "base" }) || a.playerId.localeCompare(b.playerId));
  }

  function buildModel({ state, database, account, V3 }) {
    return { slots: buildSlotSummary(state, account), rows: buildRows(state, database, V3) };
  }

  function filterRows(rows, rarity = "Tutti") {
    return rarity === "Tutti" ? rows : rows.filter((row) => row.activeRarity === rarity);
  }

  const api = { CAPACITY_RARITIES, FILTER_RARITIES, SORT_WEIGHT, playerIndex, buildSlotSummary, buildRows, buildModel, filterRows };
  global.DevelopmentManagementV3 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
