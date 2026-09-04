"use strict";
const assert = require("assert");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const players = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"].map((position, index) => ({ playerId: `p${index}`, name: `P${index}`, position, category: "Normale", overall: 50, finalOverall: 50, stats: {} }));
const seasonDb = { seasonId: "ie1", players, formations: { eleven: [{ id: "4-3-3", requirements: { GK: 1, DF: 4, MF: 3, FW: 3 } }] }, bossOrder: [{ teamId: "boss", teamName: "Boss", bossLevel: 1, startingXIPlayerIds: players.map(player => player.playerId) }] };
function makeRun(type = "item", suffix = type) {
  return { runId: `production-map-${suffix}`, seasonId: "ie1", phase: "map", lives: 3, bossIndex: 0, completedBossIds: [], unlockedTeamIds: [], completedSpecialMatchIds: [], unlockedSpecialTeamIds: [], claimedSpecialMatchRewardIds: [], permanentEffectOutbox: [], roster: players.map(player => ({ playerId: player.playerId, source: "ie1", level: 0 })), lineup: players.map(player => player.playerId), bench: [], inventory: [], formationId: "4-3-3", teamIdentity: { name: "Raimon" }, statistics: {}, currentZone: { bossIndex: 0, bossId: "boss", seed: `stable-${suffix}`, currentNodeId: "start", startNodeId: "start", pendingNodeId: null, completedNodeIds: [], path: ["start"], nodes: [{ id: "start", type: "start", layer: 0 }, { id: "node", type, layer: 1 }], edges: [["start", "node"]] }, activeMatch: null };
}
function open(storage, run) {
  const runtime = load(storage, { ...(run ? { run } : {}), fullRuntime: true, seasonId: "ie1", seasonDb, contextOverrides: { fetch: () => new Promise(() => {}) } });
  runtime.context.RoguelikeRules.isProfileAwareRosterEntry = () => false;
  runtime.context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => 0;
  return runtime;
}
function countedItemRng(runtime, counter) {
  const original = runtime.context.DraftEngine.randomFromSeed;
  runtime.context.DraftEngine.randomFromSeed = seed => { counter.calls += 1; return original(seed); };
}

// A. A production Item click commits selection and offer; reopen reuses the exact offer.
{
  const storage = new BudgetStorage(Infinity); let runtime = open(storage, makeRun("item", "offer"));
  const generated = { calls: 0 }; countedItemRng(runtime, generated);
  runtime.seam.renderMap({ persist: false }); runtime.query('[data-node-id="node"]').click();
  const offered = structuredClone(runtime.canonical.pendingItemReward);
  assert.equal(offered.nodeId, "node"); assert.equal(generated.calls, 1); assert.match(runtime.modalMarkup, /OGGETTO TROVATO/);
  runtime.destroy(); runtime = open(storage); countedItemRng(runtime, generated); runtime.seam.resumePendingItemReward();
  assert.equal(runtime.canonical.pendingItemReward.nodeId, offered.nodeId);
  assert.deepEqual(runtime.canonical.pendingItemReward.candidateIds, offered.candidateIds);
  assert.equal(runtime.canonical.pendingItemReward.selectedItemId, offered.selectedItemId);
  assert.equal(generated.calls, 1, "resume must not regenerate Item candidates"); assert.match(runtime.modalMarkup, /OGGETTO TROVATO/);

  // B. The real Skip CTA clears the reward and completes the node canonically across reopen.
  runtime.query("#skip-item").click();
  assert.equal(runtime.canonical.pendingItemReward, null); assert.equal(runtime.canonical.phase, "map");
  assert(runtime.canonical.currentZone.completedNodeIds.includes("node")); assert.equal(runtime.canonical.currentZone.pendingNodeId, null);
  runtime.destroy(); runtime = open(storage);
  assert(runtime.canonical.currentZone.completedNodeIds.includes("node")); assert.equal(runtime.canonical.pendingItemReward, null);
}

// C. A one-shot map-node-select quota failure cannot dispatch; recovery retry returns to canonical Map.
(async () => {
  const storage = new BudgetStorage(Infinity); const runtime = open(storage, makeRun("item", "quota"));
  const originalSave = runtime.context.RunState.save.bind(runtime.context.RunState); let failed = false; let itemRngCalls = 0;
  runtime.context.DraftEngine.randomFromSeed = seed => { itemRngCalls += 1; return () => 0.5; };
  runtime.context.RunState.save = (value, options) => { if (!failed) { failed = true; throw Object.assign(new Error("quota"), { name: "QuotaExceededError" }); } return originalSave(value, options); };
  runtime.seam.renderMap({ persist: false }); runtime.query('[data-node-id="node"]').click();
  assert.equal(runtime.canonical.currentZone.pendingNodeId, null); assert.deepEqual(runtime.canonical.currentZone.completedNodeIds, []);
  assert.equal(runtime.canonical.pendingItemReward, null); assert.equal(itemRngCalls, 0); assert.match(runtime.seam.getAppMarkup(), /SALVATAGGIO NON RIUSCITO/);
  runtime.query("#retry-failed-gameplay").click(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(runtime.seam.getAppMarkup(), /data-node-id="node"/); assert.equal(runtime.canonical.currentZone.pendingNodeId, null);
  runtime.query('[data-node-id="node"]').click(); assert.equal(runtime.canonical.currentZone.pendingNodeId, "node"); assert(runtime.canonical.pendingItemReward); assert.equal(itemRngCalls, 1);

  // E. The detached original button receives two taps: one destination, valid canonical state.
  const doubleStorage = new BudgetStorage(Infinity); const doubleRuntime = open(doubleStorage, makeRun("item", "double"));
  const originalButton = (doubleRuntime.seam.renderMap({ persist: false }), doubleRuntime.query('[data-node-id="node"]'));
  const BASE_ITEM_DOUBLE_TAP_SAVE_CALLS = 3; // Characterized against 1227d946032d8c33637d94947a163d8f10af336e.
  const realDoubleSave = doubleRuntime.context.RunState.save.bind(doubleRuntime.context.RunState); let saveCalls = 0;
  doubleRuntime.context.RunState.save = (...args) => { saveCalls += 1; return realDoubleSave(...args); };
  originalButton.click(); originalButton.click();
  assert.equal(saveCalls, BASE_ITEM_DOUBLE_TAP_SAVE_CALLS, "HEAD parity: second detached tap repeats map-node-select but does not duplicate the Item offer");
  assert.equal(doubleRuntime.canonical.currentZone.pendingNodeId, "node"); assert(doubleRuntime.canonical.pendingItemReward); assert.match(doubleRuntime.modalMarkup, /OGGETTO TROVATO/);

  // D. Random reveal and its Item offer remain stable; reopen performs neither reveal nor candidate RNG again.
  const randomStorage = new BudgetStorage(Infinity); let randomRuntime = open(randomStorage, makeRun("random", "random"));
  let reveals = 0; const candidateRng = { calls: 0 };
  randomRuntime.context.MapEngine.resolveRandomNodeType = (_run, node) => { reveals += 1; node.revealedType = "item"; return "item"; };
  countedItemRng(randomRuntime, candidateRng); randomRuntime.seam.renderMap({ persist: false }); randomRuntime.query('[data-node-id="node"]').click(); randomRuntime.query("#open-hidden-event").click();
  const randomOffer = structuredClone(randomRuntime.canonical.pendingItemReward); assert.equal(randomRuntime.canonical.currentZone.nodes[1].revealedType, "item"); assert.equal(reveals, 1); assert.equal(candidateRng.calls, 1);
  randomRuntime.destroy(); randomRuntime = open(randomStorage); randomRuntime.context.MapEngine.resolveRandomNodeType = () => { reveals += 1; return "trade"; }; countedItemRng(randomRuntime, candidateRng); randomRuntime.seam.resumePendingItemReward();
  assert.equal(randomRuntime.canonical.currentZone.nodes[1].revealedType, "item"); assert.deepEqual(randomRuntime.canonical.pendingItemReward.candidateIds, randomOffer.candidateIds);
  assert.equal(reveals, 1); assert.equal(candidateRng.calls, 1); assert.match(randomRuntime.modalMarkup, /OGGETTO TROVATO/);
  console.log("map node production path: Item reopen/skip, quota recovery, double tap and Random reopen OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
