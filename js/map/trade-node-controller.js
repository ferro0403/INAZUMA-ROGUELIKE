(function (global) {
  "use strict";

  function create(deps) {
    const {
    getRun, getUi, getSeasonDb, getFreeAgentsDb, modalRoot, escapeHtml, playerPortraitUrl, imageFallbackAttributes,
    resolvePlayerVisual, resolvedRosterPlayer, runKeepingScroll, openModal, scrollSnapshot,
    squadPitchMarkup, benchMarkup, closeModal, finishNonMatchNode, compactPlayerCardMarkup,
    isProfileAwareSeason, permanentRosterFields, persistGameplayMutation, enqueueAlbumRecruit,
    unlockAlbumRecruit, toast, showPlayerDetails, chooseInventoryDiscardSelection, chooseInventoryDiscard,
    cssEscape, rosterEntry, optimizeLineupsForNewPlayer,
    } = deps;
    const ui = getUi();

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
            <div class="trade-section-head"><div><span>Panchina</span><strong>RISERVE</strong></div><small>${escapeHtml((getRun().bench || []).length)}/4</small></div>
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
  if (incoming.profileId) return global.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(entry || { playerId: incoming.playerId, activeProfileId: incoming.profileId, activeRoleVariantId: incoming.activeRoleVariantId, level: 0, levelUnits: 0 }, { run: getRun(), seasonId: getRun().seasonId, database: getSeasonDb() });
  const level = Number(entry?.level || 0);
  return incoming.source === "free_agents"
    ? global.DevelopmentRuntime.resolveRosterPlayer(getRun(), incoming.player, { ...permanentRosterFields(incoming.player), ...(entry || {}) }, getFreeAgentsDb())
    : global.InazumaProgression.getPlayerAtLevel(incoming.player, Math.floor(level), getFreeAgentsDb(), entry || {});
}

function roleVariantForTradeUpgrade(entry, profile) {
  const currentRole = String(global.ProfiledSeasonRuntime.resolveEffectiveBase(entry, getRun().seasonId)?.position || "").toUpperCase();
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
        rosterEntries: getRun().roster,
        freeAgents: getFreeAgentsDb().players,
        profiles: getSeasonDb().profiles,
        unlockedTeamIds: [...(getRun().unlockedTeamIds || []), ...(getRun().unlockedSpecialTeamIds || [])],
        teams: getSeasonDb().teams,
        seasonId: getRun().seasonId,
        compareProfileProgression: global.ProfiledSeasonRuntime.compareProfileProgression,
        resolveCandidate: (player, source) => source === "free_agents"
          ? global.DevelopmentRuntime.resolveEffectiveMetadata(getRun(), player, getFreeAgentsDb())
          : player,
      })
    : global.RoguelikeRules.getTradeCandidates({ outgoingPlayer: outgoingBase, rosterIds: getRun().roster.map((entry) => entry.playerId), freeAgents: getFreeAgentsDb().players, seasonPlayers: getSeasonDb().players, unlockedTeamIds: getRun().unlockedTeamIds, teams: getSeasonDb().teams, resolveCandidate: (player, source) => source === "free_agents" ? global.DevelopmentRuntime.resolveEffectiveMetadata(getRun(), player, getFreeAgentsDb()) : player });
  if (!candidates.length) {
    toast(`Nessun ${outgoingBase.position} con finalOverall ${outgoingBase.finalOverall} o superiore disponibile`);
    return resolveTradeNode(node);
  }
  const random = global.DraftEngine.randomFromSeed(`${getRun().currentZone.seed}:${node.id}:trade:${outgoingId}`);
  const incoming = candidates[Math.floor(random() * candidates.length)];
  const nextLevel = Math.min(20, Number(outgoingEntry.level || 0) + 1);
  const incomingEntry = { playerId: incoming.playerId || incoming.player.playerId, activeProfileId: incoming.profileId || null, activeRoleVariantId: incoming.activeRoleVariantId || null, level: nextLevel, levelUnits: 0 };
  const incomingResolved = tradeCandidatePreview(incoming, incomingEntry);
  const sameCardUpgrade = String(incomingEntry.playerId) === String(outgoingId);
  const inventoryFull = Boolean(!sameCardUpgrade && outgoingEntry.equippedItem && getRun().inventory.length >= global.SEASON1_CONFIG.maxInventory);
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
        const incomingEffective = incoming.source === "free_agents" ? global.DevelopmentRuntime.resolveEffectiveMetadata(current, incoming.player, getFreeAgentsDb()) : incoming.player;
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
          ? global.DevelopmentRuntime.resolveEffectiveMetadata(current, player, getFreeAgentsDb())
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
  openModal(`<section class="trade-result-screen"><div class="trade-result-badge" aria-hidden="true">✓</div><div class="modal-head trade-node-head trade-result-head"><div><p class="eyebrow">Scambio completato</p><h1>${upgraded ? "PROFILO POTENZIATO" : "NUOVO GIOCATORE"}</h1><p class="muted">${escapeHtml(resolved.name)} ${upgraded ? "ha ottenuto un nuovo profilo." : "è entrato nella rosa e ha preso il posto del giocatore ceduto."}</p></div></div><div class="trade-result-card mobile-compact-player-list">${tradeStaticPlayerCardMarkup(resolved, { level: global.LevelProgression.formatLevel(receivedEntry, getRun().seasonId), overall: resolved.overall, extraClass: "trade-preview-card--result" })}</div><div class="trade-result-summary"><span>${upgraded ? "POTENZIAMENTO CONFERMATO" : "ARRIVO CONFERMATO"}</span><strong>${escapeHtml(resolved.name)}</strong><small>${escapeHtml(resolved.position)} · OVR ${escapeHtml(resolved.overall)} · Lv ${escapeHtml(global.LevelProgression.formatLevel(receivedEntry, getRun().seasonId))}</small></div><div class="node-actions trade-result-actions"><button type="button" class="btn btn-ghost" id="trade-player-detail">APRI SCHEDA</button><button type="button" class="btn btn-yellow btn-primary-action" id="finish-trade">TORNA ALLA MAPPA</button></div></section>`, { closeable: false, className: "trade-result-modal" });
  document.getElementById("trade-player-detail").addEventListener("click", () => showPlayerDetails(receivedEntry.playerId, () => showTradeResult(node, incoming, receivedEntry, status)));
  document.getElementById("finish-trade").addEventListener("click", () => finishNonMatchNode(node, upgraded ? `${resolved.name}: profilo potenziato` : `${resolved.name} entra nella rosa`));
}


    return { resolveTradeNode };
  }

  global.TradeNodeControllerRuntime = { create };
})(globalThis);
