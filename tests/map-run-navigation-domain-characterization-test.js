"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const players = ["GK","DF","DF","DF","DF","MF","MF","MF","FW","FW","FW"].map((position, index) => ({ playerId: `p${index}`, name: `P${index}`, position, category: "Normale", overall: 50, finalOverall: 50, stats: {} }));
const seasonDb = { seasonId: "ie1", players, formations: { eleven: [{ id: "4-3-3", requirements: { GK:1, DF:4, MF:3, FW:3 } }] }, bossOrder: [{ teamId:"boss", teamName:"Boss", bossFormation:"4-3-3", bossLevel:1, startingXIPlayerIds:players.map(p=>p.playerId) }] };
const zone = type => ({ bossIndex:0, bossId:"boss", seed:"fixed-zone", currentNodeId:"start", startNodeId:"start", pendingNodeId:null, completedNodeIds:[], path:["start"], nodes:[{id:"start",type:"start",layer:0},{id:"next",type,layer:1}], edges:[["start","next"]] });
const run = type => ({ runId:`map-${type}`, seasonId:"ie1", phase:"map", lives:3, bossIndex:0, completedBossIds:[], unlockedTeamIds:[], completedSpecialMatchIds:[], unlockedSpecialTeamIds:[], claimedSpecialMatchRewardIds:[], permanentEffectOutbox:[], roster:players.map(p=>({playerId:p.playerId,source:"ie1",level:0})), lineup:players.map(p=>p.playerId), bench:[], inventory:[], formationId:"4-3-3", teamIdentity:{name:"Raimon"}, statistics:{}, currentZone:zone(type), activeMatch:null });

{
  const rt = load(new BudgetStorage(Infinity), { run: run("item"), seasonDb });
  rt.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  rt.seam.renderMap({ persist:false });
  assert.match(rt.seam.getAppMarkup(), /data-node-id="next"/);
  rt.query('[data-node-id="next"]').click();
  assert.equal(rt.canonical.currentZone.pendingNodeId, "next");
  assert.equal(rt.canonical.pendingItemReward.candidateIds.length, 3);
  assert.match(rt.modalMarkup, /OGGETTO TROVATO/);
}

{
  const events=[]; const context={ console, globalThis:null }; context.globalThis=context; vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/map/node-router.js","utf8"),context);
  const router=context.MapNodeRouterRuntime.create({ enterMatch:(_n,t)=>events.push(t), openPull:(_n,t)=>events.push(t), openItem:()=>events.push("item"), openTrade:()=>events.push("trade") });
  ["five_v_five","special_match","boss","pull_free_agents","item","trade"].forEach(type=>router.dispatch({id:"n"},type));
  assert.deepEqual(events,["five_v_five","special_match","boss","pull_free_agents","item","trade"]);
}

for (const file of ["js/map/run-map-controller.js","js/map/run-map-view.js","js/map/node-router.js","js/map/trade-node-controller.js"]) {
  assert.doesNotMatch(fs.readFileSync(file,"utf8"), /firebase|firestore|CloudRestore|InazumaCloudSave/i, `${file} stays local-only`);
}
console.log("map/run navigation characterization: production render/click/item commit and router parity OK");
