// Elenco delle schermate fotografate da capture.mjs.
// Ogni scena parte da un browser pulito. "account": "vuoto" = primo avvio,
// "sbloccato" = tutti gli svincolati sbloccati (serve per aprire RTG ed evento).
// Passi possibili:
//   { click: "selettore CSS" }   { text: "testo visibile" }   { fill: ["selettore", "valore"] }
//   { repeat: [n, "selettore"] }  { wait: ms }   { scroll: "selettore" }
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

  // --- Evento Halloween (card giocatore e coach: bug gia' risolto, qui per accorgersi se ricompare)
  { name: "30-halloween-home", account: "sbloccato", steps: halloween },
  { name: "31-halloween-prepartita", account: "sbloccato", steps: [...halloween, { click: ".halloween-event-main-cta" }] },
  { name: "32-halloween-distributore", account: "sbloccato", steps: [...halloween, { text: "APRI DISTRIBUTORE" }] },
  { name: "33-halloween-squadra", account: "sbloccato", steps: [...halloween, { click: "[data-halloween-tab=squad]" }] },
  { name: "36-halloween-allenatori", account: "sbloccato", steps: [...halloween, { click: "[data-halloween-tab=squad]" }, { click: "[data-rtg-open-coaches], [data-rtg-squad-coach-select]" }] },
  { name: "34-halloween-card-giocatore", account: "sbloccato", steps: [...halloween, { click: ".tactical-player-card" }] },
  { name: "35-halloween-pagina-intera", account: "sbloccato", steps: halloween, fullPage: true },
];
