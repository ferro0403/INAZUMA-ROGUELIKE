(function (global) {
  "use strict";

  const FORMATIONS = [
    {
      id: "1-2-1",
      name: "1-2-1",
      summary: "1 GK · 1 DF · 2 MF · 1 FW",
      slots: [
        { key: "FW", role: "FW", line: "attack" },
        { key: "MF1", role: "MF", line: "midfield" },
        { key: "MF2", role: "MF", line: "midfield" },
        { key: "DF", role: "DF", line: "defense" },
        { key: "GK", role: "GK", line: "goal" },
      ],
    },
    {
      id: "1-1-2",
      name: "1-1-2",
      summary: "1 GK · 1 DF · 1 MF · 2 FW",
      slots: [
        { key: "FW1", role: "FW", line: "attack" },
        { key: "FW2", role: "FW", line: "attack" },
        { key: "MF", role: "MF", line: "midfield" },
        { key: "DF", role: "DF", line: "defense" },
        { key: "GK", role: "GK", line: "goal" },
      ],
    },
  ];

  function formationById(id) {
    return FORMATIONS.find((formation) => formation.id === id) || FORMATIONS[0];
  }

  function emptySlots(formationId = "1-2-1") {
    return Object.fromEntries(formationById(formationId).slots.map((slot) => [slot.key, null]));
  }

  function ownedIds(run) {
    return new Set((run.roster || []).map((entry) => String(entry.playerId)));
  }

  function normalize(run) {
    const formation = formationById(run.fiveVFive?.formation);
    const current = run.fiveVFive?.slots || {};
    run.fiveVFive = {
      formation: formation.id,
      slots: Object.fromEntries(formation.slots.map((slot) => [slot.key, current[slot.key] ? String(current[slot.key]) : null])),
    };
    return run.fiveVFive;
  }

  function removeUnavailable(run) {
    if (!run.fiveVFive) return;
    const owned = ownedIds(run);
    Object.keys(run.fiveVFive.slots || {}).forEach((key) => {
      const id = run.fiveVFive.slots[key];
      if (id && !owned.has(String(id))) run.fiveVFive.slots[key] = null;
    });
  }

  function autoFill(run, getRole, getOverall = null) {
    const state = normalize(run);
    const owned = ownedIds(run);
    const used = new Set();
    formationById(state.formation).slots.forEach((slot) => {
      const id = state.slots[slot.key] ? String(state.slots[slot.key]) : null;
      const valid = id && owned.has(id) && getRole(id) === slot.role && !used.has(id);
      if (valid) {
        used.add(id);
        return;
      }
      state.slots[slot.key] = null;
      const candidates = (run.roster || [])
        .filter((entry) => {
          const candidateId = String(entry.playerId);
          return !used.has(candidateId) && owned.has(candidateId) && getRole(candidateId) === slot.role;
        })
        .sort((a, b) => Number(getOverall ? getOverall(b.playerId) : 0) - Number(getOverall ? getOverall(a.playerId) : 0));
      const candidate = candidates[0];
      if (!candidate) return;
      const candidateId = String(candidate.playerId);
      state.slots[slot.key] = candidateId;
      used.add(candidateId);
    });
  }

  function ensure(run, getRole, getOverall = null) {
    normalize(run);
    removeUnavailable(run);
    autoFill(run, getRole, getOverall);
    return run.fiveVFive;
  }

  function changeFormation(run, nextFormationId, getRole) {
    const previous = ensure(run, getRole);
    const previousIds = Object.values(previous.slots).filter(Boolean).map(String);
    const next = formationById(nextFormationId);
    const used = new Set();
    run.fiveVFive = { formation: next.id, slots: emptySlots(next.id) };
    next.slots.forEach((slot) => {
      const id = previousIds.find((candidate) => !used.has(candidate) && getRole(candidate) === slot.role);
      if (!id) return;
      run.fiveVFive.slots[slot.key] = id;
      used.add(id);
    });
    removeUnavailable(run);
    return run.fiveVFive;
  }

  function assign(run, slotKey, playerId, getRole) {
    const state = normalize(run);
    const slot = formationById(state.formation).slots.find((candidate) => candidate.key === slotKey);
    const id = String(playerId);
    if (!slot) throw new Error("Slot 5v5 non valido");
    if (!ownedIds(run).has(id)) throw new Error("Giocatore non presente in rosa");
    if (getRole(id) !== slot.role) throw new Error(`Serve un ${slot.role} per questo slot`);
    Object.keys(state.slots).forEach((key) => {
      if (state.slots[key] === id) state.slots[key] = null;
    });
    state.slots[slot.key] = id;
    return state;
  }

  function clearSlot(run, slotKey) {
    const state = normalize(run);
    if (Object.prototype.hasOwnProperty.call(state.slots, slotKey)) state.slots[slotKey] = null;
    return state;
  }

  function validate(run, getRole) {
    const state = normalize(run);
    removeUnavailable(run);
    const formation = formationById(state.formation);
    const owned = ownedIds(run);
    const seen = new Set();
    const messages = [];
    formation.slots.forEach((slot) => {
      const id = state.slots[slot.key];
      if (!id) {
        messages.push(`Slot ${slot.key} (${slot.role}) vuoto`);
        return;
      }
      if (!owned.has(String(id))) messages.push(`Giocatore ${id} non più in rosa`);
      if (seen.has(String(id))) messages.push(`Giocatore duplicato: ${id}`);
      seen.add(String(id));
      if (getRole(id) !== slot.role) messages.push(`${slot.key} richiede ${slot.role}`);
    });
    return {
      valid: messages.length === 0 && seen.size === 5,
      messages,
      assignedCount: seen.size,
      formation,
    };
  }

  global.FiveVFive = {
    formations: FORMATIONS,
    formationById,
    emptySlots,
    ensure,
    autoFill,
    changeFormation,
    assign,
    clearSlot,
    validate,
    removeUnavailable,
  };
})(globalThis);
