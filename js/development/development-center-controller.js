(function (global) {
  "use strict";
  function create(deps) {
    const { view, app, modalRoot, getUi, getFreeAgentsDb, ensureAlbumBackfill, albumPlayerView, openModal, closeModal, toast, renderHome, renderShop, showPlayerDetailsFor, scrollSnapshot, getStatLabels, developmentDevMarkup, bindDevelopmentDev } = deps;
    const ui = getUi();
  function eligibleFreeAgentIds() {
    return new Set((getFreeAgentsDb()?.players || []).map((player) => String(player.playerId)));
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
    return (getFreeAgentsDb()?.players || []).flatMap((player) => {
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
    const player = { ...albumPlayerView(indexedPlayer.rawPlayer || indexedPlayer, getFreeAgentsDb(), indexedPlayer.developmentState), developmentCollections: indexedPlayer.developmentCollections };
    developmentResolvedCache.set(id, { version, player });
    return player;
  }

  function developmentSquadCardMarkup(player, dataAttr = "") {
    return view.compactPlayerCardMarkup(player, {
      level: player.displayLevel ?? player.maxLevel ?? 20,
      overall: player.overall,
      dataAttr,
      extraClass: "squad-player-card development-squad-card",
    });
  }

  function developmentPlayerGridMarkup(players, visibleCount = developmentVisibleCount) {
    const visible = players.slice(0, visibleCount).map(resolveDevelopmentPlayer);
    const cards = visible.map((player) => `<div data-development-player="${view.escapeHtml(player.playerId)}">${developmentSquadCardMarkup(player, `data-development-card="${view.escapeHtml(player.playerId)}"`)}${player.category === "Leggenda" ? '<span class="development-max" aria-label="Rarità massima">MAX</span>' : ""}</div>`).join("");
    if (!cards) return '<p class="empty-state">Nessuno svincolato sbloccato corrisponde ai filtri.</p>';
    const remaining = players.length - visible.length;
    return `${cards}${remaining > 0 ? `<div class="development-load-more-wrap"><button class="btn btn-yellow development-load-more" id="development-load-more"><span>MOSTRA ALTRI <b>${view.escapeHtml(Math.min(DEVELOPMENT_PAGE_SIZE, remaining))}</b></span><small>${view.escapeHtml(visible.length)} di ${view.escapeHtml(players.length)}</small></button></div>` : ""}`;
  }

  const DEVELOPMENT_RESOURCE_ITEMS = Object.freeze({
    coins: Object.freeze({ id: "development-coins", name: "Dragon Sticker", imageUrl: global.DevelopmentV2.DEVELOPMENT_RESOURCE_ASSETS.coins }),
    cups: Object.freeze({ id: "development-cups", name: "Coppa", imageUrl: global.DevelopmentV2.DEVELOPMENT_RESOURCE_ASSETS.cups }),
  });

  function developmentCurrencyIcon(type, rarity = "") {
    if (type === "project") return `<span class="development-resource-icon project-image-frame"><img src="${view.escapeHtml(global.DevelopmentV2.ASSETS[rarity])}" alt="" loading="lazy" decoding="async"></span>`;
    const resource = DEVELOPMENT_RESOURCE_ITEMS[type];
    if (!resource?.imageUrl) return "";
    return `<span class="item-icon item-icon--image development-resource-icon" aria-label="${view.escapeHtml(resource.name)}"><img src="${view.escapeHtml(resource.imageUrl)}" alt="${view.escapeHtml(resource.name)}" loading="eager" decoding="async" onerror="globalThis.handleItemImageError && globalThis.handleItemImageError(this)">${view.itemImageFallbackSvg()}</span>`;
  }

  function resourceCostMarkup({ type, rarity = "", label, current = null, required, satisfied = true, compact = false }) {
    const values = current == null ? `×${view.escapeHtml(required)}` : `${view.escapeHtml(current)} / ${view.escapeHtml(required)}`;
    const tag = compact ? "span" : "article";
    return `<${tag} class="development-requirement ${satisfied ? "is-ready" : "is-missing"}">${developmentCurrencyIcon(type, rarity)}<span><small>${view.escapeHtml(label)}</small><strong>${values}</strong></span>${compact ? "" : `<b aria-label="${satisfied ? "Requisito soddisfatto" : "Requisito mancante"}">${satisfied ? "✓" : "!"}</b>`}</${tag}>`;
  }

  function projectInventoryMarkup(state) { return global.DevelopmentV2.PROJECT_RARITIES.map((rarity) => `<article class="project-inventory-item ${view.rarityClass(rarity)}"><span class="project-inventory-image"><img src="${view.escapeHtml(global.DevelopmentV2.ASSETS[rarity])}" alt="" loading="lazy"></span><strong>${view.escapeHtml(rarity)}</strong><b>×${view.escapeHtml(state.projects[rarity] || 0)}</b></article>`).join(""); }

  function developmentSelectedMarkup(player) {
    const state = global.DevelopmentAccountV3.read();
    const target = global.DevelopmentV2.nextRarity(player.category);
    const selectedCard = `<div class="development-selected-card">${developmentSquadCardMarkup(player, `data-development-selected-card="${view.escapeHtml(player.playerId)}" aria-label="Apri la scheda di ${view.escapeHtml(player.name)}"`)}</div>`;
    if (!target) return `<section class="development-selected development-squad-card-scope"><p class="eyebrow">GIOCATORE SELEZIONATO</p><div class="development-selected-layout">${selectedCard}<div class="development-selected-copy"><h2>${view.escapeHtml(player.name)}</h2><p class="development-max-copy">MAX · RARITÀ MASSIMA</p><button class="btn btn-ghost" id="change-development-player">CAMBIA GIOCATORE</button></div></div></section>`;
    const cost = global.DevelopmentV2.COSTS[target];
    const have = state.projects[target] || 0;
    const nextOverall = Math.max(Number(player.overall || 0), Number(global.DevelopmentV2.threshold(target)));
    const missing = [Math.max(0, cost.projects - have) ? `MANCA ${cost.projects - have} PROGETTO ${target.toUpperCase()}` : "", Math.max(0, cost.cups - global.DevelopmentV2.totalCups(state)) ? `MANCANO ${cost.cups - global.DevelopmentV2.totalCups(state)} COPPE` : "", Math.max(0, cost.coins - state.coins) ? `MANCANO ${cost.coins - state.coins} MONETE` : ""].filter(Boolean);
    return `<section class="development-selected development-squad-card-scope"><p class="eyebrow">GIOCATORE SELEZIONATO</p><div class="development-selected-layout">${selectedCard}<div class="development-selected-copy"><h2>${view.escapeHtml(player.name)}</h2><strong class="development-rarity-step">${view.escapeHtml(player.category)} <span>→</span> ${view.escapeHtml(target)}</strong><p class="development-potential">Overall / potenziale <b>${view.escapeHtml(player.overall)} / ${view.escapeHtml(player.potential)}</b> → <b>${view.escapeHtml(nextOverall)} / ${view.escapeHtml(global.DevelopmentV2.threshold(target))}</b></p><h3>REQUISITI EVOLUZIONE</h3><div class="development-requirements">${resourceCostMarkup({ type: "project", rarity: target, label: `Progetto ${target}`, current: have, required: cost.projects, satisfied: have >= cost.projects })}${resourceCostMarkup({ type: "cups", label: "Coppe", current: global.DevelopmentV2.totalCups(state), required: cost.cups, satisfied: global.DevelopmentV2.totalCups(state) >= cost.cups })}${resourceCostMarkup({ type: "coins", label: "Monete", current: state.coins, required: cost.coins, satisfied: state.coins >= cost.coins })}</div>${missing.length ? `<p class="development-missing">${view.escapeHtml(missing.join(" · "))}</p>` : '<p class="development-ready-copy">Tutti i requisiti sono soddisfatti.</p>'}<div class="button-row"><button class="btn btn-ghost" id="change-development-player">CAMBIA GIOCATORE</button><button class="btn btn-yellow" id="prepare-evolution" ${missing.length ? "disabled" : ""}>EVOLVI A ${view.escapeHtml(target.toUpperCase())}</button></div></div></div></section>`;
  }

  function bindDevelopmentSelectedCardInteraction(card, selectedPlayer, openDetails) {
    if (!card) return;
    const playerId = card.dataset.developmentSelectedCard;
    card.addEventListener("click", () => openDetails(selectedPlayer, playerId));
  }

  function developmentManagementPathMarkup(path) {
    return path.map((entry, index) => `<span class="development-management-path-step ${view.rarityClass(entry.rarity)}"><small>${entry.kind === "base" ? "BASE " : ""}${view.escapeHtml(entry.rarity)}</small> <strong>${view.escapeHtml(entry.potential)}</strong>${entry.kind === "legacyNormale" ? '<em>BASELINE</em>' : ""}</span>${index < path.length - 1 ? '<b class="development-management-arrow" aria-hidden="true">→</b>' : ""}`).join("");
  }

  function developmentManagementRowsMarkup(rows) {
    if (!rows.length) return '<p class="empty-state">Nessun giocatore evoluto corrisponde al filtro.</p>';
    return rows.map((row) => {
      if (row.missingIdentity) return `<article class="development-management-card is-missing" data-management-player="${view.escapeHtml(row.playerId)}"><div class="development-management-missing-icon" aria-hidden="true">!</div><div class="development-management-copy"><p class="eyebrow">IDENTITÀ NON DISPONIBILE</p><h3>${view.escapeHtml(row.name)}</h3><p>La catena canonica è stata conservata. ID: <code>${view.escapeHtml(row.playerId)}</code></p><strong>${view.escapeHtml(row.activeRarity)} · ${view.escapeHtml(row.activePotential)}</strong></div><div class="development-management-actions"><button type="button" class="btn btn-ghost" disabled>APRI SCHEDA</button></div></article>`;
      const portrait = view.playerPortraitUrl(row.base), fallbacks = view.imageFallbackAttributes(view.resolvePlayerVisual(row.base).cardFallbacks);
      return `<article class="development-management-card ${view.rarityClass(row.activeRarity)}" data-management-player="${view.escapeHtml(row.playerId)}"><span class="development-management-portrait"><img src="${view.escapeHtml(portrait)}" alt="" loading="lazy" ${fallbacks}></span><div class="development-management-copy"><div class="development-management-title"><div><h3>${view.escapeHtml(row.name)}</h3><span>${view.escapeHtml(row.role)}</span></div><strong>${view.escapeHtml(row.activeRarity)} · ${view.escapeHtml(row.activePotential)}</strong></div><p class="development-management-origin"><small>ORIGINE</small> BASE · ${view.escapeHtml(row.base.category)} ${view.escapeHtml(row.base.finalOverall)}</p><div class="development-management-path" aria-label="Percorso evolutivo di ${view.escapeHtml(row.name)}"><small>PERCORSO</small><div>${developmentManagementPathMarkup(row.path)}</div></div></div><div class="development-management-actions"><button type="button" class="btn btn-yellow development-management-open" data-open-management-player="${view.escapeHtml(row.playerId)}" ${row.detailPlayer ? "" : "disabled"}>APRI SCHEDA</button><button type="button" class="btn btn-ghost development-management-regress" data-regress-management-player="${view.escapeHtml(row.playerId)}">REGREDISCI</button></div></article>`;
    }).join("");
  }

  function regressionCupLabel(sourceId) {
    const labels = { ie1: "IE1", ie1_s2: "IE2", ie1_s3: "IE3", ie2: "ARES", orion: "ORION" };
    return labels[sourceId] || String(sourceId).replace(/_/g, " ").toUpperCase();
  }

  function openDevelopmentRegression(row) {
    const preview = row.regression;
    const destinationFlag = preview.to.isBase ? "<em>BASE ORIGINALE</em>" : preview.to.isBaseline ? "<em>BASELINE</em>" : "";
    const cupSources = Object.entries(preview.refund.cupsBySource).map(([sourceId, amount]) => `<li><span>${view.escapeHtml(regressionCupLabel(sourceId))}</span><strong>+${view.escapeHtml(amount)}</strong></li>`).join("");
    openModal(`<section class="development-regression"><header class="development-regression-head"><p class="eyebrow">REGRESSIONE EVOLUZIONE</p><h1>${view.escapeHtml(row.name)}</h1></header><div class="development-regression-transition"><article class="development-regression-state ${view.rarityClass(preview.from.rarity)}"><small>PRIMA</small><strong>${view.escapeHtml(preview.from.rarity)}</strong><span>OVR ${view.escapeHtml(preview.from.potential)}</span></article><b aria-hidden="true">→</b><article class="development-regression-state ${view.rarityClass(preview.to.rarity)}"><small>DOPO</small>${preview.to.isBase ? "<strong>BASE</strong>" : ""}<strong>${view.escapeHtml(preview.to.rarity)}</strong><span>OVR ${view.escapeHtml(preview.to.potential)}</span>${destinationFlag}</article></div><section class="development-regression-refund"><h2>RIMBORSO</h2><div class="development-regression-resources"><article>${developmentCurrencyIcon("coins")}<span><small>MONETE</small><strong>+${view.escapeHtml(preview.refund.coins)}</strong></span></article><article>${developmentCurrencyIcon("cups")}<span><small>COPPE</small><strong>+${view.escapeHtml(preview.refund.cups)}</strong></span></article><article class="is-project"><span class="development-regression-project-mark" aria-hidden="true">!</span><span><small>PROGETTI</small><strong>NON RIMBORSATI</strong></span></article></div>${cupSources ? `<ul class="development-regression-cup-sources">${cupSources}</ul>` : ""}</section><div class="node-actions development-regression-actions"><button type="button" class="btn btn-ghost" data-cancel-regression>ANNULLA</button><button type="button" class="btn btn-yellow" data-confirm-regression>CONFERMA REGRESSIONE</button></div></section>`, { closeable: true, className: "development-regression-modal" });
    modalRoot.querySelector("[data-cancel-regression]")?.addEventListener("click", () => closeModal());
    const confirm = modalRoot.querySelector("[data-confirm-regression]");
    confirm?.addEventListener("click", () => {
      if (confirm.disabled) return;
      confirm.disabled = true;
      const result = global.DevelopmentAccountV3.regress({ playerId: row.playerId, expectedActiveId: preview.activeId }, { database: getFreeAgentsDb() });
      if (!result.ok) { closeModal({ invokeOnClose: false }); toast(result.reason === "stale-regression" ? "Evoluzione già cambiata: aggiornata la lista" : "Regressione non salvata", "error"); return renderDevelopmentCenter("management"); }
      developmentPlayersCache = null;
      developmentResolvedCache.delete(String(row.playerId));
      closeModal({ invokeOnClose: false }); toast(`${row.name}: ${result.to.rarity} ${result.to.potential}`); renderDevelopmentCenter("management");
    });
  }

  function developmentManagementMarkup(model) {
    const rarityOptions = global.DevelopmentManagementV3.FILTER_RARITIES.map((rarity) => `<option value="${view.escapeHtml(rarity)}" ${ui.developmentManagementRarity === rarity ? "selected" : ""}>${rarity === "Tutti" ? "Tutte" : view.escapeHtml(rarity)}</option>`).join("");
    const rows = global.DevelopmentManagementV3.filterRows(model.rows, ui.developmentManagementRarity);
    return `<section class="development-management"><div class="development-section-heading"><div><p class="eyebrow">STATO PERMANENTE CORRENTE</p><h2>GESTIONE EVOLUZIONI</h2></div></div><div class="development-slot-grid" aria-label="Capacità slot evoluzione">${model.slots.map((slot) => `<article class="development-slot-card ${view.rarityClass(slot.rarity)} ${slot.overCapacity ? "is-over-capacity" : ""}" aria-label="${view.escapeHtml(slot.rarity)}: ${view.escapeHtml(slot.used)} slot usati su ${view.escapeHtml(slot.capacity)}${slot.overCapacity ? ", capacità superata" : ""}"><span>${view.escapeHtml(slot.rarity.toUpperCase())}</span><strong>${view.escapeHtml(slot.display)}</strong>${slot.overCapacity ? "<em>CAPACITÀ SUPERATA</em>" : ""}</article>`).join("")}</div><div class="development-filters development-management-filter"><label class="development-rarity-field"><span>RARITÀ</span><select id="development-management-rarity" aria-label="Filtra evoluzioni per rarità attiva">${rarityOptions}</select></label></div><div class="development-management-list" id="development-management-results">${developmentManagementRowsMarkup(rows)}</div></section>`;
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
    const rarityOptions = ["Tutti", ...global.DevelopmentV2.RARITIES].map((value) => `<option value="${view.escapeHtml(value)}" ${value === ui.developmentRarity ? "selected" : ""}>${value === "Tutti" ? "Tutte" : view.escapeHtml(value)}</option>`).join("");
    const playerBody = selected ? developmentSelectedMarkup(selected) : `<div class="development-filters"><label class="development-search-field"><span aria-hidden="true">⌕</span><input class="development-search" id="development-search" value="${view.escapeHtml(ui.developmentQuery)}" placeholder="Cerca giocatore…" aria-label="Cerca giocatore per nome" autocomplete="off"></label><label class="development-rarity-field"><span>RARITÀ</span><select id="development-rarity">${rarityOptions}</select></label></div><section class="album-player-grid development-player-grid development-squad-card-scope" id="development-player-results">${developmentPlayerGridMarkup(filtered)}</section>`;
    const managementModel = tab === "management" ? global.DevelopmentManagementV3.buildModel({ state: v3State, database: getFreeAgentsDb(), account: global.DevelopmentAccountV3, V3: global.DevelopmentV3 }) : null;
    const body = tab === "projects" ? `<section class="development-projects"><div class="development-section-heading"><div><p class="eyebrow">INVENTARIO</p><h2>PROGETTI COMPLETI</h2></div><p>Disponibili per le evoluzioni.</p></div><div class="project-inventory-grid">${projectInventoryMarkup(state)}</div><button class="btn btn-yellow" id="development-open-shop">APRI NEGOZIO</button></section>` : tab === "management" ? developmentManagementMarkup(managementModel) : playerBody;
    const projectTotal = Object.values(state.projects).reduce((sum, value) => sum + Number(value || 0), 0);
    const existing = document.querySelector(".development-screen");
    if (!existing) app.innerHTML = `<main class="development-screen"><header class="topbar">${view.sectionRootButton("development", "development-back-button")}<div><p class="eyebrow">CRESCITA PERMANENTE</p><h1>CENTRO DI SVILUPPO</h1></div></header><section class="development-wallet"><span>${developmentCurrencyIcon("coins")}<span>MONETE <strong data-wallet="coins">${state.coins}</strong></span></span><span>${developmentCurrencyIcon("cups")}<span>COPPE <strong data-wallet="cups">${global.DevelopmentV2.totalCups(state)}</strong></span></span><span><span>PROGETTI <strong data-wallet="projects">${projectTotal}</strong></span></span></section><nav class="development-tabs">${[["players","GIOCATORI"],["projects","PROGETTI"],["management","EVOLUZIONI"]].map(([id,label]) => `<button class="${tab === id ? "active" : ""}" data-development-tab="${id}">${label}</button>`).join("")}</nav><div id="development-tab-content"></div><div id="development-dev-root"></div></main>`;
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
      showPlayerDetailsFor(row.detailPlayer, { playerId: row.playerId, level: row.detailPlayer.displayLevel, database: getFreeAgentsDb(), equipment: null, readOnly: true, preserveScroll: scrollSnapshot() });
    });
    results?.addEventListener("click", (event) => { const element = event.target.closest("[data-development-player]"); if (element) { ui.selectedDevelopmentPlayerId = element.dataset.developmentPlayer; renderDevelopmentCenter("players"); } });
    bindLoadMore();
    document.getElementById("change-development-player")?.addEventListener("click", () => { ui.selectedDevelopmentPlayerId = null; closeModal(); renderDevelopmentCenter("players"); });
    bindDevelopmentSelectedCardInteraction(document.querySelector("[data-development-selected-card]"), selected, (selectedPlayer, playerId) => {
      const current = selectedPlayer || resolveDevelopmentPlayer(cachedDevelopmentPlayers().find((candidate) => String(candidate.playerId) === String(playerId)));
      if (!current) return toast("Giocatore non disponibile");
      showPlayerDetailsFor(current, { playerId: current.playerId, level: current.displayLevel, database: getFreeAgentsDb(), equipment: null, readOnly: true, preserveScroll: scrollSnapshot() });
    });
    document.getElementById("prepare-evolution")?.addEventListener("click", () => { const target = global.DevelopmentV2.nextRarity(selected.category); renderEvolutionConfirmation(selected, target, global.DevelopmentV2.COSTS[target]); });
    bindDevelopmentDev();
  }

  function isDevelopmentPlayerUnlocked(player) {
    return (player.developmentCollections || Object.keys(global.AlbumProgress.ALBUM_COLLECTIONS)).some((collectionId) => global.AlbumProgress.isAlbumPlayerUnlocked(collectionId, player.playerId));
  }

  function renderEvolutionConfirmation(player, target, cost) {
    const rawPlayer = (getFreeAgentsDb()?.players || []).find((candidate) => String(candidate.playerId) === String(player.playerId));
    if (!rawPlayer) return toast("Giocatore non trovato nel database svincolati");
    const basePotential = Number(rawPlayer.basePotential ?? rawPlayer.finalOverall ?? 0);
    const targetPotential = Math.max(Number(player.potential || 0), Number(global.DevelopmentV2.threshold(target)));
    const preview = global.InazumaProgression.getPlayerAtLevel(rawPlayer, Number(rawPlayer.maxLevel || 20), getFreeAgentsDb(), global.DevelopmentV2.optionsFromUpgrade(rawPlayer, { permanentTargetPotential: targetPotential }));
    const after = { ...rawPlayer, basePotential, ...preview, overall: preview.overall, finalOverall: preview.overall, displayLevel: Number(rawPlayer.maxLevel || 20), albumDatabase: getFreeAgentsDb() };
    const statChanges = Object.entries(getStatLabels()).flatMap(([stat, label]) => { const before = Number(player.stats?.[stat] || 0), next = Number(after.stats?.[stat] || 0), delta = next - before; return delta > 0 ? [{ label, before, next, delta }] : []; });
    const statsMarkup = statChanges.map(({ label, before, next, delta }) => `<li><strong>${view.escapeHtml(label)}</strong><span>${view.escapeHtml(before)} <b aria-hidden="true">→</b> ${view.escapeHtml(next)}</span><em>+${view.escapeHtml(delta)}</em></li>`).join("");
    const wallet=global.DevelopmentAccountV3.read(), cupLabels={ie1:"IE1",ie1_s2:"IE2",ie1_s3:"IE3",ie2:"ARES",orion:"ORION"}, cupSelection=global.DevelopmentV2.defaultCupSelection(wallet,cost.cups);
    const cupRows=global.DevelopmentV2.SEASON_IDS.filter((id)=>Number(wallet.cupsBySeason[id]||0)>0).map((id)=>`<div class="development-cup-row"><img src="${view.escapeHtml(global.DevelopmentV2.DEVELOPMENT_RESOURCE_ASSETS.cupsBySeason[id])}" alt=""><strong>${view.escapeHtml(cupLabels[id]||id)}</strong><button type="button" data-cup-minus="${view.escapeHtml(id)}" aria-label="Rimuovi Coppa ${view.escapeHtml(cupLabels[id]||id)}">−</button><b data-cup-count="${view.escapeHtml(id)}">${view.escapeHtml(cupSelection[id]||0)}</b><button type="button" data-cup-plus="${view.escapeHtml(id)}" aria-label="Aggiungi Coppa ${view.escapeHtml(cupLabels[id]||id)}">+</button></div>`).join("");
    openModal(`<div class="development-detail development-confirm"><p class="eyebrow">CONFERMA EVOLUZIONE</p><h2>${view.escapeHtml(player.name)}</h2><div class="development-evolution-preview development-squad-card-scope"><div><small>ATTUALE · ${view.escapeHtml(player.category)} · OVR ${view.escapeHtml(player.overall)}</small>${developmentSquadCardMarkup(player)}</div><span class="development-evolution-arrow" aria-hidden="true">→</span><div><small>NUOVA · ${view.escapeHtml(after.category)} · OVR ${view.escapeHtml(after.overall)}</small>${developmentSquadCardMarkup(after)}</div></div><section class="development-stat-increases"><h3>AUMENTO STATISTICHE</h3><ul>${statsMarkup || "<li><span>Nessuna statistica cambia.</span></li>"}</ul></section><h3 class="development-confirm-requirements-title">REQUISITI</h3><div class="development-confirm-costs">${resourceCostMarkup({ type: "project", rarity: target, label: `Progetto ${target}`, required: cost.projects, compact: true })}<section class="development-cup-selector"><h4>COPPE RICHIESTE: ${view.escapeHtml(cost.cups)}</h4>${cupRows}<p data-cup-total></p></section>${resourceCostMarkup({ type: "coins", label: "Monete", required: cost.coins, compact: true })}</div><div class="button-row"><button class="btn btn-ghost" id="back-evolution">ANNULLA</button><button class="btn btn-yellow" id="confirm-evolution">CONFERMA EVOLUZIONE</button></div></div>`, { closeable: false, className: "development-confirm-modal" });
    document.getElementById("back-evolution").onclick = closeModal;
    const confirmButton=document.getElementById("confirm-evolution");
    const refreshCupSelection=()=>{const selected=Object.values(cupSelection).reduce((sum,n)=>sum+Number(n||0),0),complete=selected===cost.cups; document.querySelector("[data-cup-total]").textContent=`COPPE SELEZIONATE ${selected} / ${cost.cups}`;document.querySelector("[data-cup-total]").classList.toggle("complete",complete);document.querySelectorAll("[data-cup-plus]").forEach((button)=>button.disabled=selected>=cost.cups||cupSelection[button.dataset.cupPlus]>=Number(wallet.cupsBySeason[button.dataset.cupPlus]||0));document.querySelectorAll("[data-cup-minus]").forEach((button)=>button.disabled=!cupSelection[button.dataset.cupMinus]);confirmButton.disabled=!complete;};
    document.querySelectorAll("[data-cup-plus]").forEach((button)=>button.onclick=()=>{const id=button.dataset.cupPlus,total=Object.values(cupSelection).reduce((sum,n)=>sum+Number(n||0),0);if(total<cost.cups&&cupSelection[id]<wallet.cupsBySeason[id]){cupSelection[id]+=1;document.querySelector(`[data-cup-count="${id}"]`).textContent=cupSelection[id];refreshCupSelection();}});
    document.querySelectorAll("[data-cup-minus]").forEach((button)=>button.onclick=()=>{const id=button.dataset.cupMinus;if(cupSelection[id]>0){cupSelection[id]-=1;document.querySelector(`[data-cup-count="${id}"]`).textContent=cupSelection[id];refreshCupSelection();}}); refreshCupSelection();
    let submitting = false;
    confirmButton.onclick = (event) => {
      if (submitting) return; submitting = true; event.currentTarget.disabled = true;
      const result = global.DevelopmentAccountV3.evolve({ playerId: rawPlayer.playerId, basePlayer: rawPlayer, unlocked: isDevelopmentPlayerUnlocked(player), freeAgentEligible: isDevelopmentFreeAgentEligible(player.playerId), cupSelection }, { database: getFreeAgentsDb() });
      if (!result.ok) { submitting = false; closeModal(); toast(result.reason === "not_free_agent" ? "Giocatore non eleggibile: non è svincolato" : result.reason === "rarity-capacity-full" ? `Slot ${result.rarity} esauriti (${result.used}/${result.capacity}).` : "Risorse cambiate: evoluzione non completata"); return renderDevelopmentCenter("players"); }
      const written = global.DevelopmentAccountV3.read().players[String(rawPlayer.playerId)];
      const activeWritten = written?.steps?.at(-1) || written?.legacyNormale;
      const writeIsCurrent = (activeWritten?.rarity || activeWritten?.profile?.category) === result.target && Number(activeWritten?.toPotential) >= Number(global.DevelopmentV2.threshold(result.target));
      if (!writeIsCurrent) { submitting = false; closeModal(); toast("Evoluzione non salvata: stato non coerente"); return renderDevelopmentCenter("players"); }
      developmentPlayersCache = null;
      developmentResolvedCache.delete(String(rawPlayer.playerId));
      const updated = albumPlayerView(rawPlayer, getFreeAgentsDb());
      closeModal({ invokeOnClose: false }); toast(`${updated.name}: ${updated.category}`);
      renderDevelopmentCenter("players");
      showPlayerDetailsFor(updated, { playerId: updated.playerId, level: updated.displayLevel, database: getFreeAgentsDb(), equipment: null, readOnly: true, preserveScroll: scrollSnapshot() });
    };
  }

    function invalidate() { developmentPlayersCache = null; developmentResolvedCache.clear(); }
    return Object.freeze({ render: renderDevelopmentCenter, currencyIcon: developmentCurrencyIcon, eligibleFreeAgentIds, invalidate });
  }
  global.DevelopmentCenterController = Object.freeze({ create });
})(globalThis);
