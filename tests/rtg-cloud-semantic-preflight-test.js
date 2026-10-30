"use strict";
const cp = require("child_process");
if (typeof require("vm").SourceTextModule !== "function") { const r = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" }); process.exit(r.status ?? 1); }
const assert = require("assert"), projector = require("../js/road-to-glory/rtg-cloud-snapshot");
const { client } = require("./helpers/rtg-cloud-client"), { createAuthenticatedFirestoreBackend } = require("./helpers/authenticated-cloud-runtime");
const { input, clone } = require("./helpers/rtg-cloud-fixtures");
function stop(value) { value.c.dispatchEvent(new value.c.CustomEvent("inazuma:auth-state-changed", { detail: { status: "signed-out" } })); }
(async () => {
  for (const mutate of [value => { value.trilogy.lives = 7; }, value => { value.shared.developmentByCardId = Object.fromEntries([["__proto__", { targetPotential: 80, currentRarity: "Forte" }]]); }]) {
    const value = input(); mutate(value);
    assert.throws(() => projector.project(value), "lossy gameplay normalization must be rejected at the cloud boundary");
  }
  const backend = createAuthenticatedFirestoreBackend(), pc = await client(backend), core = pc.c.InazumaCloudSaveCore;
  const manifest = clone(backend.documents.get(backend.manifestPath));
  for (const sector of ["profile", "rtg"]) {
    const path = `users/test-user/saveCommits/${manifest.cloudCommitId}/sectors/${sector}`, doc = clone(backend.documents.get(path));
    const payload = core.decodeFirestorePayload(doc.payload);
    if (sector === "rtg") payload.shared.coachOwnedIds = ["not-a-real-coach"];
    else payload.teamIdentity.name = "REMOTE PROFILE";
    doc.payload = core.encodeFirestorePayload(payload); doc.payloadHash = await core.hash(payload);
    manifest.sectorHashes[sector] = doc.payloadHash; backend.documents.set(path, doc);
  }
  backend.documents.set(backend.manifestPath, manifest);
  backend.documents.set(`users/test-user/saveCommits/${manifest.cloudCommitId}/metadata/manifest`, manifest);
  const phoneSource = input(); phoneSource.shared.tokens = 1;
  const phone = await client(backend, phoneSource), beforeProfile = phone.c.RunState.loadProfile();
  assert.equal(phone.api.requestConflictResolution("cloud"), true);
  await assert.rejects(phone.api.resolveConflictUseCloud(), e => e.code === "rtg-coaches-invalid-collection");
  try {
    assert.deepStrictEqual(phone.c.RunState.loadProfile(), beforeProfile, "invalid RTG target must be rejected before the first account store changes");
    assert.equal(phone.local.getItem("inazuma.cloud.restoreJournal.test-user"), null);
    assert.equal(phone.c.RoadToGloryPersistence.assertWritable(), true);
  } finally { stop(phone); stop(pc); }
  console.log("rtg-cloud-semantic-preflight-test: PASS (semantic integrity, reserved keys, preflight before any store)");
})().catch(error => { console.error(error); process.exitCode = 1; });
