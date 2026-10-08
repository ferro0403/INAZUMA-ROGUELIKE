(function (global) {
  "use strict";

  const base = global.RoadToGloryMatchEngine;
  if (!base) return;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const otherSide = (side) => side === "user" ? "opponent" : "user";

  function secondHalfMinute(state, actionIndex) {
    const start = Number(state.firstHalfTarget) || Math.floor((Number(state.actionTarget) || 2) / 2);
    const end = Math.max(start + 1, Number(state.actionTarget) || start + 1);
    const index = Math.max(start, Math.min(end, Number(actionIndex) || start));
    const progress = (index - start) / (end - start);
    return Math.max(46, Math.min(90, 46 + Math.round(progress * 44)));
  }

  function normalizePendingMinute(state) {
    if (state?.period === "second_half" && state.pendingEncounter) {
      state.pendingEncounter.minute = secondHalfMinute(state, state.pendingEncounter.preparedAtActionIndex);
    }
    return state;
  }

  function normalizeNewSecondHalfLogs(state, fromLength, firstActionIndex) {
    if (!state?.log?.length || state.period !== "second_half") return state;
    let actionIndex = Number(firstActionIndex) || Number(state.firstHalfTarget) || 0;
    for (let i = fromLength; i < state.log.length; i += 1, actionIndex += 1) {
      if (state.log[i]?.period === "second_half") state.log[i].minute = secondHalfMinute(state, actionIndex);
    }
    return state;
  }

  function prepareNext(inputState) {
    const beforeLogLength = inputState?.log?.length || 0;
    const beforeActionIndex = Number(inputState?.actionIndex) || 0;
    const state = base.prepareNext(inputState);
    normalizeNewSecondHalfLogs(state, beforeLogLength, beforeActionIndex);
    return normalizePendingMinute(state);
  }

  function resolvePendingEncounter(inputState, userChoice) {
    const beforeLogLength = inputState?.log?.length || 0;
    const preparedAt = Number(inputState?.pendingEncounter?.preparedAtActionIndex ?? inputState?.actionIndex) || 0;
    const state = base.resolvePendingEncounter(inputState, userChoice);
    normalizeNewSecondHalfLogs(state, beforeLogLength, preparedAt);
    return normalizePendingMinute(state);
  }

  function confirmHalftime(inputState, nextSquad, deps) {
    const halftime = clone(inputState);
    const originalLog = clone(halftime.log || []);
    const originalHistory = clone(halftime.participantHistoryBySide || { user: [], opponent: [] });
    const originalAppearances = clone(halftime.participantAppearances || { user: {}, opponent: {} });
    const originalRecent = clone(halftime.recentParticipants || []);

    // Let the original engine perform all roster/constraint validation and apply
    // substitutions. Its automatic continuation is discarded below so the old
    // attacking phase can never leak through the interval.
    let state = base.confirmHalftime(halftime, nextSquad, deps);

    const firstKickoff = originalLog[0]?.actorSide ||
      (global.RoadToGloryRng.int(halftime.seed, "kickoff", 0, 2) === 0 ? "user" : "opponent");

    state.period = "second_half";
    state.status = "active";
    state.actionIndex = Number(halftime.actionIndex) || Number(halftime.firstHalfTarget) || 0;
    state.pendingEncounter = null;
    state.possession = otherSide(firstKickoff);
    state.fieldZone = "midfield";
    state.log = originalLog;
    state.participantHistoryBySide = originalHistory;
    state.participantAppearances = originalAppearances;
    state.recentParticipants = originalRecent;

    const indexes = new Set(Array.from(state.manualIndexes || []));
    indexes.add(state.actionIndex);
    state.manualIndexes = Array.from(indexes).sort((a, b) => a - b);

    state = base.prepareNext(state);
    return normalizePendingMinute(state);
  }

  global.RoadToGloryMatchEngine = Object.freeze({
    ...base,
    prepareNext,
    resolvePendingEncounter,
    confirmHalftime,
  });
})(globalThis);
