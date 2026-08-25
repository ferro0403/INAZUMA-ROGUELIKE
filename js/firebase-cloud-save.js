import { doc, getDoc, getDocFromServer, writeBatch, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const core = globalThis.InazumaCloudSaveCore;
const DEVICE_KEY = "inazuma.cloud.deviceId";
const DEBOUNCE_MS = 2000;
const initial = { status: "idle", uid: null, revision: null, deviceId: null, pendingSectors: [], lastSyncedAt: null, error: null, problemSector: null, cloudRevision: null, localRevision: null, manifestRevisionStart: null, manifestRevisionEnd: null, restoreStage: null, hallOfFameCount: 0, lastCompletedAt: null, localProgressSummary: null, restoreReadCount: 0 };
let state = { ...initial }, generation = 0, associationInFlight = null, restoreInFlight = null, syncInFlight = null, checkInFlight = null, conflictInFlight = null;
let automaticUid = null, cachedManifest = null, reloadUsed = false, debounceTimer = null, dirtySectors = new Set(), lastRestoreType = "initial";

function deviceId() { let value = localStorage.getItem(DEVICE_KEY); if (!value) { value = globalThis.crypto?.randomUUID?.() || `device-${Date.now().toString(36)}-${Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`; localStorage.setItem(DEVICE_KEY, value); } return value; }
function metadataKey(uid) { return `inazuma.cloud.association.${uid}`; }
function journalKey(uid) { return `inazuma.cloud.restoreJournal.${uid}`; }
function readRestoreJournal(uid) { try { const raw = localStorage.getItem(journalKey(uid)); return raw ? JSON.parse(raw) : null; } catch (error) { globalThis.PersistenceRecoveryGuard?.setBlocked({ uid, stage: "journal-read", status: "safety", error: "storage-access-error" }); throw Object.assign(error, { code: "restore-journal-unavailable" }); } }
function writeRestoreJournal(journal, stage) { const next = { ...journal, stage, updatedAt: new Date().toISOString() }; localStorage.setItem(journalKey(journal.uid), JSON.stringify(next)); return next; }
function clearRestoreJournal(uid) { localStorage.removeItem(journalKey(uid)); }
function guard() { return globalThis.PersistenceRecoveryGuard; }
function readMetadata(uid, id) { return globalThis.InazumaCloudLocalMetadata.read(localStorage, metadataKey(uid), uid, id); }
function writeMetadata(uid, value) { globalThis.InazumaCloudLocalMetadata.write(localStorage, metadataKey(uid), value); }
function publish(patch, token = generation) { if (token !== generation) return false; state = { ...state, ...patch }; globalThis.dispatchEvent(new CustomEvent("inazuma:cloud-save-state-changed", { detail: { ...state } })); return true; }
function current(token, uid) { const auth = globalThis.InazumaAccount?.getState(); return token === generation && auth?.status === "authenticated" && auth.uid === uid && cachedManifest?.uid === uid && cachedManifest.token === token; }
function sectorHash(prepared, name) { return core.isRunSector(name) && prepared.payloads[name] === null ? null : prepared.hashes[name]; }
function sectorRevisions(manifest) { return Object.fromEntries(core.SECTOR_NAMES.map((name) => [name, manifest.sectorRevisions?.[name] ?? manifest.revision])); }
function metadataFrom(uid, id, manifest, prepared, previous = {}) { const now = new Date().toISOString(); return { uid, deviceId: id, revision: manifest.revision, status: "associated", sectorHashes: Object.fromEntries(core.SECTOR_NAMES.map((name) => [name, sectorHash(prepared, name)])), sectorRevisions: sectorRevisions(manifest), hallTeamIds: prepared.hallEntries.map((entry) => entry.hallTeamId), hallTeamHashes: Object.fromEntries(prepared.hallEntries.map((entry) => [entry.hallTeamId, entry.payloadHash])), hallTeamRevisions: { ...(manifest.hallTeamRevisions || {}) }, associatedAt: previous.associatedAt || now, restoredAt: previous.restoredAt || null, lastSyncedAt: now }; }
function hashesMatchManifest(manifest, prepared) { const localIds = prepared.hallEntries.map((entry) => entry.hallTeamId).sort(), cloudIds = [...(manifest.hallTeamIds || [])].sort(); return core.SECTOR_NAMES.every((name) => sectorHash(prepared, name) === (manifest.sectorHashes?.[name] ?? null)) && JSON.stringify(localIds) === JSON.stringify(cloudIds) && prepared.hallEntries.every((entry) => manifest.hallTeamHashes?.[entry.hallTeamId] === entry.payloadHash); }
function sectorDocument(name, payload, payloadHash, id, timestamp, revision, commitId) { return { schemaVersion: 1, revision, cloudCommitId: commitId, baseRevision: revision - 1, targetRevision: revision, sector: name, payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(payload), payloadHash, updatedAt: timestamp, sourceDeviceId: id }; }
function hallDocument(entry, id, timestamp, revision, commitId) { return { schemaVersion: 1, revision, cloudCommitId: commitId, baseRevision: revision - 1, targetRevision: revision, hallTeamId: entry.hallTeamId, archiveKey: entry.archiveKey, payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(entry.payload), payloadHash: entry.payloadHash, updatedAt: timestamp, sourceDeviceId: id }; }
function clearTimer() { if (debounceTimer != null) { clearTimeout(debounceTimer); debounceTimer = null; } }
function scheduleSync(token = generation) { clearTimer(); if (!dirtySectors.size || ["sync-conflict", "local-conflict", "cloud-update-available"].includes(state.status)) return; publish({ status: "sync-pending", pendingSectors: [...dirtySectors], error: null }, token); debounceTimer = setTimeout(() => { debounceTimer = null; syncNow(); }, DEBOUNCE_MS); }
async function prepareStableLocalSnapshot(maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const before = core.readLocalSnapshot(), prepared = await core.prepareSnapshot(before), after = core.readLocalSnapshot();
    const comparison = await core.compareSnapshots(before, after);
    if (comparison.equivalent && core.stableSerialize(before.runProvenance) === core.stableSerialize(after.runProvenance)) return prepared;
  }
  throw Object.assign(new Error("local-snapshot-unstable"), { code: "local-snapshot-unstable" });
}
async function repairCommittedMetadata(uid, id, manifest, token) {
  const prepared = await prepareStableLocalSnapshot();
  if (!hashesMatchManifest(manifest, prepared)) throw Object.assign(new Error("metadata-repair-needed"), { code: "metadata-repair-needed" });
  const metadata = metadataFrom(uid, id, manifest, prepared, readMetadata(uid, id) || {});
  try { writeMetadata(uid, metadata); if (readMetadata(uid, id)?.revision !== manifest.revision) throw new Error("metadata-readback-failed"); }
  catch (error) { throw Object.assign(error, { code: "metadata-repair-needed", serverCommitted: true }); }
  publish({ status: "synced", revision: manifest.revision, localRevision: manifest.revision, cloudRevision: manifest.revision, lastSyncedAt: metadata.lastSyncedAt, error: null }, token);
  return metadata;
}

function newCloudCommitId() { return globalThis.crypto?.randomUUID?.() || `cloud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
async function stageBundle(uid, id, prepared, db, revision, commitId, manifest) {
  const timestamp = serverTimestamp(), writes = [(batch) => batch.set(doc(db, "users", uid, "saveCommits", commitId, "metadata", "manifest"), manifest)];
  core.SECTOR_NAMES.forEach((name) => writes.push((batch) => batch.set(doc(db, "users", uid, "saveCommits", commitId, "sectors", name), sectorDocument(name, prepared.payloads[name], sectorHash(prepared, name), id, timestamp, revision, commitId))));
  prepared.hallEntries.forEach((entry) => writes.push((batch) => batch.set(doc(db, "users", uid, "saveCommits", commitId, "hallOfFame", entry.hallTeamId), hallDocument(entry, id, timestamp, revision, commitId))));
  // Staging is intentionally chunked. It is invisible until the manifest CAS
  // publishes cloudCommitId, so an interrupted large Hall upload is harmless.
  for (const chunk of globalThis.InazumaCloudSyncProtocol.chunks(writes, 400)) { const batch = writeBatch(db); chunk.forEach((write) => write(batch)); await batch.commit(); }
}
async function commitBundle(uid, id, prepared, db, expectedManifest, commitId) {
  core.preflight(prepared); const expectedRevision = expectedManifest?.revision ?? 0, targetRevision = expectedRevision + 1;
  const timestamp = serverTimestamp(), manifest = core.buildManifest(prepared, uid, id, timestamp, { revision: targetRevision, baseRevision: expectedRevision, cloudCommitId: commitId });
  await stageBundle(uid, id, prepared, db, targetRevision, commitId, manifest);
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, "users", uid, "cloudSave", "manifest"), snapshot = await transaction.get(ref);
    const actual = snapshot.exists() ? snapshot.data() : null;
    if (!globalThis.InazumaCloudSyncProtocol.casMatches(actual, expectedManifest, (value) => manifestBundleIdentity(value))) throw Object.assign(new Error("cloud-cas-conflict"), { code: "cloud-cas-conflict" });
    transaction.set(ref, manifest);
  });
  return manifest;
}
async function upload(uid, id, prepared, db) {
  return commitBundle(uid, id, prepared, db, null, newCloudCommitId());
}
async function readDocument(db, ...path) { return getDoc(doc(db, ...path)); }
async function readServerDocument(db, ...path) { return getDocFromServer(doc(db, ...path)); }

function manifestBundleIdentity(manifest) { return core.stableSerialize(Object.fromEntries(["revision", "cloudCommitId", "sectorHashes", "sectorRevisions", "hallTeamIds", "hallTeamHashes", "hallTeamRevisions", "sectors"].map((key) => [key, manifest[key]]))); }
function restoreError(code, problemSector = null) { return Object.assign(new Error(code), { code, problemSector }); }
async function downloadStableCloudBundle({ uid, token, maxAttempts = 2 }) {
  const db = globalThis.InazumaAccount.getFirestoreInstance();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    publish({ status: "downloading", restoreStage: "read-manifest-start", restoreReadCount: 0, manifestRevisionStart: null, manifestRevisionEnd: null, error: null, problemSector: null }, token);
    const startDocument = await readServerDocument(db, "users", uid, "cloudSave", "manifest"); publish({ restoreStage: "validate-manifest-start" }, token);
    const startRaw = startDocument.exists() ? startDocument.data() : null, manifestStart = core.validateManifest(startRaw, uid);
    publish({ restoreStage: "read-sectors", cloudRevision: manifestStart.revision, manifestRevisionStart: manifestStart.revision }, token);
    const sectorPath = (name) => manifestStart.cloudCommitId ? ["users", uid, "saveCommits", manifestStart.cloudCommitId, "sectors", name] : ["users", uid, "saveSectors", name];
    const hallPath = (teamId) => manifestStart.cloudCommitId ? ["users", uid, "saveCommits", manifestStart.cloudCommitId, "hallOfFame", teamId] : ["users", uid, "hallOfFame", teamId];
    const documents = await Promise.all(core.SECTOR_NAMES.map((name) => readServerDocument(db, ...sectorPath(name))));
    const payloads = {}; let validationError = null, hallIndex = null, hallPayloads = [];
    try {
      publish({ restoreStage: "validate-sectors" }, token);
      for (let i = 0; i < core.SECTOR_NAMES.length; i += 1) { const name = core.SECTOR_NAMES[i]; payloads[name] = await core.validateSectorDocument(name, documents[i].exists() ? documents[i].data() : null, manifestStart); }
      publish({ restoreStage: "validate-hall-index" }, token); hallIndex = core.validateHallIndex(payloads.hall_index, manifestStart);
      publish({ restoreStage: "read-hall" }, token); const hallDocuments = await Promise.all(hallIndex.teamIds.map((teamId) => readServerDocument(db, ...hallPath(teamId))));
      publish({ status: "verifying", restoreStage: "validate-hall", restoreReadCount: core.SECTOR_NAMES.length + 2 + hallDocuments.length }, token);
      for (let i = 0; i < hallIndex.teamIds.length; i += 1) hallPayloads.push(await core.validateHallDocument(hallIndex.teamIds[i], hallDocuments[i].exists() ? hallDocuments[i].data() : null, manifestStart));
    } catch (error) { error.restoreStage = state.restoreStage; validationError = error; }
    publish({ restoreStage: "read-manifest-end" }, token); const endDocument = await readServerDocument(db, "users", uid, "cloudSave", "manifest");
    const endRaw = endDocument.exists() ? endDocument.data() : null, manifestEnd = core.validateManifest(endRaw, uid), stable = manifestBundleIdentity(manifestStart) === manifestBundleIdentity(manifestEnd);
    publish({ manifestRevisionEnd: manifestEnd.revision, restoreReadCount: core.SECTOR_NAMES.length + 2 + (hallIndex?.teamIds.length || 0) }, token);
    if (!stable) { if (attempt < maxAttempts) continue; throw restoreError("cloud-changed-during-download", "manifest"); }
    if (validationError) throw validationError;
    cachedManifest = { uid, token, raw: endRaw, data: manifestEnd };
    return { manifest: manifestEnd, payloads, hallPayloads };
  }
  throw restoreError("cloud-changed-during-download", "manifest");
}
async function downloadCloudBundleForJournal(journal, token) {
  if (!journal.targetCloudCommitId) throw restoreError("restore-journal-repair-needed", "manifest");
  const db = globalThis.InazumaAccount.getFirestoreInstance(), uid = journal.uid, commitId = journal.targetCloudCommitId;
  const manifestDoc = await readServerDocument(db, "users", uid, "saveCommits", commitId, "metadata", "manifest");
  if (!manifestDoc.exists()) throw restoreError("restore-journal-repair-needed", "manifest");
  const manifest = core.validateManifest(manifestDoc.data(), uid);
  if (manifest.cloudCommitId !== commitId || manifest.revision !== journal.targetCloudRevision || manifestBundleIdentity(manifest) !== journal.targetManifestIdentity) throw restoreError("restore-journal-repair-needed", "manifest");
  const documents = await Promise.all(core.SECTOR_NAMES.map((name) => readServerDocument(db, "users", uid, "saveCommits", commitId, "sectors", name))), payloads = {};
  for (let i = 0; i < core.SECTOR_NAMES.length; i += 1) payloads[core.SECTOR_NAMES[i]] = await core.validateSectorDocument(core.SECTOR_NAMES[i], documents[i].exists() ? documents[i].data() : null, manifest);
  const hallIndex = core.validateHallIndex(payloads.hall_index, manifest), hallDocs = await Promise.all(hallIndex.teamIds.map((teamId) => readServerDocument(db, "users", uid, "saveCommits", commitId, "hallOfFame", teamId))), hallPayloads = [];
  for (let i = 0; i < hallIndex.teamIds.length; i += 1) hallPayloads.push(await core.validateHallDocument(hallIndex.teamIds[i], hallDocs[i].exists() ? hallDocs[i].data() : null, manifest));
  return { manifest, payloads, hallPayloads };
}

async function reconcile(uid, id, manifest, prepared, token) {
  const metadata = readMetadata(uid, id); const localHashes = Object.fromEntries(core.SECTOR_NAMES.map((name) => [name, sectorHash(prepared, name)]));
  const base = { revision: manifest.revision, cloudRevision: manifest.revision, localRevision: metadata?.revision ?? null, hallOfFameCount: manifest.sectors.hallOfFameCount, lastCompletedAt: new Date().toISOString(), localProgressSummary: core.inspectLocalProgress(prepared.snapshot).summary, error: null, problemSector: null };
  if (!metadata) { const progress = core.inspectLocalProgress(prepared.snapshot); if (hashesMatchManifest(manifest, prepared)) { const repaired = metadataFrom(uid, id, manifest, prepared); writeMetadata(uid, repaired); publish({ ...base, status: "synced", localRevision: manifest.revision, lastSyncedAt: repaired.lastSyncedAt }, token); } else publish({ ...base, status: progress.meaningful ? "local-conflict" : "cloud-available" }, token); return; }
  if (manifest.revision > metadata.revision) {
    if (hashesMatchManifest(manifest, prepared)) { const result = await globalThis.InazumaCloudMetadataProtocol.repair({ manifest, prepared, metadata, matches: hashesMatchManifest, build: (m, p, old) => metadataFrom(uid, id, m, p, old), write: (value) => writeMetadata(uid, value), read: () => readMetadata(uid, id), publish: (patch) => publish({ ...base, ...patch, lastSyncedAt: patch.status === "synced" ? new Date().toISOString() : null }, token) }); if (result.status !== "synced") publish({ ...base, status: "sync-error", error: "metadata-repair-needed", localRevision: metadata.revision }, token); return; }
    if (!metadata.sectorHashes || !metadata.hallTeamHashes) { publish({ ...base, status: "local-conflict" }, token); return; }
    const unchanged = core.SECTOR_NAMES.every((name) => localHashes[name] === metadata.sectorHashes[name]) && prepared.hallEntries.every((entry) => metadata.hallTeamHashes[entry.hallTeamId] === entry.payloadHash) && metadata.hallTeamIds.length === prepared.hallEntries.length;
    publish({ ...base, status: unchanged ? "cloud-update-available" : "local-conflict" }, token); return;
  }
  if (manifest.revision !== metadata.revision) { publish({ ...base, status: "local-conflict" }, token); return; }
  const divergent = core.SECTOR_NAMES.filter((name) => localHashes[name] !== manifest.sectorHashes[name]);
  if (!divergent.length) { const upgraded = metadataFrom(uid, id, manifest, prepared, metadata); writeMetadata(uid, upgraded); publish({ ...base, status: "synced", lastSyncedAt: upgraded.lastSyncedAt, localRevision: manifest.revision }, token); return; }
  divergent.forEach((name) => dirtySectors.add(name)); scheduleSync(token);
}

async function associateLocalSave({ force = false } = {}) {
  if (guard()?.isBlocked()) return null;
  if (associationInFlight) return associationInFlight; const auth = globalThis.InazumaAccount?.getState();
  if (auth?.status !== "authenticated" || !auth.uid || !auth.profileComplete) return null; const uid = auth.uid;
  if (!force && automaticUid === uid) return null; automaticUid = uid; const token = generation, id = deviceId(); publish({ ...initial, status: "checking", uid, deviceId: id }, token);
  let progress = null;
  associationInFlight = (async () => { try { await globalThis.InazumaAccount.ready; const db = globalThis.InazumaAccount.getFirestoreInstance(); const manifestDocument = await readDocument(db, "users", uid, "cloudSave", "manifest");
    const prepared = await prepareStableLocalSnapshot();
    progress = core.inspectLocalProgress(prepared.snapshot);
    if (manifestDocument.exists()) { const raw = manifestDocument.data(), manifest = core.validateManifest(raw, uid); cachedManifest = { uid, token, raw, data: manifest };
      const interrupted = readRestoreJournal(uid);
      if (interrupted?.uid === uid) { publish({ status: "restore-error", restoreStage: interrupted.stage, error: "restore-recovery-required" }, token); await restoreCloudSave({ explicitConflict: true, restoreType: interrupted.restoreType || "journal-recovery" }); return; }
      await reconcile(uid, id, manifest, prepared, token); return; }
    if (!progress.meaningful) { automaticUid = null; publish({ status: "awaiting-local-save", localProgressSummary: progress.summary, error: null, problemSector: null }, token); return; }
    publish({ status: "uploading" }, token); const raw = await upload(uid, id, prepared, db), manifest = core.validateManifest(raw, uid); cachedManifest = { uid, token, raw, data: manifest }; const metadata = metadataFrom(uid, id, manifest, prepared); writeMetadata(uid, metadata); publish({ status: "synced", revision: 1, localRevision: 1, cloudRevision: 1, hallOfFameCount: prepared.hallEntries.length, lastSyncedAt: metadata.lastSyncedAt }, token);
  } catch (error) { const manifestProblem = error?.problemSector === "manifest" || error?.code === "unsupported-cloud-schema"; console.warn("Cloud association:", { code: error?.code || "association-failed", problemSector: error?.problemSector || null, localProgressReasons: progress?.reasons || [] }); publish({ status: manifestProblem ? "restore-error" : "error", error: error?.code || "association-failed", problemSector: error?.problemSector || null }, token); } finally { associationInFlight = null; } })(); return associationInFlight;
}

async function syncNow() {
  if (guard()?.isBlocked()) return null;
  if (syncInFlight) return syncInFlight; if (!dirtySectors.size || !cachedManifest || ["sync-conflict", "local-conflict", "cloud-update-available"].includes(state.status)) return null;
  clearTimer(); const token = generation, uid = cachedManifest.uid, id = deviceId(), cycle = new Set(dirtySectors); let attemptedRevision = null; cycle.forEach((name) => dirtySectors.delete(name));
  syncInFlight = (async () => { try { if (!current(token, uid)) return; const prepared = await prepareStableLocalSnapshot(); core.preflight(prepared); const old = cachedManifest.data;
    const changed = [...cycle].filter((name) => sectorHash(prepared, name) !== old.sectorHashes[name]);
    if (!changed.length) { if (state.error === "metadata-repair-needed") await repairCommittedMetadata(uid, id, old, token); else publish({ status: "synced", pendingSectors: [...dirtySectors] }, token); return; }
    publish({ status: "syncing", pendingSectors: [...new Set([...changed, ...dirtySectors])], error: null }, token);
    const nextRevision = old.revision + 1; attemptedRevision = nextRevision;
    const db = globalThis.InazumaAccount.getFirestoreInstance(), commitId = newCloudCommitId();
    const committed = await commitBundle(uid, id, prepared, db, old, commitId);
    if (!current(token, uid)) return; cachedManifest.raw = committed; cachedManifest.data = core.validateManifest(committed, uid); const metadata = metadataFrom(uid, id, cachedManifest.data, prepared, readMetadata(uid, id) || {}); try { writeMetadata(uid, metadata); } catch (error) { throw Object.assign(error, { code: "metadata-repair-needed", serverCommitted: true }); } publish({ status: "synced", revision: nextRevision, localRevision: nextRevision, cloudRevision: nextRevision, pendingSectors: [...dirtySectors], lastSyncedAt: metadata.lastSyncedAt, error: null }, token);
  } catch (error) { cycle.forEach((name) => dirtySectors.add(name)); console.warn("Cloud autosync:", { code: error?.code || "sync-failed", attemptedRevision, pendingSectors: [...cycle] }); const conflict = ["permission-denied", "failed-precondition", "cloud-cas-conflict"].includes(error?.code); publish({ status: conflict ? "sync-conflict" : "sync-error", pendingSectors: [...dirtySectors], error: error?.code || "sync-failed", attemptedRevision, localRevision: cachedManifest?.data?.revision ?? null }, token); }
  finally { syncInFlight = null; if (dirtySectors.size && !["sync-conflict", "sync-error", "local-conflict", "cloud-update-available"].includes(state.status)) scheduleSync(token); } })(); return syncInFlight;
}
function retrySync() { if (state.status !== "sync-error") return null; return syncNow(); }
function onLocalSave(event) { if (guard()?.isBlocked()) return; const sector = event?.detail?.sector; if (!core.SECTOR_NAMES.includes(sector)) return; if (state.status === "awaiting-local-save") { associateLocalSave({ force: true }); return; } if (!cachedManifest || state.uid !== cachedManifest.uid || ["sync-conflict", "local-conflict", "cloud-update-available"].includes(state.status)) return; dirtySectors.add(sector); scheduleSync(); }

function logicalRunJson(run) { if (run === null) return "null"; const logical = core.clone(run); delete logical.storageGeneration; delete logical.storageCommitId; return core.stableSerialize(logical); }
function captureRunProvenance() { return Object.fromEntries(globalThis.InazumaCloudRestoreProtocol.RUN_IDS.map((seasonId) => { const d = globalThis.RunStorage?.diagnostics?.(seasonId) || {}; return [seasonId, { generation: d.canonicalGeneration || 0, commitId: d.canonicalCommitId || null, state: d.canonicalState || "empty-or-corrupt", runId: d.canonicalRunId || null }]; })); }
function restoreAdapters(uid, id, token, journal) {
  const options = { suppressCloudEvent: true, restoreOwnershipToken: journal.operationId };
  const snapshotNow = () => core.readLocalSnapshot();
  const assertActive = () => { const auth = globalThis.InazumaAccount?.getState(); if (auth?.status !== "authenticated" || auth.uid !== uid || token !== generation) throw restoreError("restore-ownership-lost"); };
  return {
    assertActive,
    readRun: (seasonId) => globalThis.RunState.load(seasonId, { readOnly: true }), runGeneration: (seasonId) => Number(globalThis.RunStorage.diagnostics(seasonId).canonicalGeneration || 0),
    runEquals: (actual, wanted) => logicalRunJson(actual) === logicalRunJson(wanted),
    assertOwnership: (activeJournal) => { assertActive(); if (guard().readEpoch() !== activeJournal.expectedLocalEpoch) throw restoreError("restore-ownership-lost"); guard().assertWritable(options); },
    applyRun: (seasonId, wanted) => { const expectedGeneration = Number(globalThis.RunStorage.diagnostics(seasonId).canonicalGeneration || 0); if (wanted === null) return globalThis.RunState.forceDeleteForRestore(seasonId, { ...options, expectedGeneration }); return globalThis.RunState.forceReplaceCanonicalFromSnapshot(core.clone(wanted), { ...options, preserveTimestamps: true, expectedGeneration }); },
    storeEquals: async (name, target) => { const current = snapshotNow(); if (name === "profile") return core.stableSerialize(current.profile) === core.stableSerialize(target.profile); if (name === "album") return core.stableSerialize(current.album) === core.stableSerialize(target.album); if (name === "development") return core.stableSerialize(current.development) === core.stableSerialize(target.development); return core.stableSerialize(current.hallOfFame) === core.stableSerialize(target.hallOfFame); },
    applyStore: (name, target) => { if (name === "profile") return globalThis.RunState.restoreProfile(target.profile, options); if (name === "album") return globalThis.AlbumProgress.write(core.clone(target.album), options); if (name === "development") return globalThis.DevelopmentV2.write(core.clone(target.development), options); return globalThis.HallOfFameStorage._saveArchive({ schemaVersion: target.hallOfFame.archiveSchemaVersion, updatedAt: target.hallOfFame.updatedAt, teams: core.clone(target.hallOfFame.teams), index: core.clone(target.hallOfFame.index) }, { ...options, preserveTimestamp: true }); },
    verify: async (target) => (await core.compareSnapshots(target, snapshotNow())).equivalent,
    writeMetadata: async (manifest, target) => { assertActive(); const prepared = await core.prepareSnapshot(target), metadata = metadataFrom(uid, id, manifest, prepared, readMetadata(uid, id) || {}); metadata.restoredAt = metadata.lastSyncedAt; writeMetadata(uid, metadata); if (readMetadata(uid, id)?.revision !== manifest.revision) throw restoreError("metadata-repair-needed"); }
  };
}
async function runRestoreRecovery({ uid, token, id, journal, bundle = null }) {
  bundle ||= await downloadCloudBundleForJournal(journal, token);
  if (manifestBundleIdentity(bundle.manifest) !== journal.targetManifestIdentity) throw restoreError("restore-journal-repair-needed", "manifest");
  if (globalThis.InazumaAccount?.getState()?.uid !== uid || token !== generation) throw restoreError("restore-ownership-lost");
  cachedManifest = { uid, token, raw: bundle.manifest, data: bundle.manifest };
  const target = { manifest: bundle.manifest, snapshot: core.reconstructSnapshot(bundle.payloads, bundle.hallPayloads) };
  const result = await globalThis.InazumaCloudRestoreProtocol.recover({ journal, loadTarget: async () => target, writeJournal: (next) => writeRestoreJournal(next, next.stage), clearJournal: () => clearRestoreJournal(uid), adapters: restoreAdapters(uid, id, token, journal), onBlocked: (active) => { guard().setBlocked({ uid, operationId: active.operationId, stage: active.stage, status: "running" }); publish({ status: "restoring", restoreStage: active.stage }, token); }, onComplete: (active) => guard().clearBlocked(active.operationId) });
  publish({ status: result.status, restoreStage: result.journal.stage, revision: target.manifest.revision, localRevision: target.manifest.revision, cloudRevision: target.manifest.revision, error: result.status === "restored" ? null : "restore-journal-clear-needed" }, token);
  if (result.status === "restored") globalThis.PersistenceBootstrapGate?.notify?.();
  return result;
}
async function resumeInterruptedRestore(journalOverride = null) {
  if (restoreInFlight) return restoreInFlight;
  const auth = globalThis.InazumaAccount?.getState(), uid = auth?.uid, token = generation; if (auth?.status !== "authenticated" || !uid) return null;
  let journal; try { journal = journalOverride || readRestoreJournal(uid); } catch (error) { publish({ status: "restore-error", error: error?.code || "restore-journal-unavailable" }, token); return null; }
  if (!journal || journal.uid !== uid) return null;
  restoreInFlight = (async () => { try { return await runRestoreRecovery({ uid, token, id: deviceId(), journal }); } catch (error) { publish({ status: error?.code === "restore-journal-repair-needed" ? "restore-repair-needed" : "restore-error", error: error?.code || "restore-failed", problemSector: error?.problemSector || null }, token); throw error; } finally { restoreInFlight = null; } })();
  return restoreInFlight;
}
async function restoreCloudSave(options = {}) {
  const auth = globalThis.InazumaAccount?.getState(), uid = auth?.uid, token = generation; if (!uid) return null;
  const interrupted = readRestoreJournal(uid); if (interrupted) return resumeInterruptedRestore(interrupted);
  if (restoreInFlight) return restoreInFlight; if (!options.explicitConflict && !["cloud-available", "cloud-update-available", "restore-error", "restore-repair-needed"].includes(state.status)) return null;
  const cached = cachedManifest; if (!cached || cached.uid !== uid || cached.token !== token) return null;
  const id = deviceId(), before = core.readLocalSnapshot(); if (!options.explicitConflict && state.status !== "cloud-update-available" && core.inspectLocalProgress(before).meaningful) { publish({ status: "local-conflict" }, token); return null; }
  lastRestoreType = options.restoreType || (options.explicitConflict ? "explicit-conflict-cloud" : state.status === "cloud-update-available" ? "cloud-update" : "initial");
  restoreInFlight = (async () => { try { const bundle = await downloadStableCloudBundle({ uid, token }), prepared = await core.prepareSnapshot(core.reconstructSnapshot(bundle.payloads, bundle.hallPayloads)); let journal = globalThis.InazumaCloudRestoreProtocol.createJournal({ operationId: globalThis.crypto?.randomUUID?.() || `restore-${Date.now()}`, uid, restoreType: lastRestoreType, targetCloudRevision: bundle.manifest.revision, targetCloudCommitId: bundle.manifest.cloudCommitId || null, targetManifestIdentity: manifestBundleIdentity(bundle.manifest), sourceRunProvenance: captureRunProvenance(), targetRunHashes: Object.fromEntries(globalThis.InazumaCloudRestoreProtocol.RUN_IDS.map((sid) => [sid, prepared.hashes[`run_${sid}`]])), sourceLocalEpoch: guard().readEpoch(), expectedLocalEpoch: guard().readEpoch(), startedAt: new Date().toISOString() }); journal = writeRestoreJournal(journal, "prepared"); return await runRestoreRecovery({ uid, token, id, journal, bundle }); } catch (error) { publish({ status: "restore-error", error: error?.code || "restore-failed", problemSector: error?.problemSector || null }, token); throw error; } finally { restoreInFlight = null; } })(); return restoreInFlight;
}
function recoveryRoute(auth) { return globalThis.CloudRestoreResumeCoordinator.route({ auth, readJournal: readRestoreJournal, resumeInterrupted: resumeInterruptedRestore, normalAssociate: () => auth?.profileComplete ? associateLocalSave() : null, publish: (patch) => publish(patch), onWritable: () => globalThis.PersistenceBootstrapGate?.notify?.() }); }
function retryRestore() { const auth = globalThis.InazumaAccount?.getState(); return globalThis.CloudRestoreResumeCoordinator.retry({ auth, readJournal: readRestoreJournal, resumeInterrupted: resumeInterruptedRestore, normalAssociate: () => restoreCloudSave({ explicitConflict: true, restoreType: lastRestoreType }), publish: (patch) => publish(patch), onWritable: () => globalThis.PersistenceBootstrapGate?.notify?.() }); }
function requestConflictResolution(choice) { if (state.status !== "local-conflict" || conflictInFlight) return false; if (choice === "local") return publish({ status: "conflict-confirm-local" }); if (choice === "cloud") return publish({ status: "conflict-confirm-cloud" }); return false; }
async function resolveConflictUseLocal() {
  if (conflictInFlight) return conflictInFlight; if (state.status !== "conflict-confirm-local" || !cachedManifest) return null;
  const token = generation, uid = cachedManifest.uid, cached = cachedManifest, id = deviceId();
  conflictInFlight = (async () => { let attemptedRevision = null; try {
    if (!current(token, uid)) return; publish({ status: "conflict-resolving-local", error: null }, token);
    const prepared = await prepareStableLocalSnapshot(); core.preflight(prepared); if (!current(token, uid)) return;
    const old = cached.data, nextRevision = old.revision + 1; attemptedRevision = nextRevision;
    const db = globalThis.InazumaAccount.getFirestoreInstance(), commitId = newCloudCommitId();
    const committed = await commitBundle(uid, id, prepared, db, old, commitId);
    if (!current(token, uid)) return; cached.raw = committed; cached.data = core.validateManifest(committed, uid); const metadata = metadataFrom(uid, id, cached.data, prepared, readMetadata(uid, id) || {}); try { writeMetadata(uid, metadata); } catch (error) { throw Object.assign(error, { code: "metadata-repair-needed", serverCommitted: true }); } dirtySectors.clear(); publish({ status: "synced", revision: nextRevision, localRevision: nextRevision, cloudRevision: nextRevision, pendingSectors: [], lastSyncedAt: metadata.lastSyncedAt, error: null }, token);
  } catch (error) { const stale = ["permission-denied", "failed-precondition", "cloud-cas-conflict"].includes(error?.code); publish({ status: stale ? "sync-conflict" : "sync-error", error: error?.code || "conflict-resolution-failed", attemptedRevision }, token); } finally { conflictInFlight = null; } })(); return conflictInFlight;
}
async function resolveConflictUseCloud() { if (conflictInFlight) return conflictInFlight; if (state.status !== "conflict-confirm-cloud") return null; const token = generation; publish({ status: "conflict-resolving-cloud", error: null }, token); conflictInFlight = restoreCloudSave({ explicitConflict: true }); try { return await conflictInFlight; } finally { conflictInFlight = null; } }
function updateFromCloud() { return state.status === "cloud-update-available" ? restoreCloudSave() : null; }
function checkForCloudUpdate() {
  if (guard()?.isBlocked()) return null;
  if (checkInFlight) return checkInFlight;
  if (!["synced", "associated", "sync-conflict"].includes(state.status) || !cachedManifest) return null;
  const token = generation, uid = cachedManifest.uid, id = deviceId();
  checkInFlight = (async () => { try {
    const db = globalThis.InazumaAccount.getFirestoreInstance(), manifestDocument = await readServerDocument(db, "users", uid, "cloudSave", "manifest");
    if (!current(token, uid)) return; const raw = manifestDocument.exists() ? manifestDocument.data() : null, manifest = core.validateManifest(raw, uid), prepared = await core.prepareSnapshot(core.readLocalSnapshot());
    cachedManifest = { uid, token, raw, data: manifest }; await reconcile(uid, id, manifest, prepared, token);
  } catch (error) { console.warn("Cloud update check:", error?.code || "check-failed"); publish({ status: "sync-error", error: error?.code || "check-failed" }, token); }
  finally { checkInFlight = null; } })(); return checkInFlight;
}
function reloadAfterRestore() { if (state.status !== "restored" || reloadUsed) return false; reloadUsed = true; globalThis.location.reload(); return true; }
function authChanged(event) {
  const auth = event?.detail || globalThis.InazumaAccount?.getState(), sameUid = auth?.status === "authenticated" && auth.uid && state.uid === auth.uid;
  globalThis.PersistenceBootstrapGate?.markAuth?.(auth);
  if (sameUid) { if (!associationInFlight && !restoreInFlight) void recoveryRoute(auth)?.catch?.(() => {}); return; }
  generation += 1; clearTimer(); associationInFlight = null; syncInFlight = null; checkInFlight = null; conflictInFlight = null; cachedManifest = null; dirtySectors = new Set(); reloadUsed = false;
  if (auth?.status === "authenticated" && auth.uid) { publish({ ...initial, uid: auth.uid }); void recoveryRoute(auth)?.catch?.(() => {}); }
  else if (auth?.status === "signed-out") { automaticUid = null; publish({ ...initial, status: "signed-out" }); }
  else publish({ ...initial, uid: auth?.uid || null });
}
globalThis.addEventListener("inazuma:auth-state-changed", authChanged); globalThis.addEventListener("inazuma:local-save-committed", onLocalSave); globalThis.addEventListener("online", () => { if (state.status === "sync-error") scheduleSync(); }, { passive: true });
const ready = Promise.resolve(globalThis.InazumaAccount?.ready).then(() => authChanged());
globalThis.InazumaCloudSave = Object.freeze({ ready, getState: () => ({ ...state, pendingSectors: [...dirtySectors] }), associateLocalSave, resumeInterruptedRestore, retryAssociation: () => { automaticUid = null; return associateLocalSave({ force: true }); }, syncNow, retrySync, checkForCloudUpdate, updateFromCloud, restoreCloudSave, retryRestore, requestConflictResolution, resolveConflictUseLocal, resolveConflictUseCloud, reloadAfterRestore });
