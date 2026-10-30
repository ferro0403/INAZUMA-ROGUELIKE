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
    if (mainIndex === seasonCfg.mainTeams.length - 1) {
      // Award on the first clear only, in the same atomic match-result mutation.
      // A completed campaign can be replayed; its one-time finale bonus cannot.
      const marker=`completion:${activeSeasonId(state)}`;
      const paid=new Set(state.seasonTransitionRewardedIds||[]);
      if(firstClear && !state.seasonComplete && !paid.has(marker))
        state.tokens += Number(configApi.SEASON_COMPLETION_REWARD||0);
      paid.add(marker);state.seasonTransitionRewardedIds=Array.from(paid);
      state.seasonComplete = true;
    }
    advanceIfCurrent(state, mainNodeId);
    return state;
  }

  // Saved campaigns have THREE independent pieces of checkpoint evidence:
  // the explicit checkpointMainIndex, cleared bosses, and first-clear match IDs.
  // Older/preview saves can have an incomplete defeatedTeamIds array. Never
  // erase a genuinely earned numeric checkpoint because that array is missing.
  // Conversely, DEV pool unlocks can contain future bosses: do not rewind
  // forward to a checkpoint that the campaign has not reached.
  function earnedCheckpointIndex(state) {
    const season=cfg(state),list=nodes(state);
    const current=indexForNodeId(state?.currentNodeId,state);
    if(current<0||!list.length)return -1;
    const furthest=Number(state?.furthestNodeIndex);
    const reached=Math.max(current,Number.isSafeInteger(furthest)?Math.min(list.length-1,Math.max(0,furthest)):0);
    const saved=Number(state?.checkpointMainIndex);
    const wins=new Set((state?.defeatedTeamIds||[]).map(String));
    const firstClear=new Set();
    for(const raw of state?.firstClearMatchIds||[]) {
      const match=String(raw).match(/^rtg:main:(.+):([1-9][0-9]*)$/);
      if(match)firstClear.add(match[1]);
    }
    const attempts=state?.attemptsByNode||{};
    let achieved=-1;
    for(const index of season.checkpointMainIndexes||[]) {
      if(!Number.isInteger(index)||index<0||index>=season.mainTeams.length)continue;
      const teamId=season.mainTeams[index];
      const routeIndex=list.findIndex(node=>node.id===`main:${teamId}`);
      if(routeIndex<0)continue;
      const provenByMatch=firstClear.has(teamId);
      const reachedPastCheckpoint=routeIndex<reached;
      // Numeric metadata is a useful independent record, but must not be
      // accepted alone in a save without ANY evidence of prior victories.
      // This rejects the old phantom-checkpoint/future-unlock scenario.
      const earlierMainWin=season.mainTeams.slice(0,index)
        .some(team=>wins.has(team)||firstClear.has(team));
      const earlierSecondaryClear=Object.entries(attempts).some(([id,entry])=>
        Number(entry?.clears)>0&&list.findIndex(node=>node.id===id&&node.type==="secondary")<routeIndex&&
        list.some(node=>node.id===id&&node.type==="secondary"));
      const credibleSaved=saved===index&&(earlierMainWin||earlierSecondaryClear);
      if(provenByMatch||(reachedPastCheckpoint&&(wins.has(teamId)||credibleSaved)))
        achieved=Math.max(achieved,index);
    }
    return achieved;
  }

  function checkpointResumeNodeId(state,checkpointIndex) {
    const season=cfg(state);
    if(checkpointIndex<0)return `main:${season.mainTeams[0]}`;
    const teamId=season.mainTeams[checkpointIndex];
    const index=indexForNodeId(`main:${teamId}`,state);
    return nodes(state)[index+1]?.id || `main:${teamId}`;
  }

  function rollbackNodeId(state) {
    const checkpointIndex=earnedCheckpointIndex(state);
    state.checkpointMainIndex=checkpointIndex;
    return checkpointResumeNodeId(state,checkpointIndex);
  }

  // Repair only a save that is visibly BEHIND an evidenced checkpoint.
  // No change to a healthy save, an active match, or a completed Season.
  // The caller persists the repaired state in one canonical RTG transaction.
  function repairCheckpointPosition(inputState) {
    if(!inputState||inputState.activeMatch||inputState.seasonComplete===true)return inputState;
    const checkpointIndex=earnedCheckpointIndex(inputState);
    if(checkpointIndex<0)return inputState;
    const resumeId=checkpointResumeNodeId(inputState,checkpointIndex);
    const current=indexForNodeId(inputState.currentNodeId,inputState);
    const resume=indexForNodeId(resumeId,inputState);
    if(current<0||resume<0||current>=resume)return inputState;
    const state=cloneState(inputState);
    state.currentNodeId=resumeId;
    state.checkpointMainIndex=checkpointIndex;
    state.lives=cfg(state).livesPerCheckpoint;
    return state;
  }

  function recordMainLoss(inputState, { nodeId } = {}) {
    const state = cloneState(inputState);
    const maxLives = cfg(state).livesPerCheckpoint;
    const currentLives = Math.max(0, Number(state.lives) || 0);
    // First defeat: consume one life and retry the SAME story node.
    // Only when the last life is lost may the run return to its last earned checkpoint.
    if (currentLives > 1) {
      state.lives = currentLives - 1;
    } else {
      state.lives = maxLives;
      if (state.seasonComplete !== true) state.currentNodeId = rollbackNodeId(state);
    }
    if (String(nodeId || "").startsWith("main:") && !state.lastFailedMainNodeId)
      state.lastFailedMainNodeId = String(nodeId);
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
      const amount=typeof configApi.rewardForNode==="function"?configApi.rewardForNode(state,node):Number(reward?.amount||0);
      state.tokens = Math.max(0, Number(state.tokens) || 0) + Number(amount||0);
      entry.clears += 1;
      advanceIfCurrent(state, id);
    }
    attempts[id] = entry;
    state.attemptsByNode = attempts;
    // Secondary losses used to do nothing, leaving the run stranded at the
    // failed node without consuming a life or returning to the checkpoint.
    if(normalizedResult === "loss") return recordMainLoss(state,{nodeId:id});
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
    repairCheckpointPosition,
  });
})(globalThis);
