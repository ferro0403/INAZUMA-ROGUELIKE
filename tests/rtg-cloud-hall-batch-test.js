"use strict";
const cp = require("node:child_process");
if (typeof require("node:vm").SourceTextModule !== "function") {
  const p = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" });
  process.exit(p.status ?? 1);
}
const assert = require("node:assert/strict");
const { client } = require("./helpers/rtg-cloud-client");
const { createAuthenticatedFirestoreBackend } = require("./helpers/authenticated-cloud-runtime");
const { input } = require("./helpers/rtg-cloud-fixtures");

function stop(c) { c.c.dispatchEvent(new c.c.CustomEvent("inazuma:auth-state-changed", { detail: { status: "signed-out" } })); }
function hallTeams(n) {
  return Array.from({ length: n }, (_, i) => ({
    hallTeamId: "hall_ci_" + i,
    archiveKey: "ci-run-" + i + "::ie1::final",
    runId: "ci-run-" + i,
    modeId: "story", seasonId: "ie1",
    finalStartingEleven: [], fullRoster: [], bench: [],
    runStatistics: {}, playerStatistics: {},
  }));
}
(async () => {
  const backend = createAuthenticatedFirestoreBackend();
  const original = await client(backend);
  const local = input(); local.shared.tokens = 17;
  const phone = await client(backend, local);
  try {
    assert.equal(phone.api.getState().status, "local-conflict");
    await phone.c.HallOfFameStorage._saveArchive({ schemaVersion: 2, updatedAt: "now", teams: hallTeams(4), index: [] });
    assert.equal(phone.c.HallOfFameStorage._loadArchive().teams.length, 4);

    // Simulate a constrained Firestore backend that refuses multi-record Hall
    // batches. Actual Firebase has a 10 MiB request limit, independent of the
    // per-document cap; one-record Hall batches are safe by construction.
    const batches = [];
    backend.backend.beforeBatchCommit = async writes => {
      const hall = writes.some(([_, ref]) => ref.path.includes("hallOfFame"));
      if (hall) {
        batches.push(writes.length);
        if (writes.length > 1) throw Object.assign(Error("too-large-hall-request"), { code: "invalid-argument" });
      }
    };
    const before = structuredClone(await phone.storage.read("shared:account"));
    assert.equal(phone.api.requestConflictResolution("local"), true);
    await phone.api.resolveConflictUseLocal();
    assert.equal(phone.api.getState().status, "synced");
    assert.deepEqual(batches, [1, 1, 1, 1], "Hall must stage one archive document per request");
    assert.deepEqual(structuredClone(await phone.storage.read("shared:account")), before, "local RTG save unchanged");
    let manifest = backend.documents.get(backend.manifestPath);
    assert.equal(manifest.hallTeamIds.length, 4);
    for (const id of manifest.hallTeamIds) {
      assert(backend.documents.has(`users/test-user/saveCommits/${manifest.cloudCommitId}/hallOfFame/${id}`));
    }
  } finally { stop(phone); stop(original); }

  const backend2 = createAuthenticatedFirestoreBackend();
  const original2 = await client(backend2);
  const secondLocal = input(); secondLocal.shared.tokens = 23;
  const phone2 = await client(backend2, secondLocal);
  try {
    await phone2.c.HallOfFameStorage._saveArchive({ schemaVersion: 2, teams: hallTeams(3), index: [] });
    const cloudBefore = structuredClone(backend2.documents.get(backend2.manifestPath));
    const localBefore = structuredClone(phone2.c.HallOfFameStorage._loadArchive());
    let count = 0;
    backend2.backend.beforeBatchCommit = async writes => {
      if (!writes.some(([_, ref]) => ref.path.includes("hallOfFame"))) return;
      count += 1;
      if (count === 2) throw Object.assign(Error("invalid-argument"), { code: "invalid-argument" });
    };
    assert.equal(phone2.api.requestConflictResolution("local"), true);
    await phone2.api.resolveConflictUseLocal();
    const failure = phone2.api.getState();
    assert.equal(failure.status, "sync-error");
    assert.equal(failure.error, "invalid-argument");
    assert.equal(failure.errorStage, "staging-hall");
    assert.equal(failure.errorHallPosition, 2);
    assert.equal(failure.errorHallTotal, 3);
    assert.deepEqual(backend2.documents.get(backend2.manifestPath), cloudBefore,
      "failed Hall stage must leave published manifest unchanged");
    assert.deepEqual(structuredClone(phone2.c.HallOfFameStorage._loadArchive()), localBefore,
      "failed Hall stage must preserve local archive");
    backend2.backend.beforeBatchCommit = null;
    await phone2.api.retryAssociation();
    assert.equal(phone2.api.getState().status, "local-conflict",
      "retry must recheck without uploading before new explicit choice");
  } finally { stop(phone2); stop(original2); }
  console.log("rtg-cloud-hall-batch-test: PASS (small batches, safe manifest, Hall ordinal diagnostics)");
})().catch(error => { console.error(error); process.exitCode = 1; });
