(function (global) {
  "use strict";

  function create(dependencies) {
    const { getRun, getSeasonDb, getFreeAgentsDb, escapeHtml, resolveItem, itemIcon, openModal, getModalRoot, rarityClass, playerCard, showPlayerDetailsFor, scrollSnapshot, afterNextPaint, restoreScroll, cssEscape, toast, closeModal, renderMap } = dependencies;
  function pullChoiceSource(options, player) {
    return options.sourceForPlayer ? options.sourceForPlayer(player) : options.source;
  }

  function pullChoiceDatabase(options, player) {
    const src = pullChoiceSource(options, player);
    return global.RecruitmentPoolRuntime.choiceDatabase(src, getSeasonDb(), getFreeAgentsDb());
  }

  function resolvePullChoicePlayer(options, player) {
    const level = Math.floor(Number(options.level || 0));
    const database = pullChoiceDatabase(options, player);
    const resolved = global.DevelopmentRuntime.resolvePlayer(getRun(), player, level, database);
    const effectiveMetadata = global.DevelopmentRuntime.resolveEffectiveMetadata(getRun(), player, database);
    return { ...resolved, category: effectiveMetadata.category, baseStats: resolved.stats };
  }

  function pullChoiceActionPanel(player, index) {
    const panelId = `pull-choice-actions-${index}`;
    return `
      <div class="pull-choice-actions" id="${panelId}" role="group" aria-label="Conferma scelta per ${escapeHtml(player.name)}">
        <div class="button-row pull-choice-action-row">
          <button type="button" class="btn btn-primary" data-pull-action="confirm">SÌ</button>
          <button type="button" class="btn btn-yellow" data-pull-action="detail">SCHEDA</button>
        </div>
      </div>`;
  }

  function updateInlinePullSelection(grid, selectedId) {
    grid.querySelectorAll(".pull-choice-option").forEach((option) => {
      const selected = (option.dataset.candidateKey || option.dataset.playerId) === selectedId;
      option.classList.toggle("is-selected", selected);
      const trigger = option.querySelector("[data-player-id]");
      const actions = option.querySelector(".pull-choice-actions");
      trigger?.setAttribute("aria-expanded", selected ? "true" : "false");
      trigger?.setAttribute("aria-pressed", selected ? "true" : "false");
      actions?.classList.toggle("is-active", selected);
    });
  }

  function showPlayerOffer(options) {
    const offerCandidateKey = (player) => String(options.profileAware && player.profileId ? player.profileId : player.playerId);
    const scoutItem = resolveItem("scout_token");
    const luckyItem = resolveItem("lucky_charm");
    const rerollButton = options.onReroll
      ? `<button type="button" class="btn btn-yellow" id="reroll-offer" ${options.rerollDisabled ? "disabled" : ""}>${options.rerollLabel ? escapeHtml(options.rerollLabel) : `<span class="pull-item-action-copy">${itemIcon(scoutItem)}<span>Usa ${escapeHtml(scoutItem.name)}</span></span>`}</button>`
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
          const effectivePlayer = resolvePullChoicePlayer(options, player);
          return `<div class="pull-choice-option ${rarityClass(effectivePlayer.category)}" data-player-id="${escapeHtml(player.playerId)}" data-candidate-key="${escapeHtml(offerCandidateKey(player))}">
            ${playerCard(player, { button: true, context: "pull", level: options.level, database: pullChoiceDatabase(options, player), resolvedPlayer: effectivePlayer }).replace(">", ` aria-expanded="false" aria-pressed="false" aria-controls="${panelId}">`)}
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
    const choiceGrid = getModalRoot().querySelector("[data-pull-choice-grid]");
    let selectedPullPlayerId = null;
    let pickConfirmed = false;
    choiceGrid?.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-pull-action]");
      const option = event.target.closest(".pull-choice-option");
      if (!option) return;
      const player = options.candidates.find((candidate) => offerCandidateKey(candidate) === option.dataset.candidateKey);
      if (!player) return;
      if (!actionButton) {
        selectedPullPlayerId = option.dataset.candidateKey;
        updateInlinePullSelection(choiceGrid, selectedPullPlayerId);
        return;
      }
      if (actionButton.dataset.pullAction === "detail") {
        const playerDatabase = pullChoiceDatabase(options, player);
        const effectivePlayer = resolvePullChoicePlayer(options, player);
        const pullScroll = scrollSnapshot();
        showPlayerDetailsFor(effectivePlayer, {
          playerId: player.playerId,
          level: options.level,
          database: playerDatabase,
          onClose: () => {
            showPlayerOffer(options);
            afterNextPaint(() => {
              const restoredGrid = getModalRoot().querySelector("[data-pull-choice-grid]");
              if (!restoredGrid) return;
              selectedPullPlayerId = offerCandidateKey(player);
              updateInlinePullSelection(restoredGrid, selectedPullPlayerId);
              restoreScroll(pullScroll);
              restoredGrid.querySelector(`.pull-choice-option[data-candidate-key="${cssEscape(offerCandidateKey(player))}"] [data-pull-action="detail"]`)?.focus({ preventScroll: true });
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


    return { pullChoiceSource, pullChoiceDatabase, resolvePullChoicePlayer, pullChoiceActionPanel, updateInlinePullSelection, showPlayerOffer };
  }

  global.PullViewRuntime = { create };
})(globalThis);
