"use strict";
const assert=require("assert"),fs=require("fs");
const catalog=JSON.parse(fs.readFileSync("data/IE1_moves.json","utf8")),season=JSON.parse(fs.readFileSync("data/IE1_season_compact.json","utf8"));
assert.strictEqual(catalog.schemaVersion,1);assert.strictEqual(catalog.seasonId,"ie1");assert.strictEqual(Object.keys(catalog.players).length,157);
assert.deepStrictEqual(Object.keys(catalog.players).sort(),season.players.map(p=>String(p.playerId)).sort());
const expected={"1":["God Hand","save",70],"2":["Fire Tornado","shot",80],"5":["The Wall","defense",70],"7":["Dragon Crash","shot",70],"167":["Triangle Z","shot",85],"176":["Gigant Wall","save",80],"185":["God Knows","shot",100]};
for(const[id,row]of Object.entries(expected))assert.deepStrictEqual([catalog.players[id].name,catalog.players[id].type,catalog.players[id].power],row);
console.log("IE1 move catalog: 157 canonical players and approved Power overrides OK");
