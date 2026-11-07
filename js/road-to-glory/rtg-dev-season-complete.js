// Strumento di test (solo con ?dev=1): pulsante "FINE SEASON" nel menu DEV RTG.
// Porta la Season attiva alla schermata di fine Season: tutte le tappe fatte, tutte le squadre principali battute.
// Il controller RTG chiama attach(panel, devUpdateCampaign) dopo aver costruito il pannello: il comando cambia la
// campagna con lo stesso aggiornamento degli altri comandi dev, senza accedere ai dati interni del controller.
(function (global) {
  "use strict";

  // Stessi campi che il gioco imposta quando una Season finisce.
  function complete(state, config = global.RoadToGloryConfig) {
    const seasonId = String(state?.activeSeasonId || "ie1");
    const nodes = Array.from(config?.buildSeasonNodes?.(seasonId) || []);
    if (!nodes.length) return state;
    state.currentNodeId = nodes.at(-1).id;
    state.furthestNodeIndex = nodes.length - 1;
    state.seasonComplete = true;
    state.defeatedTeamIds = Array.from(new Set(config?.season?.(seasonId)?.mainTeams || []));
    return state;
  }

  function attach(panel, devUpdateCampaign) {
    const next = panel?.querySelector?.('[data-dev-rtg="next-node"]');
    if (!next || typeof devUpdateCampaign !== "function") return;
    const button = panel.ownerDocument.createElement("button");
    button.type = "button";
    button.dataset.devRtg = "season-complete";
    button.textContent = "FINE SEASON";
    next.after(button);
    button.addEventListener("click", () =>
      devUpdateCampaign("rtg-dev-season-complete", (state) => complete(state), "DEV: Season completata"));
  }

  global.RoadToGloryDevSeasonComplete = Object.freeze({ complete, attach });
})(globalThis);
