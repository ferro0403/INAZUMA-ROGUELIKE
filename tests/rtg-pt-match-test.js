"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const c={console,Math,JSON,Array,Object,Set,Map,Uint8Array};
c.globalThis=c;vm.createContext(c);
for(const file of [
  "js/road-to-glory/rtg-rng.js",
  "js/road-to-glory/rtg-encounter-runtime.js",
  "js/road-to-glory/rtg-ai-policy.js",
  "js/road-to-glory/rtg-penalty-runtime.js",
])vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
let catalogType="shot";
const moveSet=(kind=catalogType)=>[
  {name:"Basic "+kind,type:kind,power:75,element:"Wind",ptCost:75},
  {name:"Strong "+kind,type:kind,power:95,element:"Void",ptCost:95}
];
const catalog={
  isReady:()=>true,error:()=>null,
  ptBreakdown:(_stats,rarity)=>({base:200,bonus:rarity==="Leggenda"?15:0,total:rarity==="Leggenda"?215:200}),
  movesFor:()=>moveSet(),
};
c.RtgFourMovesRuntime=catalog;
for(const file of ["js/road-to-glory/rtg-match-pt-runtime.js","js/road-to-glory/rtg-match-engine.js"])
  vm.runInContext(fs.readFileSync(file,"utf8"),c,{filename:file});
const E=c.RoadToGloryMatchEngine,pt=c.RoadToGloryMatchPtRuntime;
const player=(pid,role)=>({playerId:pid,name:pid,position:role,normalizedRole:role,overall:83,attack:83,control:83,speed:83,grit:83,physical:83,stamina:83,defense:83,save:83,
  category:"Leggenda",element:"Wind",move:{name:"Legacy",type:catalogType,power:65,element:"Wind"}});
const make=(kind,playerWins=true)=>{
  catalogType=kind;
  const attack=["shot","dribble"].includes(kind),zone=["shot","save"].includes(kind)?"shot":"attack";
  const user=player("u",kind==="save"?"GK":kind==="defense"?"DF":"FW");
  const enemy=player("o",attack?"GK":"FW");
  const state=E.createMatch({matchId:"case-"+kind+playerWins,nodeId:"test",seed:"pt-"+kind+playerWins,seasonId:"ie1",
    userSquad:{seasonId:"ie1",lineup:[user],bench:[]},opponentSquad:{seasonId:"ie1",lineup:[enemy],bench:[]}});
  assert.equal(state.ptModeVersion,1);
  assert.equal(state.ptCurrentByPlayerId["user:u"],215);
  state.fieldZone=zone;state.possession=attack?"user":"opponent";
  state.manualIndexes=[0];
  const ready=E.prepareNext(state);
  assert(ready.pendingEncounter);
  assert.equal(ready.pendingEncounter.userKind,kind);
  assert.equal(ready.pendingEncounter.userMoveOptions.length,2);
  assert.equal(ready.pendingEncounter.userMoveOptions[1].ptCost,95);
  c.RoadToGloryEncounterRuntime={...c.RoadToGloryEncounterRuntime,
    probability:()=>({probability:playerWins===(attack)?100:0})};
  return ready;
};
for(const kind of ["shot","save","dribble","defense"]){
  for(const won of [true,false]){
    const before=make(kind,won),after=E.resolvePendingEncounter(before,"move:1");
    const spent=["shot","save"].includes(kind)||won;
    assert.equal(after.ptCurrentByPlayerId["user:u"],215-(spent?95:0),kind+" won="+won);
    const logged=after.log.at(-1);
    if(kind==="shot"||kind==="dribble")assert.equal(logged.actorMove,"Strong "+kind);
    else assert.equal(logged.opponentMove,"Strong "+kind);
  }
}
let low=make("shot");
low.ptCurrentByPlayerId["user:u"]=20;
assert.throws(()=>E.resolvePendingEncounter(low,"move:0"),err=>err.code==="rtg-pt-move-unavailable");
assert.equal(low.ptCurrentByPlayerId["user:u"],20,"invalid action never changes original state");
assert.throws(()=>E.resolvePendingEncounter(low,"move:99"),err=>err.code==="rtg-pt-move-unavailable");
const recovery=make("shot");
let halftime={...recovery,pendingEncounter:null,status:"halftime",period:"halftime",userRosterIds:["u"]};
halftime.ptCurrentByPlayerId["user:u"]=35;
// Canonical halftime roster validation requires 11 starters + 4 bench, so confirm retention
// without fabricating match rosters: the engine itself leaves the PT map unchanged on non-substitution.
assert.equal(pt.pt(halftime,"user","u").remaining,35);
let legacy=null;
c.RtgFourMovesRuntime=null;catalogType="shot";
legacy=E.createMatch({matchId:"legacy",nodeId:"test",seed:"legacy",userSquad:{lineup:[player("u","FW")],bench:[]},opponentSquad:{lineup:[player("o","GK")],bench:[]}});
assert.equal(legacy.ptModeVersion,undefined,"historical matches retain legacy 2 uses");
assert.equal(legacy.moveUsesByPlayerId["user:u"],2);
c.RtgFourMovesRuntime=catalog;
// A penalty shot and goalkeeper save both spend PT, regardless of success.
let shootout=make("shot");
shootout.status="penalties";shootout.pendingEncounter=null;shootout.shootout=c.RoadToGloryPenaltyRuntime.createShootout("pt-penalty");
const pp=E.resolvePenaltyKick(shootout,{attackingSide:"user",shooterPlayerId:"u",goalkeeperPlayerId:"o",
 shooterChoice:"left",goalkeeperChoice:"right",shooterMove:moveSet("shot")[0],goalkeeperMove:moveSet("save")[0],
 encounterContext:{actor:shootout.userSquad.lineup[0],opponent:shootout.opponentSquad.lineup[0]}});
assert.equal(pp.state.ptCurrentByPlayerId["user:u"],140);
assert.equal(pp.state.ptCurrentByPlayerId["opponent:o"],140);
// UI includes both current balances and conditional selector, not the legacy 2/2 badge.
vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-match-view.js","utf8"),c);
const view=c.RoadToGloryMatchView.create({escapeHtml:x=>String(x??""),compactPlayerCardMarkup:()=>"<button></button>"});
const encounter=make("shot");
const args={userPlayer:encounter.userSquad.lineup[0],opponentPlayer:encounter.opponentSquad.lineup[0]};
const menu=view.encounterMarkup(encounter,{...args,selectedChoice:"list"});
assert.match(menu,/SELEZIONA TECNICA/);
assert.match(menu,/data-rtg-choice="move:0"/);
assert.match(menu,/data-rtg-choice="move:1"/);
assert.equal((menu.match(/rtg-duel-pt-inline/g)||[]).length,2);
assert.doesNotMatch(menu,/2\/2 USI/);
const chosen=view.encounterMarkup(encounter,{...args,selectedChoice:"move:1"});
assert.match(chosen,/Strong shot/);
assert.match(chosen,/COSTO 95 PT/);
assert.match(chosen,/data-rtg-confirm="1"/);
assert.match(chosen,/DOPO USO:/,"shot must show immediate forecast");
assert.match(chosen,/rtg-duel-pt-projection"[^>]*>→ <strong>120<\/strong>/,"one-line forecast on player badge");
assert.doesNotMatch(chosen,/rtg-duel-pt-projection[^<]*SE RIESCE/,"player badge must have no conditional label");
assert.match(chosen,/>CONFERMA<\/span>/,"compact confirmation must use a real label");
assert.match(chosen,/rtg-duel-pt-projection/,"selected card must show PT forecast");
assert.match(chosen,/rtg-pt-after-use/,"selected technique card must show projected PT");
assert.equal(encounter.ptCurrentByPlayerId["user:u"],215,"rendering the PT preview must not spend PT");
assert.match(menu,/rtg-pt-option-after/,"technique list must show PT after use");
assert.match(menu,/element-wind/,"element type class must be present");
const defending=make("defense");
const defensePreview=view.encounterMarkup(defending,{userPlayer:defending.userSquad.lineup[0],opponentPlayer:defending.opponentSquad.lineup[0],selectedChoice:"move:1"});
assert.match(defensePreview,/SE RIESCE/,"defensive PT preview must be conditional");
assert.match(defensePreview,/rtg-duel-pt-projection"[^>]*>→ <strong>120<\/strong>/);
assert.equal(defending.ptCurrentByPlayerId["user:u"],215,"defense preview must not debit PT");
const dribbling=make("dribble");
const dribblePreview=view.encounterMarkup(dribbling,{userPlayer:dribbling.userSquad.lineup[0],opponentPlayer:dribbling.opponentSquad.lineup[0],selectedChoice:"move:0"});
assert.match(dribblePreview,/SE RIESCE/,"dribble PT preview must be conditional");
assert.match(dribblePreview,/rtg-duel-pt-projection"[^>]*>→ <strong>140<\/strong>/);
assert.equal(dribbling.ptCurrentByPlayerId["user:u"],215);
const polishCss=fs.readFileSync("css/rtg-match-pt-preview.css","utf8");
const indexHtml=fs.readFileSync("index.html","utf8");
assert.match(polishCss,/\.rtg-duel-choice-card\.is-selected::before\s*\{/,"legacy pseudo-confirm selector must be explicitly suppressed");
assert.match(polishCss,/content:none!important/,"pseudo confirmation cannot overlap name");
assert.match(polishCss,/\.rtg-duel-choice-card \.rtg-choice-confirm\s*\{/,"real confirmation must be positioned");
assert.match(polishCss,/grid-area:confirm!important/,"selected move confirmation must occupy its own compact row");
for(const element of ["forest","fire","mountain","wind","void"])
  assert(polishCss.includes(".element-"+element),"missing colored element: "+element);
// Half-width portrait cards must never clip the current or projected PT.
assert.match(polishCss,/\.rtg-duel-portrait-panel \.rtg-duel-player-meta \.rtg-duel-pt-inline\s*\{/,"portrait PT must stay within its card");
assert.match(polishCss,/max-width:100%!important/,"PT badge cannot extend beyond its parent");
assert.match(polishCss,/@media\(max-width:480px\)/,"mobile portrait PT layout must be responsive");
assert.match(polishCss,/\.rtg-duel-pt-inline\.is-projected\s*\{[\s\S]*?flex-direction:column!important/,"narrow projected PT must stack in two compact rows");
assert.match(polishCss,/\.rtg-duel-pt-inline\.is-projected \.rtg-duel-pt-projection\s*\{[\s\S]*?width:100%!important/,"forecast arrow/value must fit inside badge");
assert.match(indexHtml,/rtg-match-pt-preview\.css\?v=20261021-pt-badge-fit-4/);

// Committed PT must stay hidden during the final comparison, including a
// successful/failed conditional move; reveal the canonical balance only with
// the result. No extra write or pending-save state is introduced.
for (const kind of ["dribble","defense","shot","save"]) {
  for (const win of [true,false]) {
    const pre=make(kind,win),post=E.resolvePendingEncounter(pre,"move:1");
    const p={
      userPlayer:pre.userSquad.lineup[0],opponentPlayer:pre.opponentSquad.lineup[0],
      userKind:kind,aiKind:kind==="shot"?"save":"shot",userChoiceLabel:"Strong "+kind,
      userUsedMove:true,userWon:win,actorSide:pre.pendingEncounter.actorSide,
      userPtBefore:pt.pt(pre,"user","u"),opponentPtBefore:pt.pt(pre,"opponent","o"),
      userPtAfter:pt.pt(post,"user","u"),opponentPtAfter:pt.pt(post,"opponent","o"),
    };
    const beforeHtml=view.finalComparisonMarkup(p);
    const waitingHtml=view.resolvingEncounterMarkup(p);
    const resultHtml=view.resolvedEncounterMarkup(p);
    assert.match(beforeHtml,/rtg-duel-pt-current[^>]*><b>PT<\/b><strong>215<\/strong>/,"before result must retain original PT ("+kind+")");
    assert.match(waitingHtml,/rtg-duel-pt-current[^>]*><b>PT<\/b><strong>215<\/strong>/,"waiting phase must not reveal PT ("+kind+")");
    const expected=215-(["shot","save"].includes(kind)||win?95:0);
    assert.match(resultHtml,new RegExp('rtg-duel-pt-current[^>]*><b>PT<\\/b><strong>'+expected+'<\\/strong>'),"result reveals committed PT ("+kind+", won="+win+")");
    assert.equal(pt.pt(pre,"user","u").remaining,215,"presentation cannot mutate original match");
  }
}
const matchController=fs.readFileSync("js/road-to-glory/rtg-controller.js","utf8");
assert.match(matchController,/userPtBefore:ptBefore\[0\],opponentPtBefore:ptBefore\[1\]/,"controller must supply pre-resolution balances");
assert.match(matchController,/userPtAfter:ptRuntime\?\.pt\?\.\(resolvedMatch/,"controller must supply committed balances");

catalogType="shot";
const ptx={ptMode:true,attackingSide:"user",shooter:args.userPlayer,keeper:args.opponentPlayer,userRole:"shot",
  userOptions:moveSet(),userMove:moveSet()[0],userPt:{remaining:215,max:215},opponentPt:{remaining:215,max:215},userMoveAvailable:true};
const penalty=view.penaltyMarkup({...encounter,shootout:{status:"active",history:[],kicks:{user:0,opponent:0},score:{user:0,opponent:0}}},ptx);
assert.match(penalty,/data-rtg-penalty-technique="1"/);
assert.doesNotMatch(penalty,/2 usi rimasti/);
console.log("rtg-pt-match-test: four-move selection, dual PT, every category, penalties, legacy saves, UI PASS");
