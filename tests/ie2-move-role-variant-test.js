"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const catalog=JSON.parse(fs.readFileSync("data/IE1_S2_moves.json","utf8"));
const c={console};c.globalThis=c;c.SeasonRegistry={database:s=>s==="ie1_s2"?{moveCatalog:catalog}:null};
vm.runInNewContext(fs.readFileSync("js/moves/move-runtime.js","utf8"),c);
const move=(id,position)=>c.MatchMoveRuntime.moveForPlayer("ie1_s2",{playerId:id,position});
assert.deepStrictEqual(JSON.parse(JSON.stringify(move("1","MF"))),{playerId:"1",name:"The Earth",type:"shot",element:"Mountain",power:95});
assert.strictEqual(move("1","GK").name,"Majin the Hand");
assert.strictEqual(move("1162","DF").name,"Land of Ice");assert.strictEqual(move("1162","FW").name,"Eternal Blizzard");
assert.strictEqual(move("1070","GK").name,"Drill Smasher");assert.strictEqual(move("1070","FW").name,"Gungnir");
assert.strictEqual(move("1080","FW").name,"Ganymede Ray");assert.strictEqual(move("1080","GK").name,"Wormhole");
assert.strictEqual(c.MatchMoveRuntime.moveForPlayer("ie1_s2","1070").name,"Drill Smasher","ID-only callers retain the catalog fallback");
const contribution=c.MatchMoveRuntime.teamContribution("ie1_s2",[{playerId:"1162",position:"DF"}]);assert.strictEqual(contribution.score,65);assert.strictEqual(contribution.bonus,3.25);

function makePlayer(playerId,position){return{playerId,name:playerId,position,overall:75,attack:75,control:75,speed:75,grit:75,physical:75,stamina:75,defense:75,save:position==="GK"?75:0};}
function addSynthetic(id,position){catalog.players[id]={name:position+" Move",type:position==="GK"?"save":position==="DF"?"defense":position==="MF"?"dribble":"shot",element:"Mountain",power:60};return makePlayer(id,position);}
const user={name:"User",formationId:"4-3-3",players:[makePlayer("1080","GK"),addSynthetic("u-df1","DF"),addSynthetic("u-df2","DF"),addSynthetic("u-df3","DF"),addSynthetic("u-df4","DF"),addSynthetic("u-mf1","MF"),addSynthetic("u-mf2","MF"),addSynthetic("u-mf3","MF"),makePlayer("1070","FW"),addSynthetic("u-fw2","FW"),addSynthetic("u-fw3","FW")]};
const opponent={name:"Opponent",formationId:"4-3-3",players:[addSynthetic("o-gk","GK"),addSynthetic("o-df1","DF"),addSynthetic("o-df2","DF"),addSynthetic("o-df3","DF"),addSynthetic("o-df4","DF"),addSynthetic("o-mf1","MF"),addSynthetic("o-mf2","MF"),addSynthetic("o-mf3","MF"),addSynthetic("o-fw1","FW"),addSynthetic("o-fw2","FW"),addSynthetic("o-fw3","FW")]};
for(const f of["js/match-simulator-config.js","js/match-simulator.js"])vm.runInNewContext(fs.readFileSync(f,"utf8"),c);
let sawGungnir=false,sawWormhole=false;
for(let seed=0;seed<240&&(!sawGungnir||!sawWormhole);seed++){
  const sim=c.MatchSimulator.simulate({type:"eleven",seed:"ie2-role-"+seed,userTeam:user,opponentTeam:opponent,rulesVersion:2,seasonId:"ie1_s2"});assert(sim.valid);
  for(const event of sim.timeline.filter(e=>e.team==="user"&&e.moveName)){
    if(String(event.playerId)==="1070"){assert.strictEqual(event.moveName,"Gungnir","Dvalin FW must never expose Drill Smasher");sawGungnir=true;}
    if(String(event.playerId)==="1080"){assert.strictEqual(event.moveName,"Wormhole","Zell GK must never expose Ganymede Ray");sawWormhole=true;}
  }
}
assert(sawGungnir,"timeline must resolve Dvalin FW Gungnir");assert(sawWormhole,"timeline must resolve Zell GK Wormhole");
console.log("IE2 role moves: runtime, team bonus and match timeline follow the active role");
