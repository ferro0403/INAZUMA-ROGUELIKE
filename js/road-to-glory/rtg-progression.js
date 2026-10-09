(function (global) {
  "use strict";

  const configApi = global.RoadToGloryConfig;
  const rng = global.RoadToGloryRng;

  let seasonContext = "ie1";
  function activeSeasonId(state=null){ return String(state?.activeSeasonId||seasonContext||"ie1"); }
  function cfg(state=null){ return configApi?.season?.(activeSeasonId(state)) || configApi.SEASON1; }
  function nodes(state=null) { return Array.from(configApi?.buildSeasonNodes?.(activeSeasonId(state)) || []); }
  function setSeasonContext(state){ seasonContext=activeSeasonId(state); return seasonContext; }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state || {}));
  }

  function indexForNodeId(nodeId, state=null) {
    return nodes(state).findIndex((node) => node.id === String(nodeId || ""));
  }

  function nodeIndex(state) {
    return indexForNodeId(state?.currentNodeId, state);
  }

  function isNodeUnlocked(state, nodeId) {
    const target = indexForNodeId(nodeId, state);
    if (target < 0) return false;
    if (state?.seasonComplete) return true;
    const current = nodeIndex(state);
    return current >= 0 && target <= current;
  }

  function nextNodeId(state) {
    const list = nodes(state);
    const current = nodeIndex(state);
    if (current < 0 || current >= list.length - 1) return null;
    return list[current + 1].id;
  }

  function advanceIfCurrent(state, completedNodeId) {
    const list = nodes(state);
    if (String(state.currentNodeId || "") !== String(completedNodeId || "")) return state;
    const completedIndex = indexForNodeId(completedNodeId, state);
    const next = completedIndex >= 0 ? list[completedIndex + 1] : null;
    if (next) {
      state.currentNodeId = next.id;
      state.furthestNodeIndex = Math.max(Number(state.furthestNodeIndex) || 0, completedIndex + 1);
    } else {
      state.furthestNodeIndex = Math.max(Number(state.furthestNodeIndex) || 0, Math.max(0, completedIndex));
    }
    return state;
  }

  function recordMainVictory(inputState, { teamId, matchId } = {}) {
    const state = cloneState(inputState);
    const seasonCfg = cfg(state);
    const mainIndex = seasonCfg.mainTeams.indexOf(String(teamId || ""));
    if (mainIndex < 0) throw Object.assign(new Error("Unknown RTG main team"), { code: "rtg-main-team-unknown" });
    const mainNodeId = `main:${teamId}`;
    const defeated = new Set(state.defeatedTeamIds || []);
    const firstClear = !defeated.has(String(teamId));
    if (firstClear) {
      defeated.add(String(teamId));
      state.defeatedTeamIds = Array.from(defeated);
      if (matchId != null) state.firstClearMatchIds = Array.from(new Set([...(state.firstClearMatchIds || []), String(matchId)]));
    }
    state.tokens = Math.max(0, Number(state.tokens) || 0) + Number(seasonCfg.mainRewards[String(teamId)] || 0);
    if (seasonCfg.checkpointMainIndexes.includes(mainIndex)) {
      state.checkpointMainIndex = mainIndex;
      state.lives = seasonCfg.livesPerCheckpoint;
    }
    if (mainIndex === seasonCfg.mainTeams.length - 1) state.seasonComplete = true;
    advanceIfCurrent(state, mainNodeId);
    return state;
  }

  function rollbackNodeId(state) {
    const checkpointIndex = Number(state?.checkpointMainIndex);
    if (!Number.isInteger(checkpointIndex) || checkpointIndex < 0) return `main:${cfg(state).mainTeams[0]}`;
    const checkpointTeam = cfg(state).mainTeams[checkpointIndex];
    const checkpointNodeIndex = indexForNodeId(`main:${checkpointTeam}`, state);
    const list = nodes(state);
    return list[checkpointNodeIndex + 1]?.id || `main:${checkpointTeam}`;
  }

  function recordMainLoss(inputState, { nodeId } = {}) {
    const state = cloneState(inputState);
    const maxLives = cfg(state).livesPerCheckpoint;
    const currentLives = Math.max(0, Number(state.lives) || 0);
    if (currentLives > 1) {
      state.lives = currentLives - 1;
      return state;
    }
    state.lives = maxLives;
    state.currentNodeId = rollbackNodeId(state);
    if (nodeId && !state.lastFailedMainNodeId) state.lastFailedMainNodeId = String(nodeId);
    return state;
  }

  function recordSecondaryResult(inputState, { nodeId, result, attemptNumber } = {}) {
    const state = cloneState(inputState);
    const id = String(nodeId || "");
    const node = nodes(state).find((candidate) => candidate.id === id);
    if (!node || node.type !== "secondary") throw Object.assign(new Error("Unknown RTG secondary node"), { code: "rtg-secondary-node-unknown" });
    const attempts = state.attemptsByNode && typeof state.attemptsByNode === "object" ? state.attemptsByNode : {};
    const previous = attempts[id] && typeof attempts[id] === "object" ? attempts[id] : {};
    const normalizedResult = String(result || "");
    const entry = {
      ...previous,
      lastAttempt: Math.max(Number(previous.lastAttempt) || 0, Math.max(0, Number(attemptNumber) || 0)),
      lastResult: normalizedResult,
      clears: Math.max(0, Number(previous.clears) || 0),
    };
    if (normalizedResult === "victory") {
      const reward = rng.weightedPick(
        cfg(state).secondaryRewards,
        (item) => item.weight,
        rng.float(state.campaignSeed, `secondary-reward:${id}`, attemptNumber)
      );
      state.tokens = Math.max(0, Number(state.tokens) || 0) + Number(reward?.amount || 0);
      entry.clears += 1;
      advanceIfCurrent(state, id);
    }
    attempts[id] = entry;
    state.attemptsByNode = attempts;
    return state;
  }

  global.RoadToGloryProgression = Object.freeze({
    setSeasonContext,
    nodeIndex,
    isNodeUnlocked,
    nextNodeId,
    recordMainVictory,
    recordMainLoss,
    recordSecondaryResult,
  });
})(globalThis);
