"use strict";
const assert=require("assert"),fs=require("fs");
const catalog=JSON.parse(fs.readFileSync("data/ORION_moves.json","utf8"));
const season=JSON.parse(fs.readFileSync("data/ORION_season_compact.json","utf8"));
const ares=JSON.parse(fs.readFileSync("data/IE2_moves.json","utf8"));
assert.strictEqual(catalog.seasonId,"orion");
const ids=new Set(season.players.map(p=>String(p.playerId)));
assert.strictEqual(ids.size,309);
assert.deepStrictEqual(new Set(Object.keys(catalog.players)),ids);
const recruit=new Set(season.teams.filter(t=>t.sourceKind==="recruitment_source").flatMap(t=>t.playerIds.map(String)));
assert.strictEqual(recruit.size,129);
for(const id of recruit){assert(ares.players[id],"Ares move missing "+id);assert.deepStrictEqual(catalog.players[id],ares.players[id],"Inherited Ares move changed "+id);}
for(const move of Object.values(catalog.players)){assert(move.name&&move.type&&move.element);assert(Number.isFinite(move.power)&&move.power>0);}
for(const [name,power] of Object.entries({"Photon Crash":80,"Containment Field":105,"Double-Trouble":85,"Last Resort Σ":110,"Last Resort D":110,"Last Resort":110,"Orion's Shade":110})){const found=Object.values(catalog.players).filter(x=>x.name===name);assert(found.length,"Missing move "+name);assert(found.every(x=>x.power===power),"Wrong Power "+name);}
assert(Object.values(catalog.players).some(x=>x.element==="Void"));
for(const name of ["Icebreaker","Triple Blizzard","Beyond the Death Zone"]){const found=Object.values(catalog.players).filter(x=>x.name===name);assert(found.length&&found.every(x=>x.power===105&&x.tension===100),name);}
console.log("Orion catalog: 309 players, 129 Ares inherited, approvals and Void OK");
