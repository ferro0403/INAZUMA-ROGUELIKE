(function (global) {
  "use strict";

  function create(deps = {}) {
    const {
      getRun,
      persistenceWritesAllowed,
      openModal,
      closeModal,
      renderSettings,
      startRunWithIdentity,
      escapeHtml,
      inazumaLogoMarkup,
    } = deps;

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
      const run = getRun?.() || null;
      const legacyName = run ? global.RunState.validTeamName(run.teamIdentity?.name) : "";
      if (!legacyName) return null;
      if (!persistenceWritesAllowed()) return normalizeTeamIdentity({ name: legacyName, emblemId: "default-lightning" });
      return global.RunState.saveProfileTeamIdentity({ name: legacyName, emblemId: "default-lightning" });
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

    function openTeamNameModal({ mode = "create" } = {}) {
      const run = getRun?.() || null;
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
      if (global.matchMedia?.("(pointer: fine)").matches) input.focus({ preventScroll: true });
      const confirm = () => {
        const result = validateTeamName(input.value);
        if (!result.valid) { error.textContent = result.message; return; }
        if (mode === "edit") {
          const currentRun = getRun?.() || null;
          const before = currentRun ? JSON.stringify({ roster: currentRun.roster, lineup: currentRun.lineup, bench: currentRun.bench, bossIndex: currentRun.bossIndex, currentZone: currentRun.currentZone }) : null;
          global.RunState.saveProfileTeamIdentity({ name: result.name, emblemId: savedTeamIdentity()?.emblemId || "default-lightning" });
          if (before && before !== JSON.stringify({ roster: currentRun.roster, lineup: currentRun.lineup, bench: currentRun.bench, bossIndex: currentRun.bossIndex, currentZone: currentRun.currentZone })) throw new Error("Team name edit changed run progress");
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

    return Object.freeze({
      normalizeTeamIdentity,
      loadTeamProfile,
      savedTeamIdentity,
      migrateTeamIdentityProfile,
      validateTeamName,
      seasonDisplayName,
      normalizedHallSeasonName,
      savedTeamSummaryMarkup,
      openTeamNameModal,
      openEditTeamNameModal,
    });
  }

  global.TeamProfileRuntime = Object.freeze({ create });
})(globalThis);
