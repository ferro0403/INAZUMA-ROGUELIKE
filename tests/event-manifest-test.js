"use strict";
// Passo 3: controllo dei file evento (data/events/*.json). Ogni evento deve avere carte esistenti con la rarita'
// giusta, un allenatore con un potere valido e almeno una carta a cui applicarlo, date coerenti, prezzi validi.
// Per Halloween controlla anche la PARITA' con i valori che prima erano scritti nel codice.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = { console };
context.globalThis = context;
vm.createContext(context);
for (const file of ["js/road-to-glory/rtg-config.js", "js/road-to-glory/rtg-coaches.js", "js/events/event-registry.js",
  "js/road-to-glory/rtg-economy.js", "js/road-to-glory/rtg-coach-power-types.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
const { RoadToGloryConfig: config, RoadToGloryCoaches: coaches, GameEvents: events } = context;
const RARITIES = Array.from(context.RoadToGloryEconomy?.RARITIES ||
  ["Scarso", "Debole", "Normale", "Buono", "Forte", "Elite", "Mondiale", "Leggenda", "Aurico"]);
const DIR = "data/events";
const index = JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8"));
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
assert.deepStrictEqual([...index.events].sort(), files.map((f) => f.replace(/\.json$/, "")).sort(),
  "index.json deve elencare esattamente i file evento presenti");

const seen = { id: new Set(), badge: new Set(config.SEASON_IDS.map((id) => config.seasonShortLabel(id))), prefix: new Set() };
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const okImage = (value) => typeof value === "string" && (/^https:\/\//.test(value) || fs.existsSync(value));

for (const file of files) {
  const m = readJson(path.join(DIR, file));
  const where = `evento ${file}`;
  const problems = Array.from(events.validate(m));
  assert.strictEqual(problems.length, 0, `${where}: forma non valida: ${problems.join("; ")}`);
  assert.strictEqual(`${m.id}.json`, file, `${where}: id diverso dal nome del file`);

  // Unici tra eventi e Season.
  assert(!config.SEASON_IDS.includes(m.id) && !seen.id.has(m.id), `${where}: id gia' usato`);
  assert(!seen.badge.has(m.labels.badge), `${where}: sigla ${m.labels.badge} gia' usata da una Season o un evento`);
  assert(!seen.prefix.has(m.save.cardIdPrefix), `${where}: prefisso carte gia' usato`);
  seen.id.add(m.id); seen.badge.add(m.labels.badge); seen.prefix.add(m.save.cardIdPrefix);

  // Date: fine dopo l'inizio, durata ragionevole.
  const start = Date.parse(m.window.start), end = Date.parse(m.window.end);
  assert(end > start, `${where}: la fine deve essere dopo l'inizio`);
  assert(end - start <= 90 * 86400000, `${where}: evento piu' lungo di 90 giorni`);
  assert(config.SEASON_IDS.includes(m.baseSeasonId), `${where}: baseSeasonId ${m.baseSeasonId} non e' una Season`);

  // Squadra e carte.
  for (const key of ["players", "lineup", "moves"]) assert(fs.existsSync(m.team.files[key]), `${where}: manca ${m.team.files[key]}`);
  const team = readJson(m.team.files.players).find((t) => t.teamId === m.team.teamId);
  assert(team, `${where}: la squadra ${m.team.teamId} non e' nel file giocatori`);
  const players = new Map(team.players.map((p) => [String(p.playerId), p]));
  const moves = readJson(m.team.files.moves).players;
  for (const card of m.cards) {
    const player = players.get(card.playerId);
    assert(player, `${where}: la carta ${card.playerId} non esiste nel file giocatori`);
    assert(RARITIES.includes(card.rarity), `${where}: rarita' ${card.rarity} non valida (${card.playerId})`);
    assert.strictEqual(card.rarity, player.category, `${where}: rarita' della carta ${card.playerId} diversa dai dati`);
    assert.strictEqual(moves[card.playerId]?.moves?.length, 4, `${where}: la carta ${card.playerId} deve avere 4 mosse`);
    if (card.fullbody !== undefined) assert(okImage(card.fullbody), `${where}: immagine non valida (${card.playerId})`);
  }
  assert.strictEqual(players.size, m.team.rosterSize, `${where}: il file giocatori non ha ${m.team.rosterSize} carte`);
  const lineup = readJson(m.team.files.lineup).teams.find((t) => t.teamId.replaceAll("_", "-") === m.team.teamId);
  assert(lineup, `${where}: formazione della squadra mancante`);
  assert.strictEqual(new Set(lineup.startingXI.map(String)).size, m.team.startersSize, `${where}: titolari ripetuti o mancanti`);
  for (const id of lineup.startingXI) assert(m.cards.some((c) => c.playerId === String(id)), `${where}: titolare ${id} fuori dalle carte`);

  // Premio finale: non e' una carta del distributore.
  if (m.completionReward) {
    assert(!m.cards.some((c) => c.playerId === m.completionReward.playerId), `${where}: il premio finale e' gia' tra le carte`);
    assert(RARITIES.includes(m.completionReward.rarity), `${where}: rarita' del premio finale non valida`);
    if (m.completionReward.requires?.coachId) {
      assert(m.coaches.some((c) => c.id === m.completionReward.requires.coachId), `${where}: il premio chiede un allenatore assente`);
    }
  }

  // Allenatori: potere valido e almeno una carta a cui applicarlo.
  for (const coach of m.coaches || []) {
    // Stesso registro dei tipi usato dal gioco (rtg-coach-power-types.js).
    const errors = Array.from(context.RoadToGloryCoachPowerTypes.problems(coach.power));
    assert.strictEqual(errors.length, 0, `${where}: potere di ${coach.id} non valido: ${errors.join("; ")}`);
    const targets = coach.power.params.cardScope === "event" ? m.cards : [...players.values()];
    assert(targets.length >= coach.power.params.picks, `${where}: nessuna carta a cui applicare il potere di ${coach.id}`);
    const known = coaches.BY_ID[coach.id];
    assert(known, `${where}: allenatore ${coach.id} assente dal catalogo`);
    assert.strictEqual(coach.name, known.name, `${where}: nome dell'allenatore ${coach.id} diverso dal catalogo`);
    assert.strictEqual(coach.power.name, known.powerName, `${where}: nome del potere diverso dal catalogo`);
  }

  // Immagini (per ora possono restare indirizzi esterni, come deciso il 5 nov).
  for (const value of [m.team.logo, m.currency?.icon, m.assets?.banner, m.assets?.background].filter(Boolean)) {
    assert(okImage(value), `${where}: immagine non valida ${value}`);
  }
}

// Parita' di Halloween con i valori che prima erano scritti nel codice: si spostano, non cambiano.
const h = readJson(path.join(DIR, "halloween2026.json"));
assert.deepStrictEqual(JSON.parse(JSON.stringify(h.economy)), { pullPrice: 200, winPrize: 300, luckyPrize: 600, luckyChancePercent: 10 });
assert.strictEqual(Date.parse(h.window.end), Date.UTC(2026, 10, 6, 22, 59, 59), "fine evento: 6 nov 2026 23:59:59 ore italiane");
assert.strictEqual(h.window.start, "2026-10-28T01:38:58+01:00", "inizio: primo commit dell'evento su main (647c4672)");
assert.strictEqual(h.team.teamId, "occult-2");
assert.strictEqual(h.save.key, "halloween", "Halloween resta in shared.halloween");
assert.strictEqual(h.save.cardIdPrefix, "halloween2026::", "gli id delle carte gia' possedute non cambiano");
const rarityCount = h.cards.reduce((acc, c) => ({ ...acc, [c.rarity]: (acc[c.rarity] || 0) + 1 }), {});
assert.deepStrictEqual(rarityCount, { Forte: 14, Elite: 2, Leggenda: 2 });
assert.deepStrictEqual(h.cards.filter((c) => !c.vampire).map((c) => c.playerId).sort(), ["custom_0001", "custom_0002"]);
assert.strictEqual(h.coaches[0].id, "halloween-coach-54");
assert.deepStrictEqual(JSON.parse(JSON.stringify(h.coaches[0].power.params)),
  { amount: 15, picks: 1, target: "ownStarter", cardScope: "event" });

console.log(`event-manifest-test: PASS (${files.length} eventi)`);
