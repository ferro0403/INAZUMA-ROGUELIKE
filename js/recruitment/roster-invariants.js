(function (global) {
  "use strict";

  const canonicalId = (value) => global.PlayerIdentity.canonicalPlayerId(
    value && typeof value === "object" ? value : { playerId: value }
  );

  function inspect(run) {
    const roster = Array.isArray(run?.roster) ? run.roster : [];
    const lineup = Array.isArray(run?.lineup) ? run.lineup : [];
    const bench = Array.isArray(run?.bench) ? run.bench : [];
    const rosterIds = roster.map(canonicalId).filter(Boolean);
    const lineupIds = lineup.map(canonicalId).filter(Boolean);
    const benchIds = bench.map(canonicalId).filter(Boolean);
    const rosterSet = new Set(rosterIds);
    const duplicate = (ids) => ids.find((id, index) => ids.indexOf(id) !== index) || null;
    const errors = [];
    if (duplicate(rosterIds)) errors.push("roster-duplicate-canonical-player");
    if (duplicate(lineupIds)) errors.push("lineup-duplicate-canonical-player");
    if (duplicate(benchIds)) errors.push("bench-duplicate-canonical-player");
    if (lineupIds.some((id) => benchIds.includes(id))) errors.push("lineup-bench-canonical-overlap");
    if ([...lineupIds, ...benchIds].some((id) => !rosterSet.has(id))) errors.push("formation-player-not-in-roster");
    return { valid: errors.length === 0, errors, rosterIds, lineupIds, benchIds };
  }

  function assertValid(run) {
    const result = inspect(run);
    if (!result.valid) {
      const error = new Error(`Roster invariant violated: ${result.errors.join(", ")}`);
      error.code = "roster-invariant";
      error.details = result;
      throw error;
    }
    return result;
  }

  function assertCanOwn(run, player) {
    const playerId = canonicalId(player);
    if (!playerId || (run?.roster || []).some((entry) => canonicalId(entry) === playerId)) {
      const error = new Error("Canonical player is already owned");
      error.code = "canonical-player-owned";
      throw error;
    }
    return playerId;
  }

  global.RosterInvariants = Object.freeze({ inspect, assertValid, assertCanOwn });
})(globalThis);
