(function (global) {
  "use strict";

  function create(deps) {
    const { ensureRunSchema, groupedInventoryItems, groupedOwnedInventoryItems, resolveItem, itemStatLabel, itemIcon, escapeHtml, playerPortraitUrl, imageFallbackAttributes, resolvePlayerVisual, topbar, bottomNav, restoreScroll, resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, inventoryItemIdentity, inventoryItemCategory, openModal, modalRoot, closeModal, rosterEntry, resolvedRosterPlayer, sourcePlayer, compactPlayerCardMarkup, rarityClass, cssEscape, toast, persistGameplayMutation, removeInventoryItem, scrollSnapshot, app, runtimeTrainingState, addLevels, isProfileAwareSeason, formationById, lineupRows, getSeasonDb, getFreeAgentsDb } = deps;
    const run = new Proxy({}, { get: (_target, key) => deps.getRun()?.[key], set: (_target, key, value) => { deps.getRun()[key] = value; return true; } });
    const ui = new Proxy({}, { get: (_target, key) => deps.getUi()?.[key], set: (_target, key, value) => { deps.getUi()[key] = value; return true; } });

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
              const trainingPlan=global.DevelopmentRuntime.planIntensiveTraining(current,trainingBase,currentEntry,addedBoost,currentProfileAware ? getSeasonDb() : getFreeAgentsDb(),currentProfileAware?{permanentMode:"provided-base"}:undefined);
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

    return { renderInventory, unequipPlayerItem, chooseEquipmentPlayer, useInventoryItem };
  }

  global.InventoryController = { create };
})(globalThis);
