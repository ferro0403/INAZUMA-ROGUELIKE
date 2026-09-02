(function (global) {
  "use strict";
  function create(deps) {
    const { view, app, resetRenderedViewScroll, bindSectionRootNav, normalizedHallSeasonName, formatDate, tacticPanelMarkup, championFormationMarkup, championFiveVFiveMarkup, snapshotCard, statsMarkup, awardsMarkup, showPlayerDetailsFor, scrollSnapshot } = deps;
  function bindHallPlayerDetails(team) {
    document.querySelectorAll("[data-hall-player]").forEach((button) => button.addEventListener("click", () => {
      const player = (team.fullRoster || []).find((p) => String(p.playerId) === String(button.dataset.hallPlayer));
      if (!player) return;
      showPlayerDetailsFor(player, { mode: "historical", readOnly: true, source: "hall-of-fame", playerId: player.playerId, level: player.finalLevel, equipment: player.equippedItem, team, runStats: team.playerStatistics?.[String(player.playerId)] || null, preserveScroll: scrollSnapshot() });
    }));
  }

  function renderHallOfFame() {
    if (!global.RestoreGameplayRoutingGate?.enter("hall")) return false;
    const teams = global.HallOfFameStorage.listSummaries();
    app.innerHTML = `<main class="hall-screen"><header class="hall-archive-head"><div><p class="eyebrow">ALBO D’ORO</p><h1>Squadre campioni</h1><p>Le imprese che hanno scritto la storia.</p></div>${view.sectionRootButton("hallRoot")}</header>${teams.length ? `<section class="hall-grid">${teams.map((team, index) => `<article class="hall-card"><div class="hall-card-rank"><span>★</span> CAMPIONE #${index + 1}</div><div><h2>${view.escapeHtml(team.teamName)}</h2><p class="hall-card-meta">${view.escapeHtml(normalizedHallSeasonName(team))} · ${formatDate(team.victoryDate)}</p></div><div class="hall-card-highlights"><span><small>MODULO</small><strong>${view.escapeHtml(team.finalFormation || '-')}</strong></span><span><small>OVERALL</small><strong>${view.escapeHtml(team.finalAverageOverall ?? 'N/D')}</strong></span><span><small>MVP</small><strong>${view.escapeHtml(team.mvp?.name || 'N/D')}</strong></span></div><div class="hall-card-footer"><div class="hall-portraits">${(team.portraits || []).map((src) => `<img src="${view.escapeHtml(src)}" alt="" loading="lazy"/>`).join('')}</div><button class="btn btn-yellow" data-open-hall-team="${view.escapeHtml(team.hallTeamId)}">Rivivi l'impresa</button></div></article>`).join('')}</section>` : `<section class="panel hall-empty"><h2>Nessuna squadra campione.</h2><p class="muted">Completa una run per lasciare il tuo segno.</p></section>`}</main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();
    document.querySelectorAll("[data-open-hall-team]").forEach((button) => button.addEventListener("click", () => renderHallOfFameDetail(button.dataset.openHallTeam)));
  }

  function renderHallOfFameDetail(hallTeamId) {
    const team = global.HallOfFameStorage.getTeam(hallTeamId);
    if (!team) return renderHallOfFame();
    app.innerHTML = `<main class="hall-detail-screen"><header class="hall-hero"><div class="hall-hero-copy"><p class="eyebrow">ALBO D’ORO</p><h1>${view.escapeHtml(team.teamName)}</h1><div class="hall-hero-meta"><span>${formatDate(team.victoryDate)}</span><span>${view.escapeHtml(normalizedHallSeasonName(team))}</span></div><p class="hall-boss-label">BOSS FINALE BATTUTO</p><strong class="hall-boss-name">${view.escapeHtml(team.finalBossName || 'N/D')}</strong></div><div class="hall-hero-trophy" aria-hidden="true">★</div>${view.sectionRootButton("hallDetail")}</header><section class="hall-detail-grid"><article class="hall-champion-team"><div class="hall-section-heading"><p class="eyebrow">SQUADRA VINCENTE</p><h2>Formazione finale</h2></div>${tacticPanelMarkup(team.finalFormation, { compact: true })}${championFormationMarkup(team)}<details class="hall-roster-extra"><summary>Riserve <span>${(team.bench || []).length}</span></summary><div class="bench-list">${(team.bench || []).map(snapshotCard).join('') || '<p class="muted">Non disponibili</p>'}</div></details><details class="hall-roster-extra"><summary>Formazione 5v5</summary>${championFiveVFiveMarkup(team)}</details></article><aside class="hall-achievement-column"><section class="hall-data-panel"><div class="hall-section-heading"><p class="eyebrow">LA RUN</p><h2>Statistiche essenziali</h2></div>${statsMarkup(team)}</section><section class="hall-awards-panel"><div class="hall-section-heading"><p class="eyebrow">RICONOSCIMENTI</p><h2>Premi della run</h2></div><div class="hall-awards-list">${awardsMarkup(team)}</div></section></aside></section></main>`;
    resetRenderedViewScroll(); bindHallPlayerDetails(team);
    bindSectionRootNav();
  }

    return Object.freeze({ renderList: renderHallOfFame, renderDetail: renderHallOfFameDetail, bindPlayerDetails: bindHallPlayerDetails });
  }
  global.HallController = Object.freeze({ create });
})(globalThis);
