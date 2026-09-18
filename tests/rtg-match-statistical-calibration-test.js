"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const db=JSON.parse(fs.readFileSync("data/IE1_season_compact.json","utf8"));
const moves=JSON.parse(fs.readFileSync("data/IE1_moves.json","utf8")).players;
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map};c.globalThis=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-encounter-runtime.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const R=c.RoadToGloryEncounterRuntime;
const flat=(overall)=>({overall,attack:overall,control:overall,speed:overall,grit:overall,physical:overall,stamina:overall,defense:overall,save:overall,element:"Wind"});
const strongMove={power:110,element:"Wind"},weakMove={power:50,element:"Wind"};
assert(R.probability({actor:flat(72),opponent:flat(78),actorKind:"shot",opponentKind:"save",actorMove:strongMove}).probability>50);
assert(R.probability({actor:flat(90),opponent:flat(72),actorKind:"shot",opponentKind:"save",opponentMove:strongMove}).probability>50);
const stronger=R.probability({actor:flat(80),opponent:flat(80),actorKind:"dribble",opponentKind:"defense",actorMove:strongMove,opponentMove:weakMove}).probability;
const weaker=R.probability({actor:flat(80),opponent:flat(80),actorKind:"dribble",opponentKind:"defense",actorMove:weakMove,opponentMove:strongMove}).probability;
assert(stronger>weaker);
let checked=0;
for(const player of db.players||[]){
 const move=moves[String(player.playerId)];if(!move)continue;
 const actor={...player,...player.finalStats,overall:player.finalOverall};
 const kind=move.type;const opponentKind=kind==="shot"?"save":kind==="dribble"?"defense":kind==="defense"?"dribble":kind==="save"?"shot":null;
 if(!opponentKind)continue;
 const opponent=flat(80);
 const result=R.probability({actor,opponent,actorKind:kind,opponentKind,actorMove:move});
 assert(result.probability>=10&&result.probability<=90);checked++;
}
assert(checked>100);
for(const target of[0.25,0.5,0.75]){
 let wins=0;for(let i=0;i<20000;i++)if(c.RoadToGloryRng.float("calibration",`p:${target}`,i)<target)wins++;
 const observed=wins/20000;assert(Math.abs(observed-target)<=0.015,`${target} -> ${observed}`);
}
console.log("rtg-match-statistical-calibration-test: PASS");
