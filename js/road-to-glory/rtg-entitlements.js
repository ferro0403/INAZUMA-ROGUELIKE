(function (global) {
  "use strict";

  function roleOf(player) {
    return String(player?.normalizedRole || player?.position || player?.role || "").trim().toUpperCase();
  }

  function unlockedFreeAgentIds({ albumProgress, freeAgentsDb } = {}) {
    const progress = albumProgress?.read?.() || {};
    const unlocked = new Set(Object.keys(progress.sharedUnlockedPlayerIds || {}).map(String));
    return (freeAgentsDb?.players || [])
      .map((player) => String(player?.playerId || ""))
      .filter((playerId) => playerId && unlocked.has(playerId));
  }

  function accessStatus({ albumProgress, freeAgentsDb, formations } = {}) {
    const unlockedIds = unlockedFreeAgentIds({ albumProgress, freeAgentsDb });
    if (unlockedIds.length < 15) {
      return Object.freeze({ unlocked: false, count: unlockedIds.length, reason: "minimum-free-agents", formationIds: Object.freeze([]) });
    }

    const unlockedSet = new Set(unlockedIds);
    const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    (freeAgentsDb?.players || []).forEach((player) => {
      const playerId = String(player?.playerId || "");
      if (!unlockedSet.has(playerId)) return;
      const role = roleOf(player);
      if (Object.prototype.hasOwnProperty.call(counts, role)) counts[role] += 1;
    });

    const validFormationIds = (Array.isArray(formations) ? formations : [])
      .filter((formation) => formation && typeof formation.requirements === "object")
      .filter((formation) => Object.entries(formation.requirements).every(([role, amount]) => Number(counts[String(role).toUpperCase()] || 0) >= Number(amount || 0)))
      .map((formation) => String(formation.id || ""))
      .filter(Boolean);

    if (!validFormationIds.length) {
      return Object.freeze({ unlocked: false, count: unlockedIds.length, reason: "no-valid-formation", formationIds: Object.freeze([]) });
    }

    return Object.freeze({ unlocked: true, count: unlockedIds.length, reason: null, formationIds: Object.freeze(validFormationIds) });
  }

  global.RoadToGloryEntitlements = Object.freeze({ unlockedFreeAgentIds, accessStatus });
})(globalThis);
