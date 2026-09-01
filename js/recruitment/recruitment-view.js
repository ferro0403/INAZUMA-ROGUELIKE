(function (global) {
  "use strict";

  function create(dependencies) {
    const { getRun, getSeasonDb, getFreeAgentsDb, resolvedRosterPlayer, playerCard, openModal, getModalRoot, closeModal, escapeHtml, seasonRegistry } = dependencies;

    function showRecruitReplacement({ player, source, level, profileAware, allowCancel, cancelLabel, onNeedsReplacement, onSelect, onCancel }) {
      const run = getRun();
      const seasonDb = getSeasonDb();
      const freeAgentsDb = getFreeAgentsDb();
      const benchPlayers = (run.bench || []).map((id) => resolvedRosterPlayer(id, run)).filter(Boolean);
      const databaseFor = (candidateSource) => seasonRegistry?.isSeasonSource?.(candidateSource)
        ? (seasonRegistry.database(candidateSource) || seasonDb)
        : freeAgentsDb;
      openModal(`
        <div class="modal-head bench-replacement-head"><div><p class="eyebrow">Rosa piena</p><h2>Sostituisci una riserva</h2><p class="muted">Il nuovo giocatore entrerà al posto di una delle quattro riserve.</p></div></div>
        <section class="bench-replacement-incoming" aria-label="Nuovo giocatore scelto"><p class="bench-replacement-label">NUOVO GIOCATORE</p>${playerCard(player, { context: "pull", extraClass: "bench-replacement-new-card", level, database: databaseFor(source), applyPermanent: !profileAware })}</section>
        <section class="bench-replacement-options" aria-label="Riserve sostituibili"><p class="bench-replacement-label">SCEGLI LA RISERVA DA SOSTITUIRE</p><div class="player-grid mobile-compact-player-list bench-replacement-grid">${benchPlayers.map((candidate) => playerCard(candidate, { button: true, context: "pull", level: candidate.displayLevel, database: databaseFor(candidate.source), resolvedPlayer: candidate })).join("")}</div></section>
        ${allowCancel ? `<div class="button-row bench-replacement-footer"><button type="button" class="btn btn-ghost" id="cancel-recruit">${escapeHtml(cancelLabel || "RINUNCIA AL NUOVO GIOCATORE")}</button></div>` : ""}`,
      { closeable: false, className: "pull-selection-modal bench-replacement-modal" });
      onNeedsReplacement();
      getModalRoot().querySelectorAll(".bench-replacement-grid [data-player-id]").forEach((button) => button.addEventListener("click", () => onSelect(String(button.dataset.playerId))));
      global.document.getElementById("cancel-recruit")?.addEventListener("click", () => { closeModal(); onCancel(); });
      return { ok: false, kind: "needs-replacement" };
    }

    return { showRecruitReplacement };
  }

  global.RecruitmentViewRuntime = { create };
})(typeof globalThis !== "undefined" ? globalThis : window);
