"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const context={globalThis:null,Object,Array,Set,Map,JSON,Math};context.globalThis=context;vm.createContext(context);
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-config.js","utf8"),context);
const {SEASON1,SEASON2,buildSeasonNodes}=context.RoadToGloryConfig;
assert.strictEqual(buildSeasonNodes("ie1").length,28,"Season 1 route must remain untouched");
assert.strictEqual(SEASON1.constraints.raimon.cap,87);
const expected=[
["secret_service",74,0,0,0],["gemini_storm",76,1,0,0],["alpine_ie2",78,1,0,0],
["epsilon",78,2,1,3],["royal_academy_redux",80,2,1,3],["cloister_divinity",79,3,1,3],
["epsilon_plus",81,3,1,3],["super_triple_c",79,4,2,4],["diamond_dust",82,4,2,4],
["fauxshore",81,5,2,4],["prominence",82,5,2,4],["chaos",85,6,2,4],
["genesis",86,6,3,5],["mary_times",82,7,3,5],["dark_emperors",87,7,3,5],
["zeus",84,8,3,5],["raimon_inazuma_eleven_2",89,8,4,6]];
assert.deepStrictEqual(JSON.parse(JSON.stringify(SEASON2.mainTeams)),expected.map(x=>x[0]));
for(const [team,cap,minRecruit,recentCount,recentWindow] of expected){
 assert.deepStrictEqual(JSON.parse(JSON.stringify(SEASON2.constraints[team])),{cap,minRecruit,recentCount,recentWindow});
}
const nodes=Array.from(buildSeasonNodes("ie1_s2"));
assert.strictEqual(nodes.length,33);
assert.strictEqual(nodes.filter(n=>n.type==="main").length,17);
assert.strictEqual(nodes.filter(n=>n.type==="secondary").length,16);
assert.strictEqual(nodes[0].id,"main:secret_service");
assert.strictEqual(nodes[1].type,"secondary");
assert.strictEqual(nodes[2].id,"main:gemini_storm");
assert.strictEqual(nodes[4].id,"main:alpine_ie2");
assert.strictEqual(nodes.at(-1).id,"main:raimon_inazuma_eleven_2");
assert.strictEqual(SEASON2.routeBackground,"assets/rtg/rtg-season2-route-map.webp");
console.log("rtg-season2-config-test: PASS");