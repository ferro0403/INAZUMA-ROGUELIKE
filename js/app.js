(function (global) {
  "use strict";

  const DEV_MODE = new URLSearchParams(global.location?.search || "").get("dev") === "1";
  const TEST_MATCH_CONTROLS_ENABLED = DEV_MODE;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");
  const uiShell = global.AppUiShell.create({
    app, modalRoot, toastRoot,
    getRun: () => run,
    normalizeTeamIdentity: (...args) => normalizeTeamIdentity(...args),
    averageOverall: (...args) => averageOverall(...args),
  });

  function repairResultMessage(...args) { return devDiagnostics.repairResultMessage(...args); }

  function persistenceWritesAllowed() {
    return !global.PersistenceRecoveryGuard?.isBlocked?.();
  }

  function getSectionRootDestination(...args) { return uiShell.getSectionRootDestination(...args); }

  function sectionRootButton(...args) { return uiShell.sectionRootButton(...args); }

  function navigateToSectionRoot(section, context = {}) {
    const destination = getSectionRootDestination(section).destination;
    if (destination === "map" && run?.activeMatch) return leaveMatchViaSectionRoot();
    if (destination === "map" && run) {
      if (run.phase === "map") {
        closeModal({ invokeOnClose: false });
        return renderMap({ persist: false });
      }
      const committed = persistGameplayMutation({
        label: "section-root-map-navigation",
        mutate: (current) => { current.phase = "map"; },
      });
      if (!committed.ok) return null;
      closeModal({ invokeOnClose: false });
      return renderMap({ persist: false });
    }
    closeModal({ invokeOnClose: false });
    if (destination === "home") return renderHome();
    if (destination === "seasonSelection") return renderSeasonSelect();
    if (destination === "map") return renderMap({ persist: false });
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
  let sharedRunRosterRuntime = null;
  function runRosterRuntime() {
    sharedRunRosterRuntime ||= global.RunRosterRuntime.create({
      getRun: () => run,
      getSeasonDb: () => seasonDb,
      getFreeAgentsDb: () => freeAgentsDb,
      getFreeAgentsById: () => freeAgentsById,
      getSeasonPlayersById: () => seasonPlayersById,
      getSeasonTeamsById: () => seasonTeamsById,
    });
    return sharedRunRosterRuntime;
  }
  function isProfileAwareSeason(...args) { return runRosterRuntime().isProfileAwareSeason(...args); }
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

  const devDiagnostics = global.AppDevDiagnostics.create({
    devMode: DEV_MODE,
    getRun: () => run,
    getUi: () => ui,
    getActiveSeason: () => activeSeason,
  });
  devDiagnostics.installPersistenceTools();
  devDiagnostics.installGlobalDiagnostics();

  function stopGameplayRuntime() {
    if (ui.matchPlaybackTimer) clearTimeout(ui.matchPlaybackTimer);
    ui.matchPlaybackTimer = null;
    ui.bossMatchResolving = false;
    ui.itemRewardSubmitting = false;
  }

  function recordGameplayFailure(...args) { return devDiagnostics.recordGameplayFailure(...args); }

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

  function escapeHtml(...args) { return uiShell.escapeHtml(...args); }

  function toast(...args) { return uiShell.toast(...args); }

  function closeModal(...args) { return uiShell.closeModal(...args); }

  function scrollSnapshot(...args) { return uiShell.scrollSnapshot(...args); }

  function setScrollPosition(...args) { return uiShell.setScrollPosition(...args); }

  function restorePageScroll(...args) { return uiShell.restorePageScroll(...args); }

  function restoreScroll(...args) { return uiShell.restoreScroll(...args); }

  function afterNextPaint(...args) { return uiShell.afterNextPaint(...args); }

  function runKeepingScroll(...args) { return uiShell.runKeepingScroll(...args); }

  function isScrollableElement(...args) { return uiShell.isScrollableElement(...args); }

  function scrollTargetsForView(...args) { return uiShell.scrollTargetsForView(...args); }

  function resetViewScroll(...args) { return uiShell.resetViewScroll(...args); }

  function resetRenderedViewScroll(...args) { return uiShell.resetRenderedViewScroll(...args); }

  function openModal(...args) { return uiShell.openModal(...args); }

  function formationById(...args) { return runRosterRuntime().formationById(...args); }

  function fiveRoleForPlayerId(...args) { return runRosterRuntime().roleForPlayerId(...args); }

  function effectiveRosterRole(...args) { return runRosterRuntime().roleForPlayerId(...args); }

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
  function fiveOverallForPlayerId(...args) { return runRosterRuntime().overallForPlayerId(...args); }
  function optimizeLineupsForNewPlayer(playerId, currentRun = run, announce = true) { return fiveVFiveController.optimizeForNewPlayer(playerId, currentRun, announce); }
  function fiveVFiveStatus(currentRun = run, options = {}) { return fiveVFiveController.status(currentRun, options); }

  function sourcePlayer(...args) { return runRosterRuntime().sourcePlayer(...args); }

  function legacyRosterPlayer(...args) { return runRosterRuntime().legacyRosterPlayer(...args); }

  function rosterEntry(...args) { return runRosterRuntime().rosterEntry(...args); }

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

  function activeBasePotential(...args) { return runRosterRuntime().activeBasePotential(...args); }

  function runtimeTrainingState(...args) { return runRosterRuntime().runtimeTrainingState(...args); }

  function resolvedRosterPlayer(...args) { return runRosterRuntime().resolvedRosterPlayer(...args); }

  function hearts(...args) { return uiShell.hearts(...args); }

  function lifeHeartsMarkup(...args) { return uiShell.lifeHeartsMarkup(...args); }

  function remainingLivesText(lives) {
    const value = Number(lives) || 0;
    if (value === 0.5) return "resta mezza vita";
    if (value === 1) return "resta 1 vita";
    if (value === 1.5) return "restano 1 vita e mezza";
    return `restano ${value} vite`;
  }


  function averageOverall(...args) { return runRosterRuntime().averageOverall(...args); }

  function formatDuration(...args) { return uiShell.formatDuration(...args); }

  function topbar(...args) { return uiShell.topbar(...args); }

  function navIcon(...args) { return uiShell.navIcon(...args); }

  function bottomNav(...args) { return uiShell.bottomNav(...args); }

  function bindBottomNav() {
    document.querySelectorAll("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        const destination = button.dataset.nav;
        if (destination === "map") {
          closeModal({ invokeOnClose: false });
          return resumePostBossFlowOrMap();
        } else if (destination === "squad") {
          ensurePostBossFlow({ clearMatch: true });
          if (run.phase === "squad") {
            closeModal({ invokeOnClose: false });
            return renderSquad();
          }
          const committed = persistGameplayMutation({
            label: "bottom-nav-squad-navigation",
            mutate: (current) => { current.phase = "squad"; },
          });
          if (!committed.ok) return null;
          closeModal({ invokeOnClose: false });
          return renderSquad();
        } else if (destination === "inventory") {
          closeModal({ invokeOnClose: false });
          return renderInventory();
        } else if (destination === "five") {
          closeModal({ invokeOnClose: false });
          return openFiveVFiveEditor();
        }
        return null;
      });
    });
  }

  function cssEscape(...args) { return uiShell.cssEscape(...args); }

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

  function permanentRosterFields(...args) { return runRosterRuntime().permanentRosterFields(...args); }

  function teamLogoMarkup(teamIdentity) {
    if (teamIdentity?.logoUrl) return `<img src="${escapeHtml(teamIdentity.logoUrl)}" alt="${escapeHtml(teamIdentity.name)}" loading="lazy" />`;
    if (teamIdentity?.logo === "inazuma-lightning") return inazumaLogoMarkup("inazuma-logo--small");
    return `<span class="team-logo-placeholder" aria-hidden="true">⚽</span>`;
  }

  function playerTeamIdentity(...args) { return runRosterRuntime().playerTeamIdentity(...args); }

  function historicalTeamIdentity(...args) { return runRosterRuntime().historicalTeamIdentity(...args); }

  function playerDetailMarkup(...args) { return playerView.detailMarkup(...args); }
  const playerDetailController = global.PlayerDetailController.create({
    view: playerView, openModal, closeModal, toast, getModalRoot: () => modalRoot,
    getFreeAgentsDb: () => freeAgentsDb, getRosterEntry: rosterEntry, resolveRosterPlayer: resolvedRosterPlayer,
    databaseForEntry: (entry) => global.SeasonRegistry?.isSeasonSource?.(entry.source) ? (global.SeasonRegistry.database(entry.source) || seasonDb) : freeAgentsDb,
    unequipPlayerItem: (...args) => unequipPlayerItem(...args), renderSquad: (...args) => renderSquad(...args),
  });
  function showPlayerDetailsFor(...args) { return playerDetailController.showFor(...args); }
  function showPlayerDetails(...args) { return playerDetailController.showRosterPlayer(...args); }


  const matchPresentation = global.MatchPresentationRuntime.create({
    getRun: () => run,
    getUi: () => ui,
    getSeasonDb: () => seasonDb,
    getSeasonPlayersById: () => seasonPlayersById,
    getSeasonTeamsById: () => seasonTeamsById,
    isProfileAwareSeason: (...args) => isProfileAwareSeason(...args),
    formationById: (...args) => formationById(...args),
    resolvedRosterPlayer: (...args) => resolvedRosterPlayer(...args),
    rosterEntry: (...args) => rosterEntry(...args),
    compactPlayerCardMarkup: (...args) => compactPlayerCardMarkup(...args),
    normalizeTeamIdentity: (...args) => normalizeTeamIdentity(...args),
    escapeHtml: (...args) => escapeHtml(...args),
    matchEventSideClass: (...args) => matchEventSideClass(...args),
    openModal: (...args) => openModal(...args),
    closeModal: (...args) => closeModal(...args),
    scrollSnapshot: (...args) => scrollSnapshot(...args),
    showPlayerDetailsFor: (...args) => showPlayerDetailsFor(...args),
    bossNodeIconMarkup: (...args) => bossNodeIconMarkup(...args),
    modalRoot,
  });

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
    persistMutation: (options) => persistGameplayMutation(options),
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


  function inazumaLogoMarkup(...args) { return uiShell.inazumaLogoMarkup(...args); }

  const teamProfileRuntime = global.TeamProfileRuntime.create({
    getRun: () => run,
    persistenceWritesAllowed,
    openModal,
    closeModal,
    renderSettings: (...args) => renderSettings(...args),
    startRunWithIdentity: (...args) => startRunWithIdentity(...args),
    escapeHtml,
    inazumaLogoMarkup,
  });

  function normalizeTeamIdentity(...args) { return teamProfileRuntime.normalizeTeamIdentity(...args); }

  function loadTeamProfile(...args) { return teamProfileRuntime.loadTeamProfile(...args); }

  function savedTeamIdentity(...args) { return teamProfileRuntime.savedTeamIdentity(...args); }

  function migrateTeamIdentityProfile(...args) { return teamProfileRuntime.migrateTeamIdentityProfile(...args); }

  function validateTeamName(...args) { return teamProfileRuntime.validateTeamName(...args); }

  function seasonDisplayName(...args) { return teamProfileRuntime.seasonDisplayName(...args); }

  function normalizedHallSeasonName(...args) { return teamProfileRuntime.normalizedHallSeasonName(...args); }

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


  function savedTeamSummaryMarkup(...args) { return teamProfileRuntime.savedTeamSummaryMarkup(...args); }

  function openTeamNameModal(...args) { return teamProfileRuntime.openTeamNameModal(...args); }

  function openEditTeamNameModal(...args) { return teamProfileRuntime.openEditTeamNameModal(...args); }

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

  function openBossPreviewModal(...args) { return matchPresentation.openBossPreviewModal(...args); }


  function shortName(...args) { return matchPresentation.shortName(...args); }

  function teamById(...args) { return matchPresentation.teamById(...args); }

  function bossTeamPlayers(...args) { return matchPresentation.bossTeamPlayers(...args); }

  function userTeamPlayers(...args) { return matchPresentation.userTeamPlayers(...args); }

  function formationRows(...args) { return matchPresentation.formationRows(...args); }

  function bossMatchTeamMeta(...args) { return matchPresentation.bossMatchTeamMeta(...args); }

  function bossMatchAverage(...args) { return matchPresentation.bossMatchAverage(...args); }




  function tacticSummary(...args) { return matchPresentation.tacticSummary(...args); }

  function tacticChipMarkup(...args) { return matchPresentation.tacticChipMarkup(...args); }

  function tacticPanelMarkup(...args) { return matchPresentation.tacticPanelMarkup(...args); }

  function matchFormationCard(...args) { return matchPresentation.matchFormationCard(...args); }

  function renderMatchFormation(...args) { return matchPresentation.renderMatchFormation(...args); }

  function bossMatchField(...args) { return matchPresentation.bossMatchField(...args); }

  function bossMatchTimeline(...args) { return matchPresentation.bossMatchTimeline(...args); }

  function switchBossMatchTab(...args) { return matchPresentation.switchBossMatchTab(...args); }

  function openFiveMatchSimulationModal(...args) { return matchEngine.openFiveMatchSimulationModal(...args); }

  function bossMatchStatusText(...args) { return matchPresentation.bossMatchStatusText(...args); }



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

  function addLevels(...args) { return runRosterRuntime().addLevels(...args); }

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
    const zone = run?.currentZone;
    const mapReady = run?.phase === "map"
      && zone
      && Array.isArray(zone.nodes)
      && Array.isArray(zone.edges)
      && Array.isArray(zone.path);
    if (mapReady) return renderMap({ persist: false });
    let zoneResult = null;
    const committed = persistGameplayMutation({
      label: "post-boss-map-navigation",
      mutate: (current) => {
        zoneResult = ensureCurrentZoneMutation(current);
        current.phase = "map";
      },
    });
    if (!committed.ok) return null;
    if (zoneResult?.generated) {
      try { global.RunState.createCheckpoint?.(run); }
      catch (error) { console.warn("Unable to persist map checkpoint", error); }
    }
    return renderMap({ persist: false });
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
      const committed = persistGameplayMutation({
        label: "champion-finalization-entry",
        mutate: (current) => {
          current.completedAt = current.completedAt || new Date().toISOString();
          const snapshot = buildChampionSnapshot(boss);
          current.phase = "finalization";
          current.finalization = { status: "pending", archiveKey: snapshot.archiveKey, hallTeamId: snapshot.hallTeamId };
          global.PermanentEffects.enqueueHall(current, snapshot);
        },
      });
      if (!committed.ok) return null;
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


  const appBootstrap = global.AppBootstrapRuntime.create({
    app,
    fetchResource: (...args) => fetch(...args),
    escapeHtml,
    persistenceWritesAllowed,
    renderHome,
    setRun,
    getActiveSeason: () => activeSeason,
    setActiveSeason: (value) => { activeSeason = value; },
    setSeasonDb: (value) => { seasonDb = value; },
    setSeasonPlayersById: (value) => { seasonPlayersById = value; },
    setSeasonTeamsById: (value) => { seasonTeamsById = value; },
    setFreeAgentsDb: (value) => { freeAgentsDb = value; },
    setFreeAgentsById: (value) => { freeAgentsById = value; },
    setPlayerVisualsById: (value) => { playerVisualsById = value; },
  });
  function loadSeason(...args) { return appBootstrap.loadSeason(...args); }
  function showLoadError(...args) { return appBootstrap.showLoadError(...args); }
  function configureAlbumForBootstrap(...args) { return appBootstrap.configureAlbumForBootstrap(...args); }
  function setPermanentClubTestContext(...args) { return appBootstrap.setPermanentClubTestContext(...args); }

  global.AppTestSeams.install({
    testMode: global.__INAZUMA_TEST_MODE__ === true,
    app,
    getRun: () => run,
    setRun,
    getUi: () => ui,
    setUiMatch: (match) => { ui.match = match; },
    setSeasonDb: (value) => { seasonDb = value; },
    setActiveSeason: (value) => { activeSeason = value; },
    setSeasonPlayersById: (value) => { seasonPlayersById = value; },
    setFreeAgentsDb: (value) => { freeAgentsDb = value; },
    setFreeAgentsById: (value) => { freeAgentsById = value; },
    uiApi: {
      bindAlbumRosterInteractions, configureAlbumForBootstrap, setPermanentClubTestContext, persistenceWritesAllowed,
      repairResultMessage, showLoadError, renderHome, renderAlbumCollections, renderAlbumTeams, renderAlbumRoster,
      renderHallOfFame, renderHallOfFameDetail, renderDevelopmentCenter, developmentCurrencyIcon, bindHallPlayerDetails,
      startNewRunFromHome, startRunWithIdentity, renderSeasonSelect, selectSeason, resumeRun,
    },
    recruitmentApi: { recruitPlayer, showPlayerOffer, showNextBossReward, showSpecialMatchReward, openPull },
    initialDraftApi: {
      players: (...args) => initialDraftPlayers(...args),
      renderFormationChoice: (...args) => renderFormationChoice(...args),
      renderDraft: (...args) => renderDraft(...args),
    },
    terminalApi: {
      completeBossMatch, completeFiveMatch, completeSpecialMatch, forceMatchOutcome, startMatchSimulation,
      stepMatchPlayback, skipMatchToResult, resumeMatchSimulationIfNeeded, recoverInterruptedMatchAccess,
      recoverInterruptedSpecialMatchAccess, recoverInterruptedBossAccess, resumeRun, updateMatchControlsDom,
      leaveMatchViaSectionRoot, enterNode, dispatchNode, enterMatchFromNode, activePullNodeById,
      useScoutTokenOnPull, useLuckyCharmOnPull, completePullNodeMutation, renderItemRewardResult, resolveItemNode,
      resumePendingItemReward, ensurePendingItemReward, finishNonMatchNode, recoverLegacyResolvedMatchRoutingIfNeeded,
      continueAfterMatch, resolvePendingRunFlow, showNextBossReward, advanceBossReward, finishBossVictoryTransition,
      navigateBossVictoryDestination, resumeRunFinalization, persistChampionBeforeFinalUi, renderGameOver, renderMatch,
      specialMatchOpponentMeta: (match) => specialMatchView.opponentMeta(match),
      renderFiveVFive, renderSquad, showPlayerDetailsFor, showPlayerDetails, openFiveVFiveEditor,
      openFiveMatchPlayerSwap, resolveDevelopmentEndRunFlow, renderMap, renderMapFailureRecovery, renderInventory,
      chooseEquipmentPlayer: inventoryController.chooseEquipmentPlayer,
      useInventoryItem: inventoryController.useInventoryItem,
      inventoryModel, ensureCurrentZoneMutation, devSkipCurrentBoss, devSkipToCompletedBosses, devGameOverNow,
    },
  });
  appBootstrap.init();
})(globalThis);
