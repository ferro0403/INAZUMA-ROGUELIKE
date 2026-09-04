(function (global) {
  "use strict";
  function create({ getRun, fiveVFive, getRole, getOverall, smartLineup, getPreferences, formationById, toast, persistMutation, matchIdentity, canonicalMatch, onPersistenceFailure }) {
    function ensure(current = getRun()) {
      if (!current || !current.roster?.length) return null;
      return fiveVFive.ensure(current, (id) => getRole(id, current), (id) => getOverall(id, current));
    }
    function status(current = getRun(), { autoFill = false } = {}) {
      if (!current) return { valid: false, messages: ["Run non disponibile"], assignedCount: 0, formation: fiveVFive.formationById(null) };
      const snapshot = typeof structuredClone === "function" ? structuredClone(current) : JSON.parse(JSON.stringify(current));
      if (autoFill) ensure(snapshot);
      return fiveVFive.validate(snapshot, (id) => getRole(id, snapshot));
    }
    function optimizeForNewPlayer(playerId, current = getRun(), announce = true) {
      const formation = formationById(current?.formationId) || formationById("4-3-3");
      const result = smartLineup.optimizeLineupsForNewPlayer(current, playerId, {
        enabled: getPreferences().smartAutoLineup,
        getRole: (id) => getRole(id, current), getOverall: (id) => getOverall(id, current), elevenSlotRoles: formation.slotRoles,
        fiveFormation: current?.fiveVFive ? fiveVFive.formationById(current.fiveVFive.formation) : null,
        assignFive: (slotKey, id) => fiveVFive.assign(current, slotKey, id, (candidateId) => getRole(candidateId, current)),
      });
      if (announce && (result.elevenChanged || result.fiveChanged)) {
        const areas = [result.elevenChanged ? "11v11" : null, result.fiveChanged ? "5v5" : null].filter(Boolean).join(" e ");
        toast(`AUTO-FORMAZIONE — aggiornata ${areas}`);
      }
      return result;
    }
    function commit(label, mutate, options = {}) {
      const active = getRun()?.activeMatch;
      const expectedIdentity = options.guardActiveFiveMatch !== false && active?.type === "five_v_five" ? matchIdentity(active) : null;
      return persistMutation({ label, mutate: (current) => { if (expectedIdentity) canonicalMatch(current, expectedIdentity); return mutate(current); }, onCommitted: options.onCommitted, rerender: options.rerender || ((result) => { if (!result.ok) onPersistenceFailure?.(); }) });
    }
    return { ensure, status, optimizeForNewPlayer, commit };
  }
  global.FiveVFiveControllerRuntime = { create };
})(globalThis);
