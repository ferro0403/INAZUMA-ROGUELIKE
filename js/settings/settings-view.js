(function (global) {
  "use strict";

  function create({ escapeHtml }) {
    function choiceMarkup(choices, identity) {
      return choices.map((item) => {
        const selected = item.emblemId === identity.emblemId;
        const emblem = global.TeamEmblems.resolveTeamEmblem({ teamIdentity: { emblemId: item.emblemId }, seasonId: item.seasonId, fallbackKind: "user" });
        return `<button type="button" class="settings-emblem-choice ${selected ? "is-selected" : ""}" data-settings-emblem="${escapeHtml(item.emblemId)}">${global.TeamEmblems.teamEmblemMarkup(emblem, { escape: escapeHtml, className: "settings-choice-logo" })}<strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.seasonId.toUpperCase())}</small>${selected ? "<span>SELEZIONATO</span>" : ""}</button>`;
      }).join("");
    }

    function markup({ selectingEmblem, identity, savedIdentity, choices, current, smartAutoLineup }) {
      const choicesMarkup = choiceMarkup(choices, identity);
      const content = selectingEmblem
        ? `<section class="settings-panel settings-emblems-panel"><div class="settings-panel-title"><p class="eyebrow">STEMMI DISPONIBILI</p><strong>${choices.length} SBLOCCAT${choices.length === 1 ? "O" : "I"}</strong></div><div class="settings-emblem-grid">${choicesMarkup}</div>${choices.length === 1 ? '<div class="settings-empty-hint"><p>Acquista nuovi stemmi nel Negozio per renderli disponibili qui.</p><button class="btn settings-shop-link" id="settings-open-shop">VAI AL NEGOZIO</button></div>' : ""}</section>`
        : `<section class="settings-panel"><p class="eyebrow">PROFILO SQUADRA</p><div class="settings-name-row"><div><small>NOME SQUADRA</small><h2>${escapeHtml(savedIdentity?.name || "Non impostato")}</h2></div><button class="btn btn-yellow" id="settings-edit-name">MODIFICA</button></div><div class="settings-crest-row">${global.TeamEmblems.teamEmblemMarkup(current, { escape: escapeHtml, className: "settings-current-logo" })}<div><small>STEMMA SQUADRA</small><strong>${escapeHtml(choices.find((item) => item.emblemId === identity.emblemId)?.name || "Inazuma Lightning")}</strong></div><button class="btn btn-yellow" id="settings-change-emblem">CAMBIA STEMMA</button></div></section><section class="settings-panel settings-preferences-panel"><p class="eyebrow">PREFERENZE</p><label class="settings-toggle-row" for="settings-smart-lineup"><span><strong>AUTO-FORMAZIONE INTELLIGENTE</strong><small>Inserisce automaticamente i nuovi giocatori più forti nelle formazioni 11v11 e 5v5.</small></span><input type="checkbox" id="settings-smart-lineup" ${smartAutoLineup ? "checked" : ""} aria-describedby="settings-smart-lineup-description"><span class="settings-toggle" aria-hidden="true"></span></label><span id="settings-smart-lineup-description" class="sr-only">Preferenza persistente, disattivata per impostazione predefinita.</span></section>`;
      return `<main class="settings-screen"><header class="settings-header"><button class="settings-back" aria-label="${selectingEmblem ? "Torna alle Impostazioni" : "Torna alla Home"}">←</button><div><p class="eyebrow">PROFILO PERMANENTE</p><h1>${selectingEmblem ? "CAMBIA STEMMA" : "IMPOSTAZIONI"}</h1></div></header>${content}</main>`;
    }

    return Object.freeze({ markup });
  }

  global.SettingsView = Object.freeze({ create });
})(globalThis);
