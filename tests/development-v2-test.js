const assert = require("assert");
const memory = new Map();
global.localStorage = { getItem: (k) => memory.get(k) || null, setItem: (k,v) => memory.set(k,v), removeItem: (k) => memory.delete(k) };
global.InazumaProgression = require("../js/roguelike_progression.js");
const dev = require("../js/development-v2.js");

function end(id, bosses, reason) { return dev.processRunEnd({ runId:id, defeatedBosses:bosses, endReason:reason }, () => .99); }
dev.reset(); end("four",4,"gameover"); assert.equal(dev.read().coins,0);
dev.reset(); end("five",5,"gameover"); assert.equal(dev.read().coins,50);
dev.reset(); end("eight",8,"gameover"); assert.equal(dev.read().coins,80);
dev.reset(); end("win10",10,"victory"); assert.equal(dev.read().coins,150); assert.equal(dev.read().cups,1); end("win10",10,"victory"); assert.equal(dev.read().coins,150); assert.equal(dev.read().cups,1);
dev.reset(); end("win11",11,"victory"); assert.equal(dev.read().coins,160);
assert.equal(dev.generateChoices(4,false),null);
for(let i=0;i<200;i++){ assert(!dev.generateChoices(6,false).includes("Elite")); assert(!dev.generateChoices(10,false).includes("Leggenda")); }
assert.deepEqual(dev.generateChoices(6, false, () => .1), ["Buono", "Buono", "Buono"], "duplicate slot results must remain possible");
assert.equal(dev.generateChoiceSlots(8, false, () => .19).rare, "Forte");
assert.equal(dev.generateChoiceSlots(8, false, () => .21).rare, "Elite");
assert.equal(dev.generateChoiceSlots(9, false, () => .49).rare, "Elite");
assert.equal(dev.generateChoiceSlots(9, false, () => .51).rare, "Mondiale");
assert.equal(dev.generateChoiceSlots(10, true, () => .24).rare, "Elite");
assert.equal(dev.generateChoiceSlots(10, true, () => .26).rare, "Mondiale");
assert.equal(dev.generateChoiceSlots(10, true, () => .76).rare, "Leggenda");
dev.reset(); const pending=end("pending",7,"gameover",()=>.2).pull; assert.deepEqual(dev.read().projectPullLedger.pending.choices,pending.choices); assert(dev.claimPull("pending",pending.choices[0])); assert(!dev.claimPull("pending",pending.choices[1]));
for (const [from,target,coins,cups,projects] of [[65,"Normale",100,0,0],[70,"Buono",200,1,1],[75,"Forte",400,2,1],[80,"Elite",800,3,2],[85,"Mondiale",1000,5,3],[90,"Leggenda",1500,8,4]]) { dev.reset(); const s=dev.read();s.coins=coins;s.cups=cups;if(projects)s.projects[target]=projects;dev.write(s);const r=dev.evolve({playerId:"p",playerName:"P",basePotential:from,unlocked:true,freeAgentEligible:true});assert(r.ok);assert.equal(r.target,target); }
dev.reset(); let s=dev.read();s.coins=9999;s.cups=99;s.projects.Mondiale=2;dev.write(s);const before=JSON.stringify(dev.read());assert(!dev.evolve({playerId:"p",basePotential:85,unlocked:true,freeAgentEligible:true}).ok);assert.equal(JSON.stringify(dev.read()),before);assert.equal(dev.evolve({playerId:"locked",basePotential:70,unlocked:false,freeAgentEligible:true}).reason,"locked");
const securityBefore=JSON.stringify(dev.read()); assert.equal(dev.evolve({playerId:"club",basePotential:70,unlocked:true,freeAgentEligible:false}).reason,"not_free_agent"); assert.equal(JSON.stringify(dev.read()),securityBefore);
dev.reset(); s=dev.read(); s.coins=200; s.cups=1; s.projects.Buono=1; dev.write(s); assert(dev.evolve({playerId:"visible",basePotential:70,unlocked:true,freeAgentEligible:true}).ok); const source={playerId:"visible",finalOverall:70,maxLevel:20,position:"FW",ratings:{attack:7,control:5,speed:6,grit:5,physical:5,stamina:5,defense:3,save:1}}; const resolved=dev.resolvePlayer(source,20,{compactFormat:{levelMax:20}}); assert.equal(resolved.category,"Buono"); assert.equal(resolved.overall,75); assert.equal(dev.resolvePlayer(source,20,{compactFormat:{levelMax:20}}).category,"Buono","reload keeps permanent rarity");
console.log("development-v2: economy, pull persistence/idempotency and evolution costs OK");

const urls = Object.values(dev.ASSETS);
assert.equal(urls.length, 5); assert.equal(new Set(urls).size, 5);
urls.forEach((url) => { assert(/^https:\/\//.test(url)); assert(!url.includes("encrypted-tbn")); assert(!url.includes("assets/development")); });
for (const [rarity, owned, required, complete, remainder] of [["Buono",4,1,4,0],["Forte",2,1,2,0],["Elite",5,2,2,1],["Mondiale",7,3,2,1],["Leggenda",9,4,2,1]]) { const state=dev.read(); state.projects[rarity]=owned; const status=dev.projectBuildStatus(rarity,state); assert.equal(status.required,required); assert.equal(status.complete,complete); assert.equal(status.remainder,remainder); }
dev.reset(); s=dev.read(); s.coins=9999; s.cups=99; s.projects.Elite=5; dev.write(s); assert(dev.evolve({playerId:"consume",playerName:"Consume",basePotential:80,unlocked:true,freeAgentEligible:true}).ok); assert.equal(dev.read().projects.Elite,3); assert.deepEqual(dev.projectBuildStatus("Elite"), {rarity:"Elite",required:2,owned:3,complete:1,remainder:1,filled:1,ready:true});
assert(!JSON.stringify(dev.read()).includes("projectFragments")); assert(!JSON.stringify(dev.read()).includes("projectBuild"));
console.log("development-v2: external assets and derived modular build OK");
