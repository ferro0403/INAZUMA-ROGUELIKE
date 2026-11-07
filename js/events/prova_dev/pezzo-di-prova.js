// Pezzo aggiuntivo dell'evento di prova (solo sviluppo, Passo 3.6d): esempio di come un evento aggiunge una cosa sua
// senza toccare la parte comune ne' gli altri eventi. Aggiunge un riquadro nella home dell'evento.
(function (global) {
  "use strict";
  global.GameEvents?.extend?.("prova_dev", {
    homeSection({ escape }) {
      return '<section class="panel rtg-run-command event-extra-section" data-event-extra="prova_dev">' +
        '<span class="eyebrow">' + escape("PEZZO AGGIUNTIVO") + '</span>' +
        '<h2>' + escape("Solo nell'evento di prova") + '</h2>' +
        '<p>' + escape("Questo riquadro arriva dal file js/events/prova_dev/pezzo-di-prova.js.") + '</p></section>';
    },
  });
})(globalThis);
