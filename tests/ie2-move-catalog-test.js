"use strict";
const assert=require("assert"),fs=require("fs");
const catalog=JSON.parse(fs.readFileSync("data/IE1_S2_moves.json","utf8")),season=JSON.parse(fs.readFileSync("data/IE1_S2_season_compact.json","utf8"));
assert.strictEqual(catalog.schemaVersion,1);assert.strictEqual(catalog.seasonId,"ie1_s2");assert.strictEqual(Object.keys(catalog.players).length,203);
assert.deepStrictEqual(Object.keys(catalog.players).sort(),season.players.map(p=>String(p.playerId)).sort());
assert.deepStrictEqual(new Set(Object.values(catalog.players).map(move=>move.element)),new Set(["Fire","Wind","Mountain","Forest"]));
const powers={"Astro Break":70,"Beast Fang":75,"Frozen Steal":70,"Water Veil":65,"Northern Impact":85,"Ignited Steal":70,"Atomic Flare":85,"Meteor Blade":85,"Supernova":90,"Wyvern Crash":75,"Majin the Hand":75,"Legendary Wolf":85,"Fireball Storm":85,"Death Zone 2":75,"Triple Defence":70,"Super Sumo Stomp":65,"Black Hole":65,"Ganymede Ray":65,"Emperor Penguin No. 1":80,"Eternal Blizzard":75,"God Break":90,"Land of Ice":65};
for(const[name,power]of Object.entries(powers)){const matches=Object.values(catalog.players).filter(move=>move.name===name);assert(matches.length,name+" missing");for(const move of matches)assert.strictEqual(move.power,power,name+" global Power");}
const roleOwners=Object.entries(catalog.players).filter(([,move])=>move.roleMoves).map(([id])=>id).sort();assert.deepStrictEqual(roleOwners,["1","1070","1080","1162"]);
const expected={
  "1":{MF:["The Earth","shot","Mountain",120],GK:["Majin the Hand","save","Mountain",75]},
  "1162":{DF:["Land of Ice","defense","Wind",65],FW:["Eternal Blizzard","shot","Wind",75]},
  "1070":{GK:["Drill Smasher","save","Fire",85],FW:["Gungnir","shot","Wind",85]},
  "1080":{FW:["Ganymede Ray","shot","Forest",65],GK:["Wormhole","save","Forest",70]}
};
for(const[id,roles]of Object.entries(expected))for(const[role,row]of Object.entries(roles)){const m=catalog.players[id].roleMoves[role];assert.deepStrictEqual([m.name,m.type,m.element,m.power],row,id+" "+role);}
assert.deepStrictEqual([catalog.players["1"].name,catalog.players["1"].power],["Majin the Hand",75]);
assert.deepStrictEqual([catalog.players["1162"].name,catalog.players["1162"].power],["Eternal Blizzard",75]);
assert.deepStrictEqual([catalog.players["1070"].name,catalog.players["1070"].power],["Drill Smasher",85]);
assert.deepStrictEqual([catalog.players["1080"].name,catalog.players["1080"].power],["Ganymede Ray",65]);
assert.deepStrictEqual([catalog.players["1166"].name,catalog.players["1166"].power],["Legendary Wolf",100]);
console.log("IE2 move catalog: 203 canonical players, approved Power overrides and 4 role variants OK");
