(function (global) {
  "use strict";
  function create(deps) {
    const { getRun, getUi, controller, fiveVFive, fiveRoleForPlayerId, fiveOverallForPlayerId, resolvedRosterPlayer, rosterEntry, compactPlayerCardMarkup, escapeHtml, rarityClass, playerPortraitUrl, imageFallbackAttributes, resolvePlayerVisual, app, topbar, bottomNav, resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, syncScroll: restoreScroll, scrollSnapshot, runKeepingScroll, toast, renderMapFailureRecovery, matchTransactionIdentity, canonicalMatchFor, renderMatch, visibleTimeline, floatingPicker, document = global.document } = deps;
  function fiveSlotCard(slot, playerId, status) {
    const player = playerId ? resolvedRosterPlayer(playerId) : null;
    const selected = getUi().fiveVFiveSelectedSlot === slot.key;
    const missing = !player && !status.valid;
    const equipment = player ? rosterEntry(player.playerId)?.equippedItem : null;
    const ariaLabel = player
      ? `Seleziona ${player.name}, ${slot.role}, overall ${player.overall}, livello ${player.displayLevelText ?? player.displayLevel}`
      : `Seleziona slot vuoto ${slot.key}, ruolo ${slot.role}`;
    if (player) {
      return compactPlayerCardMarkup(player, {
        equipment,
        equipmentInFooter: true,
        level: player.displayLevel,
        overall: player.overall,
        selected,
        dataAttr: `data-five-slot="${escapeHtml(slot.key)}" aria-pressed="${selected ? "true" : "false"}" aria-selected="${selected ? "true" : "false"}" aria-label="${escapeHtml(ariaLabel)}"`,
        extraClass: "five-slot run-tactical-card",
      });
    }
    return `
      <button type="button" class="five-slot run-tactical-card missing" data-five-slot="${escapeHtml(slot.key)}" aria-pressed="${selected ? "true" : "false"}" aria-selected="${selected ? "true" : "false"}" aria-label="${escapeHtml(ariaLabel)}">
        <span class="five-slot-role">${escapeHtml(slot.role)}</span>
        <span class="five-empty">+</span>
        <span class="five-slot-copy"><strong>Slot vuoto</strong><small>Serve ${escapeHtml(slot.role)}</small></span>
      </button>`;
  }

  function fiveRosterCard(entry, selectedSlot) {
    const player = resolvedRosterPlayer(entry.playerId);
    if (!player) return "";
    const fiveState = getRun().fiveVFive || { formation: fiveVFive.formationById(null).id, slots: {} };
    const slot = selectedSlot ? fiveVFive.formationById(fiveState.formation).slots.find((item) => item.key === selectedSlot) : null;
    const compatible = !slot || player.position === slot.role;
    const assignedSlot = Object.entries(fiveState.slots || {}).find(([, id]) => String(id) === String(entry.playerId))?.[0];
    const currentStarter = assignedSlot === selectedSlot;
    return `
      <button type="button" class="five-roster-card ${compatible ? "" : "disabled"} ${assignedSlot ? "assigned" : ""} ${currentStarter ? "current-starter" : ""} ${rarityClass(player.category)}" data-five-player="${escapeHtml(entry.playerId)}" ${compatible && !currentStarter ? "" : "disabled"} aria-current="${currentStarter ? "true" : "false"}" aria-label="${currentStarter ? "Titolare attuale" : "Sostituisci con"} ${escapeHtml(player.name)}, ${escapeHtml(player.position)}, overall ${escapeHtml(player.overall)}">
        <span class="five-roster-portrait"><img src="${escapeHtml(playerPortraitUrl(player))}" alt="" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} /></span>
        <span class="five-roster-copy"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.position)} · OVR ${escapeHtml(player.overall)} · Lv ${escapeHtml(player.displayLevelText ?? player.displayLevel)}</small></span>
        <span class="five-roster-state">${currentStarter ? "TITOLARE" : (assignedSlot ? `IN CAMPO · ${escapeHtml(assignedSlot)}` : "SCEGLI")}</span>
      </button>`;
  }

  function renderFivePlayerPicker({ selectedSlot, selectedRole, filter = "all" }) {
    const rosterEntries = getRun().roster.filter((entry) => {
      const role = fiveRoleForPlayerId(entry.playerId);
      if (filter !== "all" && role !== filter) return false;
      return !selectedRole || filter !== "all" || role === selectedRole;
    }).sort((a, b) => fiveOverallForPlayerId(b.playerId) - fiveOverallForPlayerId(a.playerId) || String(a.playerId).localeCompare(String(b.playerId)));
    return `<aside class="panel five-selector" role="dialog" aria-modal="true" aria-label="Cambia giocatore">
      <div class="section-head compact"><div><p class="eyebrow">CAMBIA GIOCATORE · SLOT ${escapeHtml(selectedSlot)}</p><h3>GIOCATORE ATTUALE</h3><p class="muted small">SOSTITUISCI CON · solo ${escapeHtml(selectedRole)} compatibili, ordinati per Overall attuale.</p></div></div>
      <div class="role-filter-bar" aria-label="Filtra rosa per ruolo">
        ${["all", "GK", "DF", "MF", "FW"].map((role) => `<button type="button" class="role-filter ${filter === role ? "active" : ""}" data-five-filter="${role}" aria-selected="${filter === role ? "true" : "false"}">${role === "all" ? "VALIDI" : role}</button>`).join("")}
      </div>
      <div class="five-roster-list">
        ${rosterEntries.length ? rosterEntries.map((entry) => fiveRosterCard(entry, selectedSlot)).join("") : '<p class="five-roster-empty">Nessun giocatore compatibile con questo filtro.</p>'}
      </div>
      <button type="button" class="btn btn-ghost five-clear-slot" id="clear-five-slot">SVUOTA SLOT</button>
    </aside>`;
  }

  function syncFiveSlotSelection(root = document) {
    const selectedSlot = getUi().fiveVFiveSelectedSlot;
    root.querySelectorAll("[data-five-slot]").forEach((slotButton) => {
      const selected = Boolean(selectedSlot) && slotButton.dataset.fiveSlot === selectedSlot;
      slotButton.classList.toggle("selected", selected);
      slotButton.setAttribute("aria-pressed", selected ? "true" : "false");
      slotButton.setAttribute("aria-selected", selected ? "true" : "false");
      slotButton.querySelectorAll(".five-slot-selected-label").forEach((label) => label.remove());
      if (selected) {
        const label = document.createElement("span");
        label.className = "five-slot-selected-label";
        label.textContent = "SELEZIONATO";
        slotButton.append(label);
      }
    });
  }

  function openFiveVFiveEditor(options = {}) {
    const returnToMatch = options.returnToMatch === true;
    return controller.commit(options.label || "five-editor-entry", (current) => {
      controller.ensure(current);
      current.phase = "five";
    }, {
      guardActiveFiveMatch: returnToMatch,
      onCommitted: () => renderFiveVFive({ persist: false, returnToMatch }),
      rerender: ({ ok }) => { if (!ok) renderMapFailureRecovery(); },
    });
  }

  function renderFiveVFive(options = {}) {
    const status = controller.status(getRun());
    const formation = status.formation;
    const fiveState = getRun().fiveVFive || { formation: formation.id, slots: fiveVFive.emptySlots(formation.id) };
    const selectedSlot = getUi().fiveVFiveSelectedSlot && formation.slots.some((slot) => slot.key === getUi().fiveVFiveSelectedSlot)
      ? getUi().fiveVFiveSelectedSlot
      : formation.slots.find((slot) => !fiveState.slots[slot.key])?.key || formation.slots[0].key;
    getUi().fiveVFiveSelectedSlot = selectedSlot;
    const selectedRole = formation.slots.find((slot) => slot.key === selectedSlot)?.role;
    const filter = getUi().fiveVFiveRoleFilter || "all";
    const rows = ["attack", "midfield", "defense", "goal"];
    app.innerHTML = `
      <main class="screen five-screen">
        ${topbar("Formazione 5v5")}
        <div class="content five-editor-content">
          <section class="five-editor-intro" aria-labelledby="five-editor-title">
            <div>
              <p class="eyebrow">FORMAZIONE 5V5</p>
              <h2 id="five-editor-title">Scegli il quintetto</h2>
              <p>Tocca uno slot del campo e assegna un giocatore dello stesso ruolo.</p>
            </div>
            <span class="five-editor-count" aria-label="Giocatori assegnati"><strong>${escapeHtml(status.assignedCount)}</strong><small>/5</small></span>
          </section>
          <section class="five-layout">
            <div class="five-main">
              <div class="five-formation-block">
                <div class="five-block-heading"><span>MODULO</span><small>Due assetti disponibili</small></div>
                <div class="five-formation-grid">
                  ${fiveVFive.formations.map((item) => `
                    <button type="button" class="five-formation-card ${item.id === formation.id ? "selected" : ""}" data-five-formation="${escapeHtml(item.id)}" aria-pressed="${item.id === formation.id ? "true" : "false"}">
                      <span class="five-formation-name">${escapeHtml(item.name)}</span>
                      <span class="five-formation-summary">${escapeHtml(item.summary)}</span>
                      <span class="five-formation-state">${item.id === formation.id ? "ATTIVO" : "SCEGLI"}</span>
                    </button>`).join("")}
                </div>
              </div>
              <section class="five-field-panel" aria-label="Campo formazione 5v5">
                <div class="five-field-heading">
                  <div><span>CAMPO</span><strong>${escapeHtml(formation.name)}</strong></div>
                  <small>TOCCA UNA CARD</small>
                </div>
                <div class="five-pitch formation-${escapeHtml(formation.id)}">
                  ${rows.map((line) => `<div class="five-pitch-line line-${line}">${formation.slots.filter((slot) => slot.line === line).map((slot) => fiveSlotCard(slot, fiveState.slots[slot.key], status)).join("")}</div>`).join("")}
                </div>
              </section>
              <div class="five-validation ${status.valid ? "valid" : "invalid"}" aria-live="polite">
                <span class="five-validation-mark" aria-hidden="true">${status.valid ? "✓" : "!"}</span>
                <div><strong>${status.valid ? "Formazione pronta" : `Formazione incompleta (${status.assignedCount}/5)`}</strong><p>${status.valid ? "Il quintetto è valido per le partite 5v5." : escapeHtml(status.messages[0] || "Completa tutti gli slot rispettando i ruoli.")}</p></div>
              </div>
              <div class="button-row five-editor-actions"><button type="button" class="btn btn-yellow btn-primary-action" id="save-five" ${status.valid ? "" : "disabled"}>SALVA FORMAZIONE</button>${options.returnToMatch ? '<button type="button" class="btn btn-secondary" id="back-five-match">TORNA ALLA PARTITA</button><button type="button" class="btn btn-ghost" id="cancel-five-edit">ANNULLA</button>' : ""}</div>
            </div>
            ${renderFivePlayerPicker({ selectedSlot, selectedRole, filter })}
          </section>
        </div>
        ${bottomNav("five")}
      </main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();
    syncFiveSlotSelection();

    document.querySelectorAll("[data-five-formation]").forEach((button) => button.addEventListener("click", () => {
      if (button.disabled) return;
      button.disabled = true;
      const nextFormation = button.dataset.fiveFormation;
      const committed = controller.commit("five-lineup-formation-change", (current) =>
        fiveVFive.changeFormation(current, nextFormation, (id) => fiveRoleForPlayerId(id, current)), {
          onCommitted: () => {
            getUi().fiveVFiveSelectedSlot = null;
            runKeepingScroll(() => renderFiveVFive({ ...options, persist: false }));
          },
        });
      if (!committed.ok) return;
    }));
    const refreshFiveSelection = () => {
      const currentStatus = controller.status();
      const currentFormation = currentStatus.formation;
      syncFiveSlotSelection();
      document.querySelectorAll("[data-five-filter]").forEach((filterButton) => {
        const active = filterButton.dataset.fiveFilter === getUi().fiveVFiveRoleFilter;
        filterButton.classList.toggle("active", active);
        filterButton.setAttribute("aria-selected", active ? "true" : "false");
      });
      const currentSlot = currentFormation.slots.find((slot) => slot.key === getUi().fiveVFiveSelectedSlot);
      const selectedRoleNow = currentSlot?.role;
      const currentFilter = getUi().fiveVFiveRoleFilter || "all";
      const nextEntries = getRun().roster.filter((entry) => {
        const role = fiveRoleForPlayerId(entry.playerId);
        if (currentFilter !== "all" && role !== currentFilter) return false;
        if (selectedRoleNow && currentFilter === "all") return role === selectedRoleNow;
        return true;
      }).sort((a, b) => fiveOverallForPlayerId(b.playerId) - fiveOverallForPlayerId(a.playerId) || String(a.playerId).localeCompare(String(b.playerId)));
      const selectorHead = document.querySelector(".five-selector .section-head.compact");
      if (selectorHead && currentSlot) selectorHead.innerHTML = `<div><p class="eyebrow">CAMBIA GIOCATORE · SLOT ${escapeHtml(currentSlot.key)}</p><h3>GIOCATORE ATTUALE</h3><p class="muted small">SOSTITUISCI CON · solo ${escapeHtml(selectedRoleNow)} compatibili, ordinati per Overall attuale.</p></div>`;
      const list = document.querySelector(".five-roster-list");
      if (list) {
        const fragment = document.createDocumentFragment();
        if (nextEntries.length) {
          nextEntries.forEach((entry) => {
            const template = document.createElement("template");
            template.innerHTML = fiveRosterCard(entry, getUi().fiveVFiveSelectedSlot).trim();
            if (template.content.firstElementChild) fragment.append(template.content.firstElementChild);
          });
        } else {
          const empty = document.createElement("p");
          empty.className = "five-roster-empty";
          empty.textContent = "Nessun giocatore compatibile con questo filtro.";
          fragment.append(empty);
        }
        list.replaceChildren(fragment);
      }
    };
    const refreshFiveAfterAssignment = () => {
      const snapshot = scrollSnapshot();
      const currentStatus = controller.status();
      document.querySelectorAll("[data-five-slot]").forEach((slotButton) => {
        const slot = currentStatus.formation.slots.find((item) => item.key === slotButton.dataset.fiveSlot);
        if (slot) slotButton.outerHTML = fiveSlotCard(slot, getRun().fiveVFive.slots[slot.key], currentStatus);
      });
      const validation = document.querySelector(".five-validation");
      if (validation) {
        validation.className = `five-validation ${currentStatus.valid ? "valid" : "invalid"}`;
        validation.innerHTML = `<span class="five-validation-mark" aria-hidden="true">${currentStatus.valid ? "✓" : "!"}</span><div><strong>${currentStatus.valid ? "Formazione pronta" : `Formazione incompleta (${currentStatus.assignedCount}/5)`}</strong><p>${currentStatus.valid ? "Il quintetto è valido per le partite 5v5." : escapeHtml(currentStatus.messages[0] || "Completa tutti gli slot rispettando i ruoli.")}</p></div>`;
      }
      const count = document.querySelector(".five-editor-count strong");
      if (count) count.textContent = String(currentStatus.assignedCount);
      const save = document.getElementById("save-five");
      if (save) save.disabled = !currentStatus.valid;
      document.querySelectorAll("[data-five-slot]").forEach((slotButton) => slotButton.addEventListener("click", onFiveSlotClick));
      refreshFiveSelection();
      restoreScroll(snapshot);
    };
    const onFiveSlotClick = (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      getUi().fiveVFiveSelectedSlot = getUi().fiveVFiveSelectedSlot === button.dataset.fiveSlot ? null : button.dataset.fiveSlot;
      const role = formation.slots.find((slot) => slot.key === getUi().fiveVFiveSelectedSlot)?.role;
      getUi().fiveVFiveRoleFilter = role || "all";
      refreshFiveSelection();
    };
    const selector = document.querySelector(".five-selector");
    selector?.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-five-filter]");
      if (filterButton && selector.contains(filterButton)) {
        event.preventDefault();
        getUi().fiveVFiveRoleFilter = filterButton.dataset.fiveFilter || "all";
        refreshFiveSelection();
        filterButton.focus?.({ preventScroll: true });
        return;
      }
      const playerButton = event.target.closest("[data-five-player]");
      if (!playerButton || !selector.contains(playerButton)) return;
      event.preventDefault();
      try {
        const selectedSlotKey = getUi().fiveVFiveSelectedSlot;
        const selectedPlayerId = playerButton.dataset.fivePlayer;
        playerButton.disabled = true;
        const assigned = controller.commit("five-lineup-assign", (current) =>
          fiveVFive.assign(current, selectedSlotKey, selectedPlayerId, (id) => fiveRoleForPlayerId(id, current)), {
            onCommitted: () => { getUi().fiveVFiveSelectedSlot = null; toast("Giocatore assegnato alla formazione 5v5"); refreshFiveAfterAssignment(); },
          });
        if (!assigned.ok) return;
      } catch (error) {
        toast(error.message);
      }
    });
    document.querySelectorAll("[data-five-slot]").forEach((button) => button.addEventListener("click", onFiveSlotClick));
    document.getElementById("clear-five-slot").addEventListener("click", (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      if (button.disabled) return;
      const selectedSlotKey = getUi().fiveVFiveSelectedSlot;
      if (!selectedSlotKey) return;
      button.disabled = true;
      const committed = controller.commit("five-lineup-clear", (current) => fiveVFive.clearSlot(current, selectedSlotKey), {
        onCommitted: () => { getUi().fiveVFiveSelectedSlot = null; refreshFiveAfterAssignment(); },
      });
      if (!committed.ok) return;
    });
    document.getElementById("save-five").addEventListener("click", (event) => {
      const button = event.currentTarget;
      if (button.disabled) return;
      const preview = controller.status(getRun(), { autoFill: true });
      if (!preview.valid) return toast("Completa tutti e cinque gli slot prima di salvare.");
      button.disabled = true;
      const committed = controller.commit("five-lineup-save", (current) => {
        controller.ensure(current);
        const currentStatus = fiveVFive.validate(current, (id) => fiveRoleForPlayerId(id, current));
        if (!currentStatus.valid) throw new Error(currentStatus.messages?.[0] || "Formazione 5v5 non valida");
        return currentStatus;
      }, {
        onCommitted: () => { toast("Formazione 5v5 salvata"); refreshFiveAfterAssignment(); },
      });
      if (!committed.ok) return;
    });
    document.getElementById("back-five-match-head")?.addEventListener("click", () => document.getElementById("back-five-match")?.click());
    document.getElementById("cancel-five-edit")?.addEventListener("click", () => document.getElementById("back-five-match")?.click());
    document.getElementById("back-five-match")?.addEventListener("click", (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      if (button.disabled) return;
      const preview = controller.status(getRun(), { autoFill: true });
      if (!preview.valid) return toast(preview.messages?.[0] || "Formazione non valida: completa tutti gli slot prima di tornare alla partita.");
      const context = getUi().returnToMatchContext || getRun().activeMatch;
      const match = getRun().activeMatch?.type === "five_v_five" ? getRun().activeMatch : null;
      if (!context || !match) return toast("Nessuna partita da riprendere.");
      const fallbackScroll = match.returnScroll || context.scroll || scrollSnapshot();
      button.disabled = true;
      const committed = controller.commit("five-match-edit-exit", (current) => {
        const currentMatch = current.activeMatch;
        controller.ensure(current);
        const currentStatus = fiveVFive.validate(current, (id) => fiveRoleForPlayerId(id, current));
        if (!currentStatus.valid) throw new Error(currentStatus.messages?.[0] || "Formazione 5v5 non valida");
        current.phase = "match";
        return { scroll: currentMatch?.returnScroll || fallbackScroll };
      }, {
        onCommitted: (value, current) => {
          const currentMatch = current.activeMatch;
          getUi().match = currentMatch;
          getUi().bossMatchState = currentMatch?.state || "pre-match";
          getUi().bossMatchLog = currentMatch?.log || visibleTimeline(currentMatch);
          renderMatch();
          restoreScroll(value?.scroll || fallbackScroll);
        },
      });
      if (!committed.ok) return;
    });
    bindBottomNav();
  }

    return { render: renderFiveVFive, open: openFiveVFiveEditor, playerPickerMarkup: renderFivePlayerPicker, syncSlotSelection: syncFiveSlotSelection };
  }
  global.FiveVFiveViewRuntime = { create };
})(globalThis);
