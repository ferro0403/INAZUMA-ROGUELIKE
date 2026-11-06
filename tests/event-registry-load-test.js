"use strict";
// Passo 3.4: le carte di un evento non devono mai essere lette come carte di una Season, neanche se il file
// dell'evento non si carica. Un id elencato in data/events/index.json resta un evento anche senza il suo file;
// se manca l'elenco, load() fallisce (il gioco non parte) e una nuova chiamata riprova.
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const fresh = () => {
  const context = vm.createContext({ console: { warn() {} } });
  context.globalThis = context;
  for (const file of ["js/events/event-registry.js", "js/season-registry.js", "js/road-to-glory/rtg-card-identity.js"]) {
    if (fs.existsSync(file)) vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  }
  return context;
};
const reply = (body, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => body });

(async () => {
  // 1) Il file dell'evento non si carica: l'evento resta riconosciuto dall'elenco.
  const broken = fresh();
  await broken.GameEvents.load(async (url) => (url.endsWith("index.json") ? reply({ events: ["halloween2026"] }) : reply({}, false)));
  assert.strictEqual(broken.GameEvents.get("halloween2026"), null, "il file rotto non viene registrato");
  assert.strictEqual(broken.GameEvents.isEvent("halloween2026"), true, "l'id elencato resta un evento");
  assert.strictEqual(broken.GameEvents.isEventCard("halloween2026::38"), true);
  const card = broken.RoadToGloryCardIdentity.record({ playerId: "38", legacySeasonId: "halloween2026" });
  assert.strictEqual(card.cardId, "halloween2026::38", "l'id della carta non viene riscritto come carta di Season");

  // 2) Manca l'elenco: load() fallisce e la chiamata successiva riprova davvero.
  const offline = fresh();
  let calls = 0;
  const failing = async () => { calls += 1; return reply({}, false); };
  await assert.rejects(() => offline.GameEvents.load(failing), /indice eventi/);
  await assert.rejects(() => offline.GameEvents.load(failing), /indice eventi/);
  assert.strictEqual(calls, 2, "il secondo tentativo scarica di nuovo l'elenco");

  // 3) Il gioco non parte senza elenco (app.js): messaggio sulla schermata di caricamento, nessun init.
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.match(app, /if \(!\(await \(global\.GameEvents \? loadEvents\(\) : true\)\)\) return null;/);
  assert.match(app, /Impossibile caricare i dati del gioco/);

  console.log("event-registry-load-test: PASS (carte evento mai riscritte, elenco mancante = il gioco non parte)");
})().catch((error) => { console.error(error); process.exit(1); });
