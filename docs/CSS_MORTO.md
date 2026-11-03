# CSS morto — misura

Generato da `npm run css:usage` (`scripts/css/css-usage-report.mjs`) il 2026-11-03.

Metodo: il browser visita tutte le schermate degli screenshot e delle prove nel browser (viewport 412x915);
dopo ogni passo si controlla quali selettori trovano almeno un elemento. Stati come `:hover` e `::before` vengono
ignorati (conta l'elemento). Categorie:

- **usata**: almeno un selettore ha trovato un elemento;
- **morta-certa**: in ogni selettore c'e' una classe o un id che non compare in nessun file `js/` ne' in
  `index.html`: l'elemento non puo' esistere;
- **non-vista**: le classi esistono nel codice ma nessuna schermata visitata le ha mostrate. Puo' essere uno
  stato raro, una schermata non visitata o una regola solo desktop: **va controllata prima di toglierla**;
- **scartata**: il browser non la carica (selettore non valido), non ha effetto.

Limiti: le regole dentro `@media` per schermi larghi contano come usate se l'elemento esiste, anche se su
telefono non si applicano; le classi costruite pezzo per pezzo nel JS (es. `'rarity-' + nome`) possono far
sembrare "impossibili" regole vive: per questo la rimozione si fa a gruppi, con screenshot di confronto.

## Schermate e pop-up visitati durante la misura

| Stato | Visto da |
|---|---|
| pop-up: account-modal | screenshot |
| pop-up: development-confirm-modal | prove |
| pop-up: five-selector.five-selector-floating.is-open | screenshot |
| pop-up: five-simulation-modal | prove, screenshot |
| pop-up: five-simulation-modal.boss-simulation-modal | prove, screenshot |
| pop-up: inventory-flow-modal.inventory-confirmation-modal | screenshot |
| pop-up: item-reward-modal | prove, screenshot |
| pop-up: item-reward-modal.item-reward-result-modal | prove, screenshot |
| pop-up: player-detail-modal | prove, screenshot |
| pop-up: player-detail-modal.album-player-detail-modal | prove, screenshot |
| pop-up: pull-selection-modal | prove, screenshot |
| pop-up: pull-selection-modal.special-reward-modal | screenshot |
| pop-up: random-event-modal | prove, screenshot |
| pop-up: route-boss-preview-modal | screenshot |
| pop-up: rtg-modal | prove, screenshot |
| pop-up: rtg-modal.player-detail-modal.rtg-coaches-modal | prove, screenshot |
| pop-up: rtg-modal.rtg-coach-power-modal | prove |
| pop-up: rtg-modal.rtg-coaches-modal | prove, screenshot |
| pop-up: rtg-modal.rtg-coaches-modal.rtg-halloween-picker | prove, screenshot |
| pop-up: rtg-modal.rtg-pull-modal.rtg-halloween-pull-modal | prove |
| pop-up: rtg-modal.rtg-result-modal | prove, screenshot |
| pop-up: rtg-modal.rtg-squad-picker-modal | screenshot |
| pop-up: rtg-modal.rtg-squad-picker-modal.rtg-halloween-picker | prove |
| pop-up: rtg-modal.rtg-vending-modal | screenshot |
| pop-up: season-delete-modal | screenshot |
| pop-up: shop-buy-modal | prove |
| pop-up: shop-buy-modal.is-success | prove |
| pop-up: squad-formation-modal | screenshot |
| pop-up: team-name-modal | prove, screenshot |
| pop-up: trade-modal | prove, screenshot |
| schermata: album-screen.album-collections-screen | prove, screenshot |
| schermata: album-screen.album-roster-screen.album-roster-screen--modern | screenshot |
| schermata: album-screen.album-teams-screen | screenshot |
| schermata: boss-match-screen | prove, screenshot |
| schermata: boss-match-screen.rtg-prematch-shell.rtg-prematch-revolution | prove, screenshot |
| schermata: development-reward-screen | screenshot |
| schermata: development-screen | prove, screenshot |
| schermata: five-match-screen | prove, screenshot |
| schermata: five-screen.five-floating-picker-enabled | screenshot |
| schermata: five-screen.five-floating-picker-enabled.five-player-picker-open | screenshot |
| schermata: hall-screen | screenshot |
| schermata: halloween-native-match.boss-match-screen.rtg-prematch-shell | screenshot |
| schermata: halloween-native-match.rtg-match-shell.rtg-match-polish-v2 | screenshot |
| schermata: home-screen.modern-home | prove, screenshot |
| schermata: home-screen.modern-home.season-select-screen | prove, screenshot |
| schermata: inventory-screen.inventory-v2-screen | screenshot |
| schermata: onboarding-screen.formation-choice-screen | prove, screenshot |
| schermata: onboarding-screen.initial-draft-screen | prove, screenshot |
| schermata: route-screen | prove, screenshot |
| schermata: rtg-campaign-select | prove, screenshot |
| schermata: rtg-match-shell.rtg-match-polish-v2.rtg-match-revolution | prove, screenshot |
| schermata: rtg-run-screen.rtg-halloween-run-screen.halloween-screen | prove, screenshot |
| schermata: rtg-run-screen.rtg-route--ares | screenshot |
| schermata: rtg-run-screen.rtg-route--season-1 | prove, screenshot |
| schermata: settings-screen | screenshot |
| schermata: shop-screen | prove, screenshot |
| schermata: squad-screen | prove, screenshot |
| schermata: squad-screen.rtg-squad-shell | prove, screenshot |

Classi di stati notevoli viste a schermo (300): `album-detail-badge`, `album-player-detail-modal`, `boss-match-result-panel`, `boss-match-summary`, `detail-category`, `detail-element-chip`, `detail-stat`, `detail-stat-icon`, `detail-stat-label`, `detail-stat-track`, `detail-stat-value`, `detail-stats`, `development-confirm`, `development-confirm-costs`, `development-confirm-modal`, `development-confirm-requirements-title`, `development-detail`, `development-evolution-arrow`, `development-evolution-preview`, `development-reward-continue`, `development-reward-item`, `development-reward-list`, `development-reward-panel`, `development-reward-screen`, `development-reward-skip`, `equipped-detail`, `equipped-detail-copy`, `equipped-detail-empty`, `five-floating-picker-close`, `five-floating-picker-enabled`, `five-formation-summary`, `five-match-result-row`, `five-match-summary`, `five-player-picker-open`, `halloween-detail-native`, `halloween-event-detail`, `halloween-journey-summary`, `halloween-vending`, `halloween-vending-banner`, `halloween-vending-classic`, `halloween-vending-close`, `halloween-vending-teaser`, `halloween-vending-teaser-copy`, `has-special-move`, `inventory-confirmation`, `inventory-confirmation-item`, `inventory-confirmation-modal`, `inventory-confirmation-warning`, `is-duel-loser`, `is-duel-winner`, `item-reward-actions`, `item-reward-candidate`, `item-reward-content`, `item-reward-copy`, `item-reward-detail`, `item-reward-details`, `item-reward-effect`, `item-reward-head`, `item-reward-layout`, `item-reward-modal`, `item-reward-note`, `item-reward-options`, `item-reward-primary-action`, `item-reward-result`, `item-reward-result-modal`, `item-reward-screen`, `item-reward-screen--complete`, `item-reward-stats`, `item-reward-visual`, `node-special-level`, `node-type-pull_free_agents`, `node-type-special_match`, `node-type-trade`, `player-detail-content`, `player-detail-equipment`, `player-detail-heading`, `player-detail-hero`, `player-detail-hero--long-name`, `player-detail-identity`, `player-detail-layout`, `player-detail-modal`, `player-detail-move`, `player-detail-name`, `player-detail-rtg-four-moves`, `player-detail-rtg-pt`, `player-detail-section`, `player-detail-tags`, `player-detail-team`, `player-detail-visual`, `pull-choice-action-row`, `pull-choice-actions`, `pull-choice-option`, `pull-offer-grid`, `pull-player-card`, `pull-player-card--desktop`, `pull-player-card--mobile`, `pull-player-role`, `pull-selection-card`, `pull-selection-footer`, `pull-selection-head`, `pull-selection-modal`, `rtg-coach-detail`, `rtg-coach-field-picker`, `rtg-coach-picker-bench`, `rtg-coach-picker-bench-grid`, `rtg-coach-picker-pitch`, `rtg-coaches-reward`, `rtg-coaches-reward-art`, `rtg-coaches-reward-continue`, `rtg-coaches-reward-feature`, `rtg-coaches-reward-heading`, `rtg-coaches-reward-info`, `rtg-coaches-reward-title`, `rtg-coaches-reward-unlocked`, `rtg-duel-card`, `rtg-duel-card--clean`, `rtg-duel-card--revolution`, `rtg-duel-choice-card`, `rtg-duel-choice-grid`, `rtg-duel-choice-head`, `rtg-duel-choice-section`, `rtg-duel-context-meta`, `rtg-duel-contextbar`, `rtg-duel-continue`, `rtg-duel-goal-celebration`, `rtg-duel-goal-confirm`, `rtg-duel-minute`, `rtg-duel-player-copy`, `rtg-duel-player-element`, `rtg-duel-player-meta`, `rtg-duel-player-name`, `rtg-duel-portrait-panel`, `rtg-duel-portrait-panel--opponent`, `rtg-duel-portrait-panel--user`, `rtg-duel-possession`, `rtg-duel-pt-current`, `rtg-duel-pt-inline`, `rtg-duel-render`, `rtg-duel-result`, `rtg-duel-result--revolution`, `rtg-duel-result-banner`, `rtg-duel-result-move`, `rtg-duel-result-move--opponent`, `rtg-duel-result-player`, `rtg-duel-result-status`, `rtg-duel-result-vs`, `rtg-duel-story`, `rtg-duel-story--clean`, `rtg-duel-story--minimal`, `rtg-duel-versus-board`, `rtg-duel-versus-board--result`, `rtg-duel-visual`, `rtg-duel-visual--compare`, `rtg-duel-visual--opponent`, `rtg-duel-visual--user`, `rtg-duel-vs-core`, `rtg-duel-zone`, `rtg-final-continue`, `rtg-final-emblem`, `rtg-final-head`, `rtg-final-score`, `rtg-final-score-panel`, `rtg-final-state`, `rtg-final-team`, `rtg-final-team--opponent`, `rtg-final-team--user`, `rtg-final-token-rewards`, `rtg-final-verdict`, `rtg-half-confirm`, `rtg-halftime`, `rtg-halftime-bench-panel`, `rtg-halftime-bench-strip`, `rtg-halftime-break-banner`, `rtg-halftime-field-panel`, `rtg-halftime-layout`, `rtg-halftime-minute`, `rtg-halftime-player-card`, `rtg-halftime-revolution`, `rtg-halftime-score`, `rtg-halftime-score-emblem`, `rtg-halftime-score-emblem--opponent`, `rtg-halftime-score-emblem--user`, `rtg-halftime-scoreboard`, `rtg-halftime-section-title`, `rtg-halftime-shape`, `rtg-halftime-team-logo`, `rtg-halloween-picker`, `rtg-halloween-pull-modal`, `rtg-journey-summary`, `rtg-match-result`, `rtg-match-result--cabin`, `rtg-match-revolution`, `rtg-match-squad-field-shell--halftime`, `rtg-penalty-ball-sprite`, `rtg-penalty-ball-wrap`, `rtg-penalty-choice`, `rtg-penalty-dot`, `rtg-penalty-dot--pending`, `rtg-penalty-goal`, `rtg-penalty-goal--illustrated`, `rtg-penalty-head`, `rtg-penalty-history`, `rtg-penalty-panel`, `rtg-penalty-player-card`, `rtg-penalty-score`, `rtg-penalty-team-emblem`, `rtg-penalty-versus`, `rtg-picker-filter`, `rtg-picker-grid`, `rtg-picker-load-more`, `rtg-picker-load-more-wrap`, `rtg-picker-ovr-sort`, `rtg-picker-quick-bench`, `rtg-picker-quick-head`, `rtg-picker-quick-strip`, `rtg-picker-rarity-filter`, `rtg-picker-search`, `rtg-picker-season-filter`, `rtg-picker-season-team-filters`, `rtg-picker-source-filters`, `rtg-picker-squad-card`, `rtg-picker-team-filter`, `rtg-picker-toolbar`, `rtg-prematch-revolution`, `rtg-pt-duel`, `rtg-pt-penalty-balance`, `rtg-pt-tap-to-confirm`, `rtg-pull-balance`, `rtg-pull-card-stage`, `rtg-pull-continue`, `rtg-pull-meta`, `rtg-pull-modal`, `rtg-pull-player-card`, `rtg-pull-player-identity`, `rtg-pull-rarity`, `rtg-pull-result`, `rtg-pull-result--elite`, `rtg-pull-result--forte`, `rtg-pull-result--leggenda`, `rtg-pull-result-body`, `rtg-pull-result-copy`, `rtg-pull-result-head`, `rtg-pull-reveal-label`, `rtg-pull-role`, `rtg-pull-series`, `rtg-pull-team`, `rtg-pull-team-logo`, `rtg-result-modal`, `rtg-squad-picker`, `rtg-squad-picker-head`, `rtg-squad-picker-modal`, `rtg-vending`, `rtg-vending-album-link`, `rtg-vending-body-v9`, `rtg-vending-brand-v9`, `rtg-vending-button`, `rtg-vending-capsule-v9`, `rtg-vending-chute-flap-v10`, `rtg-vending-chute-v9`, `rtg-vending-chute-well-v9`, `rtg-vending-crank-v9`, `rtg-vending-funnel-v10`, `rtg-vending-head-v9`, `rtg-vending-info-v9`, `rtg-vending-machine-v12`, `rtg-vending-machine-v9`, `rtg-vending-modal`, `rtg-vending-prize-track-v9`, `rtg-vending-prize-v9`, `rtg-vending-pull`, `rtg-vending-ratebar`, `rtg-vending-stage`, `rtg-vending-title`, `rtg-vending-wallet-chip`, `rtg-vending-window-glare-v9`, `rtg-vending-window-v9`, `shop-buy-modal__confirm`, `special-reward-actions`, `special-reward-head`, `special-reward-modal`, `squad-tactic-effect--penalty`, `toast`, `toast--success`, `toast-copy`, `toast-mark`, `toast-root`, `trade-actions`, `trade-bench-panel`, `trade-field-panel`, `trade-flow-summary`, `trade-hero`, `trade-modal`, `trade-node-head`, `trade-player-card`, `trade-section-head`, `trade-selection-copy`, `trade-selection-state`, `trade-selection-summary`, `trade-squad-layout`, `uses-special-move`

## Totale (fogli caricati dal gioco)

| | Regole | `!important` |
|---|---|---|
| usata | 6170 (64%) | 5295 |
| morta-certa | 477 (5%) | 62 |
| non-vista | 2939 (31%) | 2049 |
| scartata | 1 (0%) | 1 |
| **totale** | 9587 | 7407 |

## File CSS mai caricati

Non compaiono in `index.html`, in nessun `@import` e in nessun file JS: il browser non li scarica mai.

| File | Righe | `!important` |
|---|---|---|
| css/rtg-economy.css | 32 | 265 |
| css/rtg-foundation.css | 91 | 6 |
| css/rtg-match.css | 933 | 562 |
| css/rtg-prematch.css | 102 | 57 |
| css/rtg-shell.css | 166 | 148 |
| css/rtg-squad.css | 280 | 245 |
| css/rtg-vending.css | 52 | 158 |
| **totale** | 1656 | 1441 |

## Per file

| File | Regole | usata | morta-certa | non-vista | scartata | `!important` | `!imp.` morti certi | `!imp.` non visti |
|---|---|---|---|---|---|---|---|---|
| css/game.css | 4212 | 2628 | 360 | 1224 | 0 | 80 | 1 | 9 |
| css/road-to-glory.css | 1548 | 845 | 0 | 703 | 0 | 976 | 0 | 358 |
| css/rtg-halloween-event.css | 435 | 250 | 86 | 99 | 0 | 611 | 50 | 110 |
| css/rtg-theme-core.css | 759 | 602 | 3 | 154 | 0 | 2505 | 4 | 431 |
| css/rtg-coaches.css | 351 | 205 | 1 | 145 | 0 | 725 | 3 | 337 |
| css/rtg-theme.css | 294 | 172 | 1 | 121 | 0 | 864 | 0 | 485 |
| css/rtg-run.css | 203 | 123 | 0 | 79 | 1 | 174 | 0 | 29 |
| css/inventory-redesign.css | 103 | 38 | 0 | 65 | 0 | 0 | 0 | 0 |
| css/rtg-theme-base.css | 407 | 354 | 6 | 47 | 0 | 1020 | 4 | 75 |
| css/five-match-picker-tuning.css | 33 | 0 | 0 | 33 | 0 | 18 | 0 | 18 |
| css/boss-match-prematch-restyle.css | 69 | 39 | 19 | 11 | 0 | 1 | 0 | 0 |
| css/rtg-match-pt.css | 34 | 6 | 0 | 28 | 0 | 0 | 0 | 0 |
| css/shop-ui-polish.css | 106 | 78 | 0 | 28 | 0 | 0 | 0 | 0 |
| css/ie3-secondary-reward-ui.css | 26 | 0 | 0 | 26 | 0 | 6 | 0 | 6 |
| css/trade-result-card-fix.css | 62 | 38 | 0 | 24 | 0 | 187 | 0 | 32 |
| css/player-detail-premium.css | 114 | 92 | 0 | 22 | 0 | 0 | 0 | 0 |
| css/player-detail-equipment-elements.css | 26 | 5 | 0 | 21 | 0 | 0 | 0 | 0 |
| css/rtg-match-pt-preview.css | 37 | 17 | 0 | 20 | 0 | 134 | 0 | 95 |
| css/rtg-version-banners.css | 20 | 3 | 0 | 17 | 0 | 84 | 0 | 60 |
| css/five-match-reference-polish.css | 39 | 23 | 0 | 16 | 0 | 0 | 0 | 0 |
| css/player-detail-reference-final.css | 106 | 92 | 0 | 14 | 0 | 0 | 0 | 0 |
| css/album-roster.css | 74 | 63 | 0 | 11 | 0 | 0 | 0 | 0 |
| css/boss-match-action-parity-fit.css | 27 | 17 | 1 | 9 | 0 | 0 | 0 | 0 |
| css/aurico-rarity.css | 10 | 1 | 0 | 9 | 0 | 0 | 0 | 0 |
| css/move-presentation.css | 42 | 38 | 0 | 4 | 0 | 0 | 0 | 0 |
| css/player-detail-team-name-fit.css | 10 | 7 | 0 | 3 | 0 | 11 | 0 | 3 |
| css/player-detail-element-badges-global.css | 7 | 5 | 0 | 2 | 0 | 3 | 0 | 0 |
| css/player-detail-reference-tuning.css | 26 | 24 | 0 | 2 | 0 | 0 | 0 | 0 |
| css/five-formation-floating-picker.css | 28 | 27 | 0 | 1 | 0 | 5 | 0 | 1 |
| css/five-match-rounded-rarity.css | 6 | 5 | 0 | 1 | 0 | 0 | 0 | 0 |
| css/album-collection-hero.css | 39 | 39 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/album-teams.css | 52 | 52 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/boss-match-simulation-modal-bridge.css | 4 | 4 | 0 | 0 | 0 | 1 | 0 | 0 |
| css/five-match-action-assets.css | 30 | 30 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/five-match-banner-clean.css | 28 | 28 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/five-simulation-polish.css | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/match-simulation-modern.css | 72 | 72 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/match-ui-cleanup.css | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/player-detail-premium-fixes.css | 19 | 19 | 0 | 0 | 0 | 2 | 0 | 0 |
| css/rtg-four-moves.css | 22 | 22 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/season-delete-modal-restyle.css | 23 | 23 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/shop-ui-fixes.css | 21 | 21 | 0 | 0 | 0 | 0 | 0 | 0 |
| css/squad-formation-picker-restyle.css | 54 | 54 | 0 | 0 | 0 | 0 | 0 | 0 |
