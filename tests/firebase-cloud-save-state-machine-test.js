"use strict";
const assert = require("assert"), fs = require("fs"), vm = require("vm"), cp = require("child_process");
if (typeof vm.SourceTextModule !== "function") {
  const result = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
(async () => {
  const listeners = {}, blocked = [];
  const storage = new Map();
  const c = { console, structuredClone, Date, Math, JSON, Object, Array, String, Number, Boolean, Promise, Map, Set, TextEncoder, Uint8Array,
    crypto: global.crypto, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,String(v)), removeItem: k => storage.delete(k) },
    setTimeout: () => 1, clearTimeout() {}, location: { reload() {} }, CustomEvent: class { constructor(t,o){this.type=t;this.detail=o?.detail;} },
    addEventListener: (n,f) => { listeners[n] = f; }, dispatchEvent() {},
    PersistenceRecoveryGuard: { isBlocked: () => false, setBlocked: x => blocked.push(x) },
    InazumaAccount: { ready: Promise.resolve(), getState: () => ({ status: "signed-out" }) },
    InazumaCloudSaveCore: { SECTOR_NAMES: ["run_orion"] }, InazumaCloudRestoreProtocol: { RUN_IDS: [] }, CloudRestoreResumeCoordinator: {},
    InazumaCloudWriteFailurePolicy: require("../js/cloud-write-failure-policy") };
  c.globalThis = c; vm.createContext(c);
  const firebase = new vm.SyntheticModule(["doc","getDoc","getDocFromServer","writeBatch","runTransaction","serverTimestamp"], function () {
    this.setExport("doc", (...path) => path); this.setExport("getDoc", async () => ({ exists: () => false })); this.setExport("getDocFromServer", async () => ({ exists: () => false }));
    this.setExport("writeBatch", () => ({ set() {}, delete() {}, commit: async () => {} })); this.setExport("runTransaction", async (_db, fn) => fn({ get: async () => ({ exists: () => false }), set() {} })); this.setExport("serverTimestamp", () => "server-time");
  }, { context: c });
  const module = new vm.SourceTextModule(fs.readFileSync("js/firebase-cloud-save.js", "utf8"), { context: c, identifier: "firebase-cloud-save.js" });
  await module.link(() => firebase); await firebase.evaluate(); await module.evaluate(); await c.InazumaCloudSave.ready;
  assert.equal(typeof c.InazumaCloudSave.syncNow, "function"); assert.equal(typeof listeners["inazuma:local-save-committed"], "function");
  for (const code of ["permission-denied", "unavailable"]) { const state = c.InazumaCloudSave.classifyCloudWriteFailure({ code }); assert.equal(state.status, "sync-error"); assert.notEqual(state.status, "sync-conflict"); }
  const conflict = c.InazumaCloudSave.classifyCloudWriteFailure({ code: "cloud-cas-conflict" }); assert.equal(conflict.status, "sync-conflict"); assert.equal(conflict.needsManifestRefresh, true);
  const repair = c.InazumaCloudSave.classifyCloudWriteFailure({ code: "metadata-repair-needed", serverCommitted: true }); assert.equal(repair.status, "metadata-repair-needed");
  listeners["inazuma:local-save-committed"]({ detail: { sector: "run_orion" } });
  assert.deepEqual(blocked, []); assert.equal(c.InazumaCloudSave.getState().status, "signed-out");
  console.log("real firebase cloud-save module/public state machine: ok");
})().catch(error => { console.error(error); process.exitCode = 1; });
