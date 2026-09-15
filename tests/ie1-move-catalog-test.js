"use strict";
const assert=require("assert"),fs=require("fs");
const catalog=JSON.parse(fs.readFileSync("data/IE1_moves.json","utf8")),season=JSON.parse(fs.readFileSync("data/IE1_season_compact.json","utf8"));
assert.strictEqual(catalog.schemaVersion,1);assert.strictEqual(catalog.seasonId,"ie1");assert.strictEqual(Object.keys(catalog.players).length,157);assert.deepStrictEqual(new Set(Object.values(catalog.players).map(move=>move.element)),new Set(["Fire","Wind","Mountain","Forest"]));
assert.deepStrictEqual(Object.keys(catalog.players).sort(),season.players.map(p=>String(p.playerId)).sort());
const expected={"1":["God Hand","save","Mountain",65],"2":["Fire Tornado","shot","Fire",70],"5":["The Wall","defense","Mountain",65],"7":["Dragon Crash","shot","Forest",65],"167":["Triangle Z","shot","Fire",75],"176":["Gigant Wall","save","Mountain",70],"185":["God Knows","shot","Wind",85]};
for(const[id,row]of Object.entries(expected))assert.deepStrictEqual([catalog.players[id].name,catalog.players[id].type,catalog.players[id].element,catalog.players[id].power],row);
console.log("IE1 move catalog: 157 canonical players and approved Power overrides OK");
