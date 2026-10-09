"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const catalog=JSON.parse(fs.readFileSync("data/ORION_moves.json","utf8"));
const season=JSON.parse(fs.readFileSync("data/ORION_season_compact.json","utf8"));
const ares=JSON.parse(fs.readFileSync("data/IE2_moves.json","utf8"));
const context={console};context.globalThis=context;
context.SeasonRegistry={database:id=>id==="orion"?{moveCatalog:catalog}:null};
vm.runInNewContext(fs.readFileSync("js/moves/move-runtime.js","utf8"),context);
const get=(id,position)=>JSON.parse(JSON.stringify(context.MatchMoveRuntime.moveForPlayer("orion",{playerId:id,position})));
const cases=[
 {id:"4725",roles:{MF:["Avenging Eagle","shot","Mountain",90],DF:["About Face","defense","Mountain",80]},profiles:2,idFallback:"Avenging Eagle"},
 {id:"4538",roles:{FW:["Triple Blizzard","shot","Wind",105],DF:["Land of Ice","defense","Wind",85]},profiles:1,idFallback:"Triple Blizzard"},
 {id:"4555",roles:{FW:["Meteor Blade","shot","Fire",85],DF:["Photon Crash","defense","Fire",80]},profiles:1,idFallback:"Photon Crash"}
];
for(const entry of cases){
 const profiles=season.profiles.filter(p=>String(p.playerId)===entry.id);
 assert.strictEqual(profiles.length,entry.profiles,entry.id+" profile count");
 const raw=catalog.players[entry.id];
 assert.deepStrictEqual(Object.keys(raw.roleMoves).sort(),Object.keys(entry.roles).sort(),entry.id+" roles");
 for(const profile of profiles){
  assert.strictEqual(profile.roleSwitchEnabled,true,profile.profileId+" switch");
  assert.deepStrictEqual(profile.roleVariants.map(x=>x.position).sort(),Object.keys(entry.roles).sort(),profile.profileId+" variants");
  for(const [role,expected] of Object.entries(entry.roles)){
   const move=get(entry.id,role);
   assert.deepStrictEqual([move.name,move.type,move.element,move.power],expected,entry.id+" "+role);
   assert.strictEqual(raw.roleMoves[role].name,move.name,entry.id+" catalog matches runtime");
  }
 }
 assert.strictEqual(context.MatchMoveRuntime.moveForPlayer("orion",entry.id).name,entry.idFallback,entry.id+" id-only remains backward compatible");
}
assert.strictEqual(catalog.players["4725"].roleMoves.DF.tension,50);
assert.strictEqual(catalog.players["4538"].roleMoves.DF.tension,60);
assert.strictEqual(catalog.players["4555"].roleMoves.FW.tension,70);
assert.strictEqual(catalog.players["4531"].power,85);
assert.strictEqual(catalog.players["4534"].power,80);
assert.strictEqual(ares.players["4531"].power,85);
assert.strictEqual(ares.players["4534"].power,80);
console.log("Orion role-moves: all 3 players and 4 profiles, role Power, runtime and legacy fallback PASS");
