"use strict";
// Preflight dei soli database del futuro evento Vento-Fuoco.
// Nessun evento viene registrato, nessun salvataggio viene toccato.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "data/events/vento_fuoco");
const data = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const expected = [
  { id: "fire-team", special: ["4539", "1105"] },
  { id: "blizzard-team", special: ["4538", "1122"] },
];
const seen = new Set();
for (const { id, special } of expected) {
  const team = data(id + "-players.json")[0];
  const lineup = data(id + "-lineup.json").teams[0];
  const moves = data(id + "-moves.json").players;
  assert.strictEqual(team.teamId, id);
  assert.strictEqual(lineup.teamId, id);
  assert.strictEqual(team.players.length, 19);
  assert.strictEqual(lineup.startingXI.length, 11);
  assert.strictEqual(lineup.bossFormation, "3-4-3");
  assert.strictEqual(lineup.bossLevel, 20);
  const byId = new Map(team.players.map(p => [String(p.playerId), p]));
  assert.strictEqual(byId.size, 19, id + ": ids ripetuti");
  assert.deepStrictEqual(
    Object.keys(moves).sort(), [...byId.keys()].sort(),
    id + ": mosse mancanti o in eccesso"
  );
  for (const playerId of byId.keys()) {
    assert(!seen.has(playerId), "ID ripetuto tra squadre: " + playerId);
    seen.add(playerId);
    assert.strictEqual(moves[playerId].moves.length, 4, id + ": 4 mosse per carta");
    assert(Number.isFinite(byId.get(playerId).overall));
    assert(byId.get(playerId).category, id + ": rarita' mancante");
  }
  assert.strictEqual(new Set(lineup.startingXI).size, 11, id + ": titolari ripetuti");
  for (const playerId of lineup.startingXI) assert(byId.has(playerId), id + ": titolare assente " + playerId);
  const roles = lineup.startingXI.reduce((acc, pid) => {
    const role = byId.get(pid).position;
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  assert.deepStrictEqual(roles, { FW: 3, MF: 4, DF: 3, GK: 1 }, id + ": ruoli 3-4-3");
  for (const pid of special) assert.strictEqual(byId.get(pid).category, "Mondiale");
}
assert.strictEqual(seen.size, 38);
console.log("vento-fuoco-data-test: PASS (2 squadre, 38 carte, 152 mosse e 2 formazioni)");
