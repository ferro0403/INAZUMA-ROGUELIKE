"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
for(const file of["js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-encounter-runtime.js","js/road-to-glory/rtg-ai-policy.js","js/road-to-glory/rtg-penalty-runtime.js","js/road-to-glory/rtg-match-engine.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const E=c.RoadToGloryMatchEngine;
const p=(id,role)=>({playerId:id,name:id,normalizedRole:role,position:role,overall:80,attack:80,control:80,speed:80,grit:80,physical:80,stamina:80,defense:80,save:80,element:"Wind"});
function squad(prefix){return{lineup:[p(prefix+"g","GK"),p(prefix+"d1","DF"),p(prefix+"d2","DF"),p(prefix+"d3","DF"),p(prefix+"d4","DF"),p(prefix+"m1","MF"),p(prefix+"m2","MF"),p(prefix+"m3","MF"),p(prefix+"f1","FW"),p(prefix+"f2","FW"),p(prefix+"f3","FW")],bench:[]};}
const m=E.createMatch({matchId:"rotation",seed:"rotation-seed",userSquad:squad("u"),opponentSquad:squad("o")});
assert.deepStrictEqual(JSON.parse(JSON.stringify(m.participantHistoryBySide)),{user:[],opponent:[]});
assert.deepStrictEqual(JSON.parse(JSON.stringify(m.participantAppearances)),{user:{},opponent:{}});
let state=m;state.firstHalfTarget=999;state.actionTarget=999;state.manualIndexes=Array.from({length:30},(_,i)=>i);
const seen=[];
for(let i=0;i<8;i++){
 state.possession="user";state.fieldZone="midfield";state.pendingEncounter=null;
 state=E.prepareNext(state);assert(state.pendingEncounter);
 seen.push(state.pendingEncounter.actorPlayerId);
 state=E.resolvePendingEncounter(state,"base");
}
for(let i=1;i<seen.length;i++)assert.notStrictEqual(seen[i],seen[i-1],`same user participant repeated immediately: ${seen.join(",")}`);
assert(new Set(seen).size>=3,"midfield actions should circulate across available midfielders");
console.log("rtg-match-participant-rotation-test: PASS");
