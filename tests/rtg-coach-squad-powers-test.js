const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs"),vm=require("node:vm");
const read=p=>fs.readFileSync(p,"utf8");
const moves=[
  {name:"Colpo A",type:"shot",power:40,ptCost:40},
  {name:"Colpo B",type:"shot",power:75,ptCost:75},
  {name:"Colpo C",type:"shot",power:52,ptCost:52},
  {name:"Colpo D",type:"shot",power:101,ptCost:101},
];
const ctx={RoadToGloryCoaches:{owned:s=>new Set(s.coachOwnedIds||[])},
  RtgFourMovesRuntime:{movesFor:()=>moves,isReady:()=>true,error:()=>null,ptBreakdown:()=>({total:200})}};
vm.runInNewContext(read("js/road-to-glory/rtg-coach-powers-runtime.js"),ctx);
vm.runInNewContext(read("js/road-to-glory/rtg-match-pt-runtime.js"),ctx);
const rules=ctx.RoadToGloryCoachPowerRuntime,pt=ctx.RoadToGloryMatchPtRuntime;
const player=(cardId)=>({cardId,playerId:cardId,legacySeasonId:"ie1",baseStats:{}});
const match=()=>({seasonId:"ie1",ptModeVersion:1,ptCurrentByPlayerId:{"user:a":200,"user:b":200,"user:c":200},
  ptMaxByPlayerId:{"user:a":200,"user:b":200,"user:c":200},
  userSquad:{lineup:[player("a"),player("b"),player("c")],bench:[]}});
test("Hillman adds 50 initial and max PT to exactly two starters, once, without mutating input",()=>{
  const original=match(),squad={coachId:"208",coachPowerSelection:{coachId:"208",cardIds:["a","b"],moveIndices:[]}};
  const result=rules.applyToMatch(original,squad,{coachOwnedIds:["208"]});
  assert.equal(result.ptCurrentByPlayerId["user:a"],250);
  assert.equal(result.ptMaxByPlayerId["user:b"],250);
  assert.equal(result.ptMaxByPlayerId["user:c"],200);
  assert.equal(original.ptCurrentByPlayerId["user:a"],200);
  assert.equal(rules.applyToMatch(result,squad,{coachOwnedIds:["208"]}),result,"no second bonus");
});
test("Aquilina halves only the selected two moves of the selected starter",()=>{
  const squad={coachId:"1329",coachPowerSelection:{coachId:"1329",cardIds:["a"],moveIndices:[0,3]}};
  const result=rules.applyToMatch(match(),squad,{coachOwnedIds:["1329"]});
  assert.equal(result.coachPowerEffect.coachId,"1329");
  assert.deepEqual(Array.from(pt.compatible(result,"user","a","shot").map(move=>move.ptCost)),[20,75,52,51]);
  assert.deepEqual(Array.from(pt.compatible(result,"user","b","shot").map(move=>move.ptCost)),[40,75,52,101]);
  assert.equal(result.ptCurrentByPlayerId["user:a"],200);
});
test("Unavailable coaches, invalid/stale selection, old match PT: no effect",()=>{
  const original=match();
  const s={coachId:"208",coachPowerSelection:{coachId:"208",cardIds:["a","missing"]}};
  assert.equal(rules.applyToMatch(original,s,{coachOwnedIds:["208"]}),original);
  s.coachPowerSelection.cardIds=["a","b"];
  assert.equal(rules.applyToMatch(original,s,{coachOwnedIds:[]}),original);
  assert.equal(rules.applyToMatch({...original,ptModeVersion:undefined},s,{coachOwnedIds:["208"]}).coachPowerEffect,undefined);
  const invalid={coachId:"1329",coachPowerSelection:{coachId:"1329",cardIds:["a"],moveIndices:[0,0]}};
  assert.equal(rules.applyToMatch(original,invalid,{coachOwnedIds:["1329"]}),original);
});
test("Squad UI and match wiring use canonical repository persistence",()=>{
  const source=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  assert.match(source,/ctx\.saveSquad\(draft\)/);
  assert.doesNotMatch(source,/localStorage\.setItem|firebase|indexedDB/i);
  assert.match(read("js/road-to-glory/rtg-controller.js"),/RoadToGloryCoachPowerRuntime\?\.applyToMatch/);
  assert.match(read("js/road-to-glory/rtg-squad-view-base.js"),/data-rtg-coach-power-configure/);
  const index=read("index.html");
  assert.match(index,/rtg-coach-powers-runtime\.js/);
  assert.match(index,/rtg-coach-powers-squad-ui\.js/);
});
