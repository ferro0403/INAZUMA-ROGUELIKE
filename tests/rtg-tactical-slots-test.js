"use strict";
const assert=require("assert"),fs=require("fs"),vm=require("vm");
const c={globalThis:null,Object,Array,String,Number,Math,Set,Map,JSON,Promise,Error,TypeError};
c.globalThis=c;vm.createContext(c);
for(const file of [
  "rtg-config.js","rtg-card-identity.js","rtg-state.js","rtg-squad-runtime.js",
  "rtg-rng.js","rtg-encounter-runtime.js","rtg-ai-policy.js",
  "rtg-penalty-runtime.js","rtg-match-engine.js","rtg-squad-view-base.js"
])vm.runInContext(fs.readFileSync("js/road-to-glory/"+file,"utf8"),c,{filename:file});

const formation=c.RoadToGloryConfig.SEASON1.formations.find(f=>f.id==="4-3-3");
const playerIds=Array.from({length:15},(_,i)=>"tactical"+i);
const cardIds=playerIds.map(c.RoadToGloryCardIdentity.cardIdForFreeAgent);
const resolveAtLevel20=(cardId)=>({
  cardId,playerId:c.RoadToGloryCardIdentity.parse(cardId).playerId,
  normalizedRole:"MF",position:"MF",overall:70,attack:70,defense:70,
  physical:70,speed:70,control:70,stamina:70,grit:70,save:70
});
const squad={formationId:"4-3-3",lineup:cardIds.slice(0,11),bench:cardIds.slice(11),lineupOrderedBySlot:true,activeRoleVariantByCardId:{}};
const campaign={...c.RoadToGloryState.createInitial({campaignSeed:"tactical-test"}),squads:{ie1:squad}};
const normalized=c.RoadToGloryState.normalize(campaign);
assert.strictEqual(normalized.squads.ie1.lineupOrderedBySlot,true,"position order survives campaign normalization");
const validation=c.RoadToGlorySquadRuntime.validateSquad({
  state:normalized,freeAgentIds:playerIds,playerResolver:{resolveAtLevel20}
});
assert.strictEqual(validation.valid,true,"all midfielders can fill 4-3-3 tactical slots");

const view=c.RoadToGlorySquadView.create({escapeHtml:x=>String(x),playerResolver:{resolveAtLevel20}});
const model=view.renderModel({state:normalized,freeAgentIds:playerIds});
assert.deepStrictEqual(Array.from(model.lineupRows,row=>row.entries.length),[3,3,4,1]);
assert(model.lineupRows[0].entries.every(entry=>entry.tacticalRole==="FW"));
assert.strictEqual(model.lineupRows[3].entries[0].player.normalizedRole,"MF");
assert.strictEqual(model.lineupRows[3].entries[0].tacticalRole,"GK");

const matchPlayer=(cardId,position)=>({...resolveAtLevel20(cardId),tacticalRole:position});
const user={formationId:"4-3-3",lineup:cardIds.slice(0,11).map((id,i)=>matchPlayer(id,formation.slotRoles[i])),bench:[]};
const opponent={formationId:"4-3-3",lineup:cardIds.slice(0,11).map((id,i)=>matchPlayer("opp:"+id,formation.slotRoles[i])),bench:[]};
const match=c.RoadToGloryMatchEngine.createMatch({matchId:"tactical-save",userSquad:user,opponentSquad:opponent});
match.fieldZone="shot";match.possession="opponent";match.manualIndexes=[0];
const next=c.RoadToGloryMatchEngine.prepareNext(match);
assert(next.pendingEncounter&&next.pendingEncounter.userKind==="save");
assert.strictEqual(next.pendingEncounter.userPlayerId,cardIds[10],"goalkeeper slot performs saves regardless of natural MF role");
assert.strictEqual(next.userSquad.lineup[10].normalizedRole,"MF","natural player role must not change");

const duplicate=JSON.parse(JSON.stringify(normalized));duplicate.squads.ie1.bench[0]=duplicate.squads.ie1.lineup[0];
assert(c.RoadToGlorySquadRuntime.validateSquad({state:duplicate,freeAgentIds:playerIds,playerResolver:{resolveAtLevel20}}).reasons.includes("duplicate-card"));
const unowned=JSON.parse(JSON.stringify(normalized));unowned.squads.ie1.bench[0]="free_agents::not-owned";
assert(c.RoadToGlorySquadRuntime.validateSquad({state:unowned,freeAgentIds:playerIds,playerResolver:{resolveAtLevel20}}).reasons.includes("inaccessible-card"));
console.log("rtg-tactical-slots-test: PASS");
