"use strict";
const assert = require("assert"), fs = require("fs"), vm = require("vm");
const { makeFakeIndexedDb } = require("./helpers/fake-indexeddb-atomic");
const { input, clone } = require("./helpers/rtg-cloud-fixtures");
const protocol = require("../js/cloud-restore-protocol");
function harness() {
  const values = new Map(), localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  const c = { globalThis: null, console, Object, Array, String, Number, Math, Set, Map, JSON, Promise, Error, TypeError, RegExp, indexedDB: makeFakeIndexedDb(), localStorage };
  c.globalThis = c; vm.createContext(c);
  for (const name of ["persistence-recovery-guard", "road-to-glory/rtg-persistence-runtime", "road-to-glory/rtg-storage", "road-to-glory/rtg-card-identity", "road-to-glory/rtg-coaches", "road-to-glory/rtg-state", "road-to-glory/rtg-cloud-snapshot", "road-to-glory/rtg-cloud-local-adapter", "road-to-glory/rtg-cloud-restore-adapter"]) vm.runInContext(fs.readFileSync(`js/${name}.js`, "utf8"), c);
  const storage = c.RoadToGloryStorage.create(), adapter = c.RoadToGloryCloudRestoreAdapter.create({ storage });
  return { c, storage, adapter, localStorage };
}
(async () => {
  for (const point of ["before:profile", "after:profile", "after:album", "after:development", "after:hall", "before:rtg", "after:rtg", "after:verify", "after:metadata", "after:complete"]) {
    const h = harness(), source = input();
    await h.storage.write(source.trilogy, "state"); await h.storage.write(source.aresOrion, "state:rtg-ares-orion"); await h.storage.write(source.shared, "shared:account");
    h.localStorage.setItem("inazuma.rtg.album.v1", JSON.stringify(source.album));
    const originalSquads = clone(source.trilogy.squads);
    source.shared.tokens = 71; const rtg = h.c.RoadToGloryCloudSnapshot.project(source);
    const target = { snapshot: { rtg }, manifest: { revision: 2 } }, key = "inazuma.cloud.restoreJournal.u";
    let journal = protocol.createJournal({ uid: "u", operationId: `crash-${point}`, expectedLocalEpoch: h.c.PersistenceRecoveryGuard.readEpoch(), targetCloudCommitId: "immutable-c" });
    h.localStorage.setItem(key, JSON.stringify(journal)); h.c.PersistenceRecoveryGuard.bindUid("u");
    const staleToken = h.c.RoadToGloryPersistence.capture();
    let appliedRtg = 0, fired = false;
    const common = { loadTarget: async () => target,
      writeJournal: value => { h.localStorage.setItem(key, JSON.stringify(value)); return value; }, clearJournal: () => h.localStorage.removeItem(key),
      onComplete: () => h.c.PersistenceRecoveryGuard.clearBlocked(journal.operationId),
      adapters: {
        preflight: async value => { await h.adapter.preflight(value.rtg); h.c.RoadToGloryPersistence.beginRestore(journal); },
        assertOwnership: active => h.c.PersistenceRecoveryGuard.assertWritable({ restoreOwnershipToken: active.operationId }),
        storeEquals: async name => name === "rtg" ? h.adapter.equals(rtg) : true,
        applyStore: async name => { assert.equal(name, "rtg"); appliedRtg++; await h.adapter.apply(rtg, journal); },
        verify: async () => h.adapter.verify(rtg, journal), writeMetadata() {},
        complete: () => h.c.RoadToGloryPersistence.completeRestore(journal),
      } };
    await assert.rejects(protocol.recover({ ...common, journal, crash: stage => { if (stage === point && !fired) { fired = true; throw Error("synthetic crash"); } } }), /synthetic crash/);
    assert(h.localStorage.getItem(key));
    await assert.rejects(h.storage.updateMany(["shared:account"], () => ({ writes: { "shared:account": { tokens: 99999 } } })), e => ["restore-recovery-required", "rtg-stale-runtime"].includes(e.code));
    journal = JSON.parse(h.localStorage.getItem(key));
    h.c.PersistenceRecoveryGuard.bindUid("u");
    const result = await protocol.recover({ ...common, journal });
    assert.equal(result.status, "restored");
    assert.equal(h.localStorage.getItem(key), null);
    assert.equal((await h.storage.read("shared:account")).tokens, 71);
    assert.deepStrictEqual(clone((await h.storage.read("state")).squads), originalSquads);
    assert.equal(appliedRtg, 1, `${point}: no repeated application of permanent RTG data`);
    assert.throws(() => h.c.RoadToGloryPersistence.assertGeneration(staleToken), e => e.code === "rtg-stale-runtime");
    assert.equal(h.c.RoadToGloryPersistence.assertWritable(), true);
  }
  console.log("rtg-cloud-journal-recovery-test: PASS (10 crash boundaries, retry, write guard, exact squads, stale work rejected)");
})().catch(error => { console.error(error); process.exitCode = 1; });
