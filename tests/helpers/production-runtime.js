"use strict";
const fs=require("fs"),vm=require("vm");
function load(storage, files=["persistence-recovery-guard.js","run-state.js","album-progress.js","development-v2.js","hall-of-fame.js"]) {
 const c={console,localStorage:storage,Date,Math,JSON,structuredClone,TextEncoder,crypto:global.crypto,CustomEvent:class{constructor(type,o){this.type=type;this.detail=o?.detail}},dispatchEvent(){},addEventListener(){},SEASON1_CONFIG:{saveKey:"run",saveVersion:2,startingLives:2,maxRunLives:2,legacySaveKeys:[]},SeasonRegistry:{normalizeSeasonId:id=>["ie1","ie2","ie1_s2","ie1_s3","orion"].includes(id)?id:"ie1",activeId:()=>"ie1",list:()=>["ie1","ie2","ie1_s2","ie1_s3","orion"].map(id=>({id})),database:()=>({})}};c.globalThis=c;c.DevelopmentV2={read:()=>({players:{}})};
 for(const f of files)vm.runInNewContext(fs.readFileSync(`js/${f}`,"utf8"),c,{filename:f});return c;
}
module.exports={load};
