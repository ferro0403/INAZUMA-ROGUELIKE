(function (global) {
  "use strict";

  const DEV_MODE = /(?:localhost|127\.0\.0\.1)/.test(global.location?.hostname || "") && global.location?.search?.includes("dev=1");
  const TEST_MATCH_CONTROLS_ENABLED = true;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRoot = document.getElementById("toast-root");

  const CATEGORY_CLASS_BY_NAME = {
    Scarso: "rarity-scarso",
    Debole: "rarity-debole",
    Normale: "rarity-normale",
    Buono: "rarity-buono",
    Forte: "rarity-forte",
    Elite: "rarity-elite",
    Mondiale: "rarity-mondiale",
    Leggenda: "rarity-leggenda",
  };
  function rarityClass(category) {
    return CATEGORY_CLASS_BY_NAME[category] || "rarity-debole";
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
  };

  function getSectionRootDestination(section) {
    return SECTION_ROOT_DESTINATIONS[section] || SECTION_ROOT_DESTINATIONS.seasonSelection;
  }

  function sectionRootButton(section, extraClass = "") {
    const destination = getSectionRootDestination(section);
    return `<button type="button" class="section-root-button ${escapeHtml(extraClass)}" data-section-root="${escapeHtml(section)}" aria-label="${escapeHtml(destination.label)}" title="${escapeHtml(destination.label)}"><span aria-hidden="true">🏠</span></button>`;
  }

  function navigateToSectionRoot(section, context = {}) {
    const destination = getSectionRootDestination(section).destination;
    if (destination === "home") return renderHome();
    if (destination === "seasonSelection") {
      if (run) global.RunState.save(run);
      return renderSeasonSelect();
    }
    if (destination === "albumRoot") return renderAlbumCollections();
    if (destination === "albumTeams") return renderAlbumTeams(context.collectionId || ui.albumCollectionId || global.AlbumProgress.DEFAULT_COLLECTION_ID);
    if (destination === "hallRoot") return renderHallOfFame();
    return renderHome();
  }

  function bindSectionRootNav(context = {}) {
    document.querySelectorAll("[data-section-root]").forEach((button) => {
      button.addEventListener("click", () => navigateToSectionRoot(button.dataset.sectionRoot, context));
    });
  }

  const INVENTORY_CATEGORY_DEFINITIONS = [
    { id: "training", title: "Allenamento e potenziamenti", icon: "▴", itemIds: ["energy_drink", "training_manual", "intensive_training"] },
    { id: "equipment", title: "Equipaggiamenti", icon: "◆", itemIds: [] },
    { id: "special", title: "Gettoni e oggetti speciali", icon: "✦", itemIds: ["scout_token", "medical_kit", "lucky_charm"] },
  ];

  function itemDefinitionById(id) {
    return global.SEASON1_CONFIG.itemPool.find((candidate) => candidate.id === id) || null;
  }

  function resolveItem(itemOrId) {
    const id = String(typeof itemOrId === "string" ? itemOrId : itemOrId?.itemId || itemOrId?.id || "");
    const definition = itemDefinitionById(id);
    if (definition) return typeof itemOrId === "object" && itemOrId ? { ...itemOrId, ...definition, instanceId: itemOrId.instanceId } : definition;
    return typeof itemOrId === "object" && itemOrId ? itemOrId : { id, name: "Oggetto", description: "Oggetto non disponibile." };
  }

  function inventoryItemIdentity(item) {
    return String(item?.itemId || item?.id || item?.effect || item?.name || "unknown_item");
  }

  function inventoryItemCategory(item) {
    const id = inventoryItemIdentity(item);
    if (item?.kind === "equipment") return "equipment";
    const definition = INVENTORY_CATEGORY_DEFINITIONS.find((category) => category.itemIds.includes(id));
    return definition?.id || "special";
  }

  function groupedInventoryItems(inventory) {
    const groups = new Map();
    (Array.isArray(inventory) ? inventory : []).forEach((item) => {
      const key = inventoryItemIdentity(item);
      const existing = groups.get(key);
      if (existing) {
        existing.quantity += 1;
        existing.instances.push(item);
      } else {
        groups.set(key, { key, item, quantity: 1, instances: [item], category: inventoryItemCategory(item) });
      }
    });
    return [...groups.values()];
  }

  function groupedInventoryByCategory(inventory) {
    const groups = groupedInventoryItems(inventory);
    return INVENTORY_CATEGORY_DEFINITIONS.map((category) => ({
      ...category,
      items: groups.filter((group) => group.category === category.id),
    }));
  }

  function groupedOwnedInventoryItems(run) {
    const backpack = Array.isArray(run?.inventory) ? run.inventory : [];
    const groups = new Map(groupedInventoryItems(backpack).map((group) => [
      group.key,
      { ...group, backpackQuantity: group.quantity, equippedCount: 0, equippedEntries: [] },
    ]));
    const seenInstanceIds = new Set(backpack.map((item) => item?.instanceId).filter(Boolean).map(String));

    (Array.isArray(run?.roster) ? run.roster : []).forEach((entry) => {
      if (!entry?.equippedItem) return;
      const item = entry.equippedItem;
      const key = inventoryItemIdentity(item);
      const instanceId = item.instanceId ? String(item.instanceId) : "";
      const alreadyInBackpack = instanceId && seenInstanceIds.has(instanceId);
      const existing = groups.get(key) || {
        key,
        item,
        quantity: 0,
        backpackQuantity: 0,
        equippedCount: 0,
        instances: [],
        equippedEntries: [],
        category: inventoryItemCategory(item),
      };
      existing.equippedCount += 1;
      existing.equippedEntries.push(entry);
      if (!alreadyInBackpack) {
        existing.quantity += 1;
        if (instanceId) seenInstanceIds.add(instanceId);
      }
      groups.set(key, existing);
    });

    return [...groups.values()];
  }

  function groupedOwnedInventoryByCategory(run) {
    const groups = groupedOwnedInventoryItems(run);
    return INVENTORY_CATEGORY_DEFINITIONS.map((category) => ({
      ...category,
      items: groups.filter((group) => group.category === category.id),
    }));
  }

  function inventoryOwnershipSummary(run) {
    const backpack = Array.isArray(run?.inventory) ? run.inventory : [];
    const equippedEntries = (Array.isArray(run?.roster) ? run.roster : []).filter((entry) => entry?.equippedItem);
    const seenInstanceIds = new Set();
    let ownedCount = 0;
    const countOwnedInstance = (item) => {
      const instanceId = item?.instanceId;
      if (instanceId) {
        const key = String(instanceId);
        if (seenInstanceIds.has(key)) return;
        seenInstanceIds.add(key);
      }
      ownedCount += 1;
    };

    backpack.forEach(countOwnedInstance);
    equippedEntries.forEach((entry) => countOwnedInstance(entry.equippedItem));

    return {
      backpackCount: backpack.length,
      equippedCount: equippedEntries.length,
      ownedCount,
      equippedPlayerCount: new Set(equippedEntries.map((entry) => String(entry.playerId))).size,
      consumableCount: backpack.filter((item) => resolveItem(item).kind === "consumable").length,
    };
  }

  function itemStatLabel(stat) {
    return ({ attack: "Attacco", control: "Controllo", defense: "Difesa", save: "Parata", grit: "Grinta", physical: "Fisico", speed: "Velocità", stamina: "Resistenza" })[stat] || stat || "Effetto";
  }

  function inventoryFilterDefinitions(run) {
    const groups = groupedOwnedInventoryItems(run);
    const hasKind = (kind) => groups.some((group) => resolveItem(group.item).kind === kind);
    const hasStat = (stat) => groups.some((group) => resolveItem(group.item).stat === stat);
    return [
      { id: "all", label: "Tutti", count: groups.reduce((sum, group) => sum + group.quantity, 0) },
      ...(hasKind("equipment") ? [{ id: "equipment", label: "Equipaggiabili", count: groups.filter((group) => resolveItem(group.item).kind === "equipment").reduce((sum, group) => sum + group.quantity, 0) }] : []),
      ...(hasKind("consumable") ? [{ id: "consumable", label: "Consumabili", count: groups.filter((group) => resolveItem(group.item).kind === "consumable").reduce((sum, group) => sum + group.quantity, 0) }] : []),
      ...["attack", "control", "defense", "save", "grit", "physical", "speed", "stamina"].filter(hasStat).map((stat) => ({ id: `stat:${stat}`, label: itemStatLabel(stat), count: groups.filter((group) => resolveItem(group.item).stat === stat).reduce((sum, group) => sum + group.quantity, 0) })),
    ];
  }

  function inventoryGroupMatchesFilter(group, filterId) {
    const item = resolveItem(group.item);
    if (!filterId || filterId === "all") return true;
    if (filterId === "equipment" || filterId === "consumable") return item.kind === filterId;
    if (filterId.startsWith("stat:")) return item.stat === filterId.slice(5);
    return group.category === filterId;
  }

  global.InventoryHelpers = { inventoryItemIdentity, inventoryItemCategory, groupedInventoryItems, groupedInventoryByCategory, groupedOwnedInventoryItems, groupedOwnedInventoryByCategory, inventoryOwnershipSummary, categories: INVENTORY_CATEGORY_DEFINITIONS };

  function itemImageFallbackSvg() {
    return `<svg viewBox="0 0 32 32"><path d="M6 9h20v17H6z"/><path d="m9 23 5-6 4 4 3-3 2 5"/><circle cx="20" cy="14" r="2"/></svg>`;
  }

  global.handleItemImageError = function handleItemImageError(image) {
    if (!image || image.dataset.fallbackApplied) return;
    image.dataset.fallbackApplied = "true";
    image.removeAttribute("src");
    image.setAttribute("hidden", "");
    const wrapper = image.closest(".item-icon");
    if (wrapper) wrapper.classList.add("item-icon--fallback");
  };


  function equipmentBadgeMarkup(equipment, className = "") {
    if (!equipment) return "";
    const resolvedEquipment = resolveItem(equipment);
    const label = `Oggetto equipaggiato: ${resolvedEquipment.name || "oggetto"}`;
    const classes = ["equipment-badge", "mobile-equipment-badge", className].filter(Boolean).join(" ");
    return `<span class="${classes}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${itemIcon(resolvedEquipment)}</span>`;
  }

  function itemIcon(itemOrId) {
    const item = resolveItem(itemOrId);
    const id = String(item?.id || "");
    const name = item?.name || "Oggetto";
    if (item?.imageUrl) {
      return `<span class="item-icon item-icon--image" aria-label="${escapeHtml(name)}" title="${escapeHtml(name)}"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" onerror="globalThis.handleItemImageError && globalThis.handleItemImageError(this)" />${itemImageFallbackSvg()}</span>`;
    }
    const icons = {
      energy_drink: `<svg viewBox="0 0 32 32"><path d="M11 8h10l-1 18h-8L11 8Z"/><path d="M13 4h6v4h-6z"/><path d="m16 12-3 6h3l-1 6 5-8h-3l1-4z"/></svg>`,
      training_manual: `<svg viewBox="0 0 32 32"><path d="M7 6h13a5 5 0 0 1 5 5v15H11a4 4 0 0 0-4 4V6Z"/><path d="M11 11h9M11 16h7M11 21h8"/></svg>`,
      scout_token: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/><path d="m16 9 2 5 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1 2-5Z"/></svg>`,
      medical_kit: `<svg viewBox="0 0 32 32"><rect x="6" y="10" width="20" height="16" rx="3"/><path d="M12 10V7h8v3M16 14v8M12 18h8"/></svg>`,
      lucky_charm: `<svg viewBox="0 0 32 32"><path d="M16 6c6 0 10 4 10 10 0 7-10 12-10 12S6 23 6 16C6 10 10 6 16 6Z"/><path d="M16 10v12M10 16h12"/></svg>`,
      boots_attack: `<svg viewBox="0 0 32 32"><path d="M7 20c7 1 10-1 12-8l5 4v7H9c-2 0-3-1-2-3Z"/><path d="M20 16h6"/></svg>`,
      boots_control: `<svg viewBox="0 0 32 32"><path d="M7 20c7 1 10-1 12-8l5 4v7H9c-2 0-3-1-2-3Z"/><circle cx="18" cy="19" r="2"/></svg>`,
      boots_defense: `<svg viewBox="0 0 32 32"><path d="M7 20c7 1 10-1 12-8l5 4v7H9c-2 0-3-1-2-3Z"/><path d="M20 13 25 16 20 19Z"/></svg>`,
      keeper_gloves: `<svg viewBox="0 0 32 32"><path d="M10 25V12a3 3 0 0 1 6 0v4-7a3 3 0 0 1 6 0v16H10Z"/><path d="M10 18 6 15"/></svg>`,
      grit_band: `<svg viewBox="0 0 32 32"><path d="M7 12h18v8H7z"/><path d="m10 12 3-5h6l3 5M12 24h8"/></svg>`,
      physical_band: `<svg viewBox="0 0 32 32"><path d="M7 16h18v7H7z"/><path d="M11 16c1-6 9-6 10 0M12 23l-2 4M20 23l2 4"/></svg>`,
      speed_necklace: `<svg viewBox="0 0 32 32"><path d="M8 8c2 9 14 9 16 0"/><path d="m16 17-4 8h8l-4-8Z"/><path d="M6 20h5M21 20h5"/></svg>`,
      stamina_necklace: `<svg viewBox="0 0 32 32"><path d="M8 8c2 9 14 9 16 0"/><circle cx="16" cy="21" r="5"/><path d="M16 18v3l2 2"/></svg>`,
    };
    return `<span class="item-icon item-icon--fallback" aria-label="${escapeHtml(name)}" title="${escapeHtml(name)}">${icons[id] || itemImageFallbackSvg()}</span>`;
  }

  function statIcon(stat) {
    const icons = {
      attack: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M9 12h6"/></svg>`,
      control: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16M7 7l10 10M17 7 7 17"/></svg>`,
      speed: `<svg viewBox="0 0 24 24"><path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z"/></svg>`,
      grit: `<svg viewBox="0 0 24 24"><path d="M12 21c4-2 7-5 7-9 0-3-2-5-4-7 0 3-2 4-3 5-1-2-1-4-1-6-3 2-6 5-6 9 0 4 3 7 7 8Z"/></svg>`,
      physical: `<svg viewBox="0 0 24 24"><path d="M7 13c1-5 4-8 8-7 2 1 3 3 2 5l3 1-2 4-4-1-2 4H7v-6Z"/><path d="M5 14h7"/></svg>`,
      stamina: `<svg viewBox="0 0 24 24"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3 4 4 0 0 1 7 3c0 7-6 10-6 12Z"/><path d="M7 12h3l1-3 2 6 1-3h3"/></svg>`,
      defense: `<svg viewBox="0 0 24 24"><path d="M12 3 19 6v6c0 5-3 8-7 9-4-1-7-4-7-9V6l7-3Z"/><path d="M12 7v10"/></svg>`,
      save: `<svg viewBox="0 0 24 24"><path d="M7 20V8a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v11H7Z"/><path d="M7 14 4 12"/></svg>`,
    };
    return `<span class="detail-stat-icon" aria-hidden="true">${icons[stat] || icons.control}</span>`;
  }

  const STAT_LABELS = {
    attack: "Attacco",
    control: "Controllo",
    speed: "Velocità",
    grit: "Grinta",
    physical: "Fisico",
    stamina: "Resistenza",
    defense: "Difesa",
    save: "Parata",
  };

  let seasonDb = null;
  let activeSeason = null;
  let freeAgentsDb = null;
  let freeAgentsById = new Map();
  let seasonPlayersById = new Map();
  let seasonTeamsById = new Map();
  let playerVisualsById = new Map();
  const PLAYER_IMAGE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='22' fill='%2311213f'/%3E%3Ccircle cx='60' cy='42' r='22' fill='%23ffd34f'/%3E%3Cpath d='M22 108c6-28 24-42 38-42s32 14 38 42' fill='%2385cdf5'/%3E%3C/svg%3E";
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
    inventorySelectedItemId: null,
    inventoryEquipmentPlayerId: null,
    itemRewardSubmitting: false,
    albumCollectionId: null,
    albumTeamId: null,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message) {
    const element = document.createElement("div");
    element.className = "toast";
    element.textContent = message;
    toastRoot.appendChild(element);
    setTimeout(() => element.remove(), 3200);
  }

  function closeModal() {
    const restoreFocusTo = modalRoot._restoreFocusTo;
    const restoreScrollTo = modalRoot._restoreScrollTo;
    modalRoot.innerHTML = "";
    modalRoot._restoreFocusTo = null;
    modalRoot._restoreScrollTo = null;
    if (restoreScrollTo) afterNextPaint(() => restorePageScroll(restoreScrollTo));
    if (restoreFocusTo && typeof restoreFocusTo.focus === "function" && document.contains(restoreFocusTo)) {
      try { restoreFocusTo.focus({ preventScroll: true }); } catch (_) { restoreFocusTo.focus(); }
    }
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
    modalRoot._restoreFocusTo = document.activeElement;
    modalRoot._restoreScrollTo = preserveScroll || scrollSnapshot();
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal ${className}">
          ${closeable ? '<button type="button" class="modal-close" data-close-modal aria-label="Chiudi">✕</button>' : ""}
          ${content}
        </section>
      </div>`;
    modalRoot.querySelector("[data-close-modal]")?.addEventListener("click", () => {
      closeModal();
      if (onClose) onClose();
    });
    const modal = modalRoot.querySelector(".modal");
    resetRenderedViewScroll(modal);
    if (preserveScroll) afterNextPaint(() => restorePageScroll(preserveScroll));
    afterNextPaint(() => modalRoot.querySelector("[data-close-modal]")?.focus?.({ preventScroll: true }));
  }

  function formationById(id) {
    return seasonDb.formations.eleven.find((formation) => formation.id === id);
  }

  function fiveRoleForPlayerId(playerId) {
    const entry = rosterEntry(playerId);
    return entry ? sourcePlayer(entry)?.position : null;
  }

  function ensureFiveVFive() {
    if (!run || !run.roster?.length) return null;
    return global.FiveVFive.ensure(run, fiveRoleForPlayerId, fiveOverallForPlayerId);
  }

  function fiveOverallForPlayerId(playerId) {
    return resolvedRosterPlayer(playerId)?.overall || 0;
  }

  function fiveVFiveStatus() {
    ensureFiveVFive();
    return global.FiveVFive.validate(run, fiveRoleForPlayerId);
  }

  function sourcePlayer(entryOrId, preferredSource) {
    const id = String(entryOrId && typeof entryOrId === "object" ? entryOrId.playerId : entryOrId);
    const source = preferredSource || (entryOrId && entryOrId.source);
    if (global.SeasonRegistry?.isSeasonSource?.(source)) return global.SeasonRegistry.player(id, source);
    return seasonPlayersById.get(id) || freeAgentsById.get(id);
  }

  function rosterEntry(playerId) {
    return run.roster.find((entry) => String(entry.playerId) === String(playerId));
  }

  function ensureRunSchema() {
    if (!run) return;
    run.inventory = Array.isArray(run.inventory) ? run.inventory : [];
    run.teamIdentity = normalizeTeamIdentity(run.teamIdentity);
    syncRunTeamIdentity();
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
      const maxBoost = source ? Math.max(0, 99 - Number(source.finalOverall || 0)) : Number.POSITIVE_INFINITY;
      const potentialBoostApplications = global.InazumaProgression.normalizePotentialBoostApplications(entry, maxBoost);
      const potentialBoost = potentialBoostApplications.reduce((sum, boost) => sum + boost.amount, 0);
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

  function resolvedRosterPlayer(playerId) {
    const entry = rosterEntry(playerId);
    if (!entry) return null;
    const player = sourcePlayer(entry);
    const database = global.SeasonRegistry?.isSeasonSource?.(entry.source) ? (global.SeasonRegistry.database(entry.source) || seasonDb) : freeAgentsDb;
    const resolved = global.InazumaProgression.getPlayerAtLevel(
      player,
      Math.floor(Number(entry.level || 0)),
      database,
      { potentialBoost: entry.potentialBoost, currentOverallBoost: entry.currentOverallBoost, potentialBoostApplications: entry.potentialBoostApplications }
    );
    const effectiveStats = global.RoguelikeRules.applyEquipment(resolved.stats, entry.equippedItem);
    return {
      ...resolved,
      ...effectiveStats,
      stats: effectiveStats,
      baseStats: resolved.stats,
      equipment: entry.equippedItem,
      displayLevel: Number(entry.level || 0),
      source: entry.source,
    };
  }

  function hearts() {
    return Array.from({ length: global.RunState?.runLivesLimit?.() ?? global.SEASON1_CONFIG.startingLives }, (_, index) =>
      index < run.lives ? "♥" : "♡"
    ).join(" ");
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

  function topbar(title) {
    const identity = run ? normalizeTeamIdentity(run.teamIdentity) : null;
    return `
      <header class="topbar game-topbar">
        <div class="topbar-title-group">${sectionRootButton("run")}<div class="topbar-brand-block"><div class="brand">⚡ ${escapeHtml(title || "Inazuma Roguelike")}</div>${identity ? `<span class="topbar-subtitle">${escapeHtml(identity.name)}</span>` : ""}</div></div>
        <div class="status-strip" aria-label="Stato run">
          <span class="status-pill">Lv ${escapeHtml(run.teamLevel)}</span>
          <span class="status-pill">OVR ${escapeHtml(averageOverall())}</span>
          <span class="status-pill lives" title="Vite">${hearts()}</span>
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
        const destination = button.dataset.nav;
        if (destination === "map") {
          return resumePostBossFlowOrMap();
        } else if (destination === "squad") {
          ensurePostBossFlow({ clearMatch: true });
          run.phase = "squad";
          global.RunState.save(run);
          renderSquad();
        } else if (destination === "inventory") {
          renderInventory();
        } else if (destination === "five") {
          renderFiveVFive();
        }
      });
    });
  }

  function cssEscape(value) {
    if (global.CSS && typeof global.CSS.escape === "function") return global.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function playerImageCandidates(player, playerId = player?.playerId) {
    const id = playerId != null ? String(playerId) : "";
    const globalVisual = id ? (playerVisualsById.get(id) || {}) : {};
    const seasonalFront = player?.frontFullbodyUrl || player?.fullbodyUrl || null;
    const globalFront = globalVisual.frontFullbodyUrl || globalVisual.fullbodyUrl || null;
    const seasonalPortrait = player?.portraitUrl || null;
    const globalPortrait = globalVisual.portraitUrl || globalVisual.imageUrl || null;
    const compatibleImage = player?.image || player?.imageUrl || globalVisual.image || globalVisual.imageUrl || null;
    const portraitUrl = seasonalPortrait || globalPortrait || compatibleImage || null;
    const frontFullbodyUrl = seasonalFront || globalFront || null;
    return { playerId: id, portraitUrl, frontFullbodyUrl, seasonalPortrait, globalPortrait, compatibleImage, seasonalFront, globalFront };
  }

  function resolvePlayerVisual(player, { playerId = player?.playerId, placeholder = PLAYER_IMAGE_PLACEHOLDER } = {}) {
    const visual = playerImageCandidates(player, playerId);
    const detailFallbacks = [visual.frontFullbodyUrl, visual.portraitUrl, placeholder].filter(Boolean);
    const cardFallbacks = [visual.portraitUrl, visual.frontFullbodyUrl, placeholder].filter(Boolean);
    return {
      playerId: visual.playerId,
      portraitUrl: visual.portraitUrl,
      frontFullbodyUrl: visual.frontFullbodyUrl,
      detailImageUrl: detailFallbacks[0] || null,
      cardImageUrl: cardFallbacks[0] || null,
      detailFallbacks,
      cardFallbacks,
      detailImageKind: visual.frontFullbodyUrl ? "fullbody" : (visual.portraitUrl ? "portrait" : "placeholder"),
      cardImageKind: visual.portraitUrl ? "portrait" : (visual.frontFullbodyUrl ? "fullbody" : "placeholder"),
    };
  }

  function imageFallbackAttributes(urls, handler = "globalThis.handlePlayerImageError") {
    const unique = [...new Set((urls || []).filter(Boolean))];
    return `data-image-fallbacks="${escapeHtml(JSON.stringify(unique))}" data-image-fallback-index="0" onerror="${handler} && ${handler}(this)"`;
  }

  function handlePlayerImageError(img) {
    if (!img || img.dataset.imageFallbackDone === "true") return;
    let fallbacks = [];
    try { fallbacks = JSON.parse(img.dataset.imageFallbacks || "[]"); } catch (_) { fallbacks = []; }
    const current = Number(img.dataset.imageFallbackIndex || 0);
    const next = current + 1;
    if (fallbacks[next]) {
      img.dataset.imageFallbackIndex = String(next);
      img.src = fallbacks[next];
      return;
    }
    img.dataset.imageFallbackDone = "true";
    img.onerror = null;
    if (img.src !== PLAYER_IMAGE_PLACEHOLDER) img.src = PLAYER_IMAGE_PLACEHOLDER;
  }
  global.handlePlayerImageError = handlePlayerImageError;

  function playerPortraitUrl(player) {
    return resolvePlayerVisual(player).cardImageUrl || PLAYER_IMAGE_PLACEHOLDER;
  }

  function compactPlayerCardMarkup(player, { equipment = null, equipmentInFooter = false, level = player.displayLevel ?? 0, overall = player.overall ?? player.finalOverall, selected = false, dataAttr = "", extraClass = "", detailLayout = "inline" } = {}) {
    const playerRole = player.position || player.normalizedRole || "-";
    const equipmentDefinition = equipment ? resolveItem(equipment) : null;
    const equipmentMarkup = equipmentDefinition
      ? `<span class="player-corner player-equipment ${equipmentInFooter ? "player-equipment--footer" : ""}" aria-label="Oggetto equipaggiato: ${escapeHtml(equipmentDefinition.name)}" title="${escapeHtml(equipmentDefinition.name)}">${itemIcon(equipment)}</span>`
      : "";
    const detailMarkup = detailLayout === "stacked"
      ? `<div class="player-meta player-meta--stacked" aria-label="Dettagli giocatore"><div class="player-meta-line player-meta-line--role-overall"><span data-player-role>${escapeHtml(playerRole)}</span><span aria-hidden="true">•</span><span data-player-overall>${escapeHtml(overall)}</span></div><div class="player-meta-line player-meta-line--level"><span aria-hidden="true">•</span><span data-player-level>Lv ${escapeHtml(level)}</span></div></div>`
      : `<div class="player-meta" aria-label="Dettagli giocatore"><span>${escapeHtml(playerRole)}</span><span>${escapeHtml(overall)}</span><span>Lv ${escapeHtml(level)}</span></div>`;
    return `
      <button type="button" class="player-card player-card-compact tactical-player-card tactical-player-card--desktop tactical-player-card--mobile mini-player ${escapeHtml(extraClass)} ${rarityClass(player.category)} ${equipment ? "has-equipment" : ""} ${selected ? "selected" : ""}" ${dataAttr}>
        <span class="player-corner player-role" aria-label="Ruolo ${escapeHtml(playerRole)}">${escapeHtml(playerRole)}</span>
        <span class="player-corner player-overall" aria-label="Overall ${overall}">${overall}</span>
        <div class="player-portrait-wrap">
          <img class="player-portrait" src="${escapeHtml(playerPortraitUrl(player))}" alt="" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} />
        </div>
        <div class="player-info">
          <div class="player-title"><strong title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>${equipmentInFooter ? equipmentMarkup : ""}</div>
          ${detailMarkup}
        </div>
        ${equipmentInFooter ? "" : equipmentMarkup}
        <span class="player-corner player-level" aria-label="Livello ${escapeHtml(level)}">Lv ${escapeHtml(level)}</span>
      </button>`;
  }

  function playerCard(player, options = {}) {
    const database = options.database || freeAgentsDb;
    const level = Number(options.level ?? 0);
    const pullSelection = options.context === "pull";
    const resolved = global.InazumaProgression.getPlayerAtLevel(
      player,
      Math.floor(level),
      database
    );
    const tag = options.button ? "button" : "article";
    const attributes = options.button
      ? `type="button" data-player-id="${escapeHtml(player.playerId)}"`
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

  function teamLogoMarkup(teamIdentity) {
    if (teamIdentity?.logoUrl) return `<img src="${escapeHtml(teamIdentity.logoUrl)}" alt="${escapeHtml(teamIdentity.name)}" loading="lazy" />`;
    if (teamIdentity?.logo === "inazuma-lightning") return inazumaLogoMarkup("inazuma-logo--small");
    return `<span class="team-logo-placeholder" aria-hidden="true">⚽</span>`;
  }

  function playerTeamIdentity(player, playerId) {
    const entry = playerId ? rosterEntry(playerId) : null;
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

  function playerDetailMarkup(player, { playerId = player?.playerId, level = player?.displayLevel ?? 0, database = freeAgentsDb, equipment = null, mode = "current", readOnly = false, team = null, runStats = null, onClose = null, preserveScroll = null, albumUnlocked = false } = {}) {
    if (!player) return "";
    const historical = mode === "historical";
    const albumMode = mode === "album";
    const sourceFallback = historical ? sourcePlayer(playerId, player.recruitmentSource) || sourcePlayer(playerId) || {} : {};
    const mergedVisualPlayer = { ...sourceFallback, ...player };
    const detailVisual = resolvePlayerVisual(mergedVisualPlayer, { playerId });
    const visualFallback = { fullbodyUrl: detailVisual.frontFullbodyUrl, portraitUrl: detailVisual.portraitUrl };
    // Historical fullbody fallback keeps this chain available: fullbodyUrl || player.frontFullbodyUrl || visualFallback.fullbodyUrl.
    // Champion snapshots preserve visuals with: fullbodyUrl: playerVisualsById.get(String(entry.playerId))?.fullbodyUrl || null.
    const teamIdentity = historical
      ? historicalTeamIdentity(player, team, sourceFallback)
      : playerTeamIdentity(player, playerId);
    const teamBadge = teamIdentity.name ? `
      <div class="player-detail-team" aria-label="Squadra ${escapeHtml(teamIdentity.name)}">
        ${teamLogoMarkup(teamIdentity)}
        <strong>${escapeHtml(teamIdentity.name)}</strong>
      </div>` : "";
    const resolved = historical ? {
      ...sourceFallback, ...player,
      name: player.name || sourceFallback.name || String(playerId),
      position: player.role || player.position || sourceFallback.position || "-",
      element: player.element || sourceFallback.element || sourceFallback.type || "-",
      category: player.finalRarity || player.category || sourceFallback.category || "Debole",
      overall: player.finalOverall ?? player.overall ?? null,
      potential: player.finalPotential ?? null,
      stats: player.finalStats || player.stats || {},
      baseStats: player.finalStats || player.stats || {},
    } : (player.stats && player.baseStats ? player : global.InazumaProgression.getPlayerAtLevel(player, Math.floor(Number(level || 0)), database));
    const baseStats = resolved.baseStats || resolved.stats || {};
    const effectiveStats = historical ? (resolved.stats || {}) : (albumMode ? (resolved.stats || {}) : (resolved.baseStats ? resolved.stats : (equipment ? global.RoguelikeRules.applyEquipment(resolved.stats, equipment) : resolved.stats)));
    const stats = Object.entries(STAT_LABELS).map(([stat, label]) => {
      const base = Number(baseStats[stat] || 0);
      const effective = Number(effectiveStats?.[stat] || 0);
      const bonus = (historical || albumMode) ? 0 : effective - base;
      return `<div class="detail-stat player-stat-card">${statIcon(stat)}<span class="detail-stat-label">${label}</span><strong class="detail-stat-value">${effective}</strong>${bonus > 0 ? `<em class="detail-stat-bonus">+${bonus}</em>` : ""}</div>`;
    }).join("");
    const potential = historical ? (resolved.potential ?? "Non disponibile") : (resolved.potential ?? player.finalOverall);
    const origin = historical && team?.teamName ? `<p class="muted player-history-origin">Rosa campione: ${escapeHtml(team.teamName)}${player.recruitmentSource ? ` · Origine: ${escapeHtml(player.recruitmentSource)}` : ""}</p>` : "";
    const equipmentMarkup = equipment ? `<div class="equipped-detail">${itemIcon(equipment)}<div class="equipped-detail-copy"><span>${historical ? "Equipaggiamento storico" : "Oggetto assegnato"}</span><strong>${escapeHtml(resolveItem(equipment).name)}</strong><small>${escapeHtml(resolveItem(equipment).description)}</small><em>+${Number(resolveItem(equipment).bonus || 0)} ${escapeHtml(STAT_LABELS[resolveItem(equipment).stat] || resolveItem(equipment).stat || "")}</em></div>${!readOnly && playerId ? `<button type="button" class="btn btn-ghost" data-detail-unequip="${escapeHtml(playerId)}">Rimuovi oggetto</button>` : ""}</div>` : `<p class="muted equipped-detail-empty">Nessun equipaggiamento.</p>`;
    return `
      <div class="player-detail-layout ${rarityClass(resolved.category)} ${historical ? "player-detail-historical" : ""}">
        <section class="player-detail-visual ${rarityClass(resolved.category)}">${teamBadge}${detailVisual.detailImageUrl ? `<img class="player-fullbody player-fullbody--${escapeHtml(detailVisual.detailImageKind)}" src="${escapeHtml(detailVisual.detailImageUrl)}" alt="${escapeHtml(resolved.name)}" loading="lazy" ${imageFallbackAttributes(detailVisual.detailFallbacks)} />` : `<span class="player-fullbody player-fullbody-placeholder" aria-hidden="true">⚽</span>`}</section>
        <section class="player-detail-content">
          <p class="eyebrow">${albumMode ? "Player detail · Album" : (historical ? "Player detail · Squadra campione" : "Player detail")}</p>${albumMode ? `<span class="role-chip album-detail-badge">${albumUnlocked ? "SBLOCCATO" : "NON SBLOCCATO"}</span>` : ""}
          <h2 class="player-detail-name">${escapeHtml(resolved.name)}</h2>
          <div class="player-detail-tags"><span class="role-chip">${escapeHtml(resolved.position)}</span><span class="role-chip detail-element-chip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 3 7 6 7 10a7 7 0 0 1-14 0c0-4 3-7 7-10Z"/></svg>${escapeHtml(resolved.element || resolved.type || "-")}</span><span class="role-chip">Lv ${escapeHtml(historical ? (player.finalLevel ?? "N/D") : Number(level || 0))}</span></div>
          <div class="overall-comparison"><div><span>Overall attuale</span><strong>${escapeHtml(resolved.overall ?? "N/D")}</strong></div><div><span>Potenziale</span><strong>${escapeHtml(potential)}</strong></div></div>
          <p class="detail-category"><span aria-hidden="true">★</span>${escapeHtml(resolved.category)}</p>
          <div class="detail-stats">${stats}</div>${albumMode ? "" : equipmentMarkup}${historical ? playerStatsMarkup(team || {}, player, runStats) : ""}${origin}
        </section>
      </div>`;
  }

  function showPlayerDetailsFor(player, options = {}) {
    if (!player) return toast("Giocatore non disponibile");
    const opts = { playerId: player.playerId, level: player.displayLevel ?? 0, database: freeAgentsDb, equipment: null, onClose: null, ...options };
    openModal(playerDetailMarkup(player, opts), { closeable: true, className: "player-detail-modal", onClose: opts.onClose, preserveScroll: opts.preserveScroll });
    if (!opts.readOnly) modalRoot.querySelector("[data-detail-unequip]")?.addEventListener("click", () => unequipPlayerItem(opts.playerId, { render: () => { closeModal(); renderSquad(); } }));
  }

  function showPlayerDetails(playerId, onClose = null) {
    const entry = rosterEntry(playerId);
    const player = resolvedRosterPlayer(playerId);
    if (!entry || !player) return toast("Giocatore non disponibile");
    showPlayerDetailsFor(player, {
      playerId,
      level: player.displayLevel,
      database: global.SeasonRegistry?.isSeasonSource?.(entry.source) ? (global.SeasonRegistry.database(entry.source) || seasonDb) : freeAgentsDb,
      equipment: player.equipment,
      onClose,
    });
  }


  function albumHallTeams() {
    return (global.HallOfFameStorage?.listSummaries?.() || []).map((summary) => global.HallOfFameStorage.getTeam(summary.hallTeamId)).filter(Boolean);
  }

  function ensureAlbumBackfill() {
    return global.AlbumProgress?.backfillAlbumProgress?.({ run, hallTeams: albumHallTeams() }) || 0;
  }

  function unlockAlbumRecruit(playerId, source) {
    return global.AlbumProgress?.unlockAlbumPlayer?.(run?.seasonId || global.AlbumProgress.DEFAULT_COLLECTION_ID, playerId, { source }) || false;
  }

  function albumCollectionPlayers(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    const db = global.SeasonRegistry.database(collectionId) || seasonDb;
    const byId = new Map();
    (db?.players || []).forEach((player) => byId.set(String(player.playerId), { ...player, albumDatabase: db }));
    (freeAgentsDb?.players || []).forEach((player) => { if (!byId.has(String(player.playerId))) byId.set(String(player.playerId), { ...player, albumDatabase: freeAgentsDb }); });
    return [...byId.values()];
  }

  function albumCollectionProgress(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    ensureAlbumBackfill();
    const unlocked = global.AlbumProgress.unlockedSet(collectionId);
    const totalIds = new Set(albumCollectionPlayers(collectionId).map((player) => String(player.playerId)));
    return { unlocked: [...totalIds].filter((id) => unlocked.has(id)).length, total: totalIds.size };
  }

  function albumTeamLogoMarkup(team) {
    if (team?.logoUrl) return `<img src="${escapeHtml(team.logoUrl)}" alt="${escapeHtml(team.teamName || team.name)}" loading="lazy" decoding="async" />`;
    return `<span class="album-free-agent-logo" aria-hidden="true">⚽</span>`;
  }

  function homeAlbumCardMarkup() {
    const progress = albumCollectionProgress();
    return `<article class="home-hub-card album-home-card" aria-label="Album">
      <div class="home-card-kicker"><span>▣</span><strong>ALBUM</strong></div>
      <h2>Album</h2>
      <p class="muted">Completa la collezione dei giocatori.</p>
      <div class="stat-grid home-stat-grid"><div class="stat-card"><span>Inazuma Eleven 1</span><strong>${escapeHtml(progress.unlocked)} / ${escapeHtml(progress.total)}</strong></div></div>
      <div class="home-card-actions"><button type="button" class="btn btn-yellow" id="open-album-home">Apri Album</button></div>
    </article>`;
  }

  function albumProgressForPlayers(players, collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    const unlocked = global.AlbumProgress.unlockedSet(collectionId);
    const ids = [...new Set((players || []).map((player) => String(player.playerId)))];
    return { unlocked: ids.filter((id) => unlocked.has(id)).length, total: ids.length };
  }

  function albumPlayerView(player, database) {
    const final = global.InazumaProgression.getPlayerAtLevel(player, Number(player.maxLevel || 20), database);
    return { ...player, overall: player.finalOverall ?? final.overall, finalOverall: player.finalOverall ?? final.overall, category: player.category || final.category, stats: player.finalStats || final.stats, baseStats: player.finalStats || final.stats, displayLevel: Number(player.maxLevel || 20), albumDatabase: database };
  }

  function albumProgressPercent(progress) {
    const unlocked = Number(progress?.unlocked);
    const total = Number(progress?.total);
    const safeUnlocked = Number.isFinite(unlocked) ? Math.max(0, unlocked) : 0;
    const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
    if (safeTotal <= 0) return 0;
    return Math.min(100, Math.max(0, (safeUnlocked / safeTotal) * 100));
  }

  function renderAlbumCollections() {
    run = global.RunState.load();
    ensureRunSchema();
    ensureAlbumBackfill();
    app.innerHTML = `<main class="album-screen"><header class="topbar album-topbar"><div><p class="eyebrow">Album</p><h1>Collezioni</h1><p class="muted">Progressi permanenti, separati dalla run attiva.</p></div>${sectionRootButton("albumRoot")}</header><section class="album-collection-grid">${Object.values(global.AlbumProgress.ALBUM_COLLECTIONS).map((collection) => { const progress = albumCollectionProgress(collection.id); const percent = albumProgressPercent(progress); const percentLabel = `${Math.round(percent)}%`; const coverUrl = collection.coverUrl || ""; return `<button type="button" class="panel album-collection-card" data-album-collection="${escapeHtml(collection.id)}" aria-label="Apri collezione ${escapeHtml(collection.name)}: ${escapeHtml(progress.unlocked)} su ${escapeHtml(progress.total)} giocatori sbloccati, ${escapeHtml(percentLabel)}"><span class="album-collection-cover"><img src="${escapeHtml(coverUrl)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true; this.parentElement.classList.add('is-fallback');" /></span><span class="album-collection-content"><span class="album-collection-kicker">COLLEZIONE</span><span class="album-collection-title">${escapeHtml(collection.name)}</span><span class="album-collection-subtitle">Collezione giocatori</span><span class="album-collection-progress-copy"><span>${escapeHtml(progress.unlocked)} / ${escapeHtml(progress.total)} giocatori sbloccati</span><strong>${escapeHtml(percentLabel)}</strong></span><span class="album-collection-progress-bar" aria-hidden="true"><span style="width: ${percent}%"></span></span><span class="album-collection-action">Apri collezione <span aria-hidden="true">→</span></span></span></button>`; }).join("")}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();
    document.querySelectorAll("[data-album-collection]").forEach((button) => button.addEventListener("click", () => renderAlbumTeams(button.dataset.albumCollection)));
  }

  function albumTeamsView() {
    const teams = (seasonDb?.bossOrder?.length ? seasonDb.bossOrder.map((boss) => seasonTeamsById.get(String(boss.teamId))).filter(Boolean) : (seasonDb?.teams || []));
    const freeAgentsTeam = { teamId: "__free_agents", teamName: "Svincolati", logoUrl: null, playerIds: (freeAgentsDb?.players || []).map((player) => String(player.playerId)), freeAgents: true };
    return [...teams, freeAgentsTeam];
  }

  async function renderAlbumTeams(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    await loadSeason(collectionId);
    ui.albumCollectionId = collectionId;
    const collection = global.AlbumProgress.ALBUM_COLLECTIONS[collectionId];
    ensureAlbumBackfill();
    app.innerHTML = `<main class="album-screen"><header class="topbar album-topbar"><div><p class="eyebrow">Album → ${escapeHtml(collection.name)}</p><h1>Squadre</h1></div>${sectionRootButton("albumCollection")}</header><section class="album-team-grid">${albumTeamsView().map((team) => { const players = team.freeAgents ? (freeAgentsDb?.players || []) : (team.playerIds || []).map((id) => seasonPlayersById.get(String(id))).filter(Boolean); const progress = albumProgressForPlayers(players, collectionId); const complete = progress.total > 0 && progress.unlocked === progress.total; return `<button type="button" class="panel album-team-card ${complete ? "album-complete" : ""}" data-album-team="${escapeHtml(team.teamId)}" aria-label="${escapeHtml(team.teamName)} ${progress.unlocked} su ${progress.total}"><span class="album-team-logo">${albumTeamLogoMarkup(team)}</span><strong>${escapeHtml(team.teamName)}</strong><span>${escapeHtml(progress.unlocked)} / ${escapeHtml(progress.total)}</span>${complete ? `<em>Completato</em>` : ""}</button>`; }).join("")}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav({ collectionId });
    document.querySelectorAll("[data-album-team]").forEach((button) => button.addEventListener("click", () => renderAlbumRoster(collectionId, button.dataset.albumTeam)));
  }

  function renderAlbumRoster(collectionId, teamId) {
    ui.albumCollectionId = collectionId; ui.albumTeamId = teamId;
    const team = albumTeamsView().find((candidate) => String(candidate.teamId) === String(teamId));
    if (!team) return renderAlbumTeams(collectionId);
    const rawPlayers = team.freeAgents ? (freeAgentsDb?.players || []) : (team.playerIds || []).map((id) => seasonPlayersById.get(String(id))).filter(Boolean);
    const players = rawPlayers.map((player) => albumPlayerView(player, team.freeAgents ? freeAgentsDb : seasonDb));
    const progress = albumProgressForPlayers(players, collectionId);
    const unlocked = global.AlbumProgress.unlockedSet(collectionId);
    app.innerHTML = `<main class="album-screen album-roster-screen"><header class="topbar album-topbar album-roster-header"><div class="album-roster-title"><span class="album-team-logo album-team-logo--header album-roster-logo">${albumTeamLogoMarkup(team)}</span><div class="album-roster-heading"><p class="eyebrow album-roster-breadcrumb">Album → ${escapeHtml(global.AlbumProgress.ALBUM_COLLECTIONS[collectionId]?.name || collectionId)}</p><h1 class="album-roster-name">${escapeHtml(team.teamName)}</h1><p class="muted album-roster-progress">${escapeHtml(progress.unlocked)} / ${escapeHtml(progress.total)} giocatori sbloccati</p></div></div>${sectionRootButton("albumRoster", "album-roster-action")}</header><section class="album-player-grid" data-album-roster>${players.map((player) => { const isUnlocked = unlocked.has(String(player.playerId)); return `<div class="album-player-entry ${isUnlocked ? "is-unlocked" : "is-locked"}" data-album-player-entry="${escapeHtml(player.playerId)}" data-album-unlocked="${isUnlocked ? "true" : "false"}">${playerCard(player, { button: true, level: player.maxLevel || 20, database: player.albumDatabase }).replace('data-player-id=', 'data-album-player=')}${isUnlocked ? "" : `<span class="album-lock-overlay album-player-lock"><span aria-hidden="true">🔒</span>Non sbloccato</span>`}</div>`; }).join("")}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav({ collectionId });
    document.querySelector("[data-album-roster]").addEventListener("click", (event) => { const button = event.target.closest("[data-album-player]"); if (!button) return; const player = players.find((candidate) => String(candidate.playerId) === String(button.dataset.albumPlayer)); if (!player) return; const isUnlocked = unlocked.has(String(player.playerId)); showPlayerDetailsFor(player, { mode: "album", readOnly: true, playerId: player.playerId, level: player.maxLevel || 20, database: player.albumDatabase, equipment: null, preserveScroll: scrollSnapshot(), albumUnlocked: isUnlocked }); });
  }

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

  function syncRunTeamIdentity(identity = savedTeamIdentity()) {
    if (!run || !identity) return false;
    const cleanIdentity = normalizeTeamIdentity(identity);
    if (run.teamIdentity?.name === cleanIdentity.name && run.teamIdentity?.logo === cleanIdentity.logo) return false;
    run.teamIdentity = cleanIdentity;
    return true;
  }

  function migrateTeamIdentityProfile() {
    const profileIdentity = savedTeamIdentity();
    if (profileIdentity) {
      if (syncRunTeamIdentity(profileIdentity)) global.RunState.save(run);
      return profileIdentity;
    }
    const legacyName = run ? global.RunState.validTeamName(run.teamIdentity?.name) : "";
    if (!legacyName) return null;
    const migrated = global.RunState.saveProfileTeamIdentity({ name: legacyName, logo: "inazuma-lightning" });
    if (syncRunTeamIdentity(migrated)) global.RunState.save(run);
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

  function runFormationLabel(savedRun) {
    const formation = seasonDb?.formations?.eleven?.find((item) => item.id === savedRun?.formationId);
    return formation?.formation || formation?.name || savedRun?.formationId || "Da scegliere";
  }

  function runHeartsMarkup(savedRun) {
    const maxLives = Number(global.RunState?.runLivesLimit?.() ?? global.SEASON1_CONFIG.maxRunLives ?? global.SEASON1_CONFIG.startingLives ?? 2);
    return Array.from({ length: maxLives }, (_, index) => index < Number(savedRun?.lives || 0) ? "♥" : "♡").join(" ");
  }

  function runAverageOverall(savedRun) {
    const players = (savedRun?.roster || []).map((entry) => resolvedRosterPlayer(entry.playerId || entry.id)).filter(Boolean);
    return averageOverall(players);
  }

  function homeZoneProgress(savedRun) {
    const zone = savedRun?.currentZone;
    if (!zone?.nodes?.length) return 0;
    const currentNode = zone.nodes.find((node) => node.id === zone.currentNodeId);
    const finalLayer = Math.max(1, ...zone.nodes.map((node) => Number(node.layer || 0)));
    return Math.max(0, Math.min(100, Math.round((Number(currentNode?.layer || 0) / finalLayer) * 100)));
  }

  function homePlayerCardMarkup(entry) {
    const player = resolvedRosterPlayer(entry.playerId || entry.id);
    if (!player) return "";
    const level = Number(entry.level ?? player.displayLevel ?? 0);
    const overall = player.overall ?? player.finalOverall ?? "-";
    const role = player.position || player.normalizedRole || "-";
    const equipment = entry.equippedItem || null;
    return `<article class="home-player-card ${rarityClass(player.category)} ${equipment ? "has-equipment" : ""}" aria-label="${escapeHtml(player.name)}, ${escapeHtml(role)}, overall ${escapeHtml(overall)}, livello ${escapeHtml(level)}">
      <div class="home-player-portrait"><img src="${escapeHtml(playerPortraitUrl(player))}" alt="${escapeHtml(player.name)}" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} /></div>
      <span class="home-player-role">${escapeHtml(role)}</span>
      <span class="home-player-overall">${escapeHtml(overall)}</span>
      <div class="home-player-copy"><strong title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong><small>${escapeHtml(player.category || "Debole")} · Lv ${escapeHtml(level)}</small></div>
      ${equipment ? `<span class="home-player-equipment" aria-label="Equipaggiamento: ${escapeHtml(resolveItem(equipment).name)}" title="${escapeHtml(resolveItem(equipment).name)}">${itemIcon(equipment)}</span>` : ""}
    </article>`;
  }

  function homeRosterMarkup(savedRun) {
    // Historical selector retained for the repository smoke contract: class="home-avatar"
    const preview = savedRosterEntries(savedRun).slice(0, 5).map(homePlayerCardMarkup).filter(Boolean);
    return preview.length ? preview.join("") : `<p class="home-roster-empty">La rosa verrà mostrata dopo il draft iniziale.</p>`;
  }

  const HOME_SECONDARY_ACTIONS = [
    { id: "open-album-home", label: "Album", icon: "▤", className: "" },
    { id: "open-hall-home", label: "Albo d’Oro", icon: "★", className: "home-quick-button--gold" },
    { id: "open-modes-home", label: "Modalità", icon: "⚡", className: "" },
  ];

  function homeQuickActionsMarkup() {
    const actions = HOME_SECONDARY_ACTIONS.map(({ id, label, icon, className }) => `
      <button type="button" class="home-quick-button ${className}" id="${id}">
        <span aria-hidden="true">${icon}</span><strong>${label}</strong>
      </button>`).join("");
    return `<nav class="home-quick-actions" aria-label="Sezioni principali">${actions}</nav>`;
  }

  function homeTeamCrestMarkup(identity) {
    if (identity?.logoUrl) return `<img src="${escapeHtml(identity.logoUrl)}" alt="${escapeHtml(identity.name)}" loading="lazy" />`;
    return `<span class="home-crest-fallback" aria-hidden="true">IR</span>`;
  }

  function homeActiveRunMarkup(savedRun) {
    // Historical smoke-test signature: class="home-hub-card home-run-card"
    const identity = normalizeTeamIdentity(savedRun.teamIdentity);
    const bossIndex = Number(savedRun.bossIndex || 0);
    const boss = seasonDb?.bossOrder?.[bossIndex];
    const bossNumber = bossIndex + 1;
    const totalBosses = seasonDb?.bossOrder?.length || 10;
    const zoneProgress = homeZoneProgress(savedRun);
    const bossLogo = bossTeamLogoUrl(boss);
    return `<section class="home-hero home-active-dashboard" aria-label="Home con run attiva">
      <div class="home-team-banner anime-panel">
        <div class="home-team-crest">${homeTeamCrestMarkup(identity)}</div>
        <div class="home-team-copy"><p>${escapeHtml(seasonDisplayName(savedRun.seasonId))}</p><h1>${escapeHtml(identity.name)}</h1><span>Stagione ${escapeHtml((savedRun.seasonId || "1").match(/\d+/)?.[0] || "1")}</span></div>
        <button type="button" class="home-team-manage" id="manage-team-home">Gestisci squadra</button>
      </div>
      <article class="home-hub-card home-run-card home-run-panel anime-panel">
        <div class="home-panel-kicker"><span>⚡</span> Run in corso</div>
        <div class="home-next-boss">
          <div class="home-boss-identity">
            <small>Prossimo boss</small>
            <span class="home-boss-logo">${bossLogo ? `<img src="${escapeHtml(bossLogo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><b hidden aria-hidden="true">B</b>` : "B"}</span>
            <strong>${escapeHtml(boss?.teamName || "Raimon")}</strong>
          </div>
          <div class="home-stage"><small>Stage</small><strong>${escapeHtml(Math.min(bossNumber, totalBosses))}<em>/${escapeHtml(totalBosses)}</em></strong></div>
        </div>
        <div class="home-run-stats">
          <span><small>Media team</small><strong>${escapeHtml(runAverageOverall(savedRun))}</strong></span>
          <span><small>Formazione</small><strong>${escapeHtml(runFormationLabel(savedRun))}</strong></span>
          <span class="home-zone-stat"><small>Progresso zona</small><strong>${escapeHtml(zoneProgress)}%</strong><i><b style="width:${zoneProgress}%"></b></i></span>
        </div>
      </article>
      <button type="button" class="home-main-cta" id="home-primary-cta"><span aria-hidden="true">⚡</span><strong id="continue-run">Continua la run</strong><span class="home-cta-arrows" aria-hidden="true">»</span></button>
      ${homeQuickActionsMarkup()}
      <section class="home-roster-section" aria-label="La tua squadra">
        <div class="home-section-label"><span>⚡</span> La tua squadra</div>
        <div class="home-roster-preview">${homeRosterMarkup(savedRun)}</div>
      </section>
    </section>`;
  }

  function homeEmptyRunMarkup() {
    return `<section class="home-hero home-empty-dashboard" aria-label="Home senza run attiva">
      <article class="home-empty-panel anime-panel">
        <div class="home-empty-kicker">Nessuna run attiva</div>
        <div class="home-empty-copy">
          <h1>Scegli la tua prossima sfida</h1>
          <p>Seleziona una run, costruisci la tua squadra e inizia una nuova scalata verso la vittoria.</p>
        </div>
        <ol class="home-empty-steps" aria-label="Come iniziare">
          <li><span>1</span><strong>Scegli la run</strong></li>
          <li><span>2</span><strong>Crea la squadra</strong></li>
          <li><span>3</span><strong>Affronta i boss</strong></li>
        </ol>
        <button type="button" class="home-main-cta" id="home-primary-cta"><span aria-hidden="true">◎</span><strong id="choose-run">Scegli una run</strong><span class="home-cta-arrows" aria-hidden="true">»</span></button>
      </article>
      ${homeQuickActionsMarkup()}
    </section>`;
  }

  function homeRunCardMarkup(savedRun) {
    if (!savedRun) return homeEmptyRunMarkup();
    return homeActiveRunMarkup(savedRun);
  }

  async function renderHome() {
    const latest = global.RunState.latestActiveSave?.();
    if (latest?.run) {
      await loadSeason(latest.run.seasonId || latest.season.id);
      run = global.RunState.load(activeSeason.id);
    } else {
      await loadSeason(global.SeasonRegistry.DEFAULT_SEASON_ID);
      run = null;
    }
    ensureRunSchema();
    migrateTeamIdentityProfile();
    if (run && global.RoguelikeRules.migrateDefeatedBossPlayerLevels(run, seasonDb) > 0) global.RunState.save(run);
    app.innerHTML = `
      <main class="home-screen modern-home" id="clean-home" data-run-state="${run ? "active" : "empty"}">
        <header class="home-masthead">
          <div class="home-wordmark" aria-label="Inazuma Roguelike · Road to Raimon"><span>Ina<span>z</span>uma</span><small>Roguelike</small><i class="home-road-label">Road to Raimon</i></div>
          ${run ? `<div class="home-status-badges"><span><i>⚡</i><strong>${escapeHtml(run.lives ?? "-")}/${escapeHtml(global.RunState?.runLivesLimit?.() ?? 2)}</strong><small>Vite</small></span><span><i>LV</i><strong>${escapeHtml(run.teamLevel || 0)}</strong><small>Livello team</small></span></div>` : ""}
        </header>
        ${homeRunCardMarkup(run)}
      </main>`;
    resetRenderedViewScroll();

    document.getElementById("open-modes-home")?.addEventListener("click", renderSeasonSelect);
    document.getElementById("manage-team-home")?.addEventListener("click", resumeRun);
    document.getElementById("home-primary-cta")?.addEventListener("click", () => run ? resumeRun() : renderSeasonSelect());
    document.getElementById("open-hall-home")?.addEventListener("click", renderHallOfFame);
    document.getElementById("open-album-home")?.addEventListener("click", renderAlbumCollections);
    document.getElementById("open-hall-home-empty")?.addEventListener("click", renderHallOfFame);
    document.getElementById("open-hall-home-list")?.addEventListener("click", renderHallOfFame);
    document.getElementById("open-latest-hall-home")?.addEventListener("click", (event) => renderHallOfFameDetail(event.currentTarget.dataset.latestHall));
  }


  async function selectSeason(seasonId, { markPlayed = false } = {}) {
    await loadSeason(seasonId);
    run = global.RunState.load(activeSeason.id);
    ensureRunSchema();
    if (run && markPlayed) global.RunState.touch(run);
    if (run && global.RoguelikeRules.migrateDefeatedBossPlayerLevels(run, seasonDb) > 0) global.RunState.save(run);
  }

  function runTimestamp(run) {
    return Math.max(0, ...[run?.lastPlayedAt, run?.updatedAt, run?.createdAt].map((value) => Date.parse(value || "") || 0));
  }

  function rosterPlayerId(entry) {
    const raw = (entry && typeof entry === "object") ? (entry.playerId ?? entry.id ?? entry.player?.playerId ?? entry.player?.id) : entry;
    const id = String(raw ?? "").trim();
    return id && id !== "null" && id !== "undefined" ? id : "";
  }

  function savedRosterEntries(savedRun) {
    const sourceEntries = Array.isArray(savedRun?.roster) ? savedRun.roster : [];
    const byId = new Map(sourceEntries.map((entry) => [rosterPlayerId(entry), entry]).filter(([id]) => id));
    const orderedEntries = [...(Array.isArray(savedRun?.lineup) ? savedRun.lineup : []), ...(Array.isArray(savedRun?.bench) ? savedRun.bench : [])];
    const orderedIds = orderedEntries.map(rosterPlayerId).filter(Boolean);
    const rosterIds = sourceEntries.map(rosterPlayerId).filter(Boolean);
    const ids = [...new Set([...orderedIds, ...rosterIds])];
    return ids.map((id) => {
      const entry = byId.get(id);
      return entry && typeof entry === "object" ? { ...entry, playerId: id } : { playerId: id, level: savedRun?.teamLevel || 0 };
    });
  }

  function seasonRunAverageOverall(savedRun, database, playersById) {
    const entries = savedRosterEntries(savedRun);
    const overalls = entries.map((entry) => {
      const source = playersById.get(String(entry.playerId));
      if (!source) return null;
      const level = Math.floor(Number(entry.level ?? savedRun?.teamLevel ?? 0));
      return Number(global.InazumaProgression.getPlayerAtLevel(source, level, database)?.overall);
    }).filter(Number.isFinite);
    if (!overalls.length) return "-";
    return Math.round(overalls.reduce((sum, value) => sum + value, 0) / overalls.length);
  }

  function seasonRosterPreviewMarkup(savedRun, database, playersById, normalizedEntries = savedRosterEntries(savedRun)) {
    if (!database || !playersById) return `<div class="season-preview-state season-preview-state--loading">Caricamento rosa…</div>`;
    if (!normalizedEntries.length) return `<div class="season-preview-state">Rosa non disponibile</div>`;
    const cards = normalizedEntries.slice(0, 6).map((entry) => {
      const source = playersById.get(String(entry.playerId));
      if (!source) {
        console.warn("Season roster preview: giocatore non risolto", { seasonId: savedRun?.seasonId, playerId: entry.playerId });
        return "";
      }
      const level = Number(entry.level ?? savedRun?.teamLevel ?? 0);
      const resolved = global.InazumaProgression.getPlayerAtLevel(source, Math.floor(level), database);
      return compactPlayerCardMarkup({ ...source, ...resolved, playerId: source.playerId }, { level, overall: resolved.overall, extraClass: "season-preview-player", detailLayout: "stacked" });
    }).filter(Boolean);
    return cards.length ? cards.join("") : `<div class="season-preview-state">Rosa non disponibile</div>`;
  }

  function seasonSelectCardMarkup({ season, savedRun, database, playersById, isLastPlayed }) {
    const activeSaved = savedRun && global.RunState.isActiveRun(savedRun) ? savedRun : null;
    const identity = activeSaved ? normalizeTeamIdentity(activeSaved.teamIdentity) : null;
    const totalBosses = database?.bossOrder?.length || 0;
    const bossIndex = Math.min(Number(activeSaved?.bossIndex || 0), Math.max(totalBosses - 1, 0));
    const boss = activeSaved ? database?.bossOrder?.[bossIndex] : null;
    const formation = activeSaved ? database?.formations?.eleven?.find((item) => item.id === activeSaved.formationId) : null;
    const normalizedRoster = activeSaved ? savedRosterEntries(activeSaved) : [];
    const average = activeSaved ? seasonRunAverageOverall(activeSaved, database, playersById) : "-";
    const bossStep = activeSaved ? `${Math.min(Number(activeSaved.bossIndex || 0) + 1, totalBosses || 99)}/${totalBosses || "?"}` : "-";
    const actions = activeSaved
      ? `<button type="button" class="btn btn-yellow" data-season-continue="${escapeHtml(season.id)}">Continua run</button><button type="button" class="btn btn-ghost" data-season-new="${escapeHtml(season.id)}">Inizia nuova run</button>`
      : `<button type="button" class="btn btn-yellow" data-season-new="${escapeHtml(season.id)}">Inizia nuova run</button>`;

    if (!activeSaved) {
      return `<article class="home-hub-card season-select-card season-select-card--empty"><div class="season-card-head"><div><h2>${escapeHtml(season.name)}</h2></div><span class="season-status-pill">Nessuna run attiva</span></div><div class="home-card-actions season-card-actions">${actions}</div></article>`;
    }

    const remainingMobilePlayers = Math.max(0, normalizedRoster.length - 4);
    const remainingDesktopPlayers = Math.max(0, normalizedRoster.length - 6);
    const remainingMarkup = `${remainingMobilePlayers ? `<small class="season-more-count season-more-count--mobile">+${escapeHtml(remainingMobilePlayers)} altri</small>` : ""}${remainingDesktopPlayers ? `<small class="season-more-count season-more-count--desktop">+${escapeHtml(remainingDesktopPlayers)} altri</small>` : ""}`;
    return `<article class="home-hub-card season-select-card ${isLastPlayed ? "season-select-card--last" : ""}"><div class="season-card-head"><div><h2>${escapeHtml(season.name)}</h2><p class="season-team-name">${escapeHtml(identity.name || "La tua squadra")}</p></div><div class="season-card-badges"><span class="season-status-pill">Run attiva</span>${isLastPlayed ? `<span class="season-status-pill season-status-pill--last">Ultima giocata</span>` : ""}</div></div><div class="season-run-summary"><span><small>Boss</small><strong>${escapeHtml(boss?.teamName || "-")}</strong> <em>${escapeHtml(bossStep)}</em></span><span><small>Lv</small><strong>${escapeHtml(activeSaved.teamLevel || 0)}</strong></span><span><small>Vite</small><strong>${runHeartsMarkup(activeSaved)}</strong></span><span><small>OVR</small><strong>${escapeHtml(average)}</strong></span><span class="season-run-summary__wide"><small>Modulo</small><strong>${escapeHtml(formation?.name || activeSaved.formationId || "Da scegliere")}</strong></span></div><div class="season-roster-block"><div class="season-section-title"><span>Preview rosa · ${escapeHtml(normalizedRoster.length)} giocatori</span>${remainingMarkup}</div><div class="season-roster-preview">${seasonRosterPreviewMarkup(activeSaved, database, playersById, normalizedRoster)}</div></div><div class="home-card-actions season-card-actions">${actions}</div></article>`;
  }

  async function renderSeasonSelect() {
    await loadSeason(global.SeasonRegistry.DEFAULT_SEASON_ID);
    const seasons = global.SeasonRegistry.list();
    await Promise.all(seasons.map((season) => global.SeasonRegistry.loadDatabase(season.id)));
    const runs = seasons.map((season) => ({ season, savedRun: global.RunState.load(season.id) }));
    const latestTime = Math.max(0, ...runs.filter((entry) => entry.savedRun && global.RunState.isActiveRun(entry.savedRun)).map((entry) => runTimestamp(entry.savedRun)));
    const cards = runs.map(({ season, savedRun }) => seasonSelectCardMarkup({
      season,
      savedRun,
      database: global.SeasonRegistry.database(season.id),
      playersById: global.SeasonRegistry.playersIndex(season.id),
      isLastPlayed: Boolean(savedRun && latestTime && runTimestamp(savedRun) === latestTime),
    })).join("");
    app.innerHTML = `<main class="home-screen modern-home season-select-screen"><header class="season-select-topbar">${sectionRootButton("seasonSelection", "season-select-home-button")}<h1>Seleziona Season</h1><span class="season-select-topbar-spacer" aria-hidden="true"></span></header><section class="home-choice-grid season-choice-grid">${cards}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();
    document.querySelectorAll("[data-season-continue]").forEach((button) => button.addEventListener("click", async () => { await selectSeason(button.dataset.seasonContinue, { markPlayed: true }); resumeRun(); }));
    document.querySelectorAll("[data-season-new]").forEach((button) => button.addEventListener("click", async () => { await selectSeason(button.dataset.seasonNew); startNewRunFromHome(); }));
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

  function startRunWithIdentity(identity) {
    const cleanIdentity = global.RunState.saveProfileTeamIdentity(identity);
    run = global.RunState.createRun(cleanIdentity, activeSeason?.id);
    global.run = run;
    global.RunState.save(run);
    closeModal();
    renderFormationChoice();
  }

  function startNewRunFromHome() {
    const identity = savedTeamIdentity();
    run = global.RunState.load(activeSeason?.id);
    const startConfirmedRun = () => {
      const confirmedIdentity = savedTeamIdentity();
      if (!confirmedIdentity) return openTeamNameModal({ mode: "create" });
      return startRunWithIdentity(confirmedIdentity);
    };
    if (!run || !global.RunState.isActiveRun(run)) return identity ? startRunWithIdentity(identity) : openTeamNameModal({ mode: "create" });
    const seasonName = seasonDisplayName(activeSeason?.id);
    const bossLine = `Boss ${Math.min(Number(run.bossIndex || 0) + 1, seasonDb?.bossOrder?.length || 99)} · Livello ${run.teamLevel || 0} · ${run.lives ?? "-"} vite`;
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Nuova run</p><h2>Inizia nuova run</h2><p class="muted">Hai già una run attiva in ${escapeHtml(seasonName)}.</p></div>${inazumaLogoMarkup("inazuma-logo--modal")}</div>
      <p class="home-overwrite-warning"><strong>${escapeHtml(bossLine)}</strong><br>Iniziando una nuova run, i progressi attuali di ${escapeHtml(seasonName)} verranno sostituiti. Le altre Season resteranno intatte.</p>
      <div class="button-row"><button type="button" class="btn" id="cancel-new-run">Annulla</button><button type="button" class="btn btn-yellow" id="confirm-new-run">Inizia nuova run</button></div>`,
      { closeable: false, className: "team-name-modal new-run-confirm-modal" }
    );
    document.getElementById("confirm-new-run").addEventListener("click", startConfirmedRun);
    document.getElementById("cancel-new-run").addEventListener("click", closeModal);
  }

  function openTeamNameModal({ mode = "create" } = {}) {
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">${mode === "edit" ? "Home" : "Nuova run"}</p><h2>${mode === "edit" ? "Modifica nome squadra" : "Nome della squadra"}</h2><p class="muted">${mode === "edit" ? "Aggiorna il nome permanente della tua squadra." : "Scegli il nome che rappresenterà la tua squadra."}</p></div>${inazumaLogoMarkup("inazuma-logo--modal")}</div>
      ${mode !== "edit" && run ? '<p class="home-overwrite-warning">Confermando sostituirai la run salvata.</p>' : ""}
      <label class="team-name-field" for="team-name-input">Nome squadra</label>
      <input class="team-name-input" id="team-name-input" type="text" placeholder="La mia squadra" maxlength="24" autocomplete="off" inputmode="text" value="${escapeHtml(savedTeamIdentity()?.name || "")}" />
      <p class="team-name-error" id="team-name-error" aria-live="polite"></p>
      <div class="button-row"><button type="button" class="btn btn-primary" id="confirm-team-name">Conferma</button><button type="button" class="btn" id="cancel-team-name">Indietro</button></div>`,
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
        const identity = global.RunState.saveProfileTeamIdentity({ name: result.name, logo: "inazuma-lightning" });
        if (syncRunTeamIdentity(identity)) global.RunState.save(run);
        if (before && before !== JSON.stringify({ roster: run.roster, lineup: run.lineup, bench: run.bench, bossIndex: run.bossIndex, currentZone: run.currentZone })) throw new Error("Team name edit changed run progress");
        closeModal();
        renderHome();
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

  async function resumeRun() {
    await selectSeason(run?.seasonId || activeSeason?.id, { markPlayed: true });
    if (!run) return renderHome();
    if (run.gameOver || run.phase === "gameover") return renderGameOver();
    if (run.phase === "formation") return renderFormationChoice();
    if (run.phase === "draft") return renderDraft();
    if (run.postBossFlow) return resumePostBossFlow();
    if (run.phase === "final-summary") return renderFinalSummary(run.hallTeamId);
    if (run.phase === "final-celebration" || run.phase === "complete") return renderFinalCelebration(run.hallTeamId);
    if (run.phase === "squad") return renderSquad();
    if (run.phase === "five") return renderFiveVFive();
    if (run.phase === "inventory") return renderInventory();
    if (run.phase === "match" && run.activeMatch) {
      ui.match = run.activeMatch;
      ui.bossMatchState = run.activeMatch.state || "pre-match";
      ui.bossMatchLog = run.activeMatch.log || [];
      return renderMatch();
    }
    ensureCurrentZone();
    if (resumePendingItemReward()) return;
    renderMap();
  }

  function renderFormationChoice() {
    run.phase = "formation";
    global.RunState.save(run);
    app.innerHTML = `
      <main class="screen">
        ${topbar("Scegli il modulo")}
        <div class="content narrow">
          <div class="section-head">
            <div><p class="eyebrow">Prima decisione</p><h2>Come giocherà la tua squadra?</h2></div>
          </div>
          <div class="formation-grid">
            ${seasonDb.formations.eleven.map((formation) => `
              <button type="button" class="formation-card" data-formation="${escapeHtml(formation.id)}">
                <strong>${escapeHtml(formation.name)}</strong>
                <p class="muted small">Il draft proporrà esattamente i ruoli necessari.</p>
                <div class="formation-roles">
                  <span class="role-chip">GK ${formation.requirements.GK}</span>
                  <span class="role-chip">DF ${formation.requirements.DF}</span>
                  <span class="role-chip">MF ${formation.requirements.MF}</span>
                  <span class="role-chip">FW ${formation.requirements.FW}</span>
                </div>
              </button>`).join("")}
          </div>
        </div>
      </main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();

    document.querySelectorAll("[data-formation]").forEach((button) => {
      button.addEventListener("click", () => {
        const formation = formationById(button.dataset.formation);
        run.formationId = formation.id;
        global.DraftEngine.start(run, formation, freeAgentsDb.players);
        global.RunState.save(run);
        renderDraft();
      });
    });
  }

  function renderDraft() {
    const draft = run.draft;
    if (!draft) return renderSquad();
    const role = draft.roles[draft.step];
    const candidates = draft.candidates.map((id) => freeAgentsById.get(String(id))).filter(Boolean);
    const progress = (draft.step / draft.roles.length) * 100;
    app.innerHTML = `
      <main class="screen">
        ${topbar("Draft iniziale")}
        <div class="content narrow">
          <p class="eyebrow">Scelta ${draft.step + 1} di ${draft.roles.length}</p>
          <div class="section-head">
            <div><h2>Scegli il tuo ${role}</h2><p class="muted">Uno di questi tre entrerà nella rosa.</p></div>
            <span class="role-chip">${escapeHtml(run.formationId)}</span>
          </div>
          <div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div>
          <div class="candidate-grid pull-offer-grid initial-draft-grid">
            ${candidates.map((player) => playerCard(player, { button: true })).join("")}
          </div>
        </div>
      </main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();

    document.querySelectorAll("[data-player-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const playerId = button.dataset.playerId;
        const player = freeAgentsById.get(playerId);
        const completed = global.DraftEngine.choose(
          run,
          playerId,
          freeAgentsDb.players,
          formationById(run.formationId)
        );
        if (completed) {
          ensureFiveVFive();
          run.roster.forEach((entry) => {
            const source = sourcePlayer(entry);
            entry.firstJoinedAt = entry.firstJoinedAt || new Date().toISOString();
            entry.recruitmentSource = entry.recruitmentSource || "initial_draft";
            entry.recruitedAtLevel = entry.recruitedAtLevel ?? entry.level ?? 0;
            entry.recruitedOverall = entry.recruitedOverall ?? source?.finalOverall ?? null;
            global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.PLAYER_RECRUITED, { player: source || entry, playerId: entry.playerId, source: "initial_draft", level: entry.level || 0, overall: entry.recruitedOverall, actionId: `${run.runId}:initial_draft:${entry.playerId}` });
            unlockAlbumRecruit(entry.playerId, "initial_draft");
          });
        }
        global.RunState.save(run);
        completed ? renderSquad() : renderDraft();
      });
    });
  }

  function rosterCounts() {
    const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    run.roster.forEach((entry) => {
      const player = sourcePlayer(entry);
      if (player && counts[player.position] !== undefined) counts[player.position] += 1;
    });
    return counts;
  }

  function canUseFormation(formation) {
    const counts = rosterCounts();
    return Object.entries(formation.requirements).every(([role, amount]) => counts[role] >= amount);
  }

  function autoArrangeFormation(formation) {
    const available = run.roster.map((entry) => ({ entry, player: sourcePlayer(entry) }));
    const used = new Set();
    const lineup = formation.slotRoles.map((role) => {
      const candidate = available.find(
        ({ entry, player }) => player.position === role && !used.has(String(entry.playerId))
      );
      if (!candidate) throw new Error(`Not enough ${role} players`);
      used.add(String(candidate.entry.playerId));
      return String(candidate.entry.playerId);
    });
    run.formationId = formation.id;
    run.lineup = lineup;
    run.bench = run.roster
      .map((entry) => String(entry.playerId))
      .filter((id) => !used.has(id));
    ui.selectedSquadPlayerId = null;
  }


  function lineupRows() {
    return ["FW", "MF", "DF", "GK"].map((role) => ({
      role,
      ids: run.lineup.filter((id) => sourcePlayer(rosterEntry(id)).position === role),
    }));
  }

  function tacticalMiniPlayer(id, { mode = "squad", area = "lineup", selectedId = null } = {}) {
    const entry = rosterEntry(id);
    if (!entry || !sourcePlayer(entry)) return "";
    const player = resolvedRosterPlayer(id);
    if (!player) return "";
    const selected = String(selectedId || ui.selectedSquadPlayerId) === String(id);
    const dataAttr = mode === "trade"
      ? `data-trade-player="${escapeHtml(id)}" data-area="${area}"`
      : mode === "equip"
        ? `data-equip-player="${escapeHtml(id)}"`
        : mode === "consumable"
          ? `data-consumable-player="${escapeHtml(id)}"`
          : `data-squad-player="${escapeHtml(id)}" data-area="${area}" data-rarity="${escapeHtml(player.category || "Debole")}" aria-pressed="${selected ? "true" : "false"}" aria-label="Seleziona ${escapeHtml(player.name)}, ${escapeHtml(player.position)}, rarità ${escapeHtml(player.category || "Debole")}"`;
    return compactPlayerCardMarkup(player, {
      equipment: player.equipment,
      equipmentInFooter: mode === "squad",
      level: player.displayLevel,
      overall: player.overall,
      selected,
      dataAttr,
      extraClass: mode === "squad" ? "squad-player-card" : "",
    });
  }

  function squadPitchMarkup({ mode = "squad", selectedId = null } = {}) {
    return `
      <section class="pitch">
        ${lineupRows().map((row) => `<div class="pitch-row tactical-row" data-row-count="${row.ids.length || 1}" style="--players-in-row:${row.ids.length || 1};--row-count:${row.ids.length || 1}">${row.ids.map((id) => tacticalMiniPlayer(id, { mode, area: "lineup", selectedId })).join("")}</div>`).join("")}
      </section>`;
  }

  function benchMarkup({ mode = "squad", selectedId = null } = {}) {
    const cards = (run.bench || []).map((id) => tacticalMiniPlayer(id, { mode, area: "bench", selectedId })).filter(Boolean);
    return cards.length ? cards.join("") : '<p class="muted">Le riserve arriveranno con pull, scambi e ricompense.</p>';
  }

  function miniPlayer(id, area) {
    return tacticalMiniPlayer(id, { mode: "squad", area });
  }

  function reconcileSquadRosterState() {
    const rosterIds = (run.roster || []).map((entry) => String(entry.playerId || "")).filter(Boolean);
    const rosterSet = new Set(rosterIds);
    const lineupIds = (run.lineup || []).map(String).filter(Boolean);
    const lineupSet = new Set(lineupIds);
    const currentBench = (run.bench || []).map(String).filter((id) => rosterSet.has(id) && !lineupSet.has(id));
    const canonicalBench = [...new Set(currentBench)];
    const unassigned = rosterIds.filter((id) => !lineupSet.has(id) && !canonicalBench.includes(id));
    unassigned.slice(0, Math.max(0, 4 - canonicalBench.length)).forEach((id) => canonicalBench.push(id));
    const changed = JSON.stringify(canonicalBench) !== JSON.stringify((run.bench || []).map(String));
    if (changed) run.bench = canonicalBench;
    return changed;
  }

  function squadValiditySummary() {
    const formation = formationById(run.formationId);
    const lineupIds = (run.lineup || []).map(String).filter(Boolean);
    const benchIds = (run.bench || []).map(String).filter(Boolean);
    const lineupUnique = new Set(lineupIds);
    const benchUnique = new Set(benchIds);
    const unresolvedLineup = lineupIds.filter((id) => !rosterEntry(id) || !sourcePlayer(rosterEntry(id)));
    const unresolvedBench = benchIds.filter((id) => !rosterEntry(id) || !sourcePlayer(rosterEntry(id)));
    const overlap = benchIds.filter((id) => lineupUnique.has(id));
    const roleCounts = { GK: 0, DF: 0, MF: 0, FW: 0 };
    lineupIds.forEach((id) => {
      const role = squadPlayerRole(id);
      if (roleCounts[role] !== undefined) roleCounts[role] += 1;
    });

    let formationIssue = "";
    if (!formation) formationIssue = "Modulo non disponibile";
    else if (lineupIds.length !== 11) formationIssue = `${lineupIds.length}/11 titolari assegnati`;
    else if (lineupUnique.size !== lineupIds.length) formationIssue = "Sono presenti titolari duplicati";
    else if (unresolvedLineup.length) formationIssue = `${unresolvedLineup.length} titolari non risolvibili`;
    else {
      const mismatch = Object.entries(formation.requirements || {}).find(([role, amount]) => roleCounts[role] !== Number(amount));
      if (mismatch) {
        const [role, amount] = mismatch;
        formationIssue = `Il modulo richiede ${amount} ${role} · presenti ${roleCounts[role]}`;
      }
    }

    const resolvedBenchIds = benchIds.filter((id) => !unresolvedBench.includes(id) && !overlap.includes(id));
    const benchCount = new Set(resolvedBenchIds).size;
    let rosterIssue = "";
    if (benchUnique.size !== benchIds.length) rosterIssue = "Riserve duplicate";
    else if (overlap.length) rosterIssue = "Giocatori presenti sia in campo sia in panchina";
    else if (unresolvedBench.length) rosterIssue = `${unresolvedBench.length} riserve non risolvibili`;
    else if (benchCount < 4) rosterIssue = `Rosa incompleta · ${benchCount}/4 riserve`;

    return {
      starters: lineupIds.length,
      bench: benchCount,
      formationValid: !formationIssue,
      formationIssue,
      rosterComplete: benchCount === 4 && !rosterIssue,
      rosterIssue,
      roleCounts,
    };
  }

  function squadBackButtonMarkup() {
    const destination = getSectionRootDestination("run");
    return `<button type="button" class="squad-back-button" data-section-root="run" aria-label="${escapeHtml(destination.label)}" title="${escapeHtml(destination.label)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5 8.5 12l7 7"/><path d="M9 12h11"/></svg>
    </button>`;
  }

  function squadTacticSummaryMarkup(formationId) {
    const tactic = tacticSummary(formationId);
    const entries = Object.entries(tactic.modifiers || {});
    const bonus = entries.find(([, value]) => Number(value) >= 0);
    const penalty = entries.find(([, value]) => Number(value) < 0);
    const compactChip = (entry, type) => {
      if (!entry) return "";
      const [key, value] = entry;
      const percent = Math.round(Math.abs(Number(value) || 0) * 100);
      return `<span class="squad-tactic-effect squad-tactic-effect--${type}">${type === "bonus" ? "+" : "−"}${percent}% ${escapeHtml(TACTIC_LABELS[key] || key)}</span>`;
    };
    return `<div class="squad-tactic-copy">
      <strong>${escapeHtml(tactic.name)}</strong>
      <p>${escapeHtml(tactic.description)}</p>
      <div class="squad-tactic-effects">${compactChip(bonus, "bonus")}${compactChip(penalty, "penalty")}</div>
    </div>`;
  }

  function squadFormationPreviewMarkup(formation) {
    return `<div class="squad-formation-mini" aria-hidden="true">
      ${["FW", "MF", "DF", "GK"].map((role) => {
        const amount = Number(formation.requirements?.[role] || 0);
        return `<span class="squad-formation-mini-row" style="--mini-count:${Math.max(1, amount)}">${Array.from({ length: amount }, () => `<i class="squad-formation-dot squad-formation-dot--${role.toLowerCase()}"></i>`).join("")}</span>`;
      }).join("")}
    </div>`;
  }

  function squadFormationOptionsMarkup() {
    return seasonDb.formations.eleven.map((item) => {
      const active = item.id === run.formationId;
      const available = canUseFormation(item);
      const tactic = tacticSummary(item.id);
      return `<button type="button" class="squad-formation-option ${active ? "active" : ""}" data-squad-formation="${escapeHtml(item.id)}" ${available ? "" : "disabled"} aria-pressed="${active ? "true" : "false"}">
        ${squadFormationPreviewMarkup(item)}
        <span class="squad-formation-option-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(tactic.name)}</small>
          <em>${active ? "Modulo attivo" : (available ? "Seleziona" : "Rosa incompatibile")}</em>
        </span>
      </button>`;
    }).join("");
  }

  function openSquadFormationSelector() {
    openModal(`
      <div class="modal-head squad-formation-modal-head">
        <div><p class="eyebrow">Assetto tattico</p><h2>Modifica modulo</h2><p class="muted">Scegli una disposizione: i titolari verranno riordinati automaticamente usando le regole esistenti.</p></div>
      </div>
      <div class="squad-formation-options">${squadFormationOptionsMarkup()}</div>
    `, { closeable: true, className: "squad-formation-modal", preserveScroll: scrollSnapshot() });

    modalRoot.querySelector(".squad-formation-options")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-squad-formation]");
      if (!button || button.disabled) return;
      const formationId = button.dataset.squadFormation;
      if (formationId === run.formationId) return closeModal();
      const next = formationById(formationId);
      if (!next || !canUseFormation(next)) return toast("La rosa non copre tutti i ruoli del modulo");
      autoArrangeFormation(next);
      global.RunState.save(run);
      closeModal();
      toast(`Modulo cambiato in ${next.name}`);
      runKeepingScroll(renderSquad);
    });
  }

  function renderSquad() {
    run.phase = "squad";
    reconcileSquadRosterState();
    global.RunState.save(run);
    const formation = formationById(run.formationId);
    const squadSummary = squadValiditySummary();
    const teamIdentity = savedTeamIdentity() || normalizeTeamIdentity(run.teamIdentity);
    const avgOverall = averageOverall();

    app.innerHTML = `
      <main class="screen squad-screen">
        <header class="squad-topbar">
          <div class="squad-topbar-main">
            ${squadBackButtonMarkup()}
            <div class="squad-topbar-copy"><p>Gestione squadra</p><h1>${escapeHtml(teamIdentity.name)}</h1></div>
          </div>
          <div class="squad-topbar-stats" aria-label="Riepilogo squadra">
            <span><small>OVR</small><strong>${escapeHtml(avgOverall)}</strong></span>
            <span><small>LV</small><strong>${escapeHtml(run.teamLevel)}</strong></span>
            <span class="squad-life-stat" aria-label="Vite">${hearts()}</span>
          </div>
        </header>
        <div class="content squad-content">
          <div class="squad-command-deck ${squadSummary.formationValid ? "is-valid" : "is-invalid"} ${squadSummary.rosterComplete ? "is-roster-complete" : "is-roster-incomplete"}">
            <span class="squad-readiness-mark" aria-hidden="true">${squadSummary.formationValid ? "✓" : "!"}</span>
            <div><small>Stato formazione</small><strong>${squadSummary.formationValid ? "Formazione valida" : "Formazione non valida"}</strong>${squadSummary.formationIssue ? `<em>${escapeHtml(squadSummary.formationIssue)}</em>` : ""}</div>
            <span class="squad-command-count"><b>${squadSummary.starters}/11 titolari</b><b class="${squadSummary.rosterComplete ? "" : "is-warning"}">${squadSummary.rosterComplete ? `Rosa completa · ${squadSummary.bench}/4 riserve` : escapeHtml(squadSummary.rosterIssue || `Rosa incompleta · ${squadSummary.bench}/4 riserve`)}</b></span>
          </div>

          <div class="squad-workspace">
            <section class="squad-field-panel" aria-label="Campo 11v11">
              <div class="squad-panel-head"><div><p class="eyebrow">Formazione titolare</p><h2>Campo tattico</h2></div><span class="squad-field-formation">${escapeHtml(formation?.name || run.formationId)}</span></div>
              ${squadPitchMarkup()}
            </section>
            <aside class="squad-management-panel" aria-label="Gestione tattica">
              <section class="squad-module-card">
                <div class="squad-module-head">
                  <div><small>Modulo corrente</small><strong>${escapeHtml(formation?.name || run.formationId)}</strong></div>
                  ${squadFormationPreviewMarkup(formation)}
                </div>
                ${squadTacticSummaryMarkup(run.formationId)}
              </section>
              <div class="squad-management-actions">
                <button type="button" class="btn squad-module-button" id="open-squad-formation">Modifica modulo</button>
                <button type="button" class="btn btn-yellow squad-info-button" id="squad-player-info" disabled>Info</button>
              </div>
              <p class="squad-selection-hint" data-squad-hint>Seleziona un giocatore</p>
              <section class="squad-bench-panel" aria-label="Riserve">
                <div class="squad-panel-head"><div><p class="eyebrow">Panchina</p><h2>Riserve</h2></div><span class="squad-bench-count">${Math.min(squadSummary.bench, 4)}/4</span></div>
                <div class="bench-list squad-bench-list">
                  ${benchMarkup()}
                </div>
              </section>
              <div class="squad-secondary-actions">
                <button type="button" class="btn btn-yellow squad-route-button" id="go-map">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 9 4l6 2.5 5-2.5v13.5l-5 2.5-6-2.5-5 2.5V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>
                  <span>${run.currentZone ? "Torna al percorso" : "Inizia il percorso"}</span>
                </button>
              </div>
            </aside>
          </div>
        </div>
        ${bottomNav("squad")}
      </main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();

    const main = app.querySelector("main");
    main.addEventListener("click", (event) => {
      const squadPlayer = event.target.closest("[data-squad-player]");
      if (squadPlayer && main.contains(squadPlayer)) {
        event.preventDefault();
        handleSquadSelection(squadPlayer.dataset.squadPlayer);
        return;
      }
      if (!event.target.closest("button, a, input, select, textarea, [role='button']")) setSelectedSquadPlayer(null);
    });
    document.getElementById("open-squad-formation").addEventListener("click", openSquadFormationSelector);
    document.getElementById("squad-player-info").addEventListener("click", () => {
      if (ui.selectedSquadPlayerId) showPlayerDetails(ui.selectedSquadPlayerId);
    });
    document.getElementById("go-map").addEventListener("click", () => {
      resumePostBossFlowOrMap();
    });
    bindBottomNav();
  }

  function squadPlayerRole(playerId) {
    return sourcePlayer(rosterEntry(playerId))?.position || null;
  }

  function setSelectedSquadPlayer(playerId) {
    ui.selectedSquadPlayerId = playerId ? String(playerId) : null;
    const selectedRole = ui.selectedSquadPlayerId ? squadPlayerRole(ui.selectedSquadPlayerId) : null;
    document.querySelectorAll("[data-squad-player]").forEach((card) => {
      const cardId = String(card.dataset.squadPlayer);
      const isSelected = cardId === ui.selectedSquadPlayerId;
      const isCompatible = Boolean(ui.selectedSquadPlayerId && !isSelected && selectedRole && squadPlayerRole(cardId) === selectedRole);
      card.classList.toggle("selected", isSelected);
      card.classList.toggle("is-compatible", isCompatible);
      card.classList.toggle("is-incompatible", Boolean(ui.selectedSquadPlayerId && !isSelected && !isCompatible));
      card.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    const infoButton = document.getElementById("squad-player-info");
    if (infoButton) {
      infoButton.disabled = !ui.selectedSquadPlayerId;
      infoButton.setAttribute("aria-label", ui.selectedSquadPlayerId ? `Apri la scheda di ${resolvedRosterPlayer(ui.selectedSquadPlayerId)?.name || "giocatore selezionato"}` : "Seleziona un giocatore");
    }
    const hint = document.querySelector("[data-squad-hint]");
    if (hint) hint.textContent = ui.selectedSquadPlayerId ? "Scegli un giocatore compatibile da scambiare" : "Seleziona un giocatore";
  }

  function replaceSquadPlayerCard(current, nextPlayerId, area) {
    if (!current) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = tacticalMiniPlayer(nextPlayerId, { mode: "squad", area }).trim();
    const next = wrapper.firstElementChild;
    if (next) current.replaceWith(next);
  }

  function swapSquadPlayersInDom(firstId, secondId, firstArea, secondArea) {
    const firstCard = document.querySelector(`[data-squad-player="${cssEscape(firstId)}"]`);
    const secondCard = document.querySelector(`[data-squad-player="${cssEscape(secondId)}"]`);
    replaceSquadPlayerCard(firstCard, secondId, firstArea);
    replaceSquadPlayerCard(secondCard, firstId, secondArea);
  }

  function handleSquadSelection(playerId) {
    const clickedId = String(playerId);
    const selected = ui.selectedSquadPlayerId;
    if (!selected) return setSelectedSquadPlayer(clickedId);
    if (selected === clickedId) return setSelectedSquadPlayer(null);
    if (squadPlayerRole(selected) !== squadPlayerRole(clickedId)) {
      return toast("Questa destinazione non è compatibile");
    }

    const firstArea = run.lineup.includes(selected) ? "lineup" : "bench";
    const secondArea = run.lineup.includes(clickedId) ? "lineup" : "bench";
    const firstList = firstArea === "lineup" ? run.lineup : run.bench;
    const secondList = secondArea === "lineup" ? run.lineup : run.bench;
    const firstIndex = firstList.indexOf(selected);
    const secondIndex = secondList.indexOf(clickedId);
    if (firstIndex < 0 || secondIndex < 0) return setSelectedSquadPlayer(null);

    if (firstList === secondList) {
      [firstList[firstIndex], firstList[secondIndex]] = [firstList[secondIndex], firstList[firstIndex]];
    } else {
      firstList[firstIndex] = clickedId;
      secondList[secondIndex] = selected;
    }
    const firstName = resolvedRosterPlayer(selected)?.name || selected;
    const secondName = resolvedRosterPlayer(clickedId)?.name || clickedId;
    swapSquadPlayersInDom(selected, clickedId, firstArea, secondArea);
    setSelectedSquadPlayer(null);
    global.RunState.save(run);
    toast(`${firstName} e ${secondName} scambiati`);
  }

  function ensureCurrentZone() {
    if (run.currentZone && run.currentZone.bossIndex === run.bossIndex) return;
    const boss = seasonDb.bossOrder[run.bossIndex];
    if (!boss) return;
    run.currentZone = global.MapEngine.generate(run, boss);
    run.phase = "map";
    global.RunState.createCheckpoint(run);
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
    const fallback = escapeHtml((teamName.trim()[0] || "⚽").toUpperCase());
    if (!logoUrl) return `<span class="boss-logo-fallback boss-logo-fallback--visible" aria-hidden="true">${fallback}</span>`;
    return `<img class="boss-node-logo" src="${escapeHtml(logoUrl)}" alt="Logo ${escapeHtml(teamName)}" loading="lazy" onerror="this.remove();this.parentElement?.classList.add('boss-logo-missing');" /><span class="boss-logo-fallback" aria-hidden="true">${fallback}</span>`;
  }

  function renderMap() {
    if (run) global.RunState.touch(run);
    const bossFlow = resolvePendingRunFlow();
    if (bossFlow.destination !== "none") return navigateBossVictoryDestination(bossFlow);
    ensureCurrentZone();
    if (!run.currentZone) return renderSeasonComplete();
    run.phase = "map";
    global.RunState.save(run);
    const zone = run.currentZone;
    const boss = seasonDb.bossOrder[run.bossIndex];
    const positions = nodePositions(zone);
    const reachable = new Set(global.MapEngine.reachableNodeIds(zone));
    const completed = new Set(zone.completedNodeIds);
    const labels = global.SEASON1_CONFIG.nodeLabels;
    const currentNodeId = zone.currentNodeId;
    const pathSet = new Set(zone.path || []);
    const edgeMarkup = zone.edges.map(([from, to]) => {
      const available = from === currentNodeId && reachable.has(to);
      const done = completed.has(from) && (completed.has(to) || pathSet.has(to));
      const bossEdge = zone.nodes.find((node) => node.id === to)?.type === "boss";
      const edgeClass = [available ? "available" : "", done ? "done" : "", bossEdge ? "boss-edge" : ""].filter(Boolean).join(" ");
      return `<line class="${edgeClass}" x1="${positions[from].x}" y1="${positions[from].y}" x2="${positions[to].x}" y2="${positions[to].y}" />`;
    }).join("");

    app.innerHTML = `
      <main class="screen route-screen">
        ${topbar(`Verso ${boss.teamName}`)}
        <div class="content route-content">
          <section class="route-hero panel" aria-label="Prossima sfida del percorso">
            <div class="route-hero-copy">
              <p class="eyebrow route-kicker">Boss ${run.bossIndex + 1} di ${seasonDb.bossOrder.length}</p>
              <h2>Verso ${escapeHtml(boss.teamName)}</h2>
              <p class="muted">Scegli il prossimo nodo e avanza verso il boss.</p>
            </div>
            <button type="button" class="route-target-card" id="open-boss-preview" aria-label="Vedi formazione boss ${escapeHtml(boss.teamName)}">
              <span>Prossima sfida</span>
              <strong>${escapeHtml(boss.teamName)}</strong>
              <small>${escapeHtml(boss.bossFormation || "Boss della run")}${boss.bossLevel ? ` · Lv ${escapeHtml(boss.bossLevel)}` : ""}</small>
              <em>Vedi formazione</em>
            </button>
          </section>
          <div class="map-wrap" id="map-scroll">
            <div class="route-map" aria-label="Mappa percorso verso ${escapeHtml(boss.teamName)}">
              <svg class="map-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${edgeMarkup}</svg>
              ${zone.nodes.map((node) => {
                const meta = labels[node.type];
                const stateClass = completed.has(node.id) ? "completed" : reachable.has(node.id) ? "reachable" : "locked";
                const isBoss = node.type === "boss";
                const isCurrent = node.id === currentNodeId;
                const readableState = isCurrent ? "posizione attuale" : completed.has(node.id) ? "completato" : reachable.has(node.id) ? "selezionabile" : "bloccato";
                return `
                  <button type="button" class="map-node ${stateClass}${isCurrent ? " current" : ""}${isBoss ? " boss-node" : ""}" data-node-id="${node.id}" ${reachable.has(node.id) ? "" : "disabled"}
                    aria-label="${escapeHtml((isBoss ? boss.teamName : meta.label) + ", " + readableState)}"
                    style="left:${positions[node.id].x / 10}%;top:${positions[node.id].y / 10}%;--node-color:${meta.color}">
                    ${isBoss ? '<span class="node-badge">Boss</span>' : ''}
                    <span class="node-icon">${isBoss ? bossNodeIconMarkup(boss) : meta.icon}</span>
                    <span class="node-label">${isBoss ? escapeHtml(boss.teamName) : meta.label}</span>
                    <span class="node-state">${escapeHtml(readableState)}</span>
                  </button>`;
              }).join("")}
            </div>
          </div>
        </div>
        ${bottomNav("map")}
      </main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();

    document.getElementById("open-boss-preview")?.addEventListener("click", () => openBossPreviewModal(boss));
    document.querySelectorAll("[data-node-id]").forEach((button) => {
      button.addEventListener("click", () => enterNode(button.dataset.nodeId));
    });
    bindBottomNav();
    requestAnimationFrame(() => {
      const scroll = document.getElementById("map-scroll");
      if (zone.path.length <= 1 && scroll && !window.matchMedia("(max-width: 780px)").matches) scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
      if (scroll && window.matchMedia("(max-width: 780px)").matches) scroll.scrollLeft = 0;
    });
  }

  function enterNode(nodeId) {
    let node;
    try {
      node = global.MapEngine.selectNode(run.currentZone, nodeId);
    } catch (error) {
      return toast(error.message);
    }
    global.RunState.save(run);

    if (node.type === "random") return resolveRandomNode(node);
    dispatchNode(node, node.type);
  }

  function dispatchNode(node, eventType) {
    if (eventType === "five_v_five") {
      const status = fiveVFiveStatus();
      if (!status.valid) {
        toast("Completa la Formazione 5v5 prima di avviare la partitella.");
        run.phase = "five";
        global.RunState.save(run);
        return renderFiveVFive();
      }
      ui.match = createOrLoadFiveMatch(node);
      ui.bossMatchState = ui.match.state || "pre-match";
      ui.bossMatchLog = ui.match.log || [];
      ui.bossMatchResolving = false;
      run.phase = "match";
      run.activeMatch = ui.match;
      global.RunState.save(run);
      return renderMatch();
    }
    if (eventType === "boss") {
      ui.match = { nodeId: node.id, previousNodeId: run.currentZone.currentNodeId, type: eventType, state: "pre-match", log: [], bossIndex: run.bossIndex, attemptNumber: Object.keys(run.statistics?.processedMatchIds || {}).filter((id) => id.includes(`::${node.id}::boss::`)).length + 1 };
      ui.match.matchId = global.RunStatistics?.createStableMatchId?.(run, ui.match) || null;
      ui.bossMatchState = "pre-match";
      ui.bossMatchLog = [];
      ui.bossMatchResolving = false;
      run.phase = "match";
      run.activeMatch = ui.match;
      global.RunState.save(run);
      return renderMatch();
    }
    if (eventType.startsWith("pull_")) return openPull(node, eventType);
    if (eventType === "item") return resolveItemNode(node);
    if (eventType === "trade") return resolveTradeNode(node);
  }

  function finishNonMatchNode(node, message) {
    global.MapEngine.completeNode(run.currentZone, node.id);
    global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.NODE_COMPLETED, { nodeId: node.id, nodeType: node.type, actionId: `${run.runId}:${node.id}:node_completed` });
    run.phase = "map";
    global.RunState.save(run);
    closeModal();
    toast(message);
    renderMap();
  }

  function pendingItemRewardNode() {
    const pending = run?.pendingItemReward;
    if (!pending || !run?.currentZone) return null;
    return run.currentZone.nodes.find((node) => String(node.id) === String(pending.nodeId)) || null;
  }

  function resumePendingItemReward() {
    const storedNode = pendingItemRewardNode();
    if (storedNode) {
      renderMap();
      resolveItemNode(storedNode);
      return true;
    }

    if (run?.pendingItemReward) {
      run.pendingItemReward = null;
      global.RunState.save(run);
    }

    const pendingNode = run?.currentZone?.nodes?.find(
      (node) => String(node.id) === String(run.currentZone.pendingNodeId)
    );
    const pendingType = pendingNode?.type === "random" ? pendingNode.revealedType : pendingNode?.type;
    if (pendingNode && pendingType === "item") {
      renderMap();
      resolveItemNode(pendingNode);
      return true;
    }
    return false;
  }

  function itemRewardCandidates(node) {
    const existing = run.pendingItemReward;
    const sameNode = existing && String(existing.nodeId) === String(node.id);
    const savedCandidates = sameNode
      ? (existing.candidateIds || []).map(itemDefinitionById).filter(Boolean)
      : [];
    if (savedCandidates.length) return savedCandidates;

    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}`);
    return weightedItemCandidates(random, 3);
  }

  function ensurePendingItemReward(node) {
    const candidates = itemRewardCandidates(node);
    const existing = run.pendingItemReward;
    const sameNode = existing && String(existing.nodeId) === String(node.id);
    const candidateIds = candidates.map((item) => item.id);
    const selectedItemId = sameNode && candidateIds.includes(existing.selectedItemId)
      ? existing.selectedItemId
      : candidateIds[0];
    run.pendingItemReward = {
      nodeId: String(node.id),
      sourceNodeType: node.type,
      candidateIds,
      selectedItemId,
      status: sameNode && existing.status === "claimed" ? "claimed" : "offered",
      claimedItemId: sameNode ? existing.claimedItemId || null : null,
      claimedInstanceId: sameNode ? existing.claimedInstanceId || null : null,
    };
    global.RunState.save(run);
    return { pending: run.pendingItemReward, candidates };
  }

  function itemRewardOwnedQuantity(item) {
    const key = inventoryItemIdentity(item);
    return groupedOwnedInventoryItems(run).find((group) => group.key === key)?.quantity || 0;
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
    const full = run.inventory.length >= global.SEASON1_CONFIG.maxInventory;
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
            <div><dt>Spazio inventario</dt><dd>${run.inventory.length}/${global.SEASON1_CONFIG.maxInventory}</dd></div>
          </dl>
          ${full ? '<p class="item-reward-capacity" role="status">Inventario pieno. Prima di prendere la ricompensa potrai scegliere un oggetto da rimuovere.</p>' : ""}
          <div class="item-reward-primary-action">
            <button type="button" class="btn btn-yellow btn-primary-action" data-claim-item="${escapeHtml(item.id)}">${actionLabel}</button>
          </div>
        </div>
      </article>`;
  }

  function resolveItemNode(node) {
    const { pending, candidates } = ensurePendingItemReward(node);
    if (pending.status === "claimed") return renderItemRewardResult(node);
    ui.itemRewardSubmitting = false;
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
            <div class="item-reward-details">
              ${candidates.map((item) => itemRewardDetailMarkup(item, item.id === pending.selectedItemId)).join("")}
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
        run.pendingItemReward.selectedItemId = itemId;
        global.RunState.save(run);
        modal.querySelectorAll("[data-reward-candidate]").forEach((button) => {
          const active = button.dataset.rewardCandidate === itemId;
          button.classList.toggle("selected", active);
          button.setAttribute("aria-pressed", active ? "true" : "false");
        });
        modal.querySelectorAll("[data-reward-detail]").forEach((detail) => {
          detail.hidden = detail.dataset.rewardDetail !== itemId;
        });
        modal.querySelector(`[data-claim-item="${cssEscape(itemId)}"]`)?.focus?.({ preventScroll: true });
        return;
      }

      const claimButton = event.target.closest("[data-claim-item]");
      if (!claimButton || ui.itemRewardSubmitting) return;
      const item = candidates.find((candidate) => candidate.id === claimButton.dataset.claimItem);
      if (!item || run.pendingItemReward?.status !== "offered") return;
      ui.itemRewardSubmitting = true;
      modal.querySelectorAll("button").forEach((button) => { button.disabled = true; });
      receiveItem(
        item,
        node,
        (instance) => completeItemReward(node, instance),
        () => {
          ui.itemRewardSubmitting = false;
          resolveItemNode(node);
        }
      );
    });
    document.getElementById("skip-item").addEventListener("click", () => {
      if (ui.itemRewardSubmitting) return;
      ui.itemRewardSubmitting = true;
      run.pendingItemReward = null;
      finishNonMatchNode(node, "Hai rinunciato all'oggetto");
    });
  }

  function completeItemReward(node, instance) {
    const pending = run.pendingItemReward;
    if (!pending || pending.status === "claimed") return renderItemRewardResult(node);
    pending.status = "claimed";
    pending.claimedItemId = inventoryItemIdentity(instance);
    pending.claimedInstanceId = instance.instanceId;
    if (!run.currentZone.completedNodeIds.includes(node.id)) {
      global.MapEngine.completeNode(run.currentZone, node.id);
      global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.NODE_COMPLETED, {
        nodeId: node.id,
        nodeType: node.type,
        actionId: `${run.runId}:${node.id}:node_completed`,
      });
    }
    run.phase = "map";
    global.RunState.save(run);
    ui.itemRewardSubmitting = false;
    renderItemRewardResult(node);
  }

  function renderItemRewardResult(node) {
    const pending = run.pendingItemReward;
    const item = itemDefinitionById(pending?.claimedItemId) || itemDefinitionById(pending?.selectedItemId);
    if (!pending || !item) {
      run.pendingItemReward = null;
      global.RunState.save(run);
      closeModal();
      return renderMap();
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
                <div><dt>Spazio inventario</dt><dd>${run.inventory.length}/${global.SEASON1_CONFIG.maxInventory}</dd></div>
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
      run.pendingItemReward = null;
      global.RunState.save(run);
      closeModal();
      toast(`Hai ottenuto ${item.name}`);
      renderMap();
    });
  }

  function resolveRandomNode(node) {
    const revealedType = global.MapEngine.resolveRandomNodeType(run, node);
    global.RunState.save(run);
    const meta = global.SEASON1_CONFIG.nodeLabels[revealedType];
    openModal(`
      <div class="modal-head random-event-head"><div><p class="eyebrow">Evento casuale</p><h2>${escapeHtml(meta.label)}</h2><p class="muted">Il contenuto è stato rivelato e non cambierà ricaricando la pagina.</p></div></div>
      <div class="random-event-reveal" style="--reveal-color:${meta.color}"><span aria-hidden="true">${meta.icon}</span><strong>${escapeHtml(meta.label)}</strong><small>Pronto da aprire</small></div>
      <div class="node-actions"><button type="button" class="btn btn-primary btn-primary-action" id="open-hidden-event">Continua</button></div>`,
      { closeable: false, className: "random-event-modal" }
    );
    document.getElementById("open-hidden-event").addEventListener("click", () => {
      closeModal();
      dispatchNode(node, revealedType);
    });
  }

  function updateTradeConfirmState() {
    const selected = ui.tradeSelectedPlayerId ? resolvedRosterPlayer(ui.tradeSelectedPlayerId) : null;
    const summary = modalRoot.querySelector(".trade-selection-summary");
    if (summary) {
      summary.classList.toggle("selected", Boolean(selected));
      summary.innerHTML = selected
        ? `<strong>${escapeHtml(selected.name)}</strong><span>${selected.position} · OVR ${selected.overall} · Lv ${selected.displayLevel}</span>`
        : '<strong>Nessun giocatore selezionato</strong><span>Scegli una card per procedere allo scambio.</span>';
    }
    const confirm = document.getElementById("continue-trade");
    if (confirm) confirm.disabled = !selected;
  }

  function setSelectedTradePlayer(playerId) {
    const previous = ui.tradeSelectedPlayerId;
    if (previous) modalRoot.querySelector(`[data-trade-player="${cssEscape(previous)}"]`)?.classList.remove("selected");
    ui.tradeSelectedPlayerId = playerId ? String(playerId) : null;
    if (ui.tradeSelectedPlayerId) modalRoot.querySelector(`[data-trade-player="${cssEscape(ui.tradeSelectedPlayerId)}"]`)?.classList.add("selected");
    updateTradeConfirmState();
  }

  function resolveTradeNode(node) {
    ui.tradeSelectedPlayerId = ui.tradeSelectedPlayerId && rosterEntry(ui.tradeSelectedPlayerId) ? ui.tradeSelectedPlayerId : null;
    const selected = ui.tradeSelectedPlayerId ? resolvedRosterPlayer(ui.tradeSelectedPlayerId) : null;
    openModal(`
      <section class="exchange-screen">
        <div class="modal-head trade-node-head"><div><p class="eyebrow">Scambio</p><h2>Scegli chi scambiare</h2><p class="muted">Offri un titolare o una riserva: riceverai un giocatore casuale dello stesso ruolo, con finalOverall uguale o superiore e un livello in più.</p></div></div>
        <main class="exchange-content">
          <div class="trade-flow-summary" aria-label="Riepilogo scambio"><div><span>Offri</span><strong>1 giocatore della rosa</strong></div><div><span>Ricevi</span><strong>Stesso ruolo · OVR ≥ · Lv +1</strong></div></div>
          <div class="trade-squad-layout">
            ${squadPitchMarkup({ mode: "trade", selectedId: ui.tradeSelectedPlayerId })}
            <aside class="panel trade-bench-panel">
              <h3>Riserve</h3>
              <div class="bench-list">${benchMarkup({ mode: "trade", selectedId: ui.tradeSelectedPlayerId })}</div>
            </aside>
          </div>
          <div class="trade-selection-summary ${selected ? "selected" : ""}">
            ${selected ? `<strong>${escapeHtml(selected.name)}</strong><span>${selected.position} · OVR ${selected.overall} · Lv ${selected.displayLevel}</span>` : '<strong>Nessun giocatore selezionato</strong><span>Scegli una card per procedere allo scambio.</span>'}
          </div>
        </main>
        <div class="node-actions exchange-actions trade-actions">
          <button type="button" class="btn btn-yellow btn-primary-action" id="continue-trade" ${selected ? "" : "disabled"}>Procedi allo scambio</button>
          <button type="button" class="btn btn-ghost" id="skip-trade">Rinuncia e torna alla mappa</button>
        </div>
      </section>`,
      { closeable: false, className: "trade-modal", preserveScroll: scrollSnapshot() }
    );
    const modal = modalRoot.querySelector(".modal");
    modal.addEventListener("click", (event) => {
      const tradePlayer = event.target.closest("[data-trade-player]");
      if (!tradePlayer || !modal.contains(tradePlayer)) return;
      event.preventDefault();
      setSelectedTradePlayer(tradePlayer.dataset.tradePlayer);
    });
    document.getElementById("continue-trade").addEventListener("click", () => prepareTrade(node, ui.tradeSelectedPlayerId));
    document.getElementById("skip-trade").addEventListener("click", () => {
      ui.tradeSelectedPlayerId = null;
      finishNonMatchNode(node, "Hai rinunciato allo scambio");
    });
  }

  function prepareTrade(node, outgoingId) {
    const outgoingEntry = rosterEntry(outgoingId);
    const outgoingPlayer = sourcePlayer(outgoingEntry);
    const candidates = global.RoguelikeRules.getTradeCandidates({
      outgoingPlayer,
      rosterIds: run.roster.map((entry) => entry.playerId),
      freeAgents: freeAgentsDb.players,
      seasonPlayers: seasonDb.players,
      unlockedTeamIds: run.unlockedTeamIds,
      teams: seasonDb.teams,
    });
    if (!candidates.length) {
      toast(`Nessun ${outgoingPlayer.position} con finalOverall ${outgoingPlayer.finalOverall} o superiore disponibile`);
      return resolveTradeNode(node);
    }
    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:trade:${outgoingId}`);
    const incoming = candidates[Math.floor(random() * candidates.length)];
    const nextLevel = Math.min(20, Number(outgoingEntry.level || 0) + 1);
    openModal(`
      <div class="modal-head trade-node-head"><div><p class="eyebrow">Conferma scambio</p><h2>${escapeHtml(outgoingPlayer.name)}</h2></div></div>
      <div class="trade-confirm-panel"><div><span>Offri</span><strong>${escapeHtml(outgoingPlayer.name)}</strong><small>${outgoingPlayer.position} · OVR ${outgoingPlayer.finalOverall}</small></div><div><span>Ricevi</span><strong>${outgoingPlayer.position} casuale</strong><small>finalOverall almeno ${outgoingPlayer.finalOverall} · Lv ${nextLevel}</small></div></div>
      ${outgoingEntry.equippedItem ? `<p class="muted trade-note">${escapeHtml(outgoingEntry.equippedItem.name)} tornerà nell'inventario.</p>` : ""}
      <div class="node-actions"><button type="button" class="btn btn-danger" id="confirm-trade">Conferma scambio</button><button type="button" class="btn btn-ghost" id="back-trade">Annulla</button></div>`,
      { closeable: false, className: "trade-confirm-modal" }
    );
    document.getElementById("back-trade").addEventListener("click", () => resolveTradeNode(node));
    document.getElementById("confirm-trade").addEventListener("click", () => {
      const execute = () => executeTrade(node, outgoingEntry, incoming, nextLevel);
      if (outgoingEntry.equippedItem && run.inventory.length >= global.SEASON1_CONFIG.maxInventory) {
        return chooseInventoryDiscard("Libera uno spazio per recuperare l'oggetto equipaggiato", execute, () => resolveTradeNode(node));
      }
      execute();
    });
  }

  function executeTrade(node, outgoingEntry, incoming, nextLevel) {
    const outgoingId = String(outgoingEntry.playerId);
    const incomingId = String(incoming.player.playerId);
    const rosterIndex = run.roster.findIndex((entry) => String(entry.playerId) === outgoingId);
    if (outgoingEntry.equippedItem) run.inventory.push(outgoingEntry.equippedItem);
    run.roster[rosterIndex] = { playerId: incomingId, source: incoming.source, level: nextLevel, equippedItem: null, potentialBoost: 0, currentOverallBoost: 0, potentialBoostApplications: [], intensiveTrainingMigrated: true };
    unlockAlbumRecruit(incomingId, "trade");
    run.lineup = run.lineup.map((id) => String(id) === outgoingId ? incomingId : String(id));
    run.bench = run.bench.map((id) => String(id) === outgoingId ? incomingId : String(id));
    global.FiveVFive.removeUnavailable(run);
    ui.tradeSelectedPlayerId = null;
    global.RunState.save(run);
    showTradeResult(node, incoming, nextLevel);
  }

  function showTradeResult(node, incoming, nextLevel) {
    const database = global.SeasonRegistry?.isSeasonSource?.(incoming.source) ? (global.SeasonRegistry.database(incoming.source) || seasonDb) : freeAgentsDb;
    openModal(`
      <div class="modal-head trade-node-head"><div><p class="eyebrow">Scambio completato</p><h2>È arrivato ${escapeHtml(incoming.player.name)}</h2><p class="muted">Il nuovo giocatore è già nella rosa. Continua per finalizzare il nodo e tornare alla mappa.</p></div></div>
      <div class="trade-result-card mobile-compact-player-list">${playerCard(incoming.player, { level: nextLevel, database })}</div>
      <div class="node-actions"><button type="button" class="btn btn-secondary" id="trade-player-detail">Apri scheda</button><button type="button" class="btn btn-primary btn-primary-action" id="finish-trade">Continua</button></div>`,
      { closeable: false, className: "trade-result-modal" }
    );
    document.getElementById("trade-player-detail").addEventListener("click", () => {
      showPlayerDetails(incoming.player.playerId, () => showTradeResult(node, incoming, nextLevel));
    });
    document.getElementById("finish-trade").addEventListener("click", () => finishNonMatchNode(node, `${incoming.player.name} entra nella rosa`));
  }

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
    const add = () => {
      if (run.pendingItemReward?.status === "claimed") return done(resolveItem(run.pendingItemReward.claimedItemId));
      const instance = makeItemInstance(item, node.id);
      run.inventory.push(instance);
      global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.ITEM_OBTAINED, { nodeId: node.id, itemId: item.id, actionId: `${run.runId}:${node.id}:item_obtained` });
      done(instance);
    };
    if (run.inventory.length < global.SEASON1_CONFIG.maxInventory) return add();
    chooseInventoryDiscard("Inventario pieno: scegli un oggetto da eliminare", add, onCancel);
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

  function previousBossLevel() {
    return global.RoguelikeRules.unlockedPullLevel(seasonDb, run.bossIndex);
  }

  function pullPool(type) {
    if (type === "pull_free_agents") return { players: freeAgentsDb.players, source: "free_agents", database: freeAgentsDb };
    if (type === "pull_unlocked_teams") {
      const ids = new Set(
        seasonDb.teams
          .filter((team) => run.unlockedTeamIds.includes(String(team.teamId)))
          .flatMap((team) => team.playerIds.map(String))
      );
      return { players: seasonDb.players.filter((player) => ids.has(String(player.playerId))), source: global.SeasonRegistry.sourceForSeason(run?.seasonId), database: seasonDb };
    }
    const legendaryById = new Map();
    const legendarySources = new Map();
    freeAgentsDb.players
      .filter((player) => global.SEASON1_CONFIG.legendaryCategories.includes(player.category))
      .forEach((player) => {
        legendaryById.set(String(player.playerId), player);
        legendarySources.set(String(player.playerId), "free_agents");
      });
    seasonDb.players
      .filter((player) => global.SEASON1_CONFIG.legendaryCategories.includes(player.category))
      .forEach((player) => {
        if (!legendaryById.has(String(player.playerId))) {
          legendaryById.set(String(player.playerId), player);
          legendarySources.set(String(player.playerId), global.SeasonRegistry.sourceForSeason(run?.seasonId));
        }
      });
    return {
      players: [...legendaryById.values()],
      source: "mixed",
      sourceForPlayer: (player) => legendarySources.get(String(player.playerId)),
      database: freeAgentsDb,
    };
  }

  function selectWeightedCandidates(available, random, categoryWeights = null) {
    const hasProgressionWeights = categoryWeights && Object.values(categoryWeights).some((weight) => Number(weight) !== 1);
    if (hasProgressionWeights) return global.DraftEngine.selectWeightedCandidates(available, random, categoryWeights, 3);
    return global.DraftEngine.selectCandidates(available, random, 3);
  }

  function selectLegendaryCandidates(available, random) {
    return global.DraftEngine.selectLegendaryCandidates(available, random, categoryRank, "Elite", 3);
  }

  function categoryRank(category) {
    return Number(global.SEASON1_CONFIG.categoryRanks[category] ?? 0);
  }

  function improvedCategory(category) {
    const ranks = global.SEASON1_CONFIG.categoryRanks;
    const ordered = Object.keys(ranks).sort((left, right) => ranks[left] - ranks[right]);
    const index = ordered.indexOf(category);
    return ordered[Math.min(index < 0 ? 0 : index + 1, ordered.length - 1)] || category;
  }

  function pullCandidates(pool, node) {
    if (node.pullState?.candidateIds?.length) {
      return node.pullState.candidateIds.map((id) => pool.players.find((player) => String(player.playerId) === String(id))).filter(Boolean);
    }
    const owned = new Set(run.roster.map((entry) => String(entry.playerId)));
    const excluded = new Set(node.pullState.excludedCandidateIds || []);
    const available = pool.players.filter((player) => !owned.has(String(player.playerId)) && !excluded.has(String(player.playerId)));
    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:pull:${node.pullState.rerolls}`);
    const candidates = node.pullState.pullType === "pull_legendary"
      ? selectLegendaryCandidates(available, random)
      : selectWeightedCandidates(
          available,
          random,
          node.pullState.pullType === "pull_unlocked_teams"
            ? global.RoguelikeRules.unlockedTeamPullCategoryWeights(run.bossIndex)
            : null
        );
    node.pullState.candidateIds = candidates.map((player) => String(player.playerId));
    return candidates;
  }

  function luckyCharmPoolForPull(pullType) {
    if (pullType === "pull_free_agents") return pullPool(pullType);
    if (pullType === "pull_unlocked_teams") return { players: seasonDb.players, source: global.SeasonRegistry.sourceForSeason(run?.seasonId), database: seasonDb };
    return null;
  }

  function chooseLuckyUpgrade(original, available, usedIds, random) {
    const requiredCategory = improvedCategory(original.category);
    const role = original.position;
    const originalId = String(original.playerId);
    const shuffled = global.DraftEngine.shuffle(available.filter((player) => !usedIds.has(String(player.playerId))), random);
    const exactUpgrade = shuffled.filter((player) => player.category === requiredCategory);
    const preferred = exactUpgrade.filter((player) => player.position === role && (requiredCategory !== original.category || String(player.playerId) !== originalId));
    if (preferred.length) return preferred[0];
    const alternatives = exactUpgrade.filter((player) => requiredCategory !== original.category || String(player.playerId) !== originalId);
    if (alternatives.length) return alternatives[0];
    return requiredCategory === original.category && !usedIds.has(originalId) ? original : null;
  }

  function buildLuckyCharmUpgrades(currentCandidates, available, random) {
    if (!Array.isArray(currentCandidates) || currentCandidates.length !== 3) return null;
    const usedIds = new Set();
    const upgradedCandidates = currentCandidates.map((candidate) => {
      const selected = chooseLuckyUpgrade(candidate, available, usedIds, random);
      if (selected) usedIds.add(String(selected.playerId));
      return selected;
    });
    if (upgradedCandidates.length !== 3 || upgradedCandidates.some((candidate) => !candidate)) return null;
    const uniqueIds = new Set(upgradedCandidates.map((candidate) => String(candidate.playerId)));
    if (uniqueIds.size !== 3) return null;
    const validExactRarity = upgradedCandidates.every((candidate, index) => candidate.category === improvedCategory(currentCandidates[index].category));
    return validExactRarity ? upgradedCandidates : null;
  }

  function useLuckyCharmOnPull(node, pullType, currentCandidates) {
    if (!["pull_free_agents", "pull_unlocked_teams"].includes(pullType)) return toast("Portafortuna non utilizzabile in questa selezione.");
    if (node.pullState.luckyCharmUsed) return toast("Portafortuna già utilizzato in questa pull.");
    const luckyCharm = run.inventory.find((item) => item.effect === "lucky_pull");
    if (!luckyCharm) return toast("Nessun Portafortuna disponibile.");
    if (!Array.isArray(currentCandidates) || currentCandidates.length !== 3) return toast("Non è stato possibile migliorare tutti i candidati.");
    const pool = luckyCharmPoolForPull(pullType);
    if (!pool) return toast("Portafortuna non utilizzabile in questa selezione.");
    const owned = new Set(run.roster.map((entry) => String(entry.playerId)));
    const available = pool.players.filter((player) => !owned.has(String(player.playerId)));
    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:lucky:${node.pullState.rerolls}`);
    const upgradedCandidates = buildLuckyCharmUpgrades(currentCandidates, available, random);
    if (!upgradedCandidates || upgradedCandidates.length !== 3) return toast("Non è stato possibile migliorare tutti i candidati.");
    removeInventoryItem(luckyCharm.instanceId);
    global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.LUCKY_CHARM_USED, { nodeId: node.id, itemId: luckyCharm.id, instanceId: luckyCharm.instanceId, actionId: `${run.runId}:${node.id}:lucky_charm` });
    node.pullState.luckyCharmUsed = true;
    node.pullState.candidateIds = upgradedCandidates.map((player) => String(player.playerId));
    global.RunState.save(run);
    openPull(node, pullType);
  }

  function openPull(node, pullType = node.type) {
    const pool = node.pullState?.luckyCharmUsed && ["pull_free_agents", "pull_unlocked_teams"].includes(pullType)
      ? luckyCharmPoolForPull(pullType)
      : pullPool(pullType);
    if (!node.pullState) {
      node.pullState = { pullType, rerolls: 0, excludedCandidateIds: [], luckyCharmUsed: false, candidateIds: [] };
      global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.PULL_OPENED, { nodeId: node.id, pullType, actionId: `${run.runId}:${node.id}:pull_opened` });
    }
    const candidates = pullCandidates(pool, node);
    global.RunState.save(run);
    const level = previousBossLevel();
    const scoutToken = run.inventory.find((item) => item.effect === "pull_reroll");
    const luckyCharm = run.inventory.find((item) => item.effect === "lucky_pull");
    const legendaryPull = pullType === "pull_legendary";
    const luckyCompatible = ["pull_free_agents", "pull_unlocked_teams"].includes(pullType);
    const rerollPull = () => {
      if (legendaryPull) return toast("Il Visore scout non può essere utilizzato nelle pull leggendarie.");
      removeInventoryItem(scoutToken.instanceId);
      global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.REROLL_USED, { nodeId: node.id, itemId: scoutToken.id, instanceId: scoutToken.instanceId, actionId: `${run.runId}:${node.id}:reroll:${node.pullState.rerolls + 1}` });
      node.pullState.excludedCandidateIds.push(...candidates.map((player) => String(player.playerId)));
      node.pullState.rerolls += 1;
      node.pullState.candidateIds = [];
      global.RunState.save(run);
      openPull(node, pullType);
    };
    showPlayerOffer({
      title: global.SEASON1_CONFIG.nodeLabels[pullType].label,
      subtitle: `Scegli 1 giocatore su 3 · Livello ${level}${node.pullState.luckyCharmUsed ? " · Portafortuna già utilizzato" : ""}`,
      candidates,
      source: pool.source,
      sourceForPlayer: pool.sourceForPlayer,
      database: pool.database,
      level,
      allowSkip: true,
      onReroll: scoutToken && !legendaryPull ? rerollPull : null,
      rerollDisabled: false,
      rerollDisabledMessage: "",
      showLuckyCharm: luckyCompatible,
      onLuckyCharm: luckyCompatible && luckyCharm ? () => useLuckyCharmOnPull(node, pullType, candidates) : null,
      luckyCharmCount: run.inventory.filter((item) => item.effect === "lucky_pull").length,
      luckyCharmDisabled: Boolean(!luckyCompatible || node.pullState.luckyCharmUsed || !luckyCharm),
      luckyCharmDisabledMessage: !luckyCompatible ? "Portafortuna non utilizzabile in questa selezione." : node.pullState.luckyCharmUsed ? "Portafortuna già utilizzato" : !luckyCharm ? "Nessun Portafortuna disponibile" : "",
      onPick: (player) => {
        const playerSource = pool.sourceForPlayer ? pool.sourceForPlayer(player) : pool.source;
        recruitPlayer(player, playerSource, level, (added) => {
          finishNonMatchNode(node, added ? `${player.name} entra nella rosa` : "Hai rinunciato al nuovo giocatore");
        });
      },
      onSkip: () => finishNonMatchNode(node, "Hai rinunciato al pull"),
      legendary: legendaryPull,
    });
  }

  function pullChoiceSource(options, player) {
    return options.sourceForPlayer ? options.sourceForPlayer(player) : options.source;
  }

  function pullChoiceDatabase(options, player) {
    const src = pullChoiceSource(options, player);
    return global.SeasonRegistry?.isSeasonSource?.(src) ? (global.SeasonRegistry.database(src) || seasonDb) : options.database;
  }

  function pullChoiceActionPanel(player, index) {
    const panelId = `pull-choice-actions-${index}`;
    return `
      <div class="pull-choice-actions" id="${panelId}" role="group" aria-label="Conferma scelta per ${escapeHtml(player.name)}">
        <div class="button-row pull-choice-action-row">
          <button type="button" class="btn btn-primary" data-pull-action="confirm">SÌ</button>
          <button type="button" class="btn" data-pull-action="cancel">NO</button>
          <button type="button" class="btn btn-yellow" data-pull-action="detail">SCHEDA</button>
        </div>
      </div>`;
  }

  function updateInlinePullSelection(grid, selectedId) {
    grid.querySelectorAll(".pull-choice-option").forEach((option) => {
      const selected = option.dataset.playerId === selectedId;
      option.classList.toggle("is-selected", selected);
      const trigger = option.querySelector("[data-player-id]");
      const actions = option.querySelector(".pull-choice-actions");
      trigger?.setAttribute("aria-expanded", selected ? "true" : "false");
      trigger?.setAttribute("aria-pressed", selected ? "true" : "false");
      actions?.classList.toggle("is-active", selected);
    });
  }

  function showPlayerOffer(options) {
    const scoutItem = resolveItem("scout_token");
    const luckyItem = resolveItem("lucky_charm");
    const rerollButton = options.onReroll
      ? `<button type="button" class="btn btn-yellow" id="reroll-offer" ${options.rerollDisabled ? "disabled" : ""}><span class="pull-item-action-copy">${itemIcon(scoutItem)}<span>Usa ${escapeHtml(scoutItem.name)}</span></span></button>`
      : "";
    const luckyCount = Number(options.luckyCharmCount || 0);
    const luckyButton = options.showLuckyCharm && (options.onLuckyCharm || options.luckyCharmDisabledMessage)
      ? `<button type="button" class="btn btn-yellow" id="lucky-charm-offer" ${options.luckyCharmDisabled ? "disabled" : ""}>${options.luckyCharmDisabled && options.luckyCharmDisabledMessage ? escapeHtml(options.luckyCharmDisabledMessage) : `<span class="pull-item-action-copy">${itemIcon(luckyItem)}<span>Usa ${escapeHtml(luckyItem.name)}</span></span>`}</button>${!options.luckyCharmDisabled && luckyCount > 0 ? `<span class="muted small">${escapeHtml(luckyItem.name)} disponibili: ${luckyCount}</span>` : ""}`
      : "";
    openModal(`
      <div class="modal-head event-modal-head pull-selection-head"><button type="button" class="btn btn-back" id="back-offer-map">← TORNA ALLA MAPPA</button><div><p class="eyebrow">${options.legendary ? "Selezione prestigio" : "Scelta giocatore"}</p><h2>${escapeHtml(options.title)}</h2><p class="muted">${escapeHtml(options.subtitle)}</p></div></div>
      <div class="candidate-grid pull-offer-grid" data-pull-choice-grid>
        ${options.candidates.map((player, index) => {
          const panelId = `pull-choice-actions-${index}`;
          return `<div class="pull-choice-option ${rarityClass(player.category)}" data-player-id="${escapeHtml(player.playerId)}">
            ${playerCard(player, { button: true, context: "pull", level: options.level, database: pullChoiceDatabase(options, player) }).replace(">", ` aria-expanded="false" aria-pressed="false" aria-controls="${panelId}">`)}
            ${pullChoiceActionPanel(player, index)}
          </div>`;
        }).join("")}
      </div>
      ${options.rerollDisabledMessage ? `<p class="muted small">${escapeHtml(options.rerollDisabledMessage)}</p>` : ""}
      <div class="button-row pull-selection-footer">
        ${rerollButton}
        ${luckyButton}
        ${options.allowSkip ? '<button type="button" class="btn btn-ghost" id="skip-offer">RINUNCIA</button>' : ""}
      </div>`,
      { closeable: false, className: `pull-selection-modal ${options.legendary ? "pull-selection-modal--legendary" : ""}` }
    );
    const choiceGrid = modalRoot.querySelector("[data-pull-choice-grid]");
    let selectedPullPlayerId = null;
    let pickConfirmed = false;
    choiceGrid?.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-pull-action]");
      const option = event.target.closest(".pull-choice-option");
      if (!option) return;
      const player = options.candidates.find((candidate) => String(candidate.playerId) === option.dataset.playerId);
      if (!player) return;
      if (!actionButton) {
        selectedPullPlayerId = option.dataset.playerId;
        updateInlinePullSelection(choiceGrid, selectedPullPlayerId);
        return;
      }
      if (actionButton.dataset.pullAction === "cancel") {
        selectedPullPlayerId = null;
        updateInlinePullSelection(choiceGrid, selectedPullPlayerId);
        option.querySelector("[data-player-id]")?.focus({ preventScroll: true });
        return;
      }
      if (actionButton.dataset.pullAction === "detail") {
        const playerDatabase = pullChoiceDatabase(options, player);
        const pullScroll = scrollSnapshot();
        showPlayerDetailsFor(player, {
          playerId: player.playerId,
          level: options.level,
          database: playerDatabase,
          onClose: () => {
            showPlayerOffer(options);
            afterNextPaint(() => {
              const restoredGrid = modalRoot.querySelector("[data-pull-choice-grid]");
              if (!restoredGrid) return;
              selectedPullPlayerId = String(player.playerId);
              updateInlinePullSelection(restoredGrid, selectedPullPlayerId);
              restoreScroll(pullScroll);
              restoredGrid.querySelector(`.pull-choice-option[data-player-id="${cssEscape(player.playerId)}"] [data-pull-action="detail"]`)?.focus({ preventScroll: true });
            });
          },
        });
        return;
      }
      if (actionButton.dataset.pullAction === "confirm") {
        if (pickConfirmed) return;
        pickConfirmed = true;
        actionButton.disabled = true;
        options.onPick(player);
      }
    });
    document.getElementById("reroll-offer")?.addEventListener("click", () => {
      if (options.rerollDisabled) return toast(options.rerollDisabledMessage || "Visore scout non disponibile");
      options.onReroll();
    });
    document.getElementById("lucky-charm-offer")?.addEventListener("click", () => {
      if (options.luckyCharmDisabled || !options.onLuckyCharm) return toast(options.luckyCharmDisabledMessage || "Portafortuna non disponibile");
      options.onLuckyCharm();
    });
    document.getElementById("skip-offer")?.addEventListener("click", options.onSkip);
    document.getElementById("back-offer-map")?.addEventListener("click", () => { closeModal(); renderMap(); });
  }

  function recruitPlayer(player, source, level, done, options = {}) {
    const allowCancel = options.allowCancel !== false;
    if (run.roster.length < global.SEASON1_CONFIG.maxRoster) {
      run.roster.push({ playerId: String(player.playerId), source, level, recruitedAtLevel: level, recruitedOverall: player.overall ?? player.finalOverall ?? null, firstJoinedAt: new Date().toISOString(), recruitmentSource: options.recruitmentSource || source, equippedItem: null, potentialBoost: 0, currentOverallBoost: 0, potentialBoostApplications: [], intensiveTrainingMigrated: true });
      run.bench.push(String(player.playerId));
      global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.PLAYER_RECRUITED, { player, playerId: player.playerId, source: options.recruitmentSource || source, level, overall: player.overall ?? player.finalOverall, actionId: options.actionId || `${run.runId}:${player.playerId}:recruited:${options.recruitmentSource || source}` });
      unlockAlbumRecruit(player.playerId, options.recruitmentSource || source);
      global.RunState.save(run);
      closeModal();
      return done(true);
    }

    const benchPlayers = run.bench.map((id) => resolvedRosterPlayer(id)).filter(Boolean);
    openModal(`
      <div class="modal-head bench-replacement-head"><div><p class="eyebrow">Rosa piena</p><h2>Sostituisci una riserva</h2><p class="muted">Il nuovo giocatore entrerà al posto di una delle quattro riserve.</p></div></div>
      <section class="bench-replacement-incoming" aria-label="Nuovo giocatore scelto">
        <p class="bench-replacement-label">NUOVO GIOCATORE</p>
        ${playerCard(player, { context: "pull", extraClass: "bench-replacement-new-card", level, database: global.SeasonRegistry?.isSeasonSource?.(source) ? (global.SeasonRegistry.database(source) || seasonDb) : freeAgentsDb })}
      </section>
      <section class="bench-replacement-options" aria-label="Riserve sostituibili">
        <p class="bench-replacement-label">SCEGLI LA RISERVA DA SOSTITUIRE</p>
        <div class="player-grid mobile-compact-player-list bench-replacement-grid">
          ${benchPlayers.map((candidate) => playerCard(sourcePlayer(rosterEntry(candidate.playerId)), { button: true, context: "pull", level: candidate.displayLevel, database: global.SeasonRegistry?.isSeasonSource?.(candidate.source) ? (global.SeasonRegistry.database(candidate.source) || seasonDb) : freeAgentsDb })).join("")}
        </div>
      </section>
      ${allowCancel ? '<div class="button-row bench-replacement-footer"><button type="button" class="btn btn-ghost" id="cancel-recruit">RINUNCIA AL NUOVO GIOCATORE</button></div>' : ""}`,
      { closeable: false, className: "pull-selection-modal bench-replacement-modal" }
    );
    modalRoot.querySelectorAll(".bench-replacement-grid [data-player-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const removeId = String(button.dataset.playerId);
        const removedEntry = rosterEntry(removeId);
        const replace = () => {
          if (removedEntry.equippedItem) run.inventory.push(removedEntry.equippedItem);
          run.roster = run.roster.filter((entry) => String(entry.playerId) !== removeId);
          run.bench = run.bench.filter((id) => String(id) !== removeId);
          run.roster.push({ playerId: String(player.playerId), source, level, recruitedAtLevel: level, recruitedOverall: player.overall ?? player.finalOverall ?? null, firstJoinedAt: new Date().toISOString(), recruitmentSource: options.recruitmentSource || source, equippedItem: null, potentialBoost: 0, currentOverallBoost: 0, potentialBoostApplications: [], intensiveTrainingMigrated: true });
          run.bench.push(String(player.playerId));
          global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.PLAYER_RECRUITED, { player, playerId: player.playerId, source: options.recruitmentSource || source, level, overall: player.overall ?? player.finalOverall, actionId: options.actionId || `${run.runId}:${player.playerId}:recruited:${options.recruitmentSource || source}` });
          unlockAlbumRecruit(player.playerId, options.recruitmentSource || source);
          global.FiveVFive.removeUnavailable(run);
          global.RunState.save(run);
          closeModal();
          done(true);
        };
        if (removedEntry.equippedItem && run.inventory.length >= global.SEASON1_CONFIG.maxInventory) {
          return chooseInventoryDiscard(
            "Libera uno spazio per recuperare l'oggetto equipaggiato",
            replace,
            () => recruitPlayer(player, source, level, done, options)
          );
        }
        replace();
      });
    });
    document.getElementById("cancel-recruit")?.addEventListener("click", () => {
      closeModal();
      done(false);
    });
  }

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
        <span class="boss-match-logo route-boss-preview-logo">${meta.logoUrl ? `<img src="${escapeHtml(meta.logoUrl)}" alt="${escapeHtml(meta.name)}" />` : "⚽"}</span>
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
        const source = seasonPlayersById.get(String(slot.playerId));
        if (!source) return null;
        const resolved = global.InazumaProgression.getPlayerAtLevel(source, Math.floor(Number(slot.level ?? level)), seasonDb);
        return { ...resolved, displayLevel: Number(slot.level ?? level), source: global.SeasonRegistry.sourceForSeason(run?.seasonId), playerId: String(slot.playerId) };
      })
      .filter(Boolean);
  }

  function userTeamPlayers() {
    return (run.lineup || []).slice(0, 11).map((id) => resolvedRosterPlayer(id)).filter(Boolean);
  }

  function formationRows(formationId, players) {
    const formation = formationById(formationId) || formationById("4-3-3") || { requirements: { FW: 3, MF: 3, DF: 4, GK: 1 } };
    let cursor = 0;
    return ["FW", "MF", "DF", "GK"].map((role) => {
      const count = Number(formation.requirements?.[role] || 0);
      const row = { role, players: players.slice(cursor, cursor + count) };
      cursor += count;
      return row;
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
      level: player.displayLevel ?? player.level ?? 0,
      overall: player.overall ?? player.finalOverall ?? "-",
      dataAttr: `data-boss-player="${escapeHtml(player.playerId)}" data-boss-side="${side}" ${readonly ? 'aria-label="Apri scheda ' + escapeHtml(player.name) + '"' : ""}`,
      extraClass: `match-player-card match-player-card--${side} boss-match-card boss-match-card--${side}`,
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

  function bossMatchStatusText() {
    return {
      "pre-match": "Pre-partita",
      simulating: "Simulazione in corso",
      "completed-victory": "Vittoria completata",
      "completed-defeat": "Sconfitta completata",
    }[ui.bossMatchState] || "Pre-partita";
  }



  function clearMatchPlaybackTimer() {
    if (ui.matchPlaybackTimer) {
      clearTimeout(ui.matchPlaybackTimer);
      ui.matchPlaybackTimer = null;
    }
  }

  function matchSeed(match) {
    if (match.simulation?.seed && match.simulation?.state !== "pre-match") return match.simulation.seed;
    return `${run.runId}:${match.type}:${match.nodeId}:${match.attemptNumber || 1}`;
  }

  function normalizedMatchPlayer(player) {
    return player ? { ...player, role: player.position, playerId: String(player.playerId) } : null;
  }

  function matchLineupSignature(players) {
    return players.map((player) => [player.playerId, player.displayLevel ?? player.level ?? "", player.overall ?? player.finalOverall ?? ""].join(":")).join("|");
  }

  function matchSnapshotFromTeam(team) {
    return {
      name: team.name,
      playerIds: team.players.map((player) => String(player.playerId)),
      lineupSignature: matchLineupSignature(team.players),
      players: team.players.map((player) => ({ ...player })),
    };
  }

  function simulationTeamsForCurrentMatch(match, options = {}) {
    if (match.type === "five_v_five") {
      const userPlayersBySlot = fiveUserPlayersBySlot();
      const opponentPlayersBySlot = fiveOpponentPlayersBySlot(match);
      const userPlayers = Object.values(userPlayersBySlot).map(normalizedMatchPlayer).filter(Boolean);
      const opponentPlayers = Object.values(opponentPlayersBySlot).map(normalizedMatchPlayer).filter(Boolean);
      return {
        type: "five",
        userTeam: { name: normalizeTeamIdentity(run.teamIdentity).name || "La tua squadra", players: userPlayers },
        opponentTeam: { name: "Svincolati", players: opponentPlayers },
        userSnapshot: matchSnapshotFromTeam({ name: normalizeTeamIdentity(run.teamIdentity).name || "La tua squadra", players: userPlayers }),
      };
    }
    const boss = options.boss || seasonDb.bossOrder[run.bossIndex];
    const meta = bossMatchTeamMeta(boss);
    const userPlayers = userTeamPlayers().map(normalizedMatchPlayer).filter(Boolean);
    const opponentPlayers = bossTeamPlayers(boss).map(normalizedMatchPlayer).filter(Boolean);
    return {
      type: "eleven",
      userTeam: { name: meta.user.name, players: userPlayers, formationId: meta.user.formation },
      opponentTeam: { name: meta.boss.name, players: opponentPlayers, formationId: meta.boss.formation },
      userSnapshot: matchSnapshotFromTeam({ name: meta.user.name, players: userPlayers }),
    };
  }

  function ensureMatchPreview(match, options = {}) {
    const existingState = match.simulation?.state || match.state || "pre-match";
    if (match.simulation?.valid && existingState !== "pre-match" && !options.forceRefresh) return match.simulation;
    const teams = simulationTeamsForCurrentMatch(match, options);
    if (match.simulation?.valid && existingState === "pre-match" && !options.forceRefresh && match.simulation.userSnapshot?.lineupSignature === teams.userSnapshot.lineupSignature) return match.simulation;
    const seed = options.freeze ? matchSeed(match) : (match.simulation?.seed || `${run.runId}:${match.type}:${match.nodeId}:preview`);
    const preview = global.MatchSimulator.simulate({ type: teams.type, seed, userTeam: teams.userTeam, opponentTeam: teams.opponentTeam });
    if (!preview.valid) return preview;
    match.simulation = {
      ...preview,
      seed: options.freeze ? seed : null,
      state: options.freeze ? "pre-match" : existingState,
      revealedCount: options.freeze ? 0 : (match.simulation?.revealedCount || 0),
      displayedScore: options.freeze ? { user: 0, opponent: 0 } : (match.simulation?.displayedScore || { user: 0, opponent: 0 }),
      resolutionApplied: options.freeze ? false : Boolean(match.simulation?.resolutionApplied),
      manuallyResolved: options.freeze ? false : Boolean(match.simulation?.manuallyResolved),
      userSnapshot: teams.userSnapshot,
    };
    if (options.freeze) match.matchId = global.RunStatistics?.createStableMatchId?.(run, { ...match, simulation: { seed } }) || match.matchId;
    match.lineupSnapshot = teams.userSnapshot;
    match.userPlayerIds = teams.userSnapshot.playerIds.slice();
    match.userStrength = match.simulation.userStrength;
    match.probabilities = match.simulation.probabilities;
    match.score = [match.simulation.displayedScore.user, match.simulation.displayedScore.opponent];
    return match.simulation;
  }

  function simulationScoreArray(match, completed = false) {
    const sim = match?.simulation;
    if (!sim?.valid) return match?.score || [0, 0];
    const source = completed || sim.state === "completed" ? sim.score : sim.displayedScore;
    return [source.user, source.opponent];
  }

  function visibleTimeline(match) {
    const sim = match?.simulation;
    if (!sim?.valid) return ui.bossMatchLog || [];
    return sim.timeline.slice(0, sim.revealedCount).map(matchEventView);
  }

  function matchEventSideClass(side) {
    return side === "user" ? "match-event--user" : side === "opponent" ? "match-event--opponent" : "match-event--neutral";
  }

  function matchEventView(ev) {
    return { minute: `${ev.minute}'`, icon: ({goal:"⚽",save:"🧤",counter:"⚡",long_shot:"🎯",post:"🥅",crossbar:"🥅",shot:"👟",defensive_stop:"🛡️",first_half_start:"▶",second_half_start:"▶"})[ev.type] || "•", text: ev.text, side: ev.team === "user" || ev.team === "opponent" ? ev.team : null };
  }

  function appendMatchLogEvent(event) {
    const log = document.querySelector(".match-sim-log");
    if (!log) return false;
    if (log.querySelector("[data-empty-log]")) log.innerHTML = "";
    const li = document.createElement("li");
    li.className = matchEventSideClass(event.side);
    const minute = document.createElement("span");
    const icon = document.createElement("b");
    const text = document.createElement("p");
    minute.textContent = event.minute;
    icon.textContent = event.icon;
    text.textContent = event.text;
    li.append(minute, icon, text);
    log.appendChild(li);
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    return true;
  }

  function appendMissingMatchLogEvents(events) {
    const log = document.querySelector(".match-sim-log");
    if (!log) return false;
    if (log.querySelector("[data-empty-log]")) log.innerHTML = "";
    const fragment = document.createDocumentFragment();
    events.forEach((event) => {
      const li = document.createElement("li");
      li.className = matchEventSideClass(event.side);
      const minute = document.createElement("span");
      const icon = document.createElement("b");
      const text = document.createElement("p");
      minute.textContent = event.minute;
      icon.textContent = event.icon;
      text.textContent = event.text;
      li.append(minute, icon, text);
      fragment.appendChild(li);
    });
    log.appendChild(fragment);
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    return true;
  }

  function updateMatchScoreDom(match, completed = false) {
    const score = simulationScoreArray(match, completed);
    const values = document.querySelectorAll(".boss-match-score span");
    if (values[0]) values[0].textContent = score[0];
    if (values[1]) values[1].textContent = score[1];
  }

  function updateMatchControlsDom() {
    const state = ui.bossMatchState;
    const resolved = state.startsWith("completed");
    const simulating = state === "simulating";
    const simulate = document.getElementById("simulate-boss-match");
    const skip = document.getElementById("skip-match-result");
    const cont = document.getElementById("continue-match-result");
    const status = document.querySelector(".boss-match-result-panel p");
    if (simulate) {
      simulate.disabled = Boolean(ui.matchStartLocked) || simulating || resolved;
      simulate.textContent = ui.matchStartLocked ? "Avvio..." : simulating ? "Simulazione..." : "Simula partita";
    }
    if (skip) {
      skip.hidden = !simulating;
      skip.disabled = !simulating;
    }
    if (cont) {
      cont.hidden = !resolved;
      cont.disabled = !resolved || Boolean(ui.match?.postMatchNavigationApplied);
    }
    if (status) status.textContent = bossMatchStatusText();
  }

  function stepMatchPlayback() {
    const match = ui.match;
    const sim = match?.simulation;
    if (!sim || sim.state !== "simulating" || sim.manuallyResolved) return;
    if (sim.revealedCount >= sim.timeline.length) {
      sim.state = "completed";
      sim.displayedScore = { ...sim.score };
      match.score = [sim.score.user, sim.score.opponent];
      ui.bossMatchState = sim.winner === "user" ? "completed-victory" : "completed-defeat";
      match.state = ui.bossMatchState;
      persistMatchState();
      return applySimulationResolution(match);
    }
    const ev = sim.timeline[sim.revealedCount];
    sim.revealedCount += 1;
    if (ev.type === "goal") sim.displayedScore[ev.team] += 1;
    match.score = [sim.displayedScore.user, sim.displayedScore.opponent];
    ui.bossMatchLog = [...(ui.bossMatchLog || []), matchEventView(ev)];
    persistMatchState();
    appendMatchLogEvent(matchEventView(ev));
    updateMatchScoreDom(match);
    updateMatchControlsDom();
    document.getElementById(match.type === "five_v_five" ? "five-match-log-panel" : "")?.scrollIntoView({ block: "nearest" });
    ui.matchPlaybackTimer = setTimeout(stepMatchPlayback, global.MatchSimulatorConfig.eventDelayMs || global.MatchSimulatorConfig.playbackMs);
  }

  function startMatchSimulation(match, options = {}) {
    if (ui.matchStartLocked || match?.simulation?.state === "simulating") return;
    if (match.simulation?.state && match.simulation.state !== "pre-match") return;
    ui.matchStartLocked = true;
    updateMatchControlsDom();
    let sim;
    try {
      sim = ensureMatchPreview(match, { ...options, forceRefresh: true, freeze: true });
      if (!sim.valid) {
        ui.matchStartLocked = false;
        updateMatchControlsDom();
        return toast(sim.message || "Formazione non valida: impossibile simulare.");
      }
    } catch (error) {
      console.error("Match simulation failed to start", error);
      ui.matchStartLocked = false;
      updateMatchControlsDom();
      toast("Errore tecnico: impossibile avviare la simulazione.");
      return;
    }
    sim.seed = sim.seed || matchSeed(match);
    sim.state = "simulating";
    sim.revealedCount = 0;
    sim.displayedScore = { user: 0, opponent: 0 };
    sim.resolutionApplied = false;
    match.state = "simulating";
    ui.bossMatchState = "simulating";
    ui.bossMatchLog = [];
    match.score = [0, 0];
    persistMatchState();
    clearMatchPlaybackTimer();
    ui.matchStartLocked = false;
    updateMatchControlsDom();
    document.getElementById(match.type === "five_v_five" ? "five-match-log-panel" : "")?.scrollIntoView({ block: "nearest" });
    ui.matchPlaybackTimer = setTimeout(stepMatchPlayback, global.MatchSimulatorConfig.eventDelayMs || global.MatchSimulatorConfig.playbackMs);
  }

  function resumeMatchSimulationIfNeeded(match) {
    const sim = match?.simulation;
    if (!sim || sim.state !== "simulating") return;
    clearMatchPlaybackTimer();
    ui.matchPlaybackTimer = setTimeout(stepMatchPlayback, global.MatchSimulatorConfig.eventDelayMs || global.MatchSimulatorConfig.playbackMs);
  }

  function skipMatchToResult(event) {
    event?.preventDefault();
    const match = ui.match;
    const sim = match?.simulation;
    if (!sim || sim.state !== "simulating" || sim.manuallyResolved) return;
    clearMatchPlaybackTimer();
    const missing = sim.timeline.slice(sim.revealedCount).map(matchEventView);
    sim.revealedCount = sim.timeline.length;
    sim.displayedScore = { ...sim.score };
    sim.state = "completed";
    match.score = [sim.score.user, sim.score.opponent];
    ui.bossMatchState = sim.winner === "user" ? "completed-victory" : "completed-defeat";
    match.state = ui.bossMatchState;
    ui.bossMatchLog = visibleTimeline(match);
    persistMatchState();
    appendMissingMatchLogEvents(missing);
    updateMatchScoreDom(match, true);
    updateMatchControlsDom();
    document.getElementById(match.type === "five_v_five" ? "five-match-result-panel" : "")?.scrollIntoView({ block: "nearest" });
    applySimulationResolution(match);
  }

  function applySimulationResolution(match) {
    const sim = match?.simulation;
    if (!sim || sim.resolutionApplied || sim.manuallyResolved) return;
    sim.winner === "user" ? (match.type === "five_v_five" ? completeFiveMatch("victory") : completeBossMatch("victory")) : (match.type === "five_v_five" ? completeFiveMatch("defeat") : completeBossMatch("defeat"));
  }

  function forceMatchOutcome(result, options = {}) {
    const match = ui.match;
    if (!match || ui.matchStartLocked || match.simulation?.resolutionApplied) return;
    ui.matchStartLocked = true;
    updateMatchControlsDom();
    try {
      clearMatchPlaybackTimer();
      const sim = ensureMatchPreview(match, { ...options, forceRefresh: !match.simulation?.valid, freeze: true });
      if (!sim.valid) {
        ui.matchStartLocked = false;
        updateMatchControlsDom();
        return toast(sim.message || "Formazione non valida: impossibile forzare il risultato.");
      }
      const winner = result === "victory" ? "user" : "opponent";
      sim.forcedOutcome = winner === "user" ? "win" : "loss";
      sim.testControl = true;
      sim.state = "completed";
      sim.winner = winner;
      sim.revealedCount = sim.timeline?.length || 0;
      const currentUser = Number(sim.score?.user ?? 0);
      const currentOpponent = Number(sim.score?.opponent ?? 0);
      if (winner === "user" && currentUser <= currentOpponent) sim.score = { user: currentOpponent + 1, opponent: currentOpponent };
      if (winner === "opponent" && currentOpponent <= currentUser) sim.score = { user: currentUser, opponent: currentUser + 1 };
      sim.displayedScore = { ...sim.score };
      match.score = [sim.score.user, sim.score.opponent];
      match.forcedOutcome = sim.forcedOutcome;
      match.testControl = true;
      ui.bossMatchLog = visibleTimeline(match);
      ui.bossMatchState = winner === "user" ? "completed-victory" : "completed-defeat";
      match.state = ui.bossMatchState;
      persistMatchState();
      winner === "user" ? (match.type === "five_v_five" ? completeFiveMatch("victory") : completeBossMatch("victory")) : (match.type === "five_v_five" ? completeFiveMatch("defeat") : completeBossMatch("defeat"));
    } catch (error) {
      console.error("Forced match outcome failed", error);
      toast("Errore tecnico: impossibile forzare il risultato.");
    } finally {
      ui.matchStartLocked = false;
      updateMatchControlsDom();
    }
  }


  const fiveMatchMarkupCache = new Map();
  function fiveMatchCacheKey(prefix, ...parts) { return [prefix, ...parts.map((part) => String(part ?? ""))].join("|"); }
  function memoizedFiveMatchMarkup(key, factory) {
    if (fiveMatchMarkupCache.size > 80) fiveMatchMarkupCache.clear();
    if (!fiveMatchMarkupCache.has(key)) fiveMatchMarkupCache.set(key, factory());
    return fiveMatchMarkupCache.get(key);
  }

  function fiveFormationRows(formationId, playersBySlot) {
    const formation = global.FiveVFive.formationById(formationId);
    return ["attack", "midfield", "defense", "goal"].map((line) => ({
      line,
      players: formation.slots.filter((slot) => slot.line === line).map((slot) => playersBySlot[slot.key]).filter(Boolean),
    })).filter((row) => row.players.length);
  }

  function fiveUserPlayersBySlot() {
    ensureFiveVFive();
    return Object.fromEntries(Object.entries(run.fiveVFive.slots).map(([slot, id]) => [slot, resolvedRosterPlayer(id)]));
  }

  function fiveOpponentLevel() {
    return Math.max(0, Math.floor(Number(run.teamLevel || 0)));
  }

  function createOrLoadFiveMatch(node) {
    if (run.activeMatch?.type === "five_v_five" && run.activeMatch.nodeId === node.id && run.activeMatch.opponents?.length === 5) return run.activeMatch;
    const opponentRandom = global.DraftEngine.randomFromSeed(`${run.runId}:${node.id}:fiveOpponents`);
    const formation = opponentRandom() < 0.5 ? "1-2-1" : "1-1-2";
    const slots = global.FiveVFive.formationById(formation).slots;
    const userIds = new Set((run.roster || []).map((entry) => String(entry.playerId)));
    const used = new Set();
    const opponents = slots.map((slot) => {
      const pool = (freeAgentsDb.players || []).filter((player) => !used.has(String(player.playerId)) && !userIds.has(String(player.playerId)) && player.position === slot.role);
      const fallback = (freeAgentsDb.players || []).filter((player) => !used.has(String(player.playerId)) && !userIds.has(String(player.playerId)));
      const availablePool = pool.length ? pool : fallback;
      const source = availablePool[Math.floor(opponentRandom() * availablePool.length)];
      if (!source) return null;
      used.add(String(source.playerId));
      return { slotKey: slot.key, playerId: String(source.playerId) };
    }).filter(Boolean);
    const attempts = Object.keys(run.statistics?.processedMatchIds || {}).filter((id) => id.includes(`::${node.id}::five_v_five::`)).length + 1;
    const match = {
      nodeId: node.id,
      previousNodeId: run.currentZone?.currentNodeId || run.activeMatch?.previousNodeId || null,
      type: "five_v_five",
      state: "pre-match",
      result: null,
      level: fiveOpponentLevel(),
      opponentFormation: formation,
      opponents,
      log: [],
      score: [0, 0],
      attemptNumber: attempts,
    };
    match.matchId = global.RunStatistics?.createStableMatchId?.(run, match) || null;
    return match;
  }

  function fiveOpponentPlayersBySlot(match) {
    const level = Number(match.level ?? fiveOpponentLevel());
    return Object.fromEntries((match.opponents || []).map((opponent) => {
      const source = freeAgentsById.get(String(opponent.playerId));
      if (!source) return [opponent.slotKey, null];
      const resolved = global.InazumaProgression.getPlayerAtLevel(source, Math.floor(level), freeAgentsDb);
      return [opponent.slotKey, { ...resolved, displayLevel: level, source: "free_agents", playerId: String(opponent.playerId) }];
    }));
  }

  function fiveMatchCard(player, side) {
    const equipment = side === "user" ? (player.equipment || rosterEntry(player.playerId)?.equippedItem) : null;
    const equipmentKey = equipment ? `${equipment.instanceId || equipment.id || "item"}:${equipment.id || ""}` : "";
    const key = fiveMatchCacheKey("card", side, player.playerId, player.name, player.position, player.overall, player.displayLevel, player.category, playerPortraitUrl(player), equipmentKey);
    return memoizedFiveMatchMarkup(key, () => `
      <button type="button" class="five-match-card five-match-card--${side} ${rarityClass(player.category)}" data-five-match-player="${escapeHtml(player.playerId)}" data-five-match-side="${side}" aria-label="Apri scheda ${escapeHtml(player.name)}">
        <span class="five-match-card-role">${escapeHtml(player.position)}</span>
        <span class="five-match-card-overall">${escapeHtml(player.overall ?? "-")}</span>
        <img src="${escapeHtml(playerPortraitUrl(player))}" alt="" loading="lazy" decoding="async" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} />
        <strong>${escapeHtml(shortName(player.name))}</strong>
        <small>Lv ${escapeHtml(player.displayLevel ?? 0)}</small>
        ${fivePlayerEquipmentMarkup(equipment)}
      </button>`);
  }

  function fiveMatchField(playersBySlot, formationId, side, mobile = false) {
    const slotKey = Object.entries(playersBySlot || {}).map(([slot, player]) => `${slot}:${player?.playerId || ""}:${player?.overall || ""}:${player?.displayLevel || ""}`).join(",");
    const key = fiveMatchCacheKey("field", formationId, side, mobile ? "mobile" : "desktop", slotKey);
    return memoizedFiveMatchMarkup(key, () => `<div class="five-match-field-side five-match-field-side--${side} ${mobile ? "five-match-field-side--mobile" : ""}" data-five-field-side="${side}" ${mobile ? "" : ""}>
      ${fiveFormationRows(formationId, playersBySlot).map((row) => `<div class="five-match-line five-match-line--${row.line}" data-row-count="${row.players.length}" style="--five-row-count:${row.players.length || 1}">${row.players.map((player) => fiveMatchCard(player, side)).join("")}</div>`).join("")}
    </div>`);
  }


  function fiveMatchStatAverage(players, statNames) {
    const list = (players || []).filter(Boolean);
    if (!list.length) return "-";
    const totals = list.map((player) => {
      const stats = player.finalStats || player.stats || {};
      const values = statNames.map((name) => Number(stats[name] ?? 0)).filter((value) => Number.isFinite(value));
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    });
    return Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length);
  }

  function fiveMatchComparisonMarkup(userPlayers, opponentPlayers) {
    const rows = [
      ["Attacco", ["attack"], ["attack"]],
      ["Controllo", ["control"], ["control"]],
      ["Difesa", ["defense", "grit"], ["defense", "grit"]],
      ["Velocità", ["speed"], ["speed"]],
      ["Portiere", ["save"], ["save"]],
    ];
    return `<div class="five-match-traits" aria-label="Confronto sintetico valori reali">${rows.map(([label, userStats, opponentStats]) => {
      const userValue = fiveMatchStatAverage(userPlayers, userStats);
      const opponentValue = fiveMatchStatAverage(opponentPlayers, opponentStats);
      return `<div class="five-match-trait"><span>${escapeHtml(label)}</span><strong>${escapeHtml(userValue)}</strong><small>${escapeHtml(opponentValue)}</small></div>`;
    }).join("")}</div>`;
  }

  function persistMatchState() {
    if (!ui.match) return;
    ui.match.state = ui.bossMatchState;
    ui.match.log = ui.bossMatchLog;
    run.activeMatch = ui.match;
    global.RunState.save(run);
  }

  function renderMatch() {
    const boss = seasonDb.bossOrder[run.bossIndex];
    const isBoss = ui.match?.type === "boss";
    if (!isBoss) {
      const match = createOrLoadFiveMatch({ id: ui.match?.nodeId });
      ui.match = match;
      run.activeMatch = match;
      ui.bossMatchState = match.state || ui.bossMatchState || "pre-match";
      ui.bossMatchLog = match.log || ui.bossMatchLog || [];
      ensureFiveVFive();
      const userPlayersBySlot = fiveUserPlayersBySlot();
      const opponentPlayersBySlot = fiveOpponentPlayersBySlot(match);
      const identity = normalizeTeamIdentity(run.teamIdentity);
      const userName = identity.name || "La tua squadra";
      const opponentName = "Svincolati";
      const simPreview = ensureMatchPreview(match);
      const userFivePlayers = Object.values(userPlayersBySlot).filter(Boolean);
      const opponentFivePlayers = Object.values(opponentPlayersBySlot).filter(Boolean);
      const userAverageOverall = simPreview.userStrength?.averageOverall ? Math.round(simPreview.userStrength.averageOverall) : bossMatchAverage(userFivePlayers) || "-";
      const opponentAverageOverall = simPreview.opponentStrength?.averageOverall ? Math.round(simPreview.opponentStrength.averageOverall) : bossMatchAverage(opponentFivePlayers) || "-";
      const simError = !simPreview.valid ? simPreview.message : "";
      ui.bossMatchLog = visibleTimeline(match);
      const activeSide = ui.fiveMatchTab === "opponent" ? "opponent" : "user";
      const resolved = ui.bossMatchState.startsWith("completed");
      const simulating = ui.bossMatchState === "simulating";
      const score = simulationScoreArray(match, resolved);
      const scoreLabel = `${userName} ${score[0]} - ${score[1]} ${opponentName}`;
      app.innerHTML = `
        <main class="screen five-match-screen" data-match-state="${escapeHtml(ui.bossMatchState)}">
          ${topbar("Partita 5v5")}
          <div class="content five-match-content">
            <section class="panel five-match-hero">
              <button type="button" class="btn btn-back five-match-header-back" data-nav="map" aria-label="Torna alla mappa">← <span class="five-match-back-full">Torna al percorso</span><span class="five-match-back-short">Percorso</span></button>
              <div class="five-match-header-main"><p class="eyebrow five-match-run-meta">Run Lv ${escapeHtml(run.teamLevel)} · ${hearts()}</p><h2>Partita 5v5</h2><span class="match-state-badge">${resolved ? "Completata" : simulating ? "In corso" : "Preparazione"}</span></div>
              <div class="five-match-vs">
                <div class="five-match-team"><span class="five-match-logo">⚡</span><strong>${escapeHtml(userName)}</strong><small>${escapeHtml(run.fiveVFive.formation)} · OVR ${escapeHtml(userAverageOverall)} · Forza ${escapeHtml(simPreview.userStrength?.final ?? "-")}</small></div>
                <span class="five-match-vs-badge">VS</span>
                <div class="five-match-team"><span class="five-match-logo">⚽</span><strong>${opponentName}</strong><small>${escapeHtml(match.opponentFormation)} · OVR ${escapeHtml(opponentAverageOverall)} · Forza ${escapeHtml(simPreview.opponentStrength?.final ?? "-")}</small></div>
              </div>
            </section>
            <section class="panel five-match-pitch-panel">
              <div class="five-match-tabs" role="tablist" aria-label="Squadra visualizzata">
                <button type="button" class="five-match-team-tab ${activeSide === "user" ? "active" : ""}" data-five-match-tab="user">La tua squadra</button>
                <button type="button" class="five-match-team-tab ${activeSide === "opponent" ? "active" : ""}" data-five-match-tab="opponent">Svincolati</button>
              </div>
              <div class="five-match-field" aria-label="Campo partita 5v5">
                <div class="five-match-half-label five-match-half-label--user">${escapeHtml(userName)}</div>
                <div class="five-match-half-label five-match-half-label--opponent">${opponentName}</div>
                ${fiveMatchField(userPlayersBySlot, run.fiveVFive.formation, "user")}
                ${fiveMatchField(opponentPlayersBySlot, match.opponentFormation, "opponent")}
                <div class="five-match-mobile-field">${fiveMatchField(activeSide === "opponent" ? opponentPlayersBySlot : userPlayersBySlot, activeSide === "opponent" ? match.opponentFormation : run.fiveVFive.formation, activeSide, true)}</div>
              </div>
            </section>
            <section class="five-match-summary" aria-label="Riepilogo partita 5v5">
              <div><span>La tua forza</span><strong>${escapeHtml(simPreview.userStrength?.final ?? "-")}</strong><small>${escapeHtml(run.fiveVFive.formation)} · OVR ${escapeHtml(userAverageOverall)}</small></div>
              <div class="five-match-probability"><span>Probabilità vittoria</span><strong>${escapeHtml(simPreview.probabilities ? Math.round(simPreview.probabilities.user * 100) : "-")}%</strong><small>Dato usato dalla simulazione</small></div>
              <div><span>Forza Svincolati</span><strong>${escapeHtml(simPreview.opponentStrength?.final ?? "-")}</strong><small>${escapeHtml(match.opponentFormation)} · OVR ${escapeHtml(opponentAverageOverall)}</small></div>
              ${fiveMatchComparisonMarkup(userFivePlayers, opponentFivePlayers)}
            </section>
            ${simError ? `<div class="match-sim-error">${escapeHtml(simError)}</div>` : ""}
            <div class="five-match-bottom-grid">
              <section class="panel boss-match-log-panel five-match-log-panel" id="five-match-log-panel"><div class="panel-title-row"><div><p class="eyebrow">30 minuti · 8-10 eventi</p><h3>Cronaca</h3></div><span class="match-state-badge">${simulating ? "Live" : resolved ? "Completa" : "In attesa"}</span></div><ol class="boss-match-log match-sim-log" tabindex="0" aria-label="Cronaca partita" aria-live="polite">${bossMatchTimeline()}</ol></section>
              <section class="panel boss-match-result-panel five-match-result-panel" id="five-match-result-panel"><p class="eyebrow">Esito partita</p><h3>Risultato</h3><div class="five-match-scoreline" aria-live="polite">${escapeHtml(scoreLabel)}</div><div class="boss-match-score" aria-hidden="true"><span>${score[0]}</span><small>-</small><span>${score[1]}</span></div><p>${escapeHtml(bossMatchStatusText())}</p><div class="boss-match-score-teams"><span>${escapeHtml(userName)}</span><span>${opponentName}</span></div><div class="result-badges"><span>${resolved && ui.bossMatchState.endsWith("victory") ? "+0,5 livello" : "Vite " + run.lives}</span><span>${resolved ? "Nodo di ritorno salvato" : "Snapshot pronta"}</span></div></section>
            </div>
          </div>
          <section class="panel five-match-controls five-v-five-mobile-actions" aria-label="Azioni partita 5v5"><button type="button" class="btn btn-yellow btn-primary-action" id="simulate-boss-match" ${simulating || resolved ? "disabled" : ""}>${simulating ? "Simulazione..." : "Simula partita"}</button><button type="button" class="btn btn-secondary" id="skip-match-result" ${simulating ? "" : "hidden disabled"}>Vai al risultato</button><button type="button" class="btn btn-yellow btn-primary-action" id="continue-match-result" ${resolved ? "" : "hidden disabled"}>Torna alla mappa</button><div class="button-row"><button type="button" class="btn btn-secondary" id="edit-five-team" ${resolved ? "disabled" : ""}>Modifica squadra</button>${TEST_MATCH_CONTROLS_ENABLED ? `<div class="match-test-tools"><span>Strumenti di test</span><button type="button" class="btn btn-tool" id="test-win" ${resolved ? "disabled" : ""}>Vittoria sicura</button>${DEV_MODE ? `<button type="button" class="btn btn-danger" id="test-loss" ${resolved ? "disabled" : ""}>Sconfitta forzata</button>` : ""}</div>` : ""}<button type="button" class="btn btn-back" data-nav="map">← Torna al percorso</button></div></section>
        </main>`;
      resetRenderedViewScroll();
      bindSectionRootNav();
      bindBottomNav();
      document.querySelectorAll("[data-five-match-tab]").forEach((button) => button.addEventListener("click", () => {
        ui.fiveMatchTab = button.dataset.fiveMatchTab;
        document.querySelectorAll("[data-five-match-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.fiveMatchTab === ui.fiveMatchTab));
        const mobileField = document.querySelector(".five-match-mobile-field");
        if (mobileField) mobileField.innerHTML = ui.fiveMatchTab === "opponent"
          ? fiveMatchField(opponentPlayersBySlot, match.opponentFormation, "opponent", true)
          : fiveMatchField(userPlayersBySlot, run.fiveVFive.formation, "user", true);
        bindFiveMatchPlayerButtons();
      }));
      const bindFiveMatchPlayerButtons = () => document.querySelectorAll("[data-five-match-player]").forEach((button) => {
        if (button.dataset.boundFiveMatchPlayer === "1") return;
        button.dataset.boundFiveMatchPlayer = "1";
        button.addEventListener("click", () => {
          const id = button.dataset.fiveMatchPlayer;
          if (button.dataset.fiveMatchSide === "user") return showPlayerDetails(id);
          const player = Object.values(opponentPlayersBySlot).find((candidate) => String(candidate?.playerId) === String(id));
          showPlayerDetailsFor(player, { playerId: id, level: player?.displayLevel, database: freeAgentsDb, preserveScroll: scrollSnapshot() });
        });
      });
      bindFiveMatchPlayerButtons();
      document.getElementById("edit-five-team").addEventListener("click", () => { ui.returnToMatchContext = { type: match.type, nodeId: match.nodeId, scroll: scrollSnapshot() }; match.returnScroll = ui.returnToMatchContext.scroll; persistMatchState(); renderFiveVFive({ returnToMatch: true }); });
      document.getElementById("test-win")?.addEventListener("click", (event) => { event.preventDefault(); forceMatchOutcome("victory"); });
      document.getElementById("test-loss")?.addEventListener("click", (event) => { event.preventDefault(); forceMatchOutcome("defeat"); });
      document.getElementById("simulate-boss-match").addEventListener("click", (event) => { event.preventDefault(); startMatchSimulation(match); });
      document.getElementById("skip-match-result")?.addEventListener("click", skipMatchToResult);
      document.getElementById("continue-match-result")?.addEventListener("click", continueAfterMatch);
      persistMatchState();
      resumeMatchSimulationIfNeeded(match);
      return;
    }

    const userPlayers = userTeamPlayers();
    const bossPlayers = bossTeamPlayers(boss);
    const meta = bossMatchTeamMeta(boss);
    const userAverage = bossMatchAverage(userPlayers);
    const bossAverage = bossMatchAverage(bossPlayers);
    const activeSide = ui.bossMatchTab === "boss" ? "boss" : "user";
    const resolved = ui.bossMatchState.startsWith("completed");
    const simulating = ui.bossMatchState === "simulating";
    const simPreview = ensureMatchPreview(ui.match, { boss });
    const simError = !simPreview.valid ? simPreview.message : "";
    const userProbability = simPreview.probabilities ? Math.round(simPreview.probabilities.user * 100) : null;
    const bossProbability = simPreview.probabilities ? Math.round(simPreview.probabilities.opponent * 100) : null;
    ui.bossMatchLog = visibleTimeline(ui.match);
    const score = simulationScoreArray(ui.match, resolved);
    const scoreLabel = `${meta.user.name} ${score[0]} - ${score[1]} ${meta.boss.name}`;
    const bossStatusLabel = resolved ? (ui.bossMatchState.endsWith("victory") ? "Vittoria" : "Sconfitta") : simulating ? "In corso" : "Preparazione";
    const outcomeClass = resolved ? (ui.bossMatchState.endsWith("victory") ? "boss-match-result-panel--victory" : "boss-match-result-panel--defeat") : "";

    app.innerHTML = `
      <main class="screen boss-match-screen" data-match-state="${ui.bossMatchState}">
        ${topbar("Sfida Boss")}
        <div class="content boss-match-content">
          <section class="boss-match-hero panel">
            <button type="button" class="btn btn-back" data-nav="map" aria-label="Torna alla mappa">← Torna alla mappa</button>
            <div class="boss-match-heading">
              <h2>Sfida Boss</h2>
            </div>
            <div class="boss-match-vs" aria-label="Presentazione squadre">
              <div class="boss-match-team"><span class="boss-match-logo">${meta.user.logoUrl ? `<img src="${escapeHtml(meta.user.logoUrl)}" alt="${escapeHtml(meta.user.name)}" />` : "⚡"}</span><strong>${escapeHtml(meta.user.name)}</strong><small>${escapeHtml(meta.user.formation)} · Lv ${escapeHtml(meta.user.level)}${userAverage ? ` · OVR ${userAverage}` : ""}</small></div>
              <span class="boss-match-vs-badge">VS</span>
              <div class="boss-match-team boss-match-team--boss"><span class="boss-match-logo">${meta.boss.logoUrl ? `<img src="${escapeHtml(meta.boss.logoUrl)}" alt="${escapeHtml(meta.boss.name)}" />` : "⚽"}</span><strong>${escapeHtml(meta.boss.name)}</strong><small>${escapeHtml(meta.boss.formation)} · Boss Lv ${escapeHtml(meta.boss.level)}${bossAverage ? ` · OVR ${bossAverage}` : ""}</small><em>${escapeHtml(bossStatusLabel)}</em></div>
            </div>
          </section>

          <div class="boss-match-main-grid">
            <section class="panel boss-match-pitch-panel" aria-label="Formazioni 11v11">
              <div class="boss-match-tabs" role="tablist" aria-label="Squadra visualizzata">
                <button type="button" class="boss-match-team-tab ${activeSide === "user" ? "active" : ""}" role="tab" aria-selected="${activeSide === "user"}" data-boss-tab="user">La tua squadra</button>
                <button type="button" class="boss-match-team-tab ${activeSide === "boss" ? "active" : ""}" role="tab" aria-selected="${activeSide === "boss"}" data-boss-tab="boss">Boss</button>
              </div>
              <div class="boss-match-field" aria-label="Campo boss match" data-active-boss-side="${escapeHtml(activeSide)}">
                <div class="boss-match-half-label boss-match-half-label--active">${escapeHtml(activeSide === "boss" ? meta.boss.name : meta.user.name)}</div>
                ${bossMatchField({ players: userPlayers, formationId: run.formationId }, "user", false, activeSide !== "user")}
                ${bossMatchField({ players: bossPlayers, formationId: boss.bossFormation }, "boss", false, activeSide !== "boss")}
                <div class="boss-match-mobile-field">
                  ${bossMatchField({ players: userPlayers, formationId: run.formationId }, "user", true, activeSide !== "user")}
                  ${bossMatchField({ players: bossPlayers, formationId: boss.bossFormation }, "boss", true, activeSide !== "boss")}
                </div>
              </div>
            </section>

            <aside class="panel boss-match-boss-panel boss-match-boss-summary" aria-label="Riepilogo Boss">
              <img src="${escapeHtml(meta.boss.logoUrl || playerPortraitUrl(null))}" alt="${escapeHtml(meta.boss.name)}" />
              <h3>${escapeHtml(meta.boss.name)}</h3>
              <p>Livello boss <strong>${escapeHtml(meta.boss.level)}</strong></p>
              <p>Formazione <strong>${escapeHtml(meta.boss.formation)}</strong></p>
              <p>Forza simulata <strong>${escapeHtml(simPreview.opponentStrength?.final ?? meta.boss.overall ?? "-")}</strong></p>
              <p class="muted">Probabilità utente ${escapeHtml(simPreview.probabilities ? Math.round(simPreview.probabilities.user * 100) : "-")}% · boss ${escapeHtml(simPreview.probabilities ? Math.round(simPreview.probabilities.opponent * 100) : "-")}%.</p>
              <div class="boss-match-reward"><span>Ricompensa</span><strong>2 pick 1 di 3 dalla squadra battuta</strong></div>
            </aside>
          </div>

          <section class="boss-tactics-showdown" aria-label="Confronto tattico">
            <div class="boss-tactics-grid">
              ${tacticPanelMarkup(run.formationId, { className: "tactic-panel--user", compact: true, strength: simPreview.userStrength, probability: userProbability })}
              ${tacticPanelMarkup(boss.bossFormation, { className: "tactic-panel--boss", compact: true, strength: simPreview.opponentStrength, probability: bossProbability })}
            </div>
            ${fiveMatchComparisonMarkup(userPlayers, bossPlayers)}
            <div class="match-sim-summary">Forza: ${escapeHtml(simPreview.userStrength?.final ?? "-")} contro ${escapeHtml(simPreview.opponentStrength?.final ?? "-")} · Probabilità: ${escapeHtml(userProbability ?? "-")}% contro ${escapeHtml(bossProbability ?? "-")}%</div>
          </section>
          ${simError ? `<div class="match-sim-error">${escapeHtml(simError)}</div>` : ""}
          <div class="boss-match-bottom-grid">
            <section class="panel boss-match-log-panel"><div class="panel-title-row"><div><p class="eyebrow">90 minuti · eventi reali</p><h3>Cronaca</h3></div><span class="match-state-badge">${simulating ? "Live" : resolved ? "Completa" : "In attesa"}</span></div><ol class="boss-match-log match-sim-log" tabindex="0" aria-label="Cronaca partita" aria-live="polite">${bossMatchTimeline()}</ol></section>
            <section class="panel boss-match-result-panel ${outcomeClass}"><p class="eyebrow">Esito Boss</p><h3>${escapeHtml(bossStatusLabel)}</h3><div class="five-match-scoreline" aria-live="polite">${escapeHtml(scoreLabel)}</div><div class="boss-match-score" aria-hidden="true"><span>${score[0]}</span><small>-</small><span>${score[1]}</span></div><p>${escapeHtml(bossMatchStatusText())}</p><div class="boss-match-score-teams"><span>${escapeHtml(meta.user.name)}</span><span>${escapeHtml(meta.boss.name)}</span></div><div class="result-badges"><span>${resolved && ui.bossMatchState.endsWith("victory") ? "+1 livello" : "Vite " + run.lives}</span><span>${resolved && ui.bossMatchState.endsWith("victory") ? "Doppia pick boss" : resolved ? "Ritorno al nodo precedente" : "Finalizzazione protetta"}</span></div></section>
          </div>
          <details class="panel boss-match-mobile-details"><summary>Info boss e ricompensa</summary><p>${escapeHtml(meta.boss.name)} · Lv ${escapeHtml(meta.boss.level)} · ${escapeHtml(meta.boss.formation)}</p><p>2 pick 1 di 3 dalla squadra battuta</p></details>
          <section class="panel boss-match-controls"><button type="button" class="btn btn-yellow" id="simulate-boss-match" ${simulating || resolved ? "disabled" : ""}>${simulating ? "Simulazione..." : "Simula partita"}</button><button type="button" class="btn" id="skip-match-result" ${simulating ? "" : "hidden disabled"}>Vai al risultato</button><button type="button" class="btn btn-yellow" id="continue-match-result" ${resolved ? "" : "hidden disabled"}>Continua</button><div class="button-row">${TEST_MATCH_CONTROLS_ENABLED ? `<div class="match-test-tools"><span>Strumenti di test</span><button type="button" class="btn btn-tool" id="test-win" ${resolved ? "disabled" : ""}>Vittoria sicura</button>${DEV_MODE ? `<button type="button" class="btn btn-danger" id="test-loss" ${resolved ? "disabled" : ""}>Sconfitta forzata</button>` : ""}</div>` : ""}<button type="button" class="btn" data-nav="squad">Torna alla squadra</button></div></section>
        </div>
      </main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();

    bindBottomNav();
    const bossTabList = document.querySelector(".boss-match-tabs");
    bossTabList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-boss-tab]");
      if (!button || button.dataset.bossTab === ui.bossMatchTab) return;
      switchBossMatchTab(button.dataset.bossTab);
    });
    document.querySelectorAll("[data-boss-player]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.bossPlayer;
      if (button.dataset.bossSide === "user") return showPlayerDetails(id);
      const player = bossPlayers.find((candidate) => String(candidate.playerId) === String(id));
      showPlayerDetailsFor(player, { playerId: id, level: player?.displayLevel, database: seasonDb, preserveScroll: scrollSnapshot() });
    }));
    document.getElementById("test-win")?.addEventListener("click", (event) => { event.preventDefault(); forceMatchOutcome("victory", { boss }); });
    document.getElementById("test-loss")?.addEventListener("click", (event) => { event.preventDefault(); forceMatchOutcome("defeat", { boss }); });
    document.getElementById("simulate-boss-match").addEventListener("click", (event) => { event.preventDefault(); startMatchSimulation(ui.match, { boss }); });
    document.getElementById("skip-match-result")?.addEventListener("click", skipMatchToResult);
    document.getElementById("continue-match-result")?.addEventListener("click", continueAfterMatch);
    persistMatchState();
    resumeMatchSimulationIfNeeded(ui.match);
  }

  function addLevels(amount) {
    let updatedPlayers = 0;
    const numericAmount = Number(amount || 0);
    run.teamLevel = Math.min(20, Number(run.teamLevel) + numericAmount);
    run.roster.forEach((entry) => {
      const currentLevel = Number(entry.level || 0);
      const nextLevel = Math.min(20, currentLevel + numericAmount);
      if (nextLevel > currentLevel) updatedPlayers += 1;
      entry.level = nextLevel;
    });
    return updatedPlayers;
  }

  function appendFinalMatchMessage(result, boss = false) {
    const text = boss
      ? (result === "victory" ? "Vittoria confermata: premi Continua per aprire le ricompense boss." : "Sconfitta confermata: premi Continua per tornare al nodo precedente.")
      : (result === "victory" ? "Vittoria 5v5 confermata: premi Continua per tornare al percorso." : "Sconfitta 5v5 confermata: premi Continua per tornare al nodo precedente.");
    if (!ui.bossMatchLog.some((event) => event.minute === "FT")) {
      ui.bossMatchLog = [...ui.bossMatchLog, { minute: "FT", icon: result === "victory" ? "🏆" : "💔", text, side: null }];
      appendMatchLogEvent(ui.bossMatchLog.at(-1));
    }
  }

  function applyRealMatchStatistics(match, result) {
    if (!match?.simulation?.valid) return;
    const bossIndex = Number(match.bossIndex ?? run.bossIndex);
    const boss = match.type === "boss" ? seasonDb.bossOrder[bossIndex] : null;
    global.RunStatistics?.applyCompletedMatchStatistics?.(run, {
      ...match,
      matchId: match.matchId || global.RunStatistics.createStableMatchId(run, match),
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
      formation: match.type === "boss" ? run.formationId : run.fiveVFive?.formation,
    });
  }

  function completeFiveMatch(result) {
    const match = ui.match;
    if (!match?.simulation || match.simulation.resolutionApplied) return;
    match.simulation.resolutionApplied = true;
    ui.bossMatchResolving = "done";
    ui.bossMatchState = result === "victory" ? "completed-victory" : "completed-defeat";
    match.state = ui.bossMatchState;
    match.result = result;
    if (match.simulation?.score) match.score = [match.simulation.score.user, match.simulation.score.opponent];
    applyRealMatchStatistics(match, result);
    const node = run.currentZone.nodes.find((item) => item.id === match.nodeId);
    if (result === "victory") {
      addLevels(0.5);
      if (node) global.MapEngine.completeNode(run.currentZone, node.id);
      match.pendingPostMatchAction = { type: "map", toast: "Vittoria: tutta la rosa guadagna 0,5 livelli" };
    } else {
      global.RunState.restoreAfterLoss(run, match.previousNodeId);
      match.pendingPostMatchAction = { type: run.gameOver ? "game-over" : "map", toast: `Sconfitta: resta${run.lives === 1 ? "" : "no"} ${run.lives} vita${run.lives === 1 ? "" : "e"}. Torni al nodo precedente.` };
    }
    run.phase = "match";
    run.activeMatch = match;
    appendFinalMatchMessage(result, false);
    persistMatchState();
    updateMatchScoreDom(match, true);
    updateMatchControlsDom();
  }

  function completeBossMatch(result) {
    const match = ui.match;
    if (!match?.simulation || match.simulation.resolutionApplied) return;
    match.simulation.resolutionApplied = true;
    ui.bossMatchResolving = "done";
    ui.bossMatchState = result === "victory" ? "completed-victory" : "completed-defeat";
    match.state = ui.bossMatchState;
    match.result = result;
    if (match.simulation?.score) match.score = [match.simulation.score.user, match.simulation.score.opponent];
    applyRealMatchStatistics(match, result);
    const node = run.currentZone.nodes.find((item) => item.id === match.nodeId);
    if (result === "victory") {
      addLevels(1);
      if (node) global.MapEngine.completeNode(run.currentZone, node.id);
      match.pendingPostMatchAction = { type: "boss-rewards" };
      run.pendingBossVictory = { bossIndex: Number(match.bossIndex ?? run.bossIndex), bossId: String(seasonDb.bossOrder[Number(match.bossIndex ?? run.bossIndex)]?.teamId || ""), nodeId: match.nodeId || null, rewardsRemaining: 2, excludedIds: [], rerolls: 0, candidateIds: [] };
      run.postBossFlow = run.postBossFlow || {
        status: "result",
        bossIndex: Number(match.bossIndex ?? run.bossIndex),
        bossTeamId: String(seasonDb.bossOrder[Number(match.bossIndex ?? run.bossIndex)]?.teamId || ""),
        matchNodeId: match.nodeId || null,
        remainingRewards: 2,
        rewardNumber: 1,
        excludedIds: [],
        rerolls: 0,
        candidateIds: [],
        completed: false,
      };
    } else {
      global.RunState.restoreAfterLoss(run, match.previousNodeId);
      match.pendingPostMatchAction = { type: run.gameOver ? "game-over" : "map", toast: `Sconfitta: resta${run.lives === 1 ? "" : "no"} ${run.lives} vita${run.lives === 1 ? "" : "e"}. Torni al nodo precedente.` };
    }
    run.phase = "match";
    run.activeMatch = match;
    appendFinalMatchMessage(result, true);
    persistMatchState();
    updateMatchScoreDom(match, true);
    updateMatchControlsDom();
  }

  function continueAfterMatch(event) {
    event?.preventDefault();
    const match = ui.match || run.activeMatch;
    if (!match || match.postMatchNavigationApplied) return;
    if (match.type === "boss" && match.result === "victory") {
      const flow = resolvePendingRunFlow({ clearMatch: true });
      return navigateBossVictoryDestination(flow);
    }
    match.postMatchNavigationApplied = true;
    const action = match.pendingPostMatchAction || { type: "map" };
    ui.match = null;
    run.activeMatch = null;
    ui.bossMatchResolving = false;
    global.RunState.save(run);
    if (action.toast) toast(action.toast);
    if (action.type === "game-over") return renderGameOver();
    run.phase = "map";
    global.RunState.save(run);
    return renderMap();
  }

  function resumePostBossFlowOrMap() {
    const flow = resolvePendingRunFlow({ clearMatch: true });
    if (flow.destination !== "none") return navigateBossVictoryDestination(flow);
    ensureCurrentZone();
    run.phase = "map";
    global.RunState.save(run);
    return renderMap();
  }

  function bossVictoryMatch() {
    const match = ui.match || run.activeMatch;
    return match?.type === "boss" && match.result === "victory" && String(match.state || "").startsWith("completed") ? match : null;
  }

  function ensurePostBossFlow(options = {}) {
    const match = bossVictoryMatch();
    if (!run.postBossFlow && run.pendingBossVictory) {
      const pending = run.pendingBossVictory;
      const remaining = Math.max(0, Number(pending.rewardsRemaining ?? pending.remainingRewards ?? 2));
      run.postBossFlow = { status: remaining > 0 ? "reward" : "next-zone", bossIndex: Number(pending.bossIndex ?? run.bossIndex), bossTeamId: String(pending.bossId || pending.bossTeamId || ""), matchNodeId: pending.nodeId || pending.matchNodeId || null, remainingRewards: remaining, rewardNumber: Math.max(1, 3 - remaining), excludedIds: (pending.excludedIds || []).map(String), rerolls: Number(pending.rerolls || 0), candidateIds: (pending.candidateIds || []).map(String), completed: false };
    }
    if (!run.postBossFlow && match) {
      run.postBossFlow = { status: "result", bossIndex: Number(match.bossIndex ?? run.bossIndex), bossTeamId: String(seasonDb.bossOrder[Number(match.bossIndex ?? run.bossIndex)]?.teamId || ""), matchNodeId: match.nodeId || null, remainingRewards: 2, rewardNumber: 1, excludedIds: [], rerolls: 0, candidateIds: [], completed: false };
    }
    const flow = run.postBossFlow;
    if (!flow) return null;
    flow.remainingRewards = Math.max(0, Math.min(2, Number(flow.remainingRewards ?? flow.rewardsRemaining ?? 2)));
    flow.rewardNumber = Math.max(1, Math.min(2, Number(flow.rewardNumber ?? (3 - flow.remainingRewards))));
    flow.excludedIds = Array.isArray(flow.excludedIds) ? Array.from(new Set(flow.excludedIds.map(String))) : [];
    flow.candidateIds = Array.isArray(flow.candidateIds) ? flow.candidateIds.map(String) : [];
    flow.rerolls = Math.max(0, Number(flow.rerolls || 0));
    flow.bossIndex = Number(flow.bossIndex ?? run.bossIndex);
    const boss = seasonDb.bossOrder[flow.bossIndex];
    if (boss && !flow.bossTeamId) flow.bossTeamId = String(boss.teamId);
    if (match && run.currentZone?.bossIndex === flow.bossIndex) {
      const node = run.currentZone.nodes.find((item) => item.id === match.nodeId || item.type === "boss");
      if (node) global.MapEngine.completeNode(run.currentZone, node.id);
    }
    if (options.clearMatch && match) {
      match.postMatchNavigationApplied = true;
      ui.match = null;
      run.activeMatch = null;
      ui.bossMatchResolving = false;
      if (flow.status === "result") flow.status = "reward";
    }
    return flow;
  }

  function resolvePendingRunFlow(options = {}) {
    const flow = ensurePostBossFlow(options);
    if (!flow) return { destination: "none" };
    const boss = seasonDb.bossOrder[flow.bossIndex];
    if (!boss && flow.status !== "season-complete") flow.status = "season-complete";
    if (flow.status === "result") { global.RunState.save(run); return { destination: "boss-result" }; }
    if (flow.status === "reward" && flow.remainingRewards > 0) { global.RunState.save(run); return { destination: "boss-rewards" }; }
    if (flow.status === "season-complete") return finishBossVictoryTransition();
    flow.status = "next-zone";
    global.RunState.save(run);
    return finishBossVictoryTransition();
  }

  function resumePostBossFlow() {
    return navigateBossVictoryDestination(resolvePendingRunFlow({ clearMatch: true }));
  }

  function navigateBossVictoryDestination(flow) {
    if (flow.destination === "boss-result") {
      if (run.activeMatch) { ui.match = run.activeMatch; ui.bossMatchState = run.activeMatch.state || "completed-victory"; ui.bossMatchLog = run.activeMatch.log || ui.bossMatchLog || []; return renderMatch(); }
      return startBossRewards();
    }
    if (flow.destination === "boss-rewards") return startBossRewards();
    if (flow.destination === "season-complete") return renderSeasonComplete();
    if (flow.destination === "map") return renderMap();
    return null;
  }

  function bossRewardCandidates(flow, boss) {
    const team = seasonDb.teams.find((candidate) => String(candidate.teamId) === String(boss.teamId));
    const owned = new Set(run.roster.map((entry) => String(entry.playerId)));
    const random = global.DraftEngine.randomFromSeed(`${run.runId}:bossReward:${flow.bossIndex}:${flow.rewardNumber}:${flow.rerolls}`);
    const available = (team?.playerIds || []).map((id) => seasonPlayersById.get(String(id))).filter((player) => player && !owned.has(String(player.playerId)) && !flow.excludedIds.includes(String(player.playerId)));
    return selectWeightedCandidates(available, random);
  }

  // Legacy persistence assertions kept for post-boss flow: remaining rewards live on run.postBossFlow
  function startBossRewards() {
    const flowResult = resolvePendingRunFlow({ clearMatch: true });
    if (flowResult.destination === "season-complete") return renderSeasonComplete();
    if (flowResult.destination === "map") return renderMap();
    const flow = run.postBossFlow;
    const boss = seasonDb.bossOrder[Number(flow?.bossIndex ?? run.bossIndex)];
    if (!flow || !boss) return renderMap();
    flow.status = "reward";
    if (!flow.candidateIds?.length) flow.candidateIds = bossRewardCandidates(flow, boss).map((player) => String(player.playerId));
    global.RunState.save(run);
    showNextBossReward();
  }

  function syncPendingBossReward(flow) {
    if (!flow || !run.pendingBossVictory) return;
    run.pendingBossVictory.rewardsRemaining = flow.remainingRewards;
    run.pendingBossVictory.excludedIds = [...flow.excludedIds];
    run.pendingBossVictory.rerolls = flow.rerolls;
    run.pendingBossVictory.candidateIds = [...flow.candidateIds];
  }

  function showNextBossReward() {
    const flow = run.postBossFlow;
    const boss = seasonDb.bossOrder[Number(flow?.bossIndex ?? run.bossIndex)];
    if (!flow || !boss) return renderMap();
    let candidates = (flow.candidateIds || []).map((id) => seasonPlayersById.get(String(id))).filter(Boolean);
    if (!candidates.length) {
      candidates = bossRewardCandidates(flow, boss);
      flow.candidateIds = candidates.map((player) => String(player.playerId));
      global.RunState.save(run);
    }
    const level = global.RoguelikeRules.defeatedBossRewardLevel(boss);
    const scoutToken = run.inventory.find((item) => item.effect === "pull_reroll");
    showPlayerOffer({
      title: `Ricompensa ${flow.rewardNumber} di 2 · ${boss.teamName}`,
      subtitle: `Scegli 1 giocatore su 3 · Livello ${level}`,
      candidates,
      source: global.SeasonRegistry.sourceForSeason(run?.seasonId),
      database: seasonDb,
      level,
      allowSkip: true,
      legendary: false,
      onReroll: scoutToken ? () => {
        removeInventoryItem(scoutToken.instanceId);
        global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.REROLL_USED, { nodeId: flow.matchNodeId, itemId: scoutToken.id, instanceId: scoutToken.instanceId, actionId: `${run.runId}:${flow.matchNodeId}:boss_reward_reroll:${flow.rewardNumber}:${flow.rerolls + 1}` });
        flow.excludedIds.push(...candidates.map((player) => String(player.playerId)));
        flow.excludedIds = Array.from(new Set(flow.excludedIds));
        flow.rerolls += 1;
        flow.candidateIds = bossRewardCandidates(flow, boss).map((player) => String(player.playerId));
        syncPendingBossReward(flow);
        global.RunState.save(run);
        showNextBossReward();
      } : null,
      onPick: (player) => {
        flow.excludedIds.push(String(player.playerId));
        flow.excludedIds = Array.from(new Set(flow.excludedIds));
        syncPendingBossReward(flow);
        global.RunState.save(run);
        global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.BOSS_REWARD_CHOSEN, { nodeId: flow.matchNodeId, playerId: player.playerId, actionId: `${run.runId}:${flow.matchNodeId}:boss_reward:${flow.rewardNumber}:chosen` });
        recruitPlayer(player, global.SeasonRegistry.sourceForSeason(run?.seasonId), level, () => advanceBossReward(), { allowCancel: true, recruitmentSource: "boss_reward", actionId: `${run.runId}:${flow.matchNodeId}:boss_reward:${flow.rewardNumber}:recruit:${player.playerId}` });
      },
      onSkip: () => { global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.BOSS_REWARD_DECLINED, { nodeId: flow.matchNodeId, actionId: `${run.runId}:${flow.matchNodeId}:boss_reward:${flow.rewardNumber}:declined` }); advanceBossReward(); },
    });
  }

  function advanceBossReward() {
    const flow = run.postBossFlow;
    if (!flow) return renderMap();
    flow.remainingRewards = Math.max(0, Number(flow.remainingRewards || 0) - 1);
    flow.rewardNumber = Math.min(2, Number(flow.rewardNumber || 1) + 1);
    flow.rerolls = 0;
    flow.candidateIds = [];
    if (flow.remainingRewards <= 0) flow.status = "next-zone";
    syncPendingBossReward(flow);
    global.RunState.save(run);
    flow.remainingRewards > 0 ? showNextBossReward() : navigateBossVictoryDestination(finishBossVictoryTransition());
  }

  function finalizeBossVictoryTransition(options = {}) {
    return finishBossVictoryTransition(options);
  }

  function finishBossVictoryTransition() {
    const flow = ensurePostBossFlow() || run.postBossFlow;
    const bossIndex = Number(flow?.bossIndex ?? run.bossIndex);
    const boss = seasonDb.bossOrder[bossIndex];
    ui.pendingReward = null;
    closeModal();
    if (!boss) {
      run.postBossFlow = null;
      run.pendingBossVictory = null;
      run.phase = "complete";
      global.RunState.save(run);
      return { destination: "season-complete" };
    }
    if (!run.completedBossIds.includes(String(boss.teamId))) run.completedBossIds.push(String(boss.teamId));
    if (!run.unlockedTeamIds.includes(String(boss.teamId))) run.unlockedTeamIds.push(String(boss.teamId));
    if (run.bossIndex <= bossIndex) run.bossIndex = bossIndex + 1;
    run.pendingBossVictory = null;
    run.currentZone = null;
    run.activeMatch = null;
    ui.match = null;
    if (run.bossIndex >= seasonDb.bossOrder.length) {
      run.postBossFlow = null;
      run.phase = "complete";
      run.statistics.completedAt = run.completedAt || new Date().toISOString();
      persistChampionBeforeFinalUi(boss);
      global.RunState.save(run);
      return { destination: "season-complete" };
    }
    ensureCurrentZone();
    run.postBossFlow = null;
    global.RunState.createCheckpoint(run);
    return { destination: "map" };
  }


  function roleBadge(role) {
    const icons = { GK: "▣", DF: "◆", MF: "●", FW: "▲", all: "✦" };
    return `<span class="role-token role-${escapeHtml(role)}"><span>${icons[role] || icons.all}</span>${escapeHtml(role === "all" ? "Tutti" : role)}</span>`;
  }


  function fivePlayerEquipmentMarkup(equipment) {
    return equipmentBadgeMarkup(equipment, "five-player-equipment");
  }

  function fiveSlotCard(slot, playerId, status) {
    const player = playerId ? resolvedRosterPlayer(playerId) : null;
    const selected = ui.fiveVFiveSelectedSlot === slot.key;
    const missing = !player && !status.valid;
    return `
      <button type="button" class="five-slot ${selected ? "selected" : ""} ${missing ? "missing" : ""} ${player ? rarityClass(player.category) : ""}" data-five-slot="${escapeHtml(slot.key)}" style="grid-area:${escapeHtml(slot.line)}">
        <span class="five-slot-role">${roleBadge(slot.role)}</span>
        ${player ? `<span class="five-slot-overall">${escapeHtml(player.overall)}</span>
          <img src="${escapeHtml(player.portraitUrl)}" alt="" loading="lazy" />
          <strong>${escapeHtml(player.name)}</strong>
          <span class="small muted">${player.position} · Lv ${player.displayLevel}</span>
          ${fivePlayerEquipmentMarkup(rosterEntry(player.playerId)?.equippedItem)}
        ` : `
          <span class="five-empty">+</span>
          <strong>Slot vuoto</strong>
          <span class="small muted">Richiede ${escapeHtml(slot.role)}</span>
        `}
      </button>`;
  }

  function fiveRosterCard(entry, selectedSlot) {
    const player = resolvedRosterPlayer(entry.playerId);
    if (!player) return "";
    const slot = selectedSlot ? global.FiveVFive.formationById(run.fiveVFive.formation).slots.find((item) => item.key === selectedSlot) : null;
    const compatible = !slot || player.position === slot.role;
    const assignedSlot = Object.entries(run.fiveVFive.slots).find(([, id]) => String(id) === String(entry.playerId))?.[0];
    return `
      <button type="button" class="five-roster-card ${compatible ? "" : "disabled"} ${assignedSlot ? "assigned" : ""}" data-five-player="${escapeHtml(entry.playerId)}" ${compatible ? "" : "disabled"}>
        <img src="${escapeHtml(player.portraitUrl)}" alt="" loading="lazy" />
        <span><strong>${escapeHtml(player.name)}</strong><small>${player.position} · OVR ${player.overall} · Lv ${player.displayLevel}${assignedSlot ? ` · ${assignedSlot}` : ""}</small></span>
      </button>`;
  }

  function renderFiveVFive(options = {}) {
    run.phase = "five";
    ensureRunSchema();
    ensureFiveVFive();
    global.RunState.save(run);
    const status = fiveVFiveStatus();
    const formation = status.formation;
    const selectedSlot = ui.fiveVFiveSelectedSlot && formation.slots.some((slot) => slot.key === ui.fiveVFiveSelectedSlot)
      ? ui.fiveVFiveSelectedSlot
      : formation.slots.find((slot) => !run.fiveVFive.slots[slot.key])?.key || formation.slots[0].key;
    ui.fiveVFiveSelectedSlot = selectedSlot;
    const selectedRole = formation.slots.find((slot) => slot.key === selectedSlot)?.role;
    const filter = ui.fiveVFiveRoleFilter || "all";
    const rosterEntries = run.roster.filter((entry) => {
      const role = fiveRoleForPlayerId(entry.playerId);
      if (filter !== "all" && role !== filter) return false;
      if (selectedRole && filter === "all") return role === selectedRole;
      return true;
    });
    const rows = ["attack", "midfield", "defense", "goal"];
    app.innerHTML = `
      <main class="screen five-screen">
        ${topbar("Formazione 5v5")}
        <div class="content">
          <div class="section-head five-editor-head">
            <div>
              <p class="eyebrow">Partitelle</p>
              <h2>Formazione 5v5</h2>
              <p class="muted">Configura la tua formazione per le partite 5v5 usando i giocatori della rosa.</p>
            </div>
            ${options.returnToMatch ? '<button type="button" class="btn btn-back" id="back-five-match-head">← Torna alla partita</button>' : '<button type="button" class="btn btn-back" data-nav="map">← Torna alla mappa</button>'}
          </div>
          <section class="five-layout">
            <div class="five-main">
              <div class="five-formation-grid">
                ${global.FiveVFive.formations.map((item) => `
                  <button type="button" class="five-formation-card ${item.id === formation.id ? "selected" : ""}" data-five-formation="${escapeHtml(item.id)}">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.summary)}</span>
                  </button>`).join("")}
              </div>
              <div class="five-pitch formation-${escapeHtml(formation.id)}">
                ${rows.map((line) => `<div class="five-pitch-line line-${line}">${formation.slots.filter((slot) => slot.line === line).map((slot) => fiveSlotCard(slot, run.fiveVFive.slots[slot.key], status)).join("")}</div>`).join("")}
              </div>
              <div class="five-validation ${status.valid ? "valid" : "invalid"}">
                <strong>${status.valid ? "Formazione 5v5 pronta" : `Formazione incompleta (${status.assignedCount}/5)`}</strong>
                <p>${status.valid ? "Puoi affrontare i nodi Partita 5v5." : escapeHtml(status.messages[0] || "Completa tutti gli slot rispettando i ruoli.")}</p>
              </div>
              <div class="button-row"><button type="button" class="btn btn-yellow btn-primary-action" id="save-five" ${status.valid ? "" : "disabled"}>Salva formazione</button>${options.returnToMatch ? '<button type="button" class="btn btn-secondary" id="back-five-match">Torna alla partita</button><button type="button" class="btn btn-ghost" id="cancel-five-edit">Annulla</button>' : ""}</div>
            </div>
            <aside class="panel five-selector">
              <div class="section-head compact"><div><p class="eyebrow">${escapeHtml(selectedSlot)}</p><h3>Seleziona giocatore</h3><p class="muted small">Scegli un ${escapeHtml(selectedRole)} dalla rosa.</p></div></div>
              <div class="role-filter-bar">
                ${["all", "GK", "DF", "MF", "FW"].map((role) => `<button type="button" class="role-filter ${filter === role ? "active" : ""}" data-five-filter="${role}" aria-selected="${filter === role ? "true" : "false"}">${roleBadge(role)}</button>`).join("")}
              </div>
              <div class="five-roster-list">
                ${rosterEntries.length ? rosterEntries.map((entry) => fiveRosterCard(entry, selectedSlot)).join("") : '<p class="muted">Nessun giocatore compatibile con questo filtro.</p>'}
              </div>
              <button type="button" class="btn btn-ghost" id="clear-five-slot">Svuota slot selezionato</button>
            </aside>
          </section>
        </div>
        ${bottomNav("five")}
      </main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();

    document.querySelectorAll("[data-five-formation]").forEach((button) => button.addEventListener("click", () => {
      global.FiveVFive.changeFormation(run, button.dataset.fiveFormation, fiveRoleForPlayerId);
      ui.fiveVFiveSelectedSlot = null;
      global.RunState.save(run);
      runKeepingScroll(() => renderFiveVFive(options));
    }));
    const refreshFiveSelection = () => {
      const currentStatus = fiveVFiveStatus();
      const currentFormation = currentStatus.formation;
      document.querySelectorAll("[data-five-slot]").forEach((slotButton) => {
        slotButton.classList.toggle("selected", slotButton.dataset.fiveSlot === ui.fiveVFiveSelectedSlot);
      });
      document.querySelectorAll("[data-five-filter]").forEach((filterButton) => {
        const active = filterButton.dataset.fiveFilter === ui.fiveVFiveRoleFilter;
        filterButton.classList.toggle("active", active);
        filterButton.setAttribute("aria-selected", active ? "true" : "false");
      });
      const currentSlot = currentFormation.slots.find((slot) => slot.key === ui.fiveVFiveSelectedSlot);
      const selectedRoleNow = currentSlot?.role;
      const currentFilter = ui.fiveVFiveRoleFilter || "all";
      const nextEntries = run.roster.filter((entry) => {
        const role = fiveRoleForPlayerId(entry.playerId);
        if (currentFilter !== "all" && role !== currentFilter) return false;
        if (selectedRoleNow && currentFilter === "all") return role === selectedRoleNow;
        return true;
      });
      const selectorHead = document.querySelector(".five-selector .section-head.compact");
      if (selectorHead && currentSlot) selectorHead.innerHTML = `<div><p class="eyebrow">${escapeHtml(currentSlot.key)}</p><h3>Seleziona giocatore</h3><p class="muted small">Scegli un ${escapeHtml(selectedRoleNow)} dalla rosa.</p></div>`;
      const list = document.querySelector(".five-roster-list");
      if (list) {
        const fragment = document.createDocumentFragment();
        if (nextEntries.length) {
          nextEntries.forEach((entry) => {
            const template = document.createElement("template");
            template.innerHTML = fiveRosterCard(entry, ui.fiveVFiveSelectedSlot).trim();
            if (template.content.firstElementChild) fragment.append(template.content.firstElementChild);
          });
        } else {
          const empty = document.createElement("p");
          empty.className = "muted";
          empty.textContent = "Nessun giocatore compatibile con questo filtro.";
          fragment.append(empty);
        }
        list.replaceChildren(fragment);
      }
    };
    const refreshFiveAfterAssignment = () => {
      const snapshot = scrollSnapshot();
      const currentStatus = fiveVFiveStatus();
      document.querySelectorAll("[data-five-slot]").forEach((slotButton) => {
        const slot = currentStatus.formation.slots.find((item) => item.key === slotButton.dataset.fiveSlot);
        if (slot) slotButton.outerHTML = fiveSlotCard(slot, run.fiveVFive.slots[slot.key], currentStatus);
      });
      const validation = document.querySelector(".five-validation");
      if (validation) {
        validation.className = `five-validation ${currentStatus.valid ? "valid" : "invalid"}`;
        validation.innerHTML = `<strong>${currentStatus.valid ? "Formazione 5v5 pronta" : `Formazione incompleta (${currentStatus.assignedCount}/5)`}</strong><p>${currentStatus.valid ? "Puoi affrontare i nodi Partita 5v5." : escapeHtml(currentStatus.messages[0] || "Completa tutti gli slot rispettando i ruoli.")}</p>`;
      }
      const save = document.getElementById("save-five");
      if (save) save.disabled = !currentStatus.valid;
      document.querySelectorAll("[data-five-slot]").forEach((slotButton) => slotButton.addEventListener("click", onFiveSlotClick));
      refreshFiveSelection();
      restoreScroll(snapshot);
    };
    const onFiveSlotClick = (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      ui.fiveVFiveSelectedSlot = button.dataset.fiveSlot;
      const role = formation.slots.find((slot) => slot.key === ui.fiveVFiveSelectedSlot)?.role;
      ui.fiveVFiveRoleFilter = role || "all";
      refreshFiveSelection();
    };
    const selector = document.querySelector(".five-selector");
    selector?.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-five-filter]");
      if (filterButton && selector.contains(filterButton)) {
        event.preventDefault();
        ui.fiveVFiveRoleFilter = filterButton.dataset.fiveFilter || "all";
        refreshFiveSelection();
        filterButton.focus?.({ preventScroll: true });
        return;
      }
      const playerButton = event.target.closest("[data-five-player]");
      if (!playerButton || !selector.contains(playerButton)) return;
      event.preventDefault();
      try {
        global.FiveVFive.assign(run, ui.fiveVFiveSelectedSlot, playerButton.dataset.fivePlayer, fiveRoleForPlayerId);
        global.RunState.save(run);
        toast("Giocatore assegnato alla formazione 5v5");
        refreshFiveAfterAssignment();
      } catch (error) {
        toast(error.message);
      }
    });
    document.querySelectorAll("[data-five-slot]").forEach((button) => button.addEventListener("click", onFiveSlotClick));
    document.getElementById("clear-five-slot").addEventListener("click", (event) => {
      event.preventDefault();
      global.FiveVFive.clearSlot(run, ui.fiveVFiveSelectedSlot);
      global.RunState.save(run);
      refreshFiveAfterAssignment();
    });
    document.getElementById("save-five").addEventListener("click", () => {
      const nextStatus = fiveVFiveStatus();
      if (!nextStatus.valid) return toast("Completa tutti e cinque gli slot prima di salvare.");
      global.RunState.save(run);
      toast("Formazione 5v5 salvata");
    });
    document.getElementById("back-five-match-head")?.addEventListener("click", () => document.getElementById("back-five-match")?.click());
    document.getElementById("cancel-five-edit")?.addEventListener("click", () => document.getElementById("back-five-match")?.click());
    document.getElementById("back-five-match")?.addEventListener("click", (event) => {
      event.preventDefault();
      const nextStatus = fiveVFiveStatus();
      if (!nextStatus.valid) return toast(nextStatus.messages?.[0] || "Formazione non valida: completa tutti gli slot prima di tornare alla partita.");
      const context = ui.returnToMatchContext || run.activeMatch;
      const match = run.activeMatch?.type === "five_v_five" ? run.activeMatch : null;
      if (!context || !match) return toast("Nessuna partita da riprendere.");
      global.RunState.save(run);
      ui.match = match;
      ui.bossMatchState = match.state || "pre-match";
      ui.bossMatchLog = match.log || visibleTimeline(match);
      run.phase = "match";
      renderMatch();
      restoreScroll(match.returnScroll || context.scroll || scrollSnapshot());
    });
    bindBottomNav();
  }

  function renderInventory(options = {}) {
    ensureRunSchema();
    const ownedGroups = groupedOwnedInventoryItems(run);
    const filterDefs = inventoryFilterDefinitions(run);
    if (!filterDefs.some((filter) => filter.id === ui.inventoryFilter)) ui.inventoryFilter = "all";
    const activeFilter = filterDefs.find((filter) => filter.id === ui.inventoryFilter) || filterDefs[0];
    const visibleGroups = ownedGroups.filter((group) => inventoryGroupMatchesFilter(group, ui.inventoryFilter));
    if (!visibleGroups.some((group) => group.key === ui.inventorySelectedItemId)) ui.inventorySelectedItemId = visibleGroups[0]?.key || null;
    const selectedGroup = ownedGroups.find((group) => group.key === ui.inventorySelectedItemId) || null;
    const equipped = run.roster
      .filter((entry) => entry.equippedItem)
      .map((entry) => ({ entry, player: sourcePlayer(entry), resolved: resolvedRosterPlayer(entry.playerId), item: resolveItem(entry.equippedItem) }));
    const ownershipSummary = inventoryOwnershipSummary(run);
    const shouldKeepScroll = options.keepScroll;
    const previousScroll = shouldKeepScroll ? scrollSnapshot() : null;
    app.innerHTML = `
      <main class="screen inventory-screen">
        ${topbar("Oggetti")}
        <div class="content inventory-content">
          <header class="inventory-hero">
            <div>
              <p class="eyebrow">Nello zaino ${ownershipSummary.backpackCount}/${global.SEASON1_CONFIG.maxInventory}</p>
              <h2>OGGETTI</h2>
              <p class="muted small">${activeFilter?.id !== "all" ? `Filtro: ${escapeHtml(activeFilter.label)}` : "Tutto ciò che hai raccolto nella run"}</p>
            </div>
            <div class="inventory-summary" aria-label="Riepilogo inventario">
              <span><strong>${ownershipSummary.ownedCount}</strong><small>posseduti</small></span>
              <span><strong>${ownershipSummary.equippedCount}</strong><small>equipaggiati</small></span>
              <span><strong>${ownershipSummary.equippedPlayerCount}</strong><small>giocatori</small></span>
              <span><strong>${ownershipSummary.consumableCount}</strong><small>consumabili</small></span>
            </div>
          </header>
          ${filterDefs.length > 1 ? `<nav class="inventory-filters" aria-label="Filtri inventario">${filterDefs.map((filter) => `<button type="button" class="inventory-filter ${filter.id === ui.inventoryFilter ? "active" : ""}" data-inventory-filter="${escapeHtml(filter.id)}"><span>${escapeHtml(filter.label)}</span><small>${filter.count}</small></button>`).join("")}</nav>` : ""}
          <section class="inventory-layout">
            <div class="inventory-categories">
              ${inventoryCategoriesMarkup(ui.inventoryFilter)}
            </div>
            <aside class="inventory-side-panel">
              <div class="inventory-detail-panel panel" id="inventory-item-detail" aria-live="polite">
                ${inventoryItemDetailMarkup(selectedGroup)}
              </div>
              <div class="inventory-equipped-panel panel">
                <div class="inventory-panel-head"><p class="eyebrow">Equipaggiati</p><h3>Stato giocatori</h3></div>
                <div class="equipped-list">
                  ${equipped.length ? equipped.map(({ entry, player, resolved, item }) => `
                    <article class="equipped-summary static-item">${itemIcon(item)}<div class="equipped-summary-copy"><span class="item-kind">Equipaggiato</span><strong>${escapeHtml(item.name)}</strong></div><div class="equipped-player"><span class="equipped-player-portrait"><img src="${escapeHtml(playerPortraitUrl(resolved || player))}" alt="" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(resolved || player).cardFallbacks)} /></span><div class="equipped-player-copy"><span>${escapeHtml(player.name)} · ${escapeHtml(player.position)}</span><small>${escapeHtml(itemStatLabel(item.stat))} ${resolved.baseStats[item.stat]} → <strong>${resolved.stats[item.stat]}</strong></small></div></div><button type="button" class="btn btn-ghost inventory-remove-button" data-unequip-player="${entry.playerId}">RIMUOVI</button></article>`).join("") : '<p class="muted inventory-empty">Nessun giocatore ha un oggetto equipaggiato.</p>'}
                </div>
              </div>
            </aside>
          </section>
        </div>
        ${bottomNav("inventory")}
      </main>`;
    if (shouldKeepScroll) restoreScroll(previousScroll);
    else resetRenderedViewScroll();
    bindSectionRootNav();
    const content = document.querySelector(".inventory-content");
    content?.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-inventory-filter]");
      if (filterButton) {
        ui.inventoryFilter = filterButton.dataset.inventoryFilter || "all";
        return renderInventory({ keepScroll: true });
      }
      const itemCard = event.target.closest("[data-inventory-select]");
      if (itemCard && !event.target.closest("button")) {
        return selectInventoryItem(itemCard.dataset.inventorySelect);
      }
      const useButton = event.target.closest("[data-use-item]");
      if (useButton) return useInventoryItem(useButton.dataset.useItem);
      const equipButton = event.target.closest("[data-equip-item]");
      if (equipButton) return chooseEquipmentPlayer(equipButton.dataset.equipItem);
      const unequipButton = event.target.closest("[data-unequip-player]");
      if (unequipButton) return unequipPlayerItem(unequipButton.dataset.unequipPlayer);
    });
    content?.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key) || !event.target.matches("[data-inventory-select]")) return;
      event.preventDefault();
      selectInventoryItem(event.target.dataset.inventorySelect);
    });
    bindBottomNav();
  }

  function inventoryCategoriesMarkup(filterId = "all") {
    const ownedGroups = groupedOwnedInventoryItems(run);
    if (!ownedGroups.length) return '<div class="inventory-empty-state"><strong>Nessun oggetto posseduto</strong><p class="muted">Gli oggetti si ottengono dagli eventi della mappa durante la run.</p></div>';
    const categories = groupedOwnedInventoryByCategory(run)
      .map((category) => ({ ...category, items: category.items.filter((group) => inventoryGroupMatchesFilter(group, filterId)) }))
      .filter((category) => category.items.length);
    if (!categories.length) return '<div class="inventory-empty-state"><strong>Nessun oggetto in questo filtro</strong><p class="muted">Cambia categoria per vedere gli altri oggetti posseduti.</p></div>';
    return categories
      .map((category) => `
        <section class="inventory-category" data-inventory-category="${category.id}">
          <header class="inventory-category-head"><span class="inventory-category-icon" aria-hidden="true">${category.icon}</span><div><h3>${escapeHtml(category.title)}</h3><p class="muted small">${category.items.reduce((sum, group) => sum + group.quantity, 0)} oggetti</p></div></header>
          <div class="item-grid inventory-item-grid">${category.items.map((group) => inventoryItemCard(group, group.key === ui.inventorySelectedItemId)).join("")}</div>
        </section>`).join("");
  }

  function inventoryItemCard(groupOrItem, selected = false) {
    const group = groupOrItem?.instances ? groupOrItem : { item: groupOrItem, quantity: 1, instances: [groupOrItem], key: inventoryItemIdentity(groupOrItem) };
    const item = resolveItem(group.item);
    const instanceId = group.instances[0]?.instanceId || item.instanceId;
    const backpackQuantity = Number(group.backpackQuantity ?? group.quantity);
    const action = inventoryItemActionMarkup(item, instanceId, { compact: true, backpackQuantity, equippedEntries: group.equippedEntries || [] });
    const detail = item.kind === "equipment" ? `${escapeHtml(itemStatLabel(item.stat))} +${escapeHtml(item.bonus)}` : escapeHtml(item.description);
    const equippedState = group.equippedCount ? `<span class="item-equipped-state">${group.equippedCount} equipaggiat${group.equippedCount === 1 ? "o" : "i"}</span>` : "";
    return `<article class="item-card inventory-item-card static-item ${selected ? "is-selected" : ""}" tabindex="0" aria-selected="${selected ? "true" : "false"}" data-inventory-select="${escapeHtml(group.key)}" data-item-id="${escapeHtml(group.key)}" data-item-kind="${escapeHtml(item.kind)}">${itemIcon(item)}<div class="item-card-main"><span class="item-kind">${item.kind === "equipment" ? "Equipaggiamento" : "Consumabile"}</span><strong>${escapeHtml(item.name)}</strong><p>${detail}</p>${equippedState}</div><div class="item-card-actions"><span class="item-quantity" aria-label="Quantità posseduta ${group.quantity}">×${group.quantity}</span>${action}</div></article>`;
  }

  function inventoryItemActionMarkup(itemOrId, instanceId, { compact = false, backpackQuantity = 1, equippedEntries = [] } = {}) {
    const item = resolveItem(itemOrId);
    const actionClass = compact ? "btn btn-primary inventory-card-action" : "btn btn-yellow inventory-detail-action";
    if (item.kind === "equipment") {
      if (backpackQuantity > 0 && instanceId) return `<button type="button" class="${actionClass}" data-equip-item="${escapeHtml(instanceId)}">EQUIPAGGIA</button>`;
      if (equippedEntries.length) return '<span class="inventory-unavailable">TUTTE LE COPIE SONO EQUIPAGGIATE</span>';
      return '<span class="inventory-unavailable">NON UTILIZZABILE</span>';
    }
    if (item.effect === "pull_reroll") return '<span class="inventory-unavailable">Utilizzabile durante un Pull</span>';
    if (item.effect === "lucky_pull") return '<span class="inventory-unavailable">Utilizzabile in un Pull normale</span>';
    if (!instanceId) return '<span class="inventory-unavailable">NON UTILIZZABILE</span>';
    return `<button type="button" class="${actionClass}" data-use-item="${escapeHtml(instanceId)}">USA</button>`;
  }

  function inventoryItemDetailMarkup(group) {
    if (!group) return '<div class="inventory-detail-empty"><p class="eyebrow">Dettaglio</p><h3>Seleziona un oggetto</h3><p>Scegli una card per vedere effetto, quantità e comandi disponibili.</p></div>';
    const item = resolveItem(group.item);
    const instanceId = group.instances[0]?.instanceId || item.instanceId;
    const backpackQuantity = Number(group.backpackQuantity ?? group.quantity);
    const limit = item.effect === "pull_reroll"
      ? "Si attiva esclusivamente durante un Pull."
      : item.effect === "lucky_pull"
        ? "Disponibile una sola volta nei Pull normali compatibili."
        : item.kind === "equipment"
          ? "Resta posseduto anche quando viene equipaggiato."
          : "La quantità diminuisce soltanto dopo un utilizzo riuscito.";
    return `
      <div class="inventory-detail-visual">${itemIcon(item)}</div>
      <div class="inventory-detail-copy">
        <p class="eyebrow">Dettaglio oggetto</p>
        <span class="item-kind">${item.kind === "equipment" ? "Equipaggiamento" : "Consumabile"}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="inventory-detail-effect"><span>Effetto</span><strong>${item.kind === "equipment" ? `${escapeHtml(itemStatLabel(item.stat))} +${escapeHtml(item.bonus)}` : escapeHtml(item.description)}</strong></div>
        <div class="inventory-detail-counts">
          <span><strong>${group.quantity}</strong> posseduti</span>
          ${item.kind === "equipment" ? `<span><strong>${backpackQuantity}</strong> nello zaino</span><span><strong>${group.equippedCount || 0}</strong> equipaggiati</span>` : ""}
        </div>
        <p class="inventory-detail-limit">${escapeHtml(limit)}</p>
        ${inventoryItemActionMarkup(item, instanceId, { backpackQuantity, equippedEntries: group.equippedEntries || [] })}
      </div>`;
  }

  function selectInventoryItem(groupKey) {
    const group = groupedOwnedInventoryItems(run).find((candidate) => candidate.key === groupKey);
    if (!group) return;
    ui.inventorySelectedItemId = groupKey;
    document.querySelectorAll("[data-inventory-select]").forEach((card) => {
      const selected = card.dataset.inventorySelect === groupKey;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-selected", selected ? "true" : "false");
    });
    const detail = document.getElementById("inventory-item-detail");
    if (detail) detail.innerHTML = inventoryItemDetailMarkup(group);
  }

  function inventoryPlayerChoice(entry, item, mode) {
    const player = resolvedRosterPlayer(entry.playerId);
    if (!player) return "";
    const currentEquipment = entry.equippedItem ? resolveItem(entry.equippedItem) : null;
    let valid = true;
    let invalidReason = "";
    if (mode === "level") {
      valid = Number(entry.level || 0) < 20;
      invalidReason = "Livello massimo raggiunto";
    } else if (mode === "potential") {
      const source = sourcePlayer(entry);
      const maxBoost = Math.max(0, 99 - Number(source.finalOverall || 0));
      const applications = global.InazumaProgression.normalizePotentialBoostApplications(entry, maxBoost);
      valid = applications.reduce((sum, boost) => sum + boost.amount, 0) < maxBoost;
      invalidReason = "Potenziale massimo raggiunto";
    }
    const dataAttribute = mode === "equipment"
      ? `data-equip-player="${escapeHtml(entry.playerId)}"`
      : valid
        ? `data-consumable-player="${escapeHtml(entry.playerId)}"`
        : `disabled aria-disabled="true"`;
    return `
      <article class="inventory-player-option ${valid ? "" : "is-unavailable"}">
        ${compactPlayerCardMarkup(player, {
          equipment: entry.equippedItem,
          level: player.displayLevel,
          overall: player.overall,
          dataAttr: dataAttribute,
          extraClass: "inventory-player-choice",
        })}
        <div class="inventory-player-option-copy">
          ${currentEquipment ? `<span>${itemIcon(currentEquipment)}<small>Già equipaggiato</small><strong>${escapeHtml(currentEquipment.name)}</strong></span>` : '<span class="inventory-player-empty-equipment">Nessun oggetto equipaggiato</span>'}
          ${!valid ? `<em>${escapeHtml(invalidReason)}</em>` : ""}
        </div>
      </article>`;
  }

  function inventoryPlayerSelectionMarkup(item, mode) {
    const orderedIds = [...(run.lineup || []), ...(run.bench || [])];
    const seen = new Set();
    const entries = orderedIds
      .map((id) => rosterEntry(id))
      .filter((entry) => entry && !seen.has(String(entry.playerId)) && seen.add(String(entry.playerId)));
    return `
      <div class="inventory-player-selection-grid">
        ${entries.map((entry) => inventoryPlayerChoice(entry, item, mode)).join("")}
      </div>`;
  }

  function equipmentTargetState(entry, item) {
    const player = entry ? resolvedRosterPlayer(entry.playerId) : null;
    const baseStats = player?.baseStats || player?.stats || {};
    const valid = Boolean(
      entry
      && player
      && item?.kind === "equipment"
      && item?.stat
      && Number.isFinite(Number(baseStats[item.stat]))
      && Number.isFinite(Number(item.bonus))
    );
    return {
      valid,
      reason: valid ? "" : "Oggetto non utilizzabile",
      player,
    };
  }

  function inventoryEquipmentPlayerCard(id, item, area, selectedId = null) {
    const entry = rosterEntry(id);
    const target = equipmentTargetState(entry, item);
    if (!entry || !target.player) return "";
    const selected = String(selectedId || "") === String(id);
    const dataAttr = target.valid
      ? `data-equip-player="${escapeHtml(id)}" data-area="${escapeHtml(area)}" aria-pressed="${selected ? "true" : "false"}"`
      : `disabled aria-disabled="true" title="${escapeHtml(target.reason)}"`;
    return `<div class="inventory-tactical-slot ${target.valid ? "" : "is-unavailable"}">
      ${compactPlayerCardMarkup(target.player, {
        equipment: entry.equippedItem,
        equipmentInFooter: true,
        level: target.player.displayLevel,
        overall: target.player.overall,
        selected,
        dataAttr,
        extraClass: "squad-player-card inventory-tactical-player",
      })}
      ${target.valid ? "" : `<small class="inventory-target-reason">${escapeHtml(target.reason)}</small>`}
    </div>`;
  }

  function inventoryEquipmentPitchMarkup(item, selectedId = null) {
    return `<section class="pitch">
      ${lineupRows().map((row) => `<div class="pitch-row tactical-row" data-row-count="${row.ids.length || 1}" style="--players-in-row:${row.ids.length || 1};--row-count:${row.ids.length || 1}">${row.ids.map((id) => inventoryEquipmentPlayerCard(id, item, "lineup", selectedId)).join("")}</div>`).join("")}
    </section>`;
  }

  function inventoryEquipmentBenchMarkup(item, selectedId = null) {
    const cards = (run.bench || []).map((id) => inventoryEquipmentPlayerCard(id, item, "bench", selectedId)).filter(Boolean);
    return cards.length ? cards.join("") : '<p class="muted">Nessuna riserva disponibile.</p>';
  }

  function inventoryEquipmentSelectionSummary(playerId) {
    const entry = playerId ? rosterEntry(playerId) : null;
    const player = entry ? resolvedRosterPlayer(entry.playerId) : null;
    if (!entry || !player) {
      return '<p class="inventory-equipment-selection-empty">Seleziona un giocatore dal campo o dalla panchina.</p>';
    }
    const current = entry.equippedItem ? resolveItem(entry.equippedItem) : null;
    return `<div class="inventory-equipment-selection-player">
      <span class="equipped-player-portrait"><img src="${escapeHtml(playerPortraitUrl(player))}" alt="" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} /></span>
      <div><small>Giocatore selezionato</small><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.position)} · OVR ${escapeHtml(player.overall)}</span></div>
    </div>
    <div class="inventory-equipment-current">
      ${current ? `${itemIcon(current)}<div><small>Oggetto attuale</small><strong>${escapeHtml(current.name)}</strong><span>Verrà restituito allo zaino dopo la conferma.</span></div>` : '<div><small>Oggetto attuale</small><strong>Nessun equipaggiamento</strong><span>Lo slot è libero.</span></div>'}
    </div>`;
  }

  function setInventoryEquipmentTarget(playerId) {
    ui.inventoryEquipmentPlayerId = playerId ? String(playerId) : null;
    modalRoot.querySelectorAll("[data-equip-player]").forEach((card) => {
      const selected = String(card.dataset.equipPlayer) === ui.inventoryEquipmentPlayerId;
      card.classList.toggle("selected", selected);
      card.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    const summary = modalRoot.querySelector("[data-equipment-selection-summary]");
    if (summary) summary.innerHTML = inventoryEquipmentSelectionSummary(ui.inventoryEquipmentPlayerId);
    const confirm = modalRoot.querySelector("[data-confirm-equipment-target]");
    if (confirm) confirm.disabled = !ui.inventoryEquipmentPlayerId;
  }

  function openInventoryConfirmation(item, { title, description, confirmLabel = "CONFERMA", onConfirm, onCancel } = {}) {
    openModal(`
      <div class="inventory-confirmation">
        <div class="inventory-confirmation-item">${itemIcon(item)}<div><p class="eyebrow">Conferma utilizzo</p><h2>${escapeHtml(title || item.name)}</h2></div></div>
        <p>${escapeHtml(description || item.description)}</p>
        <div class="inventory-confirmation-warning">La quantità verrà aggiornata soltanto dopo il successo.</div>
        <div class="button-row inventory-modal-actions">
          <button type="button" class="btn btn-yellow" id="confirm-inventory-action">${escapeHtml(confirmLabel)}</button>
          <button type="button" class="btn btn-ghost" id="cancel-inventory-action">ANNULLA</button>
        </div>
      </div>`,
      { closeable: false, className: "inventory-flow-modal inventory-confirmation-modal" }
    );
    document.getElementById("confirm-inventory-action")?.addEventListener("click", onConfirm);
    document.getElementById("cancel-inventory-action")?.addEventListener("click", () => {
      if (onCancel) onCancel();
      else closeModal();
    });
  }

  function useInventoryItem(instanceId) {
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return;
    if (item.effect === "player_level") return choosePlayerForConsumable(item);
    if (item.effect === "potential_boost") return choosePlayerForPotentialBoost(item);
    if (item.effect === "team_level") {
      const hasEligiblePlayer = run.roster.some((entry) => Number(entry.level || 0) < 20);
      if (!hasEligiblePlayer) return toast("Tutti i giocatori hanno già raggiunto il livello massimo.");
      return openInventoryConfirmation(item, {
        title: `Usare ${item.name}?`,
        description: "Aumenterà di 0,5 livello tutti i giocatori che non hanno ancora raggiunto il livello massimo.",
        onConfirm: () => {
          addLevels(Number(item.amount || 0));
          removeInventoryItem(instanceId);
          global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.ITEM_USED, { itemId: item.id, effect: item.effect, instanceId, actionId: `${run.runId}:${instanceId}:used` });
          global.RunState.save(run);
          closeModal();
          toast("Tutta la rosa guadagna +0,5 livello");
          renderInventory();
        },
      });
    }
    if (item.effect === "restore_life") {
      const maxRunLives = Number(global.RunState?.runLivesLimit?.() ?? global.SEASON1_CONFIG.maxRunLives ?? global.SEASON1_CONFIG.startingLives ?? 2);
      if (run.lives >= maxRunLives) return toast("Hai già tutte le vite");
      return openInventoryConfirmation(item, {
        title: `Usare ${item.name}?`,
        description: `Recupererai una vita (${run.lives}/${maxRunLives}).`,
        onConfirm: () => {
          run.lives = Math.min(maxRunLives, run.lives + Number(item.amount || 1));
          removeInventoryItem(instanceId);
          global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.ITEM_USED, { itemId: item.id, effect: item.effect, instanceId, actionId: `${run.runId}:${instanceId}:used` });
          global.RunState.save(run);
          closeModal();
          toast("Hai recuperato una vita");
          renderInventory();
        },
      });
    }
    if (item.effect === "lucky_pull") return toast("Portafortuna utilizzabile durante una Pull svincolati o Pull squadre.");
  }

  function choosePlayerForConsumable(item) {
    openModal(`
      <div class="inventory-flow-head">${itemIcon(item)}<div><p class="eyebrow">${escapeHtml(item.name)}</p><h2>Scegli il giocatore</h2><p>${escapeHtml(item.description)}</p></div></div>
      ${inventoryPlayerSelectionMarkup(item, "level")}
      <div class="inventory-modal-actions"><button type="button" class="btn btn-ghost" data-close-inventory-flow>RINUNCIA</button></div>`,
      { closeable: true, className: "item-assignment-modal consumable-assignment-modal inventory-flow-modal" }
    );
    modalRoot.querySelector("[data-close-inventory-flow]")?.addEventListener("click", closeModal);
    modalRoot.querySelectorAll("[data-consumable-player]").forEach((button) => {
      button.addEventListener("click", () => {
        const entry = rosterEntry(button.dataset.consumablePlayer);
        if (!entry) return;
        const before = resolvedRosterPlayer(entry.playerId);
        const currentLevel = Number(entry.level || 0);
        const appliedLevels = Math.min(Number(item.amount || 1), 20 - currentLevel);
        if (appliedLevels <= 0) return toast("Questo giocatore ha già raggiunto il livello massimo.");
        openInventoryConfirmation(item, {
          title: `Usare su ${before.name}?`,
          description: `Livello ${before.displayLevel} → ${Math.min(20, currentLevel + appliedLevels)}. L'oggetto sarà consumato.`,
          onCancel: () => choosePlayerForConsumable(item),
          onConfirm: () => {
            entry.level = Math.min(20, currentLevel + appliedLevels);
            removeInventoryItem(item.instanceId);
            global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.ITEM_USED, { itemId: item.id, effect: item.effect, instanceId: item.instanceId, actionId: `${run.runId}:${item.instanceId}:used` });
            global.RunState.save(run);
            const after = resolvedRosterPlayer(entry.playerId);
            closeModal();
            toast(`${escapeHtml(item.name)} utilizzata\nLivello ${before.displayLevel} → ${after.displayLevel}\nOverall ${before.overall} → ${after.overall}`);
            renderInventory();
          },
        });
      });
    });
  }

  function choosePlayerForPotentialBoost(item) {
    openModal(`
      <div class="inventory-flow-head">${itemIcon(item)}<div><p class="eyebrow">${escapeHtml(item.name)}</p><h2>Scegli il giocatore</h2><p>Aumenta subito overall attuale e potenziale massimo dello stesso valore, senza cambiare livello.</p></div></div>
      ${inventoryPlayerSelectionMarkup(item, "potential")}
      <div class="inventory-modal-actions"><button type="button" class="btn btn-ghost" data-close-inventory-flow>RINUNCIA</button></div>`,
      { closeable: true, className: "item-assignment-modal consumable-assignment-modal inventory-flow-modal" }
    );
    modalRoot.querySelector("[data-close-inventory-flow]")?.addEventListener("click", closeModal);
    modalRoot.querySelectorAll("[data-consumable-player]").forEach((button) => {
      button.addEventListener("click", () => {
        const entry = rosterEntry(button.dataset.consumablePlayer);
        if (!entry) return;
        const player = sourcePlayer(entry);
        const before = resolvedRosterPlayer(entry.playerId);
        const maxBoost = Math.max(0, 99 - Number(player.finalOverall || 0));
        entry.potentialBoostApplications = global.InazumaProgression.normalizePotentialBoostApplications(entry, maxBoost);
        const currentPotentialBoost = entry.potentialBoostApplications.reduce((sum, boost) => sum + boost.amount, 0);
        const currentOverallBoost = Math.min(currentPotentialBoost, Math.max(0, Number(entry.currentOverallBoost ?? currentPotentialBoost)));
        const addedBoost = Math.min(Number(item.amount || 3), Math.max(0, maxBoost - currentPotentialBoost));
        if (addedBoost <= 0) return toast("Questo giocatore ha già raggiunto il potenziale massimo. L'oggetto NON viene consumato.");
        openInventoryConfirmation(item, {
          title: `Allenare ${before.name}?`,
          description: `Overall e potenziale aumenteranno di ${addedBoost}.`,
          onCancel: () => choosePlayerForPotentialBoost(item),
          onConfirm: () => {
            entry.potentialBoost = Math.min(maxBoost, currentPotentialBoost + addedBoost);
            entry.currentOverallBoost = Math.min(maxBoost, currentOverallBoost + addedBoost);
            entry.intensiveTrainingMigrated = true;
            entry.potentialBoostApplications = Array.isArray(entry.potentialBoostApplications) ? entry.potentialBoostApplications : [];
            if (addedBoost > 0) entry.potentialBoostApplications.push({ amount: addedBoost, appliedLevel: Number(entry.level || 0) });
            removeInventoryItem(item.instanceId);
            global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.ITEM_USED, { itemId: item.id, effect: item.effect, instanceId: item.instanceId, actionId: `${run.runId}:${item.instanceId}:used` });
            global.RunState.save(run);
            const after = resolvedRosterPlayer(entry.playerId);
            closeModal();
            const rarityMessage = before.category !== after.category ? `\nNuova rarità: ${after.category}` : "";
            toast(`Pesi da allenamento completati\nOverall ${before.overall} → ${after.overall}\nPotenziale ${before.potential} → ${after.potential}${rarityMessage}`);
            renderInventory();
          },
        });
      });
    });
  }

  function chooseEquipmentPlayer(instanceId, options = {}) {
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return;
    ui.inventoryEquipmentPlayerId = options.selectedPlayerId ? String(options.selectedPlayerId) : null;
    const formation = formationById(run.formationId);
    openModal(`
      <div class="inventory-flow-head">${itemIcon(item)}<div><p class="eyebrow">${escapeHtml(item.name)}</p><h2>Equipaggia un giocatore</h2><p>Sono mostrati tutti i titolari e le riserve. L'oggetto già indossato è visibile sulla card e nel riepilogo.</p></div></div>
      <p class="inventory-equipment-instruction">Seleziona un giocatore dal campo o dalla panchina.</p>
      <div class="inventory-equipment-workspace squad-screen">
        <section class="squad-field-panel inventory-equipment-field" aria-label="Titolari sul campo">
          <div class="squad-panel-head"><div><p class="eyebrow">Titolari</p><h3>Campo tattico</h3></div><span class="squad-field-formation">${escapeHtml(formation?.name || run.formationId)}</span></div>
          ${inventoryEquipmentPitchMarkup(item, ui.inventoryEquipmentPlayerId)}
        </section>
        <aside class="inventory-equipment-sidebar">
          <section class="squad-bench-panel" aria-label="Riserve">
            <div class="squad-panel-head"><div><p class="eyebrow">Panchina</p><h3>Riserve</h3></div><span class="squad-bench-count">${Math.min((run.bench || []).length, 4)}/4</span></div>
            <div class="bench-list squad-bench-list">${inventoryEquipmentBenchMarkup(item, ui.inventoryEquipmentPlayerId)}</div>
          </section>
          <section class="inventory-equipment-selection-summary" data-equipment-selection-summary aria-live="polite">${inventoryEquipmentSelectionSummary(ui.inventoryEquipmentPlayerId)}</section>
          <div class="inventory-modal-actions">
            <button type="button" class="btn btn-yellow" data-confirm-equipment-target ${ui.inventoryEquipmentPlayerId ? "" : "disabled"}>CONFERMA</button>
            <button type="button" class="btn btn-ghost" data-close-inventory-flow>RINUNCIA</button>
          </div>
        </aside>
      </div>`,
      { closeable: true, className: "item-assignment-modal inventory-flow-modal inventory-equipment-selector-modal" }
    );
    modalRoot.querySelector("[data-close-inventory-flow]")?.addEventListener("click", closeModal);
    modalRoot.querySelector(".inventory-equipment-workspace")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-equip-player]");
      if (!button || button.disabled) return;
      event.preventDefault();
      setInventoryEquipmentTarget(button.dataset.equipPlayer);
    });
    modalRoot.querySelector("[data-confirm-equipment-target]")?.addEventListener("click", () => {
      if (ui.inventoryEquipmentPlayerId) handleEquipmentTarget(instanceId, ui.inventoryEquipmentPlayerId);
    });
  }

  function handleEquipmentTarget(instanceId, playerId) {
    const entry = rosterEntry(playerId);
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!entry || !item) return;
    const target = equipmentTargetState(entry, item);
    if (!target.valid) return toast(target.reason);
    const player = sourcePlayer(entry);
    if (entry.equippedItem) {
      const current = resolveItem(entry.equippedItem);
      return openModal(`
        <div class="inventory-confirmation">
          <div class="inventory-confirmation-item">${itemIcon(item)}<div><p class="eyebrow">Sostituzione oggetto</p><h2>${escapeHtml(player.name)}</h2></div></div>
          <div class="inventory-equipment-replacement">${itemIcon(current)}<div><small>Oggetto attuale</small><strong>${escapeHtml(current.name)}</strong><span>Verrà riportato nello zaino.</span></div></div>
          <p><strong>${escapeHtml(current.name)}</strong> verrà sostituito con <strong>${escapeHtml(item.name)}</strong>.</p>
          <div class="button-row inventory-modal-actions"><button type="button" class="btn btn-yellow" id="confirm-equip-replace">CONFERMA SOSTITUZIONE</button><button type="button" class="btn btn-ghost" id="cancel-equip-replace">ANNULLA</button></div>
        </div>`,
        { closeable: false, className: "inventory-flow-modal inventory-confirmation-modal" }
      ), document.getElementById("confirm-equip-replace").addEventListener("click", () => equipItemToEntry(instanceId, entry)), document.getElementById("cancel-equip-replace").addEventListener("click", () => chooseEquipmentPlayer(instanceId, { selectedPlayerId: playerId }));
    }
    return openInventoryConfirmation(item, {
      title: `Equipaggiare ${player.name}?`,
      description: `${item.name} verrà assegnato a ${player.name}.`,
      onCancel: () => chooseEquipmentPlayer(instanceId, { selectedPlayerId: playerId }),
      onConfirm: () => equipItemToEntry(instanceId, entry),
    });
  }

  function equipItemToEntry(instanceId, entry) {
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return;
    const newEquipment = removeInventoryItem(instanceId);
    if (entry.equippedItem) run.inventory.push(entry.equippedItem);
    entry.equippedItem = newEquipment;
    global.RunState.save(run);
    closeModal();
    toast(`Hai equipaggiato ${resolveItem(item).name} a ${sourcePlayer(entry).name}`);
    renderInventory({ keepScroll: true });
  }

  function unequipPlayerItem(playerId, options = {}) {
    const entry = rosterEntry(playerId);
    if (!entry?.equippedItem) return;
    if (run.inventory.length >= global.SEASON1_CONFIG.maxInventory) return toast("Inventario pieno: libera prima uno spazio");
    if (!options.confirmed) {
      const item = resolveItem(entry.equippedItem);
      const player = sourcePlayer(entry);
      return openInventoryConfirmation(item, {
        title: `Rimuovere ${item.name}?`,
        description: `${item.name} verrà rimosso da ${player.name} e riportato nello zaino.`,
        confirmLabel: "RIMUOVI",
        onConfirm: () => unequipPlayerItem(playerId, { ...options, confirmed: true }),
      });
    }
    run.inventory.push(entry.equippedItem);
    entry.equippedItem = null;
    global.RunState.save(run);
    toast("Oggetto riportato nell'inventario");
    (options.render || renderInventory)();
  }

  function renderGameOver() {
    app.innerHTML = `
      <main class="gameover-screen">
        <div><p class="eyebrow">0 vite rimaste</p><h1>Run terminata</h1><p class="muted">Per riprovare devi ricominciare dalla scelta del modulo.</p>
        <div class="button-row"><button type="button" class="btn btn-yellow" id="restart-run">Nuova run</button><button type="button" class="btn" id="home">Menu</button></div></div>
      </main>`;
    resetRenderedViewScroll();
    document.getElementById("restart-run").addEventListener("click", () => {
      openTeamNameModal();
    });
    document.getElementById("home").addEventListener("click", renderHome);
  }


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

  function snapshotPlayer(entry, area, slot) {
    const source = sourcePlayer(entry);
    const resolved = resolvedRosterPlayer(entry.playerId) || source || {};
    return { playerId: String(entry.playerId), name: resolved.name || source?.name || String(entry.playerId), nickname: resolved.nickname || null, role: resolved.position || source?.position || null, element: resolved.element || resolved.type || source?.element || null, portraitUrl: playerPortraitUrl(resolved || source), fullbodyUrl: resolvePlayerVisual(resolved || source, { playerId: entry.playerId }).frontFullbodyUrl || null, teamId: entry.teamId || source?.teamId || null, teamName: entry.teamName || source?.teamName || null, originalRarity: source?.category || null, finalRarity: resolved.category || source?.category || null, recruitedAtLevel: entry.recruitedAtLevel ?? null, finalLevel: Number(entry.level || 0), recruitedOverall: entry.recruitedOverall ?? null, finalOverall: resolved.overall ?? source?.finalOverall ?? null, finalPotential: resolved.potential ?? null, finalStats: resolved.stats || null, equippedItem: entry.equippedItem ? { ...entry.equippedItem } : null, formationSlot: area === "lineup" ? slot : null, benchSlot: area === "bench" ? slot : null, recruitmentSource: entry.source || null, traits: Array.isArray(entry.traits) ? entry.traits.slice() : [] };
  }

  function collectPlayerStatistics(players) {
    const stats = {};
    players.forEach((player) => { stats[player.playerId] = { appearancesTotal: player.formationSlot != null ? 1 : 0, appearances5v5: 0, appearances11v11: player.formationSlot != null ? 1 : 0, winsAsStarter: player.formationSlot != null ? 1 : 0, goals: 0, saves: 0, defensiveStops: 0, shots: null, posts: null, crossbars: null, bossMatches: player.formationSlot != null ? 1 : 0, recruitedAtLevel: player.recruitedAtLevel, finalLevel: player.finalLevel, recruitedOverall: player.recruitedOverall, finalOverall: player.finalOverall, overallGrowth: player.recruitedOverall == null || player.finalOverall == null ? null : Number(player.finalOverall) - Number(player.recruitedOverall), equipmentUsed: player.equippedItem ? [player.equippedItem] : [] }; });
    const timeline = run.activeMatch?.simulation?.timeline || [];
    timeline.forEach((event) => { const id = String(event.playerId || ""); if (!stats[id]) return; if (event.type === "goal") stats[id].goals += 1; if (event.type === "save") stats[id].saves += 1; if (event.type === "defense") stats[id].defensiveStops += 1; });
    return stats;
  }

  function buildChampionSnapshot(finalBoss) {
    const identity = normalizeTeamIdentity(run.teamIdentity);
    const starters = run.lineup.map((id, index) => snapshotPlayer(rosterEntry(id), "lineup", index + 1)).filter(Boolean);
    const bench = run.bench.slice(0, 4).map((id, index) => snapshotPlayer(rosterEntry(id), "bench", index + 1)).filter(Boolean);
    const fullRoster = run.roster.map((entry) => snapshotPlayer(entry, run.lineup.includes(String(entry.playerId)) ? "lineup" : (run.bench.includes(String(entry.playerId)) ? "bench" : "roster"), run.lineup.indexOf(String(entry.playerId)) + 1 || run.bench.indexOf(String(entry.playerId)) + 1 || null));
    const avg = starters.length ? Math.round(starters.reduce((sum, p) => sum + Number(p.finalOverall || 0), 0) / starters.length) : null;
    global.RunStatistics?.snapshotFinalPlayerStats?.(run, fullRoster);
    const statsSnapshot = global.RunStatistics?.buildHallOfFameStatisticsSnapshot?.(run) || { runStatistics: {}, playerStatistics: {}, matchHistory: [], awards: [] };
    const seasonMeta = global.SeasonRegistry.get(run?.seasonId);
    const runStatistics = { ...statsSnapshot.runStatistics, mode: seasonMeta.name, season: seasonMeta.name, victoryDate: run.completedAt || new Date().toISOString(), seed: run.runId, durationMs: run.createdAt ? Date.now() - new Date(run.createdAt).getTime() : statsSnapshot.runStatistics.durationMs, finalTeamLevel: run.teamLevel ?? null, finalAverageOverall: avg, finalFormation: run.formationId, livesRemaining: run.lives ?? null, recruitedPlayers: run.roster.length, bossesDefeated: (run.completedBossIds || []).slice() };
    const snapshot = { archiveSchemaVersion: 1, runId: run.runId, teamName: identity.name, teamLogo: identity.logo || "inazuma-lightning", modeId: seasonMeta.id, modeName: seasonMeta.name, seasonId: seasonMeta.id, seasonName: seasonMeta.name, difficultyId: null, victoryDate: run.completedAt || new Date().toISOString(), seed: run.runId, finalBossId: String(finalBoss?.teamId || "raimon"), finalBossName: finalBoss?.teamName || "Raimon", finalFormation: run.formationId, finalFormationTactics: global.MatchSimulator?.formationTactic?.(run.formationId) || null, finalStartingEleven: starters, fullRoster, bench, savedFiveVFiveFormation: run.fiveVFive ? JSON.parse(JSON.stringify(run.fiveVFive)) : null, finalTeamLevel: run.teamLevel ?? null, finalAverageOverall: avg, livesRemaining: run.lives ?? null, statisticsSchemaVersion: statsSnapshot.statisticsSchemaVersion || 1, statisticsComplete: statsSnapshot.statisticsComplete, statisticsStartedAt: statsSnapshot.statisticsStartedAt, runStatistics, playerStatistics: statsSnapshot.playerStatistics, matchHistory: statsSnapshot.matchHistory, awards: statsSnapshot.awards, rulesetVersion: "season1-config-v2", databaseVersion: seasonDb?.version || null, formationTacticsVersion: "match-simulator-config-v1", equipmentVersion: "season1-item-pool-v1", traitSystemVersion: null, sourceAppVersion: "hall-of-fame-v2-run-statistics" };
    snapshot.archiveKey = global.HallOfFameStorage.archiveKeyFor(snapshot);
    snapshot.hallTeamId = global.HallOfFameStorage.stableId(snapshot.archiveKey);
    return snapshot;
  }

  function persistChampionBeforeFinalUi(finalBoss = null) {
    const boss = finalBoss || seasonDb.bossOrder[Math.min(Number(run.bossIndex || 1) - 1, seasonDb.bossOrder.length - 1)] || seasonDb.bossOrder.at(-1);
    run.completedAt = run.completedAt || new Date().toISOString();
    const result = global.HallOfFameStorage.addChampion(buildChampionSnapshot(boss));
    run.hallTeamId = result.team.hallTeamId;
    run.phase = run.phase === "final-summary" ? "final-summary" : "final-celebration";
    global.RunState.save(run);
    return result.team;
  }

  function championTeam(hallTeamId) {
    let team = hallTeamId ? global.HallOfFameStorage.getTeam(hallTeamId) : null;
    if (!team && run?.phase === "complete") team = persistChampionBeforeFinalUi();
    return team;
  }

  function snapshotCard(player) {
    return compactPlayerCardMarkup({ ...player, position: player.role, category: player.finalRarity, overall: player.finalOverall, displayLevel: player.finalLevel, stats: player.finalStats }, { equipment: player.equippedItem, level: player.finalLevel, overall: player.finalOverall, dataAttr: `data-hall-player="${escapeHtml(player.playerId)}"`, extraClass: "hall-player-card" });
  }

  function championFormationMarkup(team) {
    const starters = Array.isArray(team.finalStartingEleven) ? team.finalStartingEleven : [];
    const rows = ["FW", "MF", "DF", "GK"].map((role) => starters.filter((p) => p.role === role));
    return `<section class="pitch hall-pitch">${rows.map((players) => `<div class="pitch-row tactical-row" data-row-count="${players.length || 1}" style="--players-in-row:${players.length || 1}">${players.map(snapshotCard).join("")}</div>`).join("")}</section>`;
  }

  function championFiveVFiveMarkup(team) {
    const formation = team.savedFiveVFiveFormation;
    const slots = formation?.slots || {};
    const roster = Array.isArray(team.fullRoster) ? team.fullRoster : [];
    const players = Object.values(slots).map((playerId) => roster.find((player) => String(player.playerId) === String(playerId))).filter(Boolean);
    if (!players.length) return `<p class="muted">${escapeHtml(formation?.formation || "Non disponibile")}</p>`;
    return `<p class="muted">${escapeHtml(formation?.formation || "Formazione salvata")}</p><div class="bench-list hall-five-list">${players.map(snapshotCard).join("")}</div>`;
  }

  function compactSeed(seed) { const value = String(seed || ""); return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value; }

  function formatStatValue(value, type = "text") {
    if (value == null || value === "") return null;
    if (type === "date") return formatDate(value);
    if (type === "duration") {
      const ms = Number(value);
      if (!Number.isFinite(ms) || ms < 0) return null;
      const minutes = Math.max(1, Math.round(ms / 60000));
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return hours ? `${hours}h ${rest}m` : `${minutes} min`;
    }
    if (type === "list") return Array.isArray(value) && value.length ? value : null;
    if (typeof value === "number" && !Number.isFinite(value)) return null;
    return String(value);
  }

  function runStatsSections(team) {
    const stats = team.runStatistics || {};
    return [
      { title: "Esito run", items: [
        { label: "Data vittoria", value: stats.victoryDate || team.victoryDate, type: "date" },
        { label: "Modalità", value: stats.mode || team.modeName },
        { label: "Season", value: normalizedHallSeasonName(team) },
        { label: "Seed", value: compactSeed(stats.seed || team.seed) },
      ] },
      { title: "Squadra finale", items: [
        { label: "Livello finale squadra", value: stats.finalTeamLevel ?? team.finalTeamLevel },
        { label: "Overall medio finale", value: stats.finalAverageOverall ?? team.finalAverageOverall },
        { label: "Modulo finale", value: stats.finalFormation || team.finalFormation },
        { label: "Vite rimaste", value: stats.livesRemaining ?? team.livesRemaining },
        { label: "Vite perse", value: stats.livesLost },
      ] },
      { title: "Risultati", items: [
        { label: "Partite", value: stats.matchesTotal },
        { label: "Vittorie", value: stats.winsTotal },
        { label: "Sconfitte", value: stats.lossesTotal },
        { label: "Striscia migliore", value: stats.longestWinStreak },
      ] },
      { title: "Gol", items: [
        { label: "Gol fatti", value: stats.goalsFor },
        { label: "Gol subiti", value: stats.goalsAgainst },
        { label: "Differenza reti", value: stats.goalDifference },
        { label: "Clean sheet", value: stats.cleanSheets },
      ] },
      { title: "Boss", items: [
        { label: "Partite Boss", value: stats.bossMatches },
        { label: "Vittorie Boss", value: stats.bossWins },
        { label: "Sconfitte Boss", value: stats.bossLosses },
      ] },
      { title: "Percorso", items: [
        { label: "Nodi completati", value: stats.nodesCompleted },
        { label: "Giocatori reclutati", value: stats.recruitedPlayers ?? stats.playersRecruited ?? team.fullRoster?.length },
        { label: "Durata run", value: stats.durationMs, type: "duration" },
      ] },
      { title: "Reclutamento e oggetti", items: [
        { label: "Pull aperte", value: stats.pullsOpened },
        { label: "Reroll usati", value: stats.rerollsUsed },
        { label: "Oggetti ottenuti", value: stats.itemsObtained },
        { label: "Oggetti usati", value: stats.itemsUsed },
        { label: "Allenamenti intensivi", value: stats.intensiveTrainingUsed },
      ] },
      { title: "Boss", items: [
        { label: "Boss finale", value: team.finalBossName },
        { label: "Boss superati", value: stats.bossesDefeated, type: "list" },
      ] },
    ];
  }

  function statsMarkup(team) {
    const sections = runStatsSections(team).map((section) => {
      const items = section.items.map((item) => ({ ...item, formatted: formatStatValue(item.value, item.type) })).filter((item) => item.formatted != null);
      if (!items.length) return "";
      return `<section class="hall-stat-group"><h3>${escapeHtml(section.title)}</h3><div class="hall-stat-list">${items.map((item) => item.type === "list" ? `<div class="hall-stat hall-stat-wide"><span>${escapeHtml(item.label)}</span><div class="hall-stat-chips">${item.formatted.map((value) => `<em>${escapeHtml(value)}</em>`).join("")}</div></div>` : `<div class="hall-stat"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.formatted)}</strong></div>`).join("")}</div></section>`;
    }).filter(Boolean).join("");
    return sections || '<p class="muted">Statistiche essenziali non disponibili per questa run.</p>';
  }

  function awardsMarkup(team) {
    const awards = (team.awards || []).filter((award) => award && award.playerName);
    return awards.map((award) => {
      const playerAttr = award.playerId ? ` data-hall-player="${escapeHtml(award.playerId)}"` : "";
      return `<article class="hall-award ${playerAttr ? "hall-player-card" : ""}"${playerAttr}><img src="${escapeHtml(award.portraitUrl || '')}" alt="" loading="lazy"/><div class="hall-award-copy"><strong>${escapeHtml(award.label || award.title)}</strong><span>${escapeHtml(award.playerName)}</span>${award.reason ? `<small>${escapeHtml(award.reason)}</small>` : ""}</div></article>`;
    }).join("") || '<p class="muted">Premi individuali disponibili solo quando i dati registrati sono affidabili.</p>';
  }

  function renderFinalCelebration(hallTeamId) {
    const team = championTeam(hallTeamId || run?.hallTeamId);
    if (!team) return renderHome();
    run.phase = "final-celebration"; run.hallTeamId = team.hallTeamId; global.RunState.save(run);
    app.innerHTML = `<main class="final-celebration-screen"><section class="final-celebration-panel"><div class="final-trophy" aria-hidden="true">🏆</div><p class="eyebrow">SEASON 1 COMPLETATA</p><h1>${escapeHtml(team.teamName)}</h1><h2>CAMPIONE</h2><p class="muted">${escapeHtml(team.modeName)} · ${formatDate(team.victoryDate)} · ${escapeHtml(team.finalFormation || '-')}</p>${championFormationMarkup(team)}<div class="button-row final-actions"><button type="button" class="btn btn-yellow" id="final-continue">Continua</button><button type="button" class="btn" id="skip-final-animation">Salta animazione</button></div></section></main>`;
    resetRenderedViewScroll(); bindHallPlayerDetails(team);
    const go = () => { run.phase = "final-summary"; global.RunState.save(run); renderFinalSummary(team.hallTeamId); };
    document.getElementById("final-continue").addEventListener("click", go);
    document.getElementById("skip-final-animation").addEventListener("click", go);
  }

  function renderFinalSummary(hallTeamId) {
    const team = championTeam(hallTeamId || run?.hallTeamId);
    if (!team) return renderHome();
    const summaries = global.HallOfFameStorage.listSummaries();
    const ordinal = summaries.findIndex((item) => item.hallTeamId === team.hallTeamId) + 1;
    run.phase = "final-summary"; run.hallTeamId = team.hallTeamId; global.RunState.save(run);
    app.innerHTML = `<main class="final-summary-screen"><header class="final-summary-head"><p class="eyebrow">CAMPIONI DELLA SEASON 1</p><h1>${escapeHtml(team.teamName)}</h1><p class="muted final-summary-meta"><span>${formatDate(team.victoryDate)}</span><span>${escapeHtml(normalizedHallSeasonName(team))}</span><span>Seed ${escapeHtml(compactSeed(team.seed))}</span><span>#${escapeHtml(ordinal || '-')} Albo d’Oro</span></p></header><nav class="final-tabs" role="tablist"><button class="active" data-final-tab="team" role="tab" aria-selected="true">Squadra</button><button data-final-tab="stats" role="tab" aria-selected="false">Statistiche</button><button data-final-tab="awards" role="tab" aria-selected="false">Premi</button></nav><section class="final-summary-grid"><article class="panel final-tab-panel" data-tab-panel="team">${tacticPanelMarkup(team.finalFormation, { compact: true })}${championFormationMarkup(team)}<h3>Riserve</h3><div class="bench-list">${(team.bench || []).map(snapshotCard).join("") || '<p class="muted">Non disponibili</p>'}</div><h3>Formazione 5v5</h3>${championFiveVFiveMarkup(team)}</article><article class="panel final-tab-panel" data-tab-panel="stats">${statsMarkup(team)}</article><article class="panel final-tab-panel" data-tab-panel="awards">${awardsMarkup(team)}</article><aside class="panel final-actions-panel"><button class="btn btn-yellow" id="open-current-hall">Apri Albo d’Oro</button><button class="btn" id="review-team">Rivedi la squadra</button>${sectionRootButton("finalSummary")}<button class="btn btn-primary" id="final-new-run">Nuova run</button></aside></section></main>`;
    resetRenderedViewScroll(); bindFinalTabs(); bindHallPlayerDetails(team);
    document.getElementById("open-current-hall").addEventListener("click", () => renderHallOfFameDetail(team.hallTeamId));
    document.getElementById("review-team").addEventListener("click", () => document.querySelector('[data-final-tab="team"]').click());
    bindSectionRootNav();
    document.getElementById("final-new-run").addEventListener("click", startNewRunFromHome);
  }

  function playerStatsMarkup(team, player, explicitStats = null) {
    const stats = explicitStats || team.playerStatistics?.[String(player.playerId)] || player.playerStatistics || {};
    const role = player.role || player.position || stats.role;
    const items = [
      ["Presenze", stats.appearances ?? stats.appearancesTotal], ["Vittorie", stats.wins],
      role !== "GK" ? ["Gol", stats.goals] : null,
      role === "FW" || role === "MF" ? ["Tiri", stats.shots] : null,
      role === "GK" ? ["Parate", stats.saves] : null,
      role === "GK" || role === "DF" ? ["Clean sheet", stats.cleanSheets] : null,
      role === "DF" || role === "MF" ? ["Azioni difensive", stats.defensiveActions ?? stats.defensiveStops] : null,
      ["Voto medio", stats.averageRating], ["Miglior voto", stats.bestRating], ["Crescita overall", stats.overallGrowth],
    ].filter((item) => item && item[1] != null && item[1] !== "");
    const awards = (team.awards || []).filter((award) => String(award.playerId || award.playerName) === String(player.playerId) || award.playerName === player.name).map((award) => award.label || award.title).filter(Boolean);
    const awardsMarkup = awards.length ? `<div class="run-stat-card"><span class="run-stat-label">Premi</span><strong class="run-stat-value">${escapeHtml(awards.join(", "))}</strong></div>` : "";
    if (!items.length && !awardsMarkup) return '<section class="player-history-section"><h3>PRESTAZIONI NELLA RUN</h3><p class="muted">Statistiche complete non disponibili per questa run.</p></section>';
    return `<section class="player-history-section"><h3>PRESTAZIONI NELLA RUN</h3><div class="player-history-stats">${items.map(([label, value]) => `<div class="run-stat-card"><span class="run-stat-label">${escapeHtml(label)}</span><strong class="run-stat-value">${escapeHtml(value)}</strong></div>`).join("")}${awardsMarkup}</div></section>`;
  }

  function bindFinalTabs() { document.querySelectorAll("[data-final-tab]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-final-tab]").forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-selected", item === button ? "true" : "false"); }); document.querySelectorAll("[data-tab-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === button.dataset.finalTab)); })); document.querySelector('[data-final-tab="team"]')?.click(); }

  function bindHallPlayerDetails(team) {
    document.querySelectorAll("[data-hall-player]").forEach((button) => button.addEventListener("click", () => {
      const player = (team.fullRoster || []).find((p) => String(p.playerId) === String(button.dataset.hallPlayer));
      if (!player) return;
      showPlayerDetailsFor(player, { mode: "historical", readOnly: true, source: "hall-of-fame", playerId: player.playerId, level: player.finalLevel, equipment: player.equippedItem, team, runStats: team.playerStatistics?.[String(player.playerId)] || null, preserveScroll: scrollSnapshot() });
    }));
  }

  function renderHallOfFame() {
    const teams = global.HallOfFameStorage.listSummaries();
    app.innerHTML = `<main class="hall-screen"><header class="topbar"><div><p class="eyebrow">ALBO D’ORO</p><h1>Squadre campioni</h1></div>${sectionRootButton("hallRoot")}</header>${teams.length ? `<section class="hall-grid">${teams.map((team, index) => `<article class="panel hall-card"><div class="hall-card-trophy">🏆 #${index + 1}</div><h2>${escapeHtml(team.teamName)}</h2><p class="muted">${escapeHtml(normalizedHallSeasonName(team))} · ${formatDate(team.victoryDate)}</p><p>${escapeHtml(team.finalFormation || '-')} · OVR ${escapeHtml(team.finalAverageOverall ?? 'N/D')} · ${escapeHtml(team.wins ?? 'N/D')}-${escapeHtml(team.losses ?? 'N/D')}</p><p>MVP: ${escapeHtml(team.mvp?.name || 'Non disponibile')} · Vite ${escapeHtml(team.livesRemaining ?? 'N/D')}</p><div class="hall-portraits">${(team.portraits || []).map((src) => `<img src="${escapeHtml(src)}" alt="" loading="lazy"/>`).join('')}</div><button class="btn btn-yellow" data-open-hall-team="${escapeHtml(team.hallTeamId)}">Apri squadra</button></article>`).join('')}</section>` : `<section class="panel hall-empty"><h2>Nessuna squadra campione.</h2><p class="muted">Completa una run per lasciare il tuo segno.</p></section>`}</main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();
    document.querySelectorAll("[data-open-hall-team]").forEach((button) => button.addEventListener("click", () => renderHallOfFameDetail(button.dataset.openHallTeam)));
  }

  function renderHallOfFameDetail(hallTeamId) {
    const team = global.HallOfFameStorage.getTeam(hallTeamId);
    if (!team) return renderHallOfFame();
    app.innerHTML = `<main class="hall-detail-screen"><header class="topbar"><div><p class="eyebrow">Albo d’Oro</p><h1>${escapeHtml(team.teamName)}</h1><p class="muted final-summary-meta"><span>${formatDate(team.victoryDate)}</span><span>Boss finale: ${escapeHtml(team.finalBossName || 'N/D')}</span><span>${escapeHtml(normalizedHallSeasonName(team))}</span></p></div>${sectionRootButton("hallDetail")}</header><section class="hall-detail-grid"><article class="panel">${tacticPanelMarkup(team.finalFormation, { compact: true })}${championFormationMarkup(team)}<h3>Riserve</h3><div class="bench-list">${(team.bench || []).map(snapshotCard).join('') || '<p class="muted">Non disponibili</p>'}</div><h3>5v5</h3>${championFiveVFiveMarkup(team)}</article><aside class="panel"> <h2>Statistiche</h2>${statsMarkup(team)}<h2>Premi</h2>${awardsMarkup(team)}</aside></section></main>`;
    resetRenderedViewScroll(); bindHallPlayerDetails(team);
    bindSectionRootNav();
  }

  function renderSeasonComplete() {
    return renderFinalCelebration(run?.hallTeamId);
  }


  async function loadSeason(seasonId) {
    activeSeason = global.SeasonRegistry.setActive(seasonId);
    seasonDb = await global.SeasonRegistry.loadDatabase(activeSeason.id);
    activeSeason = global.SeasonRegistry.get(activeSeason.id);
    seasonPlayersById = global.SeasonRegistry.playersIndex(activeSeason.id);
    seasonTeamsById = global.SeasonRegistry.teamsIndex(activeSeason.id);
    return seasonDb;
  }

  function showLoadError(error) {
    console.error(error);
    app.innerHTML = `
      <main class="hero-screen"><div><p class="eyebrow">Caricamento non riuscito</p><h2>Apri il progetto tramite un server locale</h2>
      <p class="muted">I browser bloccano i database JSON quando index.html viene aperto direttamente. Usa Live Server oppure il file AVVIA_GIOCO.bat.</p>
      <pre class="panel">${escapeHtml(error.message)}</pre></div></main>`;
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
      freeAgentsById = new Map(freeAgentsDb.players.map((player) => [String(player.playerId), player]));
      playerVisualsById = new Map(Object.entries(visualsDb.players || {}));
      renderHome();
    } catch (error) {
      showLoadError(error);
    }
  }

  init();
})(globalThis);
