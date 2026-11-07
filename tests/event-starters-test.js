"use strict";
// Ogni evento (veri e finti) deve mostrare e schierare 11 titolari avversari. Errore trovato il 7 nov: l'evento di
// prova (Angeli di prova, 4-2-4) mostrava 9 giocatori perche' il modulo usava sempre il 4-4-2 di Halloween e i 2
// attaccanti in piu' non trovavano posto. Ora la formazione viene dal file della formazione dell'evento.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const read = (file) => fs.readFileSync(file, "utf8");
const context = vm.createContext({});
context.globalThis = context;
vm.runInContext(read("js/road-to-glory/rtg-config.js"), context);
const formations = new Map(Array.from(context.RoadToGloryConfig.season("ie1").formations).map((f) => [f.id, Array.from(f.slotRoles)]));
const files = ["data/events/" + "halloween2026.json"];
const DEV = "data/events/dev";
for (const f of fs.readdirSync(DEV).filter((n) => n.endsWith(".json"))) files.push(path.join(DEV, f));
const index = JSON.parse(read("data/events/index.json")).events.map((id) => `data/events/${id}.json`);
for (const f of index) if (!files.includes(f)) files.push(f);

const count = (list) => list.reduce((acc, role) => ({ ...acc, [role]: (acc[role] || 0) + 1 }), {});
for (const file of files) {
  const m = JSON.parse(read(file));
  const lineup = JSON.parse(read(m.team.files.lineup)).teams[0];
  const team = JSON.parse(read(m.team.files.players))[0];
  const byId = new Map(team.players.map((p) => [String(p.playerId), p]));
  const where = `${m.id} (${lineup.bossFormation})`;
  assert.strictEqual(m.team.startersSize, 11, `${where}: startersSize deve essere 11`);
  assert.strictEqual(new Set(lineup.startingXI.map(String)).size, 11, `${where}: 11 titolari diversi`);
  const slots = formations.get(lineup.bossFormation);
  assert(slots, `${where}: formazione sconosciuta`);
  const roles = lineup.startingXI.map((id) => byId.get(String(id))?.position);
  assert(roles.every(Boolean), `${where}: titolare fuori dalla squadra`);
  assert.deepStrictEqual(count(roles), count(slots), `${where}: i ruoli dei titolari devono riempire la formazione (11 al loro posto)`);
}
const source = read("js/road-to-glory/rtg-halloween-event.js");
assert.doesNotMatch(source, /formationId:"4-4-2"/, "la formazione avversaria non e' piu' fissa");
assert.match(source, /formationId:assets\.setup\.bossFormation/);
console.log(`event-starters-test: PASS (${files.length} eventi, 11 titolari al loro posto)`);
