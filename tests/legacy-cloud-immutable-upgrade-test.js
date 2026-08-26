"use strict";
const assert = require("assert"), protocol = require("../js/cloud-sync-protocol");
(async () => {
  const legacy = { revision: 9428, cloudCommitId: null, sectorHashes: { run_ie1: "a", run_ie2: "b", hall_index: "c" } };
  const snapshot = [{ sector: "run_ie1", payload: { runId: "ie1" } }, { sector: "run_ie2", payload: { runId: "ie2" } }, { sector: "hall_index", payload: { teamIds: [] } }];
  const immutable = { ...legacy, revision: 9429, baseRevision: 9428, cloudCommitId: "immutable-9429" };
  const failed = protocol.memory(); await assert.rejects(protocol.publish({ store: failed, expected: null, commitId: immutable.cloudCommitId, writes: snapshot, manifest: immutable, failChunk: 0 }), e => e.code === "staging-failed"); assert.equal(failed.manifest(), null); assert.deepEqual(failed.visible(), []);
  const store = protocol.memory(); await protocol.publish({ store, expected: null, commitId: immutable.cloudCommitId, writes: snapshot, manifest: immutable }); assert.equal(store.manifest().cloudCommitId, "immutable-9429"); assert.deepEqual(store.visible(), snapshot);
  const competing = { ...immutable, cloudCommitId: "other" }; await assert.rejects(protocol.publish({ store, expected: legacy, commitId: "loser", writes: snapshot, manifest: competing }), e => e.code === "cloud-cas-conflict"); assert.equal(store.manifest().cloudCommitId, "immutable-9429");
  console.log("legacy cloud bundle immutable upgrade stages exact snapshot and publishes only by CAS: ok");
})().catch(e => { throw e; });
