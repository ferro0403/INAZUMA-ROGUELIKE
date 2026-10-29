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
test("Hillman adds 100 initial and max PT to exactly two starters, once, without mutating input",()=>{
  const original=match(),squad={coachId:"208",coachPowerSelection:{coachId:"208",cardIds:["a","b"],moveIndices:[]}};
  const result=rules.applyToMatch(original,squad,{coachOwnedIds:["208"]});
  assert.equal(result.ptCurrentByPlayerId["user:a"],300);
  assert.equal(result.ptMaxByPlayerId["user:b"],300);
  assert.equal(result.ptMaxByPlayerId["user:c"],200);
  assert.equal(original.ptCurrentByPlayerId["user:a"],200);
  assert.equal(rules.applyToMatch(result,squad,{coachOwnedIds:["208"]}),result,"no second bonus");
});
test("Aquilina halves all available moves of the selected starter, including legacy two-move saves",()=>{
  const squad={coachId:"1329",coachPowerSelection:{coachId:"1329",cardIds:["a"],moveIndices:[0,3]}};
  const result=rules.applyToMatch(match(),squad,{coachOwnedIds:["1329"]});
  assert.equal(result.coachPowerEffect.coachId,"1329");
  assert.deepEqual(Array.from(pt.compatible(result,"user","a","shot").map(move=>move.ptCost)),[20,38,26,51]);
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
  const invalid={coachId:"1329",coachPowerSelection:{coachId:"1329",cardIds:["missing"],moveIndices:[0,0]}};
  assert.equal(rules.applyToMatch(original,invalid,{coachOwnedIds:["1329"]}),original);
  const legacy={coachId:"1329",coachPowerSelection:{coachId:"1329",cardIds:["a"],moveIndices:[0,0]}};
  assert.deepEqual(Array.from(rules.applyToMatch(original,legacy,{coachOwnedIds:["1329"]}).coachPowerEffect.moveIndices),[0,1,2,3]);
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


test("Hekyll Jyde: one Halloween starter counts -15 OVR only for pre-match eligibility in both runs",()=>{
  const coachId="halloween-coach-54",target="halloween2026::custom_0002";
  const lineup=[target,...Array.from({length:10},(_,i)=>"normal"+i)],bench=["r0","r1","r2","r3"];
  const squad={coachId,lineup,bench,coachPowerSelection:{coachId,cardIds:[target]}};
  const state={activeSeasonId:"orion",campaignId:"rtg-ares-orion",coachOwnedIds:[coachId]};
  assert.equal(rules.powerReady(coachId),true);
  assert.equal(rules.validConfig(squad,lineup,"orion",bench)?.cardIds?.[0],target);
  assert.deepEqual(JSON.parse(JSON.stringify(rules.overallDiscountFor(squad,state))),{cardId:target,amount:15});
  assert.equal(rules.overallDiscountFor(squad,{...state,coachOwnedIds:[]}),null);
  assert.equal(rules.overallDiscountFor({...squad,coachPowerSelection:{coachId,cardIds:["normal0"]}},state),null);
  assert.equal(rules.overallDiscountFor({...squad,coachPowerSelection:{coachId,cardIds:["r0"]}},state),null);
  const env={RoadToGloryCoachPowerRuntime:rules};
  vm.runInNewContext(read("js/road-to-glory/rtg-squad-runtime.js"),env);
  const resolver={resolveAtLevel20:key=>({overall:key===target?96:86,position:"MF"}),resolveMove:()=>null};
  const common={lineup:[...lineup,...bench],activeSeasonId:"orion",playerResolver:resolver};
  assert.equal(env.RoadToGlorySquadRuntime.teamPower(common),86.7);
  assert.equal(env.RoadToGlorySquadRuntime.teamPower({...common,coachOverallDiscount:rules.overallDiscountFor(squad,state)}),85.7);
  assert.equal(env.RoadToGlorySquadRuntime.teamPower(common),86.7,"Actual overall must never be overwritten");
  const original={...match(),userSquad:{lineup:lineup.map(player),bench:bench.map(player)}};
  assert.equal(rules.applyToMatch(original,squad,state),original,
    "The event manager must NEVER modify match state, stats, moves, PT or probabilities");
});
test("Travis counts 15 players but caps one chosen bench OVR at 60",()=>{
  const lineup=Array.from({length:11},(_,i)=>"t"+i);
  const bench=["r0","r1","r2","r3"];
  const squad={coachId:"1777",lineup,bench,coachPowerSelection:{coachId:"1777",cardIds:["r0"]}};
  const state={activeSeasonId:"ie1",coachOwnedIds:["1777"]};
  assert.equal(rules.capOverrideFor(squad,state),"r0");
  assert.equal(rules.eligibleRosterForCap(squad,state).length,15);
  assert.equal(squad.bench.length,4);
  assert.equal(rules.capOverrideFor(squad,{...state,coachOwnedIds:[]}),null);
  assert.equal(rules.capOverrideFor({...squad,coachPowerSelection:{coachId:"1777",cardIds:["t0"]}},state),null);
  const sandbox={RoadToGloryCoachPowerRuntime:rules};
  vm.runInNewContext(read("js/road-to-glory/rtg-squad-runtime.js"),sandbox);
  const resolver={resolveAtLevel20:key=>({overall:key==="r0"?99:70}),resolveMove:()=>null};
  const common={lineup:[...lineup,...bench],playerResolver:resolver};
  assert.equal(sandbox.RoadToGlorySquadRuntime.teamPower(common),71.9);
  assert.equal(sandbox.RoadToGlorySquadRuntime.teamPower({...common,coachCapCardId:"r0"}),69.3);
  // A value lower than 60 must never get worse.
  const weaker={resolveAtLevel20:key=>({overall:key==="r0"?40:70}),resolveMove:()=>null};
  assert.equal(sandbox.RoadToGlorySquadRuntime.teamPower({...common,playerResolver:weaker}),
    sandbox.RoadToGlorySquadRuntime.teamPower({...common,playerResolver:weaker,coachCapCardId:"r0"}));
  const source=read("js/road-to-glory/rtg-squad-runtime.js");
  assert.match(source,/capOverrideFor\?\.\(squad,state\)/);
  assert.match(source,/lineup: activeRoster/);
});
test("Arrows upgrades actual match player stats/rarity including PT while preserving cap values",()=>{
  const original=match();
  original.userSquad.bench=[{...player("reserve"),category:"Elite",overall:88,potential:88,
    stats:{stamina:60,grit:50,control:70,physical:55},attack:70}];
  original.ptCurrentByPlayerId["user:reserve"]=200;
  original.ptMaxByPlayerId["user:reserve"]=200;
  const squad={coachId:"1974",coachPowerSelection:{coachId:"1974",cardIds:["reserve"]}};
  let calls=0;
  const result=rules.applyToMatch(original,squad,{coachOwnedIds:["1974"]},{
    upgradeRarity:(p,rarity,key)=>{
      calls++;assert.equal(p.cardId,"reserve");assert.equal(rarity,"Mondiale");
      assert.equal(key,"reserve");
      return {...p,category:rarity,overall:90,potential:90,
        stats:{stamina:80,grit:70,control:80,physical:75},attack:95};
    },
  });
  assert.equal(calls,1);
  assert.equal(result.userSquad.bench[0].category,"Mondiale");
  assert.equal(result.userSquad.bench[0].overall,90);
  assert.equal(result.userSquad.bench[0].attack,95);
  assert.equal(result.coachPowerEffect.previousOverall,88);
  assert.equal(result.coachPowerEffect.previousRarity,"Elite");
  assert.equal(result.coachPowerEffect.targetRarity,"Mondiale");
  assert.equal(result.ptCurrentByPlayerId["user:reserve"],200);
  assert.equal(result.ptMaxByPlayerId["user:reserve"],200);
  assert.equal(original.userSquad.bench[0].overall,88);
  assert.equal(original.userSquad.bench[0].category,"Elite");
  assert.equal(original.ptCurrentByPlayerId["user:reserve"],200);
  assert.equal(rules.applyToMatch(result,squad,{coachOwnedIds:["1974"]}),result);
});
test("Arrows upgrades two distinct starters/reserves atomically and keeps a one-card save compatible",()=>{
  const original=match();
  original.userSquad.lineup[0]={...player("a"),category:"Elite",overall:88,
    stats:{stamina:60,grit:55,control:70,physical:65}};
  original.userSquad.bench=[{...player("reserve"),category:"Forte",overall:83,
    stats:{stamina:58,grit:62,control:55,physical:70}}];
  original.ptCurrentByPlayerId["user:reserve"]=160;
  original.ptMaxByPlayerId["user:reserve"]=160;
  const selected={coachId:"1974",coachPowerSelection:{
    coachId:"1974",cardIds:["a","reserve"]}};
  assert.equal(rules.validConfig(selected,original.userSquad.lineup,"ie1",original.userSquad.bench).cardIds.length,2);
  const seen=[];
  const upgradeRarity=(p,target,key)=>{
    seen.push(key);
    return {...p,category:target,overall:Number(p.overall)+2,
      stats:{...p.stats,stamina:Number(p.stats.stamina)+20}};
  };
  const powered=rules.applyToMatch(original,selected,{coachOwnedIds:["1974"]},{upgradeRarity});
  assert.deepEqual(seen,["a","reserve"]);
  assert.equal(powered.userSquad.lineup[0].category,"Mondiale");
  assert.equal(powered.userSquad.bench[0].category,"Elite");
  assert.equal(powered.userSquad.lineup[0].overall,90);
  assert.equal(powered.userSquad.bench[0].overall,85);
  assert.equal(powered.ptCurrentByPlayerId["user:a"],200);
  assert.equal(powered.ptMaxByPlayerId["user:reserve"],200);
  assert.equal(powered.coachPowerEffect.targets.length,2);
  assert.equal(powered.coachPowerEffect.targets[0].previousOverall,88);
  assert.equal(powered.coachPowerEffect.targets[1].previousOverall,83);
  assert.equal(powered.coachPowerEffect.targetRarity,"Mondiale");
  assert.equal(original.userSquad.lineup[0].category,"Elite");
  assert.equal(original.userSquad.bench[0].category,"Forte");
  assert.equal(original.ptCurrentByPlayerId["user:reserve"],160);
  assert.equal(rules.applyToMatch(powered,selected,{coachOwnedIds:["1974"]},{upgradeRarity}),powered,
    "Reapplying a snapshot must never boost rarity a second time");

  // Invalid second upgrade cannot partially change the first player or PT.
  const invalid=rules.applyToMatch(original,selected,{coachOwnedIds:["1974"]},{
    upgradeRarity:(p,target,key)=>key==="reserve"?null:upgradeRarity(p,target,key),
  });
  assert.equal(invalid,original);
  const duplicate={coachId:"1974",coachPowerSelection:{coachId:"1974",cardIds:["a","a"]}};
  assert.equal(rules.validConfig(duplicate,original.userSquad.lineup,"ie1",original.userSquad.bench),null);
  const maxed={...original,userSquad:{...original.userSquad,
    bench:[{...original.userSquad.bench[0],category:"Aurico",finalRarity:"Aurico"}]}};
  assert.equal(rules.validConfig(selected,maxed.userSquad.lineup,"ie1",maxed.userSquad.bench),null);
  const historic={...selected,coachPowerSelection:{...selected.coachPowerSelection,cardIds:["a"]}};
  assert.equal(rules.validConfig(historic,original.userSquad.lineup,"ie1",original.userSquad.bench).cardIds.length,1,
    "Legacy one-card selection must still work");
  assert.equal(rules.applyToMatch(original,historic,{coachOwnedIds:["1974"]},{upgradeRarity}).coachPowerEffect.targets.length,1);
});
test("Arrows squad selection shows two cards and validates both previews",()=>{
  const ui=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  const preview=read("js/road-to-glory/rtg-coach-powers-preview.js");
  const state=read("js/road-to-glory/rtg-state.js");
  assert.match(ui,/\["208","1974","4401"\]\.includes\(coachId\)\?2:1/);
  assert.match(ui,/choice\.cardIds\.map\(key=>/);
  assert.match(ui,/coachId==="1974"&&choice\.cardIds\.length!==2/);
  assert.match(preview,/config\.cardIds\.length<1\|\|config\.cardIds\.length>2/);
  assert.match(state,/cardIds:uniqueIds\(squad\.coachPowerSelection\.cardIds\)\.slice\(0,2\)/);
});
test("Arrows rarity production resolver uses next threshold, original card and no account writes",()=>{
  const context={RoadToGloryCoachPowerRuntime:rules,
    InazumaProgression:{RARITY_THRESHOLDS:[
      {category:"Elite",min:85},{category:"Mondiale",min:90},{category:"Leggenda",min:95},{category:"Aurico",min:99}]}};
  vm.runInNewContext(read("js/road-to-glory/rtg-coach-powers-rarity.js"),context);
  const captured=[];
  const playerResolver={
    resolveVersion:()=>({player:{finalOverall:80}}),
    resolveBaseAtLevel20:(card,season,variant,_db,options)=>{
      captured.push({card,season,variant,boost:options.potentialBoost,apps:options.potentialBoostApplications.length});
      return {category:"Mondiale",overall:90,stats:{attack:94},attack:94,potential:90};
    },
  };
  const upgraded=context.RoadToGloryCoachRarityPower.upgrade({
    player:{category:"Elite",overall:88,potential:88},targetRarity:"Mondiale",
    cardId:"card-A",playerResolver,seasonId:"ie1",squad:{activeRoleVariantByCardId:{"card-A":"FW"}},
  });
  assert.equal(upgraded.category,"Mondiale");
  assert.equal(upgraded.attack,94);
  assert.equal(captured.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(captured[0])),{
    card:"card-A",season:"ie1",variant:"FW",boost:10,apps:1
  });
  assert.equal(context.RoadToGloryCoachRarityPower.upgrade({
    player:{category:"Aurico",overall:99,potential:99},targetRarity:"Aurico",
    cardId:"card-A",playerResolver,seasonId:"ie1"}),null);
});
test("Mister Yi changes only selected starting player's elemental affinity in match snapshot",()=>{
  const m=match();
  m.userSquad.lineup=[{...player("a"),element:"wind",overall:80,stats:{}},
    {...player("b"),element:"forest",overall:80,stats:{}}];
  const squad={coachId:"4401",coachPowerSelection:{
    coachId:"4401",cardIds:["a"],element:"fire"}};
  const result=rules.applyToMatch(m,squad,{coachOwnedIds:["4401"]});
  assert.equal(result.userSquad.lineup[0].element,"fire");
  assert.equal(result.userSquad.lineup[1].element,"forest");
  assert.equal(m.userSquad.lineup[0].element,"wind");
  assert.equal(result.coachPowerEffect.element,"fire");
  assert.equal(result.coachPowerEffect.cardIds[0],"a");
  assert.equal(rules.applyToMatch(result,squad,{coachOwnedIds:["4401"]}),result);
  const bad={...squad,coachPowerSelection:{...squad.coachPowerSelection,element:"thunder"}};
  assert.equal(rules.applyToMatch(m,bad,{coachOwnedIds:["4401"]}),m);
  assert.equal(rules.nextRarity("Leggenda"),"Aurico");
  assert.equal(rules.nextRarity("Aurico"),null);
});
test("Yi only permits the other three elements and keeps his Squad badge hidden",()=>{
  for(const [source,normalized] of [
    ["mountain","mountain"],["Montagna","mountain"],["wood","forest"],["Bosco","forest"],
    ["Albero","forest"],["Vento","wind"],["Fuoco","fire"]
  ]) assert.equal(rules.elementKey(source),normalized);
  const m=match();
  m.userSquad.lineup=[{...player("a"),element:"Montagna",overall:80,stats:{}},player("b")];
  const squad={coachId:"4401",coachPowerSelection:{coachId:"4401",cardIds:["a"],element:"mountain"}};
  assert.equal(rules.validConfig(squad,m.userSquad.lineup,"ie1",[]),null);
  assert.equal(rules.applyToMatch(m,squad,{coachOwnedIds:["4401"]}),m);
  squad.coachPowerSelection.element="forest";
  assert.equal(rules.validConfig(squad,m.userSquad.lineup,"ie1",[]).element,"forest");
  assert.equal(rules.applyToMatch(m,squad,{coachOwnedIds:["4401"]}).userSquad.lineup[0].element,"forest");
  const ui=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  assert.match(ui,/ELEMENTS\.filter\(e=>e\.key!==originalElement\)/);
  assert.match(ui,/rules\.elementKey/);
  assert.match(ui,/development-squad-card-scope/);
  assert.match(ui,/ALBERO/);
  assert.match(ui,/rtg-coach-element-art/);
  assert.match(ui,/<svg viewBox=/);
  const view=read("js/road-to-glory/rtg-squad-view-base.js");
  assert.doesNotMatch(view,/rtg-coach-card-buff/);
  assert.match(read("js/road-to-glory/rtg-coach-powers-preview.js"),/forest:"Albero"/);
  const css=read("css/rtg-coaches.css");
  assert.match(css,/\.player-detail-modal \.rtg-coach-move-select/);
  assert.match(css,/\.player-detail-modal \.rtg-coach-moves-confirm/);
  assert.match(css,/border-radius:2px!important/);
  assert.match(css,/Squad card visuals in coach selector/);
});
test("Five Squad power controls and season-safe element roundtrip are wired",()=>{
  const ui=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  assert.match(ui,/lineupPitchMarkup/);
  assert.match(ui,/PANCHINA/);
  assert.match(ui,/TRASFORMAZIONE DEI GIOCATORI/);
  assert.match(ui,/MONTAGNA/);
  assert.match(ui,/TUTTE LE/);
  assert.doesNotMatch(ui,/SELEZIONA 2 MOSSE NELLA SCHEDA/);
  assert.match(ui,/ctx\.saveSquad\(draft\)/);
  const view=read("js/road-to-glory/rtg-coaches-view.js");
  for(const key of ['"208"','"1329"','"1777"','"1974"','"4401"'])
    assert(view.includes(key));
  const stateSource=read("js/road-to-glory/rtg-state.js");
  assert.match(stateSource,/coachPowerSelection\.element/);
  const mainSource=read("js/road-to-glory/rtg-controller.js");
  assert.match(mainSource,/RoadToGloryCoachRarityPower\?\.upgrade/);
  const html=read("index.html");
  assert.match(html,/rtg-coach-powers-rarity\.js/);
  assert.match(html,/rtg-coach-powers-runtime\.js/);
});

test("Squad power preview shows all five targeted effects without mutating canonical cards",()=>{
  const sandbox={
    RoadToGloryCoachPowerRuntime:rules,
    RoadToGloryCoaches:{owned:s=>new Set(s.coachOwnedIds||[])},
    RtgFourMovesRuntime:{movesFor:()=>moves,ptBreakdown:()=>({base:180,bonus:20,total:200})},
    RoadToGloryCoachRarityPower:{upgrade:({player,targetRarity})=>
      ({...player,category:targetRarity,overall:90,stats:{attack:85,control:60},attack:85})},
  };
  vm.runInNewContext(read("js/road-to-glory/rtg-coach-powers-preview.js"),sandbox);
  const preview=sandbox.RoadToGloryCoachSquadPreview;
  const player={cardId:"a",playerId:"a",name:"Tester",overall:88,category:"Elite",element:"wind",
    stats:{attack:70,control:60}};
  const base={player,cardId:"a",state:{coachOwnedIds:["208","1329","1974","4401","1777"]},
    seasonId:"ie1",playerResolver:{},freeAgentsDb:null};
  const given=extra=>preview.projected({...base,...extra});
  const hillman=given({squad:{coachId:"208",lineup:["a","b"],bench:[],
    coachPowerSelection:{coachId:"208",cardIds:["a","b"]}}});
  assert.equal(hillman.pt.total,300);
  const aquilina=given({squad:{coachId:"1329",lineup:["a"],bench:[],
    coachPowerSelection:{coachId:"1329",cardIds:["a"],moveIndices:[0,3]}}});
  assert.equal(aquilina.costs[0],20);
  assert.equal(aquilina.costs[3],51);
  assert.equal(aquilina.costs[1],38);
  assert.equal(aquilina.costs[2],26);
  const yi=given({squad:{coachId:"4401",lineup:["a"],bench:[],
    coachPowerSelection:{coachId:"4401",cardIds:["a"],element:"fire"}}});
  assert.equal(yi.player.element,"Fuoco");
  assert.equal(Object.keys(yi.moveElements).length,4);
  const arrows=given({squad:{coachId:"1974",lineup:["a"],bench:[],
    coachPowerSelection:{coachId:"1974",cardIds:["a"]}}});
  assert.equal(arrows.player.overall,90);
  assert.equal(arrows.stats.find(s=>s.key==="attack").after,85);
  const dual={coachId:"1974",lineup:["a"],bench:["b"],
    coachPowerSelection:{coachId:"1974",cardIds:["a","b"]}};
  const second=given({player:{...player,cardId:"b",playerId:"b",name:"Secondo"},
    cardId:"b",squad:dual});
  assert.equal(given({squad:dual}).player.overall,90);
  assert.equal(second.player.overall,90);
  assert.match(second.note,/OVR/);
  assert.equal(player.overall,88);
  assert.equal(player.element,"wind");
  const travis=given({squad:{coachId:"1777",lineup:[],bench:["a"],
    coachPowerSelection:{coachId:"1777",cardIds:["a"]}}});
  assert.match(travis.note,/contributo al limite squadra 60/);
  const ui=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  assert.match(ui,/lineupPitchMarkup/);
  assert.match(ui,/data-rtg-coach-power-save/);
  assert.match(ui,/choice.cardIds=choice.cardIds.includes\(key\)\?\[\]:\[key\]/);
  assert.doesNotMatch(ui,/coachMovePicker/);
  assert.doesNotMatch(ui,/localStorage\.setItem|firebase|indexedDB/i);
});

test("All Squad powers hide yellow card footer; selector matches slim RTG card border",()=>{
  const view=read("js/road-to-glory/rtg-squad-view-base.js");
  assert.match(view,/trailingMarkup: \x60\$\{legacyBadge/);
  assert.doesNotMatch(view,/rtg-coach-card-buff/);
  assert.match(view,/coachPreview:preview/); // projected PT, rarity and element remain available in detail
  const styles=read("css/rtg-coaches.css");
  assert.doesNotMatch(styles,/\.rtg-coach-card-buff\s*\{/);
  assert.match(styles,/border:2px solid var\(--rarity-border,#646464\)!important/);
  assert.doesNotMatch(styles,/border-left-width:4px!important/);
  assert.match(styles,/outline:2px solid #ffd21f/);
  const html=read("index.html");
  assert.match(html,/rtg-coaches\.css\?v=20261029-halloween-coach-contrast-v2/);
  assert.match(html,/rtg-squad-view\.js\?v=20261023-halftime-scroll-v2/);
});


test("Yi total transformation applies independent elements to every move of both starters",()=>{
  const m=match();
  m.userSquad.lineup=[
    {...player("a"),element:"mountain",overall:90,stats:{}},
    {...player("b"),element:"fire",overall:85,stats:{}},
    player("c"),
  ];
  const config={coachId:"4401",cardIds:["a","b"],targets:[
    {cardId:"a",element:"wind",moveIndices:[0,2]},
    {cardId:"b",element:"forest",moveIndices:[1,3]},
  ]};
  const squad={coachId:"4401",coachPowerSelection:config};
  assert.equal(rules.validConfig(squad,m.userSquad.lineup,"ie1",[]).targets.length,2);
  const transformed=rules.applyToMatch(m,squad,{coachOwnedIds:["4401"]});
  assert.equal(transformed.userSquad.lineup[0].element,"wind");
  assert.equal(transformed.userSquad.lineup[1].element,"forest");
  assert.equal(m.userSquad.lineup[0].element,"mountain");
  assert.equal(m.userSquad.lineup[1].element,"fire");
  assert.equal(transformed.coachPowerEffect.targets.length,2);
  const a=pt.compatible(transformed,"user","a","shot");
  const b=pt.compatible(transformed,"user","b","shot");
  assert.equal(a[0].element,"wind");
  assert.equal(a[2].element,"wind");
  assert.equal(a[1].element,"wind");
  assert.equal(b[1].element,"forest");
  assert.equal(b[3].element,"forest");
  assert.equal(b[0].element,"forest");
  assert.deepEqual(Array.from(a.map(x=>x.ptCost)),[40,75,52,101]);
  assert.deepEqual(Array.from(b.map(x=>x.ptCost)),[40,75,52,101]);
  assert.equal(rules.moveElement(transformed,"opponent","a",0,"fire"),"fire");
  assert.equal(rules.moveElement(transformed,"user","a",1,"fire"),"wind");
  assert.equal(transformed.ptCurrentByPlayerId["user:a"],m.ptCurrentByPlayerId["user:a"]);
  assert.equal(rules.applyToMatch(transformed,squad,{coachOwnedIds:["4401"]}),transformed);
  const invalid=(targets,cardIds=["a","b"])=>rules.validConfig({
    coachId:"4401",coachPowerSelection:{coachId:"4401",cardIds,targets},
  },m.userSquad.lineup,"ie1",[]);
  assert.equal(invalid([config.targets[0]]),null);
  assert.equal(invalid([
    {...config.targets[0],element:"mountain"},config.targets[1],
  ]),null);
  assert.deepEqual(Array.from(invalid([
    {...config.targets[0],moveIndices:[0,0]},config.targets[1],
  ]).targets[0].moveIndices),[0,1,2,3]);
  assert.equal(invalid([
    config.targets[0],{...config.targets[1],cardId:"a"},
  ]),null);
  assert.deepEqual(Array.from(invalid([
    config.targets[0],{...config.targets[1],moveIndices:[1]},
  ]).targets[1].moveIndices),[0,1,2,3]);
  const missingCoach={coachOwnedIds:[]};
  assert.equal(rules.applyToMatch(m,squad,missingCoach),m);
});
test("Yi double choice persists in canonical optional Squad config without changing other powers",()=>{
  const state=read("js/road-to-glory/rtg-state.js");
  assert.match(state,/targets:Array\.isArray\(squad\.coachPowerSelection\.targets\)/);
  assert.match(state,/moveIndices:Array\.from\(new Set/);
  const ui=read("js/road-to-glory/rtg-coach-powers-squad-ui.js");
  assert.match(ui,/TRASFORMAZIONE TOTALE/);
  assert.match(ui,/availableMoveIndices/);
  assert.match(ui,/choice\.targets\.length<2/);
  assert.match(ui,/targets:choice\.targets\.map/);
  assert.doesNotMatch(ui,/rtg-coach-yi-all-moves|MOSSE DISPONIBILI/);
  const preview=read("js/road-to-glory/rtg-coach-powers-preview.js");
  assert.match(preview,/details\.moveElements/);
  assert.match(preview,/rtg-coach-move-transformed/);
  const matchSource=read("js/road-to-glory/rtg-match-pt-runtime.js");
  assert.match(matchSource,/moveElement\?\.\(state,side,pid,index,m\.element\)/);
  const catalog=read("js/road-to-glory/rtg-coaches.js");
  assert.match(catalog,/powerName:"Trasformazione totale"/);
  assert.doesNotMatch(ui,/localStorage\.setItem|firebase|indexedDB/i);
});
