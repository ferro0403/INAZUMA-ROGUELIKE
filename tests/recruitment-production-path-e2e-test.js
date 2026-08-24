const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

class El {
  constructor(attrs = {}) { this.dataset = attrs.dataset || {}; this.id = attrs.id || ""; this.disabled = false; this.handlers = {}; this.appendChild=()=>{}; this.classList = { add(){}, remove(){}, toggle(){} }; }
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  click() { for (const fn of this.handlers.click || []) fn({ currentTarget: this, target: this, preventDefault(){} }); }
  closest(selector) { if (selector.includes("[data-player-id]") && this.dataset.playerId) return this; if (selector.includes("[data-pull-action]") && this.dataset.pullAction) return this; if (selector.includes(".pull-choice-option")) return this.option || (this.dataset.candidateKey ? this : null); return null; }
  querySelector(){ return null; } querySelectorAll(){ return []; } setAttribute(){} getAttribute(){ return null; } removeAttribute(){} focus(){}
}
class Root extends El {
  constructor(doc) { super(); this.doc = doc; this._html = ""; this.children = []; this.firstElementChild = null; }
  set innerHTML(html) { this._html = html; this.children = []; this.doc.ids.clear();
    for (const match of html.matchAll(/<button[^>]*>/g)) { const tag=match[0], id=/id="([^"]+)"/.exec(tag)?.[1] || "", playerId=/data-player-id="([^"]+)"/.exec(tag)?.[1], candidateKey=/data-candidate-key="([^"]+)"/.exec(tag)?.[1], action=/data-pull-action="([^"]+)"/.exec(tag)?.[1], discard=/data-discard-item="([^"]+)"/.exec(tag)?.[1]; const el=new El({id,dataset:{}}); if(playerId)el.dataset.playerId=playerId;if(candidateKey)el.dataset.candidateKey=candidateKey;if(action)el.dataset.pullAction=action;if(discard)el.dataset.discardItem=discard; this.children.push(el); if(id)this.doc.ids.set(id,el); }
    this.firstElementChild = html ? new El() : null;
  }
  get innerHTML(){ return this._html; }
  querySelectorAll(selector) { if(selector.includes("data-player-id")) return this.children.filter(x=>x.dataset.playerId); if(selector.includes("data-discard-item"))return this.children.filter(x=>x.dataset.discardItem); if(selector.includes("button"))return this.children; return []; }
  fire(target) { for (const fn of this.handlers.click || []) fn({ target, currentTarget: this, preventDefault(){} }); }
  querySelector(selector){ if(selector.includes("data-pull-choice-grid")) return this; if(selector===".modal")return new El(); return null; }
}
function makeContext(testMode=true) {
  const document={createElement(){const e=new El();e.remove=()=>{};return e;},ids:new Map(),documentElement:new El(),body:new El(),activeElement:null,querySelectorAll(){return[];},querySelector(){return null;},getElementById(id){return this.ids.get(id)||null;}};
  const app=new Root(document), modal=new Root(document), toast=new Root(document); document.ids.set("app",app);document.ids.set("modal-root",modal);document.ids.set("toast-root",toast);
  let canonical=null, fail=null, saves=0; const album=[]; const db={seasonId:"legacy",requiresProfileAwareRuntime:false,formations:{eleven:[{id:"4-3-3",slotRoles:["GK","DF"]}]},players:[],profiles:[],teams:[],bossOrder:[]};
  const base=(id)=>({playerId:id,name:id,position:id==="one"?"GK":"DF",overall:70,finalOverall:70,stats:{attack:1,control:1,speed:1,grit:1,physical:1,stamina:1,defense:1,save:1},category:"Normale"}); db.players=[base("one"),base("two"),base("out"),base("new")];
  const run={runId:"r",seasonId:"legacy",formationId:"4-3-3",roster:["one","two","out"].map(playerId=>({playerId,source:"legacy",level:1,equippedItem:null})),bench:["out"],lineup:["one","two"],inventory:[],fiveVFive:{formation:"x",lineup:{GK:"one",DF:"two",FW:"out"}},statistics:{actions:[]}}; canonical=structuredClone(run);
  const c={console,structuredClone,URLSearchParams,location:{search:""},document,fetch:()=>new Promise(()=>{}),setTimeout:(fn)=>0,requestAnimationFrame:(fn)=>fn(),globalThis:null,__INAZUMA_TEST_MODE__:testMode,SEASON1_CONFIG:{maxRoster:3,maxInventory:2,itemPool:[],nodeLabels:{pull_free_agents:{label:"Pull"}},categoryRanks:{Normale:1},legendaryCategories:[]},
    SeasonRegistry:{DEFAULT_SEASON_ID:"legacy",setActive:id=>({id}),loadDatabase:()=>new Promise(()=>{}),get:id=>({id}),database:()=>db,isSeasonSource:()=>false,sourceForSeason:()=>"legacy",player:id=>db.players.find(x=>x.playerId===id)},
    RunState:{save(next){saves++;if(fail){const e=Object.assign(new Error(fail),{code:fail});throw e;}canonical=structuredClone(next);},load(){return structuredClone(canonical);},loadProfile(){return{preferences:{smartAutoLineup:false}}}},
    GameplayPersistence:null,RecruitmentPoolRuntime:{choiceDatabase:(src,season,free)=>src==="legacy"?season:free},RoguelikeRules:{isProfileAwareRosterEntry:()=>false,applyEquipment:s=>s,removeUnavailable:()=>{},resolveDevelopmentEffectiveMetadata:p=>p},InazumaProgression:{getPlayerAtLevel:p=>({...p})},LevelProgression:{formatLevel:e=>String(e.level)},FiveVFive:{removeUnavailable(r){const ids=new Set(r.roster.map(x=>x.playerId));for(const k in r.fiveVFive.lineup)if(!ids.has(r.fiveVFive.lineup[k]))r.fiveVFive.lineup[k]=null;},formationById:()=>null,assign:()=>{},ensure:()=>{},validate:()=>({})},SmartLineup:{optimizeLineupsForNewPlayer:()=>({elevenChanged:false,fiveChanged:false})},RunStatistics:{ACTIONS:{PLAYER_RECRUITED:"PLAYER_RECRUITED"},recordRunAction(r,type,o){r.statistics.actions.push({type,actionId:o.actionId});}},AlbumProgress:{unlockPlayer(id){album.push(id);}},PersistenceBootstrapGate:{ready:new Promise(()=>{})},PermanentEffects:{enqueueAlbum(r,e){(r.permanentEffectOutbox||=[]).push(e);},drain(){return{};}},DevelopmentV2:{DEVELOPMENT_RESOURCE_ASSETS:{coins:"",shards:""},optionsFromUpgrade:()=>({})}};
  c.globalThis=c; c.window=c; c.history={}; vm.createContext(c); for(const file of ["js/gameplay-persistence.js","js/app.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c);
  c.__INAZUMA_RECRUITMENT_TEST__?.setContext({run,seasonDb:db,freeAgentsDb:{players:db.players}});
  return {c,document,modal,run,db,album,setFail:x=>fail=x,get canonical(){return canonical},get saves(){return saves}};
}
// Strict gating: recruitment orchestrator is absent without the explicit flag.
{ const h=makeContext(false); assert.strictEqual(h.c.__INAZUMA_RECRUITMENT_TEST__,undefined); }

// Production recruitPlayer -> real replacement DOM -> real persistence -> committed callback.
{
  const h=makeContext(); const outcomes=[]; h.c.__INAZUMA_RECRUITMENT_TEST__.recruitPlayer(h.db.players[3],"legacy",2,r=>outcomes.push(r.status),{transactionMutate:r=>{r.callerMetadata=(r.callerMetadata||0)+1;}});
  assert.deepStrictEqual(outcomes,["needs-replacement"]); const out=h.modal.querySelectorAll(".bench-replacement-grid [data-player-id]").find(x=>x.dataset.playerId==="out"); assert(out); out.click();
  assert.deepStrictEqual(outcomes,["needs-replacement","committed-acquired"]); assert(h.canonical.roster.some(x=>x.playerId==="new")); assert(!h.canonical.roster.some(x=>x.playerId==="out")); assert.strictEqual(h.canonical.callerMetadata,1); assert.strictEqual(h.canonical.statistics.actions.length,1); assert.strictEqual(h.canonical.permanentEffectOutbox.length,1);
}
// Real cancel button executes the production handler without any canonical mutation.
{
  const h=makeContext(); const before=structuredClone(h.canonical), outcomes=[]; h.c.__INAZUMA_RECRUITMENT_TEST__.recruitPlayer(h.db.players[3],"legacy",2,r=>outcomes.push(r.status)); h.document.getElementById("cancel-recruit").click(); assert.deepStrictEqual(h.canonical,before); assert.deepStrictEqual(outcomes,["needs-replacement","cancelled"]); assert.strictEqual(h.saves,0);
}
// Real replacement persistence failures roll back and invoke recovery; retry uses canonical state.
for(const failure of ["stale-write","QuotaExceededError"]){ const h=makeContext(); const outcomes=[];let recover=0;h.setFail(failure);h.c.__INAZUMA_RECRUITMENT_TEST__.recruitPlayer(h.db.players[3],"legacy",2,r=>outcomes.push(r.status),{onRecover:()=>recover++});h.modal.querySelectorAll(".bench-replacement-grid [data-player-id]").find(x=>x.dataset.playerId==="out").click();assert(h.canonical.roster.some(x=>x.playerId==="out"));assert(!h.canonical.roster.some(x=>x.playerId==="new"));assert.strictEqual(h.canonical.statistics.actions.length,0);assert.strictEqual(recover,1);assert(outcomes.includes("persistence-failed")); }

// Real showPlayerOffer pickConfirmed guard rejects a second confirm event.
{
  const h=makeContext(); let picks=0; h.c.__INAZUMA_RECRUITMENT_TEST__.showPlayerOffer({title:"Pull",subtitle:"Pick",candidates:[h.db.players[3]],source:"legacy",database:h.db,level:2,onPick:()=>picks++,onSkip:()=>{},allowSkip:true});
  const option=h.modal.children.find(x=>x.dataset.playerId==="new"); const confirm=h.modal.children.find(x=>x.dataset.pullAction==="confirm"); option.dataset.candidateKey="new"; confirm.option=option; h.modal.fire(confirm); h.modal.fire(confirm); assert.strictEqual(picks,1);
}
console.log("recruitment production path E2E: gated hook, replacement, cancel, stale/quota rollback passed");
