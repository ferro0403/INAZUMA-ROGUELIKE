"use strict";
const assert=require("assert");
const BudgetStorage=require("./helpers/budget-storage");
const {load}=require("./helpers/production-runtime");

function baseRun(){return {version:2,runId:"dev-presentation",seasonId:"ie1",phase:"gameover",gameOver:true,lives:0,bossIndex:2,completedBossIds:["b1","b2"],consecutiveLosses:0,unlockedTeamIds:[],completedSpecialMatchIds:[],claimedSpecialMatchRewardIds:[],unlockedSpecialTeamIds:[],roster:[],lineup:[],bench:[],inventory:[],formationId:null,fiveVFive:null,currentZone:null,activeMatch:null,permanentEffectOutbox:[],teamIdentity:{name:"Raimon"}};}
function harness(){const storage=new BudgetStorage(Infinity);const run=baseRun();const rt=load(storage,{run,seasonDb:{seasonId:"ie1",players:[],formations:{eleven:[]},bossOrder:[]},contextOverrides:{DevelopmentAccountV3:{processRunEnd(){throw new Error("must not reapply an already-applied effect")},read(){return {redeemedRunIds:[run.runId]}}}}});rt.context.MapEngine.normalizeSpecialMatchNode=()=>false;rt.context.RoguelikeRules.migrateDefeatedBossPlayerLevels=()=>false;const live=rt.seam.getRun();const id=rt.context.PermanentEffects.developmentId(live,"gameover");live.permanentEffectOutbox=[{id,type:rt.context.PermanentEffects.TYPES.DEVELOPMENT,payload:{runId:live.runId,seasonId:live.seasonId,endReason:"gameover",defeatedBosses:2},status:"applied",createdAt:new Date().toISOString(),appliedAt:new Date().toISOString()}];rt.context.RunState.save(live);return rt;}
function failNext(rt){const real=rt.context.RunState.save.bind(rt.context.RunState);let attempts=0;rt.context.RunState.save=(v,o)=>{attempts++;const e=new Error("Quota exceeded");e.name="QuotaExceededError";throw e;};return{restore(){rt.context.RunState.save=real},attempts:()=>attempts};}

(async()=>{
  // Presentation creation failure does not navigate or alter canonical presentation; effect stays applied.
  {
    const rt=harness();let completed=0;const before=structuredClone(rt.canonical);const failure=failNext(rt);
    rt.seam.resolveDevelopmentEndRunFlow({endReason:"gameover",onComplete:()=>{completed++;}});
    assert.equal(failure.attempts(),1);assert.equal(completed,0);assert.equal(rt.canonical.developmentRewardPresentation,undefined);assert.equal(rt.canonical.permanentEffectOutbox[0].status,"applied");assert.match(rt.seam.getAppMarkup(),/FINALIZZAZIONE NON SALVATA/);
    failure.restore();rt.context.document.getElementById("retry-terminal-effect").click();assert.ok(rt.canonical.developmentRewardPresentation);assert.equal(rt.canonical.developmentRewardPresentation.seen,false);assert.match(rt.seam.getAppMarkup(),/RICOMPENSE RUN/);
  }

  // Seen failure blocks onComplete/navigation; retry then success persists seen exactly once.
  {
    const rt=harness();let completed=0;rt.seam.resolveDevelopmentEndRunFlow({endReason:"gameover",onComplete:()=>{completed++;}});assert.ok(rt.canonical.developmentRewardPresentation);
    const coinsSnapshot=JSON.stringify(rt.context.DevelopmentAccountV3.read());const failure=failNext(rt);
    rt.context.document.getElementById("development-reward-continue").click();assert.equal(failure.attempts(),1);assert.equal(completed,0);assert.equal(rt.canonical.developmentRewardPresentation.seen,false);assert.match(rt.seam.getAppMarkup(),/FINALIZZAZIONE NON SALVATA/);
    failure.restore();rt.context.document.getElementById("retry-terminal-effect").click();assert.match(rt.seam.getAppMarkup(),/RICOMPENSE RUN/);rt.context.document.getElementById("development-reward-continue").click();assert.equal(completed,1);assert.equal(rt.canonical.developmentRewardPresentation.seen,true);assert.equal(JSON.stringify(rt.context.DevelopmentAccountV3.read()),coinsSnapshot);
    for(let i=0;i<10;i++){const reopened=rt.reopen();reopened.context.MapEngine.normalizeSpecialMatchNode=()=>false;reopened.context.RoguelikeRules.migrateDefeatedBossPlayerLevels=()=>false;assert.equal(reopened.canonical.developmentRewardPresentation.seen,true);assert.equal(reopened.canonical.permanentEffectOutbox[0].status,"applied");}
  }
  console.log("development reward presentation: create/seen fail-stop, retry and stable applied effect OK");
})().catch(e=>{console.error(e);process.exitCode=1;});
