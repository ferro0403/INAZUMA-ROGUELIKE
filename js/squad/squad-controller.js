(function (global) {
  "use strict";

  function create({ getRun, formations, getRole, resolveEntry, resolveSource, persistMutation, rosterInvariants }) {
    const formationById = (id) => formations().find((formation) => formation.id === id);

    function rosterCounts(current = getRun()) {
      const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
      (current?.roster || []).forEach((entry) => {
        const role = getRole(entry.playerId, current);
        if (counts[role] !== undefined) counts[role] += 1;
      });
      return counts;
    }

    function canUseFormation(formation, current = getRun()) {
      const counts = rosterCounts(current);
      return Boolean(formation) && Object.entries(formation.requirements).every(([role, amount]) => counts[role] >= amount);
    }

    function autoArrangeFormation(current, formation) {
      if (!canUseFormation(formation, current)) throw new Error("La rosa non copre tutti i ruoli del modulo");
      const available = (current.roster || []).map((entry) => ({ entry, role: getRole(entry.playerId, current) }));
      const used = new Set();
      const lineup = formation.slotRoles.map((role) => {
        const candidate = available.find(({ entry, role: effectiveRole }) => effectiveRole === role && !used.has(String(entry.playerId)));
        if (!candidate) throw new Error(`Not enough ${role} players`);
        used.add(String(candidate.entry.playerId));
        return String(candidate.entry.playerId);
      });
      current.formationId = formation.id;
      current.lineup = lineup;
      current.bench = (current.roster || []).map((entry) => String(entry.playerId)).filter((id) => !used.has(id));
      rosterInvariants?.assertValid?.(current);
      return current;
    }

    function reconcileRosterState(current = getRun()) {
      const rosterIds = (current.roster || []).map((entry) => String(entry.playerId || "")).filter(Boolean);
      const rosterSet = new Set(rosterIds);
      const lineupIds = (current.lineup || []).map(String).filter(Boolean);
      const lineupSet = new Set(lineupIds);
      const currentBench = (current.bench || []).map(String).filter((id) => rosterSet.has(id) && !lineupSet.has(id));
      const canonicalBench = [...new Set(currentBench)];
      rosterIds.filter((id) => !lineupSet.has(id) && !canonicalBench.includes(id)).slice(0, Math.max(0, 4 - canonicalBench.length)).forEach((id) => canonicalBench.push(id));
      const changed = JSON.stringify(canonicalBench) !== JSON.stringify((current.bench || []).map(String));
      if (changed) current.bench = canonicalBench;
      return changed;
    }

    function validitySummary(current = getRun()) {
      const formation = formationById(current?.formationId);
      const lineupIds = (current?.lineup || []).map(String).filter(Boolean);
      const benchIds = (current?.bench || []).map(String).filter(Boolean);
      const lineupUnique = new Set(lineupIds); const benchUnique = new Set(benchIds);
      const unresolvedLineup = lineupIds.filter((id) => !resolveEntry(id, current) || !resolveSource(resolveEntry(id, current)));
      const unresolvedBench = benchIds.filter((id) => !resolveEntry(id, current) || !resolveSource(resolveEntry(id, current)));
      const overlap = benchIds.filter((id) => lineupUnique.has(id));
      const roleCounts = { GK: 0, DF: 0, MF: 0, FW: 0 };
      lineupIds.forEach((id) => { const role = getRole(id, current); if (roleCounts[role] !== undefined) roleCounts[role] += 1; });
      let formationIssue = "";
      if (!formation) formationIssue = "Modulo non disponibile";
      else if (lineupIds.length !== 11) formationIssue = `${lineupIds.length}/11 titolari assegnati`;
      else if (lineupUnique.size !== lineupIds.length) formationIssue = "Sono presenti titolari duplicati";
      else if (unresolvedLineup.length) formationIssue = `${unresolvedLineup.length} titolari non risolvibili`;
      else { const mismatch = Object.entries(formation.requirements || {}).find(([role, amount]) => roleCounts[role] !== Number(amount)); if (mismatch) formationIssue = `Il modulo richiede ${mismatch[1]} ${mismatch[0]} · presenti ${roleCounts[mismatch[0]]}`; }
      const benchCount = new Set(benchIds.filter((id) => !unresolvedBench.includes(id) && !overlap.includes(id))).size;
      let rosterIssue = "";
      if (benchUnique.size !== benchIds.length) rosterIssue = "Riserve duplicate";
      else if (overlap.length) rosterIssue = "Giocatori presenti sia in campo sia in panchina";
      else if (unresolvedBench.length) rosterIssue = `${unresolvedBench.length} riserve non risolvibili`;
      else if (benchCount < 4) rosterIssue = `Rosa incompleta · ${benchCount}/4 riserve`;
      return { starters: lineupIds.length, bench: benchCount, formationValid: !formationIssue, formationIssue, rosterComplete: benchCount === 4 && !rosterIssue, rosterIssue, roleCounts };
    }

    function changeFormation(formationId, callbacks = {}) {
      const next = formationById(formationId);
      if (!next || !canUseFormation(next)) return { ok: false, unavailable: true };
      return persistMutation({ label: "formation-change", mutate: (current) => autoArrangeFormation(current, next), onCommitted: callbacks.onCommitted, rerender: callbacks.rerender });
    }

    function swapPlayers(firstId, secondId, callbacks = {}) {
      const first = String(firstId); const second = String(secondId);
      return persistMutation({
        label: "lineup-swap",
        mutate: (current) => {
          const firstArea = (current.lineup || []).map(String).includes(first) ? "lineup" : "bench";
          const secondArea = (current.lineup || []).map(String).includes(second) ? "lineup" : "bench";
          const firstList = current[firstArea]; const secondList = current[secondArea];
          const firstIndex = firstList.map(String).indexOf(first); const secondIndex = secondList.map(String).indexOf(second);
          if (firstIndex < 0 || secondIndex < 0 || getRole(first, current) !== getRole(second, current)) throw new Error("Questa destinazione non è compatibile");
          if (firstList === secondList) [firstList[firstIndex], firstList[secondIndex]] = [firstList[secondIndex], firstList[firstIndex]];
          else { firstList[firstIndex] = second; secondList[secondIndex] = first; }
          rosterInvariants?.assertValid?.(current);
          return { firstArea, secondArea };
        },
        onCommitted: callbacks.onCommitted,
        rerender: callbacks.rerender,
      });
    }
    return { formationById, rosterCounts, canUseFormation, autoArrangeFormation, reconcileRosterState, validitySummary, changeFormation, swapPlayers };
  }
  global.SquadControllerRuntime = { create };
})(globalThis);
