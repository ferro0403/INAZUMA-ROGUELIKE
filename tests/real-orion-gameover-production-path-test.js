"use strict";
const assert = require("assert"), cp = require("child_process"), vm = require("vm");
if (typeof vm.SourceTextModule !== "function") {
  const result = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
const { load } = require("./helpers/production-runtime");
const { attachAuthenticatedCloud } = require("./helpers/authenticated-cloud-runtime");
const BudgetStorage = require("./helpers/budget-storage");
const orion = require("../data/ORION_season_compact.json");
const run = { runId: "orion-last-life", seasonId: "orion", lives: 1, bossIndex: 2, phase: "match", completedBossIds: orion.bossOrder.slice(0, 2).map(x => x.teamId), inventory: [], roster: [], lineup: [], bench: [], statistics: {}, currentZone: { nodes: [{ id: "orion-loss", type: "boss" }], path: [], completedNodeIds: [] }, activeMatch: { matchId: "orion-defeat", type: "boss", bossIndex: 2, nodeId: "orion-loss", state: "playing", simulation: { resolutionApplied: false, score: { user: 0, opponent: 1 } } } };

(async () => {
  const storage = new BudgetStorage(1_000_000);
  let runtime = load(storage, { run, seasonDb: orion });
  runtime.context.HallOfFameStorage._saveArchive(runtime.context.HallOfFameStorage._loadArchive(), { preserveTimestamp: true });
  const cloud = await attachAuthenticatedCloud(runtime.context);
  assert.equal(cloud.api.getState().status, "synced"); cloud.backend.failure = "permission-denied";
  runtime.seam.completeBossMatch("defeat"); runtime.seam.continueAfterMatch({ preventDefault() {} }); runtime.seam.renderGameOver();
  const saved = runtime.canonical;
  assert.equal(saved.gameOver, true); assert.equal(saved.phase, "gameover"); assert.equal(runtime.redeemed.size, 1);
  assert(cloud.api.getState().pendingSectors.includes("run_orion"), "real canonical save event must reach cloud module");
  await cloud.api.syncNow(); assert.equal(cloud.api.getState().status, "sync-error");
  assert.equal(runtime.context.PersistenceRecoveryGuard.isBlocked(), false);
  runtime.destroy(); runtime = runtime.reopen({ seasonDb: orion }); runtime.seam.renderGameOver();
  assert.equal(runtime.redeemed.size, 1); assert.equal(runtime.context.PersistenceRecoveryGuard.isBlocked(), false);
  assert.equal(runtime.canonical.gameOver, true); assert.equal(runtime.canonical.phase, "gameover");
  cloud.backend.failure = null; await cloud.api.retrySync(); assert.equal(cloud.api.getState().status, "synced");
  assert.equal(runtime.canonical.gameOver, true); assert.equal(runtime.canonical.phase, "gameover");
  runtime.seam.renderGameOver(); assert.equal(runtime.redeemed.size, 1);
  console.log("true Orion game-over + authenticated cloud failure + fresh production reopen: ok");
})().catch(error => { console.error(error); process.exitCode = 1; });
