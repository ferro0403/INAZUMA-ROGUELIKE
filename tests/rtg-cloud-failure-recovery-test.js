"use strict";
const cp = require("child_process");
if (typeof require("vm").SourceTextModule !== "function") { const r = cp.spawnSync(process.execPath, ["--experimental-vm-modules", __filename], { stdio: "inherit" }); process.exit(r.status ?? 1); }
const assert = require("assert"), { client } = require("./helpers/rtg-cloud-client");
const { createAuthenticatedFirestoreBackend } = require("./helpers/authenticated-cloud-runtime");
const { input, clone } = require("./helpers/rtg-cloud-fixtures");
function stop(value) { value.c.dispatchEvent(new value.c.CustomEvent("inazuma:auth-state-changed", { detail: { status: "signed-out" } })); }
async function conflictCloud(value) { assert.equal(value.api.requestConflictResolution("cloud"), true); return value.api.resolveConflictUseCloud(); }
(async () => {
  // A failed initial check still leaves local gameplay and subsequent retry.
  const offline = createAuthenticatedFirestoreBackend(); offline.backend.readFailure = "unavailable";
  const first = await client(offline);
  assert.equal(first.api.getState().status, "error");
  await first.repo.update("offline-before-association", state => { state.tokens += 2; return state; });
  assert.equal((await first.repo.read()).tokens, 902);
  offline.backend.readFailure = null; await first.api.retryAssociation();
  assert.equal(first.api.getState().status, "synced"); stop(first);

  // Production startMatch saves {lastAttempt} for main/unfinished matches.
  // Publishing must preserve both these and completed secondary records.
  const realAttempts = createAuthenticatedFirestoreBackend();
  const realInput = input();
  realInput.trilogy.attemptsByNode = {
    "main:occult": { lastAttempt: 3 },
    "secondary:occult:wild:1": { lastAttempt: 2, lastResult: "victory", clears: 1 },
  };
  const realClient = await client(realAttempts, realInput);
  assert.equal(realClient.api.getState().status, "synced", "valid production attempt history must upload");
  const remoteManifest = realAttempts.documents.get(realAttempts.manifestPath);
  assert.equal(remoteManifest.sectors.rtg, true);
  const rtgPath = `users/test-user/saveCommits/${remoteManifest.cloudCommitId}/sectors/rtg`;
  const stagedRtg = realAttempts.documents.get(rtgPath);
  assert(stagedRtg, "RTG sector must be in immutable bundle");
  stop(realClient);

  // An invalid RTG capture must NEVER claim account synced just because
  // the other permanent sectors match an existing cloud manifest.
  const protectedBackend = createAuthenticatedFirestoreBackend();
  const protectedPc = await client(protectedBackend);
  const protectedManifest = clone(protectedBackend.documents.get(protectedBackend.manifestPath));
  const brokenInput = input();
  brokenInput.trilogy.attemptsByNode["main:occult"] = { lastAttempt: -1 };
  const corruptPhone = await client(protectedBackend, brokenInput);
  assert.equal(corruptPhone.api.getState().status, "sync-error");
  assert.equal(corruptPhone.api.getState().error, "rtg-cloud-invalid-campaign");
  assert.equal(corruptPhone.api.getState().errorDetail, "rtg-ie-trilogy:attemptsByNode");
  assert.deepStrictEqual(protectedBackend.documents.get(protectedBackend.manifestPath), protectedManifest,
    "invalid local RTG must never replace the cloud manifest");
  stop(corruptPhone); stop(protectedPc);

  // A legacy account contains no RTG sector: explicit cloud restore must leave
  // the device's whole RTG state and Album untouched.
  const legacy = createAuthenticatedFirestoreBackend(), legacySource = await client(legacy, null);
  assert.equal(legacy.documents.get(legacy.manifestPath).sectors.rtg, undefined);
  const localSource = input(); localSource.shared.tokens = 33;
  const device = await client(legacy, localSource);
  assert.equal(device.api.getState().status, "local-conflict");
  const previous = clone(await device.storage.readMany(["state", "state:rtg-ares-orion", "shared:account"]));
  const previousAlbum = device.local.getItem("inazuma.rtg.album.v1");
  await conflictCloud(device);
  assert.equal(device.api.getState().status, "restored");
  assert.deepStrictEqual(clone(await device.storage.readMany(Object.keys(previous))), previous);
  assert.equal(device.local.getItem("inazuma.rtg.album.v1"), previousAlbum); stop(device); stop(legacySource);

  for (const corrupt of ["missing", "hash", "revision", "payload"]) {
    const backend = createAuthenticatedFirestoreBackend(), pc = await client(backend);
    const phoneInput = input(); phoneInput.shared.tokens = 1;
    const phone = await client(backend, phoneInput);
    const before = clone(await phone.storage.readMany(["state", "state:rtg-ares-orion", "shared:account"]));
    const manifest = backend.documents.get(backend.manifestPath), path = `users/test-user/saveCommits/${manifest.cloudCommitId}/sectors/rtg`;
    const bad = clone(backend.documents.get(path));
    if (corrupt === "missing") backend.documents.delete(path);
    else { if (corrupt === "hash") bad.payloadHash = "0".repeat(64); if (corrupt === "revision") bad.revision += 1; if (corrupt === "payload") bad.payload = {}; backend.documents.set(path, bad); }
    await assert.rejects(conflictCloud(phone));
    assert.deepStrictEqual(clone(await phone.storage.readMany(Object.keys(before))), before, `${corrupt}: no store touched before validation`);
    assert.equal(phone.local.getItem("inazuma.cloud.restoreJournal.test-user"), null);
    stop(phone); stop(pc);
  }

  const backend = createAuthenticatedFirestoreBackend(), pc = await client(backend);
  const activeInput = input(); activeInput.shared.tokens = 5; activeInput.aresOrion.activeMatch = { status: "active", matchId: "device-only" };
  const active = await client(backend, activeInput);
  await assert.rejects(conflictCloud(active), e => e.code === "rtg-cloud-match-in-progress");
  assert.equal(active.local.getItem("inazuma.cloud.restoreJournal.test-user"), null);
  assert.equal((await active.storage.read("state:rtg-ares-orion")).activeMatch.matchId, "device-only"); stop(active);

  const phoneInput = input(); phoneInput.shared.tokens = 6;
  const phone = await client(backend, phoneInput), originalSet = phone.local.setItem.bind(phone.local);
  let failAlbum = true;
  phone.local.setItem = (key, value) => { if (failAlbum && key === "inazuma.rtg.album.v1") throw Object.assign(Error("synthetic quota"), { name: "QuotaExceededError" }); return originalSet(key, value); };
  const immutableTarget = backend.documents.get(backend.manifestPath).cloudCommitId;
  await assert.rejects(conflictCloud(phone));
  const journalKey = "inazuma.cloud.restoreJournal.test-user";
  assert.equal(JSON.parse(phone.local.getItem(journalKey)).targetCloudCommitId, immutableTarget);
  await assert.rejects(phone.repo.update("must-not-advance-partial-restore", state => { state.tokens += 99; return state; }), e => e.code === "restore-recovery-required");
  await pc.repo.update("another-device-advances", state => { state.tokens += 8; return state; }); await pc.api.syncNow();
  assert.notEqual(backend.documents.get(backend.manifestPath).cloudCommitId, immutableTarget);
  failAlbum = false;
  await phone.api.resumeInterruptedRestore();
  assert.equal(phone.api.getState().status, "restored");
  assert.equal((await phone.repo.read()).tokens, 900, "resume uses the chosen immutable target, not a later remote revision");
  assert.equal(phone.local.getItem(journalKey), null);
  assert.equal(phone.c.RoadToGloryPersistence.assertWritable(), true);
  stop(phone); stop(pc);
  console.log("rtg-cloud-failure-recovery-test: PASS (offline association, legacy preservation, corrupt/missing sectors, active match, quota interruption, immutable retry)");
})().catch(error => { console.error(error); process.exitCode = 1; });
