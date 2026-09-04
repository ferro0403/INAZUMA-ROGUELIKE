(function (global) {
  "use strict";

  function create(deps) {
    const {
    getRun, getUi, getSeasonDb, app, modalRoot, DEV_MODE, topbar, bottomNav, escapeHtml,
    teamById, resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, openBossPreviewModal,
    openDevLegendaryPull, toast, renderPostBossRecovery, resumeRun, persistGameplayMutation,
    matchTransactionIdentity, commitMatchMutation, recoverInterruptedSpecialMatchAccess,
    recoverInterruptedBossAccess, ensureFiveVFive, fiveRoleForPlayerId, createOrLoadFiveMatch,
    specialMatchController, bossMatchFromNode, renderFiveVFive, renderMatch, openPull,
    resolveTradeNode, closeModal, itemDefinitionById, weightedItemCandidates, inventoryItemIdentity,
    groupedOwnedInventoryItems, itemStatLabel, itemIcon, openModal, cssEscape, receiveItem,
    nodeRouter,
    } = deps;

function checkpointSnapshot(current) {
  return global.RunState.clone({
    version: global.SEASON1_CONFIG.saveVersion,
    formationId: current.formationId,
    teamIdentity: current.teamIdentity,
    roster: current.roster,
    lineup: current.lineup,
    bench: current.bench,
    bossIndex: current.bossIndex,
    completedBossIds: current.completedBossIds,
    unlockedTeamIds: current.unlockedTeamIds,
    teamLevel: current.teamLevel,
    inventory: current.inventory,
    effects: current.effects,
    randomEventHistory: current.randomEventHistory,
    fiveVFive: current.fiveVFive,
    activeMatch: current.activeMatch || null,
    pendingBossVictory: current.pendingBossVictory || null,
    postBossFlow: current.postBossFlow || null,
    currentZone: current.currentZone,
  });
}

function ensureCurrentZone(options = {}) {
  const current = getRun();
  if (!current) return { ok: false, seasonComplete: false, error: new Error("Run unavailable") };
  const probe = global.RunState.clone(current);
  const preview = ensureCurrentZoneMutation(probe);
  if (!preview?.boss) return { ok: true, seasonComplete: true, value: preview, run: current };
  const needsCommit = preview.changed || current.phase !== "map";
  if (!needsCommit) return { ok: true, seasonComplete: false, value: preview, run: current };
  const committed = persistGameplayMutation({
    label: options.label || "map-zone-ensure",
    mutate: (canonical) => {
      const result = ensureCurrentZoneMutation(canonical);
      if (!result?.boss) return { ...result, seasonComplete: true };
      canonical.phase = "map";
      if (result.generated) canonical.checkpoint = checkpointSnapshot(canonical);
      return { ...result, seasonComplete: false };
    },
    rerender: ({ ok }) => {
      if (!ok && options.rerenderOnFailure !== false) renderMapFailureRecovery();
    },
  });
  return {
    ...committed,
    seasonComplete: Boolean(committed.ok && committed.value?.seasonComplete),
  };
}

function ensureCurrentZoneMutation(current) {
  return global.BossGameOverRuntime.ensureCurrentZoneMutation({ run: current, seasonDb: getSeasonDb(), mapEngine: global.MapEngine });
}

function activeMatchNeedsPhaseRecovery(activeRun, match) {
  return Boolean(match && ["five_v_five", "special_match", "boss"].includes(match.type) && activeRun?.phase !== "match" && !(match.type === "five_v_five" && activeRun?.phase === "five") && match.postMatchNavigationApplied !== true);
}

function recoverInterruptedMatchAccess() {
  const current = getRun();
  if (activeMatchNeedsPhaseRecovery(current, current?.activeMatch)) {
    const identity = matchTransactionIdentity(current.activeMatch);
    const type = current.activeMatch.type;
    const committed = commitMatchMutation("match-access-recovery", identity, (match, canonical) => { if (!activeMatchNeedsPhaseRecovery(canonical, match)) throw new Error("Match access recovery state changed"); canonical.phase = "match"; });
    return { needed: true, ok: committed.ok, type };
  }
  const zone = current?.currentZone;
  const pending = zone?.nodes?.find((node) => String(node.id) === String(zone.pendingNodeId));
  const specialNeeded = !current?.pendingSpecialMatchReward && !current?.activeMatch && pending?.type === "special_match";
  if (specialNeeded && !recoverInterruptedSpecialMatchAccess()) return { needed: true, ok: false, type: "special_match" };
  const bossNeeded = !current?.postBossFlow && !current?.pendingBossVictory && !current?.activeMatch && pending?.type === "boss";
  if (bossNeeded && !recoverInterruptedBossAccess()) return { needed: true, ok: false, type: "boss" };
  return { needed: specialNeeded || bossNeeded, ok: true };
}

function nodePositions(zone) {
  const maxLayer = Math.max(...zone.nodes.map((node) => node.layer));
  const result = {};
  for (const node of zone.nodes) {
    const layerNodes = zone.nodes.filter((candidate) => candidate.layer === node.layer);
    const index = layerNodes.findIndex((candidate) => candidate.id === node.id);
    result[node.id] = {
      x: ((index + 1) / (layerNodes.length + 1)) * 1000,
      y: 930 - (node.layer / maxLayer) * 860,
    };
  }
  return result;
}


function bossTeamLogoUrl(boss) {
  const team = teamById(boss?.teamId);
  return boss?.logoUrl || team?.logoUrl || team?.logo || boss?.teamLogo || "";
}

function bossNodeIconMarkup(boss) {
  const teamName = boss?.teamName || "Boss";
  const logoUrl = bossTeamLogoUrl(boss);
  const fallback = "⚽";
  if (!logoUrl) return `<span class="boss-logo-fallback boss-logo-fallback--visible" aria-hidden="true">${fallback}</span>`;
  return `<img class="boss-node-logo" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(teamName)}" loading="lazy" onerror="this.remove();this.parentElement?.classList.add('boss-logo-missing');" /><span class="boss-logo-fallback" aria-hidden="true">${fallback}</span>`;
}


function routeNodeIconMarkup(type, fallback = "◆") {
  const icons = {
    start: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20V4m0 1h10l-2.3 3L16 11H6"/></svg>',
    five_v_five: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m12 8 3 2-1 4h-4l-1-4 3-2ZM4.8 10.5 9 10m6 0 4.2.5M8.5 18l1.5-4m4 0 1.5 4"/></svg>',
    item: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2M9 12h6"/></svg>',
    pull_free_agents: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.4 2.5-5 5.5-5 1.2 0 2.2.2 3 .7"/><path d="M17 13v6m-3-3h6"/></svg>',
    pull_unlocked_teams: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.4 4.8 5.3.8-3.8 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.8-3.8 5.3-.8L12 3Z"/></svg>',
    pull_legendary: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Z"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></svg>',
    trade: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13l-3-3m3 3-3 3M20 16H7l3 3m-3-3 3-3"/></svg>',
    random: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 8.2A3.2 3.2 0 0 1 12.3 5c2.1 0 3.7 1.4 3.7 3.3 0 2.6-3.3 2.8-3.3 5.2"/><path d="M12.7 18h.01"/></svg>',
  };
  return `${icons[type] || `<span aria-hidden="true">${escapeHtml(fallback)}</span>`}<span class="node-icon-text">${escapeHtml(fallback)}</span>`;
}

function renderMap(options = {}) {
  if (options.failureLocked === true) {
    app.innerHTML = `<main class="screen"><div class="content"><section class="panel"><h1>SALVATAGGIO NON RIUSCITO</h1><p>Lo stato salvato non è stato modificato. Riprova per riprendere dal checkpoint canonico.</p><button type="button" class="btn btn-yellow" id="retry-failed-gameplay">RIPROVA</button></section></div></main>`;
    document.getElementById("retry-failed-gameplay")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      if (button.disabled) return;
      button.disabled = true;
      await resumeRun();
    });
    return app.innerHTML;
  }
  if (getRun()?.postBossFlow || getRun()?.pendingBossVictory) return renderPostBossRecovery();
  const zoneUnavailable = !getRun()?.currentZone
    || !Array.isArray(getRun().currentZone.nodes)
    || !Array.isArray(getRun().currentZone.edges)
    || !Array.isArray(getRun().currentZone.path);
  if (zoneUnavailable) {
    app.innerHTML = `<main class="screen"><div class="content"><section class="panel"><h1>PERCORSO NON DISPONIBILE</h1><p>Lo stato salvato non è stato modificato. Riprova quando il salvataggio è disponibile.</p><button type="button" id="retry-map-render">RIPROVA</button></section></div></main>`;
    document.getElementById("retry-map-render")?.addEventListener("click", () => resumeRun());
    return app.innerHTML;
  }
  const zone = getRun().currentZone;
  const boss = getSeasonDb().bossOrder[getRun().bossIndex];
  const positions = nodePositions(zone);
  const reachable = new Set(global.MapEngine.reachableNodeIds(zone));
  const completed = new Set(zone.completedNodeIds);
  const labels = global.SEASON1_CONFIG.nodeLabels;
  const currentNodeId = zone.currentNodeId;
  const pathSet = new Set(zone.path || []);
  const selectableCount = reachable.size;
  const devTransformableNodeIds = [...reachable].filter((nodeId) => zone.nodes.find((node) => String(node.id) === String(nodeId))?.type !== "boss");
  const devNodeTools = DEV_MODE ? `
    <section class="shop-dev route-dev-tools" aria-label="Strumenti DEV nodi">
      <h2>MAPPA — HACK TEST</h2>
      <div class="shop-dev-grid">
        <button type="button" data-dev-open-legendary>APRI PULL LEGGENDARIO</button>
        <label>NODO <select data-dev-node>${devTransformableNodeIds.map((nodeId) => {
          const candidate = zone.nodes.find((node) => String(node.id) === String(nodeId));
          return `<option value="${escapeHtml(nodeId)}">${escapeHtml(candidate?.teamName || labels[candidate?.type]?.label || nodeId)} · ${escapeHtml(nodeId)}</option>`;
        }).join("")}</select></label>
        <button type="button" data-dev-transform-node="pull_legendary" ${devTransformableNodeIds.length ? "" : "disabled"}>TRASFORMA NODO IN PULL LEGGENDARIO</button>
        <button type="button" data-dev-transform-node="trade" ${devTransformableNodeIds.length ? "" : "disabled"}>TRASFORMA NODO IN SCAMBIO</button>
      </div>
    </section>` : "";
  const edgeMarkup = zone.edges.map(([from, to]) => {
    const available = from === currentNodeId && reachable.has(to);
    const done = completed.has(from) && (completed.has(to) || pathSet.has(to));
    const bossEdge = zone.nodes.find((node) => node.id === to)?.type === "boss";
    const edgeClass = [available ? "available" : "", done ? "done" : "", bossEdge ? "boss-edge" : ""].filter(Boolean).join(" ");
    return `<line class="${edgeClass}" x1="${positions[from].x}" y1="${positions[from].y}" x2="${positions[to].x}" y2="${positions[to].y}" />`;
  }).join("");

  app.innerHTML = `
    <main class="screen route-screen">
      ${topbar("Percorso")}
      <div class="content route-content">
        <section class="route-hero panel" aria-label="Prossima sfida del percorso">
          <div class="route-hero-copy">
            <div class="route-hero-meta">
              <p class="eyebrow route-kicker">Percorso · Boss ${getRun().bossIndex + 1}/${getSeasonDb().bossOrder.length}</p>
              <span class="route-choice-count">${selectableCount} ${selectableCount === 1 ? "scelta" : "scelte"}</span>
            </div>
            <h2>Verso ${escapeHtml(boss.teamName)}</h2>
            <p class="muted">Seleziona uno dei nodi evidenziati in giallo.</p>
          </div>
          <button type="button" class="route-target-card" id="open-boss-preview" aria-label="Vedi formazione boss ${escapeHtml(boss.teamName)}">
            <span class="route-target-card__logo">${bossNodeIconMarkup(boss)}</span>
            <span class="route-target-card__copy">
              <span>Prossima sfida</span>
              <strong>${escapeHtml(boss.teamName)}</strong>
              <small>${escapeHtml(boss.bossFormation || "Boss della run")}${boss.bossLevel ? ` · Lv ${escapeHtml(boss.bossLevel)}` : ""}</small>
            </span>
            <em>FORMAZIONE</em>
          </button>
        </section>
        <section class="map-wrap" id="map-scroll" aria-label="Percorso verso il boss">
          <header class="route-map-toolbar">
            <div>
              <span>PERCORSO</span>
              <strong>Scegli il prossimo nodo</strong>
            </div>
            <p><i aria-hidden="true"></i>Nodi gialli disponibili</p>
          </header>
          <div class="route-map" aria-label="Mappa percorso verso ${escapeHtml(boss.teamName)}">
            <svg class="map-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${edgeMarkup}</svg>
            ${zone.nodes.map((node) => {
              const meta = labels[node.type] || { label: node.teamName || node.type, icon: "◆", color: "#f6c85f" };
              const stateClass = completed.has(node.id) ? "completed" : reachable.has(node.id) ? "reachable" : "locked";
              const isBoss = node.type === "boss";
              const isCurrent = node.id === currentNodeId;
              const readableState = isCurrent ? "posizione attuale" : completed.has(node.id) ? "completato" : reachable.has(node.id) ? "selezionabile" : "bloccato";
              const visibleState = isCurrent ? "SEI QUI" : completed.has(node.id) ? "FATTO" : reachable.has(node.id) ? "SCEGLI" : "";
              return `
                <button type="button" class="map-node node-type-${escapeHtml(node.type)} ${stateClass}${isCurrent ? " current" : ""}${isBoss ? " boss-node" : ""}" data-node-id="${node.id}" data-node-type="${escapeHtml(node.type)}" ${reachable.has(node.id) ? "" : "disabled"}
                  aria-label="${escapeHtml((isBoss ? boss.teamName : meta.label) + ", " + readableState)}"
                  style="left:${positions[node.id].x / 10}%;top:${positions[node.id].y / 10}%;--node-color:${meta.color}">
                  ${isBoss ? '<span class="node-badge">BOSS</span>' : ""}
                  ${node.type === "special_match" ? '<span class="node-badge">11v11</span>' : ""}
                  <span class="node-icon">${isBoss ? bossNodeIconMarkup(boss) : node.type === "special_match" ? bossNodeIconMarkup(node) : routeNodeIconMarkup(node.type, meta.icon)}</span>
                  <span class="node-label">${isBoss ? escapeHtml(boss.teamName) : escapeHtml(node.teamName || meta.label)}</span>
                  ${node.type === "special_match" ? `<span class="node-special-level">LV ${escapeHtml(node.matchLevel)}</span>` : ""}
                  ${visibleState ? `<span class="node-state">${visibleState}</span>` : ""}
                </button>`;
            }).join("")}
          </div>
        </section>
        ${devNodeTools}
      </div>
      ${bottomNav("map")}
    </main>`;
  resetRenderedViewScroll();
  bindSectionRootNav();

  document.getElementById("open-boss-preview")?.addEventListener("click", () => openBossPreviewModal(boss));
  document.querySelectorAll("[data-node-id]").forEach((button) => {
    button.addEventListener("click", () => enterNode(button.dataset.nodeId));
  });
  if (DEV_MODE) bindMapDevTools();
  bindBottomNav();
  requestAnimationFrame(() => {
    const scroll = document.getElementById("map-scroll");
    if (zone.path.length <= 1 && scroll && !window.matchMedia("(max-width: 780px)").matches) scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
    if (scroll && window.matchMedia("(max-width: 780px)").matches) scroll.scrollLeft = 0;
  });
}

function renderMapFailureRecovery() {
  return renderMap({ persist: false, failureLocked: true });
}

function bindMapDevTools() {
  document.querySelector("[data-dev-open-legendary]")?.addEventListener("click", openDevLegendaryPull);
  document.querySelectorAll("[data-dev-transform-node]").forEach((button) => button.addEventListener("click", () => {
    const nodeId = document.querySelector("[data-dev-node]")?.value;
    const targetType = button.dataset.devTransformNode;
    const committed = persistGameplayMutation({
      label: "dev-map-node-transform",
      mutate: (current) => {
        const node = current.currentZone?.nodes?.find((candidate) => String(candidate.id) === String(nodeId));
        const reachable = current.currentZone ? global.MapEngine.reachableNodeIds(current.currentZone).map(String) : [];
        if (!node || node.type === "boss" || !reachable.includes(String(node.id))) throw new Error("Seleziona un nodo disponibile");
        node.type = targetType;
        delete node.revealedType;
        delete node.pullState;
        return { nodeId: String(node.id), type: node.type };
      },
      onMutationError: ({ error }) => toast(error.message),
      rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
    });
    if (!committed.ok) return;
    toast(committed.value?.type === "trade" ? "Nodo trasformato in Scambio" : "Nodo trasformato in Pull Leggendario");
    renderMap({ persist: false });
  }));
}

function canonicalNodeById(nodeId) {
  return getRun()?.currentZone?.nodes?.find((item) => String(item.id) === String(nodeId)) || null;
}

function pendingPullNodeById(activeRun, nodeId, pullType) {
  const zone = activeRun?.currentZone;
  const node = zone?.nodes?.find((item) => String(item.id) === String(nodeId));
  if (!node || zone.completedNodeIds?.map(String).includes(String(nodeId)) || node.completed === true) return null;
  const effectiveType = node.type === "random" ? node.revealedType : node.type;
  return String(zone.pendingNodeId) === String(nodeId) && effectiveType === pullType ? node : null;
}

function activePullNodeById(activeRun, nodeId, pullType, { requireCandidates = true } = {}) {
  const node = pendingPullNodeById(activeRun, nodeId, pullType);
  if (!node || !node.pullState || node.pullState.pullType !== pullType) return null;
  if (!Array.isArray(node.pullState.candidateIds) || (requireCandidates && !node.pullState.candidateIds.length)) return null;
  return node;
}

function activeItemRewardNodeById(activeRun, nodeId, { allowClaimed = false } = {}) {
  const zone = activeRun?.currentZone;
  const node = zone?.nodes?.find((item) => String(item.id) === String(nodeId));
  const pending = activeRun?.pendingItemReward;
  if (!node) return null;
  if (allowClaimed && pending?.status === "claimed" && String(pending.nodeId) === String(nodeId)) return node;
  const effectiveType = node.type === "random" ? node.revealedType : node.type;
  if (effectiveType !== "item" || node.completed === true || zone.completedNodeIds?.map(String).includes(String(nodeId))) return null;
  return String(zone.pendingNodeId) === String(nodeId) ? node : null;
}

function canonicalActivePullNodeById(nodeId, pullType) {
  return activePullNodeById(getRun(), nodeId, pullType);
}

function rerenderCanonicalPull(nodeId, pullType, options = {}, activeOptions = {}) {
  const currentNode = activePullNodeById(getRun(), nodeId, pullType, activeOptions);
  return currentNode ? openPull(currentNode, pullType, options) : renderMap({ persist: false });
}

function enterMatchFromNode(nodeId, previousNodeId = null, { alreadySelected = false, matchType = null } = {}) {
    const committed = persistGameplayMutation({
      label: "map-match-entry",
      mutate: (current) => {
        const currentNode = current.currentZone?.nodes?.find((item) => String(item.id) === String(nodeId));
        if (!currentNode) throw new Error("Match node changed");
        const selectedNode = alreadySelected ? { ...currentNode, type: matchType || currentNode.type } : global.MapEngine.selectNode(current.currentZone, nodeId);
        let created;
        if (selectedNode.type === "five_v_five") {
          ensureFiveVFive(current);
          const status = global.FiveVFive.validate(current, (id) => fiveRoleForPlayerId(id, current));
          if (!status.valid) { current.phase = "five"; current.activeMatch = null; return { formationRequired: true }; }
          created = createOrLoadFiveMatch(selectedNode, current);
        }
        else if (selectedNode.type === "special_match") created = specialMatchController.createForSelectedNode(current, selectedNode, previousNodeId);
        else if (selectedNode.type === "boss") created = bossMatchFromNode(selectedNode, previousNodeId, current);
        else throw new Error("Node is not a match");
        current.phase = "match"; current.activeMatch = created; return created;
      },
      onCommitted: (created) => {
        if (created?.formationRequired) return toast("Completa la Formazione 5v5 prima di avviare la partitella.");
        getUi().match = created; getUi().bossMatchState = created.state || "pre-match"; getUi().bossMatchLog = created.log || []; getUi().bossMatchResolving = false;
      },
      rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
    });
    if (!committed.ok) return;
    if (committed.value?.formationRequired) return renderFiveVFive({ persist: false });
    return renderMatch();
}

function enterNode(nodeId) {
  const previousNodeId = getRun().currentZone?.currentNodeId || null;
  const candidate = canonicalNodeById(nodeId);
  if (candidate && ["five_v_five", "special_match", "boss"].includes(candidate.type)) return enterMatchFromNode(nodeId, previousNodeId);
  if (candidate?.type === "random") {
    const committed = persistGameplayMutation({
      label: "random-node-select-reveal",
      mutate: (current) => {
        const currentNode = global.MapEngine.selectNode(current.currentZone, nodeId);
        return { nodeId: currentNode.id, revealedType: global.MapEngine.resolveRandomNodeType(current, currentNode) };
      },
      rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
    });
    if (!committed.ok) return committed;
    return resolveRandomNode(canonicalNodeById(committed.value?.nodeId || nodeId));
  }
  let node;
  const committed = persistGameplayMutation({
    label: "map-node-select",
    mutate: (current) => { node = global.MapEngine.selectNode(current.currentZone, nodeId); },
    onMutationError: ({ error }) => toast(error.message),
    rerender: ({ ok, stage }) => { if (!ok && stage === "persistence") renderMapFailureRecovery(); },
  });
  if (!committed.ok) return committed;

  dispatchNode(node, node.type, { previousNodeId });
}

function dispatchNode(node, eventType, context = {}) {
  return nodeRouter.dispatch(node, eventType, context);
}

function finishNonMatchNode(node, message) {
  const nodeId = node.id;
  persistGameplayMutation({
    label: "map-node-complete",
    mutate: (current) => {
      const currentNode = current.currentZone?.nodes?.find((item) => String(item.id) === String(nodeId));
      if (!currentNode) throw new Error("Node state changed");
      global.MapEngine.completeNode(current.currentZone, currentNode.id);
      global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.NODE_COMPLETED, { nodeId: currentNode.id, nodeType: currentNode.type, actionId: `${current.runId}:${currentNode.id}:node_completed` });
      current.phase = "map";
    },
    onCommitted: () => { closeModal(); toast(message); renderMap({ persist: false }); },
    rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
  });
}

function completePullNodeMutation(current, nodeId, pullType, candidateId) {
  const currentNode = activePullNodeById(current, nodeId, pullType);
  const candidateIds = (currentNode?.pullState?.candidateIds || []).map(String);
  if (!currentNode || !candidateIds.includes(String(candidateId))) throw new Error("Pull reward state changed");
  global.MapEngine.completeNode(current.currentZone, currentNode.id);
  global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.NODE_COMPLETED, { nodeId: currentNode.id, nodeType: currentNode.type, actionId: `${current.runId}:${currentNode.id}:node_completed` });
  current.phase = "map";
}

function pendingItemRewardNode() {
  const pending = getRun()?.pendingItemReward;
  if (!pending || !getRun()?.currentZone) return null;
  return activeItemRewardNodeById(getRun(), pending.nodeId, { allowClaimed: pending.status === "claimed" });
}

function resumePendingItemReward() {
  const storedNode = pendingItemRewardNode();
  if (storedNode) {
    renderMap({ persist: false });
    resolveItemNode(storedNode);
    return true;
  }

  if (getRun()?.pendingItemReward) {
    const expectedNodeId = String(getRun().pendingItemReward.nodeId);
    const cleared = persistGameplayMutation({
      label: "item-reward-invalid-resume",
      mutate: (current) => {
        if (current.pendingItemReward && String(current.pendingItemReward.nodeId) !== expectedNodeId) throw new Error("Item reward recovery changed");
        current.pendingItemReward = null;
      },
      rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
    });
    if (!cleared.ok) return true;
  }

  const pendingNode = getRun()?.currentZone?.nodes?.find(
    (node) => String(node.id) === String(getRun().currentZone.pendingNodeId)
  );
  const pendingType = pendingNode?.type === "random" ? pendingNode.revealedType : pendingNode?.type;
  if (pendingNode && pendingType === "item") {
    renderMap({ persist: false });
    resolveItemNode(pendingNode);
    return true;
  }
  return false;
}

function itemRewardCandidates(node) {
  const existing = getRun().pendingItemReward;
  const sameNode = existing && String(existing.nodeId) === String(node.id);
  const savedCandidates = sameNode
    ? (existing.candidateIds || []).map(itemDefinitionById).filter(Boolean)
    : [];
  if (savedCandidates.length) return savedCandidates;

  const random = global.DraftEngine.randomFromSeed(`${getRun().currentZone.seed}:${node.id}`);
  return weightedItemCandidates(random, 3);
}

function ensurePendingItemReward(node) {
  const nodeId = String(node.id);
  const existing = getRun().pendingItemReward;
  const sameNode = existing && String(existing.nodeId) === nodeId;
  const canonicalNode = activeItemRewardNodeById(getRun(), nodeId, { allowClaimed: sameNode && existing.status === "claimed" });
  if (!canonicalNode) return null;
  node = canonicalNode;
  const candidates = itemRewardCandidates(node);
  const candidateIds = candidates.map((item) => item.id);
  const selectedItemId = sameNode && candidateIds.includes(existing.selectedItemId)
    ? existing.selectedItemId
    : candidateIds[0];
  const offered = {
    nodeId: String(node.id),
    sourceNodeType: node.type,
    candidateIds,
    selectedItemId,
    status: sameNode && existing.status === "claimed" ? "claimed" : "offered",
    claimedItemId: sameNode ? existing.claimedItemId || null : null,
    claimedInstanceId: sameNode ? existing.claimedInstanceId || null : null,
  };
  if (sameNode && existing.candidateIds?.length) return { pending: existing, candidates };
  const committed = persistGameplayMutation({
    label: "item-reward-offer",
    mutate: (current) => {
      const currentNode = activeItemRewardNodeById(current, nodeId);
      if (!currentNode) throw new Error("Item reward node changed");
      if (!current.pendingItemReward || String(current.pendingItemReward.nodeId) !== nodeId) current.pendingItemReward = offered;
    },
    rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
  });
  if (!committed.ok) return false;
  return { pending: getRun().pendingItemReward, candidates };
}

function itemRewardOwnedQuantity(item) {
  const key = inventoryItemIdentity(item);
  return groupedOwnedInventoryItems(getRun()).find((group) => group.key === key)?.quantity || 0;
}

function itemRewardCategory(item) {
  if (item.kind === "equipment") return "Equipaggiamento";
  if (item.effect === "pull_reroll" || item.effect === "lucky_pull") return "Oggetto Pull";
  if (item.effect === "player_level" || item.effect === "team_level" || item.effect === "potential_boost") return "Allenamento";
  return "Consumabile";
}

function itemRewardEffect(item) {
  if (item.kind === "equipment") return `+${Number(item.bonus || 0)} ${itemStatLabel(item.stat)}`;
  return item.description || "Effetto disponibile dall’Inventario.";
}

function itemRewardUsageNote(item) {
  if (item.effect === "pull_reroll" || item.effect === "lucky_pull") return "Utilizzabile durante un Pull previsto.";
  if (item.kind === "equipment") return "Verrà aggiunto agli Oggetti. Potrai equipaggiarlo in seguito.";
  return "Verrà aggiunto agli Oggetti e manterrà il suo utilizzo attuale.";
}

function itemRewardCandidateMarkup(item, selected) {
  return `
    <button type="button" class="item-reward-candidate ${selected ? "selected" : ""}" data-reward-candidate="${escapeHtml(item.id)}" aria-pressed="${selected ? "true" : "false"}">
      ${itemIcon(item)}
      <span><small>${escapeHtml(itemRewardCategory(item))}</small><strong>${escapeHtml(item.name)}</strong><em>${escapeHtml(itemRewardEffect(item))}</em></span>
    </button>`;
}

function itemRewardDetailMarkup(item, selected) {
  const owned = itemRewardOwnedQuantity(item);
  const full = getRun().inventory.length >= global.SEASON1_CONFIG.maxInventory;
  const actionLabel = item.kind === "equipment" ? "AGGIUNGI AGLI OGGETTI" : "PRENDI";
  return `
    <article class="item-reward-detail" data-reward-detail="${escapeHtml(item.id)}" ${selected ? "" : "hidden"}>
      <div class="item-reward-visual">${itemIcon(item)}</div>
      <div class="item-reward-copy">
        <p class="eyebrow">${escapeHtml(itemRewardCategory(item))}</p>
        <h2>${escapeHtml(item.name)}</h2>
        <p>${escapeHtml(item.description)}</p>
        <div class="item-reward-effect"><span>Effetto reale</span><strong>${escapeHtml(itemRewardEffect(item))}</strong></div>
        <p class="item-reward-note">${escapeHtml(itemRewardUsageNote(item))}</p>
        <dl class="item-reward-stats">
          <div><dt>Già posseduti</dt><dd>${owned}</dd></div>
          <div><dt>Spazio inventario</dt><dd>${getRun().inventory.length}/${global.SEASON1_CONFIG.maxInventory}</dd></div>
        </dl>
        ${full ? '<p class="item-reward-capacity" role="status">Inventario pieno. Prima di prendere la ricompensa potrai scegliere un oggetto da rimuovere.</p>' : ""}
        <div class="item-reward-primary-action">
          <button type="button" class="btn btn-yellow btn-primary-action" data-claim-item="${escapeHtml(item.id)}">${actionLabel}</button>
        </div>
      </div>
    </article>`;
}

function resolveItemNode(node) {
  const prepared = ensurePendingItemReward(node);
  if (prepared === false) return;
  if (!prepared) return renderMap({ persist: false });
  const { pending, candidates } = prepared;
  if (pending.status === "claimed") return renderItemRewardResult(node);
  getUi().itemRewardSubmitting = false;
  openModal(`
    <section class="item-reward-screen">
      <div class="item-reward-head">
        <p class="eyebrow">${node.type === "random" ? "Ricompensa dal nodo ?" : "Ricompensa della run"}</p>
        <h1>OGGETTO TROVATO</h1>
        <p>Scegli una delle tre ricompense estratte. La scelta resta identica anche dopo un refresh.</p>
      </div>
      <main class="item-reward-content">
        <div class="item-reward-layout">
          <aside class="item-reward-options" aria-label="Oggetti disponibili">
            ${candidates.map((item) => itemRewardCandidateMarkup(item, item.id === pending.selectedItemId)).join("")}
          </aside>
          <div class="item-reward-details" aria-live="polite">
            ${itemRewardDetailMarkup(candidates.find((item) => item.id === pending.selectedItemId) || candidates[0], true)}
          </div>
        </div>
      </main>
      <div class="node-actions item-reward-actions"><button type="button" class="btn btn-ghost" id="skip-item">RINUNCIA</button></div>
    </section>`,
    { closeable: false, className: "item-reward-modal" }
  );
  const modal = modalRoot.querySelector(".item-reward-modal");
  modal.addEventListener("click", (event) => {
    const candidateButton = event.target.closest("[data-reward-candidate]");
    if (candidateButton) {
      const itemId = candidateButton.dataset.rewardCandidate;
      if (!candidates.some((candidate) => candidate.id === itemId)) return;
      const nodeId = String(node.id);
      const committed = persistGameplayMutation({ label: "item-reward-select", mutate: (current) => {
        const currentPending = current.pendingItemReward;
        if (!activeItemRewardNodeById(current, nodeId) || !currentPending || String(currentPending.nodeId) !== nodeId || currentPending.status !== "offered" || !currentPending.candidateIds?.includes(itemId)) throw new Error("Item reward selection changed");
        currentPending.selectedItemId = itemId;
      }, rerender: ({ ok }) => { if (!ok) recoverCanonicalItemReward(nodeId); } });
      if (!committed.ok) return;
      modal.querySelectorAll("[data-reward-candidate]").forEach((button) => {
        const active = button.dataset.rewardCandidate === itemId;
        button.classList.toggle("selected", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const selectedItem = candidates.find((candidate) => candidate.id === itemId);
      const details = modal.querySelector(".item-reward-details");
      if (selectedItem && details) details.innerHTML = itemRewardDetailMarkup(selectedItem, true);
      modal.querySelector(`[data-claim-item="${cssEscape(itemId)}"]`)?.focus?.({ preventScroll: true });
      return;
    }

    const claimButton = event.target.closest("[data-claim-item]");
    if (!claimButton || getUi().itemRewardSubmitting) return;
    const item = candidates.find((candidate) => candidate.id === claimButton.dataset.claimItem);
    if (!item || getRun().pendingItemReward?.status !== "offered") return;
    getUi().itemRewardSubmitting = true;
    modal.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    receiveItem(
      item,
      node,
      (instance) => completeItemReward(node, instance),
      () => {
        getUi().itemRewardSubmitting = false;
        recoverCanonicalItemReward(node.id);
      }
    );
  });
  document.getElementById("skip-item").addEventListener("click", () => {
    if (getUi().itemRewardSubmitting) return;
    getUi().itemRewardSubmitting = true;
    const nodeId = String(node.id);
    persistGameplayMutation({ label: "item-reward-skip", mutate: (current) => {
      const currentNode = activeItemRewardNodeById(current, nodeId);
      if (!currentNode || String(current.pendingItemReward?.nodeId) !== nodeId) throw new Error("Item reward state changed");
      current.pendingItemReward = null;
      global.MapEngine.completeNode(current.currentZone, currentNode.id);
      global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.NODE_COMPLETED, { nodeId: currentNode.id, nodeType: currentNode.type, actionId: `${current.runId}:${currentNode.id}:node_completed` });
      current.phase = "map";
    }, onCommitted: () => { closeModal(); toast("Hai rinunciato all'oggetto"); renderMap({ persist: false }); }, rerender: ({ ok }) => { if (!ok) { getUi().itemRewardSubmitting = false; recoverCanonicalItemReward(nodeId); } } });
  });
}

function completeItemReward(node, instance) {
  getUi().itemRewardSubmitting = false;
  { const currentNode = canonicalNodeById(node.id); currentNode ? renderItemRewardResult(currentNode) : renderMap({ persist: false }); }
}

function recoverCanonicalItemReward(nodeId) {
  const pending = getRun()?.pendingItemReward;
  if (pending?.status === "claimed" && String(pending.nodeId) === String(nodeId)) return rerenderCanonicalItemReward(nodeId);
  const currentNode = activeItemRewardNodeById(getRun(), nodeId);
  return currentNode ? resolveItemNode(currentNode) : renderMap({ persist: false });
}

function rerenderCanonicalItemReward(expectedNodeId) {
  const pendingNodeId = getRun()?.pendingItemReward?.nodeId;
  if (pendingNodeId == null || String(pendingNodeId) !== String(expectedNodeId)) return renderMap({ persist: false });
  const currentNode = canonicalNodeById(pendingNodeId);
  return currentNode ? renderItemRewardResult(currentNode) : renderMap({ persist: false });
}

function renderItemRewardResult(node) {
  const expectedNodeId = String(node.id);
  const pending = getRun().pendingItemReward;
  if (pending && String(pending.nodeId) !== expectedNodeId) return rerenderCanonicalItemReward(pending.nodeId);
  const item = itemDefinitionById(pending?.claimedItemId) || itemDefinitionById(pending?.selectedItemId);
  if (!pending || !item) {
    return persistGameplayMutation({ label: "item-reward-invalid-cleanup", mutate: (current) => {
      if (current.pendingItemReward && String(current.pendingItemReward.nodeId) !== expectedNodeId) throw new Error("Item reward result changed");
      current.pendingItemReward = null;
    }, onCommitted: () => { closeModal(); renderMap({ persist: false }); }, rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); } });
  }
  openModal(`
    <section class="item-reward-screen item-reward-screen--complete">
      <div class="item-reward-head">
        <p class="eyebrow">Ricompensa acquisita</p>
        <h1>OGGETTO OTTENUTO</h1>
      </div>
      <main class="item-reward-content">
        <article class="item-reward-result">
          <div class="item-reward-visual">${itemIcon(item)}</div>
          <div>
            <p class="eyebrow">${escapeHtml(itemRewardCategory(item))}</p>
            <h2>${escapeHtml(item.name)}</h2>
            <p>${escapeHtml(itemRewardUsageNote(item))}</p>
            <div class="item-reward-effect"><span>Effetto reale</span><strong>${escapeHtml(itemRewardEffect(item))}</strong></div>
            <dl class="item-reward-stats">
              <div><dt>Ora posseduti</dt><dd>${itemRewardOwnedQuantity(item)}</dd></div>
              <div><dt>Spazio inventario</dt><dd>${getRun().inventory.length}/${global.SEASON1_CONFIG.maxInventory}</dd></div>
            </dl>
          </div>
        </article>
      </main>
      <div class="node-actions item-reward-actions">
        <button type="button" class="btn btn-yellow btn-primary-action" id="finish-item-reward">TORNA ALLA MAPPA</button>
      </div>
    </section>`,
    { closeable: false, className: "item-reward-modal item-reward-result-modal" }
  );
  document.getElementById("finish-item-reward").addEventListener("click", () => {
    persistGameplayMutation({ label: "item-reward-cleanup", mutate: (current) => {
      if (current.pendingItemReward?.status !== "claimed" || String(current.pendingItemReward.nodeId) !== expectedNodeId) throw new Error("Item reward result changed");
      current.pendingItemReward = null;
    }, onCommitted: () => { closeModal(); toast(`Hai ottenuto ${item.name}`); renderMap({ persist: false }); }, rerender: ({ ok }) => { if (!ok) rerenderCanonicalItemReward(expectedNodeId); } });
  });
}

function resolveRandomNode(node) {
  const revealedType = node?.revealedType;
  if (!revealedType) return renderMap({ persist: false });
  const meta = global.SEASON1_CONFIG.nodeLabels[revealedType];
  openModal(`
    <div class="modal-head random-event-head"><div><p class="eyebrow">Evento casuale</p><h2>${escapeHtml(meta.label)}</h2><p class="muted">Il contenuto è stato rivelato e non cambierà ricaricando la pagina.</p></div></div>
    <div class="random-event-reveal" style="--reveal-color:${meta.color}"><span aria-hidden="true">${meta.icon}</span><strong>${escapeHtml(meta.label)}</strong><small>Pronto da aprire</small></div>
    <div class="node-actions"><button type="button" class="btn btn-primary btn-primary-action" id="open-hidden-event">Continua</button></div>`,
    { closeable: false, className: "random-event-modal" }
  );
  document.getElementById("open-hidden-event").addEventListener("click", () => {
    closeModal();
    const currentNode = canonicalNodeById(node.id);
    currentNode ? dispatchNode(currentNode, revealedType, { previousNodeId: getRun().currentZone?.currentNodeId }) : renderMap({ persist: false });
  });
}

    return { ensureCurrentZone, ensureCurrentZoneMutation, activeMatchNeedsPhaseRecovery, recoverInterruptedMatchAccess, renderMap, renderMapFailureRecovery, bossTeamLogoUrl, bossNodeIconMarkup, canonicalNodeById, pendingPullNodeById, activePullNodeById, activeItemRewardNodeById, canonicalActivePullNodeById, rerenderCanonicalPull, enterMatchFromNode, enterNode, dispatchNode, finishNonMatchNode, completePullNodeMutation, resumePendingItemReward, ensurePendingItemReward, resolveItemNode, recoverCanonicalItemReward, renderItemRewardResult };
  }

  global.RunMapControllerRuntime = { create };
})(globalThis);
