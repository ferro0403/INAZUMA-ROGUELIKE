(function (global) {
  "use strict";

  function create({ escapeHtml, topbar, playerCard }) {
    function formationChoice({ formations, formationId }) {
      return `
        <main class="screen onboarding-screen formation-choice-screen">
          ${topbar("Scegli il modulo")}
          <div class="content narrow">
            <div class="section-head">
              <div><p class="eyebrow">Prima decisione</p><h2>Come giocherà la tua squadra?</h2></div>
            </div>
            <div class="formation-grid">
              ${formations.map((formation) => `
                <button type="button" class="formation-card ${formationId === formation.id ? "selected" : ""}" data-formation="${escapeHtml(formation.id)}" aria-pressed="${formationId === formation.id ? "true" : "false"}">
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
    }

    function draft({ draftState, role, candidates, formationId }) {
      const progress = (draftState.step / draftState.roles.length) * 100;
      return `
        <main class="screen onboarding-screen initial-draft-screen">
          ${topbar("Draft iniziale")}
          <div class="content narrow">
            <p class="eyebrow">Scelta ${draftState.step + 1} di ${draftState.roles.length}</p>
            <div class="section-head">
              <div><h2>Scegli il tuo ${role}</h2><p class="muted">Uno di questi tre entrerà nella rosa.</p></div>
              <span class="role-chip">${escapeHtml(formationId)}</span>
            </div>
            <div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div>
            <div class="candidate-grid pull-offer-grid initial-draft-grid">
              ${candidates.map((player) => playerCard(player, { button: true, extraClass: "initial-draft-card", applyPermanent: true })).join("")}
            </div>
          </div>
        </main>`;
    }

    return Object.freeze({ formationChoice, draft });
  }

  global.InitialDraftView = Object.freeze({ create });
})(globalThis);
