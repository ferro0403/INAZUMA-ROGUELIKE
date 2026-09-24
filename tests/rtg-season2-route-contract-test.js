"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-config.js","utf8"),c);
const C=c.RoadToGloryConfig,S=C.SEASON2,nodes=C.buildSeasonNodes("ie1_s2");
const order=["secret_service","gemini_storm","alpine_ie2","epsilon","royal_academy_redux","cloister_divinity","epsilon_plus","super_triple_c","diamond_dust","fauxshore","prominence","chaos","genesis","mary_times","dark_emperors","zeus","raimon_inazuma_eleven_2"];
assert.strictEqual(S.seasonId,"ie1_s2");
assert.deepStrictEqual(Array.from(S.mainTeams),order);
assert.strictEqual(nodes.length,33);
assert.deepStrictEqual(nodes.filter(n=>n.type==="main").map(n=>n.teamId),order);
assert.strictEqual(nodes.filter(n=>n.type==="secondary").length,16);
for(let i=0;i<nodes.length;i++)assert.strictEqual(nodes[i].type,i%2===0?"main":"secondary");
const expected={
 secret_service:[74,0,0,0],gemini_storm:[76,1,0,0],alpine_ie2:[78,1,0,0],epsilon:[78,2,1,3],
 royal_academy_redux:[80,2,1,3],cloister_divinity:[79,3,1,3],epsilon_plus:[81,3,1,3],super_triple_c:[79,4,2,4],
 diamond_dust:[82,4,2,4],fauxshore:[81,5,2,4],prominence:[82,5,2,4],chaos:[85,6,2,4],genesis:[86,6,3,5],
 mary_times:[82,7,3,5],dark_emperors:[87,7,3,5],zeus:[84,8,3,5],raimon_inazuma_eleven_2:[89,8,4,6]
};
for(const [teamId,v] of Object.entries(expected)){const x=S.constraints[teamId];assert.deepStrictEqual([x.cap,x.minRecruit,x.recentCount,x.recentWindow],v,teamId);}
assert.deepStrictEqual(Array.from(S.checkpointMainIndexes),[2,5,8,11,14]);
assert.strictEqual(S.routeBackground,"assets/rtg/rtg-season2-route-map.webp");
assert.strictEqual(C.buildSeasonNodes("ie1").length,28);
console.log("rtg-season2-route-contract-test: PASS");
