(function (global) {
  "use strict";
  function create(deps) {
    function renderPending(result, retryFlow) {
      deps.app().innerHTML = `<main class="hero-screen finalization-pending-screen" data-finalization-pending>
        <section class="panel"><p class="eyebrow">SALVATAGGIO CAMPIONI</p><h1>Finalizzazione in sospeso</h1>
        <p class="muted">La vittoria è al sicuro. Completa il salvataggio permanente prima di continuare.</p>
        <button type="button" class="btn btn-yellow" id="retry-run-finalization">RIPROVA / CONTINUA</button></section></main>`;
      deps.resetScroll();
      document.getElementById("retry-run-finalization")?.addEventListener("click", retryFlow);
      return result;
    }
    function renderCelebration(team, go) {
      deps.app().innerHTML = `<main class="final-celebration-screen"><section class="final-celebration-panel"><header class="final-victory-hero"><div class="final-trophy" aria-hidden="true">★</div><div class="final-victory-copy"><p class="eyebrow">${deps.escapeHtml(deps.seasonName(team).toUpperCase())} COMPLETATA</p><h1>${deps.escapeHtml(team.teamName)}</h1><h2>Campioni della run</h2><p>${deps.escapeHtml(team.modeName)} · ${deps.formatDate(team.victoryDate)} · ${deps.escapeHtml(team.finalFormation || '-')}</p></div></header><div class="final-victory-team"><div class="final-victory-section-head"><span>Squadra vincente</span><strong>La formazione che ha scritto la storia</strong></div>${deps.formationMarkup(team)}</div><div class="button-row final-actions"><button type="button" class="btn btn-yellow" id="final-continue">Continua <span aria-hidden="true">→</span></button><button type="button" class="btn" id="skip-final-animation">Vai al riepilogo</button></div></section></main>`;
      deps.resetScroll(); deps.bindPlayerDetails(team);
      document.getElementById("final-continue").addEventListener("click", go);
      document.getElementById("skip-final-animation").addEventListener("click", go);
    }
    function renderSummary(team, ordinal) {
      deps.app().innerHTML = `<main class="final-summary-screen"><header class="final-summary-head"><div><p class="eyebrow">CAMPIONI · ${deps.escapeHtml(deps.seasonName(team).toUpperCase())}</p><h1>${deps.escapeHtml(team.teamName)}</h1><p class="final-summary-meta"><span>${deps.formatDate(team.victoryDate)}</span><span>${deps.escapeHtml(deps.seasonName(team))}</span><span>Seed ${deps.escapeHtml(deps.compactSeed(team.seed))}</span><span>#${deps.escapeHtml(ordinal || '-')} Albo d’Oro</span></p></div><span class="final-summary-star" aria-hidden="true">★</span></header><nav class="final-tabs" role="tablist"><button class="active" data-final-tab="team" role="tab" aria-selected="true">Squadra</button><button data-final-tab="stats" role="tab" aria-selected="false">Statistiche</button><button data-final-tab="awards" role="tab" aria-selected="false">Premi</button></nav><section class="final-summary-grid"><article class="panel final-tab-panel" data-tab-panel="team">${deps.tacticMarkup(team.finalFormation, { compact: true })}${deps.formationMarkup(team)}<h3>Riserve</h3><div class="bench-list">${(team.bench || []).map(deps.snapshotCard).join("") || '<p class="muted">Non disponibili</p>'}</div><h3>Formazione 5v5</h3>${deps.fiveMarkup(team)}</article><article class="panel final-tab-panel" data-tab-panel="stats">${deps.statsMarkup(team)}</article><article class="panel final-tab-panel" data-tab-panel="awards">${deps.awardsMarkup(team)}</article><aside class="panel final-actions-panel"><button class="btn btn-yellow" id="open-current-hall">Apri Albo d’Oro</button><button class="btn btn-primary" id="final-new-run">Nuova run</button>${deps.sectionRootButton("finalSummary")}</aside></section></main>`;
      deps.resetScroll(); deps.bindTabs(); deps.bindPlayerDetails(team);
      document.getElementById("open-current-hall").addEventListener("click", () => deps.renderHallDetail(team.hallTeamId));
      deps.bindSectionRootNav();
      document.getElementById("final-new-run").addEventListener("click", deps.startNewRun);
    }
    return { renderPending, renderCelebration, renderSummary };
  }
  global.FinalizationView = { create };
})(globalThis);
