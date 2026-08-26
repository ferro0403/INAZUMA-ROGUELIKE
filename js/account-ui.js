(function (global) {
  "use strict";
  const initialState = { status: "initializing", uid: null, username: "", email: "", emailVerified: false, profileComplete: false, error: null };
  let state = { ...initialState };
  let busy = false;
  let activeTab = "login";
  let restoreFocus = null;
  let resendAvailableAt = 0;
  let cloudState = { status: "idle", error: null };
  let modalView = null;
  let loginSubmissionInFlight = false;

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function buttonMarkup() {
    const connected = state.status === "authenticated";
    const label = connected ? `@${state.username || "ACCOUNT"}` : state.status === "initializing" ? "ACCOUNT" : "ACCEDI";
    return `<button type="button" class="account-header-button" data-account-trigger ${state.status === "initializing" ? "disabled" : ""} title="${escapeHtml(label)}"><span>${escapeHtml(label)}</span></button>`;
  }
  function updateButtons() {
    const connected = state.status === "authenticated";
    document.querySelectorAll("[data-account-trigger]").forEach((button) => {
      const label = connected ? `@${state.username || "ACCOUNT"}` : state.status === "initializing" ? "ACCOUNT" : "ACCEDI";
      button.disabled = state.status === "initializing";
      button.title = label;
      const span = button.querySelector("span");
      if (span) span.textContent = label; else button.textContent = label;
    });
  }
  function feedback(message = "", kind = "") { const el = document.querySelector("[data-account-feedback]"); if (el) { el.textContent = message; el.dataset.kind = kind; } }
  function authForm() {
    const register = activeTab === "register";
    return `<div class="account-tabs" role="tablist"><button type="button" role="tab" data-account-tab="login" aria-selected="${!register}">ACCEDI</button><button type="button" role="tab" data-account-tab="register" aria-selected="${register}">REGISTRATI</button></div>
      <form data-account-form="${register ? "register" : "login"}" class="account-form">
        ${register ? '<label>USERNAME<input name="username" autocomplete="username" minlength="3" maxlength="16" required /></label>' : ""}
        <label>EMAIL<input name="email" type="email" autocomplete="email" required /></label>
        <label>PASSWORD<input name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="${register ? 8 : 1}" required /></label>
        ${register ? '<label>CONFERMA PASSWORD<input name="passwordConfirmation" type="password" autocomplete="new-password" minlength="8" required /></label>' : ""}
        <button class="btn account-primary" type="submit">${register ? "CREA ACCOUNT" : "ACCEDI"}</button>
        ${register ? '<button class="account-text-action" type="button" data-account-tab="login">HAI GIÀ UN ACCOUNT? ACCEDI</button>' : '<button class="account-text-action" type="button" data-account-reset>PASSWORD DIMENTICATA?</button><button class="account-text-action" type="button" data-account-tab="register">NON HAI UN ACCOUNT? REGISTRATI</button>'}
      </form>`;
  }
  function cloudSaveMarkup() {
    const status = cloudState.status;
    if (status === "checking" || status === "idle") return '<section class="account-cloud-save" data-cloud-save-status><strong>CONTROLLO SALVATAGGIO...</strong></section>';
    if (status === "uploading") return '<section class="account-cloud-save" data-cloud-save-status><strong>ASSOCIAZIONE SALVATAGGIO...</strong></section>';
    if (status === "awaiting-local-save") return '<section class="account-cloud-save" data-cloud-save-status><strong>NESSUN SALVATAGGIO DA ASSOCIARE</strong><span>Questo dispositivo non contiene ancora progressi.</span><span>Il salvataggio cloud verrà creato quando inizierai una run.</span></section>';
    if (status === "associated" || status === "synced") return '<section class="account-cloud-save" data-cloud-save-status><strong>SALVATAGGIO SINCRONIZZATO</strong><span>Il progresso di questo dispositivo è aggiornato sul tuo account.</span><button type="button" class="btn account-secondary" data-cloud-save-check>CONTROLLA AGGIORNAMENTI</button></section>';
    if (status === "sync-pending") return '<section class="account-cloud-save" data-cloud-save-status><strong>MODIFICHE IN ATTESA...</strong><span>Il progresso è già salvato su questo dispositivo.</span></section>';
    if (status === "syncing") return '<section class="account-cloud-save" data-cloud-save-status><strong>SINCRONIZZAZIONE...</strong></section>';
    if (["sync-error", "metadata-repair-needed"].includes(status)) return `<section class="account-cloud-save account-cloud-save-error" data-cloud-save-status><strong>${status === "metadata-repair-needed" ? "METADATI CLOUD DA RIPARARE" : "SINCRONIZZAZIONE NON RIUSCITA"}</strong><span>Il progresso locale è al sicuro su questo dispositivo.</span><button type="button" class="btn account-secondary" data-cloud-save-sync-retry>RIPROVA</button></section>`;
    if (status === "sync-conflict") return '<section class="account-cloud-save account-cloud-save-error" data-cloud-save-status><strong>SINCRONIZZAZIONE BLOCCATA</strong><span>Il progresso locale è al sicuro. Aggiorna la pagina o controlla la versione cloud.</span><button type="button" class="btn account-secondary" data-cloud-save-check>CONTROLLA AGGIORNAMENTI</button></section>';
    if (status === "cloud-update-available") return '<section class="account-cloud-save" data-cloud-save-status><strong>AGGIORNAMENTO CLOUD DISPONIBILE</strong><span>Un altro dispositivo ha salvato progressi più recenti.</span><button type="button" class="btn account-secondary" data-cloud-save-update>AGGIORNA QUESTO DISPOSITIVO</button></section>';
    if (status === "cloud-available") return '<section class="account-cloud-save" data-cloud-save-status><strong>SALVATAGGIO CLOUD DISPONIBILE</strong><span>Puoi scaricare su questo dispositivo il progresso collegato al tuo account.</span><button type="button" class="btn account-secondary" data-cloud-save-restore>RIPRISTINA SALVATAGGIO</button></section>';
    if (status === "downloading") return '<section class="account-cloud-save" data-cloud-save-status><strong>DOWNLOAD SALVATAGGIO...</strong></section>';
    if (status === "verifying") return '<section class="account-cloud-save" data-cloud-save-status><strong>VERIFICA SALVATAGGIO...</strong></section>';
    if (status === "restoring") return '<section class="account-cloud-save" data-cloud-save-status><strong>RIPRISTINO SALVATAGGIO...</strong></section>';
    if (status === "restore-repair-needed") return '<section class="account-cloud-save account-cloud-save-error" data-cloud-save-status><strong>RIPRISTINO CLOUD DA COMPLETARE</strong><span>Il gioco resta bloccato finché la verifica locale e la pulizia del journal non terminano.</span><button type="button" class="btn account-secondary" data-cloud-save-restore>RIPROVA</button></section>';
    if (status === "restore-terminal-error") return '<section class="account-cloud-save account-cloud-save-error" data-cloud-save-status><strong>RECOVERY ACCOUNT SICURA</strong><span>Il vecchio target cloud non era immutabile: il ripristino parziale è stato chiuso senza riprenderlo.</span><span>Il gameplay e la sincronizzazione automatica restano bloccati; account, diagnostica e logout sono disponibili.</span><button type="button" class="btn account-secondary" data-cloud-save-restore>NUOVO CONFRONTO</button></section>';
    if (status === "restored") return '<section class="account-cloud-save" data-cloud-save-status><strong>SALVATAGGIO RIPRISTINATO</strong><span>Il progresso del tuo account è stato scaricato su questo dispositivo.</span><button type="button" class="btn account-secondary" data-cloud-save-open>APRI IL SALVATAGGIO</button></section>';
    if (status === "local-conflict") return '<section class="account-cloud-save account-cloud-save-error" data-cloud-save-status><strong>SALVATAGGIO LOCALE RILEVATO</strong><span>Scegli esplicitamente quale versione conservare. Nessuna scelta viene applicata automaticamente.</span><button type="button" class="btn account-primary" data-cloud-conflict-local>USA QUESTO DISPOSITIVO</button><button type="button" class="btn account-secondary" data-cloud-conflict-cloud>USA IL SALVATAGGIO CLOUD</button></section>';
    if (status === "conflict-confirm-local") return '<section class="account-cloud-save account-cloud-save-error" data-cloud-save-status><strong>CONFERMA SOSTITUZIONE CLOUD</strong><span>Il salvataggio di questo dispositivo sostituirà quello cloud. Conferma per continuare.</span><button type="button" class="btn account-primary" data-cloud-conflict-local-confirm>CONFERMA SOSTITUZIONE CLOUD</button></section>';
    if (status === "conflict-confirm-cloud") return '<section class="account-cloud-save account-cloud-save-error" data-cloud-save-status><strong>CONFERMA RIPRISTINO CLOUD</strong><span>Il salvataggio locale di questo dispositivo verrà sostituito dalla versione cloud.</span><button type="button" class="btn account-primary" data-cloud-conflict-cloud-confirm>CONFERMA SALVATAGGIO CLOUD</button></section>';
    if (status === "conflict-resolving-local") return '<section class="account-cloud-save" data-cloud-save-status><strong>SOSTITUZIONE CLOUD...</strong><span>Non chiudere questa schermata.</span></section>';
    if (status === "conflict-resolving-cloud") return '<section class="account-cloud-save" data-cloud-save-status><strong>PREPARAZIONE RIPRISTINO...</strong><span>Il salvataggio locale resta protetto fino alla verifica.</span></section>';
    if (status === "restore-error") {
      const integrity = cloudState.error && !String(cloudState.error).includes("network") && !String(cloudState.error).includes("unavailable");
      return `<section class="account-cloud-save account-cloud-save-error" data-cloud-save-status><strong>${integrity ? "SALVATAGGIO CLOUD NON VALIDO" : "RIPRISTINO NON RIUSCITO"}</strong><span>${integrity ? "I dati non sono stati applicati a questo dispositivo." : "Il salvataggio locale non è stato modificato."}</span><span>Dettaglio: ${escapeHtml(cloudState.error || "restore-failed")}</span><span>Settore: ${escapeHtml(cloudState.problemSector || "nessuno")}</span><span>Fase: ${escapeHtml(cloudState.restoreStage || "nessuna")}</span><button type="button" class="btn account-secondary" data-cloud-save-restore>RIPROVA</button></section>`;
    }
    if (status === "error") return '<section class="account-cloud-save account-cloud-save-error" data-cloud-save-status><strong>ASSOCIAZIONE NON RIUSCITA</strong><span>Il progresso locale è al sicuro su questo dispositivo.</span><button type="button" class="btn account-secondary" data-cloud-save-retry>RIPROVA</button></section>';
    return "";
  }
  function updateCloudSave() { const element = document.querySelector("[data-cloud-save-status]"); if (element) element.outerHTML = cloudSaveMarkup(); }
  function accountPanel() {
    let profileMarkup = cloudSaveMarkup();
    if (!state.profileComplete && state.error === "profile-incomplete") profileMarkup = '<p class="account-warning"><strong>PROFILO INCOMPLETO</strong><span>Il profilo Firestore privato non è disponibile.</span></p>';
    else if (!state.profileComplete && state.error === "profile-unavailable") profileMarkup = '<p class="account-warning"><strong>PROFILO TEMPORANEAMENTE NON DISPONIBILE</strong><span>Riprova il caricamento.</span></p><button type="button" class="btn account-secondary" data-account-retry-profile>RIPROVA</button>';
    else if (!state.profileComplete) profileMarkup = '<p class="account-warning"><strong>CARICAMENTO PROFILO...</strong></p>';
    return `<div class="account-details"><p><small>USERNAME PUBBLICO</small><strong>@${escapeHtml(state.username || "Non disponibile")}</strong></p><p><small>EMAIL</small><strong>${escapeHtml(state.email || "Non disponibile")}</strong></p><p class="account-verification"><small>STATO EMAIL</small><strong>${state.emailVerified ? "EMAIL VERIFICATA" : "EMAIL DA VERIFICARE"}</strong></p>${profileMarkup}</div>
      ${state.emailVerified ? "" : '<button type="button" class="btn account-secondary" data-account-refresh-verification>CONTROLLA VERIFICA</button><button type="button" class="btn account-secondary" data-account-resend>RINVIA EMAIL</button>'}<button type="button" class="btn account-primary" data-account-logout>ESCI</button>`;
  }
  function open(mode) {
    const root = document.getElementById("modal-root"); if (!root) return;
    restoreFocus = document.activeElement;
    if (mode) { activeTab = mode; modalView = "auth"; } else modalView = "account";
    document.documentElement.classList.add("account-modal-open"); document.body.classList.add("account-modal-open");
    root.innerHTML = `<div class="modal-backdrop account-modal-backdrop"><section class="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title"><button type="button" class="modal-close" data-account-close aria-label="Chiudi">✕</button><header><p class="eyebrow">INAZUMA ROGUELIKE</p><h2 id="account-modal-title">${state.status === "authenticated" ? "IL TUO ACCOUNT" : "ACCOUNT"}</h2></header><div data-account-content>${state.status === "authenticated" ? accountPanel() : authForm()}</div><p class="account-feedback" data-account-feedback aria-live="polite"></p></section></div>`;
    root.querySelector("input, [data-account-resend], [data-account-logout], [data-account-close]")?.focus({ preventScroll: true });
  }
  function close() {
    if (busy) return; const root = document.getElementById("modal-root"); if (root) root.innerHTML = "";
    modalView = null;
    document.documentElement.classList.remove("account-modal-open"); document.body.classList.remove("account-modal-open");
    if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true }); restoreFocus = null;
  }
  function setBusy(value, label = "ATTENDI...") { busy = value; document.querySelectorAll(".account-modal button, .account-modal input").forEach((el) => { el.disabled = value; }); const submit = document.querySelector(".account-form [type=submit]"); if (submit && value) submit.textContent = label; }
  async function submit(form) {
    if (busy || !global.InazumaAccount) return; const values = Object.fromEntries(new FormData(form)); setBusy(true);
    const login = form.dataset.accountForm === "login";
    if (login) loginSubmissionInFlight = true;
    try { if (!login) { const result = global.InazumaAccountCore.validateRegistration(values); if (!result.valid) throw { code: "account/validation", userMessage: result.message }; const created = await global.InazumaAccount.register(values); setBusy(false); open(); feedback(created.verificationSent ? "Account creato. Controlla la tua email per verificarlo." : "Account creato, ma l’email di verifica non è partita. Usa RINVIA EMAIL.", created.verificationSent ? "success" : "error"); } else { await global.InazumaAccount.login(values.email, values.password); setBusy(false); close(); } }
    catch (error) { setBusy(false); feedback(error.userMessage || global.InazumaAccountCore.formatAuthError(error), "error"); }
    finally { if (login) loginSubmissionInFlight = false; }
  }
  async function resetPassword() { const email = document.querySelector('.account-form input[name="email"]')?.value.trim(); if (!email) return feedback("Inserisci prima il tuo indirizzo email.", "error"); setBusy(true); try { await global.InazumaAccount.sendPasswordReset(email); setBusy(false); feedback("Se esiste un account associato, riceverai le istruzioni via email.", "success"); } catch (e) { setBusy(false); feedback(global.InazumaAccountCore.formatAuthError(e), "error"); } }
  async function resend() { if (Date.now() < resendAvailableAt) return feedback("Attendi prima di inviare una nuova email.", "error"); setBusy(true); try { await global.InazumaAccount.resendVerification(); resendAvailableAt = Date.now() + 60000; setBusy(false); feedback("Email di verifica inviata.", "success"); } catch (e) { setBusy(false); feedback(global.InazumaAccountCore.formatAuthError(e), "error"); } }
  async function refreshVerification() { const button = document.querySelector("[data-account-refresh-verification]"); if (!button || button.disabled) return; button.disabled = true; button.textContent = "CONTROLLO VERIFICA..."; try { const verified = await global.InazumaAccount.refreshEmailVerification(); if (!verified) { button.disabled = false; button.textContent = "CONTROLLA VERIFICA"; feedback("Email non ancora verificata.", "error"); } } catch (e) { button.disabled = false; button.textContent = "CONTROLLA VERIFICA"; feedback(global.InazumaAccountCore.formatAuthError(e), "error"); } }
  async function logout() {
    setBusy(true);
    try {
      await global.InazumaAccount.logout();
      setBusy(false);
      close();
    } catch (error) {
      setBusy(false);
      feedback(global.InazumaAccountCore.formatAuthError(error), "error");
    }
  }
  function onClick(event) { const target = event.target.closest?.("[data-account-trigger],[data-account-close],[data-account-tab],[data-account-reset],[data-account-logout],[data-account-resend],[data-account-refresh-verification],[data-account-retry-profile],[data-cloud-save-retry],[data-cloud-save-sync-retry],[data-cloud-save-check],[data-cloud-save-update],[data-cloud-save-restore],[data-cloud-save-open],[data-cloud-conflict-local],[data-cloud-conflict-cloud],[data-cloud-conflict-local-confirm],[data-cloud-conflict-cloud-confirm]"); if (!target) return; if (target.matches("[data-account-trigger]")) open(state.status === "authenticated" ? null : "login"); else if (target.matches("[data-account-close]")) close(); else if (target.dataset.accountTab) { activeTab = target.dataset.accountTab; open(activeTab); } else if (target.matches("[data-account-reset]")) resetPassword(); else if (target.matches("[data-account-resend]")) resend(); else if (target.matches("[data-account-refresh-verification]")) refreshVerification(); else if (target.matches("[data-account-retry-profile]")) global.InazumaAccount?.retryProfile(); else if (target.matches("[data-account-logout]")) logout(); else if (target.matches("[data-cloud-save-retry]")) global.InazumaCloudSave?.retryAssociation(); else if (target.matches("[data-cloud-save-sync-retry]")) global.InazumaCloudSave?.retrySync(); else if (target.matches("[data-cloud-save-check]")) global.InazumaCloudSave?.checkForCloudUpdate(); else if (target.matches("[data-cloud-save-update]")) global.InazumaCloudSave?.updateFromCloud(); else if (target.matches("[data-cloud-save-restore]")) ["restore-error", "restore-repair-needed", "restore-terminal-error"].includes(cloudState.status) ? global.InazumaCloudSave?.retryRestore() : global.InazumaCloudSave?.restoreCloudSave(); else if (target.matches("[data-cloud-save-open]")) global.InazumaCloudSave?.reloadAfterRestore(); else if (target.matches("[data-cloud-conflict-local]")) global.InazumaCloudSave?.requestConflictResolution("local"); else if (target.matches("[data-cloud-conflict-cloud]")) global.InazumaCloudSave?.requestConflictResolution("cloud"); else if (target.matches("[data-cloud-conflict-local-confirm]")) global.InazumaCloudSave?.resolveConflictUseLocal(); else if (target.matches("[data-cloud-conflict-cloud-confirm]")) global.InazumaCloudSave?.resolveConflictUseCloud(); }
  function onKeydown(event) { const modal = document.querySelector(".account-modal"); if (!modal) return; if (event.key === "Escape") return close(); if (event.key !== "Tab") return; const focusable = [...modal.querySelectorAll("button:not(:disabled),input:not(:disabled)")]; if (!focusable.length) return; const first = focusable[0], last = focusable.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  document.addEventListener("click", onClick); document.addEventListener("submit", (event) => { if (event.target.matches?.("[data-account-form]")) { event.preventDefault(); submit(event.target); } }); document.addEventListener("keydown", onKeydown);
  global.addEventListener("inazuma:auth-state-changed", (event) => { state = { ...initialState, ...event.detail }; updateButtons(); if (modalView === "account" && document.querySelector(".account-modal")) open(); else if (modalView === "auth" && loginSubmissionInFlight) return; });
  global.addEventListener("inazuma:cloud-save-state-changed", (event) => { cloudState = { status: "idle", error: null, ...event.detail }; updateCloudSave(); });
  global.InazumaAccountUI = Object.freeze({ buttonMarkup, updateButtons, openAuthModal: () => open("login"), openAccountModal: () => open(), close, getState: () => ({ ...state }) });
})(globalThis);
