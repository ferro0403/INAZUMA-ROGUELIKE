"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const read=path=>fs.readFileSync(path,"utf8");
const sandbox={
 RoadToGloryCoaches:{owned:s=>new Set(s.coachOwnedIds||[])},
 RtgFourMovesRuntime:{movesFor:()=>[0,1,2,3].map(i=>({name:"Mossa "+i,type:"shot",power:40+i*10,ptCost:40+i*10}))}
};
vm.runInNewContext(read("js/road-to-glory/rtg-coach-powers-prematch.js"),sandbox);
vm.runInNewContext(read("js/road-to-glory/rtg-coach-opponent-bench.js"),sandbox);
const runtime=sandbox.RoadToGloryCoachPreMatchRuntime;
const card=(cardId,normalizedRole)=>({cardId,playerId:cardId,normalizedRole,position:normalizedRole,
 element:"fire",legacySeasonId:"ie1",overall:86,baseStats:{stamina:50}});
const opponent=()=>({
 formationId:"4-4-2",lineup:[
 card("gk","GK"),card("d1","DF"),card("d2","DF"),card("d3","DF"),card("d4","DF"),
 card("m1","MF"),card("m2","MF"),card("m3","MF"),card("m4","MF"),card("f1","FW"),card("f2","FW")
 ],bench:[card("rb-gk","GK"),card("rb1","MF"),card("rb2","FW"),card("rb3","DF")],
});
const user=()=>({
 formationId:"4-4-2",lineup:Array.from({length:11},(_,i)=>card("u"+i,i===0?"GK":"MF")),
 bench:Array.from({length:4},(_,i)=>card("ub"+i,i===0?"GK":"DF"))
});
const makeMatch=coachId=>{
 const userSquad=user(),opponentSquad=opponent();
 const current={},max={};
 for(const [side,squad] of [["opponent",opponentSquad],["user",userSquad]]){
  for(const p of [...squad.lineup,...squad.bench]){
   current[side+":"+p.cardId]=200;
   max[side+":"+p.cardId]=200;
  }
 }
 return {matchId:"test:1",seasonId:"ie1",userSquad,opponentSquad,preMatchCoachId:coachId,
  ptModeVersion:1,ptCurrentByPlayerId:current,ptMaxByPlayerId:max,
  userRosterIds:[...userSquad.lineup,...userSquad.bench].map(x=>x.cardId),
  presentation:{preMatchSeen:false,preMatchPowerStatus:"pending"}};
};
test("Ray: any outfield role may replace another; goalkeeper only replaces goalkeeper",()=>{
 const m=makeMatch("36");
 assert(runtime.validate(m,"36",{playerIds:["f1","rb1"]}));
 const powered=runtime.apply(m,"36",{playerIds:["f1","rb1"]});
 assert.equal(powered.opponentSquad.lineup[9].cardId,"rb1");
 assert.equal(powered.opponentSquad.lineup[9].tacticalRole,"FW");
 assert.equal(powered.opponentSquad.bench[1].cardId,"f1");
 assert.equal(powered.presentation.preMatchPowerStatus,"applied");
 assert.equal(m.opponentSquad.lineup[9].cardId,"f1");
 assert.equal(runtime.validate(m,"36",{playerIds:["gk","rb2"]}),null);
 assert.equal(runtime.validate(m,"36",{playerIds:["f1","rb-gk"]}),null);
 assert(runtime.validate(m,"36",{playerIds:["gk","rb-gk"]}));
});
test("Wyles: exactly two distinct opponents start on 50% PT; maxima unchanged",()=>{
 const match=makeMatch("1275"),chosen={playerIds:["d1","m2"]};
 const powered=runtime.apply(match,"1275",chosen);
 assert.equal(powered.ptCurrentByPlayerId["opponent:d1"],100);
 assert.equal(powered.ptCurrentByPlayerId["opponent:m2"],100);
 assert.equal(powered.ptMaxByPlayerId["opponent:d1"],200);
 assert.equal(powered.ptMaxByPlayerId["opponent:m2"],200);
 assert.equal(powered.ptCurrentByPlayerId["opponent:d2"],200);
 assert.equal(match.ptCurrentByPlayerId["opponent:d1"],200);
 assert.equal(runtime.validate(match,"1275",{playerIds:["d1","d1"]}),null);
 assert.equal(runtime.validate(match,"1275",{playerIds:["d1"]}),null);
});
test("René: swap precisely two outfield tactical slots, never GK",()=>{
 const m=makeMatch("4761");
 const powered=runtime.apply(m,"4761",{playerIds:["d1","f2"]});
 assert.equal(powered.opponentSquad.lineup[1].cardId,"f2");
 assert.equal(powered.opponentSquad.lineup[1].tacticalRole,"DF");
 assert.equal(powered.opponentSquad.lineup[10].cardId,"d1");
 assert.equal(powered.opponentSquad.lineup[10].tacticalRole,"FW");
 assert.equal(powered.opponentSquad.lineup[0].cardId,"gk");
 assert.equal(runtime.validate(m,"4761",{playerIds:["gk","m1"]}),null);
 assert.equal(runtime.validate(m,"4761",{playerIds:["m1","m1"]}),null);
});
test("Zoolan: two of four opponent moves are disabled only in opposing match",()=>{
 const match=makeMatch("1940"),choice={playerIds:["m1"],moveIndices:[0,3]};
 const powered=runtime.apply(match,"1940",choice);
 assert.equal(runtime.blocked(powered,"opponent","m1",0),true);
 assert.equal(runtime.blocked(powered,"opponent","m1",3),true);
 assert.equal(runtime.blocked(powered,"opponent","m1",1),false);
 assert.equal(runtime.blocked(powered,"opponent","m2",0),false);
 assert.equal(runtime.blocked(powered,"user","m1",0),false);
 assert.equal(runtime.validate(match,"1940",{playerIds:["m1"],moveIndices:[0,0]}),null);
 assert.equal(runtime.validate(match,"1940",{playerIds:["m1"],moveIndices:[1,4]}),null);
 assert.match(read("js/road-to-glory/rtg-match-pt-runtime.js"),/RoadToGloryCoachPreMatchRuntime\?\.blocked\?/);
});
test("Nerina: true opposing reserve moves to user bench; replaced reserve remains permanent",()=>{
 const match=makeMatch("1225"),powered=runtime.apply(match,"1225",{playerIds:["rb1","ub2"]});
 assert.equal(powered.userSquad.bench[2].cardId,"rb1");
 assert.equal(powered.userSquad.bench.length,4);
 assert.equal(powered.opponentSquad.bench.some(p=>p.cardId==="rb1"),false);
 assert.equal(powered.userRosterIds.includes("rb1"),true);
 assert.equal(powered.userRosterIds.includes("ub2"),false);
 assert.equal(powered.ptCurrentByPlayerId["user:rb1"],200);
 assert.equal(powered.ptCurrentByPlayerId["opponent:rb1"],undefined);
 assert.equal(powered.ptCurrentByPlayerId["user:ub2"],undefined);
 assert.equal(match.userSquad.bench[2].cardId,"ub2");
});
test("Opponent bench is sourced from real team or genuine free-agent entries",()=>{
 const base={lineup:[card("1","GK"),card("2","DF"),card("3","MF")],bench:[]};
 const data={playerIds:["1","2","3","4","5","6","7"]};
 const team=sandbox.RoadToGloryCoachOpponentBench.build({
  opponent:base,node:{type:"main",teamId:"occult",coachId:"36"},
  teamRecord:data,resolveForTeam:k=>card(k,k==="4"?"GK":"FW")
 });
 assert.equal(team.bench.length,4);
 assert.equal(new Set([...team.lineup,...team.bench].map(p=>p.cardId)).size,7);
 assert.equal(base.bench.length,0);
 assert.equal(sandbox.RoadToGloryCoachOpponentBench.build({
  opponent:base,node:{type:"main",coachId:"1275"},teamRecord:data,
  resolveForTeam:k=>card(k,"FW")
 }),base);
});
test("Pre-match gating, UI and canonical atomic save are linked; old matches unaffected",()=>{
 const match=makeMatch("36");
 assert.equal(runtime.coachFor({squads:{ie1:{coachId:"36"}},coachOwnedIds:["36"]},"ie1"),"36");
 assert.equal(runtime.coachFor({squads:{ie1:{coachId:"36"}},coachOwnedIds:[]},"ie1"),"");
 assert.equal(runtime.skip(match).presentation.preMatchPowerStatus,"skipped");
 assert.equal(runtime.apply(match,"36",{playerIds:["gk","rb-gk"]}).presentation.preMatchPowerStatus,"applied");
 const oldMatch={...match,presentation:{preMatchSeen:true}};
 assert.equal(runtime.apply(oldMatch,"36",{playerIds:["gk","rb-gk"]}),oldMatch);
 const ctrl=read("js/road-to-glory/rtg-controller.js");
 assert.match(ctrl,/preMatchPowerStatus:"pending"/);
 assert.match(ctrl,/RoadToGloryCoachPreMatchController\.commit/);
 const persist=read("js/road-to-glory/rtg-coach-powers-prematch-controller.js");
 assert.match(persist,/repository\.update\("rtg-prematch-coach-power"/);
 assert.match(persist,/matchEngine\.prepareNext\(chosen\)/);
 assert.doesNotMatch(persist,/localStorage|Firebase|setItem/);
 const ui=read("js/road-to-glory/rtg-coach-powers-prematch-ui.js");
 assert.match(ui,/matchPitchMarkup/);
 assert.match(ui,/playerCard/);
 assert.match(ui,/CONTINUA SENZA POTERE/);
 const view=read("js/road-to-glory/rtg-match-view.js");
 assert.match(view,/data-rtg-prematch-coach-power/);
});
