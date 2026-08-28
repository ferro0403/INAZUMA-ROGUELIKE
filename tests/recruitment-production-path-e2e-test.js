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
  const run={runId:"r",seasonId:"legacy",formationId:"4-3-3",roster:["one","two","out"].map(playerId=>({playerId,source:"legacy",level:1,equippedItem:null})),bench:["out"],lineup:["one","two"],inventory:[],fiveVFive:{formation:"x",lineup:{GK:"one",DF:"two",FW:"out"}},statistics:{actions:[]},bossIndex:0,currentZone:{seed:"seed",nodes:[],edges:[]}}; canonical=structuredClone(run);
  const c={console,structuredClone,URLSearchParams,location:{search:""},document,fetch:()=>new Promise(()=>{}),setTimeout:(fn)=>0,requestAnimationFrame:(fn)=>fn(),globalThis:null,__INAZUMA_TEST_MODE__:testMode,SEASON1_CONFIG:{maxRoster:3,maxInventory:2,itemPool:[],nodeLabels:{pull_free_agents:{label:"Pull"}},categoryRanks:{Normale:1},legendaryCategories:[]},
    SeasonRegistry:{DEFAULT_SEASON_ID:"legacy",setActive:id=>({id}),loadDatabase:()=>new Promise(()=>{}),get:id=>({id}),database:()=>db,isSeasonSource:()=>false,sourceForSeason:()=>"legacy",player:id=>db.players.find(x=>x.playerId===id)},
    RunState:{normalizeTeamIdentity:(identity)=>identity||{name:"Test"},save(next){saves++;if(fail){const code=fail;fail=null;const e=Object.assign(new Error(code),{code});throw e;}canonical=structuredClone(next);},load(){return structuredClone(canonical);},touch(){},loadProfile(){return{preferences:{smartAutoLineup:false}}}},
    GameplayPersistence:null,RecruitmentPoolRuntime:{choiceDatabase:(src,season,free)=>src==="legacy"?season:free,canonicalPlayerId:p=>String(p.playerId),candidateKey:p=>String(p.profileId||p.playerId),eligible:()=>true,isSeasonProfileCandidate:p=>Boolean(p.profileId)},DraftEngine:{randomFromSeed:()=>()=>0.1,selectCandidates:(a)=>a.slice(0,3),selectWeightedCandidates:(a)=>a.slice(0,3),shuffle:a=>a.slice()},MapEngine:{ensureCurrentZone:()=>({generated:false}),reachableNodeIds:()=>[],completeNode(zone,id){const n=zone.nodes.find(x=>x.id===id);n.completed=true;(zone.completedNodeIds||=[]);if(!zone.completedNodeIds.includes(id))zone.completedNodeIds.push(id);}},RoguelikeRules:{isProfileAwareRosterEntry:()=>false,applyEquipment:s=>s,removeUnavailable:()=>{},resolveDevelopmentEffectiveMetadata:p=>p,unlockedPullLevel:()=>2},InazumaProgression:{getPlayerAtLevel:p=>({...p})},DevelopmentRuntime:{resolvePlayer:(_r,p)=>({...p}),resolveRosterPlayer:(_r,p)=>({...p}),resolveEffectiveMetadata:(_r,p)=>({...p}),rosterEntryPermanentFields:()=>({})},LevelProgression:{formatLevel:e=>String(e.level)},FiveVFive:{removeUnavailable(r){const ids=new Set(r.roster.map(x=>x.playerId));for(const k in r.fiveVFive.lineup)if(!ids.has(r.fiveVFive.lineup[k]))r.fiveVFive.lineup[k]=null;},formationById:()=>null,assign:()=>{},ensure:()=>{},validate:()=>({})},SmartLineup:{optimizeLineupsForNewPlayer:()=>({elevenChanged:false,fiveChanged:false})},RunStatistics:{ACTIONS:{PLAYER_RECRUITED:"PLAYER_RECRUITED",PULL_OPENED:"PULL_OPENED",NODE_COMPLETED:"NODE_COMPLETED"},recordRunAction(r,type,o){r.statistics.actions.push({type,actionId:o.actionId});}},AlbumProgress:{unlockPlayer(id){album.push(id);}},PersistenceBootstrapGate:{ready:new Promise(()=>{})},PermanentEffects:{enqueueAlbum(r,e){(r.permanentEffectOutbox||=[]).push(e);},drain(){return{};}},DevelopmentV2:{DEVELOPMENT_RESOURCE_ASSETS:{coins:"",shards:""},optionsFromUpgrade:()=>({})}};
  c.globalThis=c; c.window=c; c.history={}; c.matchMedia=()=>({matches:false}); vm.createContext(c); for(const file of ["js/gameplay-persistence.js","js/app.js"])vm.runInContext(fs.readFileSync(file,"utf8"),c);
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

// Profile-aware production wiring: real showNextBossReward -> showPlayerOffer ->
// recruitPlayer -> replacement -> BossGameOverRuntime metadata -> reward advance.
function profileHarness() {
  const h = makeContext();
  for (const file of ["js/profiled-season.js", "js/boss-gameover-runtime.js", "js/special-match.js"]) vm.runInContext(fs.readFileSync(file, "utf8"), h.c);
  h.db.seasonId = "ie1_s2"; h.db.requiresProfileAwareRuntime = true;
  h.db.players.push({ ...h.db.players[3], playerId: "next", name: "next" });
  h.db.bossOrder = [{ teamId: "alpine", teamName: "Alpine", rewardLevel: 2, rewardPoolProfileIds: ["new-profile", "next-profile"] }];
  h.db.profiles = h.db.players.map((player) => ({ profileId: `${player.playerId}-profile`, playerId: player.playerId, profileRank: 1, defaultRoleVariantId: "df", roleVariants: [] }));
  h.c.ProfiledSeasonRuntime.register(h.db.seasonId, h.db);
  h.run.seasonId = h.db.seasonId;
  h.run.roster.forEach((entry) => { entry.source = h.db.seasonId; entry.activeProfileId = `${entry.playerId}-profile`; entry.activeRoleVariantId = "df"; entry.levelUnits = 0; });
  h.run.postBossFlow = { status: "reward", bossIndex: 0, matchNodeId: "boss-1", remainingRewards: 2, rewardNumber: 1, excludedIds: [], candidateIds: ["new-profile"], rerolls: 0 };
  h.run.pendingBossVictory = { rewardsRemaining: 2, excludedIds: [], candidateIds: ["new-profile"], rerolls: 0 };
  h.c.RoguelikeRules.defeatedBossRewardLevel = () => 2;
  h.c.RunStatistics.ACTIONS.BOSS_REWARD_CHOSEN = "BOSS_REWARD_CHOSEN";
  h.c.BossGameOverRuntime = h.c.BossGameOverRuntime;
  h.c.__INAZUMA_RECRUITMENT_TEST__.setContext({ run: h.run, seasonDb: h.db, freeAgentsDb: { players: h.db.players } });
  return h;
}
function confirmCurrentOffer(h, candidateKey = "new") {
  const option = h.modal.children.find((item) => item.dataset.playerId === "new");
  const confirm = h.modal.children.find((item) => item.dataset.pullAction === "confirm");
  assert(option && confirm, "production offer controls available");
  option.dataset.candidateKey = candidateKey; confirm.option = option; h.modal.fire(confirm);
}
{
  const h = profileHarness(); h.c.__INAZUMA_RECRUITMENT_TEST__.showNextBossReward(); confirmCurrentOffer(h, "new");
  assert(h.document.getElementById("cancel-recruit"), "profile-aware roster-full opened real replacement modal");
  assert(h.run.roster.some((entry) => entry.playerId === "out")); assert.strictEqual(h.run.postBossFlow.remainingRewards, 2);
  const reserve = h.modal.querySelectorAll(".bench-replacement-grid [data-player-id]").find((item) => item.dataset.playerId === "out"); reserve.click();
  const loaded = h.c.RunState.load(); assert(loaded.roster.some((entry) => entry.playerId === "new")); assert(!loaded.roster.some((entry) => entry.playerId === "out"));
  assert.strictEqual(loaded.postBossFlow.remainingRewards, 1); assert.strictEqual(loaded.statistics.actions.filter((a) => a.type === "PLAYER_RECRUITED").length, 1); assert.strictEqual(loaded.statistics.actions.filter((a) => a.type === "BOSS_REWARD_CHOSEN").length, 1); assert.strictEqual(loaded.permanentEffectOutbox.length, 1);
}
// Real boss cancel callback re-enters showNextBossReward; a subsequent real attempt succeeds.
{
  const h = profileHarness(), before = structuredClone(h.run.roster); h.c.__INAZUMA_RECRUITMENT_TEST__.showNextBossReward(); confirmCurrentOffer(h, "new"); h.document.getElementById("cancel-recruit").click();
  assert.deepStrictEqual(h.run.roster, before); assert.strictEqual(h.run.postBossFlow.remainingRewards, 2); assert(h.modal.children.some((item) => item.dataset.playerId === "new"), "same reward offer reopened");
  confirmCurrentOffer(h, "new"); h.modal.querySelectorAll(".bench-replacement-grid [data-player-id]").find((item) => item.dataset.playerId === "out").click(); assert(h.c.RunState.load().roster.some((entry) => entry.playerId === "new"));
}
console.log("recruitment production path profile-aware boss P1/P1b passed");

// P3/P3b: real openPull recovery reconstructs the production modal after a one-shot
// save failure, then the same candidate can complete full-roster replacement and node.
{
  const h=makeContext(); vm.runInContext(fs.readFileSync("js/boss-gameover-runtime.js","utf8"),h.c); h.db.bossOrder=[{teamId:"boss",teamName:"Boss"}]; const node={id:"pull-1",type:"pull_free_agents",layer:1,pullState:{pullType:"pull_free_agents",rerolls:0,excludedCandidateIds:[],luckyCharmUsed:false,candidateIds:[]},completed:false}; Object.assign(h.run,{lives:2,teamIdentity:{name:"Test"}}); Object.assign(h.run.currentZone,{nodes:[node],completedNodeIds:[],currentNodeId:"start",path:["start"],edges:[]});
  h.c.__INAZUMA_RECRUITMENT_TEST__.openPull(node,"pull_free_agents",{}); confirmCurrentOffer(h,"new"); h.setFail("stale-write");
  const firstReserve=h.modal.querySelectorAll(".bench-replacement-grid [data-player-id]").find(x=>x.dataset.playerId==="out"); firstReserve.click();
  let failedCanonical=h.c.RunState.load(); assert(!failedCanonical.roster.some(x=>x.playerId==="new")); assert.strictEqual(failedCanonical.currentZone.nodes.find(x=>x.id==="pull-1").completed,false); assert(h.modal.children.some(x=>x.dataset.playerId==="new"),"openPull rebuilt valid candidates");
  confirmCurrentOffer(h,"new"); h.modal.querySelectorAll(".bench-replacement-grid [data-player-id]").find(x=>x.dataset.playerId==="out").click();
  const loaded=h.c.RunState.load(); assert(loaded.roster.some(x=>x.playerId==="new")); assert(!loaded.roster.some(x=>x.playerId==="out")); assert.strictEqual(loaded.statistics.actions.filter(a=>a.type==="PLAYER_RECRUITED").length,1); assert.strictEqual(loaded.permanentEffectOutbox.length,1); assert.strictEqual(loaded.currentZone.nodes.find(x=>x.id==="pull-1").completed,true); assert.strictEqual(loaded.statistics.actions.filter(a=>a.type==="NODE_COMPLETED").length,1);
}
console.log("recruitment production path normal pull P3/P3b passed");

// P4: real showSpecialMatchReward -> recruitPlayer -> replacement -> transactionMutate
// invokes the real SpecialMatchRuntime completion in the same canonical commit.
{
  const h=profileHarness(); h.db.specialMatches=[{specialMatchId:"special-1",teamId:"alpine",matchLevel:2,reward:{guaranteedProfileId:"new-profile",teamPullPoolProfileIds:["new-profile"]}}];
  h.run.claimedSpecialMatchRewardIds=[]; h.run.pendingSpecialMatchReward={specialMatchId:"special-1",nodeId:"special-node",teamId:"alpine",totalRewards:1,currentReward:1,candidateProfileIds:["new-profile"],selectedProfileId:"new-profile",excludedPlayerIds:[],status:"pending",actionId:"r:special-1:reward"}; h.c.__INAZUMA_RECRUITMENT_TEST__.setContext({run:h.run,seasonDb:h.db}); h.c.RunState.save(h.run);
  h.c.__INAZUMA_RECRUITMENT_TEST__.showSpecialMatchReward(); h.document.getElementById("claim-special-reward").click(); assert(h.document.getElementById("cancel-recruit")); h.setFail("QuotaExceededError");
  h.modal.querySelectorAll(".bench-replacement-grid [data-player-id]").find(x=>x.dataset.playerId==="out").click(); let loaded=h.c.RunState.load(); assert(loaded.roster.some(x=>x.playerId==="out")); assert(!loaded.roster.some(x=>x.playerId==="new")); assert(loaded.pendingSpecialMatchReward); assert.deepStrictEqual(loaded.claimedSpecialMatchRewardIds,[]); assert.strictEqual(loaded.statistics.actions.length,0);
  // Recovery rebuilt the real special reward UI. Retry succeeds from canonical state.
  h.document.getElementById("claim-special-reward").click(); h.modal.querySelectorAll(".bench-replacement-grid [data-player-id]").find(x=>x.dataset.playerId==="out").click(); loaded=h.c.RunState.load(); assert(loaded.roster.some(x=>x.playerId==="new")); assert(!loaded.roster.some(x=>x.playerId==="out")); assert.strictEqual(loaded.pendingSpecialMatchReward,null); assert.deepStrictEqual(loaded.claimedSpecialMatchRewardIds,["special-1"]); assert.strictEqual(loaded.statistics.actions.filter(a=>a.type==="PLAYER_RECRUITED").length,1); assert.strictEqual(loaded.permanentEffectOutbox.length,1);
}
// P4 cancel uses the real replacement callback and returns to a usable special reward UI.
{
  const h=profileHarness(); h.db.specialMatches=[{specialMatchId:"special-1",teamId:"alpine",matchLevel:2,reward:{guaranteedProfileId:"new-profile",teamPullPoolProfileIds:["new-profile"]}}]; h.run.claimedSpecialMatchRewardIds=[]; h.run.pendingSpecialMatchReward={specialMatchId:"special-1",totalRewards:1,currentReward:1,candidateProfileIds:["new-profile"],selectedProfileId:"new-profile",excludedPlayerIds:[],status:"pending",actionId:"special:cancel"}; h.c.__INAZUMA_RECRUITMENT_TEST__.setContext({run:h.run,seasonDb:h.db}); h.c.RunState.save(h.run); const before=structuredClone(h.run.roster);
  h.c.__INAZUMA_RECRUITMENT_TEST__.showSpecialMatchReward(); h.document.getElementById("claim-special-reward").click(); h.document.getElementById("cancel-recruit").click(); assert.deepStrictEqual(h.run.roster,before); assert(h.run.pendingSpecialMatchReward); assert(h.document.getElementById("claim-special-reward"));
}
console.log("recruitment production path special reward P4 failure/retry/cancel passed");
