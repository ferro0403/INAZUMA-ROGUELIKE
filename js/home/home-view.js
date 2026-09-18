(function (global) {
  "use strict";

  const HOME_SECONDARY_ACTIONS = [
    {
      id: "open-shop-home",
      label: "Negozio",
      description: "Oggetti e potenziamenti",
      icon: "◆",
      className: "home-club-action--wide",
    },
    {
      id: "open-development-home",
      label: "Centro di Sviluppo",
      description: "Potenzia il tuo club",
      icon: "↗",
      className: "home-club-action--wide",
    },
    {
      id: "open-album-home",
      label: "Album",
      description: "Le tue collezioni",
      icon: "▤",
      className: "",
    },
    {
      id: "open-hall-home",
      label: "Albo d’Oro",
      description: "Le squadre campioni",
      icon: "★",
      className: "home-club-action--gold",
    },
    {
      id: "open-modes-home",
      label: "Modalità",
      description: "Altre modalità di gioco",
      icon: "⚡",
      className: "home-club-action--wide",
    },
  ];

  global.HomeView = {
    create({
      escapeHtml,
      normalizeTeamIdentity,
      savedTeamIdentity,
      seasonDisplayName,
      resolvedRosterPlayer,
      averageOverall,
      lifeHeartsMarkup,
      bossTeamLogoUrl,
      getSeasonDb,
    }) {
      function runFormationLabel(savedRun) {
        const formation = getSeasonDb()?.formations?.eleven?.find(
          (item) => item.id === savedRun?.formationId,
        );
        return (
          formation?.formation ||
          formation?.name ||
          savedRun?.formationId ||
          "Da scegliere"
        );
      }
      function runHeartsMarkup(savedRun) {
        return lifeHeartsMarkup(savedRun?.lives);
      }
      function runAverageOverall(savedRun) {
        return averageOverall(
          (savedRun?.roster || [])
            .map((entry) => resolvedRosterPlayer(entry.playerId || entry.id))
            .filter(Boolean),
        );
      }
      function homeZoneProgress(savedRun) {
        const zone = savedRun?.currentZone;
        if (!zone?.nodes?.length) return 0;
        const currentNode = zone.nodes.find(
          (node) => node.id === zone.currentNodeId,
        );
        const finalLayer = Math.max(
          1,
          ...zone.nodes.map((node) => Number(node.layer || 0)),
        );
        return Math.max(
          0,
          Math.min(
            100,
            Math.round((Number(currentNode?.layer || 0) / finalLayer) * 100),
          ),
        );
      }
      function homeQuickActionsMarkup() {
        const actions = HOME_SECONDARY_ACTIONS.map(
          ({ id, label, description, icon, className }) => `
        <button type="button" class="home-club-action ${className}" id="${id}"><span class="home-club-icon" aria-hidden="true">${icon}</span><span class="home-club-copy"><strong>${label}</strong><small>${description}</small></span><span class="home-club-arrow" aria-hidden="true">»</span></button>`,
        ).join("");
        return `<section class="home-club-section" aria-label="Il tuo club"><div class="home-section-label"><span>⚡</span> Il tuo club</div><nav class="home-club-actions" aria-label="Sezioni principali">${actions}</nav></section>`;
      }
      function homeTeamCrestMarkup(identity) {
        const emblem = global.TeamEmblems.resolveTeamEmblem({
          teamIdentity: identity,
          fallbackKind: "user",
        });
        return global.TeamEmblems.teamEmblemMarkup(emblem, {
          escape: escapeHtml,
          className: "home-team-emblem",
        });
      }
      function homeIdentityMarkup(
        savedRun,
        profileIdentity = savedTeamIdentity(),
      ) {
        const identity = normalizeTeamIdentity(
          savedRun?.teamIdentity || profileIdentity || {},
        );
        const season = savedRun
          ? global.SeasonRegistry?.get?.(savedRun.seasonId)
          : null;
        return `<section class="home-team-banner anime-panel" aria-label="Identità squadra"><div class="home-team-crest">${homeTeamCrestMarkup(identity)}</div><div class="home-team-copy"><h1>${escapeHtml(identity.name)}</h1>${savedRun ? `<p>${escapeHtml(seasonDisplayName(savedRun.seasonId))}</p>${season?.displaySeasonNumber != null ? `<span>Stagione ${escapeHtml(season.displaySeasonNumber)}</span>` : ""}` : ""}</div></section>`;
      }
      function homeActiveRunMarkup(savedRun) {
        const seasonDb = getSeasonDb();
        const bossIndex = Number(savedRun.bossIndex || 0);
        const boss = seasonDb?.bossOrder?.[bossIndex];
        const bossNumber = bossIndex + 1;
        const totalBosses = seasonDb?.bossOrder?.length || 10;
        const zoneProgress = homeZoneProgress(savedRun);
        const bossLogo = bossTeamLogoUrl(boss);
        return `<div class="home-content"><section class="home-hero home-active-dashboard" aria-label="Home con run attiva">${homeIdentityMarkup(savedRun)}<article class="home-hub-card home-run-card home-run-panel anime-panel"><div class="home-panel-kicker"><span>⚡</span> Run in corso</div><div class="home-next-boss"><div class="home-boss-identity"><small>Prossimo boss</small><span class="home-boss-logo">${bossLogo ? `<img src="${escapeHtml(bossLogo)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><b hidden aria-hidden="true">B</b>` : "B"}</span><strong>${escapeHtml(boss?.teamName || "Raimon")}</strong></div><div class="home-stage"><small>Stage</small><strong>${escapeHtml(Math.min(bossNumber, totalBosses))}<em>/${escapeHtml(totalBosses)}</em></strong></div></div><div class="home-run-stats"><span><small>Media team</small><strong>${escapeHtml(runAverageOverall(savedRun))}</strong></span><span><small>Formazione</small><strong>${escapeHtml(runFormationLabel(savedRun))}</strong></span><span class="home-zone-stat"><small>Progresso zona</small><strong>${escapeHtml(zoneProgress)}%</strong><i><b style="width:${zoneProgress}%"></b></i></span></div></article><button type="button" class="home-main-cta" id="home-primary-cta"><span aria-hidden="true">⚡</span><strong id="continue-run">Continua la run »</strong></button>${homeQuickActionsMarkup()}</section></div>`;
      }
      function homeEmptyRunMarkup() {
        return `<div class="home-content"><section class="home-hero home-empty-dashboard" aria-label="Home senza run attiva">${homeIdentityMarkup(null)}<article class="home-empty-panel anime-panel"><div class="home-panel-kicker"><span>⚡</span> Nessuna run attiva</div><div class="home-empty-copy"><h1>Scrivi la tua leggenda</h1><p>Una nuova avventura ti aspetta.</p></div><button type="button" class="home-main-cta" id="home-primary-cta"><span aria-hidden="true">⚡</span><strong id="choose-run">Entra nel torneo »</strong></button></article>${homeQuickActionsMarkup()}</section></div>`;
      }
      function homeRtgHubMarkup() {
        return `<div class="home-content home-rtg-content"><section class="home-hero home-rtg-hub" aria-label="Road to Glory"><article class="home-rtg-hero anime-panel"><div class="home-panel-kicker"><span>⚡</span> Road to Glory</div><div class="home-rtg-title"><small>SEASON 1</small><h1>Road to Glory</h1><p>La tua rosa. Il tuo percorso. Una modalità tutta sua.</p></div><button type="button" class="home-main-cta home-rtg-primary" data-rtg-home-open="run"><span aria-hidden="true">⚡</span><strong>Apri Road to Glory »</strong></button></article><section class="home-rtg-shortcuts" aria-label="Sezioni Road to Glory"><button type="button" class="home-rtg-shortcut home-rtg-shortcut--wide" data-rtg-home-open="squad"><span>♟</span><strong>Squadra</strong><small>Formazione e panchina</small><b>»</b></button><button type="button" class="home-rtg-shortcut" data-rtg-home-open="catalog"><span>▦</span><strong>Giocatori RTG</strong><small>Catalogo posseduti</small><b>»</b></button><button type="button" class="home-rtg-shortcut" data-rtg-home-open="vending"><span>◉</span><strong>Distributore</strong><small>Palline Season 1</small><b>»</b></button></section></section></div>`;
      }
      function homePagerMarkup(mainMarkup) {
        return `<div class="home-page-switcher" aria-label="Cambia Home"><button type="button" class="home-page-tab active" data-home-page-target="main" aria-current="page"><i class="home-page-dot"></i><span>HOME</span></button><button type="button" class="home-page-tab" data-home-page-target="rtg"><i class="home-page-dot"></i><span>RTG</span><b aria-hidden="true">›</b></button></div><div class="home-swipe-viewport" data-home-swipe-viewport><div class="home-swipe-track" data-home-swipe-track><section class="home-swipe-page home-swipe-page--main" data-home-page="main">${mainMarkup}</section><section class="home-swipe-page home-swipe-page--rtg" data-home-page="rtg">${homeRtgHubMarkup()}</section></div></div>`;
      }
      return {
        runFormationLabel,
        runHeartsMarkup,
        runAverageOverall,
        homeZoneProgress,
        homeQuickActionsMarkup,
        homeTeamCrestMarkup,
        homeIdentityMarkup,
        homeActiveRunMarkup,
        homeEmptyRunMarkup,
        homeRtgHubMarkup,
        homePagerMarkup,
        homeRunCardMarkup: (run) =>
          run ? homeActiveRunMarkup(run) : homeEmptyRunMarkup(),
      };
    },
  };
})(globalThis);
