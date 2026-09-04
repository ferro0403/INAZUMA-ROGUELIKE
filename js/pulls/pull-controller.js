(function (global) {
  "use strict";

  function create(dependencies) {
    const { getRun, getUi, pullPool, luckyCharmPoolForPull, pullCandidateKey, previousBossLevel, useScoutTokenOnPull, useLuckyCharmOnPull, pendingPullNodeById, persistGameplayMutation, renderMapFailureRecovery, renderMap, canonicalNodeById, showPlayerOffer, toast, closeModal, finishNonMatchNode, recruitPlayer, completePullNodeMutation, rerenderCanonicalPull, isDevMode } = dependencies;
  function openPull(node, pullType = node.type, options = {}) {
    const pool = node.pullState?.luckyCharmUsed && ["pull_free_agents", "pull_unlocked_teams"].includes(pullType)
      ? luckyCharmPoolForPull(pullType)
      : pullPool(pullType);
    if (!options.dev) {
      const nodeId = String(node.id);
      const canonicalNode = pendingPullNodeById(getRun(), nodeId, pullType);
      if (!canonicalNode) return renderMap({ persist: false });
      if (!canonicalNode.pullState?.candidateIds?.length) {
        const committed = persistGameplayMutation({
          label: "pull-offer",
          mutate: (current) => {
            const currentNode = pendingPullNodeById(current, nodeId, pullType);
            if (!currentNode) throw new Error("Pull state changed");
            if (!currentNode.pullState) {
              currentNode.pullState = { pullType, rerolls: 0, excludedCandidateIds: [], luckyCharmUsed: false, candidateIds: [] };
              global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.PULL_OPENED, { nodeId, pullType, actionId: `${current.runId}:${nodeId}:pull_opened` });
            }
            if (currentNode.pullState.pullType !== pullType) throw new Error("Pull state changed");
            if (!currentNode.pullState.candidateIds.length) currentNode.pullState.candidateIds = global.PullCandidatesRuntime.generatedPullCandidates(current, pool, currentNode).map(pullCandidateKey);
          },
          rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
        });
        if (!committed.ok) return committed;
        return openPull(canonicalNodeById(nodeId), pullType, options);
      }
      node = canonicalNode;
    } else if (!node.pullState) {
      node.pullState = { pullType, rerolls: 0, excludedCandidateIds: [], luckyCharmUsed: false, candidateIds: [] };
    }
    if (!options.dev && node.pullState?.candidateIds?.length && typeof global.PullCandidatesRuntime.resolveCandidateIds === "function") {
      const resolution = global.PullCandidatesRuntime.resolveCandidateIds(getRun(), pool, node);
      if (resolution.repaired) {
        const nodeId = String(node.id);
        const expectedCandidateIds = node.pullState.candidateIds.map(String);
        const expectedRerolls = Number(node.pullState.rerolls || 0);
        const committed = persistGameplayMutation({
          label: "pull-offer-repair",
          mutate: (current) => {
            const currentNode = pendingPullNodeById(current, nodeId, pullType);
            const currentCandidateIds = (currentNode?.pullState?.candidateIds || []).map(String);
            if (!currentNode?.pullState
              || currentNode.pullState.pullType !== pullType
              || Number(currentNode.pullState.rerolls || 0) !== expectedRerolls
              || currentCandidateIds.length !== expectedCandidateIds.length
              || currentCandidateIds.some((id, index) => id !== expectedCandidateIds[index])) {
              throw new Error("Pull repair state changed");
            }
            currentNode.pullState.candidateIds = resolution.candidateIds;
          },
          rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
        });
        if (!committed.ok) return committed;
        return openPull(canonicalNodeById(nodeId), pullType, options);
      }
    }
    const candidates = global.PullCandidatesRuntime.pullCandidates(getRun(), pool, node);
    const level = previousBossLevel();
    const scoutToken = getRun().inventory.find((item) => item.effect === "pull_reroll");
    const luckyCharm = getRun().inventory.find((item) => item.effect === "lucky_pull");
    const legendaryPull = pullType === "pull_legendary";
    const luckyCompatible = ["pull_free_agents", "pull_unlocked_teams"].includes(pullType);
    const rerollPull = () => {
      if (legendaryPull) return toast("Il Visore scout non può essere utilizzato nelle pull leggendarie.");
      return useScoutTokenOnPull(node, pullType, candidates, scoutToken, pool, options);
    };
    const devReroll = isDevMode() && options.dev ? () => {
      node.pullState.rerolls += 1;
      node.pullState.candidateIds = [];
      openPull(node, pullType, options);
    } : null;
    const finishPull = (message) => options.dev
      ? (closeModal(), toast(message), renderMap({ persist: false }))
      : finishNonMatchNode(node, message);
    const finishCommittedPull = (message) => { toast(message); renderMap({ persist: false }); };
    showPlayerOffer({
      title: global.SEASON1_CONFIG.nodeLabels[pullType].label,
      subtitle: `Scegli 1 giocatore su 3 · Livello ${level}${node.pullState.luckyCharmUsed ? " · Portafortuna già utilizzato" : ""}`,
      candidates,
      source: pool.source,
      sourceForPlayer: pool.sourceForPlayer,
      database: pool.database,
      level,
      allowSkip: true,
      onReroll: devReroll || (scoutToken && !legendaryPull ? rerollPull : null),
      rerollLabel: devReroll ? "RIGENERA PULL LEGGENDARIO" : null,
      rerollDisabled: false,
      rerollDisabledMessage: "",
      showLuckyCharm: luckyCompatible,
      onLuckyCharm: luckyCompatible && luckyCharm ? () => useLuckyCharmOnPull(node, pullType, candidates) : null,
      luckyCharmCount: getRun().inventory.filter((item) => item.effect === "lucky_pull").length,
      luckyCharmDisabled: Boolean(!luckyCompatible || node.pullState.luckyCharmUsed || !luckyCharm),
      luckyCharmDisabledMessage: !luckyCompatible ? "Portafortuna non utilizzabile in questa selezione." : node.pullState.luckyCharmUsed ? "Portafortuna già utilizzato" : !luckyCharm ? "Nessun Portafortuna disponibile" : "",
      onPick: (player) => {
        const playerSource = pool.sourceForPlayer ? pool.sourceForPlayer(player) : pool.source;
        const nodeId = String(node.id);
        const candidateId = pullCandidateKey(player);
        recruitPlayer(player, playerSource, level, (result) => {
          if (result.status.startsWith("committed-")) return finishCommittedPull(`${player.name} entra nella rosa`);
          if (result.status === "cancelled") return finishPull("Hai rinunciato al nuovo giocatore");
        }, {
          transactionMutate: options.dev ? undefined : (current) => completePullNodeMutation(current, nodeId, pullType, candidateId),
          onRecover: () => rerenderCanonicalPull(nodeId, pullType, options),
          onRecoveryBlocked: () => renderMapFailureRecovery(),
        });
      },
      onSkip: () => finishPull("Hai rinunciato al pull"),
      legendary: legendaryPull,
      profileAware: pool.profileAware,
    });
  }

  function openDevLegendaryPull() {
    if (!isDevMode() || !getRun()?.currentZone) return;
    getUi().devLegendaryPullSequence += 1;
    const node = {
      id: `dev-legendary-${getUi().devLegendaryPullSequence}`,
      type: "pull_legendary",
      pullState: { pullType: "pull_legendary", rerolls: 0, excludedCandidateIds: [], luckyCharmUsed: false, candidateIds: [] },
    };
    openPull(node, "pull_legendary", { dev: true });
  }


    return { openPull, openDevLegendaryPull };
  }

  global.PullControllerRuntime = { create };
})(globalThis);
