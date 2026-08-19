(function (global) {
  "use strict";

  function emptyResult() {
    return {
      elevenChanged: false,
      fiveChanged: false,
      elevenReplacedPlayerId: null,
      fiveReplacedPlayerId: null,
      elevenReplacedPlayerIds: [],
      fiveReplacedPlayerIds: [],
    };
  }

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function rosterIds(run) {
    return (run?.roster || []).map((entry) => String(entry.playerId));
  }

  function scorePlayer(id, options, incumbents, rosterIndex) {
    const playerId = String(id);
    return {
      id: playerId,
      overall: numeric(options.getOverall?.(playerId)),
      potential: numeric(options.getPotential?.(playerId)),
      incumbent: incumbents.has(playerId) ? 1 : 0,
      rosterIndex: rosterIndex.get(playerId) ?? Number.MAX_SAFE_INTEGER,
    };
  }

  function compareScore(a, b) {
    return b.overall - a.overall
      || b.potential - a.potential
      || b.incumbent - a.incumbent
      || a.rosterIndex - b.rosterIndex
      || a.id.localeCompare(b.id);
  }

  function bestIdsForRole(run, role, count, options, incumbents = new Set()) {
    const roster = rosterIds(run);
    const rosterIndex = new Map(roster.map((id, index) => [id, index]));
    return roster
      .filter((id) => options.getRole(id) === role)
      .map((id) => scorePlayer(id, options, incumbents, rosterIndex))
      .sort(compareScore)
      .slice(0, count)
      .map((entry) => entry.id);
  }

  function sameIds(a, b) {
    return a.length === b.length && a.every((id, index) => String(id || "") === String(b[index] || ""));
  }

  function assignSelectedToElevenSlots(currentLineup, slotRoles, selectedByRole) {
    const next = Array(slotRoles.length).fill(null);
    const used = new Set();

    slotRoles.forEach((role, index) => {
      const currentId = currentLineup[index] ? String(currentLineup[index]) : null;
      if (!currentId || used.has(currentId)) return;
      if ((selectedByRole.get(role) || []).includes(currentId)) {
        next[index] = currentId;
        used.add(currentId);
      }
    });

    slotRoles.forEach((role, index) => {
      if (next[index]) return;
      const candidate = (selectedByRole.get(role) || []).find((id) => !used.has(id));
      if (!candidate) return;
      next[index] = candidate;
      used.add(candidate);
    });

    return next;
  }

  function optimizeEleven(run, options, result) {
    const slotRoles = Array.isArray(options.elevenSlotRoles) ? options.elevenSlotRoles : [];
    if (!slotRoles.length || typeof options.getRole !== "function" || typeof options.getOverall !== "function") return;

    const currentLineup = Array.isArray(run.lineup)
      ? run.lineup.slice(0, slotRoles.length).map((value) => value == null ? null : String(value))
      : [];
    while (currentLineup.length < slotRoles.length) currentLineup.push(null);

    const currentStarters = new Set(currentLineup.filter(Boolean));
    const selectedByRole = new Map();
    const roleCounts = new Map();
    slotRoles.forEach((role) => roleCounts.set(role, (roleCounts.get(role) || 0) + 1));

    roleCounts.forEach((count, role) => {
      selectedByRole.set(role, bestIdsForRole(run, role, count, options, currentStarters));
    });

    const nextLineup = assignSelectedToElevenSlots(currentLineup, slotRoles, selectedByRole);
    if (nextLineup.some((id) => !id) || sameIds(currentLineup, nextLineup)) return;

    const nextStarters = new Set(nextLineup.filter(Boolean));
    const removed = currentLineup.filter((id) => id && !nextStarters.has(id));
    run.lineup = nextLineup;
    run.bench = rosterIds(run).filter((id) => !nextStarters.has(id));
    result.elevenChanged = true;
    result.elevenReplacedPlayerIds = removed;
    result.elevenReplacedPlayerId = removed[0] || null;
  }

  function optimizeFive(run, options, result) {
    const five = run.fiveVFive;
    const formation = options.fiveFormation;
    if (!five?.slots || !formation?.slots || typeof options.getRole !== "function" || typeof options.getOverall !== "function") return;

    const currentSlots = Object.fromEntries(formation.slots.map((slot) => [slot.key, five.slots[slot.key] ? String(five.slots[slot.key]) : null]));
    const incumbents = new Set(Object.values(currentSlots).filter(Boolean));
    const selectedByRole = new Map();
    const roleCounts = new Map();
    formation.slots.forEach((slot) => roleCounts.set(slot.role, (roleCounts.get(slot.role) || 0) + 1));
    roleCounts.forEach((count, role) => selectedByRole.set(role, bestIdsForRole(run, role, count, options, incumbents)));

    const nextSlots = {};
    const used = new Set();
    formation.slots.forEach((slot) => {
      const currentId = currentSlots[slot.key];
      if (currentId && (selectedByRole.get(slot.role) || []).includes(currentId) && !used.has(currentId)) {
        nextSlots[slot.key] = currentId;
        used.add(currentId);
      } else {
        nextSlots[slot.key] = null;
      }
    });
    formation.slots.forEach((slot) => {
      if (nextSlots[slot.key]) return;
      const candidate = (selectedByRole.get(slot.role) || []).find((id) => !used.has(id));
      if (!candidate) return;
      nextSlots[slot.key] = candidate;
      used.add(candidate);
    });

    if (formation.slots.some((slot) => !nextSlots[slot.key])) return;
    const unchanged = formation.slots.every((slot) => currentSlots[slot.key] === nextSlots[slot.key]);
    if (unchanged) return;

    const nextAssigned = new Set(Object.values(nextSlots).filter(Boolean));
    const removed = Object.values(currentSlots).filter((id) => id && !nextAssigned.has(id));
    five.slots = nextSlots;
    result.fiveChanged = true;
    result.fiveReplacedPlayerIds = removed;
    result.fiveReplacedPlayerId = removed[0] || null;
  }

  function optimizeAllLineups(run, options = {}) {
    const result = emptyResult();
    if (!run || options.enabled !== true) return result;
    if (typeof options.getRole !== "function" || typeof options.getOverall !== "function") return result;
    optimizeEleven(run, options, result);
    optimizeFive(run, options, result);
    return result;
  }

  function optimizeLineupsForNewPlayer(run, playerId, options = {}) {
    const id = String(playerId);
    if (!rosterIds(run).includes(id)) return emptyResult();
    return optimizeAllLineups(run, options);
  }

  global.SmartLineup = {
    optimizeAllLineups,
    optimizeLineupsForNewPlayer,
  };
})(globalThis);
