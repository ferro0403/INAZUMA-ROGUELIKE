"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={console};c.globalThis=c;c.moveCatalog={seasonId:"ie1",players:{}};c.SeasonRegistry={database:s=>s==="ie1"?{moveCatalog:c.moveCatalog}:null};
for(const f of["js/moves/move-runtime.js","js/match-simulator-config.js","js/match-simulator.js"])vm.runInNewContext(fs.readFileSync(f,"utf8"),c);
const roles=["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"];
function team(prefix,power=60){const players=roles.map((position,i)=>{const id=`${prefix}-${i}`;c.moveCatalog.players[id]={name:`${position} Move`,type:position==="GK"?"save":position==="DF"?"defense":position==="MF"?"dribble":"shot",power};return{playerId:id,name:id,position,overall:70,attack:70,control:70,speed:70,grit:70,physical:70,stamina:70,defense:70,save:position==="GK"?70:0};});return{name:prefix,formationId:"4-3-3",players};}
const user=team("u");
assert.strictEqual(c.MatchSimulator.teamStrength(user,"eleven",{rulesVersion:1,seasonId:"ie1"}).moveBonus,0);
const modern=c.MatchSimulator.teamStrength(user,"eleven",{rulesVersion:2,seasonId:"ie1"});assert.strictEqual(modern.moveScore,60);assert.strictEqual(modern.moveBonus,3);assert(Math.abs(modern.finalRaw-modern.baseFinalRaw-3)<1e-9);
for(const id of Object.keys(c.moveCatalog.players))c.moveCatalog.players[id].power=100;
assert.strictEqual(c.MatchSimulator.teamStrength(user,"eleven",{rulesVersion:2,seasonId:"ie1"}).moveBonus,4);
assert.strictEqual(c.MatchSimulator.getMatchWinProbabilities("eleven",73,70,1).userChance,70);
assert(Math.abs(c.MatchSimulator.getMatchWinProbabilities("eleven",73,70,2).userChance-76)<1e-9);
assert(Math.abs(c.MatchSimulator.getMatchWinProbabilities("five",73,70,2).userChance-83)<1e-9);
assert(Math.abs(c.MatchSimulator.getMatchWinProbabilities("five",67,70,2).userChance-77)<1e-9);
assert.strictEqual(c.MatchSimulator.getMatchWinProbabilities("five",40,70,2).userChance,60);
assert.strictEqual(c.MatchSimulator.getMatchWinProbabilities("five",100,70,2).userChance,95);
assert.strictEqual(c.MatchSimulator.applyConsecutiveLossProtection(70,1),92.5);assert.strictEqual(c.MatchSimulator.applyConsecutiveLossProtection(70,2),100);
console.log("match moves V2 domain: bonus, cap, smooth curves and loss protection OK");
