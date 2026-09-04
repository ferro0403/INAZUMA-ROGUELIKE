"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

function realFiveVFive() {
  const c = { globalThis: null }; c.globalThis = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync("js/five-v-five.js", "utf8"), c, { filename: "five-v-five.js" });
  return c.FiveVFive;
}

const players = [
  ["gk1","GK"],["gk2","GK"],["df1","DF"],["df2","DF"],["mf1","MF"],["mf2","MF"],["mf3","MF"],["fw1","FW"],["fw2","FW"],
  ["df3","DF"],["mf4","MF"]
].map(([playerId, position], i) => ({ playerId, name: playerId, position, category: "Normale", overall: 60 + i, finalOverall: 60 + i, stats: {} }));
const elevenRoles = ["GK","DF","DF","DF","MF","MF","MF","MF","FW","FW","FW"];
const seasonDb = {
  seasonId: "ie1", players,
  formations: { eleven: [{ id: "4-4-2", requirements: { GK: 1, DF: 3, MF: 4, FW: 3 }, slotRoles: elevenRoles }] },
  bossOrder: [{ teamId: "boss", teamName: "Boss", bossFormation: "4-4-2", bossLevel: 1, startingXIPlayerIds: players.slice(0,11).map(p=>p.playerId) }],
};
function zone() { return { bossIndex:0,bossId:"boss",seed:"z",currentNodeId:"start",startNodeId:"start",pendingNodeId:null,completedNodeIds:["start"],path:["start"],nodes:[{id:"start",type:"start",layer:0},{id:"five-node",type:"five_v_five",layer:1}],edges:[["start","five-node"]] }; }
function fiveState(incomplete=false) { return { formation:"1-2-1", slots:{ FW:"fw1", MF1:"mf1", MF2: incomplete ? null : "mf2", DF:"df1", GK:"gk1" } }; }
function activeMatch() { return { matchId:"legacy-five-stable",type:"five_v_five",nodeId:"five-node",previousNodeId:"start",state:"pre-match",result:null,log:[],score:[0,0],opponentFormation:"1-2-1",opponents:[{slotKey:"FW",playerId:"o1"},{slotKey:"MF1",playerId:"o2"},{slotKey:"MF2",playerId:"o3"},{slotKey:"DF",playerId:"o4"},{slotKey:"GK",playerId:"o5"}],simulation:{state:"pre-match",seed:"seed-five",timeline:[],score:{user:0,opponent:0},displayedScore:{user:0,opponent:0},revealedCount:0,resolutionApplied:false} }; }
function runFor({phase="five", incomplete=false, match=null}={}) { return { version:2,runId:"five-hardening",seasonId:"ie1",phase,lives:2,gameOver:false,bossIndex:0,consecutiveLosses:0,completedBossIds:[],unlockedTeamIds:[],completedSpecialMatchIds:[],claimedSpecialMatchRewardIds:[],unlockedSpecialTeamIds:[],permanentEffectOutbox:[],roster:players.map(p=>({playerId:p.playerId,source:"ie1",level:0})),lineup:players.slice(0,11).map(p=>p.playerId),bench:[],inventory:[],formationId:"4-4-2",fiveVFive:fiveState(incomplete),teamIdentity:{name:"Raimon"},statistics:{},teamLevel:0,currentZone:zone(),activeMatch:match}; }
function harness(opts={}) {
  const storage = new BudgetStorage(Infinity);
  const FiveVFive = realFiveVFive();
  const fetch = async () => ({ok:false,json:async()=>({})});
  const rt = load(storage,{run:runFor(opts),seasonDb,contextOverrides:{FiveVFive,fetch}});
  rt.context.MapEngine.normalizeSpecialMatchNode=()=>false;
  rt.context.RoguelikeRules.migrateDefeatedBossPlayerLevels=()=>false;
  rt.context.RoguelikeRules.isProfileAwareRosterEntry=()=>false;
  rt.context.SeasonRegistry.player=id=>players.find(p=>p.playerId===String(id));
  rt.context.FiveFormationFloatingPicker={prepare(){},close(){}};
  return {storage,rt};
}
function failNextSave(rt,name="QuotaExceededError") {
  const real = rt.context.RunState.save.bind(rt.context.RunState); let attempts=0;
  rt.context.RunState.save=(value,options)=>{ attempts++; const e=new Error(name); e.name=name; throw e; };
  return {restore(){rt.context.RunState.save=real;}, attempts:()=>attempts};
}

(async()=>{
  // Presentation-only renderer: real validate/normalize is confined to a clone.
  {
    const {rt}=harness({phase:"five",incomplete:true});
    const liveBefore=structuredClone(rt.seam.getRun()); const canonicalBefore=structuredClone(rt.canonical);
    const realSave=rt.context.RunState.save.bind(rt.context.RunState); let writes=0;
    rt.context.RunState.save=(v,o)=>{writes++;return realSave(v,o);};
    rt.seam.renderFiveVFive({persist:false});
    assert.equal(writes,0,"read-only five renderer must not save");
    assert.deepEqual(rt.seam.getRun(),liveBefore,"read-only five renderer must not mutate live run");
    assert.deepEqual(rt.canonical,canonicalBefore,"read-only five renderer must not mutate canonical run");
  }

  // Explicit editor entry persists autoFill before UI, in one transaction.
  {
    const {rt}=harness({phase:"squad",incomplete:true});
    const realSave=rt.context.RunState.save.bind(rt.context.RunState); let writes=0;
    rt.context.RunState.save=(v,o)=>{writes++;return realSave(v,o);};
    const result=rt.seam.openFiveVFiveEditor();
    assert.equal(result.ok,true); assert.equal(writes,1); assert.equal(rt.canonical.phase,"five");
    assert.ok(rt.canonical.fiveVFive.slots.MF2,"autoFill must be canonical before editor render");
  }

  // Re-render of already canonical phase=five performs no RunState.save and no drift.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    const before=structuredClone(rt.canonical); const realSave=rt.context.RunState.save.bind(rt.context.RunState); let writes=0;
    rt.context.RunState.save=(v,o)=>{writes++;return realSave(v,o);};
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true});
    assert.equal(writes,0); assert.deepEqual(rt.canonical,before); assert.equal(rt.canonical.activeMatch.matchId,"legacy-five-stable");
  }

  // Clear-slot failure: one failed write, canonical and live rollback.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    rt.seam.getUi().fiveVFiveSelectedSlot="MF1"; rt.seam.renderFiveVFive({persist:false,returnToMatch:true});
    const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    rt.context.document.getElementById("clear-five-slot").click();
    assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before); assert.match(rt.seam.getAppMarkup(),/SALVATAGGIO NON RIUSCITO/);
  }

  // Save formation failure (including ensure/autofill) rolls back.
  {
    const {rt}=harness({phase:"five",incomplete:true,match:activeMatch()});
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    rt.context.document.getElementById("save-five").click();
    assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before);
  }

  // Formation change failure through the real UI binding.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    const formationButton=rt.context.document.getElementById("formation-1-1-2"); formationButton.dataset.fiveFormation="1-1-2";
    const originalAll=rt.context.document.querySelectorAll.bind(rt.context.document);
    rt.context.document.querySelectorAll=(selector)=>selector==="[data-five-formation]"?[formationButton]:originalAll(selector);
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    formationButton.click(); assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before);
  }

  // Assign failure via selector event uses current canonical run, not captured run.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    rt.seam.getUi().fiveVFiveSelectedSlot="MF1";
    const selector=rt.context.document.getElementById("controlled-five-selector"); selector.dataset.fivePlayer="mf3"; selector.disabled=false; selector.contains=()=>true;
    selector.closest=(query)=>query==="[data-five-player]"?selector:null;
    const originalQuery=rt.context.document.querySelector.bind(rt.context.document);
    rt.context.document.querySelector=(query)=>query===".five-selector"?selector:originalQuery(query);
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    selector.click(); assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before);
  }

  // Return success preserves frozen identity/snapshot and commits phase exactly once.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const frozen=structuredClone(rt.canonical.activeMatch);
    const realSave=rt.context.RunState.save.bind(rt.context.RunState); let writes=0; rt.context.RunState.save=(v,o)=>{writes++;return realSave(v,o);};
    rt.context.document.getElementById("back-five-match").click();
    assert.equal(writes,1); assert.equal(rt.canonical.phase,"match"); assert.equal(rt.canonical.activeMatch.matchId,frozen.matchId);
    assert.equal(rt.canonical.activeMatch.simulation.seed,frozen.simulation.seed); assert.deepEqual(rt.canonical.activeMatch.simulation,frozen.simulation);
  }

  // Return failure is fail-stop; retry through canonical resume works without reload.
  {
    const {rt}=harness({phase:"five",incomplete:false,match:activeMatch()});
    rt.seam.renderFiveVFive({persist:false,returnToMatch:true}); const before=structuredClone(rt.canonical); const failure=failNextSave(rt);
    rt.context.document.getElementById("back-five-match").click(); assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.equal(rt.canonical.phase,"five"); assert.match(rt.seam.getAppMarkup(),/SALVATAGGIO NON RIUSCITO/);
    failure.restore(); await rt.seam.resumeRun(); assert.equal(rt.canonical.phase,"five"); assert.equal(rt.canonical.activeMatch.matchId,before.activeMatch.matchId);
  }

  // Quick swap failure from match is rollback-only; picker success UI never runs.
  {
    const {rt}=harness({phase:"match",incomplete:false,match:activeMatch()});
    rt.seam.getUi().bossMatchState="pre-match";
    const field=rt.context.document.getElementById("controlled-five-field"); const picker=rt.context.document.getElementById("controlled-five-picker");
    picker.dataset.fivePlayer="mf3"; picker.disabled=false; picker.contains=()=>true; picker.closest=(q)=>q==="[data-five-player]"?picker:null;
    field.insertAdjacentHTML=()=>{}; field.querySelector=(q)=>q===".five-selector"?picker:null;
    const originalQuery=rt.context.document.querySelector.bind(rt.context.document);
    rt.context.document.querySelector=(q)=>q===".five-match-mobile-field"?field:originalQuery(q);
    assert.equal(rt.seam.openFiveMatchPlayerSwap("MF1",rt.seam.getRun().activeMatch),true);
    const before=structuredClone(rt.canonical); const failure=failNextSave(rt); picker.click();
    assert.equal(failure.attempts(),1); assert.deepEqual(rt.canonical,before); assert.deepEqual(rt.seam.getRun(),before); assert.match(rt.seam.getAppMarkup(),/SALVATAGGIO NON RIUSCITO/);
  }

  console.log("five cycle final hardening: real FiveVFive, read-only rendering, atomic editor operations and rollback OK");
})().catch(e=>{console.error(e);process.exitCode=1;});
