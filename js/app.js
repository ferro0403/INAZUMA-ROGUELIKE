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
      return `<span class="item-icon item-icon--image" aria-label="${escapeHtml(name)}" title="${escapeHtml(name)}"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer" onerror="globalThis.handleItemImageError && globalThis.handleItemImageError(this)" />${itemImageFallbackSvg()}</span>`;
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
  function isProfileAwareSeason(seasonId = run?.seasonId) {
    return global.SeasonRegistry?.database?.(seasonId)?.requiresProfileAwareRuntime === true;
  }
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

  function compactPlayerCardMarkup(player, { equipment = null, equipmentInFooter = false, level = player.displayLevelText ?? player.displayLevel ?? 0, overall = player.overall ?? player.finalOverall, selected = false, dataAttr = "", extraClass = "", detailLayout = "inline", tag = "button", trailingMarkup = "" } = {}) {
    const cardTag = tag === "article" ? "article" : "button";
    const cardAttributes = cardTag === "button" ? 'type="button"' : "";
    const playerRole = player.position || player.normalizedRole || "-";
    const equipmentDefinition = equipment ? resolveItem(equipment) : null;
    const equipmentMarkup = equipmentDefinition
      ? `<span class="player-corner player-equipment ${equipmentInFooter ? "player-equipment--footer" : ""}" aria-label="Oggetto equipaggiato: ${escapeHtml(equipmentDefinition.name)}" title="${escapeHtml(equipmentDefinition.name)}">${itemIcon(equipment)}</span>`
      : "";
    const detailMarkup = detailLayout === "stacked"
      ? `<div class="player-meta player-meta--stacked" aria-label="Dettagli giocatore"><div class="player-meta-line player-meta-line--role-overall"><span data-player-role>${escapeHtml(playerRole)}</span><span aria-hidden="true">•</span><span data-player-overall>${escapeHtml(overall)}</span></div><div class="player-meta-line player-meta-line--level"><span aria-hidden="true">•</span><span data-player-level>Lv ${escapeHtml(level)}</span></div></div>`
      : `<div class="player-meta" aria-label="Dettagli giocatore"><span>${escapeHtml(playerRole)}</span><span>${escapeHtml(overall)}</span><span>Lv ${escapeHtml(level)}</span></div>`;
    return `
      <${cardTag} ${cardAttributes} class="player-card player-card-compact tactical-player-card tactical-player-card--desktop tactical-player-card--mobile mini-player ${escapeHtml(extraClass)} ${rarityClass(player.category)} ${equipment ? "has-equipment" : ""} ${selected ? "selected" : ""}" ${dataAttr}>
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
        ${trailingMarkup}
      </${cardTag}>`;
  }

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
      const barValue = Math.max(0, Math.min(100, effective));
      return `<div class="detail-stat player-stat-card" style="--stat-value:${barValue}%">${statIcon(stat)}<span class="detail-stat-label">${label}</span><strong class="detail-stat-value">${effective}</strong>${bonus > 0 ? `<em class="detail-stat-bonus">+${bonus}</em>` : ""}<span class="detail-stat-track" aria-hidden="true"><i></i></span></div>`;
    }).join("");
    const potential = historical ? (resolved.potential ?? "Non disponibile") : (resolved.potential ?? player.finalOverall);
    const origin = historical && team?.teamName ? `<p class="muted player-history-origin">Rosa campione: ${escapeHtml(team.teamName)}${player.recruitmentSource ? ` · Origine: ${escapeHtml(player.recruitmentSource)}` : ""}</p>` : "";
    const equipmentMarkup = equipment ? `<div class="equipped-detail"><div class="equipped-detail-art">${itemIcon(equipment)}</div><div class="equipped-detail-copy"><span>${historical ? "Equipaggiamento storico" : "Oggetto assegnato"}</span><strong>${escapeHtml(resolveItem(equipment).name)}</strong><small>${escapeHtml(resolveItem(equipment).description)}</small><em>+${Number(resolveItem(equipment).bonus || 0)} ${escapeHtml(STAT_LABELS[resolveItem(equipment).stat] || resolveItem(equipment).stat || "")}</em></div>${!readOnly && playerId ? `<button type="button" class="btn btn-ghost" data-detail-unequip="${escapeHtml(playerId)}">Rimuovi oggetto</button>` : ""}</div>` : `<div class="equipped-detail equipped-detail-empty"><div class="equipped-detail-copy"><span>Slot disponibile</span><strong>Nessun equipaggiamento</strong><small>Questo giocatore non ha ancora un oggetto assegnato.</small></div></div>`;
    const displayLevel = historical ? global.LevelProgression.formatLevel(player.finalLevel ?? 0, player.seasonId || team?.seasonId || team?.modeId, player.finalLevelUnits) : (player.displayLevelText ?? global.LevelProgression.formatLevel(level, run?.seasonId, player.displayLevelUnits));
    const contextLabel = albumMode ? "Album" : (historical ? "Squadra campione" : "");
    return `
      <div class="player-detail-layout ${rarityClass(resolved.category)} ${historical ? "player-detail-historical" : ""}">
        <section class="player-detail-hero ${String(resolved.name || "").length > 18 ? "player-detail-hero--extra-long-name" : (String(resolved.name || "").length > 12 ? "player-detail-hero--long-name" : "")}">
          <div class="player-detail-identity">${teamBadge}<div class="player-detail-heading"><p class="eyebrow">Scheda giocatore</p>${contextLabel ? `<span>${escapeHtml(contextLabel)}</span>` : ""}${albumMode ? `<span class="album-detail-badge">${albumUnlocked ? "SBLOCCATO" : "CONSULTABILE"}</span>` : ""}</div><h2 class="player-detail-name">${escapeHtml(resolved.name)}</h2><div class="player-detail-tags"><span class="role-chip"><b>${escapeHtml(resolved.position)}</b></span><span class="role-chip detail-element-chip"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4 3 7 6 7 10a7 7 0 0 1-14 0c0-4 3-7 7-10Z"/></svg>${escapeHtml(resolved.element || resolved.type || "-")}</span><span class="role-chip">Lv ${escapeHtml(displayLevel)}</span></div><div class="overall-comparison"><div><span>Overall<br><b>attuale</b></span><strong>${escapeHtml(resolved.overall ?? "N/D")}</strong></div><div><span>Potenziale</span><strong>${escapeHtml(potential)}</strong></div></div><p class="detail-category"><span aria-hidden="true">★</span><small>Rarità</small><strong>${escapeHtml(resolved.category)}</strong></p></div>
          <div class="player-detail-visual ${rarityClass(resolved.category)}">${detailVisual.detailImageUrl ? `<img class="player-fullbody player-fullbody--${escapeHtml(detailVisual.detailImageKind)}" src="${escapeHtml(detailVisual.detailImageUrl)}" alt="${escapeHtml(resolved.name)}" loading="lazy" decoding="async" ${imageFallbackAttributes(detailVisual.detailFallbacks)} />` : `<span class="player-fullbody player-fullbody-placeholder" aria-hidden="true">⚽</span>`}</div>
        </section>
        <section class="player-detail-content"><section class="player-detail-section"><h3><span>Statistiche</span></h3><div class="detail-stats">${stats}</div></section><section class="player-detail-section player-detail-equipment"><h3><span>Equipaggiamento</span></h3>${equipmentMarkup}</section>${historical ? playerStatsMarkup(team || {}, player, runStats) : ""}${origin}</section>
      </div>`;
  }

  function showPlayerDetailsFor(player, options = {}) {
    if (!player) return toast("Giocatore non disponibile");
    const opts = { playerId: player.playerId, level: player.displayLevel ?? 0, database: freeAgentsDb, equipment: null, onClose: null, ...options };
    openModal(playerDetailMarkup(player, opts), { closeable: true, className: `player-detail-modal${opts.mode === "album" ? " album-player-detail-modal" : ""}`, onClose: opts.onClose, preserveScroll: opts.preserveScroll });
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

  function drainPermanentEffects() {
    const result = global.PermanentEffects.drain(run);
    if (result.error) console.error("Permanent effect remains pending", result.error);
    return result;
  }

  function resumeRunFinalization({ render = true } = {}) {
    if (!global.RestoreGameplayRoutingGate?.enter("finalization")) return { completed: false, blocked: true };
    const result = global.PermanentEffects.resumeFinalization(run);
    if (!result.completed) {
      if (result.error) {
        console.error("Finalization remains resumable", result.error);
        toast("Finalizzazione non completata. Riprova con Continua.");
      }
      if (render) renderFinalizationPending(result);
      return result;
    }
    if (!render) return result;
    return resolveDevelopmentEndRunFlow({
      endReason: "victory",
      onComplete: () => renderFinalCelebration(run.hallTeamId, { developmentResolved: true }),
    });
  }

  function renderFinalizationPending(result = {}) {
    app.innerHTML = `<main class="hero-screen finalization-pending-screen" data-finalization-pending>
      <section class="panel"><p class="eyebrow">SALVATAGGIO CAMPIONI</p><h1>Finalizzazione in sospeso</h1>
      <p class="muted">La vittoria è al sicuro. Completa il salvataggio permanente prima di continuare.</p>
      <button type="button" class="btn btn-yellow" id="retry-run-finalization">RIPROVA / CONTINUA</button></section>
    </main>`;
    resetRenderedViewScroll();
    const retry = document.getElementById("retry-run-finalization");
    retry?.addEventListener("click", () => {
      retry.disabled = true;
      const resumed = resumeRunFinalization({ render: false });
      if (resumed.completed) {
        return resolveDevelopmentEndRunFlow({
          endReason: "victory",
          onComplete: () => renderFinalCelebration(run.hallTeamId, { developmentResolved: true }),
        });
      }
      toast("Finalizzazione ancora in sospeso. Puoi riprovare senza perdere la vittoria.", "error");
      renderFinalizationPending(resumed);
    });
    return result;
  }

  function enqueueAlbumRecruit(current, playerId, source, actionId) {
    return global.PermanentEffects.enqueueAlbum(current, { playerId, source, actionId });
  }

  function unlockAlbumRecruit() {
    return drainPermanentEffects();
  }

  function albumFreeAgentPlayers(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    return global.AlbumCatalog.freeAgentPlayers(freeAgentsDb?.players, collectionId);
  }

  function albumCollectionPlayers(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    const db = global.SeasonRegistry.database(collectionId) || seasonDb;
    const byId = new Map();
    (db?.players || []).forEach((player) => byId.set(String(player.playerId), { ...player, albumDatabase: db }));
    albumFreeAgentPlayers(collectionId).forEach((player) => { if (!byId.has(String(player.playerId))) byId.set(String(player.playerId), { ...player, albumDatabase: freeAgentsDb }); });
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
    return `<article class="home-hub-card album-home-card" aria-label="Album">
      <div class="home-card-kicker"><span>▣</span><strong>ALBUM</strong></div>
      <h2>Album</h2>
      <p class="muted">Completa la collezione dei giocatori.</p>
      <div class="stat-grid home-stat-grid"><div class="stat-card"><span>ALBUM</span><strong>${Object.keys(global.AlbumProgress?.ALBUM_COLLECTIONS || {}).length} COLLEZIONI</strong></div></div>
      <div class="home-card-actions"><button type="button" class="btn btn-yellow" id="open-album-home">Apri Album</button></div>
    </article>`;
  }

  function albumProgressForPlayers(players, collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    const unlocked = global.AlbumProgress.unlockedSet(collectionId);
    const ids = [...new Set((players || []).map((player) => String(player.playerId)))];
    return { unlocked: ids.filter((id) => unlocked.has(id)).length, total: ids.length };
  }

  function albumPlayerView(player, database, state = undefined) {
    const basePotential = Number(player.basePotential ?? player.finalOverall ?? 0);
    const final = global.DevelopmentRuntime.resolveAccountPlayer(player, Number(player.maxLevel || 20), database, state ? { state } : undefined);
    return { ...player, basePotential, overall: final.overall, finalOverall: final.overall, potential: final.potential, category: final.category, stats: final.stats, baseStats: final.stats, displayLevel: Number(player.maxLevel || 20), albumDatabase: database };
  }

  function albumProgressPercent(progress) {
    const unlocked = Number(progress?.unlocked);
    const total = Number(progress?.total);
    const safeUnlocked = Number.isFinite(unlocked) ? Math.max(0, unlocked) : 0;
    const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
    if (safeTotal <= 0) return 0;
    return Math.min(100, Math.max(0, (safeUnlocked / safeTotal) * 100));
  }

  async function renderAlbumCollections() {
    run = global.RunState.load();
    ensureRunSchema();
    const currentSeasonId = activeSeason?.id || global.SeasonRegistry.activeId();
    await Promise.all(Object.values(global.AlbumProgress.ALBUM_COLLECTIONS).map((collection) => global.SeasonRegistry.loadDatabase(collection.seasonId)));
    global.SeasonRegistry.setActive(currentSeasonId);
    ensureAlbumBackfill();
    app.innerHTML = `<main class="album-screen"><header class="topbar album-topbar"><div><p class="eyebrow">Album</p><h1>Collezioni</h1><p class="muted">Progressi permanenti, separati dalla run attiva.</p></div>${sectionRootButton("albumRoot")}</header><section class="album-collection-grid">${Object.values(global.AlbumProgress.ALBUM_COLLECTIONS).map((collection) => { const progress = albumCollectionProgress(collection.id); const percent = albumProgressPercent(progress); const percentLabel = `${Math.round(percent)}%`; const coverUrl = collection.coverUrl || ""; return `<button type="button" class="panel album-collection-card" data-album-collection="${escapeHtml(collection.id)}" aria-label="Apri collezione ${escapeHtml(collection.name)}: ${escapeHtml(progress.unlocked)} su ${escapeHtml(progress.total)} giocatori sbloccati, ${escapeHtml(percentLabel)}"><span class="album-collection-cover"><img src="${escapeHtml(coverUrl)}" alt="" loading="lazy" decoding="async" onerror="this.hidden=true; this.parentElement.classList.add('is-fallback');" /></span><span class="album-collection-content"><span class="album-collection-kicker">COLLEZIONE</span><span class="album-collection-title">${escapeHtml(collection.name)}</span><span class="album-collection-subtitle">Collezione giocatori</span><span class="album-collection-progress-copy"><span>${escapeHtml(progress.unlocked)} / ${escapeHtml(progress.total)} giocatori sbloccati</span><strong>${escapeHtml(percentLabel)}</strong></span><span class="album-collection-progress-bar" aria-hidden="true"><span style="width: ${percent}%"></span></span><span class="album-collection-action">Apri collezione <span aria-hidden="true">→</span></span></span></button>`; }).join("")}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();
    document.querySelectorAll("[data-album-collection]").forEach((button) => button.addEventListener("click", () => renderAlbumTeams(button.dataset.albumCollection)));
  }

  function albumTeamsView(collectionId = ui.albumCollectionId, database = seasonDb) {
    const teams = global.RecruitmentPoolRuntime.orderedAlbumTeams(database, Boolean(database?.recruitmentPool?.entries), isProfileAwareSeason(collectionId));
    const freeAgentsTeam = { teamId: "__free_agents", teamName: "Svincolati", logoUrl: null, playerIds: albumFreeAgentPlayers(collectionId).map((player) => String(player.playerId)), freeAgents: true };
    return [...teams, freeAgentsTeam];
  }

  function albumTeamPlayers(team, collectionId = ui.albumCollectionId) {
    if (team?.freeAgents) return albumFreeAgentPlayers(collectionId);
    if (isProfileAwareSeason(collectionId) && team?.playerProfileIds?.length) {
      return team.playerProfileIds.map((profileId) => {
        const profile = global.ProfiledSeasonRuntime.resolveProfile(collectionId, profileId);
        return profile ? { ...global.ProfiledSeasonRuntime.resolveEffectiveBase({ playerId: profile.playerId, activeProfileId: profile.profileId, activeRoleVariantId: profile.defaultRoleVariantId }, collectionId), albumProfileId: profile.profileId } : null;
      }).filter(Boolean);
    }
    return (team?.playerIds || []).map((id) => seasonPlayersById.get(String(id))).filter(Boolean);
  }

  async function renderAlbumTeams(collectionId = global.AlbumProgress.DEFAULT_COLLECTION_ID) {
    closeModal({ invokeOnClose: false });
    await loadSeason(collectionId);
    ui.albumCollectionId = collectionId;
    const collection = global.AlbumProgress.ALBUM_COLLECTIONS[collectionId];
    ensureAlbumBackfill();
    app.innerHTML = `<main class="album-screen"><header class="topbar album-topbar"><div><p class="eyebrow">Album → ${escapeHtml(collection.name)}</p><h1>Squadre</h1></div>${sectionRootButton("albumCollection")}</header><section class="album-team-grid">${albumTeamsView(collectionId).map((team) => { const players = albumTeamPlayers(team, collectionId); const progress = albumProgressForPlayers(players, collectionId); const complete = progress.total > 0 && progress.unlocked === progress.total; return `<button type="button" class="panel album-team-card ${complete ? "album-complete" : ""}" data-album-team="${escapeHtml(team.teamId)}" aria-label="${escapeHtml(team.teamName)} ${progress.unlocked} su ${escapeHtml(progress.total)}"><span class="album-team-logo">${albumTeamLogoMarkup(team)}</span><strong>${escapeHtml(team.teamName)}</strong><span>${escapeHtml(progress.unlocked)} / ${escapeHtml(progress.total)}</span>${complete ? `<em>Completato</em>` : ""}</button>`; }).join("")}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav({ collectionId });
    document.querySelectorAll("[data-album-team]").forEach((button) => button.addEventListener("click", () => renderAlbumRoster(collectionId, button.dataset.albumTeam)));
  }

  function renderAlbumRoster(collectionId, teamId) {
    closeModal({ invokeOnClose: false });
    ui.albumCollectionId = collectionId; ui.albumTeamId = teamId;
    const team = albumTeamsView(collectionId).find((candidate) => String(candidate.teamId) === String(teamId));
    if (!team) return renderAlbumTeams(collectionId);
    const rawPlayers = albumTeamPlayers(team, collectionId);
    const database = team.freeAgents ? freeAgentsDb : seasonDb;
    const albumProgressState = global.AlbumProgress.read();
    const unlocked = global.AlbumProgress.unlockedSet(collectionId, albumProgressState);
    const developmentState = global.DevelopmentAccountV3.read();
    const rawById = new Map(rawPlayers.map((player) => [String(player.playerId), player]));
    const resolvedById = new Map();
    const progress = { unlocked: rawPlayers.filter((player) => unlocked.has(String(player.playerId))).length, total: rawPlayers.length };
    const pageSize = 60;
    let visibleCount = rawPlayers.length > 80 ? pageSize : rawPlayers.length;
    const resolvedPlayer = (raw) => {
      const id = String(raw.playerId);
      if (!resolvedById.has(id)) resolvedById.set(id, albumPlayerView(raw, database, developmentState));
      return resolvedById.get(id);
    };
    const rosterMarkup = () => {
      const visible = rawPlayers.slice(0, visibleCount);
      const cards = visible.map((raw) => {
        const player = resolvedPlayer(raw);
        const isUnlocked = unlocked.has(String(player.playerId));
        return `<div class="album-player-entry ${isUnlocked ? "is-unlocked" : "is-locked"}" data-album-player-entry="${escapeHtml(player.playerId)}" data-album-unlocked="${isUnlocked ? "true" : "false"}">${playerCard(player, { button: true, dataAttribute: "data-album-player", level: player.maxLevel || 20, database: player.albumDatabase, resolvedPlayer: player })}${isUnlocked ? "" : `<span class="album-lock-overlay album-player-lock"><span aria-hidden="true">🔒</span>Non sbloccato</span>`}</div>`;
      }).join("");
      const remaining = rawPlayers.length - visible.length;
      return `${cards}${remaining > 0 ? `<div class="album-load-more-wrap"><button type="button" class="btn btn-yellow album-load-more" data-album-load-more>MOSTRA ALTRI ${escapeHtml(Math.min(pageSize, remaining))}</button><small>${escapeHtml(visible.length)} di ${escapeHtml(rawPlayers.length)}</small></div>` : ""}`;
    };
    app.innerHTML = `<main class="album-screen album-roster-screen"><header class="topbar album-topbar album-roster-header"><div class="album-roster-title"><span class="album-team-logo album-team-logo--header album-roster-logo">${albumTeamLogoMarkup(team)}</span><div class="album-roster-heading"><p class="eyebrow album-roster-breadcrumb">Album → ${escapeHtml(global.AlbumProgress.ALBUM_COLLECTIONS[collectionId]?.name || collectionId)}</p><h1 class="album-roster-name">${escapeHtml(team.teamName)}</h1><p class="muted album-roster-progress">${escapeHtml(progress.unlocked)} / ${escapeHtml(progress.total)} giocatori sbloccati</p></div></div>${sectionRootButton("albumRoster", "album-roster-action")}</header><section class="album-player-grid" data-album-roster>${rosterMarkup()}</section></main>`;
    resetRenderedViewScroll();
    bindSectionRootNav({ collectionId });
    const albumRoster = document.querySelector("[data-album-roster]");
    bindAlbumRosterInteractions(albumRoster, ({ playerId }) => {
      const raw = rawById.get(String(playerId));
      const player = raw ? resolvedPlayer(raw) : null;
      if (!player) {
        console.error("Album player not found", { collectionId, teamId, playerId });
        return;
      }
      const isUnlocked = unlocked.has(String(player.playerId));
      showPlayerDetailsFor(player, { mode: "album", readOnly: true, playerId: player.playerId, level: player.maxLevel || 20, database: player.albumDatabase, equipment: null, preserveScroll: scrollSnapshot(), albumUnlocked: isUnlocked });
    });
    albumRoster?.addEventListener("click", (event) => {
      if (!event.target.closest("[data-album-load-more]")) return;
      visibleCount = Math.min(rawPlayers.length, visibleCount + pageSize);
      albumRoster.innerHTML = rosterMarkup();
    });
  }

  function bindAlbumRosterInteractions(albumRoster, openPlayer) {
    if (!albumRoster) return;
    // Keep one delegated listener while refreshing the resolver after every roster render.
    albumRoster.albumOpenPlayer = openPlayer;
    if (albumRoster.dataset.albumInteractionBound === "true") return;
    albumRoster.dataset.albumInteractionBound = "true";
    albumRoster.addEventListener("click", (event) => {
      const origin = typeof event.target?.closest === "function" ? event.target : event.target?.parentElement;
      const entry = origin?.closest("[data-album-player-entry]");
      const button = origin?.closest("[data-album-player]");
      const target = entry || button;
      if (!target || !albumRoster.contains(target)) return;
      event.preventDefault();
      albumRoster.albumOpenPlayer?.({ playerId: String(entry?.dataset.albumPlayerEntry ?? button.dataset.albumPlayer), entry, button });
    });
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

  function runFormationLabel(savedRun) {
    const formation = seasonDb?.formations?.eleven?.find((item) => item.id === savedRun?.formationId);
    return formation?.formation || formation?.name || savedRun?.formationId || "Da scegliere";
  }

  function runHeartsMarkup(savedRun) {
    return lifeHeartsMarkup(savedRun?.lives);
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

  const HOME_SECONDARY_ACTIONS = [
    { id: "open-shop-home", label: "Negozio", description: "Oggetti e potenziamenti", icon: "◆", className: "home-club-action--wide" },
    { id: "open-development-home", label: "Centro di Sviluppo", description: "Potenzia il tuo club", icon: "↗", className: "home-club-action--wide" },
    { id: "open-album-home", label: "Album", description: "Le tue collezioni", icon: "▤", className: "" },
    { id: "open-hall-home", label: "Albo d’Oro", description: "Le squadre campioni", icon: "★", className: "home-club-action--gold" },
    { id: "open-modes-home", label: "Modalità", description: "Altre modalità di gioco", icon: "⚡", className: "home-club-action--wide" },
  ];

  function homeQuickActionsMarkup() {
    const actions = HOME_SECONDARY_ACTIONS.map(({ id, label, description, icon, className }) => `
      <button type="button" class="home-club-action ${className}" id="${id}">
        <span class="home-club-icon" aria-hidden="true">${icon}</span><span class="home-club-copy"><strong>${label}</strong><small>${description}</small></span><span class="home-club-arrow" aria-hidden="true">»</span>
      </button>`).join("");
    return `<section class="home-club-section" aria-label="Il tuo club"><div class="home-section-label"><span>⚡</span> Il tuo club</div><nav class="home-club-actions" aria-label="Sezioni principali">${actions}</nav></section>`;
  }

  function homeTeamCrestMarkup(identity) {
    const emblem = global.TeamEmblems.resolveTeamEmblem({ teamIdentity: identity, fallbackKind: "user" });
    return global.TeamEmblems.teamEmblemMarkup(emblem, { escape: escapeHtml, className: "home-team-emblem" });
  }

  async function ensureHomeTeamEmblemSeasonLoaded(identity) {
    const encoded = global.TeamEmblems?.parseTeamEmblemId?.(identity?.emblemId);
    if (!encoded || !global.SeasonRegistry?.isSeasonSource?.(encoded.seasonId) || global.SeasonRegistry.database(encoded.seasonId)) return;
    const previousSeasonId = global.SeasonRegistry.activeId();
    try {
      await global.SeasonRegistry.loadDatabase(encoded.seasonId);
    } finally {
      global.SeasonRegistry.setActive(previousSeasonId);
    }
  }

  function homeIdentityMarkup(savedRun, profileIdentity = savedTeamIdentity()) {
    const identity = normalizeTeamIdentity(savedRun?.teamIdentity || profileIdentity || {});
    const season = savedRun ? global.SeasonRegistry?.get?.(savedRun.seasonId) : null;
    return `<section class="home-team-banner anime-panel" aria-label="Identità squadra">
      <div class="home-team-crest">${homeTeamCrestMarkup(identity)}</div>
      <div class="home-team-copy"><h1>${escapeHtml(identity.name)}</h1>${savedRun ? `<p>${escapeHtml(seasonDisplayName(savedRun.seasonId))}</p>${season?.displaySeasonNumber != null ? `<span>Stagione ${escapeHtml(season.displaySeasonNumber)}</span>` : ""}` : ""}</div>
    </section>`;
  }

  function homeActiveRunMarkup(savedRun) {
    // Historical smoke-test signature: class="home-hub-card home-run-card"
    const bossIndex = Number(savedRun.bossIndex || 0);
    const boss = seasonDb?.bossOrder?.[bossIndex];
    const bossNumber = bossIndex + 1;
    const totalBosses = seasonDb?.bossOrder?.length || 10;
    const zoneProgress = homeZoneProgress(savedRun);
    const bossLogo = bossTeamLogoUrl(boss);
    return `<div class="home-content"><section class="home-hero home-active-dashboard" aria-label="Home con run attiva">
      ${homeIdentityMarkup(savedRun)}
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
      <button type="button" class="home-main-cta" id="home-primary-cta"><span aria-hidden="true">⚡</span><strong id="continue-run">Continua la run »</strong></button>
      ${homeQuickActionsMarkup()}
    </section></div>`;
  }

  function homeEmptyRunMarkup() {
    return `<div class="home-content"><section class="home-hero home-empty-dashboard" aria-label="Home senza run attiva">
      ${homeIdentityMarkup(null)}
      <article class="home-empty-panel anime-panel">
        <div class="home-panel-kicker"><span>⚡</span> Nessuna run attiva</div>
        <div class="home-empty-copy">
          <h1>Scrivi la tua leggenda</h1>
          <p>Una nuova avventura ti aspetta.</p>
        </div>
        <button type="button" class="home-main-cta" id="home-primary-cta"><span aria-hidden="true">⚡</span><strong id="choose-run">Entra nel torneo »</strong></button>
      </article>
      ${homeQuickActionsMarkup()}
    </section></div>`;
  }

  function homeRunCardMarkup(savedRun) {
    if (!savedRun) return homeEmptyRunMarkup();
    return homeActiveRunMarkup(savedRun);
  }

  async function renderHome() {
    closeModal({ invokeOnClose: false });
    const latest = global.RunState.latestActiveSave?.();
    if (latest?.run) {
      await loadSeason(latest.run.seasonId || latest.season.id);
      run = global.RunState.load(activeSeason.id);
      if (persistenceWritesAllowed() && (!run?.finalization || run.finalization.status === "complete") && run?.permanentEffectOutbox?.some((effect) => effect.status === "pending")) drainPermanentEffects();
    } else {
      await loadSeason(global.SeasonRegistry.DEFAULT_SEASON_ID);
      run = null;
    }
    ensureRunSchema();
    const profileIdentity = migrateTeamIdentityProfile();
    if (persistenceWritesAllowed() && run && global.RoguelikeRules.migrateDefeatedBossPlayerLevels(run, seasonDb) > 0) { try { global.RunState.save(run); } catch (error) { console.error("save failed (boss level migration, init)", error); } }
    const homeIdentity = normalizeTeamIdentity(run?.teamIdentity || profileIdentity || {});
    await ensureHomeTeamEmblemSeasonLoaded(homeIdentity);
    app.innerHTML = `
      <main class="home-screen modern-home" id="clean-home" data-run-state="${run ? "active" : "empty"}">
        <header class="home-masthead">
          <div class="home-wordmark" aria-label="Inazuma Roguelike · Road to Raimon"><span>Ina<span>z</span>uma</span><small>Roguelike</small><i class="home-road-label">Road to Raimon</i></div>
          <div class="home-profile-actions">${global.InazumaAccountUI?.buttonMarkup?.() || '<button type="button" class="account-header-button" data-account-trigger disabled><span>ACCOUNT</span></button>'}<button type="button" class="home-settings-button" id="open-settings-home" aria-label="Impostazioni"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.6 3h4.8l.6 2.3 2 .9 2.1-1.2 2.4 4.1-1.8 1.6.2 2.2 1.8 1.6-2.4 4.1-2.3-.7-1.8 1.3-.5 2.3H9.6L9 18.3l-2-.9-2.1 1.2-2.4-4.1 1.8-1.6-.2-2.2-1.8-1.6L4.7 5l2.3.7 2-1.3L9.6 3Zm2.4 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg></button></div>
        </header>
        ${homeRunCardMarkup(run)}
      </main>`;
    resetRenderedViewScroll();

    document.getElementById("open-modes-home")?.addEventListener("click", renderSeasonSelect);
    document.getElementById("open-shop-home")?.addEventListener("click", () => renderShop());
    document.getElementById("home-primary-cta")?.addEventListener("click", () => run ? resumeRun() : renderSeasonSelect());
    document.getElementById("open-hall-home")?.addEventListener("click", renderHallOfFame);
    document.getElementById("open-album-home")?.addEventListener("click", renderAlbumCollections);
    document.getElementById("open-development-home")?.addEventListener("click", () => renderDevelopmentCenter());
    document.getElementById("open-settings-home")?.addEventListener("click", () => renderSettings({ view: "main" }));
    document.getElementById("open-hall-home-empty")?.addEventListener("click", renderHallOfFame);
    document.getElementById("open-hall-home-list")?.addEventListener("click", renderHallOfFame);
    document.getElementById("open-latest-hall-home")?.addEventListener("click", (event) => renderHallOfFameDetail(event.currentTarget.dataset.latestHall));
  }


  async function selectSeason(seasonId, { markPlayed = false } = {}) {
    await loadSeason(seasonId);
    run = global.RunState.load(activeSeason.id);
    ensureRunSchema();
    if (!run?.finalization || run.finalization.status === "complete") {
      if (run?.permanentEffectOutbox?.some((effect) => effect.status === "pending")) drainPermanentEffects();
    }
    if (run && markPlayed) global.RunState.touch(run);
    if (run && global.RoguelikeRules.migrateDefeatedBossPlayerLevels(run, seasonDb) > 0) { try { global.RunState.save(run); } catch (error) { console.error("save failed (boss level migration, selectSeason)", error); } }
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

  // Artwork is keyed by registry id so additions/reordering in SeasonRegistry do not
  // accidentally associate a cover with the wrong playable season.
  const SEASON_CARD_PRESENTATION = Object.freeze({
    ie1: Object.freeze({ coverUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiTljpQy0-8hZqy9NP7BmOZwijtzN9VGYbXEN4bR2bPW8GiaccWADFA3RAlYclPfO8HSr9aEgR8H_NWF-al-1MLXlH6ToD-mMNUKwTsaSKlKvUCEY1xzg_2auQvhA3usKf5qPwV8Iawi6pm/s1600/wallpapers_inazuma11_1_1024x768.jpg", focalPoint: "center" }),
    ie1_s2: Object.freeze({ coverUrl: "https://static.wikia.nocookie.net/inazuma-eleven/images/9/9b/%28Artwork%29_Aliea_Gakuen_captains.jpg/revision/latest?cb=20120722223451", focalPoint: "center 42%" }),
    ie1_s3: Object.freeze({ coverUrl: "https://static.wikia.nocookie.net/inazuma-eleven-fanon/images/6/67/Inazuma-boys-inazuma-eleven-35597232-1600-1200_%281%29.jpg/revision/latest?cb=20140310150638", focalPoint: "center" }),
    ie2: Object.freeze({ coverUrl: "https://www.akibagamers.it/wp-content/uploads/2019/12/inazuma-eleven-great-road-of-heroes-cover.jpg", focalPoint: "center 38%" }),
  });

  function seasonCoverMarkup(season) {
    const databasePresentation = global.SeasonRegistry?.database?.(season.id)?.presentation;
    const presentation = databasePresentation?.menuImageUrl
      ? { coverUrl: databasePresentation.menuImageUrl, focalPoint: databasePresentation.menuImageFocalPoint || "center" }
      : SEASON_CARD_PRESENTATION[season.id];
    return presentation ? `<img class="season-cover-art" src="${escapeHtml(presentation.coverUrl)}" alt="" style="object-position:${escapeHtml(presentation.focalPoint)}" loading="lazy" decoding="async" onerror="this.hidden=true;this.closest('.season-select-card').classList.add('season-cover-fallback')">` : "";
  }

  function seasonSelectCardMarkup({ season, savedRun, database, playersById, isLastPlayed }) {
    const activeSaved = savedRun && global.RunState.isActiveRun(savedRun) ? savedRun : null;
    const actions = activeSaved
      ? `<button type="button" class="btn btn-yellow" data-season-continue="${escapeHtml(season.id)}">CONTINUA</button><button type="button" class="btn btn-ghost" data-season-new="${escapeHtml(season.id)}">INIZIA</button><button type="button" class="btn season-delete-button" data-season-delete="${escapeHtml(season.id)}">ELIMINA</button>`
      : `<button type="button" class="btn btn-yellow" data-season-new="${escapeHtml(season.id)}">INIZIA NUOVA RUN</button>`;

    if (!activeSaved) {
      return `<article class="home-hub-card season-select-card season-select-card--empty">${seasonCoverMarkup(season)}<div class="season-card-content"><div class="season-card-head"><div><p class="season-card-kicker">SEASON ${escapeHtml(season.displaySeasonNumber)}</p><h2>${escapeHtml(season.name)}</h2><p class="season-card-subtitle">Costruisci la squadra e affronta la scalata.</p></div></div><div class="home-card-actions season-card-actions">${actions}</div></div></article>`;
    }

    return `<article class="home-hub-card season-select-card season-select-card--active ${isLastPlayed ? "season-select-card--last" : ""}">${seasonCoverMarkup(season)}<div class="season-card-content"><div class="season-card-head"><div><p class="season-card-kicker">SEASON ${escapeHtml(season.displaySeasonNumber)}</p><h2>${escapeHtml(season.name)}</h2></div></div><div class="home-card-actions season-card-actions">${actions}</div></div></article>`;
  }

  async function renderSeasonSelect({ preserveScroll = null } = {}) {
    await loadSeason(global.SeasonRegistry.DEFAULT_SEASON_ID);
    const seasons = global.SeasonRegistry.list();
    await Promise.all(seasons.map((season) => global.SeasonRegistry.loadDatabase(season.id)));
    const runs = seasons.map((season) => ({ season, savedRun: global.RunState.load(season.id, { readOnly: true }) }));
    const latestTime = Math.max(0, ...runs.filter((entry) => entry.savedRun && global.RunState.isActiveRun(entry.savedRun)).map((entry) => runTimestamp(entry.savedRun)));
    const cards = runs.map(({ season, savedRun }) => seasonSelectCardMarkup({
      season,
      savedRun,
      database: global.SeasonRegistry.database(season.id),
      playersById: global.SeasonRegistry.playersIndex(season.id),
      isLastPlayed: Boolean(savedRun && latestTime && runTimestamp(savedRun) === latestTime),
    })).join("");
    app.innerHTML = `<main class="home-screen modern-home season-select-screen"><header class="season-select-topbar">${sectionRootButton("seasonSelection", "season-select-home-button")}<div><p class="eyebrow">MODALITÀ</p><h1>SELEZIONA SEASON</h1><p class="season-select-subtitle">Scegli la tua storia e riprendi la scalata.</p></div><span class="season-select-topbar-spacer" aria-hidden="true"></span></header><section class="home-choice-grid season-choice-grid">${cards}</section></main>`;
    if (preserveScroll) afterNextPaint(() => restorePageScroll(preserveScroll));
    else resetRenderedViewScroll();
    bindSectionRootNav();
    document.querySelectorAll("[data-season-continue]").forEach((button) => button.addEventListener("click", async () => { await selectSeason(button.dataset.seasonContinue, { markPlayed: true }); resumeRun(); }));
    document.querySelectorAll("[data-season-new]").forEach((button) => button.addEventListener("click", async () => { await selectSeason(button.dataset.seasonNew); startNewRunFromHome(); }));
    document.querySelectorAll("[data-season-delete]").forEach((button) => button.addEventListener("click", () => openDeleteSeasonRunModal(button.dataset.seasonDelete)));
  }

  function openDeleteSeasonRunModal(seasonId) {
    const season = global.SeasonRegistry.get(seasonId);
    const observedGeneration = global.RunState.load(season.id, { readOnly: true })?.storageGeneration;
    const preservedScroll = scrollSnapshot();
    openModal(`<div class="modal-head"><div><p class="eyebrow">${escapeHtml(season.name)}</p><h2>ELIMINA RUN</h2><p class="muted">Vuoi eliminare la run di questa Season? I progressi della run verranno cancellati.</p></div></div><div class="button-row"><button type="button" class="btn btn-ghost" data-cancel-delete-run>ANNULLA</button><button type="button" class="btn season-delete-button" data-confirm-delete-run>ELIMINA</button></div>`, { closeable: false, className: "season-delete-modal", preserveScroll: preservedScroll });
    modalRoot.querySelector("[data-cancel-delete-run]")?.addEventListener("click", closeModal);
    modalRoot.querySelector("[data-confirm-delete-run]")?.addEventListener("click", async () => {
      try { global.RunState.remove(season.id, { expectedGeneration: observedGeneration }); }
      catch (error) { closeModal({ invokeOnClose: false }); if (error?.code === "stale-write") { run = global.RunState.load(season.id, { readOnly: true }); global.run = run; global.alert?.("La run è stata aggiornata in un'altra scheda. Ho ricaricato l'ultima versione salvata."); return renderSeasonSelect({ preserveScroll: preservedScroll }); } global.alert?.("Salvataggio non riuscito. L'azione non è stata registrata."); return; }
      if (run?.seasonId === season.id) { run = null; global.run = null; }
      closeModal({ invokeOnClose: false });
      await renderSeasonSelect({ preserveScroll: preservedScroll });
    });
  }

  function eligibleFreeAgentIds() {
    return new Set((freeAgentsDb?.players || []).map((player) => String(player.playerId)));
  }

  function isDevelopmentFreeAgentEligible(playerId) {
    return eligibleFreeAgentIds().has(String(playerId));
  }

  function developmentPlayers() {
    ensureAlbumBackfill();
    const collections = Object.keys(global.AlbumProgress.ALBUM_COLLECTIONS);
    const progress = global.AlbumProgress.read();
    const unlockedByCollection = new Map(collections.map((collectionId) => [collectionId, global.AlbumProgress.unlockedSet(collectionId, progress)]));
    const developmentState = global.DevelopmentAccountV3.read();
    const freeAgentIds = eligibleFreeAgentIds();
    const seen = new Set();
    return (freeAgentsDb?.players || []).flatMap((player) => {
      const id = String(player.playerId);
      if (!freeAgentIds.has(id) || seen.has(id)) return [];
      const developmentCollections = collections.filter((collectionId) => unlockedByCollection.get(collectionId).has(id));
      if (developmentCollections.length) seen.add(id);
      const chain = developmentState.players?.[id];
      const active = chain?.steps?.at(-1) || chain?.legacyNormale;
      const basePotential = Number(player.basePotential ?? player.finalOverall ?? 0);
      const currentPotential = Math.max(basePotential, Number(active?.toPotential || 0));
      return developmentCollections.length
        ? [{ ...player, rawPlayer: player, developmentState, developmentVersion: String(active?.stepId || active?.migrationId || "base"), basePotential, currentPotential, category: active?.profile?.category || global.InazumaProgression.categoryForPotential(currentPotential), developmentCollections }]
        : [];
    });
  }

  const DEVELOPMENT_PAGE_SIZE = 60;
  let developmentPlayersCache = null;
  const developmentResolvedCache = new Map();
  let developmentVisibleCount = DEVELOPMENT_PAGE_SIZE;

  function cachedDevelopmentPlayers({ refresh = false } = {}) {
    if (refresh || !developmentPlayersCache) developmentPlayersCache = developmentPlayers();
    return developmentPlayersCache;
  }

  function filterDevelopmentPlayers(players, query = "", rarity = "Tutti") {
    const needle = String(query).trim().toLocaleLowerCase("it");
    return players.filter((player) => (!needle || player.name.toLocaleLowerCase("it").includes(needle)) && (rarity === "Tutti" || player.category === rarity));
  }

  function resolveDevelopmentPlayer(indexedPlayer) {
    if (!indexedPlayer) return null;
    const id = String(indexedPlayer.playerId);
    const version = indexedPlayer.developmentVersion;
    const cached = developmentResolvedCache.get(id);
    if (cached?.version === version) return cached.player;
    const player = { ...albumPlayerView(indexedPlayer.rawPlayer || indexedPlayer, freeAgentsDb, indexedPlayer.developmentState), developmentCollections: indexedPlayer.developmentCollections };
    developmentResolvedCache.set(id, { version, player });
    return player;
  }

  function developmentSquadCardMarkup(player, dataAttr = "") {
    return compactPlayerCardMarkup(player, {
      level: player.displayLevel ?? player.maxLevel ?? 20,
      overall: player.overall,
      dataAttr,
      extraClass: "squad-player-card development-squad-card",
    });
  }

  function developmentPlayerGridMarkup(players, visibleCount = developmentVisibleCount) {
    const visible = players.slice(0, visibleCount).map(resolveDevelopmentPlayer);
    const cards = visible.map((player) => `<div data-development-player="${escapeHtml(player.playerId)}">${developmentSquadCardMarkup(player, `data-development-card="${escapeHtml(player.playerId)}"`)}${player.category === "Leggenda" ? '<span class="development-max" aria-label="Rarità massima">MAX</span>' : ""}</div>`).join("");
    if (!cards) return '<p class="empty-state">Nessuno svincolato sbloccato corrisponde ai filtri.</p>';
    const remaining = players.length - visible.length;
    return `${cards}${remaining > 0 ? `<div class="development-load-more-wrap"><button class="btn btn-yellow development-load-more" id="development-load-more"><span>MOSTRA ALTRI <b>${escapeHtml(Math.min(DEVELOPMENT_PAGE_SIZE, remaining))}</b></span><small>${escapeHtml(visible.length)} di ${escapeHtml(players.length)}</small></button></div>` : ""}`;
  }

  const DEVELOPMENT_RESOURCE_ITEMS = Object.freeze({
    coins: Object.freeze({ id: "development-coins", name: "Dragon Sticker", imageUrl: global.DevelopmentV2.DEVELOPMENT_RESOURCE_ASSETS.coins }),
    cups: Object.freeze({ id: "development-cups", name: "Coppa", imageUrl: global.DevelopmentV2.DEVELOPMENT_RESOURCE_ASSETS.cups }),
  });

  function developmentCurrencyIcon(type, rarity = "") {
    if (type === "project") return `<span class="development-resource-icon project-image-frame"><img src="${escapeHtml(global.DevelopmentV2.ASSETS[rarity])}" alt="" loading="lazy" decoding="async"></span>`;
    const resource = DEVELOPMENT_RESOURCE_ITEMS[type];
    if (!resource?.imageUrl) return "";
    return `<span class="item-icon item-icon--image development-resource-icon" aria-label="${escapeHtml(resource.name)}"><img src="${escapeHtml(resource.imageUrl)}" alt="${escapeHtml(resource.name)}" loading="eager" decoding="async" onerror="globalThis.handleItemImageError && globalThis.handleItemImageError(this)">${itemImageFallbackSvg()}</span>`;
  }

  function resourceCostMarkup({ type, rarity = "", label, current = null, required, satisfied = true, compact = false }) {
    const values = current == null ? `×${escapeHtml(required)}` : `${escapeHtml(current)} / ${escapeHtml(required)}`;
    const tag = compact ? "span" : "article";
    return `<${tag} class="development-requirement ${satisfied ? "is-ready" : "is-missing"}">${developmentCurrencyIcon(type, rarity)}<span><small>${escapeHtml(label)}</small><strong>${values}</strong></span>${compact ? "" : `<b aria-label="${satisfied ? "Requisito soddisfatto" : "Requisito mancante"}">${satisfied ? "✓" : "!"}</b>`}</${tag}>`;
  }

  function projectInventoryMarkup(state) { return global.DevelopmentV2.PROJECT_RARITIES.map((rarity) => `<article class="project-inventory-item ${rarityClass(rarity)}"><span class="project-inventory-image"><img src="${escapeHtml(global.DevelopmentV2.ASSETS[rarity])}" alt="" loading="lazy"></span><strong>${escapeHtml(rarity)}</strong><b>×${escapeHtml(state.projects[rarity] || 0)}</b></article>`).join(""); }

  function developmentRewardPresentation(defeatedBosses, endReason) {
    const bosses = Math.max(0, Number(defeatedBosses) || 0);
    return {
      endReason,
      coins: bosses * 20 + (endReason === "victory" ? 100 : 0),
      cups: endReason === "victory" ? 1 : 0,
      seen: false,
    };
  }

  function renderDevelopmentRewardReveal(presentation, onContinue) {
    const won = presentation.endReason === "victory";
    app.innerHTML = `<main class="development-reward-screen" data-development-reward-reveal><section class="development-reward-panel">
      <header><h1>RICOMPENSE RUN</h1><p>${won ? "RUN COMPLETATA" : "RUN TERMINATA"}</p></header>
      <div class="development-reward-list">
        <article class="development-reward-item">${developmentCurrencyIcon("coins")}<span><small>MONETE</small><strong data-reward-count="${escapeHtml(presentation.coins)}">+0</strong></span></article>
        ${won ? `<article class="development-reward-item development-reward-cup">${developmentCurrencyIcon("cups")}<span><small>COPPA SEASON</small><strong>+${escapeHtml(presentation.cups)}</strong></span></article>` : ""}
      </div>
      <button type="button" class="btn btn-yellow development-reward-continue" id="development-reward-continue">CONTINUA</button>
      <p class="development-reward-skip">Tocca per saltare l’animazione</p>
    </section></main>`;
    resetRenderedViewScroll();
    const counter = document.querySelector("[data-reward-count]");
    const target = Number(presentation.coins) || 0;
    const startedAt = performance.now();
    let finished = false;
    const finishAnimation = () => {
      if (finished) return;
      finished = true;
      if (counter) counter.textContent = `+${target}`;
      document.querySelector(".development-reward-panel")?.classList.add("is-complete");
    };
    const tick = (now) => {
      if (finished) return;
      const progress = Math.min(1, (now - startedAt) / 900);
      if (counter) counter.textContent = `+${Math.round(target * progress)}`;
      if (progress < 1) requestAnimationFrame(tick); else finishAnimation();
    };
    requestAnimationFrame(tick);
    document.querySelector("[data-development-reward-reveal]")?.addEventListener("click", finishAnimation);
    document.getElementById("development-reward-continue")?.addEventListener("click", (event) => { event.stopPropagation(); finishAnimation(); onContinue(); });
  }

  function resolveDevelopmentEndRunFlow({ endReason, onComplete }) {
    const defeatedBosses = Number(run.completedBossIds?.length || run.bossIndex || 0);
    const effectId = global.PermanentEffects.developmentId(run, endReason);
    const existingEffect = run.permanentEffectOutbox?.find((entry) => entry.id === effectId);
    const prepared = existingEffect ? { ok: true } : persistGameplayMutation({
      label: "terminal-development-effect",
      mutate: (current) => {
        global.PermanentEffects.assertCanonicalTerminal(current, endReason);
        return global.PermanentEffects.enqueueDevelopment(current, { endReason, defeatedBosses });
      },
    });
    if (!prepared.ok) return renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete }));
    const drained = drainPermanentEffects();
    const effect = run.permanentEffectOutbox.find((entry) => entry.id === effectId);
    if (drained.error || effect?.status !== "applied") return renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete }));
    if (!run.developmentRewardPresentation || run.developmentRewardPresentation.endReason !== endReason) {
      const presentation = persistGameplayMutation({
        label: "development-reward-presentation-create",
        mutate: (current) => {
          const currentEffect = current.permanentEffectOutbox?.find((entry) => entry.id === effectId);
          if (currentEffect?.status !== "applied") throw new Error("Development effect must be applied before reward presentation");
          if (!current.developmentRewardPresentation || current.developmentRewardPresentation.endReason !== endReason) {
            current.developmentRewardPresentation = developmentRewardPresentation(defeatedBosses, endReason);
          }
          return current.developmentRewardPresentation;
        },
      });
      if (!presentation.ok) return renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete }));
    }
    const continueFlow = () => {
      const committed = persistGameplayMutation({
        label: "development-reward-presentation-seen",
        mutate: (current) => {
          const currentPresentation = current.developmentRewardPresentation;
          if (!currentPresentation || currentPresentation.endReason !== endReason) throw new Error("Development reward presentation changed");
          currentPresentation.seen = true;
        },
        onCommitted: () => onComplete(),
        rerender: ({ ok }) => { if (!ok) renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete })); },
      });
      return committed;
    };
    if (!run.developmentRewardPresentation.seen) return renderDevelopmentRewardReveal(run.developmentRewardPresentation, continueFlow);
    return onComplete();
  }

  function renderTerminalEffectPending(retry) {
    app.innerHTML = `<main class="gameover-screen"><section class="gameover-card" aria-labelledby="terminal-pending-title">
      <div class="gameover-mark" aria-hidden="true">!</div><p class="eyebrow">RICOMPENSA IN ATTESA</p>
      <h1 id="terminal-pending-title">FINALIZZAZIONE NON SALVATA</h1>
      <p class="gameover-copy">La run è al sicuro, ma la ricompensa permanente non è ancora stata registrata. Riprova senza creare una nuova run.</p>
      <div class="gameover-actions"><button type="button" class="btn btn-yellow" id="retry-terminal-effect">RIPROVA</button></div>
    </section></main>`;
    resetRenderedViewScroll();
    document.getElementById("retry-terminal-effect")?.addEventListener("click", retry);
  }

  function developmentSelectedMarkup(player) {
    const state = global.DevelopmentAccountV3.read();
    const target = global.DevelopmentV2.nextRarity(player.category);
    const selectedCard = `<div class="development-selected-card">${developmentSquadCardMarkup(player, `data-development-selected-card="${escapeHtml(player.playerId)}" aria-label="Apri la scheda di ${escapeHtml(player.name)}"`)}</div>`;
    if (!target) return `<section class="development-selected development-squad-card-scope"><p class="eyebrow">GIOCATORE SELEZIONATO</p><div class="development-selected-layout">${selectedCard}<div class="development-selected-copy"><h2>${escapeHtml(player.name)}</h2><p class="development-max-copy">MAX · RARITÀ MASSIMA</p><button class="btn btn-ghost" id="change-development-player">CAMBIA GIOCATORE</button></div></div></section>`;
    const cost = global.DevelopmentV2.COSTS[target];
    const have = state.projects[target] || 0;
    const nextOverall = Math.max(Number(player.overall || 0), Number(global.DevelopmentV2.threshold(target)));
    const missing = [Math.max(0, cost.projects - have) ? `MANCA ${cost.projects - have} PROGETTO ${target.toUpperCase()}` : "", Math.max(0, cost.cups - global.DevelopmentV2.totalCups(state)) ? `MANCANO ${cost.cups - global.DevelopmentV2.totalCups(state)} COPPE` : "", Math.max(0, cost.coins - state.coins) ? `MANCANO ${cost.coins - state.coins} MONETE` : ""].filter(Boolean);
    return `<section class="development-selected development-squad-card-scope"><p class="eyebrow">GIOCATORE SELEZIONATO</p><div class="development-selected-layout">${selectedCard}<div class="development-selected-copy"><h2>${escapeHtml(player.name)}</h2><strong class="development-rarity-step">${escapeHtml(player.category)} <span>→</span> ${escapeHtml(target)}</strong><p class="development-potential">Overall / potenziale <b>${escapeHtml(player.overall)} / ${escapeHtml(player.potential)}</b> → <b>${escapeHtml(nextOverall)} / ${escapeHtml(global.DevelopmentV2.threshold(target))}</b></p><h3>REQUISITI EVOLUZIONE</h3><div class="development-requirements">${resourceCostMarkup({ type: "project", rarity: target, label: `Progetto ${target}`, current: have, required: cost.projects, satisfied: have >= cost.projects })}${resourceCostMarkup({ type: "cups", label: "Coppe", current: global.DevelopmentV2.totalCups(state), required: cost.cups, satisfied: global.DevelopmentV2.totalCups(state) >= cost.cups })}${resourceCostMarkup({ type: "coins", label: "Monete", current: state.coins, required: cost.coins, satisfied: state.coins >= cost.coins })}</div>${missing.length ? `<p class="development-missing">${escapeHtml(missing.join(" · "))}</p>` : '<p class="development-ready-copy">Tutti i requisiti sono soddisfatti.</p>'}<div class="button-row"><button class="btn btn-ghost" id="change-development-player">CAMBIA GIOCATORE</button><button class="btn btn-yellow" id="prepare-evolution" ${missing.length ? "disabled" : ""}>EVOLVI A ${escapeHtml(target.toUpperCase())}</button></div></div></div></section>`;
  }

  function bindDevelopmentSelectedCardInteraction(card, selectedPlayer, openDetails) {
    if (!card) return;
    const playerId = card.dataset.developmentSelectedCard;
    card.addEventListener("click", () => openDetails(selectedPlayer, playerId));
  }

  function developmentManagementPathMarkup(path) {
    return path.map((entry, index) => `<span class="development-management-path-step ${rarityClass(entry.rarity)}"><small>${entry.kind === "base" ? "BASE " : ""}${escapeHtml(entry.rarity)}</small> <strong>${escapeHtml(entry.potential)}</strong>${entry.kind === "legacyNormale" ? '<em>BASELINE</em>' : ""}</span>${index < path.length - 1 ? '<b class="development-management-arrow" aria-hidden="true">→</b>' : ""}`).join("");
  }

  function developmentManagementRowsMarkup(rows) {
    if (!rows.length) return '<p class="empty-state">Nessun giocatore evoluto corrisponde al filtro.</p>';
    return rows.map((row) => {
      if (row.missingIdentity) return `<article class="development-management-card is-missing" data-management-player="${escapeHtml(row.playerId)}"><div class="development-management-missing-icon" aria-hidden="true">!</div><div class="development-management-copy"><p class="eyebrow">IDENTITÀ NON DISPONIBILE</p><h3>${escapeHtml(row.name)}</h3><p>La catena canonica è stata conservata. ID: <code>${escapeHtml(row.playerId)}</code></p><strong>${escapeHtml(row.activeRarity)} · ${escapeHtml(row.activePotential)}</strong></div><div class="development-management-actions"><button type="button" class="btn btn-ghost" disabled>APRI SCHEDA</button></div></article>`;
      const portrait = playerPortraitUrl(row.base), fallbacks = imageFallbackAttributes(resolvePlayerVisual(row.base).cardFallbacks);
      return `<article class="development-management-card ${rarityClass(row.activeRarity)}" data-management-player="${escapeHtml(row.playerId)}"><span class="development-management-portrait"><img src="${escapeHtml(portrait)}" alt="" loading="lazy" ${fallbacks}></span><div class="development-management-copy"><div class="development-management-title"><div><h3>${escapeHtml(row.name)}</h3><span>${escapeHtml(row.role)}</span></div><strong>${escapeHtml(row.activeRarity)} · ${escapeHtml(row.activePotential)}</strong></div><p class="development-management-origin"><small>ORIGINE</small> BASE · ${escapeHtml(row.base.category)} ${escapeHtml(row.base.finalOverall)}</p><div class="development-management-path" aria-label="Percorso evolutivo di ${escapeHtml(row.name)}"><small>PERCORSO</small><div>${developmentManagementPathMarkup(row.path)}</div></div></div><div class="development-management-actions"><button type="button" class="btn btn-yellow development-management-open" data-open-management-player="${escapeHtml(row.playerId)}" ${row.detailPlayer ? "" : "disabled"}>APRI SCHEDA</button><button type="button" class="btn btn-ghost development-management-regress" data-regress-management-player="${escapeHtml(row.playerId)}">REGREDISCI</button></div></article>`;
    }).join("");
  }

  function regressionCupLabel(sourceId) {
    const labels = { ie1: "IE1", ie1_s2: "IE2", ie1_s3: "IE3", ie2: "ARES", orion: "ORION" };
    return labels[sourceId] || String(sourceId).replace(/_/g, " ").toUpperCase();
  }

  function openDevelopmentRegression(row) {
    const preview = row.regression;
    const destinationFlag = preview.to.isBase ? "<em>BASE ORIGINALE</em>" : preview.to.isBaseline ? "<em>BASELINE</em>" : "";
    const cupSources = Object.entries(preview.refund.cupsBySource).map(([sourceId, amount]) => `<li><span>${escapeHtml(regressionCupLabel(sourceId))}</span><strong>+${escapeHtml(amount)}</strong></li>`).join("");
    openModal(`<section class="development-regression"><header class="development-regression-head"><p class="eyebrow">REGRESSIONE EVOLUZIONE</p><h1>${escapeHtml(row.name)}</h1></header><div class="development-regression-transition"><article class="development-regression-state ${rarityClass(preview.from.rarity)}"><small>PRIMA</small><strong>${escapeHtml(preview.from.rarity)}</strong><span>OVR ${escapeHtml(preview.from.potential)}</span></article><b aria-hidden="true">→</b><article class="development-regression-state ${rarityClass(preview.to.rarity)}"><small>DOPO</small>${preview.to.isBase ? "<strong>BASE</strong>" : ""}<strong>${escapeHtml(preview.to.rarity)}</strong><span>OVR ${escapeHtml(preview.to.potential)}</span>${destinationFlag}</article></div><section class="development-regression-refund"><h2>RIMBORSO</h2><div class="development-regression-resources"><article>${developmentCurrencyIcon("coins")}<span><small>MONETE</small><strong>+${escapeHtml(preview.refund.coins)}</strong></span></article><article>${developmentCurrencyIcon("cups")}<span><small>COPPE</small><strong>+${escapeHtml(preview.refund.cups)}</strong></span></article><article class="is-project"><span class="development-regression-project-mark" aria-hidden="true">!</span><span><small>PROGETTI</small><strong>NON RIMBORSATI</strong></span></article></div>${cupSources ? `<ul class="development-regression-cup-sources">${cupSources}</ul>` : ""}</section><div class="node-actions development-regression-actions"><button type="button" class="btn btn-ghost" data-cancel-regression>ANNULLA</button><button type="button" class="btn btn-yellow" data-confirm-regression>CONFERMA REGRESSIONE</button></div></section>`, { closeable: true, className: "development-regression-modal" });
    modalRoot.querySelector("[data-cancel-regression]")?.addEventListener("click", () => closeModal());
    const confirm = modalRoot.querySelector("[data-confirm-regression]");
    confirm?.addEventListener("click", () => {
      if (confirm.disabled) return;
      confirm.disabled = true;
      const result = global.DevelopmentAccountV3.regress({ playerId: row.playerId, expectedActiveId: preview.activeId }, { database: freeAgentsDb });
      if (!result.ok) { closeModal({ invokeOnClose: false }); toast(result.reason === "stale-regression" ? "Evoluzione già cambiata: aggiornata la lista" : "Regressione non salvata", "error"); return renderDevelopmentCenter("management"); }
      developmentPlayersCache = null;
      developmentResolvedCache.delete(String(row.playerId));
      closeModal({ invokeOnClose: false }); toast(`${row.name}: ${result.to.rarity} ${result.to.potential}`); renderDevelopmentCenter("management");
    });
  }

  function developmentManagementMarkup(model) {
    const rarityOptions = global.DevelopmentManagementV3.FILTER_RARITIES.map((rarity) => `<option value="${escapeHtml(rarity)}" ${ui.developmentManagementRarity === rarity ? "selected" : ""}>${rarity === "Tutti" ? "Tutte" : escapeHtml(rarity)}</option>`).join("");
    const rows = global.DevelopmentManagementV3.filterRows(model.rows, ui.developmentManagementRarity);
    return `<section class="development-management"><div class="development-section-heading"><div><p class="eyebrow">STATO PERMANENTE CORRENTE</p><h2>GESTIONE EVOLUZIONI</h2></div></div><div class="development-slot-grid" aria-label="Capacità slot evoluzione">${model.slots.map((slot) => `<article class="development-slot-card ${rarityClass(slot.rarity)} ${slot.overCapacity ? "is-over-capacity" : ""}" aria-label="${escapeHtml(slot.rarity)}: ${escapeHtml(slot.used)} slot usati su ${escapeHtml(slot.capacity)}${slot.overCapacity ? ", capacità superata" : ""}"><span>${escapeHtml(slot.rarity.toUpperCase())}</span><strong>${escapeHtml(slot.display)}</strong>${slot.overCapacity ? "<em>CAPACITÀ SUPERATA</em>" : ""}</article>`).join("")}</div><div class="development-filters development-management-filter"><label class="development-rarity-field"><span>RARITÀ</span><select id="development-management-rarity" aria-label="Filtra evoluzioni per rarità attiva">${rarityOptions}</select></label></div><div class="development-management-list" id="development-management-results">${developmentManagementRowsMarkup(rows)}</div></section>`;
  }

  function renderDevelopmentCenter(tab = "players") {
    if (!global.RestoreGameplayRoutingGate?.enter("development")) return false;
    if (tab === "history") tab = "management";
    const v3State = global.DevelopmentAccountV3.read();
    const state = v3State;
    // Management deliberately skips the Album-backed 2,800+ player projection:
    // canonical chains include evolved players even when they are not unlocked.
    const players = tab === "management" ? [] : cachedDevelopmentPlayers();
    const selectedIndex = players.find((player) => String(player.playerId) === String(ui.selectedDevelopmentPlayerId));
    const selected = resolveDevelopmentPlayer(selectedIndex);
    if (ui.selectedDevelopmentPlayerId && !selected) ui.selectedDevelopmentPlayerId = null;
    let filtered = filterDevelopmentPlayers(players, ui.developmentQuery, ui.developmentRarity);
    const rarityOptions = ["Tutti", ...global.DevelopmentV2.RARITIES].map((value) => `<option value="${escapeHtml(value)}" ${value === ui.developmentRarity ? "selected" : ""}>${value === "Tutti" ? "Tutte" : escapeHtml(value)}</option>`).join("");
    const playerBody = selected ? developmentSelectedMarkup(selected) : `<div class="development-filters"><label class="development-search-field"><span aria-hidden="true">⌕</span><input class="development-search" id="development-search" value="${escapeHtml(ui.developmentQuery)}" placeholder="Cerca giocatore…" aria-label="Cerca giocatore per nome" autocomplete="off"></label><label class="development-rarity-field"><span>RARITÀ</span><select id="development-rarity">${rarityOptions}</select></label></div><section class="album-player-grid development-player-grid development-squad-card-scope" id="development-player-results">${developmentPlayerGridMarkup(filtered)}</section>`;
    const managementModel = tab === "management" ? global.DevelopmentManagementV3.buildModel({ state: v3State, database: freeAgentsDb, account: global.DevelopmentAccountV3, V3: global.DevelopmentV3 }) : null;
    const body = tab === "projects" ? `<section class="development-projects"><div class="development-section-heading"><div><p class="eyebrow">INVENTARIO</p><h2>PROGETTI COMPLETI</h2></div><p>Disponibili per le evoluzioni.</p></div><div class="project-inventory-grid">${projectInventoryMarkup(state)}</div><button class="btn btn-yellow" id="development-open-shop">APRI NEGOZIO</button></section>` : tab === "management" ? developmentManagementMarkup(managementModel) : playerBody;
    const projectTotal = Object.values(state.projects).reduce((sum, value) => sum + Number(value || 0), 0);
    const existing = document.querySelector(".development-screen");
    if (!existing) app.innerHTML = `<main class="development-screen"><header class="topbar">${sectionRootButton("development", "development-back-button")}<div><p class="eyebrow">CRESCITA PERMANENTE</p><h1>CENTRO DI SVILUPPO</h1></div></header><section class="development-wallet"><span>${developmentCurrencyIcon("coins")}<span>MONETE <strong data-wallet="coins">${state.coins}</strong></span></span><span>${developmentCurrencyIcon("cups")}<span>COPPE <strong data-wallet="cups">${global.DevelopmentV2.totalCups(state)}</strong></span></span><span><span>PROGETTI <strong data-wallet="projects">${projectTotal}</strong></span></span></section><nav class="development-tabs">${[["players","GIOCATORI"],["projects","PROGETTI"],["management","EVOLUZIONI"]].map(([id,label]) => `<button class="${tab === id ? "active" : ""}" data-development-tab="${id}">${label}</button>`).join("")}</nav><div id="development-tab-content"></div><div id="development-dev-root"></div></main>`;
    document.getElementById("development-tab-content").innerHTML = body;
    document.querySelectorAll("[data-development-tab]").forEach((button) => { button.classList.toggle("active", button.dataset.developmentTab === tab); button.onclick = () => renderDevelopmentCenter(button.dataset.developmentTab); });
    document.querySelector('[data-wallet="coins"]').textContent = state.coins; document.querySelector('[data-wallet="cups"]').textContent = global.DevelopmentV2.totalCups(state); document.querySelector('[data-wallet="projects"]').textContent = projectTotal;
    const devRoot = document.getElementById("development-dev-root"); if (devRoot) devRoot.innerHTML = new URLSearchParams(location.search).get("dev") === "1" ? developmentDevMarkup(players.length) : "";
    document.getElementById("development-open-shop")?.addEventListener("click", () => renderShop());
    document.querySelector(".development-back-button").onclick = () => { ui.selectedDevelopmentPlayerId = null; developmentPlayersCache = null; renderHome(); };
    const search = document.getElementById("development-search"), results = document.getElementById("development-player-results");
    const bindLoadMore = () => document.getElementById("development-load-more")?.addEventListener("click", () => { developmentVisibleCount += DEVELOPMENT_PAGE_SIZE; filtered = filterDevelopmentPlayers(players, ui.developmentQuery, ui.developmentRarity); results.innerHTML = developmentPlayerGridMarkup(filtered); bindLoadMore(); });
    const updateResults = () => { ui.developmentQuery = search?.value || ""; developmentVisibleCount = DEVELOPMENT_PAGE_SIZE; filtered = filterDevelopmentPlayers(players, ui.developmentQuery, ui.developmentRarity); if (results) { results.innerHTML = developmentPlayerGridMarkup(filtered); bindLoadMore(); } };
    search?.addEventListener("input", updateResults);
    document.getElementById("development-rarity")?.addEventListener("change", (event) => { ui.developmentRarity = event.currentTarget.value; updateResults(); });
    document.getElementById("development-management-rarity")?.addEventListener("change", (event) => { ui.developmentManagementRarity = event.currentTarget.value; renderDevelopmentCenter("management"); });
    document.getElementById("development-management-results")?.addEventListener("click", (event) => {
      if (!managementModel) return;
      const regressButton = event.target.closest("[data-regress-management-player]");
      if (regressButton) { const regressionRow = managementModel.rows.find((candidate) => candidate.playerId === regressButton.dataset.regressManagementPlayer); if (regressionRow?.regression) openDevelopmentRegression(regressionRow); return; }
      const button = event.target.closest("[data-open-management-player]"); if (!button) return;
      const row = managementModel.rows.find((candidate) => candidate.playerId === button.dataset.openManagementPlayer);
      if (!row?.detailPlayer) return toast("Scheda giocatore non disponibile");
      showPlayerDetailsFor(row.detailPlayer, { playerId: row.playerId, level: row.detailPlayer.displayLevel, database: freeAgentsDb, equipment: null, readOnly: true, preserveScroll: scrollSnapshot() });
    });
    results?.addEventListener("click", (event) => { const element = event.target.closest("[data-development-player]"); if (element) { ui.selectedDevelopmentPlayerId = element.dataset.developmentPlayer; renderDevelopmentCenter("players"); } });
    bindLoadMore();
    document.getElementById("change-development-player")?.addEventListener("click", () => { ui.selectedDevelopmentPlayerId = null; closeModal(); renderDevelopmentCenter("players"); });
    bindDevelopmentSelectedCardInteraction(document.querySelector("[data-development-selected-card]"), selected, (selectedPlayer, playerId) => {
      const current = selectedPlayer || resolveDevelopmentPlayer(cachedDevelopmentPlayers().find((candidate) => String(candidate.playerId) === String(playerId)));
      if (!current) return toast("Giocatore non disponibile");
      showPlayerDetailsFor(current, { playerId: current.playerId, level: current.displayLevel, database: freeAgentsDb, equipment: null, readOnly: true, preserveScroll: scrollSnapshot() });
    });
    document.getElementById("prepare-evolution")?.addEventListener("click", () => { const target = global.DevelopmentV2.nextRarity(selected.category); renderEvolutionConfirmation(selected, target, global.DevelopmentV2.COSTS[target]); });
    bindDevelopmentDev();
  }

  function isDevelopmentPlayerUnlocked(player) {
    return (player.developmentCollections || Object.keys(global.AlbumProgress.ALBUM_COLLECTIONS)).some((collectionId) => global.AlbumProgress.isAlbumPlayerUnlocked(collectionId, player.playerId));
  }

  function renderEvolutionConfirmation(player, target, cost) {
    const rawPlayer = (freeAgentsDb?.players || []).find((candidate) => String(candidate.playerId) === String(player.playerId));
    if (!rawPlayer) return toast("Giocatore non trovato nel database svincolati");
    const basePotential = Number(rawPlayer.basePotential ?? rawPlayer.finalOverall ?? 0);
    const targetPotential = Math.max(Number(player.potential || 0), Number(global.DevelopmentV2.threshold(target)));
    const preview = global.InazumaProgression.getPlayerAtLevel(rawPlayer, Number(rawPlayer.maxLevel || 20), freeAgentsDb, global.DevelopmentV2.optionsFromUpgrade(rawPlayer, { permanentTargetPotential: targetPotential }));
    const after = { ...rawPlayer, basePotential, ...preview, overall: preview.overall, finalOverall: preview.overall, displayLevel: Number(rawPlayer.maxLevel || 20), albumDatabase: freeAgentsDb };
    const statChanges = Object.entries(STAT_LABELS).flatMap(([stat, label]) => { const before = Number(player.stats?.[stat] || 0), next = Number(after.stats?.[stat] || 0), delta = next - before; return delta > 0 ? [{ label, before, next, delta }] : []; });
    const statsMarkup = statChanges.map(({ label, before, next, delta }) => `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(before)} <b aria-hidden="true">→</b> ${escapeHtml(next)}</span><em>+${escapeHtml(delta)}</em></li>`).join("");
    const wallet=global.DevelopmentAccountV3.read(), cupLabels={ie1:"IE1",ie1_s2:"IE2",ie1_s3:"IE3",ie2:"ARES",orion:"ORION"}, cupSelection=global.DevelopmentV2.defaultCupSelection(wallet,cost.cups);
    const cupRows=global.DevelopmentV2.SEASON_IDS.filter((id)=>Number(wallet.cupsBySeason[id]||0)>0).map((id)=>`<div class="development-cup-row"><img src="${escapeHtml(global.DevelopmentV2.DEVELOPMENT_RESOURCE_ASSETS.cupsBySeason[id])}" alt=""><strong>${escapeHtml(cupLabels[id]||id)}</strong><button type="button" data-cup-minus="${escapeHtml(id)}" aria-label="Rimuovi Coppa ${escapeHtml(cupLabels[id]||id)}">−</button><b data-cup-count="${escapeHtml(id)}">${escapeHtml(cupSelection[id]||0)}</b><button type="button" data-cup-plus="${escapeHtml(id)}" aria-label="Aggiungi Coppa ${escapeHtml(cupLabels[id]||id)}">+</button></div>`).join("");
    openModal(`<div class="development-detail development-confirm"><p class="eyebrow">CONFERMA EVOLUZIONE</p><h2>${escapeHtml(player.name)}</h2><div class="development-evolution-preview development-squad-card-scope"><div><small>ATTUALE · ${escapeHtml(player.category)} · OVR ${escapeHtml(player.overall)}</small>${developmentSquadCardMarkup(player)}</div><span class="development-evolution-arrow" aria-hidden="true">→</span><div><small>NUOVA · ${escapeHtml(after.category)} · OVR ${escapeHtml(after.overall)}</small>${developmentSquadCardMarkup(after)}</div></div><section class="development-stat-increases"><h3>AUMENTO STATISTICHE</h3><ul>${statsMarkup || "<li><span>Nessuna statistica cambia.</span></li>"}</ul></section><h3 class="development-confirm-requirements-title">REQUISITI</h3><div class="development-confirm-costs">${resourceCostMarkup({ type: "project", rarity: target, label: `Progetto ${target}`, required: cost.projects, compact: true })}<section class="development-cup-selector"><h4>COPPE RICHIESTE: ${escapeHtml(cost.cups)}</h4>${cupRows}<p data-cup-total></p></section>${resourceCostMarkup({ type: "coins", label: "Monete", required: cost.coins, compact: true })}</div><div class="button-row"><button class="btn btn-ghost" id="back-evolution">ANNULLA</button><button class="btn btn-yellow" id="confirm-evolution">CONFERMA EVOLUZIONE</button></div></div>`, { closeable: false, className: "development-confirm-modal" });
    document.getElementById("back-evolution").onclick = closeModal;
    const confirmButton=document.getElementById("confirm-evolution");
    const refreshCupSelection=()=>{const selected=Object.values(cupSelection).reduce((sum,n)=>sum+Number(n||0),0),complete=selected===cost.cups; document.querySelector("[data-cup-total]").textContent=`COPPE SELEZIONATE ${selected} / ${cost.cups}`;document.querySelector("[data-cup-total]").classList.toggle("complete",complete);document.querySelectorAll("[data-cup-plus]").forEach((button)=>button.disabled=selected>=cost.cups||cupSelection[button.dataset.cupPlus]>=Number(wallet.cupsBySeason[button.dataset.cupPlus]||0));document.querySelectorAll("[data-cup-minus]").forEach((button)=>button.disabled=!cupSelection[button.dataset.cupMinus]);confirmButton.disabled=!complete;};
    document.querySelectorAll("[data-cup-plus]").forEach((button)=>button.onclick=()=>{const id=button.dataset.cupPlus,total=Object.values(cupSelection).reduce((sum,n)=>sum+Number(n||0),0);if(total<cost.cups&&cupSelection[id]<wallet.cupsBySeason[id]){cupSelection[id]+=1;document.querySelector(`[data-cup-count="${id}"]`).textContent=cupSelection[id];refreshCupSelection();}});
    document.querySelectorAll("[data-cup-minus]").forEach((button)=>button.onclick=()=>{const id=button.dataset.cupMinus;if(cupSelection[id]>0){cupSelection[id]-=1;document.querySelector(`[data-cup-count="${id}"]`).textContent=cupSelection[id];refreshCupSelection();}}); refreshCupSelection();
    let submitting = false;
    confirmButton.onclick = (event) => {
      if (submitting) return; submitting = true; event.currentTarget.disabled = true;
      const result = global.DevelopmentAccountV3.evolve({ playerId: rawPlayer.playerId, basePlayer: rawPlayer, unlocked: isDevelopmentPlayerUnlocked(player), freeAgentEligible: isDevelopmentFreeAgentEligible(player.playerId), cupSelection }, { database: freeAgentsDb });
      if (!result.ok) { submitting = false; closeModal(); toast(result.reason === "not_free_agent" ? "Giocatore non eleggibile: non è svincolato" : result.reason === "rarity-capacity-full" ? `Slot ${result.rarity} esauriti (${result.used}/${result.capacity}).` : "Risorse cambiate: evoluzione non completata"); return renderDevelopmentCenter("players"); }
      const written = global.DevelopmentAccountV3.read().players[String(rawPlayer.playerId)];
      const activeWritten = written?.steps?.at(-1) || written?.legacyNormale;
      const writeIsCurrent = (activeWritten?.rarity || activeWritten?.profile?.category) === result.target && Number(activeWritten?.toPotential) >= Number(global.DevelopmentV2.threshold(result.target));
      if (!writeIsCurrent) { submitting = false; closeModal(); toast("Evoluzione non salvata: stato non coerente"); return renderDevelopmentCenter("players"); }
      developmentPlayersCache = null;
      developmentResolvedCache.delete(String(rawPlayer.playerId));
      const updated = albumPlayerView(rawPlayer, freeAgentsDb);
      closeModal({ invokeOnClose: false }); toast(`${updated.name}: ${updated.category}`);
      renderDevelopmentCenter("players");
      showPlayerDetailsFor(updated, { playerId: updated.playerId, level: updated.displayLevel, database: freeAgentsDb, equipment: null, readOnly: true, preserveScroll: scrollSnapshot() });
    };
  }

  async function renderShop(section = "general") {
    await Promise.all(global.SeasonRegistry.list().map((season) => global.SeasonRegistry.loadDatabase(season.id)));
    const state = global.DevelopmentAccountV3.read(), catalog = global.ShopCatalog.build();
    const tabs = [["general","GENERALE"],["ie1","IE1"],["ie1_s2","IE2"],["ie1_s3","IE3"],["ie2","ARES"],["orion","ORION"]];
    const cupLabels = { ie1: "IE1", ie1_s2: "IE2", ie1_s3: "IE3", ie2: "ARES", orion: "ORION" };
    const cupNames = { ie1: "Sun Pendant", ie1_s2: "Alius Crystal", ie1_s3: "Meteor Necklace", ie2: "Challenger's Necklace", orion: "Comet Pendant" };
    const cupAssets = global.DevelopmentV2.DEVELOPMENT_RESOURCE_ASSETS.cupsBySeason;
    const cupIcon = (id, className = "shop-cup-icon") => `<img class="${className}" src="${escapeHtml(cupAssets[id])}" alt="${escapeHtml(cupNames[id])}" title="${escapeHtml(cupNames[id])}" data-cup-season="${escapeHtml(id)}">`;
    const wallet = global.DevelopmentV2.SEASON_IDS.map((id) => `<span>${cupIcon(id)}<small>${cupLabels[id]}</small><b>${escapeHtml(state.cupsBySeason[id] || 0)}</b></span>`).join("");
    const emblemCard = (product) => { const owned = state.unlockedEmblems.includes(product.emblemId), emblem = global.TeamEmblems.resolveTeamById(product.teamId, product.seasonId); return `<article class="shop-product shop-emblem-card shop-tier--${product.rarity}">${global.TeamEmblems.teamEmblemMarkup(emblem, { escape: escapeHtml, className: "shop-emblem" })}<h3>${escapeHtml(product.name)}</h3><span class="shop-tier">${product.label}</span><strong class="shop-price"><span>${product.coins} MONETE</span>${product.cups ? `<span class="shop-price-extra">+ ${cupIcon(product.seasonId, "shop-price-cup")} <span aria-label="${product.cups} Coppe">×${product.cups}</span></span>` : ""}</strong><button class="btn ${owned ? "shop-owned" : "btn-yellow"}" data-buy-emblem="${escapeHtml(product.emblemId)}" ${owned ? "disabled" : ""}>${owned ? "POSSEDUTO" : "ACQUISTA"}</button></article>`; };
    const tierOrder = { base: 0, rare: 1, epic: 2, iconic: 3 };
    const sorted = catalog.filter((product) => product.shopSection === section).sort((a, b) => tierOrder[a.rarity] - tierOrder[b.rarity] || a.name.localeCompare(b.name, "it"));
    const products = section === "general" ? global.DevelopmentV2.PROJECT_RARITIES.map((rarity) => `<article class="shop-product shop-project shop-project--${rarity.toLowerCase()}"><img src="${escapeHtml(global.DevelopmentV2.ASSETS[rarity])}" alt=""><h3>PROGETTO ${escapeHtml(rarity.toUpperCase())}</h3><p>Posseduti <b>×${escapeHtml(state.projects[rarity] || 0)}</b></p><strong>${escapeHtml(global.DevelopmentV2.PROJECT_PRICES[rarity])} MONETE</strong><button class="btn btn-yellow" data-buy-project="${escapeHtml(rarity)}" ${state.coins < global.DevelopmentV2.PROJECT_PRICES[rarity] ? "disabled" : ""}>ACQUISTA</button></article>`).join("") : Object.keys(tierOrder).map((tier) => { const items = sorted.filter((product) => product.rarity === tier); return items.length ? `<section class="shop-tier-group shop-tier-group--${tier}"><h2><span>${items[0].label}</span></h2><div class="shop-grid">${items.map(emblemCard).join("")}</div></section>` : ""; }).join("");
    app.innerHTML = `<main class="shop-screen"><header class="shop-header"><button class="shop-back" aria-label="Torna alla Home">←</button><div><p class="eyebrow">RICOMPENSE PERMANENTI</p><h1>NEGOZIO</h1></div></header><section class="shop-wallet"><div class="shop-coins">${developmentCurrencyIcon("coins")}<span><small>MONETE</small><b>${state.coins}</b></span></div><div class="shop-cups">${wallet}${state.legacyCups ? `<span><small>LEGACY</small><b>${state.legacyCups}</b></span>` : ""}</div></section><nav class="shop-tabs" aria-label="Seleziona Season">${tabs.map(([id,label]) => `<button class="${id === section ? "active" : ""}" data-shop-tab="${id}" aria-current="${id === section ? "page" : "false"}">${label}</button>`).join("")}</nav>${section === "general" ? `<section class="shop-grid">${products}</section>` : `<div class="shop-catalog">${products}</div>`}${DEV_MODE ? shopDevMarkup() : ""}</main>`;
    document.querySelector(".shop-back").onclick = renderHome;
    document.querySelectorAll("[data-shop-tab]").forEach((button) => button.onclick = () => renderShop(button.dataset.shopTab));
    document.querySelectorAll("[data-buy-project]").forEach((button) => button.onclick = () => { const result = global.DevelopmentAccountV3.purchaseProject(button.dataset.buyProject); toast(result.ok ? "PROGETTO ACQUISTATO" : result.reason === "coins" ? "MONETE INSUFFICIENTI" : "ACQUISTO NON SALVATO"); renderShop(section); });
    document.querySelectorAll("[data-buy-emblem]").forEach((button) => button.onclick = () => { const product = catalog.find((item) => item.emblemId === button.dataset.buyEmblem), result = global.DevelopmentAccountV3.purchaseEmblem(product); toast(result.ok ? "STEMMA SBLOCCATO" : result.reason === "cups" ? "COPPE SEASON INSUFFICIENTI" : result.reason === "coins" ? "MONETE INSUFFICIENTI" : "STEMMA GIÀ POSSEDUTO"); renderShop(section); });
    if (DEV_MODE) bindShopDev(section, catalog);
  }

  function renderSettings(options = {}) {
    const selectingEmblem = options?.view === "emblems";
    const identity = savedTeamIdentity() || normalizeTeamIdentity({});
    const owned = new Set(global.DevelopmentAccountV3.read().unlockedEmblems || []);
    const catalog = global.ShopCatalog.build().filter((item) => owned.has(item.emblemId));
    const choices = [{ emblemId: "default-lightning", name: "Inazuma Lightning", seasonId: "default" }, ...catalog];
    const current = global.TeamEmblems.resolveTeamEmblem({ teamIdentity: identity, fallbackKind: "user" });
    const choiceMarkup = choices.map((item) => { const selected = item.emblemId === identity.emblemId; const emblem = global.TeamEmblems.resolveTeamEmblem({ teamIdentity: { emblemId: item.emblemId }, seasonId: item.seasonId, fallbackKind: "user" }); return `<button type="button" class="settings-emblem-choice ${selected ? "is-selected" : ""}" data-settings-emblem="${escapeHtml(item.emblemId)}">${global.TeamEmblems.teamEmblemMarkup(emblem, { escape: escapeHtml, className: "settings-choice-logo" })}<strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.seasonId.toUpperCase())}</small>${selected ? "<span>SELEZIONATO</span>" : ""}</button>`; }).join("");
    const smartAutoLineup = global.RunState.loadProfile().preferences.smartAutoLineup;
    app.innerHTML = `<main class="settings-screen"><header class="settings-header"><button class="settings-back" aria-label="${selectingEmblem ? "Torna alle Impostazioni" : "Torna alla Home"}">←</button><div><p class="eyebrow">PROFILO PERMANENTE</p><h1>${selectingEmblem ? "CAMBIA STEMMA" : "IMPOSTAZIONI"}</h1></div></header>${selectingEmblem ? `<section class="settings-panel settings-emblems-panel"><div class="settings-panel-title"><p class="eyebrow">STEMMI DISPONIBILI</p><strong>${choices.length} SBLOCCAT${choices.length === 1 ? "O" : "I"}</strong></div><div class="settings-emblem-grid">${choiceMarkup}</div>${choices.length === 1 ? '<div class="settings-empty-hint"><p>Acquista nuovi stemmi nel Negozio per renderli disponibili qui.</p><button class="btn settings-shop-link" id="settings-open-shop">VAI AL NEGOZIO</button></div>' : ""}</section>` : `<section class="settings-panel"><p class="eyebrow">PROFILO SQUADRA</p><div class="settings-name-row"><div><small>NOME SQUADRA</small><h2>${escapeHtml(savedTeamIdentity()?.name || "Non impostato")}</h2></div><button class="btn btn-yellow" id="settings-edit-name">MODIFICA</button></div><div class="settings-crest-row">${global.TeamEmblems.teamEmblemMarkup(current, { escape: escapeHtml, className: "settings-current-logo" })}<div><small>STEMMA SQUADRA</small><strong>${escapeHtml(choices.find((item) => item.emblemId === identity.emblemId)?.name || "Inazuma Lightning")}</strong></div><button class="btn btn-yellow" id="settings-change-emblem">CAMBIA STEMMA</button></div></section><section class="settings-panel settings-preferences-panel"><p class="eyebrow">PREFERENZE</p><label class="settings-toggle-row" for="settings-smart-lineup"><span><strong>AUTO-FORMAZIONE INTELLIGENTE</strong><small>Inserisce automaticamente i nuovi giocatori più forti nelle formazioni 11v11 e 5v5.</small></span><input type="checkbox" id="settings-smart-lineup" ${smartAutoLineup ? "checked" : ""} aria-describedby="settings-smart-lineup-description"><span class="settings-toggle" aria-hidden="true"></span></label><span id="settings-smart-lineup-description" class="sr-only">Preferenza persistente, disattivata per impostazione predefinita.</span></section>`}</main>`;
    document.querySelector(".settings-back").onclick = () => selectingEmblem ? renderSettings({ view: "main" }) : renderHome();
    document.getElementById("settings-edit-name")?.addEventListener("click", openEditTeamNameModal);
    document.getElementById("settings-change-emblem")?.addEventListener("click", () => renderSettings({ view: "emblems" }));
    document.getElementById("settings-open-shop")?.addEventListener("click", () => renderShop());
    document.getElementById("settings-smart-lineup")?.addEventListener("change", (event) => {
      global.RunState.saveProfilePreferences({ smartAutoLineup: event.currentTarget.checked });
      toast(event.currentTarget.checked ? "AUTO-FORMAZIONE ATTIVATA" : "AUTO-FORMAZIONE DISATTIVATA");
    });
    document.querySelectorAll("[data-settings-emblem]").forEach((button) => button.onclick = () => { const saved = savedTeamIdentity(); if (!saved) { toast("IMPOSTA PRIMA IL NOME SQUADRA"); return; } global.RunState.saveProfileTeamIdentity({ ...saved, emblemId: button.dataset.settingsEmblem }); toast("STEMMA SALVATO"); renderSettings({ view: "emblems" }); });
  }

  function shopDevMarkup() { const cupLabels = { ie1: "IE1", ie1_s2: "IE2", ie1_s3: "IE3", ie2: "ARES", orion: "ORION" }; return `<section class="shop-dev"><h2>NEGOZIO — HACK TEST</h2><button data-shop-prepare>PREPARA TEST NEGOZIO</button><div class="shop-dev-grid">${[1000,5000].map((n) => `<button data-shop-coins="${n}">+${n} MONETE</button>`).join("")}${global.DevelopmentV2.SEASON_IDS.flatMap((id) => [1,5].map((n) => `<button data-shop-cups="${id}" data-amount="${n}">+${n} COPPA ${cupLabels[id]}</button>`)).join("")}${global.DevelopmentV2.PROJECT_RARITIES.map((rarity) => `<button data-shop-project="${rarity}">+1 PROGETTO ${rarity.toUpperCase()}</button>`).join("")}</div><div class="shop-dev-danger"><button data-shop-unlock>SBLOCCA TUTTI GLI STEMMI</button><button data-shop-remove>RIMUOVI TUTTI GLI STEMMI ACQUISTATI</button><button data-shop-reset>RESET RISORSE SHOP</button></div></section>`; }
  function bindShopDev(section, catalog) { const mutate = (callback) => { global.DevelopmentAccountV3.mutate(callback); renderShop(section); }; document.querySelectorAll("[data-shop-coins]").forEach((button) => button.onclick = () => mutate((state) => { state.coins += Number(button.dataset.shopCoins); })); document.querySelectorAll("[data-shop-cups]").forEach((button) => button.onclick = () => mutate((state) => { const id = button.dataset.shopCups; state.cupsBySeason[id] += Number(button.dataset.amount); })); document.querySelectorAll("[data-shop-project]").forEach((button) => button.onclick = () => mutate((state) => { state.projects[button.dataset.shopProject] += 1; })); document.querySelector("[data-shop-prepare]")?.addEventListener("click", () => mutate((state) => { state.coins = Math.max(state.coins, 10000); global.DevelopmentV2.SEASON_IDS.forEach((id) => { state.cupsBySeason[id] = Math.max(state.cupsBySeason[id], 5); }); })); document.querySelector("[data-shop-unlock]")?.addEventListener("click", () => mutate((state) => { state.unlockedEmblems = [...new Set([...state.unlockedEmblems, ...catalog.map((item) => item.emblemId)])]; })); document.querySelector("[data-shop-remove]")?.addEventListener("click", () => mutate((state) => { state.unlockedEmblems = []; })); document.querySelector("[data-shop-reset]")?.addEventListener("click", () => mutate((state) => { state.coins = 0; global.DevelopmentV2.SEASON_IDS.forEach((id) => { state.cupsBySeason[id] = 0; }); state.unlockedEmblems = []; })); }

  function developmentDevMarkup(eligibleCount = developmentPlayers().length) { return `<section class="development-dev"><h2>SVILUPPO — HACK TEST</h2><p><strong>SVINCOLATI ELEGGIBILI: ${escapeHtml(eligibleCount)}</strong></p><div>${[100,500,1500].map(n=>`<button data-dev-coins="${n}">+${n} MONETE</button>`).join("")}${global.DevelopmentV2.SEASON_IDS.map(id=>`<button data-dev-season-cup="${id}">+1 COPPA ${id.toUpperCase()}</button>`).join("")}${global.DevelopmentV2.PROJECT_RARITIES.map(r=>`<button data-dev-complete-project="${r}">+1 PROGETTO ${r.toUpperCase()}</button>`).join("")}</div><button id="dev-unlock-free-agents">SBLOCCA TUTTI GLI SVINCOLATI</button><button id="dev-reset">RESET SVILUPPO TEST</button></section>`; }
  function bindDevelopmentDev() {
    document.querySelectorAll("[data-dev-coins]").forEach(b=>b.onclick=()=>{global.DevelopmentAccountV3.mutate(s=>{s.coins+=Number(b.dataset.devCoins);});renderDevelopmentCenter();});
    document.querySelectorAll("[data-dev-season-cup]").forEach(b=>b.onclick=()=>{const id=b.dataset.devSeasonCup;global.DevelopmentAccountV3.mutate(s=>{s.cupsBySeason[id]=(s.cupsBySeason[id]||0)+1;});renderDevelopmentCenter();});
    document.querySelectorAll("[data-dev-complete-project]").forEach(b=>b.onclick=()=>{global.DevelopmentAccountV3.addCompletedProject(b.dataset.devCompleteProject);renderDevelopmentCenter("projects");});
    document.getElementById("dev-unlock-free-agents")?.addEventListener("click",()=>{const ids=[...eligibleFreeAgentIds()];global.AlbumProgress.unlockAlbumPlayers(global.AlbumProgress.DEFAULT_COLLECTION_ID,ids,{source:"development-dev-unlock"});developmentPlayersCache=null;developmentResolvedCache.clear();toast(`${ids.length} svincolati disponibili.`);renderDevelopmentCenter("players");});
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

  function startRunWithIdentity(identity) {
    const localIdentity = normalizeTeamIdentity(identity);
    let candidate;
    try {
      candidate = global.RunState.createRun(localIdentity, activeSeason?.id);
    } catch (error) {
      const SnapshotError = global.DevelopmentRuntime?.DevelopmentSnapshotError;
      if (!SnapshotError || !(error instanceof SnapshotError)) throw error;
      console.error("New run Development snapshot rejected", { code: error.code, details: error.details });
      toast("Impossibile avviare la run: i dati del Centro di sviluppo richiedono una verifica.");
      return false;
    }
    global.RunState.save(candidate, { replaceRun: true });
    run = candidate;
    global.run = candidate;
    try { global.RunState.saveProfileTeamIdentity(localIdentity); }
    catch (error) { console.warn("Account profile update deferred; local run is already saved", { code: error?.code || "profile-write-failed" }); }
    closeModal({ invokeOnClose: false });
    renderFormationChoice();
    return true;
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
    const bossLine = `Boss ${Math.min(Number(run.bossIndex || 0) + 1, seasonDb?.bossOrder?.length || 99)} · Livello ${global.LevelProgression.formatLevel(run, run.seasonId)} · ${run.lives ?? "-"} vite`;
    openModal(`
      <div class="modal-head"><div><p class="eyebrow">Nuova run</p><h2>Inizia nuova run</h2><p class="muted">Hai già una run attiva in ${escapeHtml(seasonName)}.</p></div>${inazumaLogoMarkup("inazuma-logo--modal")}</div>
      <p class="home-overwrite-warning"><strong>${escapeHtml(bossLine)}</strong><br>Iniziando una nuova run, i progressi attuali di ${escapeHtml(seasonName)} verranno sostituiti. Le altre Season resteranno intatte. L’Albo d’Oro e le squadre campioni resteranno salvati.</p>
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

  async function resumeRun() {
    await selectSeason(run?.seasonId || activeSeason?.id, { markPlayed: true });
    if (!run) return renderHome();
    if (run.phase === "finalization" || (run.finalization && run.finalization.status !== "complete")) return resumeRunFinalization();
    const specialNormalizationProbe = global.RunState.clone(run);
    if (global.MapEngine.normalizeSpecialMatchNode(specialNormalizationProbe, seasonDb)) {
      const normalized = persistGameplayMutation({
        label: "special-node-normalize-resume",
        mutate: (current) => {
          const previousSpecialNode = current.currentZone?.nodes?.find((node) => node.type === "special_match") || null;
          const activeSpecial = current.activeMatch?.type === "special_match" ? current.activeMatch : null;
          const activeSpecialNodeId = activeSpecial?.nodeId == null ? null : String(activeSpecial.nodeId);
          const changed = global.MapEngine.normalizeSpecialMatchNode(current, seasonDb);
          if (!changed) return { changed: false };
          if (activeSpecial && previousSpecialNode && activeSpecialNodeId === String(previousSpecialNode.id)) {
            const normalizedSpecialNode = current.currentZone?.nodes?.find((node) => node.type === "special_match"
              && (!activeSpecial.specialMatchId || String(node.specialMatchId) === String(activeSpecial.specialMatchId)));
            if (!normalizedSpecialNode) throw Object.assign(new Error("Normalized special match node unavailable"), { code: "special-node-normalization-mismatch" });
            activeSpecial.nodeId = normalizedSpecialNode.id;
          }
          return { changed: true };
        },
      });
      if (!normalized.ok) return renderMapFailureRecovery();
    }
    const matchRecovery = recoverInterruptedMatchAccess();
    if (!matchRecovery.ok) return renderMapFailureRecovery();
    if (run.gameOver || run.phase === "gameover") return renderGameOver();
    if (run.phase === "formation") return renderFormationChoice();
    if (run.phase === "draft") return renderDraft();
    if (run.pendingSpecialMatchReward) return showSpecialMatchReward();
    if (run.postBossFlow) return resumePostBossFlow();
    if (run.phase === "final-summary") return renderFinalSummary(run.hallTeamId, { developmentResolved: true });
    if (run.phase === "final-celebration" || run.phase === "complete") return renderFinalCelebration(run.hallTeamId, { developmentResolved: true });
    if (run.phase === "squad") return renderSquad();
    if (run.phase === "five") return renderFiveVFive({ persist: false, returnToMatch: run.activeMatch?.type === "five_v_five" });
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

  function initialDraftPlayers() {
    if (seasonDb?.recruitmentPool?.entries && isProfileAwareSeason()) {
      const candidates = global.RecruitmentPoolRuntime.effectiveProfiledPlayers(seasonDb, freeAgentsDb);
      return global.RecruitmentPoolRuntime.eligibleInitialDraftPlayers(candidates);
    }
    const config = seasonDb?.draftConfig;
    if (config?.freeAgentsOnly && !Array.isArray(freeAgentsDb?.players)) {
      throw new Error(`Draft ${run?.seasonId}: database svincolati non disponibile (${config.databasePath || "data/FREE_AGENTS_compact.json"})`);
    }
    const players = freeAgentsDb?.players;
    if (!Array.isArray(players)) throw new Error("Draft: database svincolati non disponibile");
    const invalid = players.find((player) => player.profileId || global.SeasonRegistry?.isSeasonSource?.(player.source));
    if (invalid) throw new Error(`Draft corrotto: candidato ${invalid.playerId} non è uno svincolato normale`);
    return players;
  }

  function renderFormationChoice() {
    if (run.phase !== "formation") {
      const transition = persistGameplayMutation({ label: "initial-formation-phase", mutate: (current) => { current.phase = "formation"; } });
      if (!transition.ok) return renderHome();
    }
    app.innerHTML = `
      <main class="screen onboarding-screen formation-choice-screen">
        ${topbar("Scegli il modulo")}
        <div class="content narrow">
          <div class="section-head">
            <div><p class="eyebrow">Prima decisione</p><h2>Come giocherà la tua squadra?</h2></div>
          </div>
          <div class="formation-grid">
            ${seasonDb.formations.eleven.map((formation) => `
              <button type="button" class="formation-card ${run.formationId === formation.id ? "selected" : ""}" data-formation="${escapeHtml(formation.id)}" aria-pressed="${run.formationId === formation.id ? "true" : "false"}">
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
        const draftPlayers = initialDraftPlayers();
        persistGameplayMutation({
          label: "initial-draft-start",
          mutate: (current) => {
            current.formationId = formation.id;
            global.DraftEngine.start(current, formation, draftPlayers);
          },
          onCommitted: () => renderDraft(),
          rerender: ({ ok }) => { if (!ok) renderFormationChoice(); },
        });
      });
    });
  }

  function renderDraft() {
    const draft = run.draft;
    if (!draft) return renderSquad();
    const role = draft.roles[draft.step];
    const draftPlayers = initialDraftPlayers();
    const draftById = new Map(draftPlayers.map((player) => [String(player.playerId), player]));
    const candidates = draft.candidates.map((id) => draftById.get(String(id))).filter(Boolean);
    const progress = (draft.step / draft.roles.length) * 100;
    app.innerHTML = `
      <main class="screen onboarding-screen initial-draft-screen">
        ${topbar("Draft iniziale")}
        <div class="content narrow">
          <p class="eyebrow">Scelta ${draft.step + 1} di ${draft.roles.length}</p>
          <div class="section-head">
            <div><h2>Scegli il tuo ${role}</h2><p class="muted">Uno di questi tre entrerà nella rosa.</p></div>
            <span class="role-chip">${escapeHtml(run.formationId)}</span>
          </div>
          <div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div>
          <div class="candidate-grid pull-offer-grid initial-draft-grid">
            ${candidates.map((player) => playerCard(player, { button: true, extraClass: "initial-draft-card", applyPermanent: true })).join("")}
          </div>
        </div>
      </main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();

    document.querySelectorAll("[data-player-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const playerId = button.dataset.playerId;
        let completed = false;
        const committed = persistGameplayMutation({
          label: "initial-draft-pick",
          mutate: (current) => {
            completed = global.DraftEngine.choose(current, playerId, draftPlayers, formationById(current.formationId));
            if (!completed) return;
            ensureFiveVFive();
            current.roster.forEach((entry) => {
              const source = sourcePlayer(entry);
              entry.firstJoinedAt = entry.firstJoinedAt || new Date().toISOString();
              entry.recruitmentSource = entry.recruitmentSource || "initial_draft";
              entry.recruitedAtLevel = entry.recruitedAtLevel ?? entry.level ?? 0;
              entry.recruitedOverall = entry.recruitedOverall ?? source?.finalOverall ?? null;
              global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.PLAYER_RECRUITED, { player: source || entry, playerId: entry.playerId, source: "initial_draft", level: entry.level || 0, overall: entry.recruitedOverall, actionId: `${current.runId}:initial_draft:${entry.playerId}` });
              enqueueAlbumRecruit(current, entry.playerId, "initial_draft", `${current.runId}:initial_draft:${entry.playerId}`);
            });
            current.phase = "squad";
            reconcileSquadRosterState(current);
          },
          onCommitted: () => {
            if (completed) run.roster.forEach((entry) => unlockAlbumRecruit(entry.playerId, "initial_draft"));
            completed ? renderSquad() : renderDraft();
          },
          rerender: ({ ok }) => { if (!ok) renderDraft(); },
        });
        return committed;
      });
    });
  }

  const squadController = global.SquadControllerRuntime.create({
    getRun: () => run, formations: () => seasonDb?.formations?.eleven || [],
    getRole: (id, current) => effectiveRosterRole(id, current), resolveEntry: rosterEntry,
    resolveSource: sourcePlayer, persistMutation: persistGameplayMutation, rosterInvariants: global.RosterInvariants,
  });
  const squadView = global.SquadViewRuntime.create({
    getRun: () => run, getUi: () => ui, controller: squadController,
    seasonFormations: () => seasonDb?.formations?.eleven || [], formationById,
    effectiveRosterRole, rosterEntry, sourcePlayer, resolvedRosterPlayer, compactPlayerCardMarkup,
    escapeHtml, tacticSummary, tacticLabels: { attack: "Attacco", control: "Controllo", defense: "Difesa", save: "Parata", speed: "Velocità", physical: "Fisico", stamina: "Resistenza" }, formationLayout: global.FormationLayout,
    openModal, closeModal, modalRoot, scrollSnapshot, toast, runKeepingScroll, app, topbar, bottomNav,
    resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, showPlayerDetails, resumePostBossFlowOrMap,
    profiledSeasonRuntime: global.ProfiledSeasonRuntime, persistGameplayMutation, fiveVFive: global.FiveVFive, cssEscape,
  });
  function reconcileSquadRosterState(current = run) { return squadController.reconcileRosterState(current); }
  function tacticalMiniPlayer(id, options) { return squadView.tacticalPlayer(id, options); }
  function squadPitchMarkup(options) { return squadView.pitchMarkup(options); }
  function benchMarkup(options) { return squadView.benchMarkup(options); }
  function renderSquad() { return squadView.render(); }

  function ensureCurrentZone() {
    const result = global.MapEngine.ensureCurrentZone(run, seasonDb);
    if (!result.generated) {
      if (result.changed) { try { global.RunState.save(run); } catch (error) { console.error("save failed (ensureCurrentZone)", error); } }
      return;
    }
    run.phase = "map";
    global.RunState.createCheckpoint(run);
  }

  function ensureCurrentZoneMutation(current) {
    return global.BossGameOverRuntime.ensureCurrentZoneMutation({ run: current, seasonDb, mapEngine: global.MapEngine });
  }

  function specialMatchById(specialMatchId) { return global.SpecialMatchRuntime.byId(seasonDb, specialMatchId); }
  function specialMatchForNode(node) { return global.SpecialMatchRuntime.forNode(seasonDb, node); }
  function specialMatchTeamPlayers(specialMatch) { return global.SpecialMatchRuntime.teamPlayers(seasonDb, specialMatch); }
  function specialMatchFromNode(node, previousNodeId = null, activeRun = run) { return global.SpecialMatchRuntime.fromNode(activeRun, seasonDb, node, previousNodeId); }
  function activeMatchNeedsPhaseRecovery(activeRun, match) {
    return Boolean(
      match &&
      ["five_v_five", "special_match", "boss"].includes(match.type) &&
      activeRun?.phase !== "match" &&
      !(match.type === "five_v_five" && activeRun?.phase === "five") &&
      match.postMatchNavigationApplied !== true
    );
  }

  function recoverInterruptedMatchAccess() {
    if (activeMatchNeedsPhaseRecovery(run, run?.activeMatch)) {
      const identity = matchTransactionIdentity(run.activeMatch);
      const type = run.activeMatch.type;
      const committed = commitMatchMutation("match-access-recovery", identity, (match, current) => {
        if (!activeMatchNeedsPhaseRecovery(current, match)) throw new Error("Match access recovery state changed");
        current.phase = "match";
      });
      return { needed: true, ok: committed.ok, type };
    }
    const zone = run?.currentZone;
    const pending = zone?.nodes?.find((node) => String(node.id) === String(zone.pendingNodeId));
    const specialNeeded = !run?.pendingSpecialMatchReward && !run?.activeMatch && pending?.type === "special_match";
    if (specialNeeded && !recoverInterruptedSpecialMatchAccess()) return { needed: true, ok: false, type: "special_match" };
    const bossNeeded = !run?.postBossFlow && !run?.pendingBossVictory && !run?.activeMatch && pending?.type === "boss";
    if (bossNeeded && !recoverInterruptedBossAccess()) return { needed: true, ok: false, type: "boss" };
    return { needed: specialNeeded || bossNeeded, ok: true };
  }

  function recoverInterruptedSpecialMatchAccess() {
    if (!run || run.pendingSpecialMatchReward) return false;
    if (run.activeMatch?.type === "special_match") {
      if (run.phase === "match") return true;
      const identity = matchTransactionIdentity(run.activeMatch);
      return commitMatchMutation("special-match-access-recovery", identity, (_match, current) => { current.phase = "match"; }).ok;
    }
    const pending = run.currentZone?.nodes?.find((node) => String(node.id) === String(run.currentZone?.pendingNodeId));
    if (pending?.type !== "special_match") return false;
    const nodeId = pending.id;
    return persistGameplayMutation({
      label: "special-match-entry-recovery",
      mutate: (current) => {
        if (current.activeMatch || String(current.currentZone?.pendingNodeId) !== String(nodeId)) throw new Error("Special match recovery state changed");
        const currentNode = current.currentZone?.nodes?.find((node) => String(node.id) === String(nodeId));
        if (currentNode?.type !== "special_match") throw new Error("Special match recovery node changed");
        current.activeMatch = specialMatchFromNode(currentNode, current.currentZone.currentNodeId, current);
        current.phase = "match";
      },
      onCommitted: (_value, current) => { ui.match = current.activeMatch; ui.bossMatchState = ui.match?.state || "pre-match"; ui.bossMatchLog = ui.match?.log || []; },
    }).ok;
  }

  function bossMatchFromNode(node, previousNodeId = null, activeRun = run) {
    const match = {
      nodeId: node.id,
      previousNodeId: previousNodeId || activeRun.currentZone?.currentNodeId || activeRun.currentZone?.startNodeId || null,
      type: "boss",
      state: "pre-match",
      log: [],
      bossIndex: activeRun.bossIndex,
      attemptNumber: Object.keys(activeRun.statistics?.processedMatchIds || {}).filter((id) => id.includes(`::${node.id}::boss::`)).length + 1,
    };
    match.matchId = global.RunStatistics?.createStableMatchId?.(activeRun, match) || null;
    return match;
  }

  // Older/interrupted saves can contain a selected boss node without the match
  // snapshot, or a valid boss snapshot whose phase was written as `map`.
  // Reconcile those fields instead of regenerating the zone or resetting the run.
  function recoverInterruptedBossAccess() {
    if (!run || run.postBossFlow || run.pendingBossVictory) return false;
    const zone = run.currentZone;
    const activeBoss = run.activeMatch?.type === "boss" ? run.activeMatch : null;
    if (activeBoss && !String(activeBoss.state || "").startsWith("completed") && run.phase !== "match") {
      const identity = matchTransactionIdentity(activeBoss);
      return commitMatchMutation("boss-match-access-recovery", identity, (_match, current) => { current.phase = "match"; }).ok;
    }
    if (!zone?.nodes?.length || run.activeMatch) return false;
    const pending = zone.nodes.find((node) => String(node.id) === String(zone.pendingNodeId));
    if (!pending || pending.type !== "boss") return false;
    const nodeId = pending.id;
    return persistGameplayMutation({
      label: "boss-match-entry-recovery",
      mutate: (current) => {
        if (current.activeMatch || String(current.currentZone?.pendingNodeId) !== String(nodeId)) throw new Error("Boss match recovery state changed");
        const currentNode = current.currentZone?.nodes?.find((node) => String(node.id) === String(nodeId));
        if (currentNode?.type !== "boss") throw new Error("Boss match recovery node changed");
        current.activeMatch = bossMatchFromNode(currentNode, current.currentZone.currentNodeId, current);
        current.phase = "match";
      },
      onCommitted: (_value, current) => { ui.match = current.activeMatch; ui.bossMatchState = ui.match?.state || "pre-match"; ui.bossMatchLog = ui.match?.log || []; },
    }).ok;
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
    const readOnly = options.persist === false;
    if (readOnly && options.failureLocked === true) {
      app.innerHTML = `<main class="screen"><div class="content"><section class="panel"><h1>SALVATAGGIO NON RIUSCITO</h1><p>Lo stato salvato non è stato modificato. Riprova per riprendere dal checkpoint canonico.</p><button type="button" class="btn btn-yellow" id="retry-failed-gameplay">RIPROVA</button></section></div></main>`;
      document.getElementById("retry-failed-gameplay")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        if (button.disabled) return;
        button.disabled = true;
        await resumeRun();
      });
      return app.innerHTML;
    }
    if (!readOnly) {
      if (run) global.RunState.touch(run);
      const bossFlow = resolvePendingRunFlow();
      if (bossFlow.destination !== "none") return navigateBossVictoryDestination(bossFlow);
      ensureCurrentZone();
    } else if (run?.postBossFlow || run?.pendingBossVictory) {
      return renderPostBossRecovery();
    }
    const readOnlyZoneUnavailable = readOnly && (!run?.currentZone || !Array.isArray(run.currentZone.nodes) || !Array.isArray(run.currentZone.edges) || !Array.isArray(run.currentZone.path));
    if (!run?.currentZone || readOnlyZoneUnavailable) {
      if (!readOnly) return renderSeasonComplete();
      app.innerHTML = `<main class="screen"><div class="content"><section class="panel"><h1>PERCORSO NON DISPONIBILE</h1><p>Lo stato salvato non è stato modificato. Riprova quando il salvataggio è disponibile.</p><button type="button" id="retry-map-render">RIPROVA</button></section></div></main>`;
      document.getElementById("retry-map-render")?.addEventListener("click", () => renderMap());
      return app.innerHTML;
    }
    if (!readOnly) {
      run.phase = "map";
      try { global.RunState.save(run); } catch (error) { console.error("save failed (renderMap)", error); }
    }
    const zone = run.currentZone;
    const boss = seasonDb.bossOrder[run.bossIndex];
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
                <p class="eyebrow route-kicker">Percorso · Boss ${run.bossIndex + 1}/${seasonDb.bossOrder.length}</p>
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
      const node = run.currentZone?.nodes?.find((candidate) => String(candidate.id) === String(nodeId));
      if (!node || node.type === "boss" || !global.MapEngine.reachableNodeIds(run.currentZone).map(String).includes(String(node.id))) return toast("Seleziona un nodo disponibile");
      node.type = button.dataset.devTransformNode;
      delete node.revealedType;
      delete node.pullState;
      try { global.RunState.save(run); } catch (error) { console.error("save failed (dev transform node)", error); }
      toast(node.type === "trade" ? "Nodo trasformato in Scambio" : "Nodo trasformato in Pull Leggendario");
      renderMap();
    }));
  }

  function canonicalNodeById(nodeId) {
    return run?.currentZone?.nodes?.find((item) => String(item.id) === String(nodeId)) || null;
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
    return activePullNodeById(run, nodeId, pullType);
  }

  function rerenderCanonicalPull(nodeId, pullType, options = {}, activeOptions = {}) {
    const currentNode = activePullNodeById(run, nodeId, pullType, activeOptions);
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
          else if (selectedNode.type === "special_match") created = current.activeMatch?.type === "special_match" && current.activeMatch.nodeId === selectedNode.id ? current.activeMatch : specialMatchFromNode(selectedNode, previousNodeId, current);
          else if (selectedNode.type === "boss") created = bossMatchFromNode(selectedNode, previousNodeId, current);
          else throw new Error("Node is not a match");
          current.phase = "match"; current.activeMatch = created; return created;
        },
        onCommitted: (created) => {
          if (created?.formationRequired) return toast("Completa la Formazione 5v5 prima di avviare la partitella.");
          ui.match = created; ui.bossMatchState = created.state || "pre-match"; ui.bossMatchLog = created.log || []; ui.bossMatchResolving = false;
        },
        rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
      });
      if (!committed.ok) return;
      if (committed.value?.formationRequired) return renderFiveVFive({ persist: false });
      return renderMatch();
  }

  function enterNode(nodeId) {
    const previousNodeId = run.currentZone?.currentNodeId || null;
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
    if (["five_v_five", "special_match", "boss"].includes(eventType)) {
      return enterMatchFromNode(node.id, context.previousNodeId, { alreadySelected: true, matchType: eventType });
    }
    if (eventType.startsWith("pull_")) return openPull(node, eventType);
    if (eventType === "item") return resolveItemNode(node);
    if (eventType === "trade") return resolveTradeNode(node);
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
    const pending = run?.pendingItemReward;
    if (!pending || !run?.currentZone) return null;
    return activeItemRewardNodeById(run, pending.nodeId, { allowClaimed: pending.status === "claimed" });
  }

  function resumePendingItemReward() {
    const storedNode = pendingItemRewardNode();
    if (storedNode) {
      renderMap({ persist: false });
      resolveItemNode(storedNode);
      return true;
    }

    if (run?.pendingItemReward) {
      const expectedNodeId = String(run.pendingItemReward.nodeId);
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

    const pendingNode = run?.currentZone?.nodes?.find(
      (node) => String(node.id) === String(run.currentZone.pendingNodeId)
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
    const nodeId = String(node.id);
    const existing = run.pendingItemReward;
    const sameNode = existing && String(existing.nodeId) === nodeId;
    const canonicalNode = activeItemRewardNodeById(run, nodeId, { allowClaimed: sameNode && existing.status === "claimed" });
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
    const prepared = ensurePendingItemReward(node);
    if (prepared === false) return;
    if (!prepared) return renderMap({ persist: false });
    const { pending, candidates } = prepared;
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
          recoverCanonicalItemReward(node.id);
        }
      );
    });
    document.getElementById("skip-item").addEventListener("click", () => {
      if (ui.itemRewardSubmitting) return;
      ui.itemRewardSubmitting = true;
      const nodeId = String(node.id);
      persistGameplayMutation({ label: "item-reward-skip", mutate: (current) => {
        const currentNode = activeItemRewardNodeById(current, nodeId);
        if (!currentNode || String(current.pendingItemReward?.nodeId) !== nodeId) throw new Error("Item reward state changed");
        current.pendingItemReward = null;
        global.MapEngine.completeNode(current.currentZone, currentNode.id);
        global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.NODE_COMPLETED, { nodeId: currentNode.id, nodeType: currentNode.type, actionId: `${current.runId}:${currentNode.id}:node_completed` });
        current.phase = "map";
      }, onCommitted: () => { closeModal(); toast("Hai rinunciato all'oggetto"); renderMap({ persist: false }); }, rerender: ({ ok }) => { if (!ok) { ui.itemRewardSubmitting = false; recoverCanonicalItemReward(nodeId); } } });
    });
  }

  function completeItemReward(node, instance) {
    ui.itemRewardSubmitting = false;
    { const currentNode = canonicalNodeById(node.id); currentNode ? renderItemRewardResult(currentNode) : renderMap({ persist: false }); }
  }

  function recoverCanonicalItemReward(nodeId) {
    const pending = run?.pendingItemReward;
    if (pending?.status === "claimed" && String(pending.nodeId) === String(nodeId)) return rerenderCanonicalItemReward(nodeId);
    const currentNode = activeItemRewardNodeById(run, nodeId);
    return currentNode ? resolveItemNode(currentNode) : renderMap({ persist: false });
  }

  function rerenderCanonicalItemReward(expectedNodeId) {
    const pendingNodeId = run?.pendingItemReward?.nodeId;
    if (pendingNodeId == null || String(pendingNodeId) !== String(expectedNodeId)) return renderMap({ persist: false });
    const currentNode = canonicalNodeById(pendingNodeId);
    return currentNode ? renderItemRewardResult(currentNode) : renderMap({ persist: false });
  }

  function renderItemRewardResult(node) {
    const expectedNodeId = String(node.id);
    const pending = run.pendingItemReward;
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
      persistGameplayMutation({ label: "item-reward-cleanup", mutate: (current) => {
        if (current.pendingItemReward?.status !== "claimed" || String(current.pendingItemReward.nodeId) !== expectedNodeId) throw new Error("Item reward result changed");
        current.pendingItemReward = null;
      }, onCommitted: () => { closeModal(); toast(`Hai ottenuto ${item.name}`); renderMap({ persist: false }); }, rerender: ({ ok }) => { if (!ok) rerenderCanonicalItemReward(expectedNodeId); } });
    });
  }

  function resolveRandomNode(node) {
    const revealedType = node?.revealedType;
    if (!revealedType) return renderMap();
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
      currentNode ? dispatchNode(currentNode, revealedType, { previousNodeId: run.currentZone?.currentNodeId }) : renderMap();
    });
  }

  function tradeSelectionSummaryMarkup(selected) {
    if (!selected) {
      return `<div class="trade-selection-copy"><span>Scegli una card</span><strong>Nessun giocatore selezionato</strong><small>Puoi cedere un titolare oppure una riserva.</small></div><span class="trade-selection-state">IN ATTESA</span>`;
    }
    return `<span class="trade-selection-portrait"><img src="${escapeHtml(playerPortraitUrl(selected))}" alt="" loading="lazy" decoding="async" ${imageFallbackAttributes(resolvePlayerVisual(selected).cardFallbacks)} /></span><div class="trade-selection-copy"><span>GIOCATORE SELEZIONATO</span><strong>${escapeHtml(selected.name)}</strong><small>${escapeHtml(selected.position)} · OVR ${escapeHtml(selected.overall)} · LV ${escapeHtml(selected.displayLevelText ?? selected.displayLevel)}</small></div><span class="trade-selection-state">PRONTO</span>`;
  }

  function tradeStaticPlayerCardMarkup(player, { level = player.displayLevelText ?? player.displayLevel ?? 0, overall = player.overall ?? player.finalOverall, equipment = null, extraClass = "" } = {}) {
    return compactPlayerCardMarkup(player, {
      equipment,
      equipmentInFooter: true,
      level,
      overall,
      tag: "article",
      detailLayout: "stacked",
      extraClass: `trade-preview-card ${extraClass}`.trim(),
    });
  }

  function updateTradeConfirmState() {
    const selected = ui.tradeSelectedPlayerId ? resolvedRosterPlayer(ui.tradeSelectedPlayerId) : null;
    const summary = modalRoot.querySelector(".trade-selection-summary");
    if (summary) {
      summary.classList.toggle("selected", Boolean(selected));
      summary.innerHTML = tradeSelectionSummaryMarkup(selected);
    }
    const confirm = document.getElementById("continue-trade");
    if (confirm) confirm.disabled = !selected;
  }

  function setSelectedTradePlayer(playerId) {
    const previous = ui.tradeSelectedPlayerId;
    const previousCard = previous ? modalRoot.querySelector(`[data-trade-player="${cssEscape(previous)}"]`) : null;
    previousCard?.classList.remove("selected");
    previousCard?.setAttribute("aria-pressed", "false");
    ui.tradeSelectedPlayerId = playerId ? String(playerId) : null;
    const selectedCard = ui.tradeSelectedPlayerId ? modalRoot.querySelector(`[data-trade-player="${cssEscape(ui.tradeSelectedPlayerId)}"]`) : null;
    selectedCard?.classList.add("selected");
    selectedCard?.setAttribute("aria-pressed", "true");
    updateTradeConfirmState();
  }

  function resolveTradeNode(node) {
    ui.tradeSelectedPlayerId = null;
    const selected = null;
    openModal(`
      <section class="exchange-screen">
        <div class="modal-head trade-node-head trade-hero">
          <div>
            <p class="eyebrow">Nodo scambio</p>
            <h1>SCEGLI CHI CEDERE</h1>
            <p class="muted">Seleziona un titolare o una riserva. Riceverai un giocatore dello stesso ruolo con potenziale finale almeno equivalente e un livello in più.</p>
          </div>
        </div>
        <main class="exchange-content">
          <div class="trade-flow-summary" aria-label="Regole dello scambio">
            <div><span>1 · Cedi</span><strong>Un giocatore della rosa</strong></div>
            <div><span>2 · Ricevi</span><strong>Stesso ruolo · OVR finale ≥</strong></div>
            <div><span>Bonus</span><strong>Livello del giocatore +1</strong></div>
          </div>
          <div class="trade-squad-layout">
            <section class="trade-field-panel" aria-label="Titolari disponibili per lo scambio">
              <div class="trade-section-head"><div><span>Titolari</span><strong>FORMAZIONE ATTUALE</strong></div><small>TOCCA UNA CARD</small></div>
              ${squadPitchMarkup({ mode: "trade", selectedId: ui.tradeSelectedPlayerId })}
            </section>
            <aside class="panel trade-bench-panel">
              <div class="trade-section-head"><div><span>Panchina</span><strong>RISERVE</strong></div><small>${escapeHtml((run.bench || []).length)}/4</small></div>
              <div class="bench-list">${benchMarkup({ mode: "trade", selectedId: ui.tradeSelectedPlayerId })}</div>
            </aside>
          </div>
          <div class="trade-selection-summary ${selected ? "selected" : ""}" aria-live="polite">
            ${tradeSelectionSummaryMarkup(selected)}
          </div>
        </main>
        <div class="node-actions exchange-actions trade-actions">
          <button type="button" class="btn btn-yellow btn-primary-action" id="continue-trade" ${selected ? "" : "disabled"}>PROCEDI ALLO SCAMBIO</button>
          <button type="button" class="btn btn-ghost" id="skip-trade">RINUNCIA E TORNA ALLA MAPPA</button>
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

  function tradeCandidatePreview(incoming, entry) {
    if (incoming.profileId) return global.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(entry || { playerId: incoming.playerId, activeProfileId: incoming.profileId, activeRoleVariantId: incoming.activeRoleVariantId, level: 0, levelUnits: 0 }, { run, seasonId: run.seasonId, database: seasonDb });
    const level = Number(entry?.level || 0);
    return incoming.source === "free_agents"
      ? global.DevelopmentRuntime.resolveRosterPlayer(run, incoming.player, { ...permanentRosterFields(incoming.player), ...(entry || {}) }, freeAgentsDb)
      : global.InazumaProgression.getPlayerAtLevel(incoming.player, Math.floor(level), freeAgentsDb, entry || {});
  }

  function roleVariantForTradeUpgrade(entry, profile) {
    const currentRole = String(global.ProfiledSeasonRuntime.resolveEffectiveBase(entry, run.seasonId)?.position || "").toUpperCase();
    const preserved = (profile?.roleVariants || []).find((variant) => String(variant.position || variant.normalizedRole || "").toUpperCase() === currentRole);
    return String(preserved?.roleVariantId || preserved?.variantId || profile?.defaultRoleVariantId || entry.activeRoleVariantId || "") || null;
  }

  function prepareTrade(node, outgoingId) {
    const outgoingEntry = rosterEntry(outgoingId);
    const outgoingResolved = resolvedRosterPlayer(outgoingId);
    const outgoingBase = global.RoguelikeRules.tradeOutgoingEffectiveMetadata(outgoingResolved);
    if (!outgoingEntry || !outgoingResolved || !outgoingBase?.position || !Number.isFinite(Number(outgoingBase.finalOverall))) {
      toast("Giocatore non disponibile per lo scambio");
      return resolveTradeNode(node);
    }
    const candidates = isProfileAwareSeason()
      ? global.RoguelikeRules.getProfileAwareTradeCandidates({
          outgoingPlayer: outgoingBase,
          outgoingPlayerId: outgoingEntry.playerId,
          rosterEntries: run.roster,
          freeAgents: freeAgentsDb.players,
          profiles: seasonDb.profiles,
          unlockedTeamIds: [...(run.unlockedTeamIds || []), ...(run.unlockedSpecialTeamIds || [])],
          teams: seasonDb.teams,
          seasonId: run.seasonId,
          compareProfileProgression: global.ProfiledSeasonRuntime.compareProfileProgression,
          resolveCandidate: (player, source) => source === "free_agents"
            ? global.DevelopmentRuntime.resolveEffectiveMetadata(run, player, freeAgentsDb)
            : player,
        })
      : global.RoguelikeRules.getTradeCandidates({ outgoingPlayer: outgoingBase, rosterIds: run.roster.map((entry) => entry.playerId), freeAgents: freeAgentsDb.players, seasonPlayers: seasonDb.players, unlockedTeamIds: run.unlockedTeamIds, teams: seasonDb.teams, resolveCandidate: (player, source) => source === "free_agents" ? global.DevelopmentRuntime.resolveEffectiveMetadata(run, player, freeAgentsDb) : player });
    if (!candidates.length) {
      toast(`Nessun ${outgoingBase.position} con finalOverall ${outgoingBase.finalOverall} o superiore disponibile`);
      return resolveTradeNode(node);
    }
    const random = global.DraftEngine.randomFromSeed(`${run.currentZone.seed}:${node.id}:trade:${outgoingId}`);
    const incoming = candidates[Math.floor(random() * candidates.length)];
    const nextLevel = Math.min(20, Number(outgoingEntry.level || 0) + 1);
    const incomingEntry = { playerId: incoming.playerId || incoming.player.playerId, activeProfileId: incoming.profileId || null, activeRoleVariantId: incoming.activeRoleVariantId || null, level: nextLevel, levelUnits: 0 };
    const incomingResolved = tradeCandidatePreview(incoming, incomingEntry);
    const sameCardUpgrade = String(incomingEntry.playerId) === String(outgoingId);
    const inventoryFull = Boolean(!sameCardUpgrade && outgoingEntry.equippedItem && run.inventory.length >= global.SEASON1_CONFIG.maxInventory);
    openModal(`
      <section class="trade-confirm-screen">
        <div class="modal-head trade-node-head trade-confirm-head"><div><p class="eyebrow">Conferma scambio</p><h1>VALUTA L’OFFERTA</h1><p class="muted">Conferma per completare lo scambio oppure rinuncia definitivamente e torna alla mappa.</p></div></div>
        <div class="trade-versus" aria-label="Confronto giocatori dello scambio">
          <article class="trade-versus-side trade-versus-side--outgoing"><div class="trade-side-label"><span>CEDI</span><small>Esce dalla rosa</small></div>${tradeStaticPlayerCardMarkup(outgoingResolved, { level: outgoingResolved.displayLevel, overall: outgoingResolved.overall, equipment: outgoingEntry.equippedItem, extraClass: "trade-preview-card--outgoing" })}<dl class="trade-player-facts"><div><dt>Ruolo</dt><dd>${escapeHtml(outgoingResolved.position)}</dd></div><div><dt>OVR attuale</dt><dd>${escapeHtml(outgoingResolved.overall)}</dd></div><div><dt>Livello</dt><dd>${escapeHtml(outgoingResolved.displayLevel)}</dd></div></dl></article>
          <div class="trade-versus-arrow" aria-hidden="true"><span>⇄</span><small>SCAMBIO</small></div>
          <article class="trade-versus-side trade-versus-side--incoming"><div class="trade-side-label"><span>RICEVI</span><small>${incoming.kind === "upgrade" ? "Profilo potenziato" : "Entra nella rosa"}</small></div>${tradeStaticPlayerCardMarkup(incomingResolved, { level: nextLevel, overall: incomingResolved.overall, extraClass: "trade-preview-card--incoming" })}<dl class="trade-player-facts"><div><dt>Ruolo</dt><dd>${escapeHtml(incomingResolved.position)}</dd></div><div><dt>OVR attuale</dt><dd>${escapeHtml(incomingResolved.overall)}</dd></div><div><dt>Nuovo livello</dt><dd>${escapeHtml(nextLevel)}</dd></div></dl></article>
        </div>
        <div class="trade-contract-strip"><span>CONDIZIONI GARANTITE</span><strong>Stesso ruolo · finalOverall ≥ ${escapeHtml(outgoingBase.finalOverall)} · Livello +1</strong></div>
        ${outgoingEntry.equippedItem && !sameCardUpgrade ? `<p class="trade-note ${inventoryFull ? "trade-note--warning" : ""}"><strong>${inventoryFull ? "INVENTARIO PIENO" : "OGGETTO RECUPERATO"}</strong><span>${escapeHtml(outgoingEntry.equippedItem.name)} tornerà nell'inventario${inventoryFull ? ": prima dovrai liberare uno spazio." : "."}</span></p>` : ""}
        <div class="node-actions trade-confirm-actions"><button type="button" class="btn btn-yellow btn-primary-action" id="confirm-trade">CONFERMA SCAMBIO</button><button type="button" class="btn btn-ghost" id="cancel-trade">RINUNCIA ALLO SCAMBIO</button></div>
      </section>`, { closeable: false, className: "trade-confirm-modal" });
    document.getElementById("cancel-trade").addEventListener("click", () => { ui.tradeSelectedPlayerId = null; finishNonMatchNode(node, "Hai rinunciato allo scambio"); });
    document.getElementById("confirm-trade").addEventListener("click", () => {
      const execute = () => executeTrade(node, outgoingEntry, incoming, nextLevel);
      if (inventoryFull) return chooseInventoryDiscard("Libera uno spazio per recuperare l'oggetto equipaggiato", execute, () => prepareTrade(node, outgoingId));
      execute();
    });
  }

  function executeTrade(node, outgoingEntry, incoming, nextLevel) {
    let result;
    let receivedEntry;
    const committed = persistGameplayMutation({
      label: isProfileAwareSeason() ? "trade-profile" : "trade",
      mutate: (current) => {
        const outgoingId = String(outgoingEntry.playerId);
        if (!isProfileAwareSeason()) {
          const incomingId = String(incoming.player.playerId);
          const rosterIndex = current.roster.findIndex((entry) => String(entry.playerId) === outgoingId);
          const currentOutgoing = global.RoguelikeRules.tradeOutgoingEffectiveMetadata(resolvedRosterPlayer(outgoingId, current));
          const incomingEffective = incoming.source === "free_agents" ? global.DevelopmentRuntime.resolveEffectiveMetadata(current, incoming.player, freeAgentsDb) : incoming.player;
          if (!currentOutgoing || String(incomingEffective?.position || "").toUpperCase() !== currentOutgoing.position || Number(incomingEffective?.finalOverall) < currentOutgoing.finalOverall) throw Object.assign(new Error("Offerta non più valida"), { code: "trade-invalid" });
          if (outgoingEntry.equippedItem) current.inventory.push(outgoingEntry.equippedItem);
          current.roster[rosterIndex] = { playerId: incomingId, source: incoming.source, level: nextLevel, equippedItem: null, ...permanentRosterFields(incoming.player) };
          current.lineup = current.lineup.map((id) => String(id) === outgoingId ? incomingId : String(id));
          current.bench = current.bench.map((id) => String(id) === outgoingId ? incomingId : String(id));
          global.FiveVFive.removeUnavailable(current);
          optimizeLineupsForNewPlayer(incomingId);
          receivedEntry = current.roster[rosterIndex];
          result = { player: receivedEntry, status: "acquired", recruited: true };
          return;
        }
        result = global.RoguelikeRules.executeProfileAwareTrade(current, outgoingEntry.playerId, incoming, {
          roleVariantForUpgrade: roleVariantForTradeUpgrade,
          resolveOutgoingBase: (entry) => global.RoguelikeRules.tradeOutgoingEffectiveMetadata(resolvedRosterPlayer(entry.playerId, current)),
          resolveIncomingCandidate: (player, source) => source === "free_agents"
            ? global.DevelopmentRuntime.resolveEffectiveMetadata(current, player, freeAgentsDb)
            : player,
        });
        if (!result.player) throw Object.assign(new Error("Offerta non più valida"), { code: "trade-invalid" });
        receivedEntry = result.player;
        if (result.recruited) {
          Object.assign(result.player, { firstJoinedAt: new Date().toISOString(), recruitedOverall: tradeCandidatePreview(incoming, result.player)?.overall ?? incoming.player.finalOverall, ...permanentRosterFields(incoming.player) });
          global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.PLAYER_RECRUITED, { player: incoming.player, playerId: result.player.playerId, source: "trade", level: result.player.level, overall: result.player.recruitedOverall, actionId: `${current.runId}:${node.id}:trade:${result.player.playerId}` });
          enqueueAlbumRecruit(current, result.player.playerId, "trade", `${current.runId}:${node.id}:trade:${result.player.playerId}`);
          optimizeLineupsForNewPlayer(result.player.playerId);
        }
        global.FiveVFive.removeUnavailable(current);
      },
      onCommitted: () => {
        ui.tradeSelectedPlayerId = null;
        if (result.recruited) unlockAlbumRecruit(result.player.playerId, "trade");
        showTradeResult(node, incoming, receivedEntry, result.status);
      },
      onMutationError: ({ error }) => {
        console.error("Trade mutation failed", error);
        toast(error?.code === "trade-invalid" ? "Offerta non più valida: la rosa non è stata modificata" : "L'azione non è stata completata.", "error");
        resolveTradeNode(node);
      },
      rerender: ({ ok, stage }) => { if (!ok && stage === "persistence") resolveTradeNode(node); },
    });
    return committed;
  }

  function showTradeResult(node, incoming, receivedEntry, status) {
    const resolved = isProfileAwareSeason() ? resolvedRosterPlayer(receivedEntry.playerId) : tradeCandidatePreview(incoming, receivedEntry);
    const upgraded = status === "upgraded" || status === "upgraded-self";
    openModal(`<section class="trade-result-screen"><div class="trade-result-badge" aria-hidden="true">✓</div><div class="modal-head trade-node-head trade-result-head"><div><p class="eyebrow">Scambio completato</p><h1>${upgraded ? "PROFILO POTENZIATO" : "NUOVO GIOCATORE"}</h1><p class="muted">${escapeHtml(resolved.name)} ${upgraded ? "ha ottenuto un nuovo profilo." : "è entrato nella rosa e ha preso il posto del giocatore ceduto."}</p></div></div><div class="trade-result-card mobile-compact-player-list">${tradeStaticPlayerCardMarkup(resolved, { level: global.LevelProgression.formatLevel(receivedEntry, run.seasonId), overall: resolved.overall, extraClass: "trade-preview-card--result" })}</div><div class="trade-result-summary"><span>${upgraded ? "POTENZIAMENTO CONFERMATO" : "ARRIVO CONFERMATO"}</span><strong>${escapeHtml(resolved.name)}</strong><small>${escapeHtml(resolved.position)} · OVR ${escapeHtml(resolved.overall)} · Lv ${escapeHtml(global.LevelProgression.formatLevel(receivedEntry, run.seasonId))}</small></div><div class="node-actions trade-result-actions"><button type="button" class="btn btn-ghost" id="trade-player-detail">APRI SCHEDA</button><button type="button" class="btn btn-yellow btn-primary-action" id="finish-trade">TORNA ALLA MAPPA</button></div></section>`, { closeable: false, className: "trade-result-modal" });
    document.getElementById("trade-player-detail").addEventListener("click", () => showPlayerDetails(receivedEntry.playerId, () => showTradeResult(node, incoming, receivedEntry, status)));
    document.getElementById("finish-trade").addEventListener("click", () => finishNonMatchNode(node, upgraded ? `${resolved.name}: profilo potenziato` : `${resolved.name} entra nella rosa`));
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

  function openFiveMatchSimulationModal(match, userName, opponentName) {
    const resolved = ui.bossMatchState.startsWith("completed");
    const simulating = ui.bossMatchState === "simulating";
    const score = simulationScoreArray(match, resolved);
    const resultLabel = resolved ? (ui.bossMatchState.endsWith("victory") ? "Vittoria" : "Sconfitta") : simulating ? "In corso" : "Pronta";
    const scoreUserEmblem = global.TeamEmblems.teamEmblemMarkup(global.TeamEmblems.resolveTeamEmblem({ teamIdentity: normalizeTeamIdentity(run.teamIdentity), seasonId: run.seasonId, fallbackKind: "user" }), { escape: escapeHtml, className: "five-simulation-emblem" });
    const scoreOpponentEmblem = global.TeamEmblems.teamEmblemMarkup(global.TeamEmblems.resolveTeamEmblem({ specialType: "free-agents", fallbackKind: "free-agents" }), { escape: escapeHtml, className: "five-simulation-emblem" });
    openModal(`<div class="five-simulation-cabin" data-five-simulation-modal data-match-state="${escapeHtml(ui.bossMatchState)}">
      <header class="five-simulation-head"><p class="eyebrow">Cabina partita</p><h2>Simulazione 5v5</h2><strong class="five-simulation-state">${escapeHtml(resultLabel)}</strong></header>
      <section class="boss-match-result-panel five-simulation-score" aria-live="polite">
        <div class="five-match-result-row"><strong>${scoreUserEmblem}${escapeHtml(userName)}</strong><div class="boss-match-score" aria-label="${escapeHtml(`${userName} ${score[0]} - ${score[1]} ${opponentName}`)}"><span>${score[0]}</span><small>-</small><span>${score[1]}</span></div><strong>${escapeHtml(opponentName)}${scoreOpponentEmblem}</strong></div>
        <p>${escapeHtml(bossMatchStatusText())}</p>
      </section>
      <section class="five-simulation-events"><div class="panel-title-row"><h3>Cronaca eventi</h3><span class="match-state-badge">${simulating ? "Live" : resolved ? "Completa" : "In attesa"}</span></div><ol class="boss-match-log match-sim-log" tabindex="0" aria-label="Cronaca partita" aria-live="polite">${ui.bossMatchLog.length ? bossMatchTimeline() : `<li data-empty-log="true"><span>0'</span><b>⚽</b><p>Calcio d'inizio.</p></li>`}</ol></section>
      <footer class="five-simulation-actions"><button type="button" class="btn btn-secondary" id="skip-match-result" ${simulating ? "" : "hidden disabled"}>Vai al risultato</button><button type="button" class="btn btn-yellow btn-primary-action" id="continue-match-result" ${resolved ? "" : "hidden disabled"}>Torna alla mappa</button></footer>
    </div>`, { closeable: false, className: "five-simulation-modal", preserveScroll: scrollSnapshot() });
    document.getElementById("skip-match-result")?.addEventListener("click", skipMatchToResult);
    document.getElementById("continue-match-result")?.addEventListener("click", continueAfterMatch);
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

  function matchTransactionIdentity(match) {
    return { runId: String(run?.runId || ""), matchId: String(match?.matchId || ""), type: String(match?.type || "") };
  }

  function canonicalMatchFor(current, identity) {
    const currentMatch = current?.activeMatch;
    if (!identity.runId || !identity.matchId || !identity.type
      || String(current?.runId || "") !== identity.runId
      || String(currentMatch?.matchId || "") !== identity.matchId
      || String(currentMatch?.type || "") !== identity.type) {
      throw Object.assign(new Error("Canonical match identity mismatch"), { code: "match-identity-mismatch" });
    }
    return currentMatch;
  }

  function cloneMatchState(match) {
    return typeof structuredClone === "function" ? structuredClone(match) : JSON.parse(JSON.stringify(match));
  }

  function commitMatchMutation(label, identity, mutate, options = {}) {
    return persistGameplayMutation({
      label,
      mutate: (current) => mutate(canonicalMatchFor(current, identity), current),
      onCommitted: (value, current) => {
        ui.match = current.activeMatch;
        ui.bossMatchState = ui.match?.state || "pre-match";
        ui.bossMatchLog = ui.match?.log || [];
        options.onCommitted?.(value, current);
      },
      onMutationError: ({ error }) => {
        recordGameplayFailure(label, "mutation", error, "mutation");
        if (error?.code !== "match-identity-mismatch") console.error(`${label} mutation failed`, error);
      },
      rerender: ({ ok, run: recovered }) => {
        if (!ok) {
          ui.match = recovered?.activeMatch || null;
          ui.bossMatchState = ui.match?.state || "pre-match";
          ui.bossMatchLog = ui.match?.log || [];
        }
      },
    });
  }

  function stopMatchAfterPersistenceFailure() {
    clearMatchPlaybackTimer();
    ui.match = run?.activeMatch || null;
    ui.bossMatchState = ui.match?.state || "pre-match";
    ui.bossMatchLog = ui.match?.log || [];
    ui.matchStartLocked = false;
    ui.bossMatchResolving = false;
    updateMatchScoreDom(ui.match, ui.match?.simulation?.state === "completed");
    updateMatchControlsDom();
    return { ok: false, suspended: true };
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
    const special = match.type === "special_match" ? specialMatchById(match.specialMatchId) : null;
    const boss = special || options.boss || seasonDb.bossOrder[run.bossIndex];
    const meta = special ? { user: { name: normalizeTeamIdentity(run.teamIdentity).name, formation: run.formationId }, boss: { name: special.teamName, formation: special.matchFormation } } : bossMatchTeamMeta(boss);
    const userPlayers = userTeamPlayers().map(normalizedMatchPlayer).filter(Boolean);
    const opponentPlayers = (special ? specialMatchTeamPlayers(special) : bossTeamPlayers(boss)).map(normalizedMatchPlayer).filter(Boolean);
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
    // A pre-match preview is deliberately disposable: it is generated with the
    // shared `:preview` seed.  Freezing starts the real, attempt-specific match,
    // so it must never take this shortcut even when the lineup is unchanged.
    if (!options.freeze && match.simulation?.valid && existingState === "pre-match" && !options.forceRefresh && match.simulation.userSnapshot?.lineupSignature === teams.userSnapshot.lineupSignature) return match.simulation;
    const seed = options.freeze ? matchSeed(match) : (match.simulation?.seed || `${run.runId}:${match.type}:${match.nodeId}:preview`);
    const preview = global.MatchSimulator.simulate({ type: teams.type, seed, userTeam: teams.userTeam, opponentTeam: teams.opponentTeam, consecutiveLosses: run.consecutiveLosses });
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

  function syncCommittedFinalMatchLog() {
    const canonicalLog = ui.match?.log || ui.bossMatchLog || [];
    const event = canonicalLog[canonicalLog.length - 1];
    if (event?.minute !== "FT") return false;
    const last = document.querySelector(".match-sim-log li:last-child");
    if (last?.querySelector("span")?.textContent === event.minute && last?.querySelector("p")?.textContent === event.text) return true;
    return appendMatchLogEvent(event);
  }

  function updateMatchScoreDom(match, completed = false) {
    const score = simulationScoreArray(match, completed);
    const values = document.querySelectorAll(".boss-match-score span");
    if (values[0]) values[0].textContent = score[0];
    if (values[1]) values[1].textContent = score[1];
  }

  function updateMatchControlsDom() {
    const state = ui.bossMatchState;
    const completed = ui.match?.simulation?.state === "completed" || state.startsWith("completed");
    const resolutionApplied = ui.match?.simulation?.resolutionApplied === true;
    const resolved = completed && resolutionApplied;
    const unresolved = completed && !resolutionApplied;
    const simulating = state === "simulating";
    const simulate = document.getElementById("simulate-boss-match");
    const skip = document.getElementById("skip-match-result");
    const cont = document.getElementById("continue-match-result");
    const editFive = document.getElementById("edit-five-team");
    const status = document.querySelector(".boss-match-result-panel p");
    const simulationModal = document.querySelector("[data-five-simulation-modal]");
    const simulationState = simulationModal?.querySelector(".five-simulation-state");
    const simulationBadge = simulationModal?.querySelector(".match-state-badge");
    if (simulate) {
      simulate.disabled = Boolean(ui.matchStartLocked) || simulating || completed;
      simulate.textContent = ui.matchStartLocked ? "Avvio..." : simulating ? "Simulazione..." : completed ? "Risultato definitivo" : "Simula partita";
    }
    if (editFive) {
      const activeFiveMatch = ui.match?.type === "five_v_five" ? ui.match : null;
      const canEditFiveMatch = activeFiveMatch?.state === "pre-match"
        && ui.bossMatchState === "pre-match"
        && (!activeFiveMatch.simulation || activeFiveMatch.simulation.state === "pre-match");
      editFive.disabled = !canEditFiveMatch;
    }
    if (skip) {
      skip.hidden = !simulating;
      skip.disabled = !simulating;
    }
    if (cont) {
      cont.dataset.resolvedLabel ||= cont.textContent;
      cont.hidden = !completed;
      cont.disabled = !completed || (resolved && Boolean(ui.match?.postMatchNavigationApplied));
      cont.textContent = unresolved ? "Riprova finalizzazione" : cont.dataset.resolvedLabel;
    }
    if (status) status.textContent = bossMatchStatusText();
    if (simulationModal) { simulationModal.dataset.matchState = state; simulationModal.dataset.resolutionApplied = String(resolutionApplied); }
    if (simulationState) simulationState.textContent = completed ? (state.endsWith("victory") ? "Vittoria" : "Sconfitta") : simulating ? "In corso" : "Pronta";
    if (simulationBadge) simulationBadge.textContent = simulating ? "Live" : completed ? "Completa" : "In attesa";
  }

  function stepMatchPlayback() {
    ui.matchPlaybackTimer = null;
    const match = run?.activeMatch;
    const sim = match?.simulation;
    if (!sim || sim.state !== "simulating" || sim.manuallyResolved) return;
    const identity = matchTransactionIdentity(match);
    if (sim.revealedCount >= sim.timeline.length) {
      const completed = commitMatchMutation("match-playback-completed", identity, (currentMatch) => {
        const currentSim = currentMatch.simulation;
        if (currentSim?.state !== "simulating" || currentSim.revealedCount < currentSim.timeline.length) throw new Error("Match is not ready for completion");
        currentSim.state = "completed";
        currentSim.displayedScore = { ...currentSim.score };
        currentMatch.score = [currentSim.score.user, currentSim.score.opponent];
        currentMatch.state = currentSim.winner === "user" ? "completed-victory" : "completed-defeat";
      });
      if (!completed.ok) return stopMatchAfterPersistenceFailure();
      updateMatchScoreDom(ui.match, true);
      updateMatchControlsDom();
      return applySimulationResolution(ui.match);
    }
    const committed = commitMatchMutation("match-playback-event", identity, (currentMatch) => {
      const currentSim = currentMatch.simulation;
      if (currentSim?.state !== "simulating" || currentSim.revealedCount >= currentSim.timeline.length) throw new Error("Match playback cursor changed");
      const event = currentSim.timeline[currentSim.revealedCount];
      currentSim.revealedCount += 1;
      if (event.type === "goal") currentSim.displayedScore[event.team] += 1;
      currentMatch.score = [currentSim.displayedScore.user, currentSim.displayedScore.opponent];
      const view = matchEventView(event);
      currentMatch.log = [...(currentMatch.log || []), view];
      return view;
    });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    appendMatchLogEvent(committed.value);
    updateMatchScoreDom(ui.match);
    updateMatchControlsDom();
    document.getElementById(ui.match.type === "five_v_five" ? "five-match-log-panel" : "")?.scrollIntoView({ block: "nearest" });
    ui.matchPlaybackTimer = setTimeout(stepMatchPlayback, global.MatchSimulatorConfig.eventDelayMs || global.MatchSimulatorConfig.playbackMs);
  }

  function startMatchSimulation(match, options = {}) {
    if (ui.matchStartLocked || match?.simulation?.state === "simulating") return;
    if (match.simulation?.state && match.simulation.state !== "pre-match") return;
    ui.matchStartLocked = true;
    updateMatchControlsDom();
    let frozenMatch;
    try {
      frozenMatch = cloneMatchState(match);
      const sim = ensureMatchPreview(frozenMatch, { ...options, forceRefresh: false, freeze: true });
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
    const sim = frozenMatch.simulation;
    sim.seed = sim.seed || matchSeed(frozenMatch);
    sim.state = "simulating";
    sim.revealedCount = 0;
    sim.displayedScore = { user: 0, opponent: 0 };
    sim.resolutionApplied = false;
    frozenMatch.state = "simulating";
    frozenMatch.log = [];
    frozenMatch.score = [0, 0];
    const identity = matchTransactionIdentity(match);
    const committed = commitMatchMutation("match-simulation-start", identity, (currentMatch) => {
      Object.keys(currentMatch).forEach((key) => { delete currentMatch[key]; });
      Object.assign(currentMatch, cloneMatchState(frozenMatch));
    });
    if (!committed.ok) {
      clearMatchPlaybackTimer();
      ui.matchStartLocked = false;
      updateMatchControlsDom();
      return stopMatchAfterPersistenceFailure();
    }
    clearMatchPlaybackTimer();
    ui.matchStartLocked = false;
    updateMatchControlsDom();
    document.getElementById(match.type === "five_v_five" ? "five-match-log-panel" : "")?.scrollIntoView({ block: "nearest" });
    ui.matchPlaybackTimer = setTimeout(stepMatchPlayback, global.MatchSimulatorConfig.eventDelayMs || global.MatchSimulatorConfig.playbackMs);
  }

  function resumeMatchSimulationIfNeeded(match) {
    const sim = match?.simulation;
    if (!sim) return;
    if (sim.state === "completed" && sim.resolutionApplied !== true) {
      clearMatchPlaybackTimer();
      return applySimulationResolution(run?.activeMatch);
    }
    if (sim.state !== "simulating") return;
    clearMatchPlaybackTimer();
    ui.matchPlaybackTimer = setTimeout(stepMatchPlayback, global.MatchSimulatorConfig.eventDelayMs || global.MatchSimulatorConfig.playbackMs);
  }

  function skipMatchToResult(event) {
    event?.preventDefault();
    const match = run?.activeMatch;
    const sim = match?.simulation;
    if (!sim || sim.state !== "simulating" || sim.manuallyResolved) return;
    clearMatchPlaybackTimer();
    const missing = sim.timeline.slice(sim.revealedCount).map(matchEventView);
    const identity = matchTransactionIdentity(match);
    const committed = commitMatchMutation("match-playback-skip", identity, (currentMatch) => {
      const currentSim = currentMatch.simulation;
      if (currentSim?.state !== "simulating") throw new Error("Match is not simulating");
      currentSim.revealedCount = currentSim.timeline.length;
      currentSim.displayedScore = { ...currentSim.score };
      currentSim.state = "completed";
      currentMatch.score = [currentSim.score.user, currentSim.score.opponent];
      currentMatch.state = currentSim.winner === "user" ? "completed-victory" : "completed-defeat";
      currentMatch.log = currentSim.timeline.map(matchEventView);
    });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    appendMissingMatchLogEvents(missing);
    updateMatchScoreDom(ui.match, true);
    updateMatchControlsDom();
    document.getElementById(ui.match.type === "five_v_five" ? "five-match-result-panel" : "")?.scrollIntoView({ block: "nearest" });
    applySimulationResolution(ui.match);
  }

  function applySimulationResolution(match) {
    const sim = match?.simulation;
    if (!sim || sim.resolutionApplied || sim.manuallyResolved) return;
    return sim.winner === "user" ? (match.type === "five_v_five" ? completeFiveMatch("victory") : match.type === "special_match" ? completeSpecialMatch("victory") : completeBossMatch("victory")) : (match.type === "five_v_five" ? completeFiveMatch("defeat") : match.type === "special_match" ? completeSpecialMatch("defeat") : completeBossMatch("defeat"));
  }

  function forceMatchOutcome(result, options = {}) {
    const match = run?.activeMatch;
    if (!match || ui.matchStartLocked || match.simulation?.resolutionApplied) return;
    ui.matchStartLocked = true;
    updateMatchControlsDom();
    try {
      clearMatchPlaybackTimer();
      const frozenMatch = cloneMatchState(match);
      const sim = ensureMatchPreview(frozenMatch, { ...options, forceRefresh: !frozenMatch.simulation?.valid, freeze: true });
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
      frozenMatch.score = [sim.score.user, sim.score.opponent];
      frozenMatch.forcedOutcome = sim.forcedOutcome;
      frozenMatch.testControl = true;
      frozenMatch.log = visibleTimeline(frozenMatch);
      frozenMatch.state = winner === "user" ? "completed-victory" : "completed-defeat";
      const identity = matchTransactionIdentity(match);
      const committed = commitMatchMutation("match-forced-outcome", identity, (currentMatch) => {
        Object.keys(currentMatch).forEach((key) => { delete currentMatch[key]; });
        Object.assign(currentMatch, cloneMatchState(frozenMatch));
      });
      if (!committed.ok) return stopMatchAfterPersistenceFailure();
      appendMissingMatchLogEvents(ui.bossMatchLog);
      updateMatchScoreDom(ui.match, true);
      updateMatchControlsDom();
      return applySimulationResolution(ui.match);
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
      slots: formation.slots.filter((slot) => slot.line === line).map((slot) => ({ ...slot, player: playersBySlot[slot.key] || null })),
    })).filter((row) => row.slots.length);
  }

  function fiveUserPlayersBySlot() {
    ensureFiveVFive();
    return Object.fromEntries(Object.entries(run.fiveVFive.slots).map(([slot, id]) => [slot, resolvedRosterPlayer(id)]));
  }

  function fiveOpponentLevel() {
    return Math.max(0, Math.floor(Number(run.teamLevel || 0)));
  }

  function createOrLoadFiveMatch(node, activeRun = run) {
    if (activeRun.activeMatch?.type === "five_v_five" && activeRun.activeMatch.nodeId === node.id && activeRun.activeMatch.opponents?.length === 5) return activeRun.activeMatch;
    const opponentRandom = global.DraftEngine.randomFromSeed(`${activeRun.runId}:${node.id}:fiveOpponents`);
    const formation = opponentRandom() < 0.5 ? "1-2-1" : "1-1-2";
    const slots = global.FiveVFive.formationById(formation).slots;
    const userIds = new Set((activeRun.roster || []).map((entry) => String(entry.playerId)));
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
    const attempts = Object.keys(activeRun.statistics?.processedMatchIds || {}).filter((id) => id.includes(`::${node.id}::five_v_five::`)).length + 1;
    const match = {
      nodeId: node.id,
      previousNodeId: activeRun.currentZone?.currentNodeId || activeRun.activeMatch?.previousNodeId || null,
      type: "five_v_five",
      state: "pre-match",
      result: null,
      level: Math.max(0, Math.floor(Number(activeRun.teamLevel || 0))),
      opponentFormation: formation,
      opponents,
      log: [],
      score: [0, 0],
      attemptNumber: attempts,
    };
    match.matchId = global.RunStatistics?.createStableMatchId?.(activeRun, match) || null;
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

  function fiveMatchCard(player, side, slot) {
    if (!player) return `<button type="button" class="five-match-card five-match-card--${side} five-match-card--empty" data-five-match-slot="${escapeHtml(slot.key)}" data-five-match-side="${side}" aria-label="Riempi slot ${escapeHtml(slot.key)}, ruolo ${escapeHtml(slot.role)}"><span class="five-match-card-empty-mark" aria-hidden="true">+</span><strong>Slot ${escapeHtml(slot.key)}</strong><span class="five-match-card-role">${escapeHtml(slot.role)}</span></button>`;
    const role = player.position || player.normalizedRole || "-";
    const key = fiveMatchCacheKey("half-card", side, slot.key, player.playerId, player.name, role, player.category, playerPortraitUrl(player));
    const label = side === "user" ? `Cambia ${player.name}, slot ${slot.key}` : `Dettagli rapidi di ${player.name}`;
    return memoizedFiveMatchMarkup(key, () => `<button type="button" class="five-match-card five-match-card--${side} ${rarityClass(player.category)}" data-five-match-player="${escapeHtml(player.playerId)}" data-five-match-slot="${escapeHtml(slot.key)}" data-five-match-side="${side}" aria-pressed="false" aria-label="${escapeHtml(label)}">
      <span class="five-match-card-portrait"><img src="${escapeHtml(playerPortraitUrl(player))}" alt="" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} /></span>
      <strong title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>
      <span class="five-match-card-role" aria-label="Ruolo ${escapeHtml(role)}">${escapeHtml(role)}</span>
    </button>`);
  }

  function fiveMatchPlayerDetail(player, side) {
    if (!player) return "";
    const stats = player.stats || player.finalStats || {};
    const essentials = player.position === "GK"
      ? [["Parata", stats.save], ["Difesa", stats.defense], ["Grinta", stats.grit], ["Controllo", stats.control]]
      : [["Attacco", stats.attack], ["Controllo", stats.control], ["Difesa", stats.defense], ["Velocità", stats.speed]];
    return `<div class="five-match-player-detail-copy ${rarityClass(player.category)}">
      <div class="five-match-detail-head">
        <div class="five-match-detail-identity"><small>${side === "user" ? "Tua squadra" : "Avversario"}</small><strong>${escapeHtml(player.name)}</strong></div>
        <b class="five-match-detail-role">${escapeHtml(player.position || player.normalizedRole || "-")}</b>
        <button type="button" class="five-match-detail-close" data-five-detail-close aria-label="Chiudi dettaglio">×</button>
      </div>
      <div class="five-match-detail-scout">
        <span class="five-match-detail-portrait"><img src="${escapeHtml(playerPortraitUrl(player))}" alt="" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} /></span>
        <div class="five-match-detail-meta"><span><small>Livello</small><strong>LV ${escapeHtml(player.displayLevelText ?? player.displayLevel ?? 0)}</strong></span><span class="five-match-detail-overall"><small>OVR</small><strong>${escapeHtml(player.overall ?? player.finalOverall ?? "-")}</strong></span><span><small>Rarità</small><strong>${escapeHtml(player.category || "-")}</strong></span><span><small>Elemento / tipo</small><strong>${escapeHtml(player.element || player.type || "-")}</strong></span></div>
      </div>
      <div class="five-match-detail-stats" aria-label="Statistiche chiave">${essentials.map(([label, value]) => `<span><small>${label}</small><strong>${escapeHtml(value ?? "-")}</strong></span>`).join("")}</div>
      <button type="button" class="five-match-detail-sheet" data-five-detail-sheet="${escapeHtml(player.playerId)}" data-five-detail-side="${side}">Scheda completa</button>
    </div>`;
  }

  function fiveMatchField(playersBySlot, formationId, side, mobile = false) {
    const slotKey = Object.entries(playersBySlot || {}).map(([slot, player]) => `${slot}:${player?.playerId || ""}:${player?.overall || ""}:${player?.displayLevel || ""}`).join(",");
    const key = fiveMatchCacheKey("field", formationId, side, mobile ? "mobile" : "desktop", slotKey);
    return memoizedFiveMatchMarkup(key, () => `<div class="five-match-field-side five-match-field-side--${side} ${mobile ? "five-match-field-side--mobile" : ""}" data-five-field-side="${side}" ${mobile ? "" : ""}>
      ${fiveFormationRows(formationId, playersBySlot).map((row) => `<div class="five-match-line five-match-line--${row.line}" data-row-count="${row.slots.length}" style="--five-row-count:${row.slots.length || 1}">${row.slots.map((slot) => fiveMatchCard(slot.player, side, slot)).join("")}</div>`).join("")}
    </div>`);
  }

  function openFiveMatchPlayerSwap(slotKey, match) {
    const editable = match?.state === "pre-match" && ui.bossMatchState === "pre-match" && (!match.simulation || match.simulation.state === "pre-match");
    const slot = global.FiveVFive.formationById(run.fiveVFive?.formation).slots.find((item) => item.key === slotKey);
    if (!editable || !slot) return false;
    const pageScroll = scrollSnapshot();
    const field = document.querySelector(".five-match-mobile-field");
    if (!field) return false;
    field.querySelector(".five-selector")?.remove();
    field.insertAdjacentHTML("beforeend", renderFivePlayerPicker({ selectedSlot: slotKey, selectedRole: slot.role }));
    const picker = field.querySelector(".five-selector");
    const closePicker = () => global.FiveFormationFloatingPicker?.close(picker);
    global.FiveFormationFloatingPicker?.prepare(picker, { onClose: () => restorePageScroll(pageScroll) });
    picker?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-five-player]");
      if (!button || !picker.contains(button) || button.disabled) return;
      const liveMatch = run?.activeMatch;
      if (!(liveMatch?.type === "five_v_five" && liveMatch.state === "pre-match" && ui.bossMatchState === "pre-match" && (!liveMatch.simulation || liveMatch.simulation.state === "pre-match"))) return;
      const playerId = button.dataset.fivePlayer;
      button.disabled = true;
      const committed = commitFiveEditorMutation("five-match-quick-swap", (current) => {
        const currentMatch = current.activeMatch;
        if (!(currentMatch?.type === "five_v_five" && currentMatch.state === "pre-match" && (!currentMatch.simulation || currentMatch.simulation.state === "pre-match"))) {
          throw new Error("La formazione 5v5 non è più modificabile");
        }
        return global.FiveVFive.assign(current, slotKey, playerId, (id) => fiveRoleForPlayerId(id, current));
      }, {
        onCommitted: (_value, current) => {
          ui.match = current.activeMatch;
          ui.bossMatchState = current.activeMatch?.state || "pre-match";
          ui.bossMatchLog = current.activeMatch?.log || [];
          closePicker();
          renderMatch();
          afterNextPaint(() => { restorePageScroll(pageScroll); document.querySelector(`[data-five-match-side="user"][data-five-match-slot="${cssEscape(slotKey)}"]`)?.focus?.({ preventScroll: true }); });
        },
      });
      if (!committed.ok) return;
    });
    return true;
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

  function fiveMatchComparisonMarkup(userPlayers, opponentPlayers, summary = {}) {
    const rows = [
      ["Attacco", ["attack"], ["attack"]],
      ["Controllo", ["control"], ["control"]],
      ["Difesa", ["defense", "grit"], ["defense", "grit"]],
      ["Velocità", ["speed"], ["speed"]],
      ["Portiere", ["save"], ["save"]],
    ];
    const opponentName = summary.opponentName || "Svincolati";
    const contentId = summary.contentId || "five-match-values-content";
    const value = (key) => summary[key] ?? "-";
    return `<section class="five-match-values" data-values-panel>
      <button type="button" class="five-match-values-button" aria-expanded="false" aria-controls="${escapeHtml(contentId)}">
        <span class="five-match-value"><small>Forza</small><strong>${escapeHtml(value("userStrength"))}</strong></span>
        <span class="five-match-value five-match-value--accent"><small>Probabilità</small><strong>${escapeHtml(value("probability"))}%</strong></span>
        <span class="five-match-value"><small>Confronto</small><strong>${escapeHtml(value("userStrength"))}–${escapeHtml(value("opponentStrength"))}</strong></span>
        <span class="five-match-value"><small>Statistiche</small><strong>Dettagli</strong></span>
        <span class="five-match-values-toggle" aria-label="Apri statistiche" aria-hidden="true">+</span>
      </button>
      <div class="five-match-values-content" id="${escapeHtml(contentId)}" hidden>
        <div class="five-match-core-values">
          <div><span>La tua forza</span><strong>${escapeHtml(value("userStrength"))}</strong><small>${escapeHtml(value("userFormation"))} · OVR ${escapeHtml(value("userOverall"))}</small></div>
          <div class="five-match-probability"><span>Probabilità vittoria</span><strong>${escapeHtml(value("probability"))}%</strong><small>Dato usato dalla simulazione</small></div>
          <div><span>Forza ${escapeHtml(opponentName)}</span><strong>${escapeHtml(value("opponentStrength"))}</strong><small>${escapeHtml(value("opponentFormation"))} · OVR ${escapeHtml(value("opponentOverall"))}</small></div>
        </div>
        <div class="five-match-traits" aria-label="Valori tecnici, Tu e ${escapeHtml(opponentName)}">${rows.map(([label, userStats, opponentStats]) => {
        const userValue = fiveMatchStatAverage(userPlayers, userStats);
        const opponentValue = fiveMatchStatAverage(opponentPlayers, opponentStats);
        return `<div class="five-match-trait"><span>${escapeHtml(label)}</span><strong>${escapeHtml(userValue)}</strong><small>${escapeHtml(opponentValue)}</small></div>`;
      }).join("")}</div>
      </div>
    </section>`;
  }

  function formatMatchProbability(value) {
    const chance = Number(value);
    if (!Number.isFinite(chance)) return "-";
    return Number(chance.toFixed(1)).toLocaleString("it-IT", { maximumFractionDigits: 1 });
  }

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

  function renderMatch(options = {}) {
    const legacyRecovery = recoverLegacyResolvedMatchRoutingIfNeeded(run?.activeMatch);
    const allowAutomaticResume = options.allowAutomaticResume !== false && legacyRecovery.ok;
    ui.match = run?.activeMatch || ui.match;
    // Legacy boss resume identity: const boss = seasonDb.bossOrder[Number(ui.match?.bossIndex ?? run.bossIndex)];
    const isSpecial = ui.match?.type === "special_match";
    const boss = isSpecial ? specialMatchById(ui.match.specialMatchId) : seasonDb.bossOrder[Number(ui.match?.bossIndex ?? run.bossIndex)];
    const isBoss = ui.match?.type === "boss";
    if (!isBoss && !isSpecial) {
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
      const opponentTeamId = match.opponentTeamId || null;
      const opponentTeam = opponentTeamId ? teamById(opponentTeamId) : null;
      const opponentName = opponentTeam?.teamName || opponentTeam?.name || "Svincolati";
      const userEmblem = global.TeamEmblems.resolveTeamEmblem({ teamIdentity: identity, seasonId: run.seasonId, fallbackKind: "user" });
      const opponentEmblem = global.TeamEmblems.resolveTeamEmblem(opponentTeamId
        ? { teamId: opponentTeamId, team: opponentTeam, seasonId: run.seasonId, fallbackKind: "neutral" }
        : { specialType: "free-agents", fallbackKind: "free-agents" });
      const userEmblemMarkup = global.TeamEmblems.teamEmblemMarkup(userEmblem, { escape: escapeHtml, className: "five-match-emblem" });
      const opponentEmblemMarkup = global.TeamEmblems.teamEmblemMarkup(opponentEmblem, { escape: escapeHtml, className: "five-match-emblem" });
      const simPreview = ensureMatchPreview(match);
      const userFivePlayers = Object.values(userPlayersBySlot).filter(Boolean);
      const opponentFivePlayers = Object.values(opponentPlayersBySlot).filter(Boolean);
      const userAverageOverall = simPreview.userStrength?.averageOverall ? Math.round(simPreview.userStrength.averageOverall) : bossMatchAverage(userFivePlayers) || "-";
      const opponentAverageOverall = simPreview.opponentStrength?.averageOverall ? Math.round(simPreview.opponentStrength.averageOverall) : bossMatchAverage(opponentFivePlayers) || "-";
      const simError = !simPreview.valid ? simPreview.message : "";
      ui.bossMatchLog = match.log?.length ? match.log : visibleTimeline(match);
      const activeSide = ui.fiveMatchTab === "opponent" ? "opponent" : "user";
      const resolved = ui.bossMatchState.startsWith("completed");
      const simulating = ui.bossMatchState === "simulating";
      const canEditFiveMatch = match.state === "pre-match"
        && ui.bossMatchState === "pre-match"
        && (!match.simulation || match.simulation.state === "pre-match");
      app.innerHTML = `
        <main class="screen five-match-screen" data-match-state="${escapeHtml(ui.bossMatchState)}">
          ${topbar("Partita 5v5", "", "match")}
          <div class="content five-match-content">
            <section class="five-match-hero">
              <div class="five-match-hero-band">
                <div class="five-match-header-main"><p class="eyebrow">Match rapido</p><h1>Partita 5v5</h1><strong>${resolved ? "Completata" : simulating ? "In corso" : "Preparazione"}</strong></div>
                <span class="five-match-duration">30 <small>minuti</small></span>
              </div>
              <div class="five-match-vs">
                <div class="five-match-team"><strong>${escapeHtml(userName)}</strong><span class="five-match-logo">${userEmblemMarkup}</span><small>${escapeHtml(run.fiveVFive.formation)} · OVR ${escapeHtml(userAverageOverall)} · Forza ${escapeHtml(simPreview.userStrength?.final ?? "-")}</small></div>
                <span class="five-match-vs-badge">VS</span>
                <div class="five-match-team"><strong>${escapeHtml(opponentName)}</strong><span class="five-match-logo">${opponentEmblemMarkup}</span><small>${escapeHtml(match.opponentFormation)} · OVR ${escapeHtml(opponentAverageOverall)} · Forza ${escapeHtml(simPreview.opponentStrength?.final ?? "-")}</small></div>
              </div>
            </section>
            <section class="five-match-pitch-panel">
              <div class="five-match-section-head">
                <h2>Campo tattico</h2>
                <div class="five-match-tabs" role="tablist" aria-label="Squadra visualizzata">
                  <button type="button" class="five-match-team-tab ${activeSide === "user" ? "active" : ""}" data-five-match-tab="user">Tua squadra</button>
                  <button type="button" class="five-match-team-tab ${activeSide === "opponent" ? "active" : ""}" data-five-match-tab="opponent">Avversario</button>
                </div>
                <span class="five-match-formation-badge">${escapeHtml(activeSide === "opponent" ? match.opponentFormation : run.fiveVFive.formation)}</span>
              </div>
              <div class="five-match-field" aria-label="Campo partita 5v5">
                <div class="five-match-mobile-field">${fiveMatchField(activeSide === "opponent" ? opponentPlayersBySlot : userPlayersBySlot, activeSide === "opponent" ? match.opponentFormation : run.fiveVFive.formation, activeSide, true)}</div>
                <aside class="five-match-player-detail" data-five-player-detail hidden aria-live="polite"></aside>
              </div>
            </section>
            <section class="five-match-summary" aria-label="Riepilogo partita 5v5">
              ${fiveMatchComparisonMarkup(userFivePlayers, opponentFivePlayers, { userStrength: simPreview.userStrength?.final ?? "-", userFormation: run.fiveVFive.formation, userOverall: userAverageOverall, probability: formatMatchProbability(simPreview.probabilities?.userChance), opponentStrength: simPreview.opponentStrength?.final ?? "-", opponentFormation: match.opponentFormation, opponentOverall: opponentAverageOverall })}
            </section>
            ${simError ? `<div class="match-sim-error">${escapeHtml(simError)}</div>` : ""}
          </div>
          <section class="panel five-match-controls five-v-five-mobile-actions" aria-label="Azioni partita 5v5">
            <header class="five-match-actions-heading"><span>Azioni partita</span><i aria-hidden="true"></i></header>
            <div class="five-match-primary-actions">
              <button type="button" class="btn five-match-action-cta five-match-action-cta--primary" id="simulate-boss-match" ${simulating || resolved ? "disabled" : ""}>
                <span class="five-match-action-icon" aria-hidden="true"><i class="five-match-play-icon"></i></span>
                <span class="five-match-action-copy"><strong>Simula partita</strong><small>Avvia la simulazione</small></span>
                <span class="five-match-action-mark" aria-hidden="true">›</span>
              </button>
              <button type="button" class="btn five-match-action-cta five-match-action-cta--secondary" id="edit-five-team" ${canEditFiveMatch ? "" : "disabled"}>
                <span class="five-match-action-icon" aria-hidden="true"><i class="five-match-tactics-icon">×</i></span>
                <span class="five-match-action-copy"><strong>Modifica squadra</strong><small>Gestisci titolari</small></span>
                <span class="five-match-action-mark" aria-hidden="true">›</span>
              </button>
            </div>
            ${TEST_MATCH_CONTROLS_ENABLED ? `<div class="match-test-tools"><span>Strumenti di test</span><div class="five-match-test-actions"><button type="button" class="btn btn-tool" id="test-win" ${resolved ? "disabled" : ""}>Vittoria sicura</button>${DEV_MODE ? `<button type="button" class="btn btn-danger" id="test-loss" ${resolved ? "disabled" : ""}>Sconfitta forzata</button>` : ""}</div></div>` : ""}
          </section>
        </main>`;
      resetRenderedViewScroll();
      bindSectionRootNav();
      bindBottomNav();
      document.querySelectorAll("[data-five-match-tab]").forEach((button) => button.addEventListener("click", () => {
        closeFiveMatchPlayerDetail();
        ui.fiveMatchTab = button.dataset.fiveMatchTab;
        document.querySelectorAll("[data-five-match-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.fiveMatchTab === ui.fiveMatchTab));
        const mobileField = document.querySelector(".five-match-mobile-field");
        if (mobileField) mobileField.innerHTML = ui.fiveMatchTab === "opponent"
          ? fiveMatchField(opponentPlayersBySlot, match.opponentFormation, "opponent", true)
          : fiveMatchField(userPlayersBySlot, run.fiveVFive.formation, "user", true);
        const formationBadge = document.querySelector(".five-match-formation-badge");
        if (formationBadge) formationBadge.textContent = ui.fiveMatchTab === "opponent" ? match.opponentFormation : run.fiveVFive.formation;
        bindFiveMatchPlayerButtons();
      }));
      const closeFiveMatchPlayerDetail = () => {
        const detail = document.querySelector("[data-five-player-detail]");
        if (detail) { detail.hidden = true; detail.innerHTML = ""; }
        document.querySelectorAll("[data-five-match-player]").forEach((card) => { card.classList.remove("is-active"); card.setAttribute("aria-pressed", "false"); });
      };
      const positionFiveMatchPlayerDetail = (button, detail) => {
        const field = detail.closest(".five-match-field");
        if (!field) return;
        const fieldRect = field.getBoundingClientRect();
        const cardRect = button.getBoundingClientRect();
        const panelWidth = detail.offsetWidth;
        const panelHeight = detail.offsetHeight;
        const gap = 10;
        const right = cardRect.right - fieldRect.left + gap;
        const left = cardRect.left - fieldRect.left - panelWidth - gap;
        const preferredLeft = right + panelWidth <= fieldRect.width - 6 ? right : left;
        const maxLeft = Math.max(6, fieldRect.width - panelWidth - 6);
        const top = Math.min(Math.max(6, cardRect.top - fieldRect.top + (cardRect.height - panelHeight) / 2), Math.max(6, fieldRect.height - panelHeight - 6));
        detail.style.setProperty("--five-detail-left", `${Math.min(Math.max(6, preferredLeft), maxLeft)}px`);
        detail.style.setProperty("--five-detail-top", `${top}px`);
        detail.dataset.placement = preferredLeft === right ? "right" : "left";
      };
      const bindFiveMatchPlayerButtons = () => document.querySelectorAll("[data-five-match-slot]").forEach((button) => {
        if (button.dataset.boundFiveMatchPlayer === "1") return;
        button.dataset.boundFiveMatchPlayer = "1";
        button.addEventListener("click", () => {
          const id = button.dataset.fiveMatchPlayer;
          const slotKey = button.dataset.fiveMatchSlot;
          const side = button.dataset.fiveMatchSide;
          if (side === "user" && openFiveMatchPlayerSwap(slotKey, match)) return;
          const players = side === "user" ? userPlayersBySlot : opponentPlayersBySlot;
          const player = Object.values(players).find((candidate) => String(candidate?.playerId) === String(id));
          const detail = document.querySelector("[data-five-player-detail]");
          if (!player || !detail) return;
          document.querySelectorAll("[data-five-match-player]").forEach((card) => { card.classList.toggle("is-active", card === button); card.setAttribute("aria-pressed", card === button ? "true" : "false"); });
          detail.innerHTML = fiveMatchPlayerDetail(player, side);
          detail.hidden = false;
          positionFiveMatchPlayerDetail(button, detail);
          detail.querySelector("[data-five-detail-close]")?.addEventListener("click", closeFiveMatchPlayerDetail);
          detail.querySelector("[data-five-detail-sheet]")?.addEventListener("click", () => side === "user"
            ? showPlayerDetails(id)
            : showPlayerDetailsFor(player, { playerId: id, level: player.displayLevel, database: freeAgentsDb, preserveScroll: scrollSnapshot() }));
        });
      });
      bindFiveMatchPlayerButtons();
      document.querySelector(".five-match-values-button")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        const content = document.getElementById(button.getAttribute("aria-controls"));
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", expanded ? "false" : "true");
        if (content) content.hidden = expanded;
      });
      document.getElementById("edit-five-team").addEventListener("click", (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        if (button.disabled) return;
        const activeMatch = run?.activeMatch;
        const editable = activeMatch?.type === "five_v_five"
          && activeMatch.state === "pre-match"
          && ui.bossMatchState === "pre-match"
          && (!activeMatch.simulation || activeMatch.simulation.state === "pre-match");
        if (!editable) { button.disabled = true; return; }
        button.disabled = true;
        const capturedScroll = scrollSnapshot();
        const identity = matchTransactionIdentity(activeMatch);
        const committed = commitMatchMutation("five-match-edit-entry", identity, (currentMatch, current) => {
          if (currentMatch.state !== "pre-match" || (currentMatch.simulation && currentMatch.simulation.state !== "pre-match")) {
            throw Object.assign(new Error("5v5 match is no longer editable"), { code: "five-match-edit-locked" });
          }
          currentMatch.returnScroll = capturedScroll;
          current.phase = "five";
          return { type: currentMatch.type, nodeId: currentMatch.nodeId, scroll: capturedScroll };
        });
        if (!committed.ok) return renderMapFailureRecovery();
        ui.returnToMatchContext = committed.value;
        return renderFiveVFive({ persist: false, returnToMatch: true });
      });
      document.getElementById("test-win")?.addEventListener("click", (event) => { event.preventDefault(); openFiveMatchSimulationModal(match, userName, opponentName); forceMatchOutcome("victory"); });
      document.getElementById("test-loss")?.addEventListener("click", (event) => { event.preventDefault(); openFiveMatchSimulationModal(match, userName, opponentName); forceMatchOutcome("defeat"); });
      document.getElementById("simulate-boss-match").addEventListener("click", (event) => { event.preventDefault(); openFiveMatchSimulationModal(match, userName, opponentName); startMatchSimulation(match); });
      if (simulating || resolved) openFiveMatchSimulationModal(match, userName, opponentName);
      if (allowAutomaticResume) resumeMatchSimulationIfNeeded(run?.activeMatch);
      return;
    }

    const userPlayers = userTeamPlayers();
    const bossPlayers = isSpecial ? specialMatchTeamPlayers(boss) : bossTeamPlayers(boss);
    const meta = isSpecial ? { user: { name: normalizeTeamIdentity(run.teamIdentity).name, logoUrl: "", formation: run.formationId, level: run.teamLevel }, boss: { name: boss.teamName, logoUrl: boss.logoUrl, formation: boss.matchFormation, level: boss.matchLevel } } : bossMatchTeamMeta(boss);
    const userAverage = bossMatchAverage(userPlayers);
    const bossAverage = bossMatchAverage(bossPlayers);
    const userEmblem = global.TeamEmblems.resolveTeamEmblem({ teamIdentity: normalizeTeamIdentity(run.teamIdentity), seasonId: run.seasonId, fallbackKind: "user" });
    const userEmblemMarkup = global.TeamEmblems.teamEmblemMarkup(userEmblem, { escape: escapeHtml, className: "boss-match-emblem" });
    const activeSide = ui.bossMatchTab === "boss" ? "boss" : "user";
    const resolved = ui.bossMatchState.startsWith("completed");
    const simulating = ui.bossMatchState === "simulating";
    const simPreview = ensureMatchPreview(ui.match, { boss });
    const simError = !simPreview.valid ? simPreview.message : "";
    const userProbability = simPreview.probabilities ? formatMatchProbability(simPreview.probabilities.userChance) : null;
    const bossProbability = simPreview.probabilities ? formatMatchProbability(simPreview.probabilities.opponentChance) : null;
    ui.bossMatchLog = ui.match.log?.length ? ui.match.log : visibleTimeline(ui.match);
    const score = simulationScoreArray(ui.match, resolved);
    const scoreLabel = `${meta.user.name} ${score[0]} - ${score[1]} ${meta.boss.name}`;
    const bossStatusLabel = resolved ? (ui.bossMatchState.endsWith("victory") ? "Vittoria" : "Sconfitta") : simulating ? "In corso" : "Preparazione";
    const outcomeClass = resolved ? (ui.bossMatchState.endsWith("victory") ? "boss-match-result-panel--victory" : "boss-match-result-panel--defeat") : "";

    app.innerHTML = `
      <main class="screen boss-match-screen" data-match-state="${ui.bossMatchState}">
        ${topbar(isSpecial ? "Partita speciale" : "Sfida Boss", "", "match")}
        <div class="content boss-match-content">
          <section class="boss-match-hero panel">
            <div class="boss-match-hero-band">
              <div class="boss-match-heading"><p class="eyebrow">Match 11v11</p><h2>${isSpecial ? "Partita speciale" : "Sfida Boss"}</h2></div>
              <span class="boss-match-duration">90 <small>minuti</small></span>
            </div>
            <div class="boss-match-vs" aria-label="Presentazione squadre">
              <div class="boss-match-team"><span class="boss-match-logo">${userEmblemMarkup}</span><strong>${escapeHtml(meta.user.name)}</strong></div>
              <span class="boss-match-vs-badge">VS</span>
              <div class="boss-match-team boss-match-team--boss"><span class="boss-match-logo">${meta.boss.logoUrl ? `<img src="${escapeHtml(meta.boss.logoUrl)}" alt="Stemma ${escapeHtml(meta.boss.name)}" />` : ""}</span><strong>${escapeHtml(meta.boss.name)}</strong><small>${isSpecial ? "Livello" : "Boss Lv"} ${escapeHtml(meta.boss.level)}</small></div>
            </div>
          </section>

          <section class="panel boss-match-pitch-panel" aria-label="Formazioni 11v11">
            <div class="boss-match-section-head">
              <div><p class="eyebrow">Formazioni 11v11</p><h3>Campo tattico</h3></div>
              <span>11 CONTRO 11</span>
            </div>
            <div class="boss-match-tabs" role="tablist" aria-label="Squadra visualizzata">
              <button type="button" class="boss-match-team-tab ${activeSide === "user" ? "active" : ""}" role="tab" aria-selected="${activeSide === "user"}" data-boss-tab="user">La tua squadra</button>
              <button type="button" class="boss-match-team-tab ${activeSide === "boss" ? "active" : ""}" role="tab" aria-selected="${activeSide === "boss"}" data-boss-tab="boss">${isSpecial ? "Avversari" : "Boss"}</button>
            </div>
            <div class="boss-match-field" aria-label="Campo boss match" data-active-boss-side="${escapeHtml(activeSide)}">
              <div class="boss-match-half-label boss-match-half-label--active">${escapeHtml(activeSide === "boss" ? meta.boss.name : meta.user.name)}</div>
              ${bossMatchField({ players: userPlayers, formationId: run.formationId }, "user", false, activeSide !== "user")}
              ${bossMatchField({ players: bossPlayers, formationId: isSpecial ? boss.matchFormation : boss.bossFormation }, "boss", false, activeSide !== "boss")}
              <div class="boss-match-mobile-field">
                ${bossMatchField({ players: userPlayers, formationId: run.formationId }, "user", true, activeSide !== "user")}
                ${bossMatchField({ players: bossPlayers, formationId: isSpecial ? boss.matchFormation : boss.bossFormation }, "boss", true, activeSide !== "boss")}
              </div>
            </div>
          </section>

          <section class="boss-match-summary" aria-label="${isSpecial ? "Riepilogo essenziale della partita speciale" : "Riepilogo essenziale della sfida Boss"}">
            ${fiveMatchComparisonMarkup(userPlayers, bossPlayers, { contentId: "boss-match-values-content", opponentName: meta.boss.name, userStrength: simPreview.userStrength?.final ?? "-", userFormation: meta.user.formation, userOverall: userAverage || "-", probability: userProbability ?? "-", opponentStrength: simPreview.opponentStrength?.final ?? "-", opponentFormation: meta.boss.formation, opponentOverall: bossAverage || "-" })}
            <div class="boss-match-reward-note"><span>Vittoria</span><strong>${isSpecial ? "+1 livello · scelta 1 su 3" : "2 pick 1 di 3 dalla squadra battuta"}</strong></div>
          </section>
          ${simError ? `<div class="match-sim-error">${escapeHtml(simError)}</div>` : ""}
            <div class="boss-match-bottom-grid" ${simulating || resolved ? "" : "hidden"}>
            <section class="panel boss-match-log-panel" ${simulating || resolved ? "" : "hidden"}><div class="panel-title-row"><div><p class="eyebrow">90 minuti · eventi reali</p><h3>Cronaca</h3></div><span class="match-state-badge">${simulating ? "Live" : resolved ? "Completa" : "In attesa"}</span></div><ol class="boss-match-log match-sim-log" tabindex="0" aria-label="Cronaca partita" aria-live="polite">${bossMatchTimeline()}</ol></section>
            <section class="panel boss-match-result-panel ${outcomeClass}" ${simulating || resolved ? "" : "hidden"}><p class="eyebrow">${isSpecial ? "Esito partita speciale" : "Esito Boss"}</p><h3>${escapeHtml(bossStatusLabel)}</h3><div class="five-match-scoreline" aria-live="polite">${escapeHtml(scoreLabel)}</div><div class="boss-match-score" aria-hidden="true"><span>${score[0]}</span><small>-</small><span>${score[1]}</span></div><p>${escapeHtml(bossMatchStatusText())}</p><div class="boss-match-score-teams"><span>${escapeHtml(meta.user.name)}</span><span>${escapeHtml(meta.boss.name)}</span></div><div class="result-badges"><span class="lives" aria-label="Vite ${escapeHtml(run.lives)}">${resolved && ui.bossMatchState.endsWith("victory") ? "+1 livello" : hearts()}</span><span>${resolved && ui.bossMatchState.endsWith("victory") ? (isSpecial ? "Scelta giocatore disponibile" : "Doppia pick boss") : resolved ? "Ritorno al nodo precedente" : "Finalizzazione protetta"}</span></div></section>
          </div>
          <section class="panel boss-match-controls" aria-label="${isSpecial ? "Azioni partita speciale" : "Azioni partita Boss"}">
            <header class="five-match-actions-heading"><span>Azioni partita</span><i aria-hidden="true"></i></header>
            <div class="five-match-primary-actions">
              <button type="button" class="btn five-match-action-cta five-match-action-cta--primary" id="simulate-boss-match" ${simulating || resolved ? "disabled" : ""}><span class="five-match-action-icon" aria-hidden="true"><i class="five-match-play-icon"></i></span><span class="five-match-action-copy"><strong>${simulating ? "Simulazione..." : "Simula partita"}</strong><small>Avvia la simulazione</small></span><span class="five-match-action-mark" aria-hidden="true">›</span></button>
              <button type="button" class="btn five-match-action-cta five-match-action-cta--secondary" id="edit-boss-team" data-nav="squad" ${resolved ? "disabled" : ""}><span class="five-match-action-icon" aria-hidden="true"><i class="five-match-tactics-icon">×</i></span><span class="five-match-action-copy"><strong>Modifica squadra</strong><small>Gestisci titolari</small></span><span class="five-match-action-mark" aria-hidden="true">›</span></button>
              <button type="button" class="btn" id="skip-match-result" ${simulating ? "" : "hidden disabled"}>Vai al risultato</button><button type="button" class="btn btn-yellow" id="continue-match-result" ${resolved ? "" : "hidden disabled"}>Continua</button>
            </div>
            ${TEST_MATCH_CONTROLS_ENABLED ? `<div class="boss-match-test-tools"><span>Strumenti di test</span><div><button type="button" class="btn btn-tool" id="test-win" ${resolved ? "disabled" : ""}>Vittoria sicura</button>${DEV_MODE ? `<button type="button" class="btn btn-danger" id="test-loss" ${resolved ? "disabled" : ""}>Sconfitta forzata</button>` : ""}</div></div>` : ""}
          </section>
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
    document.querySelector(".boss-match-summary .five-match-values-button")?.addEventListener("click", (event) => {
      const button = event.currentTarget;
      const content = document.getElementById(button.getAttribute("aria-controls"));
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", expanded ? "false" : "true");
      if (content) content.hidden = expanded;
    });
    document.getElementById("test-win")?.addEventListener("click", (event) => { event.preventDefault(); forceMatchOutcome("victory", { boss }); });
    document.getElementById("test-loss")?.addEventListener("click", (event) => { event.preventDefault(); forceMatchOutcome("defeat", { boss }); });
    document.getElementById("simulate-boss-match").addEventListener("click", (event) => { event.preventDefault(); startMatchSimulation(ui.match, { boss }); });
    document.getElementById("skip-match-result")?.addEventListener("click", skipMatchToResult);
    document.getElementById("continue-match-result")?.addEventListener("click", continueAfterMatch);
    if (allowAutomaticResume) resumeMatchSimulationIfNeeded(run?.activeMatch);
  }

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

  function completeSpecialMatch(result) {
    const match = run?.activeMatch;
    if (!match?.simulation || match.simulation.resolutionApplied) return;
    const identity = matchTransactionIdentity(match);
    const committed = commitMatchMutation("special-match-resolution", identity, (currentMatch, current) => {
      if (currentMatch.simulation.resolutionApplied) return { applied: false };
      currentMatch.simulation.resolutionApplied = true;
      currentMatch.result = result;
      currentMatch.state = result === "victory" ? "completed-victory" : "completed-defeat";
      applyConsecutiveLossResult(result, current);
      if (currentMatch.simulation.score) currentMatch.score = [currentMatch.simulation.score.user, currentMatch.simulation.score.opponent];
      applyRealMatchStatistics(currentMatch, result, current);
      const node = current.currentZone?.nodes?.find((item) => item.id === currentMatch.nodeId);
      if (result === "victory") {
        global.SpecialMatchRuntime.complete(current, seasonDb, currentMatch, result);
        if (node) global.MapEngine.completeNode(current.currentZone, node.id);
        currentMatch.pendingPostMatchAction = { type: "special-reward", toast: "Vittoria: +1 livello e scelta giocatore" };
      } else {
        global.RunState.restoreAfterLoss(current, currentMatch.previousNodeId, currentMatch.type, { save: false });
        enqueueGameOverDevelopmentEffect(current);
        currentMatch.pendingPostMatchAction = { type: current.gameOver ? "game-over" : "map", toast: current.gameOver ? "Hai perso l'ultima vita. La run è terminata." : "Sconfitta: torni al nodo precedente." };
      }
      current.phase = "match";
      current.activeMatch = currentMatch;
      appendFinalMatchMessage(result, "special_match", currentMatch);
      return { applied: true };
    }, { onCommitted: () => { ui.bossMatchResolving = "done"; } });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    updateMatchScoreDom(ui.match, true);
    syncCommittedFinalMatchLog();
    updateMatchControlsDom();
  }

  function completeBossMatch(result) {
    // Durable loss semantics: run.gameOver ? "Hai perso l'ultima vita. La run è terminata."; type: run.gameOver ? "game-over" : "map"
    const match = run?.activeMatch;
    if (!match?.simulation || match.simulation.resolutionApplied) return;
    const identity = matchTransactionIdentity(match);
    const committed = persistGameplayMutation({
      label: "boss-resolution",
      mutate: (current) => {
        canonicalMatchFor(current, identity);
        const resolution = global.BossGameOverRuntime.applyBossResolutionMutation({ run: current, matchId: identity.matchId, result, seasonDb, deps: {
        applyStatistics: (currentMatch, currentResult) => applyRealMatchStatistics(currentMatch, currentResult, current),
        addLevels: (amount, actionId, units) => addLevels(amount, actionId, units, current),
        completeNode: (zone, nodeId) => global.MapEngine.completeNode(zone, nodeId),
        restoreAfterLoss: (...args) => global.RunState.restoreAfterLoss(...args),
        lossToast: (resolved) => resolved.gameOver ? "Hai perso l'ultima vita. La run è terminata." : `Sconfitta: ${remainingLivesText(resolved.lives)}. Torni al nodo precedente.`,
        appendFinalMessage: (currentResult, type) => appendFinalMatchMessage(currentResult, type, current.activeMatch),
      } });
        enqueueGameOverDevelopmentEffect(current);
        return resolution;
      },
      onCommitted: (_value, current) => { ui.match = current.activeMatch; ui.bossMatchResolving = "done"; ui.bossMatchState = current.activeMatch.state; },
      rerender: ({ ok, run: recovered }) => { if (!ok) { ui.match = recovered?.activeMatch || null; ui.bossMatchResolving = false; ui.bossMatchState = ui.match?.state || "pre-match"; } },
    });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    updateMatchScoreDom(ui.match, true);
    syncCommittedFinalMatchLog();
    updateMatchControlsDom();
  }

  function continueAfterMatch(event) {
    event?.preventDefault();
    const match = run?.activeMatch || ui.match;
    if (!match || match.postMatchNavigationApplied) return;
    const completed = match.simulation?.state === "completed" || String(match.state || "").startsWith("completed");
    if (completed && match.simulation?.resolutionApplied !== true) return applySimulationResolution(run?.activeMatch || match);
    if (match.type === "boss" && match.result === "victory") {
      const flow = resolvePendingRunFlow({ clearMatch: true });
      return navigateBossVictoryDestination(flow);
    }
    const identity = matchTransactionIdentity(match);
    const committed = commitMatchMutation("match-post-navigation", identity, (currentMatch, current) => {
      if (currentMatch.simulation?.resolutionApplied !== true) throw new Error("Match resolution is not durable");
      const action = { ...(currentMatch.pendingPostMatchAction || { type: "map" }) };
      currentMatch.postMatchNavigationApplied = true;
      current.activeMatch = null;
      current.phase = action.type === "game-over" ? "gameover" : action.type === "special-reward" ? "special-reward" : "map";
      return action;
    });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    const action = committed.value;
    ui.match = null; ui.bossMatchResolving = false; closeModal({ invokeOnClose: false });
    if (action.toast) toast(action.toast);
    if (action.type === "special-reward") return showSpecialMatchReward();
    if (action.type === "game-over") return renderGameOver();
    return renderMap({ persist: false });
  }

  function showSpecialMatchReward() {
  const pending = run.pendingSpecialMatchReward;
  if (!pending) return renderMap({ persist: false });
  const candidateIds = pending.candidateProfileIds?.length ? pending.candidateProfileIds : [pending.selectedProfileId].filter(Boolean);
  const candidates = candidateIds.map((profileId) => global.ProfiledSeasonRuntime.resolveProfile(run.seasonId, profileId)).filter(Boolean);
  const profile = pending.selectedProfileId && global.ProfiledSeasonRuntime.resolveProfile(run.seasonId, pending.selectedProfileId);
  const pullLabel = Number(pending.totalRewards || 1) > 1 ? ` · PULL ${Number(pending.currentReward || 1)}/${Number(pending.totalRewards)}` : "";
  openModal(`<div class="modal-head special-reward-head"><div><p class="eyebrow">SCELTA GIOCATORE DISPONIBILE${pullLabel}</p><h2>${candidates.length ? "Scegli 1 giocatore su 3" : "Pool completato"}</h2><p class="muted">I candidati provengono esclusivamente dalla squadra appena battuta.</p></div></div><div class="candidate-grid pull-offer-grid">${candidates.map((candidate) => playerCard(candidate, { button: true, context: "pull", level: Number(specialMatchById(pending.specialMatchId)?.matchLevel || 0), database: seasonDb })).join("")}</div><div class="button-row special-reward-actions">${candidates.length ? '<button type="button" class="btn btn-ghost" id="decline-special-reward">RIFIUTA</button>' : ""}<button type="button" class="btn btn-yellow" id="claim-special-reward" ${candidates.length && !profile ? "disabled" : ""}>${candidates.length ? "ACQUISISCI O POTENZIA" : "CONTINUA"}</button></div>`, { closeable: false, className: "pull-selection-modal special-reward-modal" });

  modalRoot.querySelectorAll("[data-player-id]").forEach((card) => card.addEventListener("click", () => {
    const profileId = card.dataset.playerId ? candidates.find((candidate) => String(candidate.playerId) === String(card.dataset.playerId))?.profileId : null;
    persistGameplayMutation({ label: "special-reward-select", mutate: (current) => global.SpecialMatchRuntime.selectRewardCandidate(current, profileId, current.pendingSpecialMatchReward), onCommitted: showSpecialMatchReward, rerender: ({ ok }) => { if (!ok) showSpecialMatchReward(); } });
  }));

  document.getElementById("decline-special-reward")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    modalRoot.querySelectorAll(".special-reward-actions button").forEach((action) => { action.disabled = true; });
    let result;
    persistGameplayMutation({ label: "special-reward-decline", mutate: (current) => { result = global.SpecialMatchRuntime.decline(current, current.pendingSpecialMatchReward, seasonDb); if (result.transition?.status !== "next-reward") current.phase = "map"; }, onCommitted: () => { closeModal(); if (result.status === "declined") toast("Ricompensa rifiutata"); if (result.transition?.status === "next-reward") return showSpecialMatchReward(); renderMap({ persist: false }); }, rerender: ({ ok }) => { if (!ok) showSpecialMatchReward(); } });
  });

  document.getElementById("claim-special-reward").addEventListener("click", (event) => {
    const button = event.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    const finishCommitted = (transition) => {
      closeModal();
      if (transition?.status === "next-reward") return showSpecialMatchReward();
      renderMap({ persist: false });
    };
    if (!profile) {
      let transition;
      return persistGameplayMutation({
        label: "special-reward-empty",
        mutate: (current) => { transition = global.SpecialMatchRuntime.completeCurrentReward(current, seasonDb, current.pendingSpecialMatchReward); if (transition.status !== "next-reward") current.phase = "map"; },
        onCommitted: () => finishCommitted(transition),
        rerender: ({ ok }) => { if (!ok) showSpecialMatchReward(); },
      });
    }
    let transition;
    recruitPlayer(profile, global.SeasonRegistry.sourceForSeason(run.seasonId), Number(specialMatchById(pending.specialMatchId)?.matchLevel || 0), (result) => {
      if (result.status.startsWith("committed-")) finishCommitted(transition);
      if (result.status === "cancelled") showSpecialMatchReward();
    }, {
      allowCancel: true,
      cancelLabel: "RIFIUTA",
      recruitmentSource: "special_match_reward",
      actionId: pending.actionId,
      transactionMutate: (current) => { transition = global.SpecialMatchRuntime.completeCurrentReward(current, seasonDb, current.pendingSpecialMatchReward); if (transition.status !== "next-reward") current.phase = "map"; },
      onRecover: () => showSpecialMatchReward(),
    });
  });
}

  function resumePostBossFlowOrMap() {
    const flow = resolvePendingRunFlow({ clearMatch: true });
    if (flow.destination !== "none") return navigateBossVictoryDestination(flow);
    ensureCurrentZone();
    run.phase = "map";
    try { global.RunState.save(run); } catch (error) { console.error("save failed (resumePostBossFlowOrMap)", error); }
    return renderMap();
  }

  function bossVictoryMatch() {
    const match = ui.match || run.activeMatch;
    return match?.type === "boss" && match.result === "victory" && String(match.state || "").startsWith("completed") ? match : null;
  }

  function ensurePostBossFlow(options = {}) {
    return global.BossGameOverRuntime.derivePostBossFlow(run, seasonDb, options);
  }

  function resolvePendingRunFlow(options = {}) {
    if (!ensurePostBossFlow(options)) return { destination: "none" };
    const committed = persistGameplayMutation({
      label: "post-boss-resume",
      mutate: (current) => global.BossGameOverRuntime.applyPostBossResumeMutation({ run: current, seasonDb, clearMatch: Boolean(options.clearMatch) }),
      onCommitted: () => { if (options.clearMatch) { ui.match = null; ui.bossMatchResolving = false; } },
      rerender: ({ ok }) => { if (!ok) renderPostBossRecovery(); },
    });
    if (!committed.ok) return { destination: "post-boss-recovery", error: committed.error };
    if (committed.value.destination === "next-zone" || committed.value.destination === "season-complete") return finishBossVictoryTransition();
    return committed.value;
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
    if (flow.destination === "finalization-pending") return renderFinalizationPending(flow.finalization);
    if (flow.destination === "post-boss-recovery") return renderPostBossRecovery();
    if (flow.destination === "map") return renderMap({ persist: false });
    return null;
  }

  function bossRewardCandidates(flow, boss) {
    const team = seasonDb.teams.find((candidate) => String(candidate.teamId) === String(boss.teamId));
    const owned = new Set(run.roster.map((entry) => String(entry.playerId)));
    const random = global.DraftEngine.randomFromSeed(`${run.runId}:bossReward:${flow.bossIndex}:${flow.rewardNumber}:${flow.rerolls}`);
    const profileAware = isProfileAwareSeason();
    const available = profileAware
      ? (boss.rewardPoolProfileIds || team?.playerProfileIds || []).map((profileId) => global.ProfiledSeasonRuntime.resolveProfile(run.seasonId, profileId)).filter((profile) => profile && global.SpecialMatchRuntime.eligibleProfile(run, profile.profileId) && !flow.excludedIds.includes(String(profile.profileId)))
      : (team?.playerIds || []).map((id) => seasonPlayersById.get(String(id))).filter((player) => player && !owned.has(String(player.playerId)) && !flow.excludedIds.includes(String(player.playerId)));
    return selectWeightedCandidates(available, random);
  }

  // Legacy persistence assertions kept for post-boss flow: remaining rewards live on run.postBossFlow
  function startBossRewards() {
    const flowResult = resolvePendingRunFlow({ clearMatch: true });
    if (flowResult.destination === "season-complete") return renderSeasonComplete();
    if (flowResult.destination === "map") return renderMap({ persist: false });
    const flow = run.postBossFlow;
    const boss = seasonDb.bossOrder[Number(flow?.bossIndex ?? run.bossIndex)];
    if (!flow || !boss) return renderMap();
    const committed = persistGameplayMutation({
      label: "boss-reward-candidates",
      mutate: (current) => global.BossGameOverRuntime.prepareBossRewardCandidatesMutation({ run: current, seasonDb, candidateIds: flow.candidateIds?.length ? flow.candidateIds : bossRewardCandidates(flow, boss).map((player) => String(player.profileId || player.playerId)) }),
      rerender: ({ ok }) => { if (!ok && run?.postBossFlow) renderPostBossRecovery(); },
    });
    if (committed.ok) showNextBossReward();
  }

  function renderPostBossRecovery() {
    app.innerHTML = `<main class="hero-screen post-boss-recovery-screen" data-post-boss-recovery><section class="panel">
      <p class="eyebrow">PROGRESSO BOSS</p><h1>Ripresa ricompense</h1><p class="muted">Il progresso salvato non è stato modificato.</p>
      <button type="button" class="btn btn-yellow" id="retry-post-boss-flow">RIPROVA / CONTINUA</button>
    </section></main>`;
    resetRenderedViewScroll();
    document.getElementById("retry-post-boss-flow")?.addEventListener("click", resumePostBossFlow);
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
    const candidates = (flow.candidateIds || []).map((id) => isProfileAwareSeason() ? global.ProfiledSeasonRuntime.resolveProfile(run.seasonId, id) : seasonPlayersById.get(String(id))).filter(Boolean);
    if (!candidates.length) return startBossRewards();
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
        const committed = persistGameplayMutation({ label: "boss-reward-reroll", mutate: (current) => global.BossGameOverRuntime.applyBossRewardRerollMutation({ run: current, tokenInstanceId: scoutToken.instanceId, nextCandidateIds: (nextFlow) => bossRewardCandidates(nextFlow, boss).map((candidate) => String(candidate.profileId || candidate.playerId)), recordAction: (current, nextFlow, token) => global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.REROLL_USED, { nodeId: nextFlow.matchNodeId, itemId: token.id, instanceId: token.instanceId, actionId: `${current.runId}:${nextFlow.matchNodeId}:boss_reward_reroll:${nextFlow.rewardNumber}:${nextFlow.rerolls}` }) }), rerender: ({ ok }) => { if (!ok) renderPostBossRecovery(); } });
        if (committed.ok) showNextBossReward();
      } : null,
      onPick: (player) => {
        recruitPlayer(player, global.SeasonRegistry.sourceForSeason(run?.seasonId), level, (result) => { if (result.status.startsWith("committed-")) advanceBossReward(); else if (result.status === "cancelled") showNextBossReward(); }, { allowCancel: true, recruitmentSource: "boss_reward", actionId: `${run.runId}:${flow.matchNodeId}:boss_reward:${flow.rewardNumber}:recruit:${player.profileId || player.playerId}`, transactionMutate: (current) => global.BossGameOverRuntime.applyBossRewardPickMutation({ run: current, playerId: player.profileId || player.playerId, recordAction: (target, currentFlow) => global.RunStatistics?.recordRunAction?.(target, global.RunStatistics.ACTIONS.BOSS_REWARD_CHOSEN, { nodeId: currentFlow.matchNodeId, playerId: player.playerId, actionId: `${target.runId}:${currentFlow.matchNodeId}:boss_reward:${currentFlow.rewardNumber}:chosen` }) }), onRecover: () => showNextBossReward(), onRecoveryBlocked: () => renderPostBossRecovery() });
      },
      onSkip: () => advanceBossReward((current, currentFlow) => global.RunStatistics?.recordRunAction?.(current, global.RunStatistics.ACTIONS.BOSS_REWARD_DECLINED, { nodeId: currentFlow.matchNodeId, actionId: `${current.runId}:${currentFlow.matchNodeId}:boss_reward:${currentFlow.rewardNumber}:declined` })),
    });
  }

  function advanceBossReward(recordAction) {
    const flow = run.postBossFlow;
    if (!flow) return renderMap();
    const committed = persistGameplayMutation({
      label: "boss-reward-advance",
      mutate: (current) => global.BossGameOverRuntime.advanceBossRewardMutation({ run: current, recordAction }),
      rerender: ({ ok }) => { if (!ok && run?.postBossFlow) renderPostBossRecovery(); },
    });
    if (!committed.ok) return;
    run.postBossFlow.remainingRewards > 0 ? showNextBossReward() : navigateBossVictoryDestination(finishBossVictoryTransition());
  }

  function finalizeBossVictoryTransition(options = {}) {
    return finishBossVictoryTransition(options);
  }

  function hasPendingCanonicalFinalization(current) {
    const status = String(current?.finalization?.status || "");
    return current?.phase === "finalization" || ["pending", "hall-written", "development-written"].includes(status);
  }

  function createPostBossCheckpoint(current) {
    try { global.RunState.createCheckpoint(current); }
    catch (error) {
      console.error("Post-boss checkpoint creation failed after canonical commit", error);
      toast("Progresso Boss salvato; il checkpoint di recupero verrà ricreato più tardi.", "warning");
    }
  }

  function finishBossVictoryTransition() {
    const committed = persistGameplayMutation({
      label: "boss-victory-handoff",
      mutate: (current) => global.BossGameOverRuntime.applyBossVictoryHandoffMutation({
        run: current, seasonDb, ensureCurrentZoneMutation,
        buildFinalization: (boss) => { const snapshot = buildChampionSnapshot(boss); current.finalization = { status: "pending", archiveKey: snapshot.archiveKey, hallTeamId: snapshot.hallTeamId }; global.PermanentEffects.enqueueHall(current, snapshot); },
      }),
      onCommitted: () => { ui.pendingReward = null; ui.match = null; closeModal(); },
      rerender: ({ ok }) => { if (!ok) renderPostBossRecovery(); },
    });
    if (!committed.ok) {
      const recovered = committed.run;
      const canonicalFinalization = hasPendingCanonicalFinalization(recovered);
      return { destination: canonicalFinalization ? "finalization-pending" : "post-boss-recovery", error: committed.error, finalization: recovered?.finalization };
    }
    if (committed.value.destination === "finalization-pending") {
      const finalization = resumeRunFinalization({ render: false });
      return finalization.completed
        ? { destination: "season-complete", finalization }
        : { destination: "finalization-pending", finalization };
    }
    // Final-boss boundary is owned by the production helper: run.bossIndex >= seasonDb.bossOrder.length
    if (committed.value.destination === "map") createPostBossCheckpoint(run);
    return committed.value;
  }

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

  function renderInventory(options = {}) {
    ensureRunSchema();
    const availableGroups = groupedInventoryItems(run.inventory).map((group) => ({ ...group, backpackQuantity: group.quantity, equippedCount: 0, equippedEntries: [] }));
    const equipped = run.roster
      .filter((entry) => entry.equippedItem)
      .map((entry) => ({ entry, player: sourcePlayer(entry), resolved: resolvedRosterPlayer(entry.playerId), item: resolveItem(entry.equippedItem) }));
    const activeTab = ui.inventoryTab === "equipped" ? "equipped" : "items";
    const shouldKeepScroll = options.keepScroll;
    const previousScroll = shouldKeepScroll ? scrollSnapshot() : null;
    const itemsMarkup = availableGroups.length
      ? `<div class="inventory-v2-list">${availableGroups.map((group) => inventoryItemCard(group)).join("")}</div>`
      : '<div class="inventory-empty-state"><strong>Nessun oggetto disponibile.</strong></div>';
    const equippedMarkup = equipped.length
      ? `<div class="inventory-v2-list inventory-equipped-list">${equipped.map(({ entry, player, resolved, item }) => `
          <article class="inventory-equipped-row">${itemIcon(item)}
            <div class="inventory-equipped-item"><span class="item-kind">Equipaggiamento</span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(itemStatLabel(item.stat))} +${escapeHtml(item.bonus)}</p></div>
            <div class="equipped-player"><span class="equipped-player-portrait"><img src="${escapeHtml(playerPortraitUrl(resolved || player))}" alt="Ritratto di ${escapeHtml(player.name)}" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(resolved || player).cardFallbacks)} /></span><div class="equipped-player-copy"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.position)} · OVR ${escapeHtml(resolved.overall)}</small></div></div>
            <button type="button" class="btn inventory-remove-button" data-unequip-player="${escapeHtml(entry.playerId)}">RIMUOVI</button>
          </article>`).join("")}</div>`
      : '<div class="inventory-empty-state"><strong>Nessun equipaggiamento assegnato.</strong></div>';
    app.innerHTML = `
      <main class="screen inventory-screen inventory-v2-screen">
        ${topbar("Oggetti")}
        <div class="content inventory-content inventory-v2-content">
          <header class="inventory-v2-heading"><h2>ZAINO</h2><strong>${run.inventory.length} / ${global.SEASON1_CONFIG.maxInventory}</strong></header>
          <div class="inventory-tabs" role="tablist" aria-label="Inventario">
            <button type="button" role="tab" class="inventory-tab ${activeTab === "items" ? "active" : ""}" aria-selected="${activeTab === "items"}" data-inventory-tab="items">OGGETTI</button>
            <button type="button" role="tab" class="inventory-tab ${activeTab === "equipped" ? "active" : ""}" aria-selected="${activeTab === "equipped"}" data-inventory-tab="equipped">EQUIPAGGIATI</button>
          </div>
          <section class="inventory-tab-panel" role="tabpanel" aria-label="${activeTab === "items" ? "Oggetti disponibili" : "Equipaggiamenti assegnati"}">${activeTab === "items" ? itemsMarkup : equippedMarkup}</section>
        </div>
        ${bottomNav("inventory")}
      </main>`;
    if (shouldKeepScroll) restoreScroll(previousScroll); else resetRenderedViewScroll();
    bindSectionRootNav();
    const content = document.querySelector(".inventory-content");
    content?.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-inventory-tab]");
      if (tab) { ui.inventoryTab = tab.dataset.inventoryTab; return renderInventory({ keepScroll: true }); }
      const useButton = event.target.closest("[data-use-item]");
      if (useButton) return useInventoryItem(useButton.dataset.useItem);
      const equipButton = event.target.closest("[data-equip-item]");
      if (equipButton) return chooseEquipmentPlayer(equipButton.dataset.equipItem);
      const unequipButton = event.target.closest("[data-unequip-player]");
      if (unequipButton) return unequipPlayerItem(unequipButton.dataset.unequipPlayer);
      const itemCard = event.target.closest("[data-inventory-select]");
      if (itemCard) return selectInventoryItem(itemCard.dataset.inventorySelect);
    });
    content?.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key) || !event.target.matches("[data-inventory-select]")) return;
      event.preventDefault(); selectInventoryItem(event.target.dataset.inventorySelect);
    });
    bindBottomNav();
  }

  function inventoryItemEffect(itemOrId) {
    const item = resolveItem(itemOrId);
    if (item.kind === "equipment") return `${itemStatLabel(item.stat)} +${item.bonus}`;
    if (item.effect === "team_level") return `+${String(item.amount).replace(".", ",")} livello alla rosa`;
    if (item.effect === "player_level") return `+${item.amount} livelli a un giocatore`;
    const conciseEffects = {
      restore_life: () => `Recupera ${item.amount} vita`,
      potential_boost: () => `OVR +${item.amount} / POT +${item.amount}`,
    };
    if (conciseEffects[item.effect]) return conciseEffects[item.effect]();
    return item.description;
  }

  function inventoryItemCard(groupOrItem, selected = false) {
    const group = groupOrItem?.instances ? groupOrItem : { item: groupOrItem, quantity: 1, instances: [groupOrItem], key: inventoryItemIdentity(groupOrItem) };
    const item = resolveItem(group.item);
    const instanceId = group.instances[0]?.instanceId || item.instanceId;
    const backpackQuantity = Number(group.backpackQuantity ?? group.quantity);
    const action = inventoryItemActionMarkup(item, instanceId, { compact: true, backpackQuantity, equippedEntries: group.equippedEntries || [] });
    const detail = inventoryItemEffect(item);
    const category = group.category || inventoryItemCategory(item);
    const categoryLabel = category === "equipment" ? "Equipaggiamento" : category === "consumable" ? "Consumabile" : "Speciale";
    return `<article class="item-card inventory-item-card static-item" tabindex="0" data-inventory-select="${escapeHtml(group.key)}" data-item-id="${escapeHtml(group.key)}" data-item-kind="${escapeHtml(item.kind)}" data-item-category="${escapeHtml(category)}"><div class="item-card-visual">${itemIcon(item)}<span class="item-quantity" aria-label="Quantità nello zaino ${group.quantity}">×${group.quantity}</span></div><div class="item-card-main"><span class="item-kind">${categoryLabel}</span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(detail)}</p></div><div class="item-card-actions">${action}</div></article>`;
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
        <p class="eyebrow">TIPO OGGETTO</p>
        <span class="item-kind">${item.kind === "equipment" ? "Equipaggiamento" : "Consumabile"}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="inventory-detail-effect"><span>Effetto</span><strong>${escapeHtml(inventoryItemEffect(item))}</strong></div>
        <div class="inventory-detail-counts">
          <span><strong>${group.quantity}</strong> posseduti</span>
          ${item.kind === "equipment" ? `<span><strong>${backpackQuantity}</strong> nello zaino</span><span><strong>${group.equippedCount || 0}</strong> equipaggiati</span>` : ""}
        </div>
        <p class="inventory-detail-limit">${escapeHtml(limit)}</p>
        ${inventoryItemActionMarkup(item, instanceId, { backpackQuantity, equippedEntries: group.equippedEntries || [] })}
      </div>`;
  }

  function selectInventoryItem(groupKey) {
    const group = groupedInventoryItems(run.inventory).find((candidate) => candidate.key === groupKey);
    if (!group) return;
    const ownedGroup = groupedOwnedInventoryItems(run).find((candidate) => candidate.key === groupKey) || group;
    ui.inventorySelectedItemId = groupKey;
    openModal(`<div class="inventory-detail-modal-content">${inventoryItemDetailMarkup(ownedGroup)}</div>`, {
      closeable: true,
      className: "inventory-detail-modal",
    });
    modalRoot.querySelector("[data-use-item]")?.addEventListener("click", (event) => useInventoryItem(event.currentTarget.dataset.useItem));
    modalRoot.querySelector("[data-equip-item]")?.addEventListener("click", (event) => chooseEquipmentPlayer(event.currentTarget.dataset.equipItem));
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
      valid = runtimeTrainingState(entry).remainingBoost > 0;
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

  function individualItemTargetState(entry, item, mode = "equipment") {
    if (mode === "equipment") return equipmentTargetState(entry, item);
    const player = entry ? resolvedRosterPlayer(entry.playerId) : null;
    if (!entry || !player) return { valid: false, reason: "Non compatibile", player };
    if (mode === "level") return { valid: Number(entry.level || 0) < 20, reason: "Livello massimo", player };
    const valid = runtimeTrainingState(entry).remainingBoost > 0;
    return { valid, reason: "Potenziale massimo", player };
  }

  function inventoryEquipmentPlayerCard(id, item, area, selectedId = null, mode = "equipment") {
    const entry = rosterEntry(id);
    const target = individualItemTargetState(entry, item, mode);
    if (!entry || !target.player) return "";
    const selected = String(selectedId || "") === String(id);
    const dataAttr = target.valid
      ? `data-item-target-player="${escapeHtml(id)}" data-area="${escapeHtml(area)}" aria-pressed="${selected ? "true" : "false"}"`
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

  function inventoryEquipmentPitchMarkup(item, selectedId = null, mode = "equipment") {
    return `<section class="pitch">
      ${lineupRows().map((row) => `<div class="pitch-row tactical-row" data-row-count="${row.ids.length || 1}" style="--players-in-row:${row.ids.length || 1};--row-count:${row.ids.length || 1}">${row.ids.map((id) => inventoryEquipmentPlayerCard(id, item, "lineup", selectedId, mode)).join("")}</div>`).join("")}
    </section>`;
  }

  function inventoryEquipmentBenchMarkup(item, selectedId = null, mode = "equipment") {
    const cards = (run.bench || []).map((id) => inventoryEquipmentPlayerCard(id, item, "bench", selectedId, mode)).filter(Boolean);
    return cards.length ? cards.join("") : '<p class="muted">Nessuna riserva disponibile.</p>';
  }

  function inventoryEquipmentSelectionSummary(playerId) {
    const entry = playerId ? rosterEntry(playerId) : null;
    const player = entry ? resolvedRosterPlayer(entry.playerId) : null;
    if (!entry || !player) {
      return '<p class="inventory-equipment-selection-empty">Seleziona un giocatore dal campo o dalla panchina.</p>';
    }
    const current = entry.equippedItem ? resolveItem(entry.equippedItem) : null;
    const pending = run.inventory.find((candidate) => candidate.instanceId === ui.inventoryEquipmentItemId);
    const stat = pending?.stat;
    const before = stat ? Number(player.baseStats?.[stat] ?? player.stats?.[stat] ?? 0) : null;
    const after = stat ? Math.min(99, before + Number(pending.bonus || 0)) : null;
    return `<div class="inventory-equipment-selection-player">
      <span class="equipped-player-portrait"><img src="${escapeHtml(playerPortraitUrl(player))}" alt="" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} /></span>
      <div><small>Giocatore selezionato</small><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.position)} · OVR ${escapeHtml(player.overall)}</span></div>
    </div>
    ${pending && stat ? `<div class="inventory-stat-preview"><span>${escapeHtml(itemStatLabel(stat))}</span><strong>${escapeHtml(before)} → ${escapeHtml(after)}</strong></div>` : ""}
    <div class="inventory-equipment-current">
      ${current ? `${itemIcon(current)}<div><small>Oggetto attuale</small><strong>${escapeHtml(current.name)}</strong><span>Verrà restituito allo zaino dopo la conferma.</span></div>` : '<div><small>Oggetto attuale</small><strong>Nessun equipaggiamento</strong><span>Lo slot è libero.</span></div>'}
    </div>`;
  }

  function setInventoryEquipmentTarget(playerId) {
    ui.inventoryEquipmentPlayerId = playerId ? String(playerId) : null;
    modalRoot.querySelectorAll("[data-item-target-player]").forEach((card) => {
      const selected = String(card.dataset.itemTargetPlayer) === ui.inventoryEquipmentPlayerId;
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
    const confirmButton = document.getElementById("confirm-inventory-action");
    let submitting = false;
    confirmButton?.addEventListener("click", async () => {
      if (submitting) return;
      submitting = true;
      confirmButton.disabled = true;
      confirmButton.setAttribute("aria-busy", "true");
      try {
        await onConfirm?.();
      } catch (error) {
        submitting = false;
        confirmButton.disabled = false;
        confirmButton.removeAttribute("aria-busy");
        toast(error?.message || "Operazione non riuscita. Riprova.", "error");
      }
    });
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
          persistGameplayMutation({ label: "consumable-team-level", mutate: () => {
            addLevels(Number(item.amount || 0), `${run.runId}:${instanceId}:level-units`, isProfileAwareSeason() ? 3 : null);
            removeInventoryItem(instanceId);
            global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.ITEM_USED, { itemId: item.id, effect: item.effect, instanceId, actionId: `${run.runId}:${instanceId}:used` });
          }, onCommitted: () => { closeModal(); toast("Tutta la rosa guadagna +0,5 livello"); renderInventory(); }, rerender: ({ ok }) => { if (!ok) renderInventory(); } });
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
          persistGameplayMutation({ label: "consumable-restore-life", mutate: () => {
            run.lives = Math.min(maxRunLives, run.lives + Number(item.amount || 1));
            removeInventoryItem(instanceId);
            global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.ITEM_USED, { itemId: item.id, effect: item.effect, instanceId, actionId: `${run.runId}:${instanceId}:used` });
          }, onCommitted: () => { closeModal(); toast("Hai recuperato una vita"); renderInventory(); }, rerender: ({ ok }) => { if (!ok) renderInventory(); } });
        },
      });
    }
    if (item.effect === "lucky_pull") return toast("Portafortuna utilizzabile durante una Pull svincolati o Pull squadre.");
  }

  function openIndividualItemSelector(item, mode, { title = "Scegli il giocatore", onConfirm } = {}) {
    ui.inventoryEquipmentPlayerId = null;
    const formation = formationById(run.formationId);
    openModal(`
      <div class="inventory-flow-head">${itemIcon(item)}<div><p class="eyebrow">${escapeHtml(item.name)}</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(item.description)}</p></div></div>
      <p class="inventory-equipment-instruction">Seleziona soltanto il destinatario: formazione e modulo non cambieranno.</p>
      <div class="inventory-equipment-workspace squad-screen">
        <section class="squad-field-panel inventory-equipment-field" aria-label="Titolari sul campo">
          <div class="squad-panel-head"><div><p class="eyebrow">Titolari</p><h3>Campo tattico</h3></div><span class="squad-field-formation">${escapeHtml(formation?.name || run.formationId)}</span></div>
          ${inventoryEquipmentPitchMarkup(item, null, mode)}
        </section>
        <aside class="inventory-equipment-sidebar">
          <section class="inventory-equipment-selection-summary" data-equipment-selection-summary aria-live="polite">${inventoryEquipmentSelectionSummary(null)}</section>
          <div class="inventory-modal-actions"><button type="button" class="btn btn-yellow" data-confirm-equipment-target disabled>CONFERMA</button><button type="button" class="btn btn-ghost" data-close-inventory-flow>ANNULLA</button></div>
        </aside>
        <section class="squad-bench-panel inventory-equipment-bench" aria-label="Riserve"><div class="squad-panel-head"><div><p class="eyebrow">Panchina</p><h3>Riserve</h3></div><span class="squad-bench-count">${Math.min((run.bench || []).length, 4)}/4</span></div><div class="bench-list squad-bench-list">${inventoryEquipmentBenchMarkup(item, null, mode)}</div></section>
      </div>`,
      { closeable: true, className: "item-assignment-modal inventory-flow-modal inventory-equipment-selector-modal" }
    );
    modalRoot.querySelector("[data-close-inventory-flow]")?.addEventListener("click", closeModal);
    modalRoot.querySelector(".inventory-equipment-workspace")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-item-target-player]");
      if (!button || button.disabled) return;
      event.preventDefault();
      setInventoryEquipmentTarget(button.dataset.itemTargetPlayer);
    });
    modalRoot.querySelector("[data-confirm-equipment-target]")?.addEventListener("click", () => {
      if (ui.inventoryEquipmentPlayerId) onConfirm(ui.inventoryEquipmentPlayerId);
    });
  }

  function choosePlayerForConsumable(item) {
    openIndividualItemSelector(item, "level", { onConfirm: (playerId) => {
        const entry = rosterEntry(playerId);
        if (!entry) return;
        const before = resolvedRosterPlayer(entry.playerId);
        const currentLevel = Number(entry.level || 0);
        const appliedLevels = Math.min(Number(item.amount || 1), 20 - currentLevel);
        if (appliedLevels <= 0) return toast("Questo giocatore ha già raggiunto il livello massimo.");
        openInventoryConfirmation(item, {
          title: `Usare su ${before.name}?`,
          description: `Livello ${before.displayLevelText} → ${global.LevelProgression.formatLevel(Math.min(20, currentLevel + appliedLevels), run.seasonId, Math.min(20, currentLevel + appliedLevels) >= 20 ? 0 : entry.levelUnits)}. L'oggetto sarà consumato.`,
          onCancel: () => choosePlayerForConsumable(item),
          onConfirm: () => {
            const committed = persistGameplayMutation({ label: "consumable-player-level", mutate: () => {
              const currentEntry = rosterEntry(entry.playerId);
              currentEntry.level = Math.min(20, currentLevel + appliedLevels);
              if (isProfileAwareSeason() && currentEntry.level >= 20) currentEntry.levelUnits = 0;
              removeInventoryItem(item.instanceId);
              global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.ITEM_USED, { itemId: item.id, effect: item.effect, instanceId: item.instanceId, actionId: `${run.runId}:${item.instanceId}:used` });
            }, onCommitted: () => {} });
            if (!committed.ok) return renderInventory();
            const after = resolvedRosterPlayer(entry.playerId);
            closeModal();
            toast(`${escapeHtml(item.name)} utilizzata\nLivello ${before.displayLevelText} → ${after.displayLevelText}\nOverall ${before.overall} → ${after.overall}`);
            renderInventory();
          },
        });
      }});
  }

  function choosePlayerForPotentialBoost(item) {
    openIndividualItemSelector(item, "potential", { title: "Scegli chi allenare", onConfirm: (playerId) => {
        const entry = rosterEntry(playerId);
        if (!entry) return;
        const player = sourcePlayer(entry);
        const before = resolvedRosterPlayer(entry.playerId);
        const training = runtimeTrainingState(entry);
        entry.potentialBoostApplications = training.applications;
        const currentPotentialBoost = training.currentLocalBoost;
        const currentOverallBoost = training.currentOverallBoost;
        const addedBoost = Math.min(Number(item.amount || 3), training.remainingBoost);
        if (addedBoost <= 0) return toast("Questo giocatore ha già raggiunto il potenziale massimo. L'oggetto NON viene consumato.");
        openInventoryConfirmation(item, {
          title: `Allenare ${before.name}?`,
          description: `Overall e potenziale aumenteranno di ${addedBoost}.`,
          onCancel: () => choosePlayerForPotentialBoost(item),
          onConfirm: () => {
            const trainingBase=global.RoguelikeRules.isProfileAwareRosterEntry(entry,run)?global.ProfiledSeasonRuntime.resolveEffectiveBase(entry,run.seasonId):player;
            const committed = persistGameplayMutation({ label: "consumable-potential", mutate: (current) => {
            const currentEntry = rosterEntry(entry.playerId);
            const currentProfileAware=global.RoguelikeRules.isProfileAwareRosterEntry(currentEntry,current);
            const trainingPlan=global.DevelopmentRuntime.planIntensiveTraining(current,trainingBase,currentEntry,addedBoost,currentProfileAware?seasonDb:freeAgentsDb,currentProfileAware?{permanentMode:"provided-base"}:undefined);
            currentEntry.potentialBoost = Math.min(training.maxLocalBoost, currentPotentialBoost + addedBoost);
            currentEntry.currentOverallBoost = Math.min(training.maxLocalBoost, currentOverallBoost + addedBoost);
            currentEntry.intensiveTrainingMigrated = true;
            currentEntry.potentialBoostApplications = Array.isArray(currentEntry.potentialBoostApplications) ? currentEntry.potentialBoostApplications : [];
            if (addedBoost > 0) currentEntry.potentialBoostApplications.push({ amount: addedBoost, appliedLevel: Number(currentEntry.level || 0), codexDeltas: trainingPlan.codexDeltas });
            removeInventoryItem(item.instanceId);
            global.RunStatistics?.recordRunAction?.(run, global.RunStatistics.ACTIONS.ITEM_USED, { itemId: item.id, effect: item.effect, instanceId: item.instanceId, actionId: `${run.runId}:${item.instanceId}:used` });
            }, onCommitted: () => {} });
            if (!committed.ok) return renderInventory();
            const after = resolvedRosterPlayer(entry.playerId);
            closeModal();
            const rarityMessage = before.category !== after.category ? `\nNuova rarità: ${after.category}` : "";
            toast(`Pesi da allenamento completati\nOverall ${before.overall} → ${after.overall}\nPotenziale ${before.potential} → ${after.potential}${rarityMessage}`);
            renderInventory();
          },
        });
      }});
  }

  function chooseEquipmentPlayer(instanceId, options = {}) {
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return;
    ui.inventoryEquipmentPlayerId = options.selectedPlayerId ? String(options.selectedPlayerId) : null;
    ui.inventoryEquipmentItemId = instanceId;
    const formation = formationById(run.formationId);
    openModal(`
      <div class="inventory-flow-head">${itemIcon(item)}<div><p class="eyebrow">EQUIPAGGIA OGGETTO</p><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(inventoryItemEffect(item))}</p></div></div>
      <p class="inventory-equipment-instruction">Seleziona un giocatore dal campo o dalla panchina.</p>
      <div class="inventory-equipment-workspace squad-screen">
        <section class="squad-field-panel inventory-equipment-field" aria-label="Titolari sul campo">
          <div class="squad-panel-head"><div><p class="eyebrow">Titolari</p><h3>Campo tattico</h3></div><span class="squad-field-formation">${escapeHtml(formation?.name || run.formationId)}</span></div>
          ${inventoryEquipmentPitchMarkup(item, ui.inventoryEquipmentPlayerId, "equipment")}
        </section>
        <aside class="inventory-equipment-sidebar">
          <section class="inventory-equipment-selection-summary" data-equipment-selection-summary aria-live="polite">${inventoryEquipmentSelectionSummary(ui.inventoryEquipmentPlayerId)}</section>
          <div class="inventory-modal-actions">
            <button type="button" class="btn btn-yellow" data-confirm-equipment-target ${ui.inventoryEquipmentPlayerId ? "" : "disabled"}>CONFERMA</button>
            <button type="button" class="btn btn-ghost" data-close-inventory-flow>RINUNCIA</button>
          </div>
        </aside>
        <section class="squad-bench-panel inventory-equipment-bench" aria-label="Riserve">
          <div class="squad-panel-head"><div><p class="eyebrow">Panchina</p><h3>Riserve</h3></div><span class="squad-bench-count">${Math.min((run.bench || []).length, 4)}/4</span></div>
          <div class="bench-list squad-bench-list">${inventoryEquipmentBenchMarkup(item, ui.inventoryEquipmentPlayerId, "equipment")}</div>
        </section>
      </div>`,
      { closeable: true, className: "item-assignment-modal inventory-flow-modal inventory-equipment-selector-modal" }
    );
    modalRoot.querySelector("[data-close-inventory-flow]")?.addEventListener("click", closeModal);
    modalRoot.querySelector(".inventory-equipment-workspace")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-item-target-player]");
      if (!button || button.disabled) return;
      event.preventDefault();
      setInventoryEquipmentTarget(button.dataset.itemTargetPlayer);
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
        <div class="inventory-confirmation inventory-replacement-confirmation">
          <p class="eyebrow">CONFERMA RICHIESTA</p><h2>SOSTITUIRE L’EQUIPAGGIAMENTO?</h2>
          <div class="inventory-equipment-replacement">${itemIcon(current)}<div><small>Equipaggiamento attuale</small><strong>${escapeHtml(current.name)}</strong><span>${escapeHtml(inventoryItemEffect(current))}</span></div></div>
          <div class="inventory-replacement-arrow" aria-hidden="true">↓</div>
          <div class="inventory-equipment-replacement">${itemIcon(item)}<div><small>Nuovo equipaggiamento</small><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(inventoryItemEffect(item))}</span></div></div>
          <div class="inventory-replacement-player"><span class="equipped-player-portrait"><img src="${escapeHtml(playerPortraitUrl(target.player))}" alt="Ritratto di ${escapeHtml(player.name)}"></span><div><small>Equipaggia su</small><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.position)} · OVR ${escapeHtml(target.player.overall)}</span></div></div>
          <div class="button-row inventory-modal-actions"><button type="button" class="btn btn-ghost" id="cancel-equip-replace">ANNULLA</button><button type="button" class="btn btn-yellow" id="confirm-equip-replace">CONFERMA</button></div>
        </div>`,
        { closeable: false, className: "inventory-flow-modal inventory-confirmation-modal" }
      ), document.getElementById("confirm-equip-replace").addEventListener("click", () => equipItemToEntry(instanceId, entry)), document.getElementById("cancel-equip-replace").addEventListener("click", () => chooseEquipmentPlayer(instanceId, { selectedPlayerId: playerId }));
    }
    return equipItemToEntry(instanceId, entry);
  }

  function equipItemToEntry(instanceId, entry) {
    const item = run.inventory.find((candidate) => candidate.instanceId === instanceId);
    if (!item) return;
    persistGameplayMutation({
      label: "equipment-equip",
      mutate: () => { const newEquipment = removeInventoryItem(instanceId); if (entry.equippedItem) run.inventory.push(entry.equippedItem); entry.equippedItem = newEquipment; },
      onCommitted: () => { closeModal(); renderInventory({ keepScroll: true }); },
      rerender: ({ ok }) => { if (!ok) renderInventory({ keepScroll: true }); },
    });
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
    persistGameplayMutation({
      label: "equipment-unequip",
      mutate: () => { run.inventory.push(entry.equippedItem); entry.equippedItem = null; },
      onCommitted: () => { (options.render || renderInventory)({ keepScroll: true }); closeModal(); toast("Oggetto riportato nell'inventario"); },
      rerender: ({ ok }) => { if (!ok) (options.render || renderInventory)({ keepScroll: true }); },
    });
  }

  function renderGameOver({ developmentResolved = false } = {}) {
    // The terminal route itself owns the canonical phase. This keeps a reload
    // between navigation and the permanent-effect drain on the game-over path.
    if (run.phase !== "gameover") {
      const committed = persistGameplayMutation({
        label: "gameover-route",
        mutate: (current) => {
          if (!current.gameOver && Number(current.lives || 0) > 0) throw new Error("Game over route requires a terminal run");
          current.gameOver = true;
          current.phase = "gameover";
          enqueueGameOverDevelopmentEffect(current);
        },
      });
      if (!committed.ok) return;
    }
    const bossReached = Math.min(Number(run.bossIndex || 0) + 1, seasonDb.bossOrder.length);
    if (!developmentResolved) return resolveDevelopmentEndRunFlow({ endReason: "gameover", onComplete: () => renderGameOver({ developmentResolved: true }) });
    const wins = Number(run.statistics?.winsTotal || 0);
    app.innerHTML = `
      <main class="gameover-screen">
        <section class="gameover-card" aria-labelledby="gameover-title">
          <div class="gameover-mark" aria-hidden="true">×</div>
          <p class="eyebrow">0 VITE RIMASTE</p>
          <h1 id="gameover-title">RUN TERMINATA</h1>
          <p class="gameover-copy">La squadra non può più continuare questa run.</p>
          <dl class="gameover-summary">
            <div><dt>Boss raggiunto</dt><dd>${escapeHtml(bossReached)}/${escapeHtml(seasonDb.bossOrder.length)}</dd></div>
            <div><dt>Livello</dt><dd>${escapeHtml(global.LevelProgression.formatLevel(run, run.seasonId))}</dd></div>
            <div><dt>OVR</dt><dd>${escapeHtml(averageOverall())}</dd></div>
            <div><dt>Partite vinte</dt><dd>${escapeHtml(wins)}</dd></div>
          </dl>
          <div class="gameover-actions"><button type="button" class="btn btn-yellow" id="restart-run">NUOVA RUN</button><button type="button" class="btn" id="home">MENU</button></div>
        </section>
      </main>`;
    resetRenderedViewScroll();
    document.getElementById("restart-run").addEventListener("click", startNewRunFromHome);
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
    return { playerId: String(entry.playerId), profileId: entry.activeProfileId || null, roleVariantId: entry.activeRoleVariantId || null, name: resolved.name || source?.name || String(entry.playerId), nickname: resolved.nickname || null, role: resolved.position || source?.position || null, element: resolved.element || resolved.type || source?.element || null, portraitUrl: playerPortraitUrl(resolved || source), fullbodyUrl: resolvePlayerVisual(resolved || source, { playerId: entry.playerId }).frontFullbodyUrl || null, teamId: entry.teamId || source?.teamId || null, teamName: entry.teamName || source?.teamName || null, originalRarity: source?.category || null, finalRarity: resolved.category || source?.category || null, recruitedAtLevel: entry.recruitedAtLevel ?? null, finalLevel: Number(entry.level || 0), finalLevelUnits: Number(entry.levelUnits || 0), seasonId: run.seasonId, recruitedOverall: entry.recruitedOverall ?? null, finalOverall: resolved.overall ?? source?.finalOverall ?? null, finalPotential: resolved.potential ?? null, finalStats: resolved.stats || null, equippedItem: entry.equippedItem ? { ...entry.equippedItem } : null, formationSlot: area === "lineup" ? slot : null, benchSlot: area === "bench" ? slot : null, recruitmentSource: entry.source || null, traits: Array.isArray(entry.traits) ? entry.traits.slice() : [] };
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
    const runStatistics = { ...statsSnapshot.runStatistics, mode: seasonMeta.name, season: seasonMeta.name, victoryDate: run.completedAt || new Date().toISOString(), seed: run.runId, durationMs: run.createdAt ? Date.now() - new Date(run.createdAt).getTime() : statsSnapshot.runStatistics.durationMs, finalTeamLevel: run.teamLevel ?? null, finalTeamLevelUnits: run.teamLevelUnits ?? 0, finalAverageOverall: avg, finalFormation: run.formationId, livesRemaining: run.lives ?? null, recruitedPlayers: run.roster.length, bossesDefeated: (run.completedBossIds || []).slice() };
    const snapshot = { archiveSchemaVersion: 1, runId: run.runId, teamName: identity.name, teamLogo: identity.logo || "inazuma-lightning", modeId: seasonMeta.id, modeName: seasonMeta.name, seasonId: seasonMeta.id, seasonName: seasonMeta.name, difficultyId: null, victoryDate: run.completedAt || new Date().toISOString(), seed: run.runId, finalBossId: String(finalBoss?.teamId || "raimon"), finalBossName: finalBoss?.teamName || "Raimon", finalFormation: run.formationId, finalFormationTactics: global.MatchSimulator?.formationTactic?.(run.formationId) || null, finalStartingEleven: starters, fullRoster, bench, savedFiveVFiveFormation: run.fiveVFive ? JSON.parse(JSON.stringify(run.fiveVFive)) : null, finalTeamLevel: run.teamLevel ?? null, finalTeamLevelUnits: run.teamLevelUnits ?? 0, finalAverageOverall: avg, livesRemaining: run.lives ?? null, statisticsSchemaVersion: statsSnapshot.statisticsSchemaVersion || 1, statisticsComplete: statsSnapshot.statisticsComplete, statisticsStartedAt: statsSnapshot.statisticsStartedAt, runStatistics, playerStatistics: statsSnapshot.playerStatistics, matchHistory: statsSnapshot.matchHistory, awards: statsSnapshot.awards, rulesetVersion: "season1-config-v2", databaseVersion: seasonDb?.version || null, formationTacticsVersion: "match-simulator-config-v1", equipmentVersion: "season1-item-pool-v1", traitSystemVersion: null, sourceAppVersion: "hall-of-fame-v2-run-statistics" };
    snapshot.archiveKey = global.HallOfFameStorage.archiveKeyFor(snapshot);
    snapshot.hallTeamId = global.HallOfFameStorage.stableId(snapshot.archiveKey);
    return snapshot;
  }

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

  function snapshotCard(player) {
    return compactPlayerCardMarkup({ ...player, position: player.role, category: player.finalRarity, overall: player.finalOverall, displayLevel: player.finalLevel, stats: player.finalStats }, { equipment: player.equippedItem, equipmentInFooter: true, level: global.LevelProgression.formatLevel(player.finalLevel, player.seasonId, player.finalLevelUnits), overall: player.finalOverall, dataAttr: `data-hall-player="${escapeHtml(player.playerId)}"`, extraClass: "squad-player-card hall-player-card" });
  }

  function championFormationMarkup(team) {
    const starters = Array.isArray(team.finalStartingEleven) ? team.finalStartingEleven : [];
    const database = global.SeasonRegistry?.database?.(team.seasonId || team.modeId) || seasonDb;
    const formation = database?.formations?.eleven?.find((item) => item.id === team.finalFormation);
    const playersByRole = new Map(["FW", "MF", "DF", "GK"].map((role) => [role, starters.filter((player) => player.role === role)]));
    const layouts = global.FormationLayout.displayRows(formation || { requirements: { FW: 3, MF: 3, DF: 4, GK: 1 } });
    const rows = layouts.map((layout) => ({ ...layout, players: (playersByRole.get(layout.role) || []).splice(0, layout.count) }));
    return `<section class="pitch hall-pitch">${rows.map((row) => `<div class="pitch-row tactical-row" data-display-role="${escapeHtml(row.displayRole || row.role)}" data-row-count="${row.players.length || 1}" style="--players-in-row:${row.players.length || 1}">${row.players.map(snapshotCard).join("")}</div>`).join("")}</section>`;
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
      { title: "Identità finale", className: "hall-stat-group--identity", items: [
        { label: "Livello finale squadra", value: global.LevelProgression.formatLevel(stats.finalTeamLevel ?? team.finalTeamLevel, team.seasonId || team.modeId, team.finalTeamLevelUnits ?? 0) },
        { label: "Overall medio finale", value: stats.finalAverageOverall ?? team.finalAverageOverall },
        { label: "Modulo finale", value: stats.finalFormation || team.finalFormation },
        { label: "Vite rimaste", value: stats.livesRemaining ?? team.livesRemaining },
      ] },
      { title: "Bilancio della run", className: "hall-stat-group--results", items: [
        { label: "Partite", value: stats.matchesTotal },
        { label: "Vittorie", value: stats.winsTotal },
        { label: "Sconfitte", value: stats.lossesTotal },
        { label: "Gol fatti", value: stats.goalsFor },
        { label: "Gol subiti", value: stats.goalsAgainst },
        { label: "Differenza reti", value: stats.goalDifference },
        { label: "Clean sheet", value: stats.cleanSheets },
      ] },
      { title: "Sfide boss", className: "hall-stat-group--boss", items: [
        { label: "Partite Boss", value: stats.bossMatches },
        { label: "Vittorie Boss", value: stats.bossWins },
        { label: "Sconfitte Boss", value: stats.bossLosses },
      ] },
      ...(Number(stats.specialMatches || 0) > 0 ? [{ title: "Partite speciali", className: "hall-stat-group--special", items: [
        { label: "Giocate", value: stats.specialMatches },
        { label: "Vinte", value: stats.specialWins },
        { label: "Perse", value: stats.specialLosses },
      ] }] : []),
      { title: "Percorso", className: "hall-stat-group--secondary", items: [
        { label: "Nodi completati", value: stats.nodesCompleted },
        { label: "Giocatori reclutati", value: stats.recruitedPlayers ?? stats.playersRecruited ?? team.fullRoster?.length },
      ] },
    ];
  }

  function statsMarkup(team) {
    const sections = runStatsSections(team).map((section) => {
      const items = section.items.map((item) => ({ ...item, formatted: formatStatValue(item.value, item.type) })).filter((item) => item.formatted != null);
      if (!items.length) return "";
      return `<section class="hall-stat-group ${escapeHtml(section.className || "")}"><h3>${escapeHtml(section.title)}</h3><div class="hall-stat-list">${items.map((item) => `<div class="hall-stat"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.formatted)}</strong></div>`).join("")}</div></section>`;
    }).filter(Boolean).join("");
    return sections || '<p class="muted">Statistiche essenziali non disponibili per questa run.</p>';
  }

  function awardsMarkup(team) {
    const featuredAwardIds = new Set(["top_scorer", "best_goalkeeper", "defensive_pillar", "final_hero", "mvp"]);
    const awards = (team.awards || []).filter((award) => award && award.playerName && featuredAwardIds.has(award.id));
    return awards.map((award) => {
      const playerAttr = award.playerId ? ` data-hall-player="${escapeHtml(award.playerId)}"` : "";
      const description = award.description || award.reason || (award.score != null ? `Punteggio ${award.score}` : "Riconoscimento della run");
      return `<article class="hall-award ${playerAttr ? "hall-award--interactive" : ""}"${playerAttr}><span class="hall-award-mark" aria-hidden="true">★</span><img src="${escapeHtml(award.portraitUrl || '')}" alt="" loading="lazy"/><div class="hall-award-copy"><strong>${escapeHtml(award.label || award.title)}</strong><span>${escapeHtml(award.playerName)}</span><small>${escapeHtml(description)}</small></div></article>`;
    }).join("") || '<p class="muted">Premi individuali disponibili solo quando i dati registrati sono affidabili.</p>';
  }

  function renderFinalCelebration(hallTeamId, { developmentResolved = false } = {}) {
    if (!developmentResolved || run.finalization?.status !== "complete") return resumeRunFinalization();
    const team = championTeam(hallTeamId || run?.hallTeamId);
    if (!team) return renderHome();
    app.innerHTML = `<main class="final-celebration-screen"><section class="final-celebration-panel"><header class="final-victory-hero"><div class="final-trophy" aria-hidden="true">★</div><div class="final-victory-copy"><p class="eyebrow">${escapeHtml(normalizedHallSeasonName(team).toUpperCase())} COMPLETATA</p><h1>${escapeHtml(team.teamName)}</h1><h2>Campioni della run</h2><p>${escapeHtml(team.modeName)} · ${formatDate(team.victoryDate)} · ${escapeHtml(team.finalFormation || '-')}</p></div></header><div class="final-victory-team"><div class="final-victory-section-head"><span>Squadra vincente</span><strong>La formazione che ha scritto la storia</strong></div>${championFormationMarkup(team)}</div><div class="button-row final-actions"><button type="button" class="btn btn-yellow" id="final-continue">Continua <span aria-hidden="true">→</span></button><button type="button" class="btn" id="skip-final-animation">Vai al riepilogo</button></div></section></main>`;
    resetRenderedViewScroll(); bindHallPlayerDetails(team);
    const go = () => { run.phase = "final-summary"; try { global.RunState.save(run); } catch (error) { console.error("save failed (renderFinalCelebration)", error); } renderFinalSummary(team.hallTeamId, { developmentResolved: true }); };
    document.getElementById("final-continue").addEventListener("click", go);
    document.getElementById("skip-final-animation").addEventListener("click", go);
  }

  function renderFinalSummary(hallTeamId, { developmentResolved = false } = {}) {
    if (!developmentResolved || run.finalization?.status !== "complete") return resumeRunFinalization();
    const team = championTeam(hallTeamId || run?.hallTeamId);
    if (!team) return renderHome();
    const summaries = global.HallOfFameStorage.listSummaries();
    const ordinal = summaries.findIndex((item) => item.hallTeamId === team.hallTeamId) + 1;
    run.phase = "final-summary"; run.hallTeamId = team.hallTeamId;
    try { global.RunState.save(run); } catch (error) { console.error("save failed (renderFinalSummary)", error); }
    app.innerHTML = `<main class="final-summary-screen"><header class="final-summary-head"><div><p class="eyebrow">CAMPIONI · ${escapeHtml(normalizedHallSeasonName(team).toUpperCase())}</p><h1>${escapeHtml(team.teamName)}</h1><p class="final-summary-meta"><span>${formatDate(team.victoryDate)}</span><span>${escapeHtml(normalizedHallSeasonName(team))}</span><span>Seed ${escapeHtml(compactSeed(team.seed))}</span><span>#${escapeHtml(ordinal || '-')} Albo d’Oro</span></p></div><span class="final-summary-star" aria-hidden="true">★</span></header><nav class="final-tabs" role="tablist"><button class="active" data-final-tab="team" role="tab" aria-selected="true">Squadra</button><button data-final-tab="stats" role="tab" aria-selected="false">Statistiche</button><button data-final-tab="awards" role="tab" aria-selected="false">Premi</button></nav><section class="final-summary-grid"><article class="panel final-tab-panel" data-tab-panel="team">${tacticPanelMarkup(team.finalFormation, { compact: true })}${championFormationMarkup(team)}<h3>Riserve</h3><div class="bench-list">${(team.bench || []).map(snapshotCard).join("") || '<p class="muted">Non disponibili</p>'}</div><h3>Formazione 5v5</h3>${championFiveVFiveMarkup(team)}</article><article class="panel final-tab-panel" data-tab-panel="stats">${statsMarkup(team)}</article><article class="panel final-tab-panel" data-tab-panel="awards">${awardsMarkup(team)}</article><aside class="panel final-actions-panel"><button class="btn btn-yellow" id="open-current-hall">Apri Albo d’Oro</button><button class="btn btn-primary" id="final-new-run">Nuova run</button>${sectionRootButton("finalSummary")}</aside></section></main>`;
    resetRenderedViewScroll(); bindFinalTabs(); bindHallPlayerDetails(team);
    document.getElementById("open-current-hall").addEventListener("click", () => renderHallOfFameDetail(team.hallTeamId));
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
    if (!global.RestoreGameplayRoutingGate?.enter("hall")) return false;
    const teams = global.HallOfFameStorage.listSummaries();
    app.innerHTML = `<main class="hall-screen"><header class="hall-archive-head"><div><p class="eyebrow">ALBO D’ORO</p><h1>Squadre campioni</h1><p>Le imprese che hanno scritto la storia.</p></div>${sectionRootButton("hallRoot")}</header>${teams.length ? `<section class="hall-grid">${teams.map((team, index) => `<article class="hall-card"><div class="hall-card-rank"><span>★</span> CAMPIONE #${index + 1}</div><div><h2>${escapeHtml(team.teamName)}</h2><p class="hall-card-meta">${escapeHtml(normalizedHallSeasonName(team))} · ${formatDate(team.victoryDate)}</p></div><div class="hall-card-highlights"><span><small>MODULO</small><strong>${escapeHtml(team.finalFormation || '-')}</strong></span><span><small>OVERALL</small><strong>${escapeHtml(team.finalAverageOverall ?? 'N/D')}</strong></span><span><small>MVP</small><strong>${escapeHtml(team.mvp?.name || 'N/D')}</strong></span></div><div class="hall-card-footer"><div class="hall-portraits">${(team.portraits || []).map((src) => `<img src="${escapeHtml(src)}" alt="" loading="lazy"/>`).join('')}</div><button class="btn btn-yellow" data-open-hall-team="${escapeHtml(team.hallTeamId)}">Rivivi l'impresa</button></div></article>`).join('')}</section>` : `<section class="panel hall-empty"><h2>Nessuna squadra campione.</h2><p class="muted">Completa una run per lasciare il tuo segno.</p></section>`}</main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();
    document.querySelectorAll("[data-open-hall-team]").forEach((button) => button.addEventListener("click", () => renderHallOfFameDetail(button.dataset.openHallTeam)));
  }

  function renderHallOfFameDetail(hallTeamId) {
    const team = global.HallOfFameStorage.getTeam(hallTeamId);
    if (!team) return renderHallOfFame();
    app.innerHTML = `<main class="hall-detail-screen"><header class="hall-hero"><div class="hall-hero-copy"><p class="eyebrow">ALBO D’ORO</p><h1>${escapeHtml(team.teamName)}</h1><div class="hall-hero-meta"><span>${formatDate(team.victoryDate)}</span><span>${escapeHtml(normalizedHallSeasonName(team))}</span></div><p class="hall-boss-label">BOSS FINALE BATTUTO</p><strong class="hall-boss-name">${escapeHtml(team.finalBossName || 'N/D')}</strong></div><div class="hall-hero-trophy" aria-hidden="true">★</div>${sectionRootButton("hallDetail")}</header><section class="hall-detail-grid"><article class="hall-champion-team"><div class="hall-section-heading"><p class="eyebrow">SQUADRA VINCENTE</p><h2>Formazione finale</h2></div>${tacticPanelMarkup(team.finalFormation, { compact: true })}${championFormationMarkup(team)}<details class="hall-roster-extra"><summary>Riserve <span>${(team.bench || []).length}</span></summary><div class="bench-list">${(team.bench || []).map(snapshotCard).join('') || '<p class="muted">Non disponibili</p>'}</div></details><details class="hall-roster-extra"><summary>Formazione 5v5</summary>${championFiveVFiveMarkup(team)}</details></article><aside class="hall-achievement-column"><section class="hall-data-panel"><div class="hall-section-heading"><p class="eyebrow">LA RUN</p><h2>Statistiche essenziali</h2></div>${statsMarkup(team)}</section><section class="hall-awards-panel"><div class="hall-section-heading"><p class="eyebrow">RICONOSCIMENTI</p><h2>Premi della run</h2></div><div class="hall-awards-list">${awardsMarkup(team)}</div></section></aside></section></main>`;
    resetRenderedViewScroll(); bindHallPlayerDetails(team);
    bindSectionRootNav();
  }

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

  global.__INAZUMA_UI_TEST__ = { bindAlbumRosterInteractions, configureAlbumForBootstrap, persistenceWritesAllowed, repairResultMessage, showLoadError, renderHome, startNewRunFromHome, startRunWithIdentity, getRun: () => run };
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
      renderFiveVFive,
      openFiveVFiveEditor,
      openFiveMatchPlayerSwap,
      resolveDevelopmentEndRunFlow,
      renderMap,
      renderMapFailureRecovery,
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
