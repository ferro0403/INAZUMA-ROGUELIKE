"use strict";
const assert = require("assert"), vm = require("vm"), fs = require("fs");
const projector = require("../js/road-to-glory/rtg-cloud-snapshot");
const core = require("../js/cloud-save-core");
const { input, account, clone } = require("./helpers/rtg-cloud-fixtures");
(async () => {
  let current = { status: "ready", snapshot: projector.project(input()) }, captures = 0;
  const c = { globalThis: null, Object, Array, String, Number, Math, Set, Map, JSON, Promise, Error, TypeError, Symbol,
    InazumaCloudSaveCore: { ...core, readLocalSnapshot: () => account() },
    RoadToGloryCloudLocalAdapter: { create: () => ({ captureStable: async () => { captures++; if (current instanceof Error) throw current; return clone(current); } }) },
    RoadToGloryCloudRestoreAdapter: { create: () => ({ validateTarget() {} }) },
    RoadToGloryStorage: { create: () => ({}) } };
  c.globalThis = c; vm.createContext(c);
  const path = "js/road-to-glory/rtg-cloud-bridge.js";
  if (fs.existsSync(path)) vm.runInContext(fs.readFileSync(path, "utf8"), c);
  const local = await c.InazumaCloudSaveCore.prepareSnapshot(c.InazumaCloudSaveCore.readLocalSnapshot());
  assert.ok(local.snapshot.rtg, "local RTG must reach the same account cloud snapshot");
  assert.equal(captures, 1);
  const remote = account(current.snapshot);
  await c.InazumaCloudSaveCore.prepareSnapshot(remote);
  assert.equal(captures, 1, "a remote restore target must never be polluted by device RTG");
  current = { status: "deferred", reason: "rtg-cloud-match-in-progress" };
  const deferred = await c.InazumaCloudSaveCore.prepareSnapshot(c.InazumaCloudSaveCore.readLocalSnapshot());
  assert.equal(deferred.snapshot.rtg, undefined);
  assert.equal(deferred.rtgCapture.status, "deferred");
  assert.deepStrictEqual(deferred.payloads.development, {});
  current = Object.assign(Error("corrupt"), { code: "rtg-cloud-album-corrupt" });
  const corrupt = await c.InazumaCloudSaveCore.prepareSnapshot(c.InazumaCloudSaveCore.readLocalSnapshot());
  assert.equal(corrupt.rtgCapture.status, "error");
  assert.equal(corrupt.snapshot.rtg, undefined, "corrupt RTG must not become an empty checkpoint");
  console.log("rtg-cloud-bridge-test: PASS (same account snapshot, remote isolation, deferred match, corrupt sector)");
})().catch(error => { console.error(error); process.exitCode = 1; });
