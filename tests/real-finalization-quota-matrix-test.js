"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");
const ie2 = require("../data/IE2_season_compact.json");

function veteranProfile(target, hard = false) {
  const budget = 240_000, storage = new BudgetStorage(budget);
  const stores = {
    "inazuma.hallOfFame.v1": { teams: Array.from({length: 12}, (_,i) => ({ hallTeamId: `old-${i}`, roster: ["veteran"] })) },
    "inazuma.development.v2": { history: Array.from({length: 40}, (_,i) => ({ runId: `old-${i}` })), redeemedRunIds: [] },
    "inazuma.album.v1": { players: Array.from({length: 150}, (_,i) => `player-${i}`) },
    "inazuma.account.profile": { uid: "veteran", cloudAssociation: { revision: 77 } },
    "run_ie1": { runId: "old-ie1" }, "run_orion": { runId: "old-orion" }, "run_ie2.head": { generation: 8 }, "run_ie2.backup": { generation: 7 }
  };
  for (const [key,value] of Object.entries(stores)) storage.setItem(key, JSON.stringify(value));
  const wanted = Math.floor(budget * target); const remainingChars = Math.max(0, Math.floor((wanted - storage.bytes()) / 2) - 20);
  storage.setItem("run_ie2.technical.safe", "x".repeat(remainingChars));
  const run = { runId: `quota-${target}`, seasonId: "ie2", lives: 2, bossIndex: ie2.bossOrder.length - 1, phase: "match", completedBossIds: ie2.bossOrder.slice(0,-1).map(x=>x.teamId), unlockedTeamIds: [], inventory: [], roster: [], lineup: [], bench: [], formationId: "4-3-3", teamIdentity: { name: "Veterans" }, statistics: {}, currentZone: { nodes: [{id:"final",type:"boss"}], completedNodeIds: [] }, activeMatch: { matchId: `final-${target}`, type:"boss", bossIndex: ie2.bossOrder.length-1, nodeId:"final", simulation:{resolutionApplied:false,score:{user:2,opponent:0}} } };
  const before = storage.bytes(); console.log(`quota profile: ${before}/${budget} bytes (${(before/budget*100).toFixed(1)}%)`);
  const runtime = load(storage, { run, seasonDb: ie2, beforePermanentWrite(kind, targetStorage) { targetStorage.setItem(`permanent-${kind}`, hard ? "p".repeat(budget) : JSON.stringify({ runId: run.runId, payload: "p".repeat(600) })); } });
  const s = runtime.seam; s.completeBossMatch("victory"); s.resolvePendingRunFlow({clearMatch:true}); while(s.getRun().postBossFlow?.remainingRewards>0)s.advanceBossReward();
  return { runtime, storage, before, budget };
}
for (const target of [.70,.90,.95,.965]) { const p=veteranProfile(target); assert.equal(p.runtime.canonical.finalization.status,"complete"); assert.equal(p.runtime.hall.size,1); assert.equal(p.runtime.redeemed.size,1); }
const hard=veteranProfile(.98,true), pending=hard.runtime.canonical;
assert.equal(pending.finalization.status,"pending"); assert(pending.completedBossIds.includes("barcelona_orb"));
const quotaResult=hard.runtime.seam.resumeRunFinalization({render:false}); assert.equal(quotaResult.error.code,"storage-quota-exceeded"); assert(quotaResult.error.stage); assert(quotaResult.error.problemSector);
assert(hard.storage.getItem("inazuma.album.v1")); assert(hard.storage.getItem("inazuma.development.v2")); assert(hard.storage.getItem("inazuma.hallOfFame.v1")); assert(hard.storage.getItem("run_ie2"));
hard.storage.removeItem("run_ie2.technical.safe"); hard.storage.budget *= 3;
const retry=load(hard.storage,{run:pending,seasonDb:ie2}); const result=retry.seam.resumeRunFinalization({render:false});
assert.equal(result.completed,true); assert.equal(retry.canonical.finalization.status,"complete"); assert.equal(retry.hall.size,1); assert.equal(retry.redeemed.size,1);
console.log("real app-seam finalization byte-budget matrix: ok");
