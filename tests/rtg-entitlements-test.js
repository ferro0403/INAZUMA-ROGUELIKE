"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Set,Map};c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-entitlements.js","utf8"),c);
const players=[];let n=1;for(const role of["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW","DF","MF","FW","DF","MF"])players.push({playerId:String(n++),position:role,normalizedRole:role});
const freeAgentsDb={players};
const formations=[{id:"4-3-3",requirements:{GK:1,DF:4,MF:3,FW:3}}];
function album(ids){let writes=0;return{read:()=>({schemaVersion:2,sharedUnlockedPlayerIds:Object.fromEntries(ids.map(id=>[String(id),{firstSource:"test"}])),collections:{ie1:{unlockedPlayerIds:{}}}}),write:()=>{writes++;throw new Error("must not write");},writes:()=>writes};}
let a=album(players.slice(0,14).map(p=>p.playerId));let s=c.RoadToGloryEntitlements.accessStatus({albumProgress:a,freeAgentsDb,formations});assert.strictEqual(s.unlocked,false);assert.strictEqual(s.reason,"minimum-free-agents");assert.strictEqual(a.writes(),0);
const noGkIds=players.filter(p=>p.position!=="GK").slice(0,15).map(p=>p.playerId);a=album(noGkIds);s=c.RoadToGloryEntitlements.accessStatus({albumProgress:a,freeAgentsDb,formations});assert.strictEqual(s.unlocked,false);assert.strictEqual(s.reason,"no-valid-formation");
const validIds=players.slice(0,15).map(p=>p.playerId);a=album(validIds);s=c.RoadToGloryEntitlements.accessStatus({albumProgress:a,freeAgentsDb,formations});assert.strictEqual(s.unlocked,true);assert.strictEqual(s.count,15);assert.deepStrictEqual(Array.from(s.formationIds),["4-3-3"]);
const idsWithMissing=[...validIds,"missing-player"];const unlocked=c.RoadToGloryEntitlements.unlockedFreeAgentIds({albumProgress:album(idsWithMissing),freeAgentsDb});assert.strictEqual(unlocked.includes("missing-player"),false);assert.strictEqual(unlocked.length,15);
console.log("rtg-entitlements-test: PASS");
