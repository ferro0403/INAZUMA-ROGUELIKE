(function (global) {
  "use strict";

  function create(deps) {
    function model(pending) {
      const run = deps.getRun();
      const candidateIds = pending.candidateProfileIds?.length ? pending.candidateProfileIds : [pending.selectedProfileId].filter(Boolean);
      const candidates = candidateIds.map((id) => deps.getProfiles().resolveProfile(run.seasonId, id)).filter(Boolean);
      const selected = pending.selectedProfileId && deps.getProfiles().resolveProfile(run.seasonId, pending.selectedProfileId);
      const special = deps.specialById(pending.specialMatchId);
      return { pending, candidates, selected, level: Number(special?.matchLevel || 0) };
    }

    function render(reward) {
      const pending = reward.pending;
      const pullLabel = Number(pending.totalRewards || 1) > 1
        ? ` · PULL ${Number(pending.currentReward || 1)}/${Number(pending.totalRewards)}` : "";
      deps.openModal(`<div class="modal-head special-reward-head"><div><p class="eyebrow">SCELTA GIOCATORE DISPONIBILE${pullLabel}</p><h2>${reward.candidates.length ? "Scegli 1 giocatore su 3" : "Pool completato"}</h2><p class="muted">I candidati provengono esclusivamente dalla squadra appena battuta.</p></div></div><div class="candidate-grid pull-offer-grid">${reward.candidates.map((candidate) => deps.playerCard(candidate, { button: true, context: "pull", level: reward.level, database: deps.getSeasonDb() })).join("")}</div><div class="button-row special-reward-actions">${reward.candidates.length ? '<button type="button" class="btn btn-ghost" id="decline-special-reward">RIFIUTA</button>' : ""}<button type="button" class="btn btn-yellow" id="claim-special-reward" ${reward.candidates.length && !reward.selected ? "disabled" : ""}>${reward.candidates.length ? "ACQUISISCI O POTENZIA" : "CONTINUA"}</button></div>`, { closeable: false, className: "pull-selection-modal special-reward-modal" });
    }

    function candidateProfileId(card, candidates) {
      return card.dataset.playerId
        ? candidates.find((candidate) => String(candidate.playerId) === String(card.dataset.playerId))?.profileId
        : null;
    }

    function disableActions() {
      deps.getModalRoot().querySelectorAll(".special-reward-actions button").forEach((button) => { button.disabled = true; });
    }

    return { model, render, candidateProfileId, disableActions };
  }

  global.SpecialMatchRewardViewRuntime = { create };
})(globalThis);
