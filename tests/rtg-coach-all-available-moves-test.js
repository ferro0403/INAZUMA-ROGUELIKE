"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const move=(cost,element="fire")=>({name:"Tecnica "+cost,type:"shot",element,power:cost,ptCost:cost});
const catalog={
  a:[move(41),move(57),move(83)],
  b:[move(31),move(63),move(81),move(99)],
  rival:[move(35),move(55),move(79)],
};
const sandbox={
  RoadToGloryCoaches:{owned:s=>new Set(s.coachOwnedIds||[])},
  RtgFourMovesRuntime:{movesFor:(_season,id)=>catalog[id]||[]},
};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
for(const path of ["js/road-to-glory/rtg-coach-powers-runtime.js",
  "js/road-to-glory/rtg-coach-powers-prematch.js",
  "js/road-to-glory/rtg-coach-powers-preview.js"])
  vm.runInContext(read(path),sandbox,{filename:path});
const squadPower=sandbox.RoadToGloryCoachPowerRuntime;
const pre=sandbox.RoadToGloryCoachPreMatchRuntime;
const mk=(id,element="fire")=>({cardId:id,playerId:id,element,category:"Elite",
  legacySeasonId:"ie1",overall:78,position:"FW"});
const kickoff=()=>({seasonId:"ie1",ptModeVersion:1,
  userSquad:{lineup:[mk("a"),mk("b")],bench:[]},
  ptCurrentByPlayerId:{"user:a":200,"user:b":200},
  ptMaxByPlayerId:{"user:a":200,"user:b":200}});
test("Aquilina: all three real techniques get the discount from a legacy two-move config",()=>{
 const match=kickoff();
 const selected={coachId:"1329",coachPowerSelection:{coachId:"1329",cardIds:["a"],moveIndices:[0,2]}};
 const powered=squadPower.applyToMatch(match,selected,{coachOwnedIds:["1329"]});
 assert.deepEqual(Array.from(powered.coachPowerEffect.moveIndices),[0,1,2]);
 assert.deepEqual([0,1,2].map(i=>squadPower.moveCost(powered,"user","a",i,catalog.a[i].ptCost)),[21,29,42]);
 assert.equal(squadPower.moveCost(powered,"user","b",1,63),63);
 assert.equal(match.coachPowerEffect,undefined);
 const preview=sandbox.RoadToGloryCoachSquadPreview.projected({
  player:match.userSquad.lineup[0],cardId:"a",
  state:{coachOwnedIds:["1329"]},squad:{...selected,lineup:["a"],bench:[]},seasonId:"ie1"});
 assert.deepEqual(Object.keys(preview.costs),["0","1","2"]);
});
test("Yi: a three-move player and four-move player each transform their entire real catalog",()=>{
 const match=kickoff();match.userSquad.lineup[1].element="mountain";
 const selected={coachId:"4401",coachPowerSelection:{coachId:"4401",cardIds:["a","b"],targets:[
  {cardId:"a",element:"wind",moveIndices:[0,2]},
  {cardId:"b",element:"forest",moveIndices:[]},
 ]}};
 const powered=squadPower.applyToMatch(match,selected,{coachOwnedIds:["4401"]});
 assert.deepEqual(Array.from(powered.coachPowerEffect.targets[0].moveIndices),[0,1,2]);
 assert.deepEqual(Array.from(powered.coachPowerEffect.targets[1].moveIndices),[0,1,2,3]);
 assert.equal(squadPower.moveElement(powered,"user","a",1,"fire"),"wind");
 assert.equal(squadPower.moveElement(powered,"user","b",3,"mountain"),"forest");
 assert.equal(squadPower.moveElement(powered,"opponent","a",1,"fire"),"fire");
 assert.equal(match.userSquad.lineup[0].element,"fire");
});
test("Zoolan: one selection blocks all three opposing moves; a past match stays historical",()=>{
 const match={matchId:"one",seasonId:"ie1",preMatchCoachId:"1940",
  opponentSquad:{lineup:[mk("rival")],bench:[]},userSquad:{lineup:[mk("a")],bench:[]},
  presentation:{preMatchPowerStatus:"pending"}};
 const powered=pre.apply(match,"1940",{playerIds:["rival"],moveIndices:[0,2]});
 assert.deepEqual(Array.from(powered.preMatchCoachEffect.moveIndices),[0,1,2]);
 for(const i of [0,1,2])assert.equal(pre.blocked(powered,"opponent","rival",i),true);
 assert.equal(pre.blocked(powered,"user","rival",1),false);
 const past={preMatchCoachEffect:{coachId:"1940",playerIds:["rival"],moveIndices:[0,2]}};
 assert.equal(pre.blocked(past,"opponent","rival",1),false,"existing match effect is not retroactively changed");
});
test("Saved match snapshots are not rewritten by new power selection rules",()=>{
 const old={coachPowerEffect:{coachId:"1329",cardIds:["a"],moveIndices:[0,2]}};
 assert.equal(squadPower.moveCost(old,"user","a",1,57),57);
 assert.equal(squadPower.moveCost(old,"user","a",2,83),42);
 assert.deepEqual(Array.from(squadPower.availableMoveIndices(catalog.b)),[0,1,2,3]);
 assert.equal(squadPower.availableMoveIndices([]),null);
});
