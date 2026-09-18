"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const databases={
  ie1:{seasonId:"ie1",players:[{playerId:"p1",name:"P1 S1",category:"Buono",position:"FW"},{playerId:"p2",name:"P2 S1",category:"Normale",position:"MF"}]},
  ie1_s2:{seasonId:"ie1_s2",requiresProfileAwareRuntime:true,players:[{playerId:"p1",name:"P1 S2",category:"Forte",position:"FW"},{playerId:"p2",name:"P2 S2",category:"Elite",position:"DF"}]},
  ie1_s3:{seasonId:"ie1_s3",requiresProfileAwareRuntime:true,players:[{playerId:"p1",name:"P1 S3",category:"Mondiale",position:"MF"}]},
};
const calls={levels:[],moves:[]};
const c={globalThis:null,Object,Array,String,Number,JSON,Map,Set,SeasonRegistry:{database:id=>databases[id]||null,player:(pid,sid)=>(databases[sid]?.players||[]).find(p=>String(p.playerId)===String(pid))||null},ProfiledSeasonRuntime:{canonicalPlayerId:(_sid,pid)=>String(pid),resolveEffectivePlayerAtLevel:(entry,ctx)=>{calls.levels.push({entry:{...entry},seasonId:ctx.seasonId,database:ctx.database});const base=(ctx.database.players||[]).find(p=>String(p.playerId)===String(entry.playerId));return base?{...base,level:entry.level,roleVariantId:entry.activeRoleVariantId||null}:null;}},InazumaProgression:{getPlayerAtLevel:(player,level)=>({...player,level})},MatchMoveRuntime:{moveForPlayer:(seasonId,player,role)=>{calls.moves.push({seasonId,playerId:player.playerId,role});return{name:"Test Move",type:"shot",power:80,element:"Fire"};}}};
c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-player-resolver.js","utf8"),c);
const r=c.RoadToGloryPlayerResolver;
let v=r.resolveVersion("p1","ie1");assert.strictEqual(v.seasonId,"ie1");assert.strictEqual(v.player.name,"P1 S1");
v=r.resolveVersion("p1","ie1_s2");assert.strictEqual(v.seasonId,"ie1_s2");assert.strictEqual(v.player.name,"P1 S2");
v=r.resolveVersion("p2","ie1_s3");assert.strictEqual(v.seasonId,"ie1_s2");assert.strictEqual(v.player.name,"P2 S2");assert.strictEqual(v.player.playerId,"p2");
const p=r.resolveAtLevel20("p2","ie1_s3","df");assert.strictEqual(p.level,20);assert.strictEqual(p.playerId,"p2");assert.strictEqual(calls.levels.at(-1).entry.level,20);assert.strictEqual(calls.levels.at(-1).entry.activeRoleVariantId,"df");
const m=r.resolveMove("p2","ie1_s3","DF");assert.strictEqual(m.power,80);assert.deepStrictEqual(calls.moves.at(-1),{seasonId:"ie1_s2",playerId:"p2",role:"DF"});
assert.strictEqual(r.rarity("p2","ie1_s3"),"Elite");assert.strictEqual(r.rarity("p1","ie1_s3"),"Mondiale");assert.strictEqual(r.resolveVersion("missing","ie1_s3"),null);
console.log("rtg-player-resolver-test: PASS");
