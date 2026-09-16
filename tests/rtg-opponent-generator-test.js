"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const freeDb=JSON.parse(fs.readFileSync("data/FREE_AGENTS_compact.json","utf8"));
const seasonDb=JSON.parse(fs.readFileSync("data/IE1_season_compact.json","utf8"));
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON};
c.globalThis=c;
c.RoadToGloryConfig={SEASON1:{mainTeams:[],constraints:{}}};
vm.createContext(c);
for(const file of["js/road-to-glory/rtg-rng.js","js/road-to-glory/rtg-squad-runtime.js","js/road-to-glory/rtg-opponent-generator.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const resolver={
  resolveAtLevel20:(playerId,_season,_variant,db)=>{
    const p=(db?.players||[]).find(x=>String(x.playerId)===String(playerId));
    return p?{...p,overall:Number(p.finalOverall),level:20}:null;
  },
  resolveMove:()=>null,
};
const formations=seasonDb.formations.eleven;
const input={seed:"secondary-seed",attemptNumber:1,freeAgentsDb:freeDb,formations,targetMin:73,targetMax:76,playerResolver:resolver};
const a=c.RoadToGloryOpponentGenerator.generate(input);
const b=c.RoadToGloryOpponentGenerator.generate(input);
assert.strictEqual(a.playerIds.length,11);
assert.strictEqual(new Set(a.playerIds).size,11);
assert.deepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
assert(a.teamPower>=73&&a.teamPower<=76);
const formation=formations.find(f=>f.id===a.formationId);assert(formation);
const roles=a.playerIds.map(id=>freeDb.players.find(p=>String(p.playerId)===String(id))?.normalizedRole);
for(const [role,required] of Object.entries(formation.requirements)){assert.strictEqual(roles.filter(r=>r===role).length,required);}
const next=c.RoadToGloryOpponentGenerator.generate({...input,attemptNumber:2});
assert.notDeepStrictEqual(Array.from(next.playerIds),Array.from(a.playerIds));
assert.throws(()=>c.RoadToGloryOpponentGenerator.generate({...input,targetMin:99,targetMax:99}),e=>e.code==="rtg-secondary-opponent-band-unavailable");
console.log("rtg-opponent-generator-test: PASS");
