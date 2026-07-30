const assert = require("assert");
const memory = new Map();
global.localStorage = { getItem: (k) => memory.get(k) || null, setItem: (k,v) => memory.set(k,v), removeItem: (k) => memory.delete(k) };
global.InazumaProgression = require("../js/roguelike_progression.js");
const dev = require("../js/development-v2.js");
function end(id, bosses, reason) { return dev.processRunEnd({ runId:id, defeatedBosses:bosses, endReason:reason }, () => .99); }
dev.reset(); end("four",4,"gameover"); assert.equal(dev.read().coins,0);
dev.reset(); end("five",5,"gameover"); assert.equal(dev.read().coins,50);
dev.reset(); end("win10",10,"victory"); assert.equal(dev.read().coins,150); assert.equal(dev.read().cups,1); end("win10",10,"victory"); assert.equal(dev.read().coins,150);
assert.equal(dev.generateChoices(4,false),null);
for(let i=0;i<200;i++){ assert(!dev.generateChoices(6,false).includes("Elite")); assert(!dev.generateChoices(10,false).includes("Leggenda")); }
assert.deepEqual(dev.generateChoices(6, false, () => .1), ["Buono", "Buono", "Buono"]);
dev.reset(); const pending=end("pending",7,"gameover").pull; assert.deepEqual(dev.read().projectPullLedger.pending.choices,pending.choices); assert(dev.claimPull("pending",pending.choices[0])); assert(!dev.claimPull("pending",pending.choices[1]));
for (const [rarity, amount, warehouse, build] of [["Elite",1,0,1],["Mondiale",3,1,0],["Leggenda",4,1,0],["Leggenda",9,2,1]]) { dev.reset(); dev.addProjectModules(rarity,amount); assert.equal(dev.read().projects[rarity],warehouse); assert.equal(dev.read().projectBuild[rarity],build); }
dev.reset(); dev.addProjectModules("Elite",1); assert.equal(dev.read().projects.Elite,0); dev.addProjectModules("Elite",1); assert.equal(dev.read().projects.Elite,1); assert.equal(dev.read().projectBuild.Elite,0);
for (const [rarity,copies,warehouse,build] of [["Elite",5,2,1],["Mondiale",7,2,1],["Leggenda",9,2,1]]) { memory.set(dev.STORAGE_KEY,JSON.stringify({schemaVersion:2,projects:{[rarity]:copies}})); const migrated=dev.read(); assert.equal(migrated.projects[rarity],warehouse); assert.equal(migrated.projectBuild[rarity],build); dev.write(migrated); assert.deepEqual(dev.read(),migrated); }
for (const [from,target,coins,cups] of [[65,"Normale",100,0],[70,"Buono",200,1],[75,"Forte",400,2],[80,"Elite",800,3],[85,"Mondiale",1000,5],[90,"Leggenda",1500,8]]) { dev.reset(); const s=dev.read(); s.coins=coins;s.cups=cups;if(target!=="Normale")s.projects[target]=1;dev.write(s);const r=dev.evolve({playerId:"p",playerName:"P",basePotential:from,unlocked:true,freeAgentEligible:true});assert(r.ok);if(target!=="Normale")assert.equal(dev.read().projects[target],0); }
dev.reset(); let s=dev.read();s.coins=9999;s.cups=99;dev.write(s);const before=JSON.stringify(dev.read());assert(!dev.evolve({playerId:"p",basePotential:85,unlocked:true,freeAgentEligible:true}).ok);assert.equal(JSON.stringify(dev.read()),before);
assert.equal(dev.DEVELOPMENT_RESOURCE_ASSETS.coins,"https://dxi4wb638ujep.cloudfront.net/1/k/r/e/rez8i1ppo0p8.webp"); assert.equal(dev.DEVELOPMENT_RESOURCE_ASSETS.cups,"https://dxi4wb638ujep.cloudfront.net/1/k/r/t/ttzf1b8nbe.webp");
const urls=Object.values(dev.ASSETS); assert.equal(new Set(urls).size,5); urls.forEach(url=>{assert(url.startsWith("https://dxi4wb638ujep.cloudfront.net/")); assert(!/static\.wikia|assets\/development|encrypted-tbn|googleusercontent/.test(url));});
assert.equal(dev.SCHEMA_VERSION,3); assert(dev.read().projectBuild);
console.log("development-v2-test: V3 migration, modular builds, warehouse costs and pull idempotency OK");
