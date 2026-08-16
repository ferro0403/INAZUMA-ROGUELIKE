(function (global) {
  "use strict";

  function emptyResult() {
    return { elevenChanged: false, fiveChanged: false, elevenReplacedPlayerId: null, fiveReplacedPlayerId: null };
  }

  function optimizeLineupsForNewPlayer(run, playerId, options = {}) {
    const result = emptyResult();
    if (!run || options.enabled !== true) return result;
    const id = String(playerId);
    const owned = new Set((run.roster || []).map((entry) => String(entry.playerId)));
    if (!owned.has(id) || typeof options.getRole !== "function" || typeof options.getOverall !== "function") return result;
    const role = options.getRole(id);
    const overall = Number(options.getOverall(id)) || 0;

    const slotRoles = Array.isArray(options.elevenSlotRoles) ? options.elevenSlotRoles : [];
    const lineup = Array.isArray(run.lineup) ? run.lineup.map((value) => value == null ? null : String(value)) : [];
    const compatibleIndexes = slotRoles.map((slotRole, index) => slotRole === role ? index : -1).filter((index) => index >= 0);
    const emptyIndex = compatibleIndexes.find((index) => !lineup[index]);
    let elevenIndex = emptyIndex;
    if (elevenIndex == null) {
      const weakest = compatibleIndexes
        .map((index) => ({ index, id: lineup[index], overall: Number(options.getOverall(lineup[index])) || 0 }))
        .filter((entry) => entry.id && entry.id !== id)
        .sort((a, b) => a.overall - b.overall || a.index - b.index)[0];
      if (weakest && overall > weakest.overall) elevenIndex = weakest.index;
    }
    if (elevenIndex != null && lineup[elevenIndex] !== id && !lineup.includes(id)) {
      result.elevenReplacedPlayerId = lineup[elevenIndex] || null;
      lineup[elevenIndex] = id;
      run.lineup = lineup;
      const starters = new Set(lineup.filter(Boolean));
      run.bench = (run.roster || []).map((entry) => String(entry.playerId)).filter((ownedId) => !starters.has(ownedId));
      result.elevenChanged = true;
    }

    const five = run.fiveVFive;
    const formation = options.fiveFormation;
    if (five?.slots && formation?.slots) {
      const roleSlots = formation.slots.filter((slot) => slot.role === role);
      let target = roleSlots.find((slot) => !five.slots[slot.key]);
      if (!target) {
        const weakest = roleSlots
          .map((slot) => ({ slot, id: five.slots[slot.key], overall: Number(options.getOverall(five.slots[slot.key])) || 0 }))
          .filter((entry) => entry.id && String(entry.id) !== id)
          .sort((a, b) => a.overall - b.overall || String(a.slot.key).localeCompare(String(b.slot.key)))[0];
        if (weakest && overall > weakest.overall) target = weakest.slot;
      }
      const alreadyAssigned = Object.values(five.slots).some((value) => String(value) === id);
      if (target && !alreadyAssigned) {
        result.fiveReplacedPlayerId = five.slots[target.key] || null;
        if (typeof options.assignFive === "function") options.assignFive(target.key, id);
        else five.slots[target.key] = id;
        result.fiveChanged = true;
      }
    }
    return result;
  }

  global.SmartLineup = { optimizeLineupsForNewPlayer };
})(globalThis);
