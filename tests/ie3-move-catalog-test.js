"use strict";
const assert=require("assert"),fs=require("fs");
const catalog=JSON.parse(fs.readFileSync("data/IE1_S3_moves.json","utf8")),season=JSON.parse(fs.readFileSync("data/IE1_S3_season_compact.json","utf8"));
assert.strictEqual(catalog.schemaVersion,1);assert.strictEqual(catalog.seasonId,"ie1_s3");assert.strictEqual(Object.keys(catalog.players).length,296);
const campaignTeamIds=new Set([...season.bossOrder,...season.specialMatches].map(x=>String(x.teamId)));
assert.strictEqual(campaignTeamIds.size,19);
const expectedIds=[...new Set(season.profiles.filter(p=>campaignTeamIds.has(String(p.teamId))).map(p=>String(p.playerId)))].sort();
assert.strictEqual(expectedIds.length,296);assert.deepStrictEqual(Object.keys(catalog.players).sort(),expectedIds);
assert.deepStrictEqual(new Set(Object.values(catalog.players).map(move=>move.element)),new Set(["Fire","Wind","Mountain","Forest"]));
assert.deepStrictEqual([catalog.players["1828"].name,catalog.players["1828"].type,catalog.players["1828"].element,catalog.players["1828"].power],["Fire Blizzard","shot","Fire",110]);
assert.deepStrictEqual([catalog.players["1830"].name,catalog.players["1830"].type,catalog.players["1830"].element,catalog.players["1830"].power],["Fire Blizzard","shot","Wind",110]);
assert.deepStrictEqual([catalog.players["1981"].name,catalog.players["1981"].type,catalog.players["1981"].element,catalog.players["1981"].power],["Super Elastico","dribble","Mountain",100]);
assert.deepStrictEqual([catalog.players["1864"].name,catalog.players["1864"].type,catalog.players["1864"].element,catalog.players["1864"].power],["Emperor Penguin X","shot","Fire",100]);
assert.strictEqual(new Set(Object.values(catalog.players).map(move=>move.name)).size,150);
console.log("IE3 move catalog: 296 campaign players, 19 teams and manual substitutions OK");

const roleOwners=Object.entries(catalog.players).filter(([,move])=>move.roleMoves).map(([id])=>id).sort();
assert.deepStrictEqual(roleOwners,["1","1166","1957","30"].sort());
const roleExpected={
  "1":{MF:["Megaton Head","shot","Mountain",70],GK:["God Catch","save","Mountain",130]},
  "1166":{FW:["Cross Fire","shot","Fire",120],DF:["Land of Ice","defense","Wind",75]},
  "30":{FW:["Emperor Penguin No. 2","shot","Forest",85],DF:["Killer Slide","defense","Forest",50]},
  "1957":{GK:["Soul Hand","save","Fire",140],FW:["X Blast","shot","Fire",110]}
};
for(const[id,roles]of Object.entries(roleExpected))for(const[role,row]of Object.entries(roles)){const m=catalog.players[id].roleMoves[role];assert.deepStrictEqual([m.name,m.type,m.element,m.power],row,id+" "+role);}
