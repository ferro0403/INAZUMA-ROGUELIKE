(function (global) {
  "use strict";
  function create(deps) {
    const { getRun, getUi, controller, seasonFormations, formationById, effectiveRosterRole, rosterEntry, sourcePlayer, resolvedRosterPlayer, compactPlayerCardMarkup, escapeHtml, tacticSummary, tacticLabels: TACTIC_LABELS, formationLayout, openModal, closeModal, modalRoot, scrollSnapshot, toast, runKeepingScroll, app, topbar, bottomNav, resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, showPlayerDetails, resumePostBossFlowOrMap, profiledSeasonRuntime, persistGameplayMutation, fiveVFive, cssEscape } = deps;
    const seasonDb = { formations: { eleven: seasonFormations() } };
    const document = global.document;
  function lineupRows() {
    const formation = formationById(getRun().formationId) || formationById("4-3-3");
    const idsByRole = new Map(["FW", "MF", "DF", "GK"].map((role) => [role, getRun().lineup.filter((id) => effectiveRosterRole(id) === role)]));
    return formationLayout.displayRows(formation).map((row) => ({ ...row, ids: idsByRole.get(row.role).splice(0, row.count) }));
  }

  function tacticalMiniPlayer(id, { mode = "squad", area = "lineup", selectedId = null } = {}) {
    const entry = rosterEntry(id);
    if (!entry || !sourcePlayer(entry)) return "";
    const player = resolvedRosterPlayer(id);
    if (!player) return "";
    const selected = String(selectedId || getUi().selectedSquadPlayerId) === String(id);
    const dataAttr = mode === "trade"
      ? `data-trade-player="${escapeHtml(id)}" data-area="${area}" aria-pressed="${selected ? "true" : "false"}" aria-label="Seleziona ${escapeHtml(player.name)} per lo scambio, ${escapeHtml(player.position)}, OVR ${escapeHtml(player.overall)}"`
      : mode === "equip"
        ? `data-equip-player="${escapeHtml(id)}"`
        : mode === "consumable"
          ? `data-consumable-player="${escapeHtml(id)}"`
          : `data-squad-player="${escapeHtml(id)}" data-area="${area}" data-rarity="${escapeHtml(player.category || "Debole")}" aria-pressed="${selected ? "true" : "false"}" aria-label="Seleziona ${escapeHtml(player.name)}, ${escapeHtml(player.position)}, rarità ${escapeHtml(player.category || "Debole")}"`;
    return compactPlayerCardMarkup(player, {
      equipment: player.equipment,
      equipmentInFooter: mode === "squad" || mode === "trade",
      level: player.displayLevel,
      overall: player.overall,
      selected,
      dataAttr,
      extraClass: mode === "squad" ? "squad-player-card" : (mode === "trade" ? "trade-player-card" : ""),
    });
  }

  function squadPitchMarkup({ mode = "squad", selectedId = null } = {}) {
    return `
      <section class="pitch">
        ${lineupRows().map((row) => `<div class="pitch-row tactical-row" data-row-count="${row.ids.length || 1}" style="--players-in-row:${row.ids.length || 1};--row-count:${row.ids.length || 1}">${row.ids.map((id) => tacticalMiniPlayer(id, { mode, area: "lineup", selectedId })).join("")}</div>`).join("")}
      </section>`;
  }

  function benchMarkup({ mode = "squad", selectedId = null } = {}) {
    const cards = (getRun().bench || []).map((id) => tacticalMiniPlayer(id, { mode, area: "bench", selectedId })).filter(Boolean);
    return cards.length ? cards.join("") : '<p class="muted">Le riserve arriveranno con pull, scambi e ricompense.</p>';
  }

  function miniPlayer(id, area) {
    return tacticalMiniPlayer(id, { mode: "squad", area });
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
    const rows = formationLayout.displayRows(formation);
    return `<div class="squad-formation-mini" style="--mini-rows:${rows.length}" aria-hidden="true">
      ${rows.map((row) => {
        const amount = Number(row.count || 0);
        return `<span class="squad-formation-mini-row" data-display-role="${escapeHtml(row.displayRole || row.role)}" style="--mini-count:${Math.max(1, amount)}">${Array.from({ length: amount }, () => `<i class="squad-formation-dot squad-formation-dot--${row.role.toLowerCase()}"></i>`).join("")}</span>`;
      }).join("")}
    </div>`;
  }

  function squadFormationOptionsMarkup() {
    return seasonDb.formations.eleven.map((item) => {
      const active = item.id === getRun().formationId;
      const available = controller.canUseFormation(item);
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
      if (formationId === getRun().formationId) return closeModal();
      const next = formationById(formationId);
      if (!next || !controller.canUseFormation(next)) return toast("La rosa non copre tutti i ruoli del modulo");
      controller.changeFormation(formationId, {
        onCommitted: () => { getUi().selectedSquadPlayerId = null; closeModal(); toast(`Modulo cambiato in ${next.name}`); runKeepingScroll(renderSquad); },
        rerender: ({ ok }) => { if (!ok) openSquadFormationSelector(); },
      });
    });
  }

  function renderSquad() {
    closeModal({ invokeOnClose: false });
    getUi().selectedSquadPlayerId = null;
    const formation = formationById(getRun().formationId);
    const squadSummary = controller.validitySummary();

    app.innerHTML = `
      <main class="screen squad-screen">
        ${topbar("Gestione squadra", "squad-topbar")}
        <div class="content squad-content">
          <div class="squad-command-deck ${squadSummary.formationValid ? "is-valid" : "is-invalid"} ${squadSummary.rosterComplete ? "is-roster-complete" : "is-roster-incomplete"}">
            <span class="squad-readiness-mark" aria-hidden="true">${squadSummary.formationValid ? "✓" : "!"}</span>
            <div><small>Stato formazione</small><strong>${squadSummary.formationValid ? "Formazione valida" : "Formazione non valida"}</strong>${squadSummary.formationIssue ? `<em>${escapeHtml(squadSummary.formationIssue)}</em>` : ""}</div>
            <span class="squad-command-count"><b>${squadSummary.starters}/11 titolari</b><b class="${squadSummary.rosterComplete ? "" : "is-warning"}">${squadSummary.rosterComplete ? `Rosa completa · ${squadSummary.bench}/4 riserve` : escapeHtml(squadSummary.rosterIssue || `Rosa incompleta · ${squadSummary.bench}/4 riserve`)}</b></span>
          </div>

          <div class="squad-workspace">
            <section class="squad-field-panel" aria-label="Campo 11v11">
              <div class="squad-panel-head"><div><p class="eyebrow">Formazione titolare</p><h2>Campo tattico</h2></div><span class="squad-field-formation">${escapeHtml(formation?.name || getRun().formationId)}</span></div>
              ${squadPitchMarkup()}
            </section>
            <aside class="squad-management-panel" aria-label="Gestione tattica">
              <section class="squad-module-card">
                <div class="squad-module-head">
                  <div><small>Modulo corrente</small><strong>${escapeHtml(formation?.name || getRun().formationId)}</strong></div>
                  ${squadFormationPreviewMarkup(formation)}
                </div>
                ${squadTacticSummaryMarkup(getRun().formationId)}
              </section>
              <div class="squad-management-actions">
                <button type="button" class="btn squad-module-button" id="open-squad-formation">Modifica modulo</button>
                <button type="button" class="btn btn-yellow squad-info-button" id="squad-player-info" disabled>Info</button>
                <button type="button" class="btn squad-role-button" id="squad-role-switch" disabled>CAMBIA RUOLO</button>
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
                  <span>${getRun().currentZone ? "Torna al percorso" : "Inizia il percorso"}</span>
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
      if (getUi().selectedSquadPlayerId) showPlayerDetails(getUi().selectedSquadPlayerId);
    });
    document.getElementById("squad-role-switch").addEventListener("click", openBenchRoleSwitch);
    document.getElementById("go-map").addEventListener("click", () => {
      resumePostBossFlowOrMap();
    });
    bindBottomNav();
  }

  function squadPlayerRole(playerId) {
    return effectiveRosterRole(playerId);
  }

  function openBenchRoleSwitch() {
    const playerId = getUi().selectedSquadPlayerId;
    if (!profiledSeasonRuntime.canSwitchRole(getRun(), playerId)) return toast("SPOSTA IL GIOCATORE IN PANCHINA PER CAMBIARE RUOLO");
    const entry = rosterEntry(playerId); const profile = profiledSeasonRuntime.resolveOwnedPlayerProfile(entry, getRun().seasonId);
    openModal(`<div class="modal-head role-switch-head"><div><p class="eyebrow">Panchina · ${escapeHtml(profile.name)}</p><h2>CAMBIA RUOLO</h2><p class="muted">Ruolo attuale: ${escapeHtml(resolvedRosterPlayer(playerId)?.position || "-")}</p></div></div><div class="role-switch-options">${profile.roleVariants.map((variant) => { const variantId = variant.roleVariantId || variant.variantId; const active = String(variantId) === String(entry.activeRoleVariantId); const previewEntry = { ...entry, activeRoleVariantId: variantId }; const preview = profiledSeasonRuntime.resolveEffectivePlayerAtLevel(previewEntry, { run: getRun(), seasonId: getRun().seasonId, database: seasonDb }); return `<button type="button" class="role-switch-option ${active ? "active" : ""}" data-role-variant="${escapeHtml(variantId)}" ${active ? "disabled" : ""}><strong>${escapeHtml(variant.position || variant.normalizedRole)}</strong><span>OVR ${escapeHtml(preview.overall || preview.finalOverall)}</span><small>${active ? "ATTIVO" : "SELEZIONA"}</small></button>`; }).join("")}</div>`, { closeable: true, className: "role-switch-modal" });
    modalRoot.querySelectorAll("[data-role-variant]").forEach((button) => button.addEventListener("click", () => persistGameplayMutation({ label: "bench-role", mutate: (current) => { profiledSeasonRuntime.switchBenchRole(current, playerId, button.dataset.roleVariant); fiveVFive?.removeUnavailable?.(current); }, onCommitted: () => { closeModal(); toast("Ruolo aggiornato"); renderSquad(); }, rerender: ({ ok }) => { if (!ok) renderSquad(); } })));
  }

  function setSelectedSquadPlayer(playerId) {
    getUi().selectedSquadPlayerId = playerId ? String(playerId) : null;
    const selectedRole = getUi().selectedSquadPlayerId ? squadPlayerRole(getUi().selectedSquadPlayerId) : null;
    document.querySelectorAll("[data-squad-player]").forEach((card) => {
      const cardId = String(card.dataset.squadPlayer);
      const isSelected = cardId === getUi().selectedSquadPlayerId;
      const isCompatible = Boolean(getUi().selectedSquadPlayerId && !isSelected && selectedRole && squadPlayerRole(cardId) === selectedRole);
      card.classList.toggle("selected", isSelected);
      card.classList.toggle("is-compatible", isCompatible);
      card.classList.toggle("is-incompatible", Boolean(getUi().selectedSquadPlayerId && !isSelected && !isCompatible));
      card.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    const roleButton = document.getElementById("squad-role-switch");
    if (roleButton) {
      const selected = getUi().selectedSquadPlayerId;
      const canSwitch = selected && profiledSeasonRuntime?.canSwitchRole?.(getRun(), selected);
      const hasVariants = selected && (profiledSeasonRuntime?.resolveOwnedPlayerProfile?.(rosterEntry(selected), getRun().seasonId)?.roleVariants || []).length > 1;
      roleButton.disabled = !hasVariants;
      roleButton.classList.toggle("is-available", Boolean(canSwitch));
      roleButton.classList.toggle("is-bench-required", Boolean(hasVariants && !canSwitch));
      roleButton.textContent = canSwitch ? "CAMBIA RUOLO" : hasVariants ? "SPOSTA IN PANCHINA PER CAMBIARE RUOLO" : "CAMBIA RUOLO";
    }
    const infoButton = document.getElementById("squad-player-info");
    if (infoButton) {
      infoButton.disabled = !getUi().selectedSquadPlayerId;
      infoButton.setAttribute("aria-label", getUi().selectedSquadPlayerId ? `Apri la scheda di ${resolvedRosterPlayer(getUi().selectedSquadPlayerId)?.name || "giocatore selezionato"}` : "Seleziona un giocatore");
    }
    const hint = document.querySelector("[data-squad-hint]");
    if (hint) hint.textContent = getUi().selectedSquadPlayerId ? "Scegli un giocatore compatibile da scambiare" : "Seleziona un giocatore";
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
    const selected = getUi().selectedSquadPlayerId;
    if (!selected) return setSelectedSquadPlayer(clickedId);
    if (selected === clickedId) return setSelectedSquadPlayer(null);
    if (squadPlayerRole(selected) !== squadPlayerRole(clickedId)) {
      return toast("Questa destinazione non è compatibile");
    }

    const firstArea = getRun().lineup.includes(selected) ? "lineup" : "bench";
    const secondArea = getRun().lineup.includes(clickedId) ? "lineup" : "bench";
    const firstName = resolvedRosterPlayer(selected)?.name || selected;
    const secondName = resolvedRosterPlayer(clickedId)?.name || clickedId;
    controller.swapPlayers(selected, clickedId, {
      onCommitted: (areas) => { swapSquadPlayersInDom(selected, clickedId, areas?.firstArea || firstArea, areas?.secondArea || secondArea); setSelectedSquadPlayer(null); toast(`${firstName} e ${secondName} scambiati`); },
      rerender: ({ ok }) => { if (!ok) renderSquad(); },
    });
  }

    return { render: renderSquad, tacticalPlayer: tacticalMiniPlayer, pitchMarkup: squadPitchMarkup, benchMarkup, miniPlayer, openFormationSelector: openSquadFormationSelector, setSelectedPlayer: setSelectedSquadPlayer };
  }
  global.SquadViewRuntime = { create };
})(globalThis);
