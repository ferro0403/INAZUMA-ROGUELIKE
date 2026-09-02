(function (global) {
  "use strict";

  // Boss-only orchestration. The shared match simulator, canonical match lookup,
  // persistence transaction and recruitment UI remain injected by app.js.
  function create(deps) {
    const run = () => deps.getRun();
    const db = () => deps.getSeasonDb();

    function matchFromNode(node, previousNodeId = null, activeRun = run()) {
      const match = {
        nodeId: node.id,
        previousNodeId: previousNodeId || activeRun.currentZone?.currentNodeId || activeRun.currentZone?.startNodeId || null,
        type: "boss", state: "pre-match", log: [], bossIndex: activeRun.bossIndex,
        attemptNumber: Object.keys(activeRun.statistics?.processedMatchIds || {}).filter((id) => id.includes(`::${node.id}::boss::`)).length + 1,
      };
      match.matchId = global.RunStatistics?.createStableMatchId?.(activeRun, match) || null;
      return match;
    }

    function recoverAccess() {
      const currentRun = run();
      if (!currentRun || currentRun.postBossFlow || currentRun.pendingBossVictory) return false;
      const zone = currentRun.currentZone;
      const activeBoss = currentRun.activeMatch?.type === "boss" ? currentRun.activeMatch : null;
      if (activeBoss && !String(activeBoss.state || "").startsWith("completed") && currentRun.phase !== "match") {
        const identity = deps.matchTransactionIdentity(activeBoss);
        return deps.commitMatchMutation("boss-match-access-recovery", identity, (_match, current) => { current.phase = "match"; }).ok;
      }
      if (!zone?.nodes?.length || currentRun.activeMatch) return false;
      const pending = zone.nodes.find((node) => String(node.id) === String(zone.pendingNodeId));
      if (!pending || pending.type !== "boss") return false;
      const nodeId = pending.id;
      return deps.persistGameplayMutation({
        label: "boss-match-entry-recovery",
        mutate: (current) => {
          if (current.activeMatch || String(current.currentZone?.pendingNodeId) !== String(nodeId)) throw new Error("Boss match recovery state changed");
          const currentNode = current.currentZone?.nodes?.find((node) => String(node.id) === String(nodeId));
          if (currentNode?.type !== "boss") throw new Error("Boss match recovery node changed");
          current.activeMatch = matchFromNode(currentNode, current.currentZone.currentNodeId, current);
          current.phase = "match";
        },
        onCommitted: (_value, current) => deps.mountCommittedMatch(current.activeMatch),
      }).ok;
    }

    function complete(result) {
      const match = run()?.activeMatch;
      if (!match?.simulation || match.simulation.resolutionApplied) return;
      const identity = deps.matchTransactionIdentity(match);
      const committed = deps.persistGameplayMutation({
        label: "boss-resolution",
        mutate: (current) => {
          deps.canonicalMatchFor(current, identity);
          const resolution = global.BossGameOverRuntime.applyBossResolutionMutation({ run: current, matchId: identity.matchId, result, seasonDb: db(), deps: deps.resolutionDependencies(current) });
          deps.enqueueGameOverDevelopmentEffect(current);
          return resolution;
        },
        onCommitted: (_value, current) => deps.resolutionCommitted(current.activeMatch),
        rerender: ({ ok, run: recovered }) => { if (!ok) deps.resolutionRecovered(recovered?.activeMatch || null); },
      });
      if (!committed.ok) return deps.stopMatchAfterPersistenceFailure();
      deps.renderCommittedResolution();
    }

    function ensureFlow(options = {}) { return global.BossGameOverRuntime.derivePostBossFlow(run(), db(), options); }

    function resolve(options = {}) {
      if (!ensureFlow(options)) return { destination: "none" };
      const committed = deps.persistGameplayMutation({
        label: "post-boss-resume",
        mutate: (current) => global.BossGameOverRuntime.applyPostBossResumeMutation({ run: current, seasonDb: db(), clearMatch: Boolean(options.clearMatch) }),
        onCommitted: () => { if (options.clearMatch) deps.clearMountedMatch(); },
        rerender: ({ ok }) => { if (!ok) renderRecovery(); },
      });
      if (!committed.ok) return { destination: "post-boss-recovery", error: committed.error };
      if (["next-zone", "season-complete"].includes(committed.value.destination)) return finishTransition();
      return committed.value;
    }

    function navigate(flow) {
      if (flow.destination === "boss-result") {
        if (run().activeMatch) { deps.mountBossResultMatch(run().activeMatch); return deps.renderMatch(); }
        return startRewards();
      }
      if (flow.destination === "boss-rewards") return startRewards();
      if (flow.destination === "season-complete") return deps.renderSeasonComplete();
      if (flow.destination === "finalization-pending") return deps.renderFinalizationPending(flow.finalization);
      if (flow.destination === "post-boss-recovery") return renderRecovery();
      if (flow.destination === "map") return deps.renderMap({ persist: false });
      return null;
    }

    function resume() { return navigate(resolve({ clearMatch: true })); }

    function candidates(flow, boss) {
      const currentRun = run();
      const team = db().teams.find((candidate) => String(candidate.teamId) === String(boss.teamId));
      const owned = new Set(currentRun.roster.map((entry) => String(entry.playerId)));
      const random = global.DraftEngine.randomFromSeed(`${currentRun.runId}:bossReward:${flow.bossIndex}:${flow.rewardNumber}:${flow.rerolls}`);
      const available = deps.isProfileAwareSeason()
        ? (boss.rewardPoolProfileIds || team?.playerProfileIds || []).map((id) => global.ProfiledSeasonRuntime.resolveProfile(currentRun.seasonId, id)).filter((profile) => profile && global.SpecialMatchRuntime.eligibleProfile(currentRun, profile.profileId) && !flow.excludedIds.includes(String(profile.profileId)))
        : (team?.playerIds || []).map((id) => deps.seasonPlayer(id)).filter((player) => player && !owned.has(String(player.playerId)) && !flow.excludedIds.includes(String(player.playerId)));
      return deps.selectWeightedCandidates(available, random);
    }

    function startRewards() {
      const flowResult = resolve({ clearMatch: true });
      if (flowResult.destination === "season-complete") return deps.renderSeasonComplete();
      if (flowResult.destination === "map") return deps.renderMap({ persist: false });
      const flow = run().postBossFlow;
      const boss = db().bossOrder[Number(flow?.bossIndex ?? run().bossIndex)];
      if (!flow || !boss) return deps.renderMap();
      const committed = deps.persistGameplayMutation({
        label: "boss-reward-candidates",
        mutate: (current) => global.BossGameOverRuntime.prepareBossRewardCandidatesMutation({ run: current, seasonDb: db(), candidateIds: flow.candidateIds?.length ? flow.candidateIds : candidates(flow, boss).map((player) => String(player.profileId || player.playerId)) }),
        rerender: ({ ok }) => { if (!ok && run()?.postBossFlow) renderRecovery(); },
      });
      if (committed.ok) showNextReward();
    }

    function renderRecovery() {
      deps.renderRecoveryView(() => resume());
    }

    function showNextReward() {
      const currentRun = run(), flow = currentRun.postBossFlow;
      const boss = db().bossOrder[Number(flow?.bossIndex ?? currentRun.bossIndex)];
      if (!flow || !boss) return deps.renderMap();
      const offered = (flow.candidateIds || []).map((id) => deps.isProfileAwareSeason() ? global.ProfiledSeasonRuntime.resolveProfile(currentRun.seasonId, id) : deps.seasonPlayer(id)).filter(Boolean);
      if (!offered.length) return startRewards();
      const level = global.RoguelikeRules.defeatedBossRewardLevel(boss);
      const scoutToken = currentRun.inventory.find((item) => item.effect === "pull_reroll");
      deps.showPlayerOffer({
        title: `Ricompensa ${flow.rewardNumber} di 2 · ${boss.teamName}`, subtitle: `Scegli 1 giocatore su 3 · Livello ${level}`,
        candidates: offered, source: global.SeasonRegistry.sourceForSeason(currentRun.seasonId), database: db(), level, allowSkip: true, legendary: false,
        onReroll: scoutToken ? () => {
          const committed = deps.persistGameplayMutation({ label: "boss-reward-reroll", mutate: (current) => global.BossGameOverRuntime.applyBossRewardRerollMutation({ run: current, tokenInstanceId: scoutToken.instanceId, nextCandidateIds: (nextFlow) => candidates(nextFlow, boss).map((candidate) => String(candidate.profileId || candidate.playerId)), recordAction: deps.recordReroll }), rerender: ({ ok }) => { if (!ok) renderRecovery(); } });
          if (committed.ok) showNextReward();
        } : null,
        onPick: (player) => deps.recruitPlayer(player, global.SeasonRegistry.sourceForSeason(currentRun.seasonId), level, (result) => { if (result.status.startsWith("committed-")) advanceReward(); else if (result.status === "cancelled") showNextReward(); }, { allowCancel: true, recruitmentSource: "boss_reward", actionId: `${currentRun.runId}:${flow.matchNodeId}:boss_reward:${flow.rewardNumber}:recruit:${player.profileId || player.playerId}`, transactionMutate: (current) => global.BossGameOverRuntime.applyBossRewardPickMutation({ run: current, playerId: player.profileId || player.playerId, recordAction: (target, currentFlow) => deps.recordPick(target, currentFlow, player) }), onRecover: showNextReward, onRecoveryBlocked: renderRecovery }),
        onSkip: () => advanceReward(deps.recordDecline),
      });
    }

    function advanceReward(recordAction) {
      if (!run().postBossFlow) return deps.renderMap();
      const committed = deps.persistGameplayMutation({ label: "boss-reward-advance", mutate: (current) => global.BossGameOverRuntime.advanceBossRewardMutation({ run: current, recordAction }), rerender: ({ ok }) => { if (!ok && run()?.postBossFlow) renderRecovery(); } });
      if (!committed.ok) return;
      run().postBossFlow.remainingRewards > 0 ? showNextReward() : navigate(finishTransition());
    }

    function finishTransition() {
      const committed = deps.persistGameplayMutation({
        label: "boss-victory-handoff",
        mutate: (current) => global.BossGameOverRuntime.applyBossVictoryHandoffMutation({ run: current, seasonDb: db(), ensureCurrentZoneMutation: deps.ensureCurrentZoneMutation, buildFinalization: (boss) => deps.buildFinalization(current, boss) }),
        onCommitted: deps.handoffCommitted, rerender: ({ ok }) => { if (!ok) renderRecovery(); },
      });
      if (!committed.ok) return deps.failedHandoffDestination(committed);
      if (committed.value.destination === "finalization-pending") return deps.finishFinalization();
      if (committed.value.destination === "map") deps.createPostBossCheckpoint(run());
      return committed.value;
    }

    return Object.freeze({ matchFromNode, recoverAccess, complete, ensureFlow, resolve, resume, navigate, startRewards, renderRecovery, showNextReward, advanceReward, finishTransition });
  }

  global.BossFlowControllerRuntime = Object.freeze({ create });
})(typeof window !== "undefined" ? window : globalThis);
