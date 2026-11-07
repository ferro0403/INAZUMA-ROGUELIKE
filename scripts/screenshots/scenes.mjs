// Elenco delle schermate fotografate da capture.mjs.
// Ogni scena parte da un browser pulito. "account": "vuoto" = primo avvio,
// "sbloccato" = tutti gli svincolati sbloccati (serve per aprire RTG ed evento),
// "rtg" = solo svincolati fino a 74 di overall (la prima partita RTG accetta potenza massima 75).
// Passi possibili:
//   { click: "selettore CSS" }   { text: "testo visibile" }   { fill: ["selettore", "valore"] }
//   { repeat: [n, "selettore"] }  { wait: ms }   { scroll: "selettore" }
//   { game: "metodo", args: [...] }  azione composta del banco di prova (tests/browser/harness.mjs)
//   { removeClass: ["selettore", "classe"] }  toglie una classe (per simulare un percorso che non la aggiunge)
//   { devClick: "selettore" }  clic via JavaScript (pulsanti degli strumenti ?dev=1)   { waitFor: "selettore" }
// Opzioni della scena: seed (seme della casualita'), dev: true (apre il gioco con ?dev=1), fullPage: true.
// Se un passo fallisce la scena viene segnata come "incompleta" nel report, senza fermare le altre.

const newRun = [
  { click: "#home-primary-cta" },
  { text: "INIZIA NUOVA RUN" },
  { fill: ["input", "Squadra Test"] },
  { click: "#confirm-team-name" },
];
const drafted = [...newRun, { click: ".formation-card" }, { repeat: [14, ".pull-player-card"] }];
const rtgCampaigns = [{ click: ".home-page-tab:nth-child(2)" }, { click: ".home-rtg-primary" }];
const rtgS1 = [...rtgCampaigns, { click: "[data-rtg-campaign=rtg-ie-trilogy]" }];
const halloween = [...rtgCampaigns, { click: "[data-rtg-halloween-open]" }];
const onMap = [...drafted, { click: "#go-map" }];
const itemClaimed = [...onMap, { click: "[data-node-id=zone_0_l1_n0]" }, { click: "[data-claim-item]" }, { click: "#finish-item-reward" }];
const fiveMatch = [...onMap, { click: ".map-node.reachable[data-node-type=five_v_five]" }];
const finalRun = [...onMap, { devClick: "[data-dev-run=final]" }, { devClick: "[data-dev-run=skip]" }, { click: "#development-reward-continue" }];
const equipFlow = [...onMap, { click: "[data-node-id=zone_0_l1_n0]" }, { click: "[data-reward-candidate=physical_band]" }, { click: "[data-claim-item]" }, { click: "#finish-item-reward" }, { click: "[data-nav=inventory]" }, { click: "[data-equip-item]" }];
const evolved = [{ click: "#open-shop-home" }, { click: "[data-shop-coins='1000']" }, { click: "[data-shop-cups=ie1][data-amount='5']" }, { click: "[data-buy-project=Buono]" }, { click: ".shop-buy-modal__confirm" }, { click: ".shop-back" }, { click: "#open-development-home" }, { click: "[data-development-card]" }, { click: "#prepare-evolution:not([disabled])" }, { click: "#confirm-evolution" }, { wait: 1000 }, { devClick: "#modal-root [data-close-modal]" }];
const halloweenCoach = [...halloween, { devClick: "[data-halloween-dev-pumpkins]" }, { wait: 500 }, { game: "spinHalloweenUntilCoach" }, { game: "prepareHalloweenCoachSquad" }];
const seasonEnd = [{ devClick: "[data-dev-rtg=season-complete]" }, { waitFor: ".rtg-journey-summary--complete" }];
const nextSeason = [{ click: "[data-rtg-enter-next-season]" }, { wait: 800 }];
const rtgPrematch = [...rtgS1, { click: "[data-rtg-current-node]" }, { click: "[data-rtg-start-node]:not([disabled])" }];

export const scenes = [
  // --- Home e sezioni del club
  { name: "01-home", account: "vuoto", steps: [] },
  { name: "02-home-rtg-tab", account: "sbloccato", steps: [{ click: ".home-page-tab:nth-child(2)" }] },
  { name: "03-selezione-season", account: "vuoto", steps: [{ click: "#home-primary-cta" }] },
  { name: "04-negozio", account: "vuoto", steps: [{ click: "#open-shop-home" }] },
  { name: "05-centro-sviluppo", account: "sbloccato", steps: [{ click: "#open-development-home" }] },
  { name: "06-album", account: "sbloccato", steps: [{ click: "#open-album-home" }] },
  { name: "07-albo-oro", account: "vuoto", steps: [{ click: "#open-hall-home" }] },
  { name: "08-modalita", account: "vuoto", steps: [{ click: "#open-modes-home" }] },
  { name: "09-impostazioni", account: "vuoto", steps: [{ click: "#open-settings-home" }] },

  // --- Run classica
  { name: "10-run-nome-squadra", account: "vuoto", steps: newRun.slice(0, 2) },
  { name: "11-run-moduli", account: "vuoto", steps: newRun },
  { name: "12-run-draft", account: "vuoto", steps: [...newRun, { click: ".formation-card" }] },
  { name: "13-run-squadra", account: "vuoto", steps: drafted },
  { name: "14-run-mappa", account: "vuoto", steps: [...drafted, { click: "#go-map" }] },
  { name: "15-run-anteprima-boss", account: "vuoto", steps: [...drafted, { click: "#go-map" }, { click: "#open-boss-preview" }] },
  { name: "16-run-inventario", account: "vuoto", steps: [...drafted, { click: "#go-map" }, { text: "Oggetti" }] },
  { name: "17-run-tab-5v5", account: "vuoto", steps: [...drafted, { click: "#go-map" }, { text: "5v5" }] },
  { name: "18-run-primo-nodo", account: "vuoto", steps: [...drafted, { click: "#go-map" }, { click: ".map-node.reachable" }] },

  // --- Road to Glory
  { name: "20-rtg-campagne", account: "sbloccato", steps: rtgCampaigns },
  { name: "21-rtg-mappa-s1", account: "sbloccato", steps: rtgS1 },
  { name: "22-rtg-prepartita", account: "sbloccato", steps: [...rtgS1, { text: "Prepara partita" }] },
  { name: "23-rtg-squadra", account: "sbloccato", steps: [...rtgS1, { click: "[data-rtg-tab=squad]" }] },
  { name: "26-rtg-allenatori", account: "sbloccato", steps: [...rtgS1, { click: "[data-rtg-tab=squad]" }, { click: "[data-rtg-open-coaches]" }] },
  { name: "27-rtg-dettaglio-coach", account: "sbloccato", steps: [...rtgS1, { click: "[data-rtg-tab=squad]" }, { click: "[data-rtg-open-coaches]" }, { click: "[data-rtg-coach-detail]" }] },
  { name: "24-rtg-distributore", account: "sbloccato", steps: [...rtgS1, { click: ".rtg-vending-button" }] },
  { name: "25-rtg-mappa-ares-orion", account: "sbloccato", steps: [...rtgCampaigns, { click: "[data-rtg-campaign=rtg-ares-orion]" }] },

  // --- Stati aggiunti nel Passo 1 per misurare il CSS (schermate prima mai visitate)
  { name: "40-album-collezione", account: "sbloccato", steps: [{ click: "#open-album-home" }, { text: "APRI COLLEZIONE" }] },
  { name: "41-album-rosa", account: "sbloccato", steps: [{ click: "#open-album-home" }, { text: "APRI COLLEZIONE" }, { click: "[data-album-team=__free_agents]" }] },
  { name: "42-album-scheda", account: "sbloccato", steps: [{ click: "#open-album-home" }, { text: "APRI COLLEZIONE" }, { click: "[data-album-team=__free_agents]" }, { click: "[data-album-player]" }] },
  { name: "43-run-elimina", account: "vuoto", steps: [...onMap, { click: "[data-section-root]" }, { click: "[data-season-delete=ie1]" }] },
  { name: "44-run-modulo", account: "vuoto", steps: [...drafted, { click: "#open-squad-formation" }] },
  { name: "45-run-editor-5v5", account: "vuoto", steps: [...onMap, { click: "[data-nav=five]" }, { click: "[data-five-slot=FW]" }] },
  { name: "46-run-premio-oggetto", account: "vuoto", steps: [...onMap, { click: "[data-node-id=zone_0_l1_n0]" }] },
  { name: "47-run-inventario-pieno", account: "vuoto", steps: [...itemClaimed, { click: "[data-nav=inventory]" }] },
  { name: "48-run-usa-oggetto", account: "vuoto", steps: [...itemClaimed, { click: "[data-nav=inventory]" }, { click: "[data-use-item]" }] },
  { name: "49-run-partita-5v5", account: "vuoto", steps: fiveMatch },
  { name: "50-run-risultato-5v5", account: "vuoto", steps: [...fiveMatch, { click: "#simulate-boss-match" }, { click: "#skip-match-result" }] },
  { name: "51-rtg-scheda-giocatore", account: "rtg", steps: [...rtgS1, { click: "[data-rtg-tab=squad]" }, { click: "[data-rtg-player-detail]" }] },
  { name: "52-rtg-cambio-giocatore", account: "rtg", steps: [...rtgS1, { click: "[data-rtg-tab=squad]" }, { click: "[data-rtg-change-player]" }] },
  { name: "53-rtg-prepartita-squadre", account: "rtg", steps: rtgPrematch },
  { name: "54-rtg-partita-duello", account: "rtg", steps: [...rtgPrematch, { click: "[data-rtg-prematch-start]" }, { click: "[data-rtg-choice]" }] },

  // --- Stati di partita e fine partita (aggiunti dopo la richiesta dell'utente del 3 novembre)
  { name: "55-run-boss-vinto", account: "vuoto", steps: [...onMap, { game: "walkToBoss" }, { click: ".map-node.boss-node.reachable" }, { game: "playOpenMatch" }] },
  { name: "56-run-dopo-boss-vinto", account: "vuoto", steps: [...onMap, { game: "walkToBoss" }, { click: ".map-node.boss-node.reachable" }, { game: "playOpenMatch" }, { click: "#continue-match-result" }, { click: "#skip-offer" }] },
  { name: "57-run-boss-perso", account: "vuoto", seed: 8, steps: [...onMap, { game: "walkToBoss" }, { click: ".map-node.boss-node.reachable" }, { game: "playOpenMatch" }] },
  { name: "58-run-game-over", account: "vuoto", seed: 6, steps: [...onMap, { game: "walkToBoss" }, { click: ".map-node.boss-node.reachable" }, { game: "playOpenMatch" }, { click: "#continue-match-result" }] },
  { name: "59-run-evento-casuale", account: "vuoto", seed: 2, steps: [{ game: "startClassicRun" }, { click: "#go-map" }, { game: "walkToNode", args: ["random"] }, { click: ".map-node.reachable[data-node-type=random]" }] },
  { name: "60-run-partita-speciale", account: "vuoto", steps: [{ game: "startClassicRun", args: [1] }, { click: "#go-map" }, { game: "walkToNode", args: ["special_match"] }, { click: ".map-node.reachable[data-node-type=special_match]" }] },
  { name: "61-run-speciale-risultato", account: "vuoto", steps: [{ game: "startClassicRun", args: [1] }, { click: "#go-map" }, { game: "walkToNode", args: ["special_match"] }, { click: ".map-node.reachable[data-node-type=special_match]" }, { game: "playOpenMatch" }, { click: "#continue-match-result" }] },
  { name: "62-rtg-intervallo", account: "rtg", dev: true, steps: [...rtgPrematch, { devClick: "[data-rtg-prematch-start]" }, { devClick: "[data-dev-rtg=halftime]" }] },
  { name: "63-rtg-rigori", account: "rtg", dev: true, steps: [...rtgPrematch, { devClick: "[data-rtg-prematch-start]" }, { devClick: "[data-dev-rtg=penalties]" }] },
  { name: "64-rtg-vittoria", account: "rtg", dev: true, steps: [...rtgPrematch, { devClick: "[data-rtg-prematch-start]" }, { devClick: "[data-dev-rtg=win]" }] },
  { name: "65-rtg-sconfitta", account: "rtg", dev: true, steps: [...rtgPrematch, { devClick: "[data-rtg-prematch-start]" }, { devClick: "[data-dev-rtg=loss]" }] },
  { name: "66-account", account: "vuoto", steps: [{ click: "[data-account-trigger]" }] },
  { name: "67-halloween-partita", account: "sbloccato", steps: [...halloween, { click: "[data-halloween-start]" }, { click: "[data-rtg-prematch-start], [data-halloween-start]" }, { waitFor: "[data-rtg-choice]" }] },

  // --- Fine run, Albo d'Oro, pull leggendario (strumenti di test ?dev=1 del gioco)
  { name: "70-run-zona-finale", account: "vuoto", dev: true, steps: [...onMap, { devClick: "[data-dev-run=final]" }] },
  { name: "71-run-ricompense-completata", account: "vuoto", dev: true, steps: [...onMap, { devClick: "[data-dev-run=final]" }, { devClick: "[data-dev-run=skip]" }] },
  { name: "72-run-celebrazione", account: "vuoto", dev: true, steps: [...finalRun] },
  { name: "73-run-riepilogo-squadra", account: "vuoto", dev: true, steps: [...finalRun, { click: "#final-continue" }] },
  { name: "74-run-riepilogo-statistiche", account: "vuoto", dev: true, steps: [...finalRun, { click: "#final-continue" }, { click: "[data-final-tab=stats]" }] },
  { name: "75-run-riepilogo-premi", account: "vuoto", dev: true, steps: [...finalRun, { click: "#final-continue" }, { click: "[data-final-tab=awards]" }] },
  { name: "76-albo-oro-dettaglio", account: "vuoto", dev: true, steps: [...finalRun, { click: "#final-continue" }, { click: "#open-current-hall" }] },
  { name: "77-run-pull-leggendario", account: "vuoto", dev: true, steps: [...onMap, { devClick: "[data-dev-open-legendary]" }] },
  { name: "78-run-oggetto-equipaggia", account: "vuoto", steps: [...equipFlow] },
  { name: "79-run-oggetto-equipaggiato", account: "vuoto", steps: [...equipFlow, { click: "[data-item-target-player]" }, { click: "[data-confirm-equipment-target]:not([disabled])" }, { click: "[data-inventory-tab=equipped]" }] },
  { name: "80-run-ie3-partita-speciale", account: "vuoto", dev: true, steps: [{ game: "startClassicRun", args: [2] }, { click: "#go-map" }, { devClick: "[data-dev-run=skip]" }, { game: "walkToNode", args: ["special_match"] }, { click: ".map-node.reachable[data-node-type=special_match]" }, { game: "playOpenMatch" }, { click: "#continue-match-result" }] },
  { name: "81-sviluppo-evoluzioni", account: "sbloccato", dev: true, steps: [...evolved, { devClick: "[data-development-tab=management]" }] },
  { name: "82-sviluppo-progetti", account: "sbloccato", dev: true, steps: [...evolved, { devClick: "[data-development-tab=projects]" }] },
  { name: "83-rtg-sviluppo", account: "sbloccato", steps: [{ click: "[data-rtg-home-open=development]" }] },
  { name: "84-rtg-negozio", account: "sbloccato", steps: [{ click: "[data-rtg-home-open=shop]" }] },
  { name: "85-rtg-album", account: "sbloccato", steps: [{ click: "[data-rtg-home-open=album]" }] },
  { name: "86-rtg-premio-distributore", account: "rtg", dev: true, steps: [...rtgS1, { devClick: "[data-dev-rtg=tokens]" }, { devClick: "[data-dev-rtg=pool]" }, { click: "[data-rtg-open-vending]" }, { click: "[data-rtg-pull]:not([disabled])" }, { waitFor: "[data-rtg-pull-continue]" }] },

  // --- Schermate aggiunte il 5 nov 2026 dopo regressioni viste solo nelle preview (mai visitate prima)
  { name: "87-rtg-distributore-allenatori", account: "sbloccato", steps: [...rtgS1, { click: "[data-rtg-tab=squad]" }, { click: "[data-rtg-open-coaches]" }, { click: "[data-rtg-coaches-tab=draw]" }] },
  { name: "88-rtg-riepilogo-partita", account: "rtg", flowingClock: true, steps: [...rtgPrematch, { click: "[data-rtg-prematch-start]" }, { game: "playRtgMatch" }, { waitFor: "[data-rtg-result-continue]" }] },
  { name: "89-halloween-potere-allenatore", account: "sbloccato", dev: true, steps: [...halloweenCoach, { click: "[data-rtg-coach-power-configure]" }, { waitFor: ".rtg-coach-field-picker" }] },
  { name: "90-halloween-potere-scelto", account: "sbloccato", dev: true, steps: [...halloweenCoach, { click: "[data-rtg-coach-power-configure]" }, { click: ".rtg-coach-field-picker [data-rtg-squad-player^='halloween2026::']" }, { waitFor: ".rtg-coach-power-projection" }] },
  // Fine Season RTG (comando ?dev=1 "FINE SEASON"): titolo accanto al cerchio della Season, in Season diverse
  { name: "93-rtg-fine-season-1", account: "rtg", dev: true, steps: [...rtgS1, ...seasonEnd] },
  { name: "94-rtg-season-2-sbloccata", account: "rtg", dev: true, steps: [...rtgS1, ...seasonEnd, ...nextSeason] },
  { name: "95-rtg-fine-campagna", account: "rtg", dev: true, fullPage: true, steps: [...rtgS1, ...seasonEnd, ...nextSeason, ...seasonEnd, ...nextSeason, ...seasonEnd] },
  { name: "96-rtg-fine-season-ares", account: "rtg", dev: true, steps: [...rtgCampaigns, { click: "[data-rtg-campaign=rtg-ares-orion]" }, ...seasonEnd] },
  // Scheda Halloween aperta da un percorso che non aggiunge #modal-root.halloween-detail-native (es. Shawn dalla squadra)
  { name: "92-halloween-scheda-senza-evento", account: "sbloccato", dev: true, steps: [...halloweenCoach, { click: "[data-rtg-player-detail^='halloween2026::']" }, { removeClass: ["#modal-root", "halloween-detail-native"] }] },
  { name: "91-halloween-scheda-da-squadra", account: "sbloccato", dev: true, steps: [...halloweenCoach, { click: "[data-rtg-player-detail^='halloween2026::']" }] },

  // --- Carte Halloween nelle schermate RTG comuni (Passo 3.6: devono restare identiche). Account con le 18 carte e Hekyll.
  { name: "97-hw-album-collezione", account: "sbloccato", steps: [{ game: "giveHalloweenCollection" }, { click: "[data-rtg-home-open=album]" }, { click: "[data-rtg-album-halloween]" }, { click: "[data-rtg-album-team]" }, { wait: 800 }] },
  { name: "98-hw-album-scheda", account: "sbloccato", steps: [{ game: "giveHalloweenCollection" }, { click: "[data-rtg-home-open=album]" }, { click: "[data-rtg-album-halloween]" }, { click: "[data-rtg-album-team]" }, { wait: 800 }, { click: "[data-rtg-album-player-card], [data-rtg-album-player-entry]" }, { wait: 600 }] },
  { name: "99-hw-cambio-giocatore-rtg", account: "sbloccato", steps: [{ game: "giveHalloweenCollection" }, ...rtgS1, { click: "[data-rtg-tab=squad]" }, { click: "[data-rtg-change-player]" }, { fill: ["[data-rtg-picker-search]", "Nathan"] }, { wait: 600 }] },
  { name: "100-hw-allenatori-rtg", account: "sbloccato", steps: [{ game: "giveHalloweenCollection" }, ...rtgS1, { click: "[data-rtg-tab=squad]" }, { click: "[data-rtg-open-coaches]" }, { click: "[data-rtg-coaches-tab=collection]" }] },
  { name: "101-hw-album-allenatori", account: "sbloccato", steps: [{ game: "giveHalloweenCollection" }, { click: "[data-rtg-home-open=album]" }, { click: "[data-rtg-album-coaches-open]" }, { wait: 600 }] },

  // --- Evento Halloween (card giocatore e coach: bug gia' risolto, qui per accorgersi se ricompare)
  { name: "30-halloween-home", account: "sbloccato", steps: halloween },
  { name: "31-halloween-prepartita", account: "sbloccato", steps: [...halloween, { click: ".halloween-event-main-cta" }] },
  { name: "32-halloween-distributore", account: "sbloccato", steps: [...halloween, { text: "APRI DISTRIBUTORE" }] },
  { name: "33-halloween-squadra", account: "sbloccato", steps: [...halloween, { click: "[data-halloween-tab=squad]" }] },
  { name: "36-halloween-allenatori", account: "sbloccato", steps: [...halloween, { click: "[data-halloween-tab=squad]" }, { click: "[data-rtg-open-coaches], [data-rtg-squad-coach-select]" }] },
  { name: "34-halloween-card-giocatore", account: "sbloccato", steps: [...halloween, { click: ".tactical-player-card" }] },
  { name: "35-halloween-pagina-intera", account: "sbloccato", steps: halloween, fullPage: true },
];
