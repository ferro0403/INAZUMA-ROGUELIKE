const assert = require("assert");
const memory = new Map();
global.localStorage = { getItem: (k) => memory.get(k) || null, setItem: (k,v) => memory.set(k,v), removeItem: (k) => memory.delete(k) };
global.InazumaProgression = require("../js/roguelike_progression.js");
const dev = require("../js/development-v2.js");
function end(id, bosses, reason) { return dev.processRunEnd({ runId:id, defeatedBosses:bosses, endReason:reason }, () => .99); }
dev.reset(); end("four",4,"gameover"); assert.equal(dev.read().coins,0);
dev.reset(); end("five",5,"gameover"); assert.equal(dev.read().coins,50);
dev.reset(); end("eight",8,"gameover"); assert.equal(dev.read().coins,80);
dev.reset(); end("win10",10,"victory"); assert.equal(dev.read().coins,150); assert.equal(dev.read().cups,1); end("win10",10,"victory"); assert.equal(dev.read().coins,150);
dev.reset(); end("win11",11,"victory"); assert.equal(dev.read().coins,160); assert.equal(dev.read().cups,1);
assert.equal(dev.generateChoices(4,false),null);
for(let i=0;i<200;i++){ assert(!dev.generateChoices(6,false).includes("Elite")); assert(!dev.generateChoices(10,false).includes("Leggenda")); }
assert.deepEqual(dev.generateChoices(6, false, () => .1), ["Buono", "Buono", "Buono"]);
dev.reset(); const pending=end("pending",7,"gameover").pull; assert.deepEqual(dev.read().projectPullLedger.pending.choices,pending.choices); assert(dev.claimPull("pending",pending.choices[0])); assert(!dev.claimPull("pending",pending.choices[1]));
assert.deepEqual(dev.BUILD_REQUIREMENTS, { Buono:1, Forte:1, Elite:4, Mondiale:4, Leggenda:4 });
for (const rarity of ["Elite","Mondiale","Leggenda"]) { dev.reset(); for(let modules=1;modules<4;modules++){ const result=dev.addProjectModules(rarity,1); assert.equal(result.required,4); assert.equal(dev.read().projects[rarity],0); assert.equal(dev.read().projectBuild[rarity],modules); } dev.addProjectModules(rarity,1); assert.equal(dev.read().projects[rarity],1); assert.equal(dev.read().projectBuild[rarity],0); }
for (const rarity of ["Buono","Forte"]) { dev.reset(); dev.addProjectModules(rarity,1); assert.equal(dev.read().projects[rarity],1); assert.equal(dev.read().projectBuild[rarity],0); }
for (const [rarity, amount, warehouse, build] of [["Elite",9,2,1],["Mondiale",10,2,2],["Leggenda",9,2,1]]) { dev.reset(); dev.addProjectModules(rarity,amount); assert.equal(dev.read().projects[rarity],warehouse); assert.equal(dev.read().projectBuild[rarity],build); }
for (const [rarity,copies,warehouse,build] of [["Elite",5,2,1],["Mondiale",7,2,1],["Leggenda",9,2,1]]) { memory.set(dev.STORAGE_KEY,JSON.stringify({schemaVersion:2,projects:{[rarity]:copies}})); const migrated=dev.read(); assert.equal(migrated.projects[rarity],warehouse); assert.equal(migrated.projectBuild[rarity],build); dev.write(migrated); assert.deepEqual(dev.read(),migrated); }
for (const [from,target,coins,cups] of [[65,"Normale",100,0],[70,"Buono",200,1],[75,"Forte",400,2],[80,"Elite",800,3],[85,"Mondiale",1000,5],[90,"Leggenda",1500,8]]) { dev.reset(); const s=dev.read(); s.coins=coins;s.cups=cups;if(target!=="Normale")s.projects[target]=1;dev.write(s);const r=dev.evolve({playerId:"p",playerName:"P",basePotential:from,unlocked:true,freeAgentEligible:true});assert(r.ok);if(target!=="Normale")assert.equal(dev.read().projects[target],0); }
dev.reset(); let s=dev.read();s.coins=9999;s.cups=99;dev.write(s);const before=JSON.stringify(dev.read());assert(!dev.evolve({playerId:"p",basePotential:85,unlocked:true,freeAgentEligible:true}).ok);assert.equal(JSON.stringify(dev.read()),before);
assert.equal(dev.DEVELOPMENT_RESOURCE_ASSETS.coins,"https://dxi4wb638ujep.cloudfront.net/1/k/r/e/rez8i1pp0p8.webp"); assert.equal(dev.DEVELOPMENT_RESOURCE_ASSETS.cups,"https://dxi4wb638ujep.cloudfront.net/1/k/t/t/ttzf1b8nbe.webp");
assert.equal(dev.ASSETS.Buono,"https://dxi4wb638ujep.cloudfront.net/1/k/i/m/im08lvscqau.webp");
const urls=Object.values(dev.ASSETS); assert.equal(new Set(urls).size,5); urls.forEach(url=>{assert(url.startsWith("https://dxi4wb638ujep.cloudfront.net/")); assert(!/static\.wikia|assets\/development|encrypted-tbn|googleusercontent/.test(url));});
const source=require("fs").readFileSync("js/development-v2.js","utf8"); assert(!source.includes("rez8i1ppo0p8")); assert(!source.includes("/1/k/r/t/ttzf1b8nbe")); assert(!source.includes("/1/k/g/t/ttzf1b8nbe"));
memory.set(dev.STORAGE_KEY,JSON.stringify({schemaVersion:3,projects:{Elite:1,Mondiale:2},projectBuild:{Elite:1,Mondiale:2}})); const v3=dev.read(); assert.equal(v3.projects.Elite,1); assert.equal(v3.projects.Mondiale,2); assert.equal(v3.projectBuild.Elite,1); assert.equal(v3.projectBuild.Mondiale,2); assert.equal(v3.schemaVersion,4); dev.write(v3); assert.deepEqual(dev.read(),v3);
assert.equal(dev.SCHEMA_VERSION,4); assert(dev.read().projectBuild);
console.log("development-v2-test: V4 migration, 4-module builds, warehouse costs and pull idempotency OK");
