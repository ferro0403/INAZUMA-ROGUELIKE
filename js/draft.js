(function (global) {
  "use strict";

  function hashSeed(value) {
    let hash = 2166136261;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function randomFromSeed(seed) {
    let state = hashSeed(seed) || 1;
    return function random() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(items, random) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function makeRoleSequence(formation) {
    const requirements = formation.requirements;
    return [
      ...Array(requirements.GK || 0).fill("GK"),
      ...Array(requirements.DF || 0).fill("DF"),
      ...Array(requirements.MF || 0).fill("MF"),
      ...Array(requirements.FW || 0).fill("FW"),
    ];
  }

  function makeCandidates(players, role, excludedIds, seed) {
    const random = randomFromSeed(seed);
    const pool = players.filter(
      (player) =>
        String(player.position || player.normalizedRole).toUpperCase() === role &&
        !excludedIds.includes(String(player.playerId))
    );
    return shuffle(pool, random).slice(0, 3).map((player) => String(player.playerId));
  }

  function start(run, formation, players) {
    const roles = makeRoleSequence(formation);
    run.draft = {
      roles,
      step: 0,
      selectedIds: [],
      excludedIds: [],
      candidates: [],
    };
    run.phase = "draft";
    prepareStep(run, players);
    return run;
  }

  function prepareStep(run, players) {
    const draft = run.draft;
    if (draft.step >= draft.roles.length) return [];
    const role = draft.roles[draft.step];
    const candidates = makeCandidates(
      players,
      role,
      draft.excludedIds,
      `${run.runId}:draft:${draft.step}:${role}`
    );
    draft.candidates = candidates;
    draft.excludedIds.push(...candidates);
    return candidates;
  }

  function choose(run, playerId, players, formation) {
    const draft = run.draft;
    if (!draft.candidates.includes(String(playerId))) {
      throw new Error("This player is not part of the current draft choice");
    }
    draft.selectedIds.push(String(playerId));
    draft.step += 1;

    if (draft.step < draft.roles.length) {
      prepareStep(run, players);
      return false;
    }

    const selectedByRole = { GK: [], DF: [], MF: [], FW: [] };
    draft.selectedIds.forEach((id, index) => selectedByRole[draft.roles[index]].push(id));
    const lineup = formation.slotRoles.map((role) => selectedByRole[role].shift());
    run.roster = draft.selectedIds.map((id) => ({
      playerId: id,
      source: "free_agents",
      level: 0,
    }));
    run.lineup = lineup;
    run.bench = [];
    run.draft = null;
    run.phase = "squad";
    return true;
  }

  global.DraftEngine = {
    randomFromSeed,
    shuffle,
    makeRoleSequence,
    makeCandidates,
    start,
    prepareStep,
    choose,
  };
})(globalThis);
