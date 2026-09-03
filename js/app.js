(function (global) {
  "use strict";

  const DEV_MODE = new URLSearchParams(global.location?.search || "").get("dev") === "1";
  const TEST_MATCH_CONTROLS_ENABLED = DEV_MODE;
  if (DEV_MODE) global.addEventListener("DOMContentLoaded", () => {
    const tools = document.createElement("aside");
    tools.className = "persistence-dev-tools";
    tools.style.cssText = "position:fixed;top:calc(env(safe-area-inset-top, 0px) + 8px);right:calc(env(safe-area-inset-right, 0px) + 8px);z-index:10000;display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:min(300px,calc(100vw - 16px));pointer-events:none";
    tools.innerHTML = '<button type="button" data-dev-diagnostics-trigger aria-expanded="false" aria-controls="dev-diagnostics-menu" style="pointer-events:auto;min-width:44px;min-height:36px;padding:6px 10px">DEV</button><div id="dev-diagnostics-menu" data-dev-diagnostics-menu hidden style="pointer-events:auto;background:#05080f;border:1px solid #52627a;border-radius:10px;padding:8px;box-shadow:0 10px 28px #000a;max-width:100%"><button type="button" data-persistence-diagnostic>COPIA DIAGNOSTICA SALVATAGGIO</button><button type="button" data-raw-save-diagnostic>COPIA RAW SAVE IE1/IE2</button><button type="button" data-persistence-repair>RIPARA SALVATAGGIO</button><span data-persistence-feedback role="status" aria-live="polite" style="display:block;color:#fff;font:700 11px sans-serif;margin-top:6px"></span></div>';
    const trigger = tools.querySelector("[data-dev-diagnostics-trigger]");
    const menu = tools.querySelector("[data-dev-diagnostics-menu]");
    const setOpen = (open) => { menu.hidden = !open; trigger.setAttribute("aria-expanded", String(open)); };
    trigger.onclick = () => setOpen(menu.hidden);
    document.addEventListener("click", (event) => { if (!menu.hidden && !tools.contains(event.target)) setOpen(false); });
    const feedback = tools.querySelector("[data-persistence-feedback]");
    const download = (text) => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); link.download = `inazuma-raw-save-diagnostic-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 0); };
    const copy = async (value, fallback = false) => { const text = JSON.stringify(value, null, 2); try { if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable"); await navigator.clipboard.writeText(text); return true; } catch (error) { if (fallback) download(text); else throw error; return false; } finally { console.info("Inazuma persistence report", value); } };
    tools.querySelector("[data-persistence-diagnostic]").onclick = async () => { try { await copy(await global.InazumaPersistenceDiagnostics.snapshot()); } finally { setOpen(false); } };
    tools.querySelector("[data-raw-save-diagnostic]").onclick = async () => { try { const copied = await copy(await global.InazumaPersistenceDiagnostics.exportRawLegacySaves(), true); feedback.textContent = copied ? "DIAGNOSTICA RAW COPIATA" : "CLIPBOARD NON DISPONIBILE: JSON SCARICATO"; } finally { setOpen(false); } };
    tools.querySelector("[data-persistence-repair]").onclick = async () => { try { const result = await global.InazumaPersistenceDiagnostics.repair(); await copy(result); alert(repairResultMessage(result)); } finally { setOpen(false); } };
    document.body.appendChild(tools);
  });
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");

  function repairResultMessage(result = {}) {
    if (result.blocker) return `Riparazione non applicata: ${result.blocker}`;
    return result.repaired === true ? "Riparazione salvataggio completata. Report copiato." : "Nessuna modifica necessaria. Report copiato.";
  }

  function persistenceWritesAllowed() {
    return !global.PersistenceRecoveryGuard?.isBlocked?.();
  }

  const SECTION_ROOT_DESTINATIONS = {
    seasonSelection: { destination: "home", label: "Torna alla Home" },
    run: { destination: "seasonSelection", label: "Torna alla selezione delle run" },
    albumRoot: { destination: "home", label: "Torna alla Home" },
    albumCollection: { destination: "albumRoot", label: "Torna alle collezioni Album" },
    albumRoster: { destination: "albumTeams", label: "Torna alla selezione squadre" },
    hallRoot: { destination: "home", label: "Torna alla Home" },
    hallDetail: { destination: "hallRoot", label: "Torna all’Albo d’Oro" },
    finalSummary: { destination: "home", label: "Torna alla Home" },
    development: { destination: "seasonSelection", label: "Torna alla selezione delle run" },
    match: { destination: "map", label: "Torna alla mappa della run" },
  };

  function getSectionRootDestination(section) {
    return SECTION_ROOT_DESTINATIONS[section] || SECTION_ROOT_DESTINATIONS.seasonSelection;
  }

  function sectionRootButton(section, extraClass = "") {
    const destination = getSectionRootDestination(section);
    return `<button type="button" class="section-root-button ${escapeHtml(extraClass)}" data-section-root="${escapeHtml(section)}" aria-label="${escapeHtml(destination.label)}" title="${escapeHtml(destination.label)}">
      <svg class="section-root-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7"/><path d="M9 12h11"/></svg>
    </button>`;
  }

  function navigateToSectionRoot(section, context = {}) {
    const destination = getSectionRootDestination(section).destination;
    if (destination === "map" && run?.activeMatch) return leaveMatchViaSectionRoot();
    closeModal({ invokeOnClose: false });
    if (destination === "home") return renderHome();
    if (destination === "seasonSelection") {
      if (run) { try { global.RunState.save(run); } catch (error) { console.error("save failed (seasonSelection nav)", error); } }
      return renderSeasonSelect();
    }
    if (destination === "map") {
      if (run) { run.phase = "map"; try { global.RunState.save(run); } catch (error) { console.error("save failed (map nav)", error); } }
      return renderMap();
    }
    if (destination === "albumRoot") return renderAlbumCollections();
    if (destination === "albumTeams") return renderAlbumTeams(context.collectionId || ui.albumCollectionId || global.AlbumProgress.DEFAULT_COLLECTION_ID);
    if (destination === "hallRoot") return renderHallOfFame();
    return renderHome();
  }

  function leaveMatchViaSectionRoot() {
    const match = run?.activeMatch;
    if (!match) return renderMap();
    const sim = match.simulation;
    if (sim?.state === "simulating") return renderMatch();
    if ((sim?.state === "completed" || String(match.state || "").startsWith("completed")) && sim?.resolutionApplied !== true) return applySimulationResolution(match);
    if (sim?.resolutionApplied === true) return continueAfterMatch();
    const identity = matchTransactionIdentity(match);
    const committed = commitMatchMutation("match-prematch-back", identity, (currentMatch, current) => {
      currentMatch.postMatchNavigationApplied = true;
      current.activeMatch = null;
      current.phase = "map";
    });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    ui.match = null; closeModal({ invokeOnClose: false }); return renderMap({ persist: false });
  }

  function bindSectionRootNav(context = {}) {
    document.querySelectorAll("[data-section-root]").forEach((button) => {
      button.addEventListener("click", () => navigateToSectionRoot(button.dataset.sectionRoot, context));
    });
  }

  const inventoryModel = global.InventoryModel.create({ getItemPool: () => global.SEASON1_CONFIG.itemPool });
  const { itemDefinitionById, resolveItem, inventoryItemIdentity, inventoryItemCategory, groupedInventoryItems, groupedInventoryByCategory, groupedOwnedInventoryItems, groupedOwnedInventoryByCategory, inventoryOwnershipSummary, itemStatLabel, inventoryFilterDefinitions, inventoryGroupMatchesFilter } = inventoryModel;
  global.InventoryHelpers = { inventoryItemIdentity, inventoryItemCategory, groupedInventoryItems, groupedInventoryByCategory, groupedOwnedInventoryItems, groupedOwnedInventoryByCategory, inventoryOwnershipSummary, categories: inventoryModel.categories };
  const itemPresenter = global.InventoryItemPresenter.create({ resolveItem, escapeHtml });
  const { itemImageFallbackSvg, equipmentBadgeMarkup, itemIcon } = itemPresenter;
  global.handleItemImageError = itemPresenter.handleItemImageError;


  let seasonDb = null;
  let activeSeason = null;
  let freeAgentsDb = null;
  let freeAgentsById = new Map();
  let seasonPlayersById = new Map();
  let seasonTeamsById = new Map();
  let playerVisualsById = new Map();
  function isProfileAwareSeason(seasonId = run?.seasonId) {
    return global.SeasonRegistry?.database?.(seasonId)?.requiresProfileAwareRuntime === true;
  }
  const playerVisuals = global.PlayerVisuals.create({ getPlayerVisualsById: () => playerVisualsById, escapeHtml });
  global.handlePlayerImageError = playerVisuals.handleImageError;
  const playerView = global.PlayerView.create({
    visuals: playerVisuals, escapeHtml, resolveItem, itemIcon,
    getProgression: () => global.InazumaProgression,
    applyEquipment: (stats, equipment) => global.RoguelikeRules.applyEquipment(stats, equipment),
    formatLevel: (...args) => global.LevelProgression.formatLevel(...args), getSeasonId: () => run?.seasonId,
    sourcePlayer, playerTeamIdentity, historicalTeamIdentity, teamLogoMarkup, playerStatsMarkup,
  });
  const { rarityClass, statIcon, STAT_LABELS } = playerView;
  let run = null;
  const ui = {
    selectedSquadPlayerId: null,
    activeTab: "map",
    match: null,
    pendingReward: null,
    squadEditMode: false,
    fiveVFiveSelectedSlot: null,
    fiveVFiveRoleFilter: "all",
    tradeSelectedPlayerId: null,
    bossMatchTab: "user",
    bossMatchState: "pre-match",
    bossMatchLog: [],
    bossMatchResolving: false,
    fiveMatchTab: "user",
    matchPlaybackTimer: null,
    returnToMatchContext: null,
    inventoryFilter: "all",
    inventoryTab: "items",
    inventorySelectedItemId: null,
    inventoryEquipmentPlayerId: null,
    inventoryEquipmentItemId: null,
    itemRewardSubmitting: false,
    albumCollectionId: null,
    albumTeamId: null,
    selectedDevelopmentPlayerId: null,
    developmentQuery: "",
    developmentRarity: "Tutti",
    developmentManagementRarity: "Tutti",
    devLegendaryPullSequence: 0,
  };

  function stopGameplayRuntime() {
    if (ui.matchPlaybackTimer) clearTimeout(ui.matchPlaybackTimer);
    ui.matchPlaybackTimer = null;
    ui.bossMatchResolving = false;
    ui.itemRewardSubmitting = false;
  }

  const gameplayFailureDiagnostics = [];
  function recordGameplayFailure(label, stage, error, kind = null) {
    if (!DEV_MODE) return null;
    const current = run;
    const seasonId = current?.seasonId || activeSeason?.id || null;
    let canonical = null; let storage = null;
    try { canonical = seasonId ? global.RunState.load(seasonId, { readOnly: true }) : null; } catch (_) {}
    try { storage = seasonId ? global.RunStorage?.diagnostics?.(seasonId) : null; } catch (_) {}
    const match = current?.activeMatch || ui.match || null;
    const entry = {
      at: new Date().toISOString(), label: label || "unknown", stage, kind,
      seasonId, runId: current?.runId || null, phase: current?.phase || null,
      error: { name: error?.name || null, code: error?.code || null, stage: error?.stage || null, message: error?.message || String(error || ""), recoverable: error?.recoverable === true },
      generation: { memory: current?.storageGeneration ?? null, canonical: canonical?.storageGeneration ?? storage?.canonicalGeneration ?? null, expected: error?.generation ?? current?.storageGeneration ?? null },
      commitId: { memory: current?.storageCommitId || null, canonical: canonical?.storageCommitId || storage?.canonicalCommitId || null },
      canonicalRunId: canonical?.runId || storage?.canonicalRunId || null,
      match: match ? { matchId: match.matchId || null, type: match.type || null, state: match.state || null, simulationState: match.simulation?.state || null, resolutionApplied: match.simulation?.resolutionApplied === true } : null,
      node: { currentNodeId: current?.currentZone?.currentNodeId || null, pendingNodeId: current?.currentZone?.pendingNodeId || null },
      storage: storage ? { bytes: storage.bytes, totalKnownBytes: storage.totalKnownBytes, headGeneration: storage.headGeneration, backupGeneration: storage.backupGeneration, headMatchesCanonical: storage.headMatchesCanonical } : null,
    };
    gameplayFailureDiagnostics.push(entry);
    if (gameplayFailureDiagnostics.length > 20) gameplayFailureDiagnostics.shift();
    console.error("Gameplay persistence diagnostic", entry);
    return entry;
  }

  const persistGameplayMutation = global.GameplayPersistence.create({
    save: (current, options) => global.RunState.save(current, options),
    load: (seasonId, options) => global.RunState.load(seasonId, options),
    getRun: () => run,
    replaceRun: (canonical) => {
      run = canonical;
      global.run = canonical;
      ui.match = canonical.activeMatch || null;
      ui.pendingReward = canonical.pendingReward || null;
      ui.tradeSelectedPlayerId = null;
      ui.selectedSquadPlayerId = null;
      ui.fiveVFiveSelectedSlot = null;
      ui.returnToMatchContext = null;
    },
    stopRuntime: stopGameplayRuntime,
    reportFailure: (message, kind, error, options) => { recordGameplayFailure(options?.label, "persistence", error, kind); toast(message, "error"); },
    reportMutationFailure: (message, error, options) => {
      recordGameplayFailure(options?.label, "mutation", error, "mutation");
      console.error("Gameplay mutation failed", error);
      toast(message, "error");
    },
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message, type = "success") {
    const element = document.createElement("div");
    element.className = `toast toast--${type === "error" ? "error" : "success"}`;
    element.setAttribute("role", "status");
    element.innerHTML = `<span class="toast-mark" aria-hidden="true">${type === "error" ? "!" : "✓"}</span><span class="toast-copy">${escapeHtml(message)}</span>`;
    toastRoot.appendChild(element);
    setTimeout(() => element.remove(), 3200);
  }

  function closeModal({ invokeOnClose = true } = {}) {
    const restoreFocusTo = modalRoot._restoreFocusTo;
    const restoreScrollTo = modalRoot._restoreScrollTo;
    const onClose = modalRoot._onClose;
    modalRoot.innerHTML = "";
    modalRoot._restoreFocusTo = null;
    modalRoot._restoreScrollTo = null;
    modalRoot._onClose = null;
    modalRoot.removeAttribute("style");
    modalRoot.classList.remove("has-open-modal");
    [document.documentElement, document.body, app].forEach((element) => {
      if (!element) return;
      element.classList.remove("modal-scroll-locked");
      const savedStyle = element._modalSavedStyle;
      if (savedStyle !== undefined) {
        if (savedStyle == null) element.removeAttribute("style");
        else element.setAttribute("style", savedStyle);
        delete element._modalSavedStyle;
      }
    });
    if (restoreScrollTo) restorePageScroll(restoreScrollTo);
    if (restoreFocusTo && typeof restoreFocusTo.focus === "function" && document.contains(restoreFocusTo)) {
      try { restoreFocusTo.focus({ preventScroll: true }); } catch (_) { restoreFocusTo.focus(); }
    }
    if (invokeOnClose && typeof onClose === "function") onClose();
  }

  if (window.history && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  function scrollSnapshot() {
    const modal = modalRoot.querySelector(".modal");
    const activeView = app.querySelector("main") || app.firstElementChild || app;
    return {
      windowX: window.scrollX || 0,
      windowY: window.scrollY || 0,
      appLeft: app ? app.scrollLeft || 0 : 0,
      appTop: app ? app.scrollTop || 0 : 0,
      viewLeft: activeView ? activeView.scrollLeft || 0 : 0,
      viewTop: activeView ? activeView.scrollTop || 0 : 0,
      modalLeft: modal ? modal.scrollLeft || 0 : 0,
      modalTop: modal ? modal.scrollTop || 0 : 0,
    };
  }

  function setScrollPosition(element, top = 0, left = 0) {
    if (!element) return;
    if (typeof element.scrollTo === "function") {
      element.scrollTo({ top, left, behavior: "auto" });
    } else {
      element.scrollTop = top;
      element.scrollLeft = left;
    }
    element.scrollTop = top;
    element.scrollLeft = left;
  }

  function restorePageScroll(snapshot) {
    if (!snapshot) return;
    const activeView = app.querySelector("main") || app.firstElementChild || app;
    setScrollPosition(activeView, snapshot.viewTop || 0, snapshot.viewLeft || 0);
    setScrollPosition(app, snapshot.appTop || 0, snapshot.appLeft || 0);
    try {
      window.scrollTo({ top: snapshot.windowY || 0, left: snapshot.windowX || 0, behavior: "auto" });
    } catch (error) {
      window.scrollX = snapshot.windowX || 0;
      window.scrollY = snapshot.windowY || 0;
    }
  }

  function restoreScroll(snapshot) {
    if (!snapshot) return;
    const modal = modalRoot.querySelector(".modal");
    setScrollPosition(modal, snapshot.modalTop || 0, snapshot.modalLeft || 0);
    restorePageScroll(snapshot);
  }

  function afterNextPaint(callback) {
    requestAnimationFrame(() => requestAnimationFrame(callback));
  }

  function runKeepingScroll(callback) {
    const snapshot = scrollSnapshot();
    const result = callback();
    afterNextPaint(() => restoreScroll(snapshot));
    return result;
  }

  function isScrollableElement(element) {
    if (!element || element === document.body || element === document.documentElement) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(element) : null;
    const overflowY = style ? `${style.overflowY} ${style.overflow}` : "";
    const overflowX = style ? `${style.overflowX} ${style.overflow}` : "";
    const canScrollY = /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight;
    const canScrollX = /(auto|scroll|overlay)/.test(overflowX) && element.scrollWidth > element.clientWidth;
    return canScrollY || canScrollX || element.scrollTop > 0 || element.scrollLeft > 0;
  }

  function scrollTargetsForView(viewElement = null) {
    const roots = [viewElement, modalRoot.querySelector(".modal"), app.querySelector("main"), app, document.scrollingElement, document.documentElement, document.body].filter(Boolean);
    const targets = new Set();
    roots.forEach((root) => {
      targets.add(root);
      if (root.querySelectorAll) root.querySelectorAll("*").forEach((element) => {
        if (isScrollableElement(element)) targets.add(element);
      });
    });
    return [...targets];
  }

  function resetViewScroll(viewElement = null) {
    scrollTargetsForView(viewElement).forEach((element) => setScrollPosition(element, 0, 0));
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (error) {
      window.scrollX = 0;
      window.scrollY = 0;
    }
    if (document.documentElement) { document.documentElement.scrollTop = 0; document.documentElement.scrollLeft = 0; }
    if (document.body) { document.body.scrollTop = 0; document.body.scrollLeft = 0; }
  }

  function resetRenderedViewScroll(viewElement = null) {
    const view = viewElement || app.querySelector("main") || app.firstElementChild || app;
    resetViewScroll(view);
    afterNextPaint(() => resetViewScroll(view));
  }

  function openModal(content, { closeable = true, className = "", onClose = null, preserveScroll = null } = {}) {
    if (modalRoot.firstElementChild) closeModal({ invokeOnClose: false });
    modalRoot._restoreFocusTo = document.activeElement;
    modalRoot._restoreScrollTo = preserveScroll || scrollSnapshot();
    modalRoot._onClose = onClose;
    [document.documentElement, document.body, app].forEach((element) => {
      element._modalSavedStyle = element.getAttribute("style");
      element.classList.add("modal-scroll-locked");
    });
    modalRoot.classList.add("has-open-modal");
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal ${className}">
          ${closeable ? '<button type="button" class="modal-close" data-close-modal aria-label="Chiudi">✕</button>' : ""}
          ${content}
        </section>
      </div>`;
    modalRoot.querySelector("[data-close-modal]")?.addEventListener("click", () => {
      closeModal();
    });
    const modal = modalRoot.querySelector(".modal");
    resetRenderedViewScroll(modal);
    if (preserveScroll) afterNextPaint(() => restorePageScroll(preserveScroll));
    afterNextPaint(() => modalRoot.querySelector("[data-close-modal]")?.focus?.({ preventScroll: true }));
  }

  function formationById(id) {
    return seasonDb.formations.eleven.find((formation) => formation.id === id);
  }

  function fiveRoleForPlayerId(playerId, currentRun = run) {
    const entry = rosterEntry(playerId, currentRun);
    return entry ? (resolvedRosterPlayer(playerId, currentRun)?.position || sourcePlayer(entry)?.position) : null;
  }

  function effectiveRosterRole(playerId, currentRun = run) {
    return fiveRoleForPlayerId(playerId, currentRun);
  }

  const fiveVFiveController = global.FiveVFiveControllerRuntime.create({
    getRun: () => run, fiveVFive: global.FiveVFive,
    getRole: (id, current) => fiveRoleForPlayerId(id, current),
    getOverall: (id, current) => resolvedRosterPlayer(id, current)?.overall || 0,
    smartLineup: global.SmartLineup,
    getPreferences: () => global.RunState.loadProfile().preferences,
    formationById, toast, persistMutation: persistGameplayMutation,
    matchIdentity: matchTransactionIdentity, canonicalMatch: canonicalMatchFor, onPersistenceFailure: renderMapFailureRecovery,
  });
  function ensureFiveVFive(currentRun = run) { return fiveVFiveController.ensure(currentRun); }
  function fiveOverallForPlayerId(playerId, currentRun = run) { return resolvedRosterPlayer(playerId, currentRun)?.overall || 0; }
  function optimizeLineupsForNewPlayer(playerId, currentRun = run, announce = true) { return fiveVFiveController.optimizeForNewPlayer(playerId, currentRun, announce); }
  function fiveVFiveStatus(currentRun = run, options = {}) { return fiveVFiveController.status(currentRun, options); }

  function sourcePlayer(entryOrId, preferredSource) {
    const id = String(entryOrId && typeof entryOrId === "object" ? entryOrId.playerId : entryOrId);
    const source = preferredSource || (entryOrId && entryOrId.source);
    if (global.SeasonRegistry?.isSeasonSource?.(source)) return global.SeasonRegistry.player(id, source);
    return seasonPlayersById.get(id) || freeAgentsById.get(id);
  }

  function legacyRosterPlayer(entry, currentRun = run) {
    if (isProfileAwareSeason(currentRun?.seasonId)) return freeAgentsById.get(String(entry?.playerId));
    return sourcePlayer(entry);
  }

  function rosterEntry(playerId, currentRun = run) {
    return currentRun?.roster?.find((entry) => String(entry.playerId) === String(playerId));
  }

  function ensureRunSchema() {
    if (!run) return;
    run.inventory = Array.isArray(run.inventory) ? run.inventory : [];
    run.teamIdentity = normalizeTeamIdentity(run.teamIdentity);
    run.effects = run.effects || {};
    const legacyLuckyPulls = Number(run.effects.luckyPulls || run.luckyCharmActive || run.nextPullBoost || 0);
    if (legacyLuckyPulls > 0 && !run.effects.luckyPullsMigrated) {
      const luckyDefinition = global.SEASON1_CONFIG.itemPool.find((item) => item.id === "lucky_charm");
      for (let index = 0; index < legacyLuckyPulls; index += 1) run.inventory.push(makeItemInstance(luckyDefinition, `legacy_lucky_${index}`));
      run.effects.luckyPullsMigrated = true;
    }
    delete run.effects.luckyPulls;
    delete run.luckyCharmActive;
    delete run.nextPullBoost;
    run.randomEventHistory = Array.isArray(run.randomEventHistory) ? run.randomEventHistory : [];
    run.activeMatch = run.activeMatch || null;
    run.pendingItemReward = run.pendingItemReward || null;
    run.pendingBossVictory = run.pendingBossVictory || null;
    run.postBossFlow = run.postBossFlow || null;
    global.RunStatistics?.ensureRunStatistics?.(run);
    run.roster = (run.roster || []).map((entry) => {
      const source = sourcePlayer(entry);
      const training = source ? runtimeTrainingState(entry, run) : null;
      const potentialBoostApplications = training?.applications || global.InazumaProgression.normalizePotentialBoostApplications(entry, Number.POSITIVE_INFINITY);
      const potentialBoost = training?.currentLocalBoost ?? potentialBoostApplications.reduce((sum, boost) => sum + boost.amount, 0);
      return {
        ...entry,
        equippedItem: entry.equippedItem || null,
        potentialBoost,
        currentOverallBoost: Math.min(potentialBoost, Math.max(0, Number(entry.currentOverallBoost ?? entry.potentialBoost ?? potentialBoost))),
        potentialBoostApplications,
        intensiveTrainingMigrated: entry.intensiveTrainingMigrated || entry.currentOverallBoost !== undefined || potentialBoostApplications.some((boost) => boost.legacy),
      };
    });
    run.roster.forEach((entry) => {
      const player = sourcePlayer(entry);
      const resolved = player ? resolvedRosterPlayer(entry.playerId) : null;
      const ps = global.RunStatistics?.ensurePlayerStatistics?.(run, resolved || player || entry);
      if (ps && !ps.firstJoinedAt) {
        ps.firstJoinedAt = entry.firstJoinedAt || run.createdAt || new Date().toISOString();
        ps.recruitmentSource = entry.recruitmentSource || entry.source || "legacy";
        ps.recruitedAtLevel = entry.recruitedAtLevel ?? entry.level ?? null;
        ps.recruitedOverall = entry.recruitedOverall ?? (resolved?.overall ?? player?.finalOverall ?? null);
      }
    });
    run.lineup = (run.lineup || []).map(String);
    run.bench = (run.bench || []).map(String);
    if (run.roster.length && seasonDb && freeAgentsDb) ensureFiveVFive();
    run.inventory = run.inventory.map((item) => {
      const definition = global.SEASON1_CONFIG.itemPool.find((candidate) => candidate.id === item.id);
      return {
        ...item,
        ...(definition || {}),
        instanceId: item.instanceId || `${item.id || "legacy"}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
    });
  }

  function makeItemInstance(item, seedSuffix = "") {
    return {
      ...item,
      instanceId: `${item.id}_${Date.now()}_${seedSuffix || Math.random().toString(36).slice(2, 8)}`,
    };
  }

  function removeInventoryItem(instanceId) {
    const index = run.inventory.findIndex((item) => item.instanceId === instanceId);
    if (index < 0) return null;
    return run.inventory.splice(index, 1)[0];
  }

  function activeBasePotential(entry) {
    if (!entry) return 0;
    if (global.RoguelikeRules.isProfileAwareRosterEntry(entry, run)) {
      return Number(global.ProfiledSeasonRuntime.resolveEffectiveBase(entry, run.seasonId)?.finalOverall || 0);
    }
    return Number(legacyRosterPlayer(entry)?.finalOverall || 0);
  }

  function runtimeTrainingState(entry, currentRun = run) {
    const profileAware = global.RoguelikeRules.isProfileAwareRosterEntry(entry, currentRun);
    const player = profileAware ? global.ProfiledSeasonRuntime.resolveEffectiveBase(entry, currentRun.seasonId) : sourcePlayer(entry);
    const database = profileAware ? seasonDb : (global.SeasonRegistry?.isSeasonSource?.(entry?.source) ? (global.SeasonRegistry.database(entry.source) || seasonDb) : freeAgentsDb);
    return global.DevelopmentRuntime.trainingState(currentRun, player, entry, database, profileAware ? { permanentMode: "provided-base" } : undefined);
  }

  function resolvedRosterPlayer(playerId, currentRun = run) {
    const entry = rosterEntry(playerId, currentRun);
    if (!entry) return null;
    const player = global.RoguelikeRules.isProfileAwareRosterEntry(entry, currentRun)
      ? sourcePlayer(entry)
      : legacyRosterPlayer(entry, currentRun);
    const profileAware = global.RoguelikeRules.isProfileAwareRosterEntry(entry, currentRun);
    const database = profileAware ? seasonDb : (isProfileAwareSeason(currentRun?.seasonId) ? freeAgentsDb : (global.SeasonRegistry?.isSeasonSource?.(entry.source) ? (global.SeasonRegistry.database(entry.source) || seasonDb) : freeAgentsDb));
    if (!player && !profileAware) return null;
    const resolved = profileAware
      ? global.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(entry, { seasonId: currentRun.seasonId, database })
      : global.DevelopmentRuntime.resolveRosterPlayer(currentRun, player, entry, database);
    const effectiveStats = global.RoguelikeRules.applyEquipment(resolved.stats, entry.equippedItem);
    return {
      ...resolved,
      ...effectiveStats,
      stats: effectiveStats,
      baseStats: resolved.stats,
      equipment: entry.equippedItem,
      displayLevel: Number(entry.level || 0),
      displayLevelUnits: Number(entry.levelUnits || 0),
      displayLevelText: global.LevelProgression.formatLevel(entry, currentRun.seasonId),
      source: entry.source,
    };
  }

  function hearts() {
    return lifeHeartsMarkup(run.lives);
  }

  function lifeHeartsMarkup(lives) {
    const currentLives = Math.max(0, Number(lives) || 0);
    const maxLives = Number(global.RunState?.runLivesLimit?.() ?? global.SEASON1_CONFIG.maxRunLives ?? global.SEASON1_CONFIG.startingLives ?? 2);
    return Array.from({ length: maxLives }, (_, index) => {
      const remaining = currentLives - index;
      const state = remaining >= 1 ? "full" : remaining >= 0.5 ? "half" : "empty";
      return `<span class="life-heart life-heart--${state}" aria-hidden="true">${state === "full" ? "♥" : "♡"}</span>`;
    }).join("");
  }

  function remainingLivesText(lives) {
    const value = Number(lives) || 0;
    if (value === 0.5) return "resta mezza vita";
    if (value === 1) return "resta 1 vita";
    if (value === 1.5) return "restano 1 vita e mezza";
    return `restano ${value} vite`;
  }


  function averageOverall(players = null) {
    const list = Array.isArray(players) ? players : (run?.roster || []).map((entry) => resolvedRosterPlayer(entry.playerId || entry.id)).filter(Boolean);
    if (!list.length) return "-";
    const total = list.reduce((sum, player) => sum + Number(player.displayOverall ?? player.overall ?? player.finalOverall ?? 0), 0);
    return Math.round(total / list.length);
  }

  function formatDuration(ms) {
    const value = Number(ms);
    if (!Number.isFinite(value) || value <= 0) return "0 min";
    const minutes = Math.max(1, Math.round(value / 60000));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? `${hours}h ${rest}m` : `${minutes} min`;
  }

  function topbar(title, extraClass = "", rootSection = "run") {
    const identity = run ? normalizeTeamIdentity(run.teamIdentity) : null;
    const teamName = identity?.name || title || "Inazuma Roguelike";
    return `
      <header class="topbar game-topbar shared-game-header ${escapeHtml(extraClass)}">
        <div class="topbar-title-group">
          ${sectionRootButton(rootSection)}
          <div class="topbar-brand-block">
            <span class="topbar-kicker">${escapeHtml(title || "Inazuma Roguelike")}</span>
            <strong class="brand">${escapeHtml(teamName)}</strong>
          </div>
        </div>
        <div class="status-strip" aria-label="Stato run">
          <span class="status-pill"><small>OVR</small><strong>${escapeHtml(averageOverall())}</strong></span>
          <span class="status-pill"><small>LV</small><strong>${escapeHtml(global.LevelProgression.formatLevel(run, run.seasonId))}</strong></span>
          <span class="status-pill lives" title="Vite" aria-label="Vite ${escapeHtml(run.lives)}">${hearts()}</span>
        </div>
      </header>`;
  }

  function navIcon(name) {
    const icons = {
      map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 9 4l6 2.5 5-2.5v13.5l-5 2.5-6-2.5-5 2.5V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',
      squad: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c.7-3.2 2.4-5 4.5-5s3.8 1.8 4.5 5M12.5 17.5c.7-2.2 1.9-3.4 3.5-3.4 1.8 0 3.2 1.4 4 4"/></svg>',
      inventory: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V6a5 5 0 0 1 10 0v2"/><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 12h6"/></svg>',
      five: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="m12 8 3 2-1 4h-4l-1-4 3-2ZM4.8 10.5l4.2-.5M15 10l4.2.5M8.5 18l1.5-4M14 14l1.5 4"/></svg>',
    };
    return icons[name] || "";
  }

  function bottomNav(active) {
    if (!run || !run.roster.length) return "";
    const items = [
      ["map", "Percorso", "map"],
      ["squad", "Squadra", "squad"],
      ["inventory", "Oggetti", "inventory"],
      ["five", "5v5", "five"],
    ];
    return `
      <nav class="bottom-nav" aria-label="Navigazione principale">
        ${items.map(([destination, label, icon]) => `
          <button type="button" data-nav="${destination}" class="${active === destination ? "active" : ""}" aria-label="${label}" aria-current="${active === destination ? "page" : "false"}">
            <span class="nav-icon">${navIcon(icon)}</span>
            <span class="nav-label">${label}</span>
          </button>`).join("")}
      </nav>`;
  }

  function bindBottomNav() {
    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        closeModal({ invokeOnClose: false });
        const destination = button.dataset.nav;
        if (destination === "map") {
          return resumePostBossFlowOrMap();
        } else if (destination === "squad") {
          ensurePostBossFlow({ clearMatch: true });
          run.phase = "squad";
          try { global.RunState.save(run); } catch (error) { console.error("save failed (squad nav)", error); }
          renderSquad();
        } else if (destination === "inventory") {
          renderInventory();
        } else if (destination === "five") {
          openFiveVFiveEditor();
        }
      });
    });
  }

  function cssEscape(value) {
    if (global.CSS && typeof global.CSS.escape === "function") return global.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function playerImageCandidates(...args) { return playerVisuals.candidates(...args); }
  function resolvePlayerVisual(...args) { return playerVisuals.resolve(...args); }
  function imageFallbackAttributes(...args) { return playerVisuals.imageFallbackAttributes(...args); }
  function playerPortraitUrl(...args) { return playerVisuals.portraitUrl(...args); }
  function compactPlayerCardMarkup(...args) { return playerView.compactCard(...args); }

  function playerCard(player, options = {}) {
    const database = options.database || freeAgentsDb;
    const level = Number(options.level ?? 0);
    const pullSelection = options.context === "pull";
    const resolved = options.resolvedPlayer || (options.applyPermanent
      ? global.DevelopmentRuntime.resolvePlayer(run, player, Math.floor(level), database)
      : global.InazumaProgression.getPlayerAtLevel(player, Math.floor(level), database));
    const tag = options.button ? "button" : "article";
    const playerDataAttribute = options.dataAttribute || "data-player-id";
    const attributes = options.button
      ? `type="button" ${playerDataAttribute}="${escapeHtml(player.playerId)}"`
      : "";
    return `
      <${tag} class="player-card player-card-large pull-player-card pull-player-card--desktop pull-player-card--mobile ${pullSelection ? "pull-selection-card" : ""} ${escapeHtml(options.extraClass || "")} ${rarityClass(resolved.category)} ${options.selected ? "selected" : ""} ${options.equipment ? "has-equipment" : ""}" ${attributes}>
        <span class="player-corner player-role" aria-label="Ruolo ${escapeHtml(player.position)}">${escapeHtml(player.position)}</span>
        <span class="player-corner player-overall" aria-label="Overall ${resolved.overall}">${resolved.overall}</span>
        <div class="player-portrait-wrap">
          <img class="player-portrait" src="${escapeHtml(playerPortraitUrl(player))}" alt="${escapeHtml(player.name)}" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} />
        </div>
        <div class="player-info">
          <div class="player-title">
            <strong>${escapeHtml(player.name)}</strong>
          </div>
          <div class="player-meta" aria-label="Dettagli giocatore">
            ${pullSelection ? `<span class="pull-player-role">${escapeHtml(player.position)}</span>` : `<span>${escapeHtml(player.element || player.type)}</span>`}
            <span>${escapeHtml(resolved.category)}</span>
            ${pullSelection ? `<span>Lv ${escapeHtml(level)}</span>` : ""}
          </div>
        </div>
        ${options.equipment ? `<span class="player-corner player-equipment" aria-label="Oggetto equipaggiato">${itemIcon(options.equipment)}</span>` : ""}
        <span class="player-corner player-level" aria-label="Livello ${escapeHtml(level)}">Lv ${escapeHtml(level)}</span>
      </${tag}>`;
  }

  function permanentRosterFields(player) {
    return global.DevelopmentRuntime.rosterEntryPermanentFields(run, player);
  }

  function teamLogoMarkup(teamIdentity) {
    if (teamIdentity?.logoUrl) return `<img src="${escapeHtml(teamIdentity.logoUrl)}" alt="${escapeHtml(teamIdentity.name)}" loading="lazy" />`;
    if (teamIdentity?.logo === "inazuma-lightning") return inazumaLogoMarkup("inazuma-logo--small");
    return `<span class="team-logo-placeholder" aria-hidden="true">⚽</span>`;
  }

  function playerTeamIdentity(player, playerId) {
    const entry = playerId && Array.isArray(run?.roster) ? rosterEntry(playerId) : null;
    const ids = [entry?.teamId, player.teamId, ...(player.teamIds || [])].filter(Boolean);
    let team = ids.map((id) => seasonTeamsById.get(String(id))).find(Boolean);
    let teamName = team?.teamName || entry?.teamName || player.teamName || (player.teams || []).find((name) => name && name !== "Unaffiliated") || (player.teamId === "unaffiliated" ? "Svincolato" : "");
    if (!team && teamName) team = (seasonDb?.teams || []).find((candidate) => candidate.teamName === teamName);
    if (!teamName) teamName = "Svincolato";
    return { name: teamName === "Unaffiliated" ? "Svincolato" : teamName, logoUrl: team?.logoUrl || "", logo: team?.logo || "" };
  }

  function historicalTeamIdentity(player, team, sourceFallback) {
    const ids = [player.teamId, player.originTeamId, sourceFallback.teamId, ...(sourceFallback.teamIds || [])].filter(Boolean);
    const dbTeam = ids.map((id) => seasonTeamsById.get(String(id))).find(Boolean);
    const name = player.teamName || player.originTeamName || player.recruitmentTeamName || sourceFallback.teamName || dbTeam?.teamName || (team?.teamName ? `Rosa campione: ${team.teamName}` : "Svincolato");
    return { name: name === "Unaffiliated" ? "Svincolato" : name, logoUrl: player.teamLogoUrl || player.logoUrl || dbTeam?.logoUrl || "", logo: player.teamLogo || player.logo || "" };
  }

  function playerDetailMarkup(...args) { return playerView.detailMarkup(...args); }
  const playerDetailController = global.PlayerDetailController.create({
    view: playerView, openModal, closeModal, toast, getModalRoot: () => modalRoot,
    getFreeAgentsDb: () => freeAgentsDb, getRosterEntry: rosterEntry, resolveRosterPlayer: resolvedRosterPlayer,
    databaseForEntry: (entry) => global.SeasonRegistry?.isSeasonSource?.(entry.source) ? (global.SeasonRegistry.database(entry.source) || seasonDb) : freeAgentsDb,
    unequipPlayerItem: (...args) => unequipPlayerItem(...args), renderSquad: (...args) => renderSquad(...args),
  });
  function showPlayerDetailsFor(...args) { return playerDetailController.showFor(...args); }
  function showPlayerDetails(...args) { return playerDetailController.showRosterPlayer(...args); }


  function recoverCanonicalRun() {
    let canonical = null;
    try { canonical = global.RunState.load(run?.seasonId, { readOnly: true }); } catch (_) { return null; }
    if (!canonical) return null;
    run = canonical; global.run = canonical;
    ui.match = canonical.activeMatch || null; ui.pendingReward = canonical.pendingReward || null;
    return canonical;
  }

  // LEGACY ONE-WAY RUN → ALBUM BACKFILL BRIDGE: read-only input; Album never persists a run.
  function prepareAlbumLegacyContext() {
    run = global.RunState.load();
    ensureRunSchema();
    return run;
  }
  const albumView = global.AlbumView.create({ escapeHtml, sectionRootButton, playerCard });
  const albumController = global.AlbumController.create({
    view: albumView, app, getUi: () => ui, getRun: () => run, prepareAlbumLegacyContext,
    getSeasonDb: () => seasonDb, getFreeAgentsDb: () => freeAgentsDb, getSeasonPlayersById: () => seasonPlayersById, getActiveSeason: () => activeSeason,
    loadSeason, isProfileAwareSeason, closeModal, resetRenderedViewScroll, bindSectionRootNav,
    showPlayerDetailsFor, scrollSnapshot,
  });
  const championSnapshotRuntime = global.ChampionSnapshotRuntime.create({
    getRun: () => run,
    getSeasonDb: () => seasonDb,
    sourcePlayer: (...args) => sourcePlayer(...args),
    resolvedRosterPlayer: (...args) => resolvedRosterPlayer(...args),
    rosterEntry: (...args) => rosterEntry(...args),
    playerPortraitUrl: (...args) => playerPortraitUrl(...args),
    resolvePlayerVisual: (...args) => resolvePlayerVisual(...args),
    normalizeTeamIdentity: (...args) => normalizeTeamIdentity(...args),
  });
  const championPresentation = global.ChampionPresentation.create({
    getSeasonDb: () => seasonDb,
    escapeHtml: (...args) => escapeHtml(...args),
    formatDate: (...args) => formatDate(...args),
    compactPlayerCardMarkup: (...args) => compactPlayerCardMarkup(...args),
  });

  const hallView = global.HallView.create({ escapeHtml, sectionRootButton });
  const hallController = global.HallController.create({
    view: hallView, app, resetRenderedViewScroll, bindSectionRootNav, normalizedHallSeasonName, formatDate,
    tacticPanelMarkup, championFormationMarkup, championFiveVFiveMarkup, snapshotCard, statsMarkup, awardsMarkup,
    showPlayerDetailsFor, scrollSnapshot,
  });
  const developmentCenterView = global.DevelopmentCenterView.create({ escapeHtml, rarityClass, compactPlayerCardMarkup, itemImageFallbackSvg, playerPortraitUrl, imageFallbackAttributes, resolvePlayerVisual, sectionRootButton });
  const developmentCenterController = global.DevelopmentCenterController.create({
    view: developmentCenterView, app, modalRoot, getUi: () => ui, getFreeAgentsDb: () => freeAgentsDb, ensureAlbumBackfill: () => albumController.ensureBackfill(),
    albumPlayerView: (...args) => albumController.playerView(...args), openModal, closeModal, toast, renderHome, renderShop,
    showPlayerDetailsFor, scrollSnapshot, getStatLabels: () => STAT_LABELS, developmentDevMarkup, bindDevelopmentDev,
  });

  const gameOverView = global.GameOverView.create({ app: () => app, resetScroll: resetRenderedViewScroll, escapeHtml, currencyIcon: (...args) => developmentCurrencyIcon(...args) });
  const gameOverController = global.GameOverController.create({
    getRun: () => run, getSeasonDb: () => seasonDb, view: gameOverView,
    persistMutation: (options) => persistGameplayMutation(options), enqueueGameOverDevelopmentEffect,
    recoverCanonicalRun,
    averageOverall, startNewRun: startNewRunFromHome, renderHome,
  });
  const finalizationView = global.FinalizationView.create({
    app: () => app, resetScroll: resetRenderedViewScroll, escapeHtml,
    seasonName: normalizedHallSeasonName, formatDate, compactSeed,
    formationMarkup: championFormationMarkup, fiveMarkup: championFiveVFiveMarkup,
    snapshotCard, tacticMarkup: tacticPanelMarkup, statsMarkup, awardsMarkup,
    bindTabs: bindFinalTabs, bindPlayerDetails: bindHallPlayerDetails,
    renderHallDetail: renderHallOfFameDetail, bindSectionRootNav, sectionRootButton,
    startNewRun: startNewRunFromHome,
  });
  const finalizationController = global.FinalizationController.create({
    getRun: () => run, view: finalizationView, toast,
    recoverCanonicalRun,
    resolveDevelopment: (options) => gameOverController.resolveDevelopmentEndRunFlow(options),
    championTeam, renderHome,
  });
  function drainPermanentEffects() { return gameOverController.drainPermanentEffects(); }
  function resolveDevelopmentEndRunFlow(options) { return gameOverController.resolveDevelopmentEndRunFlow(options); }
  function renderGameOver(options) { return gameOverController.renderGameOver(options); }
  function resumeRunFinalization(options) { return finalizationController.resume(options); }
  function renderFinalizationPending(result) { return finalizationController.renderPending(result); }
  function renderFinalCelebration(hallTeamId, options) { return finalizationController.renderCelebration(hallTeamId, options); }
  function renderFinalSummary(hallTeamId, options) { return finalizationController.renderSummary(hallTeamId, options); }

  function enqueueAlbumRecruit(current, playerId, source, actionId) {
    return global.PermanentEffects.enqueueAlbum(current, { playerId, source, actionId });
  }

  function unlockAlbumRecruit() {
    return drainPermanentEffects();
  }

  function renderAlbumCollections(...args) { return albumController.renderCollections(...args); }
  function renderAlbumTeams(...args) { return albumController.renderTeams(...args); }
  function renderAlbumRoster(...args) { return albumController.renderRoster(...args); }
  function bindAlbumRosterInteractions(...args) { return albumController.bindRosterInteractions(...args); }


  function inazumaLogoMarkup(className = "") {
    return `<span class="inazuma-logo ${className}" aria-label="Logo Inazuma" role="img">⚡</span>`;
  }

  function normalizeTeamIdentity(identity = {}) {
    return global.RunState.normalizeTeamIdentity(identity);
  }

  function loadTeamProfile() {
    return global.RunState.loadProfile();
  }

  function savedTeamIdentity() {
    return loadTeamProfile().teamIdentity;
  }

  function migrateTeamIdentityProfile() {
    const profileIdentity = savedTeamIdentity();
    if (profileIdentity) return profileIdentity;
    const legacyName = run ? global.RunState.validTeamName(run.teamIdentity?.name) : "";
    if (!legacyName) return null;
    if (!persistenceWritesAllowed()) return normalizeTeamIdentity({ name: legacyName, emblemId: "default-lightning" });
    const migrated = global.RunState.saveProfileTeamIdentity({ name: legacyName, emblemId: "default-lightning" });
    return migrated;
  }

  function validateTeamName(value) {
    const name = String(value || "").trim();
    if (!name) return { valid: false, message: "Inserisci il nome della squadra." };
    if (name.length < 2 || name.length > 24) return { valid: false, message: "Usa da 2 a 24 caratteri." };
    if (!/^[\p{L}0-9 '\-]+$/u.test(name)) return { valid: false, message: "Sono ammessi lettere, numeri, spazi, apostrofi e trattini." };
    return { valid: true, name };
  }

  function seasonDisplayName(seasonId, fallback = "") {
    return global.SeasonRegistry?.get?.(seasonId)?.name || fallback || "Season";
  }

  function normalizedHallSeasonName(team) {
    return seasonDisplayName(team?.seasonId || team?.modeId, team?.seasonName || team?.modeName || "Season");
  }

  function setRun(nextRun) { run = nextRun; global.run = nextRun; }

  const homeView = global.HomeView.create({ escapeHtml, normalizeTeamIdentity, savedTeamIdentity, seasonDisplayName, resolvedRosterPlayer, averageOverall, lifeHeartsMarkup, bossTeamLogoUrl, getSeasonDb: () => seasonDb });
  const homeController = global.HomeController.create({
    view: homeView, app, getRun: () => run, setRun, getSeasonDb: () => seasonDb, getActiveSeason: () => activeSeason,
    loadSeason, closeModal, persistenceWritesAllowed, drainPermanentEffects, ensureRunSchema, migrateTeamIdentityProfile, normalizeTeamIdentity, resetRenderedViewScroll,
    renderSeasonSelect: (...args) => renderSeasonSelect(...args), resumeRun: (...args) => resumeRun(...args), renderShop: (...args) => renderShop(...args),
    renderHallOfFame: (...args) => renderHallOfFame(...args), renderAlbumCollections: (...args) => renderAlbumCollections(...args),
    renderDevelopmentCenter: (...args) => renderDevelopmentCenter(...args), renderSettings: (...args) => renderSettings(...args),
  });
  const seasonSelectionView = global.SeasonSelectionView.create({ escapeHtml, sectionRootButton });
  const seasonSelectionController = global.SeasonSelectionController.create({
    view: seasonSelectionView, app, modalRoot, getRun: () => run, setRun, getSeasonDb: () => seasonDb, getActiveSeason: () => activeSeason,
    loadSeason, ensureRunSchema, drainPermanentEffects, afterNextPaint, restorePageScroll, resetRenderedViewScroll, bindSectionRootNav,
    startNewRun: (...args) => startNewRunFromHome(...args), resumeRun: (...args) => resumeRun(...args), scrollSnapshot, openModal, closeModal, escapeHtml,
  });
  const newRunController = global.NewRunController.create({ getRun: () => run, setRun, getActiveSeason: () => activeSeason, getSeasonDb: () => seasonDb, normalizeTeamIdentity, savedTeamIdentity, seasonDisplayName, openTeamNameModal: (...args) => openTeamNameModal(...args), openModal, closeModal, toast, renderFormationChoice: (...args) => renderFormationChoice(...args), escapeHtml, inazumaLogoMarkup });
  function renderHome(...args) { return homeController.renderHome(...args); }
  function renderSeasonSelect(...args) { return seasonSelectionController.renderSeasonSelect(...args); }
  function selectSeason(...args) { return seasonSelectionController.selectSeason(...args); }
  function startRunWithIdentity(...args) { return newRunController.startRunWithIdentity(...args); }
  function startNewRunFromHome(...args) { return newRunController.startNewRunFromHome(...args); }

  function renderDevelopmentCenter(...args) { return developmentCenterController.render(...args); }
  function developmentCurrencyIcon(...args) { return developmentCenterController.currencyIcon(...args); }
  function eligibleFreeAgentIds() { return developmentCenterController.eligibleFreeAgentIds(); }


  const shopView = global.ShopView.create({ escapeHtml, currencyIcon: (...args) => developmentCurrencyIcon(...args) });
  const shopController = global.ShopController.create({ app, view: shopView, devMode: DEV_MODE, renderHome: (...args) => renderHome(...args), toast });
  const settingsView = global.SettingsView.create({ escapeHtml });
  const settingsController = global.SettingsController.create({
    app,
    view: settingsView,
    normalizeTeamIdentity,
    savedTeamIdentity,
    openEditTeamNameModal: (...args) => openEditTeamNameModal(...args),
    renderHome: (...args) => renderHome(...args),
    renderShop: (...args) => renderShop(...args),
    toast,
  });

  function renderShop(...args) { return shopController.render(...args); }
  function renderSettings(...args) { return settingsController.render(...args); }

  function developmentDevMarkup(eligibleCount = developmentPlayers().length) { return `<section class="development-dev"><h2>SVILUPPO — HACK TEST</h2><p><strong>SVINCOLATI ELEGGIBILI: ${escapeHtml(eligibleCount)}</strong></p><div>${[100,500,1500].map(n=>`<button data-dev-coins="${n}">+${n} MONETE</button>`).join("")}${global.DevelopmentV2.SEASON_IDS.map(id=>`<button data-dev-season-cup="${id}">+1 COPPA ${id.toUpperCase()}</button>`).join("")}${global.DevelopmentV2.PROJECT_RARITIES.map(r=>`<button data-dev-complete-project="${r}">+1 PROGETTO ${r.toUpperCase()}</button>`).join("")}</div><button id="dev-unlock-free-agents">SBLOCCA TUTTI GLI SVINCOLATI</button><button id="dev-reset">RESET SVILUPPO TEST</button></section>`; }
  function bindDevelopmentDev() {
    document.querySelectorAll("[data-dev-coins]").forEach(b=>b.onclick=()=>{global.DevelopmentAccountV3.mutate(s=>{s.coins+=Number(b.dataset.devCoins);});renderDevelopmentCenter();});
    document.querySelectorAll("[data-dev-season-cup]").forEach(b=>b.onclick=()=>{const id=b.dataset.devSeasonCup;global.DevelopmentAccountV3.mutate(s=>{s.cupsBySeason[id]=(s.cupsBySeason[id]||0)+1;});renderDevelopmentCenter();});
    document.querySelectorAll("[data-dev-complete-project]").forEach(b=>b.onclick=()=>{global.DevelopmentAccountV3.addCompletedProject(b.dataset.devCompleteProject);renderDevelopmentCenter("projects");});
    document.getElementById("dev-unlock-free-agents")?.addEventListener("click",()=>{const ids=[...eligibleFreeAgentIds()];global.AlbumProgress.unlockAlbumPlayers(global.AlbumProgress.DEFAULT_COLLECTION_ID,ids,{source:"development-dev-unlock"});developmentCenterController.invalidate();toast(`${ids.length} svincolati disponibili.`);renderDevelopmentCenter("players");});
    document.getElementById("dev-reset")?.addEventListener("click",()=>{if(confirm("Azzerare solo lo sviluppo?")){global.DevelopmentAccountV3.reset();renderDevelopmentCenter();}});
  }


  function savedTeamSummaryMarkup() {
    const identity = savedTeamIdentity();
    if (!identity) return "";
    return `
      <section class="home-save-card" aria-label="Profilo squadra">
        <div class="home-save-logo">${inazumaLogoMarkup("inazuma-logo--small")}</div>
        <div>
          <p class="eyebrow">Squadra</p>
          <h2>${escapeHtml(identity.name)}</h2>
          <p class="muted">Nome salvato sul profilo locale.</p>
        </div>
      </section>`;
  }

  function openTeamNameModal({ mode = "create" } = {}) {
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">${mode === "edit" ? "Home" : "Nuova run"}</p><h2>${mode === "edit" ? "Modifica nome squadra" : "Nome della squadra"}</h2><p class="muted">${mode === "edit" ? "Aggiorna il nome permanente della tua squadra." : "Scegli il nome che rappresenterà la tua squadra."}</p></div>${inazumaLogoMarkup("inazuma-logo--modal")}</div>
      ${mode !== "edit" && run ? '<p class="home-overwrite-warning">Confermando sostituirai la run salvata.</p>' : ""}
      <label class="team-name-field" for="team-name-input">Nome squadra</label>
      <div class="team-name-input-shell"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3.5 7.2v5.5c0 4.4 3.6 7 8.5 8.3 4.9-1.3 8.5-3.9 8.5-8.3V7.2L12 3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg><input class="team-name-input" id="team-name-input" type="text" placeholder="La mia squadra" maxlength="24" autocomplete="off" inputmode="text" enterkeyhint="done" value="${escapeHtml(savedTeamIdentity()?.name || "")}" /></div>
      <p class="team-name-error" id="team-name-error" aria-live="polite"></p>
      <div class="button-row"><button type="button" class="btn btn-yellow" id="confirm-team-name">Conferma</button><button type="button" class="btn btn-ghost" id="cancel-team-name">Indietro</button></div>`,
      { closeable: false, className: "team-name-modal" }
    );
    const input = document.getElementById("team-name-input");
    const error = document.getElementById("team-name-error");
    if (window.matchMedia?.("(pointer: fine)").matches) input.focus({ preventScroll: true });
    const confirm = () => {
      const result = validateTeamName(input.value);
      if (!result.valid) { error.textContent = result.message; return; }
      if (mode === "edit") {
        const before = run ? JSON.stringify({ roster: run.roster, lineup: run.lineup, bench: run.bench, bossIndex: run.bossIndex, currentZone: run.currentZone }) : null;
        global.RunState.saveProfileTeamIdentity({ name: result.name, emblemId: savedTeamIdentity()?.emblemId || "default-lightning" });
        if (before && before !== JSON.stringify({ roster: run.roster, lineup: run.lineup, bench: run.bench, bossIndex: run.bossIndex, currentZone: run.currentZone })) throw new Error("Team name edit changed run progress");
        closeModal();
        renderSettings();
        return;
      }
      startRunWithIdentity({ name: result.name, logo: "inazuma-lightning" });
    };
    document.getElementById("confirm-team-name").addEventListener("click", confirm);
    document.getElementById("cancel-team-name").addEventListener("click", closeModal);
    input.addEventListener("input", () => { error.textContent = ""; });
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") confirm(); });
  }

  function openEditTeamNameModal() {
    openTeamNameModal({ mode: "edit" });
  }

  let runResumeController = null;
  function resumeRun(...args) {
    runResumeController ||= global.RunResumeController.create({
      getRun: () => run, getActiveSeason: () => activeSeason, getSeasonDb: () => seasonDb, selectSeason, renderHome, resumeFinalization: resumeRunFinalization,
      persistGameplayMutation, renderMapFailureRecovery, recoverInterruptedMatchAccess, renderGameOver, renderFormationChoice, renderDraft, showSpecialMatchReward,
      resumePostBossFlow, renderFinalSummary, renderFinalCelebration, renderSquad, renderFiveVFive, renderInventory,
      setMatchUi: (match) => { ui.match = match; ui.bossMatchState = match.state || "pre-match"; ui.bossMatchLog = match.log || []; },
      renderMatch, ensureCurrentZone, resumePendingItemReward, renderMap,
    });
    return runResumeController.resumeRun(...args);
  }

  const initialDraftView = global.InitialDraftView.create({ escapeHtml, topbar, playerCard });
  const initialDraftController = global.InitialDraftController.create({
    view: initialDraftView, app, getRun: () => run, getSeasonDb: () => seasonDb,
    getFreeAgentsDb: () => freeAgentsDb,
    isProfileAwareSeason, formationById, persistGameplayMutation,
    resetRenderedViewScroll, bindSectionRootNav, renderHome, renderSquad,
    ensureFiveVFive, reconcileSquadRosterState, sourcePlayer,
    enqueueAlbumRecruit, unlockAlbumRecruit,
  });
  function initialDraftPlayers(...args) { return initialDraftController.players(...args); }
  function renderFormationChoice(...args) { return initialDraftController.renderFormationChoice(...args); }
  function renderDraft(...args) { return initialDraftController.renderDraft(...args); }

  const fiveMatchPresentation = global.FiveMatchPresentationRuntime.create({
    getRun: () => run,
    getUi: () => ui,
    getFreeAgentsDb: () => freeAgentsDb,
    getFreeAgentsById: () => freeAgentsById,
    ensureFiveVFive: (...args) => ensureFiveVFive(...args),
    resolvedRosterPlayer: (...args) => resolvedRosterPlayer(...args),
    escapeHtml: (...args) => escapeHtml(...args),
    playerPortraitUrl: (...args) => playerPortraitUrl(...args),
    rarityClass: (...args) => rarityClass(...args),
    imageFallbackAttributes: (...args) => imageFallbackAttributes(...args),
    resolvePlayerVisual: (...args) => resolvePlayerVisual(...args),
    scrollSnapshot: (...args) => scrollSnapshot(...args),
    renderFivePlayerPicker: (...args) => renderFivePlayerPicker(...args),
    restorePageScroll: (...args) => restorePageScroll(...args),
    commitFiveEditorMutation: (...args) => commitFiveEditorMutation(...args),
    fiveRoleForPlayerId: (...args) => fiveRoleForPlayerId(...args),
    renderMatch: (...args) => renderMatch(...args),
    afterNextPaint: (...args) => afterNextPaint(...args),
    cssEscape: (...args) => cssEscape(...args),
  });

  const matchEngine = global.MatchControllerRuntime.create({
    getRun: () => run, getSeasonDb: () => seasonDb, ui, app,
    persistGameplayMutation: (...a) => persistGameplayMutation(...a), recordGameplayFailure: (...a) => recordGameplayFailure(...a),
    fiveUserPlayersBySlot: (...a) => fiveUserPlayersBySlot(...a), fiveOpponentPlayersBySlot: (...a) => fiveOpponentPlayersBySlot(...a),
    normalizeTeamIdentity: (...a) => normalizeTeamIdentity(...a), specialMatchView: { opponentMeta: (...a) => global.SpecialMatchViewRuntime.create({ getSeasonDb: () => seasonDb, runtime: global.SpecialMatchRuntime }).opponentMeta(...a) },
    bossMatchTeamMeta: (...a) => bossMatchTeamMeta(...a), userTeamPlayers: (...a) => userTeamPlayers(...a), bossTeamPlayers: (...a) => bossTeamPlayers(...a),
    toast: (...a) => toast(...a), bossMatchStatusText: (...a) => bossMatchStatusText(...a), bossMatchTimeline: (...a) => bossMatchTimeline(...a),
    openModal: (...a) => openModal(...a), scrollSnapshot: (...a) => scrollSnapshot(...a), formatMatchProbability: (...a) => formatMatchProbability(...a),
    createOrLoadFiveMatch: (...a) => createOrLoadFiveMatch(...a), ensureFiveVFive: (...a) => ensureFiveVFive(...a), teamById: (...a) => teamById(...a),
    escapeHtml: (...a) => escapeHtml(...a), bossMatchAverage: (...a) => bossMatchAverage(...a), fiveMatchField: (...a) => fiveMatchField(...a),
    fiveMatchComparisonMarkup: (...a) => fiveMatchComparisonMarkup(...a), topbar: (...a) => topbar(...a),
    resetRenderedViewScroll: (...a) => resetRenderedViewScroll(...a), bindSectionRootNav: (...a) => bindSectionRootNav(...a), bindBottomNav: (...a) => bindBottomNav(...a),
    showPlayerDetails: (...a) => showPlayerDetails(...a), showPlayerDetailsFor: (...a) => showPlayerDetailsFor(...a), bossMatchField: (...a) => bossMatchField(...a),
    switchBossMatchTab: (...a) => switchBossMatchTab(...a), completeFiveMatch: (...a) => completeFiveMatch(...a),
    completeSpecialMatch: (...a) => completeSpecialMatch(...a), completeBossMatch: (...a) => completeBossMatch(...a),
    recoverLegacyResolvedMatchRoutingIfNeeded: (...a) => recoverLegacyResolvedMatchRoutingIfNeeded(...a), closeModal: (...a) => closeModal(...a),
    resolvePendingRunFlow: (...a) => resolvePendingRunFlow(...a), navigateBossVictoryDestination: (...a) => navigateBossVictoryDestination(...a),
    showSpecialMatchReward: (...a) => showSpecialMatchReward(...a), renderGameOver: (...a) => renderGameOver(...a), renderMap: (...a) => renderMap(...a), hearts: (...a) => hearts(...a),
    openFiveMatchPlayerSwap: (...a) => openFiveMatchPlayerSwap(...a), fiveMatchPlayerDetail: (...a) => fiveMatchPlayerDetail(...a),
    renderFiveVFive: (...a) => renderFiveVFive(...a), renderMapFailureRecovery: (...a) => renderMapFailureRecovery(...a), getFreeAgentsDb: () => freeAgentsDb,
    testMatchControlsEnabled: TEST_MATCH_CONTROLS_ENABLED, devMode: DEV_MODE,
  });

  const squadController = global.SquadControllerRuntime.create({
    getRun: () => run, formations: () => seasonDb?.formations?.eleven || [],
    getRole: (id, current) => effectiveRosterRole(id, current), resolveEntry: rosterEntry,
    resolveSource: sourcePlayer, persistMutation: persistGameplayMutation, rosterInvariants: global.RosterInvariants,
  });
  const squadView = global.SquadViewRuntime.create({
    getRun: () => run, getUi: () => ui, controller: squadController, getSeasonDb: () => seasonDb,
    seasonFormations: () => seasonDb?.formations?.eleven || [], formationById,
    effectiveRosterRole, rosterEntry, sourcePlayer, resolvedRosterPlayer, compactPlayerCardMarkup,
    escapeHtml, tacticSummary, tacticLabels: { attack: "Attacco", control: "Controllo", defense: "Difesa", save: "Parata", speed: "Velocità", physical: "Fisico", stamina: "Resistenza" }, formationLayout: global.FormationLayout,
    openModal, closeModal, modalRoot, scrollSnapshot, toast, runKeepingScroll, app, topbar, bottomNav,
    resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, showPlayerDetails, resumePostBossFlowOrMap,
    profiledSeasonRuntime: global.ProfiledSeasonRuntime, persistGameplayMutation, fiveVFive: global.FiveVFive, cssEscape,
  });
  function reconcileSquadRosterState(current = run) { return squadController.reconcileRosterState(current); }
  function lineupRows() {
    const formation = formationById(run.formationId) || formationById("4-3-3");
    const idsByRole = new Map(["FW", "MF", "DF", "GK"].map((role) => [role, run.lineup.filter((id) => effectiveRosterRole(id) === role)]));
    return global.FormationLayout.displayRows(formation).map((row) => ({ ...row, ids: idsByRole.get(row.role).splice(0, row.count) }));
  }
  function tacticalMiniPlayer(id, options) { return squadView.tacticalPlayer(id, options); }
  function squadPitchMarkup(options) { return squadView.pitchMarkup(options); }
  function benchMarkup(options) { return squadView.benchMarkup(options); }
  function renderSquad() { return squadView.render(); }


  function recoverInterruptedSpecialMatchAccess() { return specialMatchController.recoverAccess(); }

  const bossFlowController = global.BossFlowControllerRuntime.create({
    getRun: () => run, getSeasonDb: () => seasonDb,
    matchTransactionIdentity, commitMatchMutation, persistGameplayMutation,
    canonicalMatchFor,
    mountCommittedMatch: (match) => { ui.match = match; ui.bossMatchState = match?.state || "pre-match"; ui.bossMatchLog = match?.log || []; },
    mountBossResultMatch: (match) => { ui.match = match; ui.bossMatchState = match?.state || "completed-victory"; ui.bossMatchLog = match?.log || ui.bossMatchLog || []; },
    resolutionDependencies: (current) => ({
      applyStatistics: (match, result) => applyRealMatchStatistics(match, result, current),
      addLevels: (amount, actionId, units) => addLevels(amount, actionId, units, current),
      completeNode: (zone, nodeId) => global.MapEngine.completeNode(zone, nodeId),
      restoreAfterLoss: (...args) => global.RunState.restoreAfterLoss(...args),
      lossToast: (resolved) => resolved.gameOver ? "Hai perso l'ultima vita. La run è terminata." : `Sconfitta: ${remainingLivesText(resolved.lives)}. Torni al nodo precedente.`,
      appendFinalMessage: (result, type) => appendFinalMatchMessage(result, type, current.activeMatch),
    }),
    enqueueGameOverDevelopmentEffect,
    resolutionCommitted: (match) => { ui.match = match; ui.bossMatchResolving = "done"; ui.bossMatchState = match.state; },
    resolutionRecovered: (match) => { ui.match = match; ui.bossMatchResolving = false; ui.bossMatchState = match?.state || "pre-match"; },
    stopMatchAfterPersistenceFailure,
    renderCommittedResolution: () => { updateMatchScoreDom(ui.match, true); syncCommittedFinalMatchLog(); updateMatchControlsDom(); },
    clearMountedMatch: () => { ui.match = null; ui.bossMatchResolving = false; },
    renderMatch, renderSeasonComplete, renderFinalizationPending, renderMap,
    renderFinalSummary: (hallTeamId) => renderFinalSummary(hallTeamId, { developmentResolved: true }),
    renderFinalCelebration: (hallTeamId) => renderFinalCelebration(hallTeamId, { developmentResolved: true }),
    isProfileAwareSeason, seasonPlayer: (id) => seasonPlayersById.get(String(id)), selectWeightedCandidates: (...args) => selectWeightedCandidates(...args),
    showPlayerOffer: (...args) => showPlayerOffer(...args), recruitPlayer: (...args) => recruitPlayer(...args),
    recordReroll: (current, flow, token) => global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.REROLL_USED, { nodeId: flow.matchNodeId, itemId: token.id, instanceId: token.instanceId, actionId: `${current.runId}:${flow.matchNodeId}:boss_reward_reroll:${flow.rewardNumber}:${flow.rerolls}` }),
    recordPick: (current, flow, player) => global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.BOSS_REWARD_CHOSEN, { nodeId: flow.matchNodeId, playerId: player.playerId, actionId: `${current.runId}:${flow.matchNodeId}:boss_reward:${flow.rewardNumber}:chosen` }),
    recordDecline: (current, flow) => global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.BOSS_REWARD_DECLINED, { nodeId: flow.matchNodeId, actionId: `${current.runId}:${flow.matchNodeId}:boss_reward:${flow.rewardNumber}:declined` }),
    ensureCurrentZoneMutation,
    buildFinalization: (current, boss) => { const snapshot = buildChampionSnapshot(boss); current.finalization = { status: "pending", archiveKey: snapshot.archiveKey, hallTeamId: snapshot.hallTeamId }; global.PermanentEffects.enqueueHall(current, snapshot); },
    handoffCommitted: () => { ui.pendingReward = null; ui.match = null; closeModal(); },
    failedHandoffDestination: (committed) => { const recovered = committed.run; const status = String(recovered?.finalization?.status || ""); const final = recovered?.phase === "finalization" || ["pending", "hall-written", "development-written"].includes(status); return { destination: final ? "finalization-pending" : "post-boss-recovery", error: committed.error, finalization: recovered?.finalization }; },
    finishFinalization: () => { const finalization = resumeRunFinalization({ render: false }); return finalization.completed ? { destination: "season-complete", finalization } : { destination: "finalization-pending", finalization }; },
    createPostBossCheckpoint: (current) => { try { global.RunState.createCheckpoint(current); } catch (error) { console.error("Post-boss checkpoint creation failed after canonical commit", error); toast("Progresso Boss salvato; il checkpoint di recupero verrà ricreato più tardi.", "warning"); } },
    renderRecoveryView: (retry) => { app.innerHTML = `<main class="hero-screen post-boss-recovery-screen" data-post-boss-recovery><section class="panel"><p class="eyebrow">PROGRESSO BOSS</p><h1>Ripresa ricompense</h1><p class="muted">Il progresso salvato non è stato modificato.</p><button type="button" class="btn btn-yellow" id="retry-post-boss-flow">RIPROVA / CONTINUA</button></section></main>`; resetRenderedViewScroll(); document.getElementById("retry-post-boss-flow")?.addEventListener("click", retry); },
  });

  function bossMatchFromNode(node, previousNodeId = null, activeRun = run) { return bossFlowController.matchFromNode(node, previousNodeId, activeRun); }
  function recoverInterruptedBossAccess() { return bossFlowController.recoverAccess(); }

  function weightedItemCandidates(random, count) {
    const pool = global.SEASON1_CONFIG.itemPool.slice();
    const result = [];
    while (result.length < count && pool.length) {
      let cursor = random() * pool.reduce((sum, item) => sum + Number(item.weight || 10), 0);
      let selectedIndex = 0;
      for (let index = 0; index < pool.length; index += 1) {
        cursor -= Number(pool[index].weight || 10);
        if (cursor <= 0) { selectedIndex = index; break; }
      }
      result.push(pool.splice(selectedIndex, 1)[0]);
    }
    return result;
  }

  function receiveItem(item, node, done, onCancel = () => resolveItemNode(node)) {
    const add = (discardInstanceId = null) => {
      if (run.pendingItemReward?.status === "claimed") return done(resolveItem(run.pendingItemReward.claimedItemId));
      let instance;
      return persistGameplayMutation({ label: "item-reward-claim", mutate: (current) => {
        const pending = current.pendingItemReward; if (!pending || pending.status !== "offered") throw new Error("Item reward state changed");
        const currentNode = activeItemRewardNodeById(current, node.id);
        if (!currentNode || String(pending.nodeId) !== String(currentNode.id) || !pending.candidateIds?.includes(item.id)) throw new Error("Item reward state changed");
        if (discardInstanceId) { const index = current.inventory.findIndex((entry) => String(entry.instanceId) === String(discardInstanceId)); if (index < 0) throw new Error("Discard unavailable"); current.inventory.splice(index, 1); }
        instance = makeItemInstance(item, node.id); current.inventory.push(instance);
        global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.ITEM_OBTAINED, { nodeId: node.id, itemId: item.id, actionId: `${current.runId}:${node.id}:item_obtained` });
        pending.status = "claimed"; pending.claimedItemId = inventoryItemIdentity(instance); pending.claimedInstanceId = instance.instanceId;
        if (!current.currentZone.completedNodeIds.includes(currentNode.id)) { global.MapEngine.completeNode(current.currentZone, currentNode.id); global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.NODE_COMPLETED, { nodeId: currentNode.id, nodeType: currentNode.type, actionId: `${current.runId}:${currentNode.id}:node_completed` }); }
        current.phase = "map";
      }, onCommitted: () => done(instance), rerender: ({ ok }) => { if (!ok) { ui.itemRewardSubmitting = false; recoverCanonicalItemReward(node.id); } } });
    };
    if (run.inventory.length < global.SEASON1_CONFIG.maxInventory) return add();
    chooseInventoryDiscardSelection("Inventario pieno: scegli un oggetto da eliminare", add, onCancel);
  }

  function chooseInventoryDiscardSelection(title, onSelect, onCancel) {
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Inventario ${run.inventory.length}/${global.SEASON1_CONFIG.maxInventory}</p><h2>${escapeHtml(title)}</h2></div></div>
      <div class="item-grid">${run.inventory.map((item) => { const resolved = resolveItem(item); return `<button type="button" class="item-card danger-card" data-discard-item="${item.instanceId}">${itemIcon(resolved)}<strong>${escapeHtml(resolved.name)}</strong><p>${escapeHtml(resolved.description)}</p></button>`; }).join("")}</div>
      <div class="button-row" style="margin-top:18px"><button type="button" class="btn" id="cancel-discard">Annulla</button></div>`, { closeable: false });
    modalRoot.querySelectorAll("[data-discard-item]").forEach((button) => button.addEventListener("click", () => onSelect(button.dataset.discardItem)));
    document.getElementById("cancel-discard").addEventListener("click", onCancel);
  }

  function chooseInventoryDiscard(title, onDiscard, onCancel) {
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Inventario ${run.inventory.length}/${global.SEASON1_CONFIG.maxInventory}</p><h2>${escapeHtml(title)}</h2></div></div>
      <div class="item-grid">${run.inventory.map((item) => { const resolved = resolveItem(item); return `<button type="button" class="item-card danger-card" data-discard-item="${item.instanceId}">${itemIcon(resolved)}<strong>${escapeHtml(resolved.name)}</strong><p>${escapeHtml(resolved.description)}</p></button>`; }).join("")}</div>
      <div class="button-row" style="margin-top:18px"><button type="button" class="btn" id="cancel-discard">Annulla</button></div>`,
      { closeable: false }
    );
    modalRoot.querySelectorAll("[data-discard-item]").forEach((button) => {
      button.addEventListener("click", () => {
        removeInventoryItem(button.dataset.discardItem);
        onDiscard();
      });
    });
    document.getElementById("cancel-discard").addEventListener("click", onCancel);
  }

  const recruitmentView = global.RecruitmentViewRuntime.create({
    getRun: () => run, getSeasonDb: () => seasonDb, getFreeAgentsDb: () => freeAgentsDb, resolvedRosterPlayer, playerCard, openModal, getModalRoot: () => modalRoot, closeModal, escapeHtml, seasonRegistry: global.SeasonRegistry,
  });
  const recruitmentRuntime = global.RecruitmentControllerRuntime.create({
    getRun: () => run, isProfileAwareSeason, persistGameplayMutation, rosterInvariants: global.RosterInvariants, playerIdentity: global.PlayerIdentity, getProfiledSeasonRuntime: () => global.ProfiledSeasonRuntime, getMaxRoster: () => global.SEASON1_CONFIG.maxRoster, getMaxInventory: () => global.SEASON1_CONFIG.maxInventory, permanentRosterFields, resolvedRosterPlayer, rosterEntry, optimizeLineupsForNewPlayer, fiveVFive: global.FiveVFive, runStatistics: global.RunStatistics, enqueueAlbumRecruit, unlockAlbumRecruit, closeModal, toast, chooseInventoryDiscardSelection, renderMapFailureRecovery, recruitmentView,
  });
  const { recruitPlayer } = recruitmentRuntime;

  const specialMatchView = global.SpecialMatchViewRuntime.create({
    getSeasonDb: () => seasonDb, runtime: global.SpecialMatchRuntime,
  });
  const specialMatchController = global.SpecialMatchControllerRuntime.create({
    getRun: () => run, getSeasonDb: () => seasonDb, persistMutation: persistGameplayMutation,
    commitMatch: commitMatchMutation, matchIdentity: matchTransactionIdentity,
    mountMatch: (match) => { ui.match = match; ui.bossMatchState = match?.state || "pre-match"; ui.bossMatchLog = match?.log || []; },
    applyConsecutiveLoss: applyConsecutiveLossResult, applyStatistics: applyRealMatchStatistics,
    completeNode: (zone, nodeId) => global.MapEngine.completeNode(zone, nodeId),
    restoreAfterLoss: (...args) => global.RunState.restoreAfterLoss(...args), enqueueGameOver: enqueueGameOverDevelopmentEffect,
    appendFinalMessage: appendFinalMatchMessage,
    onResolutionCommitted: () => { ui.bossMatchResolving = "done"; }, stopAfterPersistenceFailure: stopMatchAfterPersistenceFailure,
    renderCommittedResult: () => { updateMatchScoreDom(ui.match, true); syncCommittedFinalMatchLog(); updateMatchControlsDom(); },
  });
  const specialMatchRewardView = global.SpecialMatchRewardViewRuntime.create({
    getRun: () => run, getSeasonDb: () => seasonDb, getProfiles: () => global.ProfiledSeasonRuntime,
    specialById: (id) => specialMatchController.byId(id), openModal, getModalRoot: () => modalRoot, playerCard,
  });
  const specialMatchRewardController = global.SpecialMatchRewardControllerRuntime.create({
    getRun: () => run, getSeasonDb: () => seasonDb, getDocument: () => document, getModalRoot: () => modalRoot,
    persistMutation: persistGameplayMutation, recruitPlayer, seasonSource: (id) => global.SeasonRegistry.sourceForSeason(id),
    closeModal, toast, renderMap, view: specialMatchRewardView,
  });

  const pullPoolRuntime = global.PullPoolRuntime.create({
    getRun: () => run, getSeasonDb: () => seasonDb, getFreeAgentsDb: () => freeAgentsDb, isProfileAwareSeason,
  });
  const { previousBossLevel, pullPool, canonicalCandidatePlayerId, isSeasonProfileCandidate, pullCandidateKey, isPullCandidateEligible, selectWeightedCandidates } = pullPoolRuntime;
  const pullViewRuntime = global.PullViewRuntime.create({
    getRun: () => run, getSeasonDb: () => seasonDb, getFreeAgentsDb: () => freeAgentsDb, escapeHtml, resolveItem, itemIcon, openModal, getModalRoot: () => modalRoot, rarityClass, playerCard, showPlayerDetailsFor, scrollSnapshot, afterNextPaint, restoreScroll, cssEscape, toast, closeModal, renderMap,
  });
  const { showPlayerOffer } = pullViewRuntime;
  const pullItemsRuntime = global.PullItemsRuntime.create({
    getRun: () => run, getSeasonDb: () => seasonDb, isProfileAwareSeason, pullPool, canonicalCandidatePlayerId, pullCandidateKey, isPullCandidateEligible, toast, persistGameplayMutation, activePullNodeById, rerenderCanonicalPull, renderMapFailureRecovery,
  });
  const { useLuckyCharmOnPull, useScoutTokenOnPull } = pullItemsRuntime;
  const pullControllerRuntime = global.PullControllerRuntime.create({
    getRun: () => run, getUi: () => ui, pullPool, luckyCharmPoolForPull: pullItemsRuntime.luckyCharmPoolForPull, pullCandidateKey, previousBossLevel, useScoutTokenOnPull, useLuckyCharmOnPull, pendingPullNodeById, persistGameplayMutation, renderMapFailureRecovery, renderMap, canonicalNodeById, showPlayerOffer, toast, closeModal, finishNonMatchNode, recruitPlayer, completePullNodeMutation, rerenderCanonicalPull, isDevMode: () => DEV_MODE,
  });
  const { openPull, openDevLegendaryPull } = pullControllerRuntime;


  let runMapController;
  const tradeNodeController = global.TradeNodeControllerRuntime.create({
    getRun: () => run, getUi: () => ui, getSeasonDb: () => seasonDb, getFreeAgentsDb: () => freeAgentsDb, modalRoot, escapeHtml,
    playerPortraitUrl, imageFallbackAttributes, resolvePlayerVisual, resolvedRosterPlayer, runKeepingScroll,
    openModal, scrollSnapshot, squadPitchMarkup, benchMarkup, closeModal, compactPlayerCardMarkup,
    finishNonMatchNode: (...args) => finishNonMatchNode(...args), isProfileAwareSeason, permanentRosterFields,
    persistGameplayMutation, enqueueAlbumRecruit, unlockAlbumRecruit, toast, showPlayerDetails,
    chooseInventoryDiscardSelection, chooseInventoryDiscard, cssEscape, rosterEntry, optimizeLineupsForNewPlayer,
  });
  const nodeRouter = global.MapNodeRouterRuntime.create({
    enterMatch: (node, eventType, context) => runMapController.enterMatchFromNode(node.id, context.previousNodeId, { alreadySelected: true, matchType: eventType }),
    openPull: (...args) => openPull(...args),
    openItem: (node) => runMapController.resolveItemNode(node),
    openTrade: (node) => tradeNodeController.resolveTradeNode(node),
  });
  runMapController = global.RunMapControllerRuntime.create({
    getRun: () => run, getUi: () => ui, getSeasonDb: () => seasonDb, app, modalRoot, DEV_MODE, topbar, bottomNav, escapeHtml,
    teamById, resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, openBossPreviewModal,
    openDevLegendaryPull, toast, resolvePendingRunFlow, navigateBossVictoryDestination,
    renderPostBossRecovery, renderSeasonComplete, resumeRun, persistGameplayMutation,
    matchTransactionIdentity, commitMatchMutation, recoverInterruptedSpecialMatchAccess,
    recoverInterruptedBossAccess, ensureFiveVFive, fiveRoleForPlayerId, createOrLoadFiveMatch,
    specialMatchController, bossMatchFromNode, renderFiveVFive, renderMatch, openPull,
    resolveTradeNode: (...args) => tradeNodeController.resolveTradeNode(...args), closeModal, itemDefinitionById,
    weightedItemCandidates, inventoryItemIdentity, groupedOwnedInventoryItems, itemStatLabel, itemIcon,
    openModal, cssEscape, receiveItem, nodeRouter,
  });

  function ensureCurrentZone(...args) { return runMapController.ensureCurrentZone(...args); }
  function ensureCurrentZoneMutation(...args) { return runMapController.ensureCurrentZoneMutation(...args); }
  function activeMatchNeedsPhaseRecovery(...args) { return runMapController.activeMatchNeedsPhaseRecovery(...args); }
  function recoverInterruptedMatchAccess(...args) { return runMapController.recoverInterruptedMatchAccess(...args); }
  function renderMap(...args) { return runMapController.renderMap(...args); }
  function renderMapFailureRecovery(...args) { return runMapController.renderMapFailureRecovery(...args); }
  function bossTeamLogoUrl(...args) { return runMapController.bossTeamLogoUrl(...args); }
  function bossNodeIconMarkup(...args) { return runMapController.bossNodeIconMarkup(...args); }
  function canonicalNodeById(...args) { return runMapController.canonicalNodeById(...args); }
  function pendingPullNodeById(...args) { return runMapController.pendingPullNodeById(...args); }
  function activePullNodeById(...args) { return runMapController.activePullNodeById(...args); }
  function activeItemRewardNodeById(...args) { return runMapController.activeItemRewardNodeById(...args); }
  function canonicalActivePullNodeById(...args) { return runMapController.canonicalActivePullNodeById(...args); }
  function rerenderCanonicalPull(...args) { return runMapController.rerenderCanonicalPull(...args); }
  function enterMatchFromNode(...args) { return runMapController.enterMatchFromNode(...args); }
  function enterNode(...args) { return runMapController.enterNode(...args); }
  function dispatchNode(...args) { return runMapController.dispatchNode(...args); }
  function finishNonMatchNode(...args) { return runMapController.finishNonMatchNode(...args); }
  function completePullNodeMutation(...args) { return runMapController.completePullNodeMutation(...args); }
  function resumePendingItemReward(...args) { return runMapController.resumePendingItemReward(...args); }
  function ensurePendingItemReward(...args) { return runMapController.ensurePendingItemReward(...args); }
  function resolveItemNode(...args) { return runMapController.resolveItemNode(...args); }
  function renderItemRewardResult(...args) { return runMapController.renderItemRewardResult(...args); }
  function recoverCanonicalItemReward(...args) { return runMapController.recoverCanonicalItemReward(...args); }
  function resolveTradeNode(...args) { return tradeNodeController.resolveTradeNode(...args); }

  function openBossPreviewModal(boss) {
    const bossPlayers = bossTeamPlayers(boss);
    const meta = bossMatchTeamMeta(boss).boss;
    const average = bossMatchAverage(bossPlayers);
    openModal(`
      <div class="modal-head route-boss-preview-head">
        <div>
          <p class="eyebrow">Prossima sfida</p>
          <h2>${escapeHtml(meta.name)}</h2>
          <p class="muted">${escapeHtml(meta.formation)} · Boss ${run.bossIndex + 1}/${seasonDb.bossOrder.length}${average ? ` · OVR ${escapeHtml(average)}` : ""}</p>
        </div>
        <span class="boss-match-logo route-boss-preview-logo">${bossNodeIconMarkup(boss)}</span>
      </div>
      <section class="route-boss-preview-field" aria-label="Formazione boss ${escapeHtml(meta.name)}">
        ${bossMatchField({ players: bossPlayers, formationId: boss.bossFormation }, "boss", true)}
      </section>
      <div class="button-row route-boss-preview-actions">
        <button type="button" class="btn btn-yellow" data-close-modal>Chiudi</button>
      </div>`,
      { closeable: true, className: "route-boss-preview-modal", preserveScroll: scrollSnapshot() }
    );
    modalRoot.querySelectorAll("[data-boss-player]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.bossPlayer;
      const player = bossPlayers.find((candidate) => String(candidate.playerId) === String(id));
      showPlayerDetailsFor(player, { playerId: id, level: player?.displayLevel, database: seasonDb, preserveScroll: scrollSnapshot() });
    }));
    modalRoot.querySelectorAll(".route-boss-preview-actions [data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
  }


  function shortName(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return parts[0] || "?";
    return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
  }

  function teamById(id) {
    return seasonTeamsById.get(String(id)) || null;
  }

  function bossTeamPlayers(boss) {
    const level = Number(boss?.bossLevel || 0);
    return (boss?.startingXI || (boss?.startingXIPlayerIds || []).map((playerId) => ({ playerId, level })))
      .slice(0, 11)
      .map((slot) => {
        let source = seasonPlayersById.get(String(slot.playerId));
        let profileId = slot.profileId;
        if (isProfileAwareSeason(run?.seasonId)) {
          profileId = profileId || boss.startingXIProfileIds?.[Number(slot.slot || 1) - 1];
          const profile = global.ProfiledSeasonRuntime.resolveProfile(run.seasonId, profileId);
          if (profile) {
            const variant = (profile.roleVariants || []).find((item) => String(item.roleVariantId || item.variantId) === String(profile.defaultRoleVariantId));
            source = { ...source, ...profile, ...(variant || {}), playerId: String(profile.playerId), profileId: profile.profileId, roleVariantId: variant?.roleVariantId || variant?.variantId || profile.defaultRoleVariantId || null };
          }
        }
        if (!source) return null;
        const resolved = global.InazumaProgression.getPlayerAtLevel(source, Math.floor(Number(slot.level ?? level)), seasonDb);
        return { ...resolved, profileId: profileId || resolved.profileId || null, displayLevel: Number(slot.level ?? level), source: global.SeasonRegistry.sourceForSeason(run?.seasonId), playerId: String(slot.playerId) };
      })
      .filter(Boolean);
  }

  function userTeamPlayers() {
    return (run.lineup || []).slice(0, 11).map((id) => resolvedRosterPlayer(id)).filter(Boolean);
  }

  function formationRows(formationId, players) {
    const formation = formationById(formationId) || formationById("4-3-3") || { requirements: { FW: 3, MF: 3, DF: 4, GK: 1 } };
    const playersByRole = new Map(["FW", "MF", "DF", "GK"].map((role) => [role, players.filter((player) => String(player.position || player.normalizedRole || "").toUpperCase() === role)]));
    return global.FormationLayout.displayRows(formation).map((layout) => {
      return { ...layout, players: (playersByRole.get(layout.role) || []).splice(0, layout.count) };
    }).filter((row) => row.players.length);
  }

  function bossMatchTeamMeta(boss) {
    const userIdentity = normalizeTeamIdentity(run.teamIdentity);
    return {
      user: { name: userIdentity.name || "La tua squadra", logoUrl: "", formation: run.formationId || "-", level: run.teamLevel },
      boss: { name: boss?.teamName || "Boss", logoUrl: boss?.logoUrl || teamById(boss?.teamId)?.logoUrl || "", formation: boss?.bossFormation || "-", level: boss?.bossLevel ?? "-", overall: boss?.teamOverall || null },
    };
  }

  function bossMatchAverage(players) {
    if (!players.length) return null;
    return Math.round(players.reduce((sum, player) => sum + Number(player.overall || 0), 0) / players.length);
  }



  const TACTIC_LABELS = { attack: "Attacco", control: "Controllo", defense: "Difesa", save: "Parata", speed: "Velocità", physical: "Fisico", stamina: "Resistenza" };
  const TACTIC_SHORT_LABELS = { attack: "ATT", control: "CON", defense: "DIF", save: "PAR", speed: "VEL", physical: "FIS", stamina: "RES" };

  function tacticSummary(formationId) {
    return global.MatchSimulator.formationTactic(formationId);
  }

  function tacticChipMarkup(key, value, compact = false) {
    const positive = Number(value) >= 0;
    const percent = Math.round(Math.abs(Number(value) || 0) * 100);
    const label = compact ? (TACTIC_SHORT_LABELS[key] || key.toUpperCase()) : (TACTIC_LABELS[key] || key);
    const text = `${positive ? "↑" : "↓"} ${label} ${positive ? "+" : "-"}${percent}%`;
    return `<span class="tactic-chip tactic-chip--${positive ? "bonus" : "penalty"}" aria-label="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
  }

  function tacticPanelMarkup(formationId, { className = "", compact = false, strength = null, probability = null } = {}) {
    const tactic = tacticSummary(formationId);
    const entries = Object.entries(tactic.modifiers || {});
    const bonuses = entries.filter(([, value]) => value >= 0).map(([key, value]) => tacticChipMarkup(key, value, compact)).join("");
    const penalties = entries.filter(([, value]) => value < 0).map(([key, value]) => tacticChipMarkup(key, value, compact)).join("");
    const strengthMarkup = strength ? `<div class="tactic-strength"><span>Forza base <strong>${escapeHtml(Math.round(strength.averageOverall ?? 0))}</strong></span><span>Forza effettiva <strong>${escapeHtml(strength.final ?? "-")}</strong></span>${probability != null ? `<span>Probabilità <strong>${escapeHtml(probability)}%</strong></span>` : ""}</div>` : "";
    return `<section class="tactic-panel ${className}" data-tactic-panel data-formation="${escapeHtml(formationId || "")}"><div class="tactic-heading"><strong>${escapeHtml(formationId || "-")}</strong><span>${escapeHtml(tactic.name)}</span></div><p>${escapeHtml(tactic.description)}</p><div class="tactic-chip-row tactic-chip-row--bonus">${bonuses || '<span class="tactic-chip">Nessun bonus</span>'}</div><div class="tactic-chip-row tactic-chip-row--penalty">${penalties || '<span class="tactic-chip">Nessuna penalità</span>'}</div>${strengthMarkup}</section>`;
  }

  function matchFormationCard(player, { side = "user", readonly = true, showEquipment = false } = {}) {
    const equipment = showEquipment ? (player.equipment || rosterEntry(player.playerId)?.equippedItem || null) : null;
    return compactPlayerCardMarkup(player, {
      equipment,
      equipmentInFooter: true,
      level: player.displayLevel ?? player.level ?? 0,
      overall: player.overall ?? player.finalOverall ?? "-",
      dataAttr: `data-boss-player="${escapeHtml(player.playerId)}" data-boss-side="${side}" ${readonly ? 'aria-label="Apri scheda ' + escapeHtml(player.name) + '"' : ""}`,
      extraClass: `run-tactical-card match-player-card match-player-card--${side} boss-match-card boss-match-card--${side}`,
      detailLayout: "stacked",
    });
  }

  function renderMatchFormation({ players, formationId, side = "user", readonly = true, showEquipment = false, mobile = false, hidden = false } = {}) {
    const rows = formationRows(formationId, players || []);
    return `
      <div class="match-formation match-formation--${side} boss-match-field-side boss-match-field-side--${side} ${mobile ? "boss-match-field-side--mobile" : ""}" data-boss-team="${side}" data-readonly="${readonly}"${hidden ? " hidden" : ""}>
        ${rows.map((row) => `<div class="match-formation-line match-formation-line--${row.role} boss-match-line boss-match-line--${row.role}" data-row-count="${row.players.length}" style="--players-in-row:${row.players.length || 1};--row-count:${row.players.length || 1};--boss-row-count:${row.players.length || 1}">${row.players.map((player) => matchFormationCard(player, { side, readonly, showEquipment })).join("")}</div>`).join("")}
      </div>`;
  }

  function bossMatchField(team, side, mobile = false, hidden = false) {
    return renderMatchFormation({
      players: team.players,
      formationId: team.formationId,
      side,
      readonly: true,
      showEquipment: side === "user",
      mobile,
      hidden,
    });
  }

  function bossMatchTimeline() {
    if (!ui.bossMatchLog.length) return `<li data-empty-log="true"><span>0'</span><b>⚽</b><p>Formazioni pronte. Avvia la simulazione o usa i controlli provvisori.</p></li>`;
    return ui.bossMatchLog.map((event) => `<li class="${matchEventSideClass(event.side)}"><span>${escapeHtml(event.minute)}</span><b>${event.icon}</b><p>${escapeHtml(event.text)}</p></li>`).join("");
  }

  function switchBossMatchTab(side) {
    const activeSide = side === "boss" ? "boss" : "user";
    ui.bossMatchTab = activeSide;
    const field = document.querySelector(".boss-match-field");
    if (field) field.dataset.activeBossSide = activeSide;
    document.querySelectorAll("[data-boss-tab]").forEach((button) => {
      const selected = button.dataset.bossTab === activeSide;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    document.querySelectorAll(".boss-match-field [data-boss-team]").forEach((formation) => {
      formation.hidden = formation.dataset.bossTeam !== activeSide;
    });
    const label = document.querySelector(".boss-match-half-label--active");
    const team = document.querySelector(`.boss-match-team${activeSide === "boss" ? ".boss-match-team--boss" : ":not(.boss-match-team--boss)"} strong`);
    if (label && team) label.textContent = team.textContent || "";
  }

  function openFiveMatchSimulationModal(...args) { return matchEngine.openFiveMatchSimulationModal(...args); }

  function bossMatchStatusText() {
    return {
      "pre-match": "Pre-partita",
      simulating: "Simulazione in corso",
      "completed-victory": "Vittoria completata",
      "completed-defeat": "Sconfitta completata",
    }[ui.bossMatchState] || "Pre-partita";
  }



  function clearMatchPlaybackTimer(...args) { return matchEngine.clearMatchPlaybackTimer(...args); }

  function matchTransactionIdentity(...args) { return matchEngine.matchTransactionIdentity(...args); }

  function canonicalMatchFor(...args) { return matchEngine.canonicalMatchFor(...args); }

  function cloneMatchState(...args) { return matchEngine.cloneMatchState(...args); }

  function commitMatchMutation(...args) { return matchEngine.commitMatchMutation(...args); }

  function stopMatchAfterPersistenceFailure(...args) { return matchEngine.stopMatchAfterPersistenceFailure(...args); }

  function matchSeed(...args) { return matchEngine.matchSeed(...args); }

  function normalizedMatchPlayer(...args) { return matchEngine.normalizedMatchPlayer(...args); }

  function matchLineupSignature(...args) { return matchEngine.matchLineupSignature(...args); }

  function matchSnapshotFromTeam(...args) { return matchEngine.matchSnapshotFromTeam(...args); }

  function simulationTeamsForCurrentMatch(...args) { return matchEngine.simulationTeamsForCurrentMatch(...args); }

  function ensureMatchPreview(...args) { return matchEngine.ensureMatchPreview(...args); }

  function simulationScoreArray(...args) { return matchEngine.simulationScoreArray(...args); }

  function visibleTimeline(...args) { return matchEngine.visibleTimeline(...args); }

  function matchEventSideClass(...args) { return matchEngine.matchEventSideClass(...args); }

  function matchEventView(...args) { return matchEngine.matchEventView(...args); }

  function appendMatchLogEvent(...args) { return matchEngine.appendMatchLogEvent(...args); }

  function appendMissingMatchLogEvents(...args) { return matchEngine.appendMissingMatchLogEvents(...args); }

  function syncCommittedFinalMatchLog(...args) { return matchEngine.syncCommittedFinalMatchLog(...args); }

  function updateMatchScoreDom(...args) { return matchEngine.updateMatchScoreDom(...args); }

  function updateMatchControlsDom(...args) { return matchEngine.updateMatchControlsDom(...args); }

  function stepMatchPlayback(...args) { return matchEngine.stepMatchPlayback(...args); }

  function startMatchSimulation(...args) { return matchEngine.startMatchSimulation(...args); }

  function resumeMatchSimulationIfNeeded(...args) { return matchEngine.resumeMatchSimulationIfNeeded(...args); }

  function skipMatchToResult(...args) { return matchEngine.skipMatchToResult(...args); }

  function applySimulationResolution(...args) { return matchEngine.applySimulationResolution(...args); }

  function forceMatchOutcome(...args) { return matchEngine.forceMatchOutcome(...args); }


  function fiveFormationRows(...args) { return fiveMatchPresentation.fiveFormationRows(...args); }
  function fiveUserPlayersBySlot(...args) { return fiveMatchPresentation.fiveUserPlayersBySlot(...args); }
  function fiveOpponentLevel(...args) { return fiveMatchPresentation.fiveOpponentLevel(...args); }
  function createOrLoadFiveMatch(...args) { return fiveMatchPresentation.createOrLoadFiveMatch(...args); }
  function fiveOpponentPlayersBySlot(...args) { return fiveMatchPresentation.fiveOpponentPlayersBySlot(...args); }
  function fiveMatchCard(...args) { return fiveMatchPresentation.fiveMatchCard(...args); }
  function fiveMatchPlayerDetail(...args) { return fiveMatchPresentation.fiveMatchPlayerDetail(...args); }
  function fiveMatchField(...args) { return fiveMatchPresentation.fiveMatchField(...args); }
  function openFiveMatchPlayerSwap(...args) { return fiveMatchPresentation.openFiveMatchPlayerSwap(...args); }
  function fiveMatchStatAverage(...args) { return fiveMatchPresentation.fiveMatchStatAverage(...args); }
  function fiveMatchComparisonMarkup(...args) { return fiveMatchPresentation.fiveMatchComparisonMarkup(...args); }
  function formatMatchProbability(...args) { return fiveMatchPresentation.formatMatchProbability(...args); }

  function persistMatchState() {
    if (!ui.match) return { ok: false };
    return persistGameplayMutation({
      label: "match-state",
      mutate: () => { ui.match.state = ui.bossMatchState; ui.match.log = ui.bossMatchLog; run.activeMatch = ui.match; },
      rerender: ({ ok }) => { if (!ok) ui.match = run?.activeMatch || null; },
    });
  }

  function recoverLegacyResolvedMatchRoutingIfNeeded(match) {
    const legacyPartialDefeat = ["five_v_five", "special_match"].includes(match?.type)
      && match?.simulation?.resolutionApplied === true
      && match?.result === "defeat"
      && !match.pendingPostMatchAction
      && (run?.gameOver === true || ["map", "gameover"].includes(String(run?.phase || "")));
    if (!legacyPartialDefeat) return { ok: true, recovered: false };
    const identity = matchTransactionIdentity(match);
    return commitMatchMutation("legacy-match-routing-recovery", identity, (currentMatch, current) => {
      if (currentMatch.simulation?.resolutionApplied !== true || currentMatch.result !== "defeat" || currentMatch.pendingPostMatchAction) return { recovered: false };
      currentMatch.pendingPostMatchAction = {
        type: current.gameOver ? "game-over" : "map",
        toast: current.gameOver ? "Hai perso l'ultima vita. La run è terminata." : "Sconfitta già registrata: torni al nodo precedente.",
      };
      current.phase = "match";
      appendFinalMatchMessage("defeat", currentMatch.type, currentMatch);
      return { recovered: true };
    });
  }

  function renderMatch(...args) { return matchEngine.renderMatch(...args); }

  function addLevels(amount, actionId = null, explicitUnits = null, currentRun = run) {
    if (isProfileAwareSeason(currentRun?.seasonId)) {
      const units = explicitUnits == null ? Math.round(Number(amount || 0) * 6) : Number(explicitUnits);
      const before = currentRun.roster.map((entry) => Number(entry.level || 0));
      global.ProfiledSeasonRuntime.addLevelUnits(currentRun, units, actionId);
      return currentRun.roster.filter((entry, index) => Number(entry.level || 0) > before[index]).length;
    }
    let updatedPlayers = 0;
    const numericAmount = Number(amount || 0);
    currentRun.teamLevel = Math.min(20, Number(currentRun.teamLevel) + numericAmount);
    currentRun.roster.forEach((entry) => {
      const currentLevel = Number(entry.level || 0);
      const nextLevel = Math.min(20, currentLevel + numericAmount);
      if (nextLevel > currentLevel) updatedPlayers += 1;
      entry.level = nextLevel;
    });
    return updatedPlayers;
  }

  function appendFinalMatchMessage(result, matchType = "five_v_five", match = run?.activeMatch) {
    const text = matchType === "boss"
      ? (result === "victory" ? "Vittoria confermata: premi Continua per aprire le ricompense boss." : "Sconfitta confermata: premi Continua per tornare al nodo precedente.")
      : matchType === "special_match"
        ? (result === "victory" ? "Vittoria confermata: premi Continua per aprire la scelta giocatore." : "Sconfitta confermata: premi Continua per tornare al nodo precedente.")
        : (result === "victory" ? "Vittoria 5v5 confermata: premi Continua per tornare al percorso." : "Sconfitta 5v5 confermata: premi Continua per tornare al nodo precedente.");
    if (match && !(match.log || []).some((event) => event.minute === "FT")) {
      match.log = [...(match.log || []), { minute: "FT", icon: result === "victory" ? "🏆" : "💔", text, side: null }];
    }
  }

  function applyRealMatchStatistics(match, result, currentRun = run) {
    if (!match?.simulation?.valid) return;
    const bossIndex = Number(match.bossIndex ?? currentRun.bossIndex);
    const boss = match.type === "boss" ? seasonDb.bossOrder[bossIndex] : null;
    global.RunStatistics?.applyCompletedMatchStatistics?.(currentRun, {
      ...match,
      matchId: match.matchId || global.RunStatistics.createStableMatchId(currentRun, match),
      matchType: match.type,
      result,
      score: match.simulation.score || { user: match.score?.[0] || 0, opponent: match.score?.[1] || 0 },
      timeline: match.simulation.timeline || [],
      lineupSnapshot: match.lineupSnapshot || match.simulation.userSnapshot,
      userStrength: match.simulation.userStrength,
      opponentStrength: match.simulation.opponentStrength,
      probabilities: match.simulation.probabilities,
      forcedOutcome: match.simulation.forcedOutcome || match.forcedOutcome || null,
      testControl: Boolean(match.simulation.testControl || match.testControl),
      bossId: boss?.teamId || null,
      isFinal: match.type === "boss" && bossIndex >= seasonDb.bossOrder.length - 1,
      completedAt: new Date().toISOString(),
      formation: match.lineupSnapshot?.formation || match.simulation?.userSnapshot?.formation || (match.type === "five_v_five" ? currentRun.fiveVFive?.formation : currentRun.formationId),
    });
  }

  function applyConsecutiveLossResult(result, currentRun = run) {
    currentRun.consecutiveLosses = result === "victory" ? 0 : Math.min(2, Number(currentRun.consecutiveLosses || 0) + 1);
  }

  function enqueueGameOverDevelopmentEffect(current) {
    if (!current?.gameOver) return null;
    return global.PermanentEffects.enqueueDevelopment(current, {
      endReason: "gameover",
      defeatedBosses: Number(current.completedBossIds?.length || current.bossIndex || 0),
    });
  }

  function completeFiveMatch(result) {
    const match = run?.activeMatch;
    if (!match?.simulation || match.simulation.resolutionApplied) return;
    const identity = matchTransactionIdentity(match);
    const committed = commitMatchMutation("five-match-resolution", identity, (currentMatch, current) => {
      if (currentMatch.simulation.resolutionApplied) return { applied: false };
      currentMatch.simulation.resolutionApplied = true;
      currentMatch.state = result === "victory" ? "completed-victory" : "completed-defeat";
      currentMatch.result = result;
      applyConsecutiveLossResult(result, current);
      if (currentMatch.simulation.score) currentMatch.score = [currentMatch.simulation.score.user, currentMatch.simulation.score.opponent];
      applyRealMatchStatistics(currentMatch, result, current);
      const node = current.currentZone?.nodes?.find((item) => item.id === currentMatch.nodeId);
      if (result === "victory") {
        const reward = global.LevelProgression.fiveVFiveLevelReward(current.seasonId);
        addLevels(reward.amount, `${current.runId}:${currentMatch.nodeId}:five_v_five:victory`, reward.units, current);
        if (node) global.MapEngine.completeNode(current.currentZone, node.id);
        currentMatch.pendingPostMatchAction = { type: "map", toast: `Vittoria: tutta la rosa guadagna ${reward.text}` };
      } else {
        global.RunState.restoreAfterLoss(current, currentMatch.previousNodeId, currentMatch.type, { save: false });
        enqueueGameOverDevelopmentEffect(current);
        currentMatch.pendingPostMatchAction = { type: current.gameOver ? "game-over" : "map", toast: current.gameOver ? "Hai perso l'ultima vita. La run è terminata." : `Sconfitta: ${remainingLivesText(current.lives)}. Torni al nodo precedente.` };
      }
      current.phase = "match";
      current.activeMatch = currentMatch;
      appendFinalMatchMessage(result, "five_v_five", currentMatch);
      return { applied: true };
    }, { onCommitted: () => { ui.bossMatchResolving = "done"; } });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    updateMatchScoreDom(ui.match, true);
    syncCommittedFinalMatchLog();
    updateMatchControlsDom();
  }

  function completeSpecialMatch(result) { return specialMatchController.complete(result); }

  function completeBossMatch(result) { return bossFlowController.complete(result); }

  function continueAfterMatch(...args) { return matchEngine.continueAfterMatch(...args); }

  function showSpecialMatchReward() { return specialMatchRewardController.show(); }

  function resumePostBossFlowOrMap() {
    const flow = resolvePendingRunFlow({ clearMatch: true });
    if (flow.destination !== "none") return navigateBossVictoryDestination(flow);
    ensureCurrentZone(); run.phase = "map";
    try { global.RunState.save(run); } catch (error) { console.error("save failed (resumePostBossFlowOrMap)", error); }
    return renderMap();
  }
  function bossVictoryMatch() { const match = ui.match || run.activeMatch; return match?.type === "boss" && match.result === "victory" && String(match.state || "").startsWith("completed") ? match : null; }
  function ensurePostBossFlow(options = {}) { return bossFlowController.ensureFlow(options); }
  function resolvePendingRunFlow(options = {}) { return bossFlowController.resolve(options); }
  function resumePostBossFlow() { return bossFlowController.resume(); }
  function navigateBossVictoryDestination(flow) { return bossFlowController.navigate(flow); }
  function startBossRewards() { return bossFlowController.startRewards(); }
  function renderPostBossRecovery() { return bossFlowController.renderRecovery(); }
  function showNextBossReward() { return bossFlowController.showNextReward(); }
  function advanceBossReward(recordAction) { return bossFlowController.advanceReward(recordAction); }
  function finalizeBossVictoryTransition(options = {}) { return bossFlowController.finishTransition(options); }
  function finishBossVictoryTransition() { return bossFlowController.finishTransition(); }

  function devSkipCurrentBoss({ renderResult = true } = {}) {
    if (!DEV_MODE || !run || run.gameOver || run.phase === "complete") return false;
    const bossIndex = Number(run.bossIndex || 0);
    const boss = seasonDb.bossOrder[bossIndex];
    if (!boss || run.completedBossIds.includes(String(boss.teamId))) return false;
    run.postBossFlow = { bossIndex, status: "next-zone", remainingRewards: 0 };
    run.pendingBossVictory = null;
    run.activeMatch = null;
    run.currentZone = null;
    ui.match = null;
    const destination = finishBossVictoryTransition();
    try { global.RunState.save(run); } catch (error) { console.error("save failed (devSkipCurrentBoss)", error); }
    if (renderResult) navigateBossVictoryDestination(destination);
    return true;
  }

  function devSkipToCompletedBosses(target) {
    if (!DEV_MODE || !run) return;
    const cappedTarget = Math.min(Math.max(0, target), Math.max(0, seasonDb.bossOrder.length - 1));
    while (run.completedBossIds.length < cappedTarget && devSkipCurrentBoss({ renderResult: false })) { /* shared, progressive skip */ }
    try { global.RunState.save(run); } catch (error) { console.error("save failed (devSkipToCompletedBosses)", error); }
    renderMap();
  }

  function devGameOverNow() {
    if (!DEV_MODE || !run || run.gameOver) return;
    run.lives = 0;
    run.gameOver = true;
    run.phase = "gameover";
    run.activeMatch = null;
    run.pendingBossVictory = null;
    run.postBossFlow = null;
    ui.match = null;
    try { global.RunState.save(run); } catch (error) { console.error("save failed (devGameOverNow)", error); }
    renderGameOver();
  }

  function mountRunDevQuickTools() {
    document.getElementById("run-dev-quick-tools")?.remove();
    if (!DEV_MODE || !run || run.gameOver || ["complete", "final-celebration", "final-summary"].includes(run.phase)) return;
    const nextBoss = seasonDb?.bossOrder?.[run.bossIndex];
    if (!nextBoss) return;
    const panel = document.createElement("details");
    panel.id = "run-dev-quick-tools";
    panel.className = "run-dev-quick-tools";
    panel.innerHTML = `<summary>DEV RUN</summary><div><p><b>Boss sconfitti: ${escapeHtml(run.completedBossIds.length)}</b><br>Prossimo Boss: ${escapeHtml(nextBoss.teamName || run.bossIndex + 1)}</p><button type="button" data-dev-run="skip">SALTA BOSS +1</button><button type="button" data-dev-run="five">PORTAMI A 5 BOSS SCONFITTI</button><button type="button" data-dev-run="final">PORTAMI AL BOSS FINALE</button><button type="button" class="danger" data-dev-run="gameover">GAME OVER ORA</button></div>`;
    document.body.appendChild(panel);
    panel.querySelector('[data-dev-run="skip"]')?.addEventListener("click", () => devSkipCurrentBoss());
    panel.querySelector('[data-dev-run="five"]')?.addEventListener("click", () => devSkipToCompletedBosses(5));
    panel.querySelector('[data-dev-run="final"]')?.addEventListener("click", () => devSkipToCompletedBosses(seasonDb.bossOrder.length - 1));
    panel.querySelector('[data-dev-run="gameover"]')?.addEventListener("click", devGameOverNow);
  }

  if (DEV_MODE) new MutationObserver(() => mountRunDevQuickTools()).observe(app, { childList: true });


  function roleBadge(role) {
    const icons = { GK: "▣", DF: "◆", MF: "●", FW: "▲", all: "✦" };
    return `<span class="role-token role-${escapeHtml(role)}"><span>${icons[role] || icons.all}</span>${escapeHtml(role === "all" ? "Tutti" : role)}</span>`;
  }



  const fiveVFiveView = global.FiveVFiveViewRuntime.create({
    getRun: () => run, getUi: () => ui, controller: fiveVFiveController, fiveVFive: global.FiveVFive,
    fiveRoleForPlayerId, fiveOverallForPlayerId, resolvedRosterPlayer, rosterEntry, compactPlayerCardMarkup,
    escapeHtml, rarityClass, playerPortraitUrl, imageFallbackAttributes, resolvePlayerVisual, app, topbar, bottomNav,
    resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, syncScroll: restoreScroll, scrollSnapshot,
    runKeepingScroll, toast, renderMapFailureRecovery, matchTransactionIdentity, canonicalMatchFor, renderMatch,
    visibleTimeline, floatingPicker: global.FiveFormationFloatingPicker,
  });
  function commitFiveEditorMutation(label, mutate, options) { return fiveVFiveController.commit(label, mutate, options); }
  function renderFivePlayerPicker(options) { return fiveVFiveView.playerPickerMarkup(options); }
  function openFiveVFiveEditor(options) { return fiveVFiveView.open(options); }
  function renderFiveVFive(options) { return fiveVFiveView.render(options); }

  const inventoryController = global.InventoryController.create({
    getRun: () => run, getUi: () => ui, setInventoryEquipmentPlayerId: (value) => { ui.inventoryEquipmentPlayerId = value; },
    ensureRunSchema, groupedInventoryItems, groupedOwnedInventoryItems, resolveItem, itemStatLabel, itemIcon, escapeHtml, playerPortraitUrl, imageFallbackAttributes, resolvePlayerVisual, topbar, bottomNav, restoreScroll, resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, inventoryItemIdentity, inventoryItemCategory, openModal, modalRoot, closeModal, rosterEntry, resolvedRosterPlayer, sourcePlayer, compactPlayerCardMarkup, rarityClass, cssEscape, toast, persistGameplayMutation, removeInventoryItem, scrollSnapshot, app, runtimeTrainingState, addLevels, isProfileAwareSeason, formationById, lineupRows, getSeasonDb: () => seasonDb, getFreeAgentsDb: () => freeAgentsDb
  });
  const { renderInventory, unequipPlayerItem } = inventoryController;

  function homeHallOfFameMarkup() {
    const summaries = global.HallOfFameStorage?.listSummaries?.() || [];
    const latest = summaries[0];
    if (!latest) return `<article class="home-hub-card hall-home-card" aria-label="Albo d’Oro"><div class="home-card-kicker"><span>🏆</span><strong>ALBO D’ORO</strong></div><h2>Museo delle leggende</h2><p class="muted">Le squadre campioni appariranno qui dopo il trionfo finale.</p><div class="empty-state compact-empty"><strong>Nessun trofeo esposto</strong><span>Completa una run e inaugura la galleria.</span></div><div class="home-card-actions"><button type="button" class="btn" id="open-hall-home-empty">Apri Albo d’Oro</button></div></article>`;
    const portraits = (latest.portraits || []).slice(0, 4).map((src) => `<img src="${escapeHtml(src)}" alt="" loading="lazy"/>`).join("");
    return `<article class="home-hub-card hall-home-card" aria-label="Albo d’Oro"><div class="home-card-kicker"><span>🏆</span><strong>ALBO D’ORO · ${escapeHtml(summaries.length)} campioni</strong></div><div class="home-card-title-row"><div><h2>${escapeHtml(latest.teamName)}</h2><p class="muted">Ultima vincitrice · ${escapeHtml(normalizedHallSeasonName(latest))} · ${formatDate(latest.victoryDate)}</p></div><span class="home-trophy">★</span></div><div class="stat-grid home-stat-grid"><div class="stat-card"><span>Modulo</span><strong>${escapeHtml(latest.finalFormation || '-')}</strong></div><div class="stat-card"><span>Overall medio</span><strong>${escapeHtml(latest.finalAverageOverall ?? 'N/D')}</strong></div><div class="stat-card"><span>MVP</span><strong>${escapeHtml(latest.mvp?.name || 'N/D')}</strong></div></div><div class="hall-portraits home-hall-portraits">${portraits}</div><div class="home-card-actions"><button type="button" class="btn" id="open-hall-home-list">Apri Albo d’Oro</button><button type="button" class="btn btn-yellow" id="open-latest-hall-home" data-latest-hall="${escapeHtml(latest.hallTeamId)}">Apri ultima squadra</button></div></article>`;
  }

  function formatDate(value) {
    if (!value) return "Non disponibile";
    try { return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch (_) { return String(value); }
  }

  function snapshotPlayer(...args) { return championSnapshotRuntime.snapshotPlayer(...args); }
  function collectPlayerStatistics(...args) { return championSnapshotRuntime.collectPlayerStatistics(...args); }
  function buildChampionSnapshot(...args) { return championSnapshotRuntime.buildChampionSnapshot(...args); }

  function persistChampionBeforeFinalUi(finalBoss = null) {
    const boss = finalBoss || seasonDb.bossOrder[Math.min(Number(run.bossIndex || 1) - 1, seasonDb.bossOrder.length - 1)] || seasonDb.bossOrder.at(-1);
    if (!run.finalization) {
      run.completedAt = run.completedAt || new Date().toISOString();
      const snapshot = buildChampionSnapshot(boss);
      run.phase = "finalization";
      run.finalization = { status: "pending", archiveKey: snapshot.archiveKey, hallTeamId: snapshot.hallTeamId };
      global.PermanentEffects.enqueueHall(run, snapshot);
      try {
        global.RunState.save(run);
      } catch (error) {
        console.error("save failed (persistChampionBeforeFinalUi)", error);
        toast("Salvataggio della vittoria non riuscito, riprova.", "error");
      }
    }
    drainPermanentEffects();
    return run.hallTeamId ? global.HallOfFameStorage.getTeam(run.hallTeamId) : null;
  }

  function championTeam(hallTeamId) {
    let team = hallTeamId ? global.HallOfFameStorage.getTeam(hallTeamId) : null;
    if (!team && ["complete", "finalization", "final-celebration", "final-summary"].includes(String(run?.phase || ""))) team = persistChampionBeforeFinalUi();
    return team;
  }

  function snapshotCard(...args) { return championPresentation.snapshotCard(...args); }
  function championFormationMarkup(...args) { return championPresentation.championFormationMarkup(...args); }
  function championFiveVFiveMarkup(...args) { return championPresentation.championFiveVFiveMarkup(...args); }
  function compactSeed(...args) { return championPresentation.compactSeed(...args); }
  function formatStatValue(...args) { return championPresentation.formatStatValue(...args); }
  function runStatsSections(...args) { return championPresentation.runStatsSections(...args); }
  function statsMarkup(...args) { return championPresentation.statsMarkup(...args); }
  function awardsMarkup(...args) { return championPresentation.awardsMarkup(...args); }
  function playerStatsMarkup(...args) { return championPresentation.playerStatsMarkup(...args); }

  function bindFinalTabs() { document.querySelectorAll("[data-final-tab]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-final-tab]").forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-selected", item === button ? "true" : "false"); }); document.querySelectorAll("[data-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === button.dataset.finalTab)); })); document.querySelector('[data-final-tab="team"]')?.click(); }

  function bindHallPlayerDetails(...args) { return hallController.bindPlayerDetails(...args); }
  function renderHallOfFame(...args) { return hallController.renderList(...args); }
  function renderHallOfFameDetail(...args) { return hallController.renderDetail(...args); }


  function renderSeasonComplete() {
    return renderFinalCelebration(run?.hallTeamId, { developmentResolved: true });
  }


  async function loadSeason(seasonId) {
    activeSeason = global.SeasonRegistry.setActive(seasonId);
    seasonDb = await global.SeasonRegistry.loadDatabase(activeSeason.id);
    global.DevelopmentRuntime?.registerDatabase?.(activeSeason.id, seasonDb);
    activeSeason = global.SeasonRegistry.get(activeSeason.id);
    seasonPlayersById = global.SeasonRegistry.playersIndex(activeSeason.id);
    seasonTeamsById = global.SeasonRegistry.teamsIndex(activeSeason.id);
    return seasonDb;
  }

  function showLoadError(error) {
    console.error(error);
    const code = String(error?.code || error?.message || "unknown-load-error");
    const persistenceError = /restore-recovery-required|restore-repair-needed|canonical-unrecoverable|storage-access-error|legacy-cloud-target-not-immutable|restore-terminal-error/i.test(code);
    const databaseError = !persistenceError && (global.location?.protocol === "file:" || /database|fetch|network|json|load failed|failed to fetch/i.test(code));
    const heading = databaseError ? "Caricamento database non riuscito" : "Avvio temporaneamente non disponibile";
    const guidance = databaseError
      ? "I browser possono bloccare i database JSON quando index.html viene aperto direttamente. Usa Live Server oppure il file AVVIA_GIOCO.bat."
      : "Apri Account per controllare lo stato del salvataggio o usare le operazioni di recupero disponibili.";
    const accountEntry = databaseError ? "" : `<div class="button-row">${global.InazumaAccountUI?.buttonMarkup?.() || ""}</div>`;
    app.innerHTML = `
      <main class="hero-screen"><div><p class="eyebrow">Caricamento non riuscito</p><h2>${heading}</h2>
      <p class="muted">${guidance}</p>
      <pre class="panel">${escapeHtml(code)}</pre>${accountEntry}</div></main>`;
    return app.innerHTML;
  }

  function configureAlbumForBootstrap(playerIds) {
    return global.AlbumProgress.configureFreeAgentIds(playerIds, { persist: persistenceWritesAllowed() });
  }

  async function init() {
    try {
      const [activeDb, freeAgentsResponse, visualsResponse] = await Promise.all([
        loadSeason(global.SeasonRegistry.DEFAULT_SEASON_ID),
        fetch("data/FREE_AGENTS_compact.json"),
        fetch("data/PLAYER_VISUALS.json"),
      ]);
      if (!activeDb || !freeAgentsResponse.ok || !visualsResponse.ok) throw new Error("Database non raggiungibili");
      const visualsDb = await visualsResponse.json();
      freeAgentsDb = await freeAgentsResponse.json();
      global.DevelopmentRuntime?.registerDatabase?.("free-agents", freeAgentsDb);
      // Run gameplay is a device-local domain. Account authentication and
      // cloud recovery continue independently and must not gate app startup.
      configureAlbumForBootstrap((freeAgentsDb.players || []).map((player) => player.playerId));
      freeAgentsById = new Map(freeAgentsDb.players.map((player) => [String(player.playerId), player]));
      playerVisualsById = new Map(Object.entries(visualsDb.players || {}));
      await renderHome();
    } catch (error) {
      showLoadError(error);
    }
  }

  function setPermanentClubTestContext(context = {}) {
    if (global.__INAZUMA_TEST_MODE__ !== true) return false;
    if (Object.hasOwn(context, "run")) { run = context.run; global.run = run; }
    if (context.seasonDb) {
      seasonDb = context.seasonDb;
      seasonPlayersById = new Map((seasonDb.players || []).map((player) => [String(player.playerId), player]));
      seasonTeamsById = new Map((seasonDb.teams || []).map((team) => [String(team.teamId), team]));
    }
    if (context.freeAgentsDb) {
      freeAgentsDb = context.freeAgentsDb;
      freeAgentsById = new Map((freeAgentsDb.players || []).map((player) => [String(player.playerId), player]));
      global.DevelopmentRuntime?.registerDatabase?.("free-agents", freeAgentsDb);
      configureAlbumForBootstrap((freeAgentsDb.players || []).map((player) => player.playerId));
    }
    activeSeason = context.activeSeason || activeSeason;
    return true;
  }

  global.__INAZUMA_UI_TEST__ = { bindAlbumRosterInteractions, configureAlbumForBootstrap, setPermanentClubTestContext, persistenceWritesAllowed, repairResultMessage, showLoadError, renderHome, renderAlbumCollections, renderAlbumTeams, renderAlbumRoster, renderHallOfFame, renderHallOfFameDetail, renderDevelopmentCenter, developmentCurrencyIcon, bindHallPlayerDetails, startNewRunFromHome, startRunWithIdentity, renderSeasonSelect, selectSeason, resumeRun, getRun: () => run };
  if (DEV_MODE) global.__INAZUMA_GAMEPLAY_FAILURE_DIAGNOSTICS__ = () => global.RunState.clone(gameplayFailureDiagnostics);
  if (DEV_MODE) global.__INAZUMA_MATCH_DIAGNOSTICS__ = () => {
    const match = run?.activeMatch, effects = run?.permanentEffectOutbox || [];
    return { runId: run?.runId, matchId: match?.matchId, matchType: match?.type, phase: run?.phase, simulationState: match?.simulation?.state, resolutionApplied: match?.simulation?.resolutionApplied === true, result: match?.result, winner: match?.simulation?.winner, revealedCount: match?.simulation?.revealedCount, timelineLength: match?.simulation?.timeline?.length, pendingPostMatchAction: match?.pendingPostMatchAction || null, lives: run?.lives, gameOver: run?.gameOver, finalization: run?.finalization?.status || null, permanentEffects: { pending: effects.filter((effect) => effect.status === "pending").length, applied: effects.filter((effect) => effect.status === "applied").length }, postBossFlow: run?.postBossFlow?.status || null };
  };
  if (global.__INAZUMA_TEST_MODE__ === true) {
    global.__INAZUMA_RECRUITMENT_TEST__ = {
      recruitPlayer, showPlayerOffer, showNextBossReward, showSpecialMatchReward, openPull,
      setContext: (context = {}) => {
        if (context.run) { run = context.run; global.run = run; }
        if (context.seasonDb) { seasonDb = context.seasonDb; activeSeason = { id: seasonDb.seasonId }; seasonPlayersById = new Map((seasonDb.players || []).map((player) => [String(player.playerId), player])); }
        if (context.freeAgentsDb) { freeAgentsDb = context.freeAgentsDb; freeAgentsById = new Map((freeAgentsDb.players || []).map((player) => [String(player.playerId), player])); }
      },
      getRun: () => run,
    };
    global.__INAZUMA_INITIAL_DRAFT_TEST__ = Object.freeze({
      players: (...args) => initialDraftPlayers(...args),
      renderFormationChoice: (...args) => renderFormationChoice(...args),
      renderDraft: (...args) => renderDraft(...args),
      setContext: (context = {}) => {
        if (context.run) { run = context.run; global.run = run; }
        if (context.seasonDb) {
          seasonDb = context.seasonDb;
          activeSeason = { id: seasonDb.seasonId || context.run?.seasonId };
          seasonPlayersById = new Map((seasonDb.players || []).map((player) => [String(player.playerId), player]));
        }
        if (context.freeAgentsDb) {
          freeAgentsDb = context.freeAgentsDb;
          freeAgentsById = new Map((freeAgentsDb.players || []).map((player) => [String(player.playerId), player]));
        }
      },
      getRun: () => run,
    });
    // Deliberately thin test seam: every entry delegates to the same private
    // production function used by the UI. Keep orchestration out of tests and
    // do not duplicate terminal-run persistence semantics here.
    global.__INAZUMA_TERMINAL_FLOW_TEST__ = Object.freeze({
      completeBossMatch,
      completeFiveMatch,
      completeSpecialMatch,
      forceMatchOutcome,
      startMatchSimulation,
      stepMatchPlayback,
      skipMatchToResult,
      resumeMatchSimulationIfNeeded,
      recoverInterruptedMatchAccess,
      recoverInterruptedSpecialMatchAccess,
      recoverInterruptedBossAccess,
      resumeRun,
      updateMatchControlsDom,
      leaveMatchViaSectionRoot,
      enterNode,
      dispatchNode,
      enterMatchFromNode,
      activePullNodeById,
      useScoutTokenOnPull,
      useLuckyCharmOnPull,
      completePullNodeMutation,
      renderItemRewardResult,
      resolveItemNode,
      resumePendingItemReward,
      ensurePendingItemReward,
      finishNonMatchNode,
      recoverLegacyResolvedMatchRoutingIfNeeded,
      continueAfterMatch,
      resolvePendingRunFlow,
      showNextBossReward,
      advanceBossReward,
      finishBossVictoryTransition,
      navigateBossVictoryDestination,
      resumeRunFinalization,
      renderGameOver,
      renderMatch,
      specialMatchOpponentMeta: (match) => specialMatchView.opponentMeta(match),
      renderFiveVFive,
      renderSquad,
      showPlayerDetailsFor,
      showPlayerDetails,
      openFiveVFiveEditor,
      openFiveMatchPlayerSwap,
      resolveDevelopmentEndRunFlow,
      renderMap,
      renderMapFailureRecovery,
      renderInventory,
      chooseEquipmentPlayer: inventoryController.chooseEquipmentPlayer,
      useInventoryItem: inventoryController.useInventoryItem,
      inventoryModel,
      ensureCurrentZoneMutation,
      setContext: (context = {}) => {
        if (context.run) { run = context.run; global.run = run; ui.match = run.activeMatch || null; }
        if (context.seasonDb) {
          seasonDb = context.seasonDb;
          activeSeason = { id: seasonDb.seasonId || context.run?.seasonId };
          seasonPlayersById = new Map((seasonDb.players || []).map((player) => [String(player.playerId), player]));
        }
      },
      getRun: () => run,
      getUi: () => ui,
      getAppMarkup: () => app.innerHTML,
    });
  }
  init();
})(globalThis);
