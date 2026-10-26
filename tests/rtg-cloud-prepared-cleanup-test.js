"use strict";
const cp = require("child_process");
if (typeof require("vm").SourceTextModule !== "function") { const r = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" }); process.exit(r.status ?? 1); }
const assert = require("assert"), { client } = require("./helpers/rtg-cloud-client");
const { createAuthenticatedFirestoreBackend } = require("./helpers/authenticated-cloud-runtime"), { input } = require("./helpers/rtg-cloud-fixtures");
function stop(value) { value.c.dispatchEvent(new value.c.CustomEvent("inazuma:auth-state-changed", { detail: { status: "signed-out" } })); }
(async () => {
  for (const fault of ["fence", "journal"]) {
    const backend = createAuthenticatedFirestoreBackend(), pc = await client(backend), source = input(); source.shared.tokens = 7;
    const phone = await client(backend, source), adapter = phone.c.RoadToGloryCloudBridge.restoreAdapter();
    let preflights = 0, fail = true;
    phone.c.RoadToGloryCloudBridge = { restoreAdapter: () => ({ ...adapter, preflight: async snapshot => {
      if (++preflights === 2) throw Object.assign(Error("match won prepared race"), { code: "rtg-cloud-match-in-progress" });
      return adapter.preflight(snapshot);
    } }) };
    const set = phone.local.setItem.bind(phone.local), remove = phone.local.removeItem.bind(phone.local);
    phone.local.setItem = (key, value) => {
      if (fail && fault === "fence" && key === phone.c.RoadToGloryPersistence.FENCE_KEY && JSON.parse(value).active === false) throw Object.assign(Error("quota"), { name: "QuotaExceededError" });
      return set(key, value);
    };
    phone.local.removeItem = key => { if (fail && fault === "journal" && key === "inazuma.cloud.restoreJournal.test-user") throw Object.assign(Error("storage"), { name: "SecurityError" }); return remove(key); };
    assert.equal(phone.api.requestConflictResolution("cloud"), true);
    await assert.rejects(phone.api.resolveConflictUseCloud());
    try {
      assert(phone.local.getItem("inazuma.cloud.restoreJournal.test-user"), `${fault}: recovery journal must outlive cleanup failure`);
      assert.throws(() => phone.c.RoadToGloryPersistence.assertWritable(), e => e.code === "restore-recovery-required");
      fail = false;
      await phone.api.resumeInterruptedRestore();
      assert.equal(phone.api.getState().status, "restored", `${fault}: same-session retry must repair cleanup without an orphan fence`);
      assert.equal(phone.local.getItem("inazuma.cloud.restoreJournal.test-user"), null);
      assert.equal(phone.c.RoadToGloryPersistence.assertWritable(), true);
    } finally { stop(phone); stop(pc); }
  }
  console.log("rtg-cloud-prepared-cleanup-test: PASS (fence quota and journal SecurityError both retain recoverable retry)");
})().catch(error => { console.error(error); process.exitCode = 1; });
