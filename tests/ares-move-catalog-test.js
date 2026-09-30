"use strict";
const assert=require("assert"),fs=require("fs");
const season=JSON.parse(fs.readFileSync("data/IE2_season_compact.json","utf8"));
const catalog=JSON.parse(fs.readFileSync("data/IE2_moves.json","utf8"));
assert.strictEqual(catalog.schemaVersion,1);assert.strictEqual(catalog.seasonId,"ie2");
const active=(season.players||[]).filter(p=>Array.isArray(p.teamIds)&&p.teamIds.length>0).map(p=>String(p.playerId)).sort();
const ids=Object.keys(catalog.players||{}).sort();
assert.strictEqual(active.length,156);assert.strictEqual(ids.length,156);assert.deepStrictEqual(ids,active);
assert(!catalog.players["4441"],"Curt Gale must stay excluded");
for(const[id,m]of Object.entries(catalog.players)){assert(m?.name,id+" name");assert(["shot","dribble","defense","save"].includes(m.type),id+" type");assert(["Fire","Wind","Mountain","Forest"].includes(m.element),id+" element");assert(Number.isFinite(Number(m.power)),id+" power");}
const expected={"Mega Majin":90,"Savage Beast Fang":85,"Ursa Rager":85,"Rabbit Run":70,"Cold Front":90,"Containment Field":95,"Perfect Penguin":95,"Fur Trapper":80,"God Knows":85,"Celestial Saw":85,"The Detonator":95,"Lunar Eclipse":90,"Fire Lemonade":80,"Fire Tornado A":70,"Golden Gull":90,"Diamond Ray":100,"Wyvern Blizzard":80};
for(const[name,power]of Object.entries(expected)){const matches=Object.values(catalog.players).filter(m=>m.name===name);assert(matches.length,name+" missing");for(const m of matches)assert.strictEqual(Number(m.power),power,name+" Power");}
console.log("Ares move catalog: 156/156 active players, Curt Gale excluded, approved Powers OK");
