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
assert.strictEqual(S.routeBackground,"assets/rtg/rtg-season2-route-map-user.webp?v=20260924-s2-map-hq-1");
const runView=fs.readFileSync("js/road-to-glory/rtg-run-view.js","utf8");
const routeCss=fs.readFileSync("css/road-to-glory.css","utf8");
const themeCss=fs.readFileSync("css/rtg-theme.css","utf8");
assert(runView.includes("const S2_BLOCKS"),"S2 route must use chapter blocks");
assert(runView.includes('start:0,  end:5')&&runView.includes('start:30, end:32'),"S2 blocks must cover the full 33-node route");
assert(runView.includes('data-rtg-map-block="season2-${block.index+1}"'),"S2 must render repeated route blocks");
assert(!runView.includes('style="--rtg-route-height:2500px"'),"S2 must not return to one giant 2500px stage");
assert(routeCss.includes("height:var(--rtg-route-height,640px)"),"S2 blocks must honor their individual heights");
assert(routeCss.includes("background-position:var(--rtg-route-bg-position,center)"),"S2 blocks must be able to frame repeated map art independently");
assert(themeCss.includes(".rtg-run-screen--s2 .rtg-map .rtg-map-block--season2-part .route-map.rtg-route-stage--season2"),"S2 theme must explicitly override the global S1 artwork selector");
assert(themeCss.includes('background-image:url("../assets/rtg/rtg-season2-route-map-user.webp?v=20260924-s2-map-hq-1")!important'),"S2 theme must force the Season 2 artwork directly over the S1 !important rule");
assert(themeCss.includes("background-position:var(--rtg-route-bg-position,center)!important"),"S2 theme must preserve per-chapter framing after the override");
const viewCtx={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};viewCtx.globalThis=viewCtx;vm.createContext(viewCtx);
vm.runInContext(runView,viewCtx);
const view=viewCtx.RoadToGloryRunView.create({escapeHtml:String,teamEmblemMarkup:teamId=>`<i data-fallback="${teamId}"></i>`});
const seasonDb={teams:order.map(teamId=>({teamId,teamName:teamId,logoUrl:`https://assets.test/${teamId}.png`}))};
const rendered=view.runMarkup({state:{activeSeasonId:"ie1_s2",currentNodeId:nodes[0].id,tokens:0,lives:2,attemptsByNode:{},defeatedTeamIds:[]},nodes,seasonDb,seasonConfig:S});
assert.strictEqual((rendered.match(/data-rtg-map-block="season2-/g)||[]).length,7);
assert.strictEqual((rendered.match(/data-rtg-node-id=/g)||[]).length,33);
assert.match(rendered,/assets\.test\/secret_service\.png/);
assert.match(rendered,/assets\.test\/raimon_inazuma_eleven_2\.png/);
assert.strictEqual(C.buildSeasonNodes("ie1").length,28);
console.log("rtg-season2-route-contract-test: PASS");
