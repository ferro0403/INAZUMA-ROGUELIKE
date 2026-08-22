import { doc, getDoc, getDocFromServer, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const core = globalThis.InazumaCloudSaveCore;
const DEVICE_KEY = "inazuma.cloud.deviceId";
const DEBOUNCE_MS = 2000;
const initial = { status: "idle", uid: null, revision: null, deviceId: null, pendingSectors: [], lastSyncedAt: null, error: null, problemSector: null, cloudRevision: null, localRevision: null, manifestRevisionStart: null, manifestRevisionEnd: null, restoreStage: null, hallOfFameCount: 0, lastCompletedAt: null, localProgressSummary: null, restoreReadCount: 0 };
let state = { ...initial }, generation = 0, associationInFlight = null, restoreInFlight = null, syncInFlight = null, checkInFlight = null, conflictInFlight = null;
let automaticUid = null, cachedManifest = null, reloadUsed = false, debounceTimer = null, dirtySectors = new Set(), lastRestoreType = "initial";

function deviceId() { let value = localStorage.getItem(DEVICE_KEY); if (!value) { value = globalThis.crypto?.randomUUID?.() || `device-${Date.now().toString(36)}-${Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`; localStorage.setItem(DEVICE_KEY, value); } return value; }
function metadataKey(uid) { return `inazuma.cloud.association.${uid}`; }
function readMetadata(uid, id) { try { const value = JSON.parse(localStorage.getItem(metadataKey(uid)) || "null"); return value?.uid === uid && value.deviceId === id && value.status === "associated" ? value : null; } catch (_) { return null; } }
function writeMetadata(uid, value) { localStorage.setItem(metadataKey(uid), JSON.stringify(value)); }
function publish(patch, token = generation) { if (token !== generation) return false; state = { ...state, ...patch }; globalThis.dispatchEvent(new CustomEvent("inazuma:cloud-save-state-changed", { detail: { ...state } })); return true; }
function current(token, uid) { const auth = globalThis.InazumaAccount?.getState(); return token === generation && auth?.status === "authenticated" && auth.uid === uid && cachedManifest?.uid === uid && cachedManifest.token === token; }
function sectorHash(prepared, name) { return core.isRunSector(name) && prepared.payloads[name] === null ? null : prepared.hashes[name]; }
function sectorRevisions(manifest) { return Object.fromEntries(core.SECTOR_NAMES.map((name) => [name, manifest.sectorRevisions?.[name] ?? manifest.revision])); }
function metadataFrom(uid, id, manifest, prepared, previous = {}) { const now = new Date().toISOString(); return { uid, deviceId: id, revision: manifest.revision, status: "associated", sectorHashes: Object.fromEntries(core.SECTOR_NAMES.map((name) => [name, sectorHash(prepared, name)])), sectorRevisions: sectorRevisions(manifest), hallTeamIds: prepared.hallEntries.map((entry) => entry.hallTeamId), hallTeamHashes: Object.fromEntries(prepared.hallEntries.map((entry) => [entry.hallTeamId, entry.payloadHash])), hallTeamRevisions: { ...(manifest.hallTeamRevisions || {}) }, associatedAt: previous.associatedAt || now, restoredAt: previous.restoredAt || null, lastSyncedAt: now }; }
function hashesMatchManifest(manifest, prepared) { const localIds = prepared.hallEntries.map((entry) => entry.hallTeamId).sort(), cloudIds = [...(manifest.hallTeamIds || [])].sort(); return core.SECTOR_NAMES.every((name) => sectorHash(prepared, name) === (manifest.sectorHashes?.[name] ?? null)) && JSON.stringify(localIds) === JSON.stringify(cloudIds) && prepared.hallEntries.every((entry) => manifest.hallTeamHashes?.[entry.hallTeamId] === entry.payloadHash); }
function sectorDocument(name, payload, payloadHash, id, timestamp, revision) { return { schemaVersion: 1, revision, sector: name, payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(payload), payloadHash, updatedAt: timestamp, sourceDeviceId: id }; }
function hallDocument(entry, id, timestamp, revision) { return { schemaVersion: 1, revision, hallTeamId: entry.hallTeamId, archiveKey: entry.archiveKey, payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(entry.payload), payloadHash: entry.payloadHash, updatedAt: timestamp, sourceDeviceId: id }; }
function clearTimer() { if (debounceTimer != null) { clearTimeout(debounceTimer); debounceTimer = null; } }
function scheduleSync(token = generation) { clearTimer(); if (!dirtySectors.size || ["sync-conflict", "local-conflict", "cloud-update-available"].includes(state.status)) return; publish({ status: "sync-pending", pendingSectors: [...dirtySectors], error: null }, token); debounceTimer = setTimeout(() => { debounceTimer = null; syncNow(); }, DEBOUNCE_MS); }

async function upload(uid, id, prepared, db) {
  core.preflight(prepared); const timestamp = serverTimestamp(); const batch = writeBatch(db);
  prepared.hallEntries.forEach((entry) => batch.set(doc(db, "users", uid, "hallOfFame", entry.hallTeamId), hallDocument(entry, id, timestamp, 1)));
  core.SECTOR_NAMES.forEach((name) => batch.set(doc(db, "users", uid, "saveSectors", name), sectorDocument(name, prepared.payloads[name], sectorHash(prepared, name), id, timestamp, 1)));
  const manifest = core.buildManifest(prepared, uid, id, timestamp);
  batch.set(doc(db, "users", uid, "cloudSave", "manifest"), manifest);
  await batch.commit(); return manifest;
}
async function readDocument(db, ...path) { return getDoc(doc(db, ...path)); }
async function readServerDocument(db, ...path) { return getDocFromServer(doc(db, ...path)); }

function manifestBundleIdentity(manifest) { return core.stableSerialize(Object.fromEntries(["revision", "sectorHashes", "sectorRevisions", "hallTeamIds", "hallTeamHashes", "hallTeamRevisions", "sectors"].map((key) => [key, manifest[key]]))); }
function restoreError(code, problemSector = null) { return Object.assign(new Error(code), { code, problemSector }); }
async function downloadStableCloudBundle({ uid, token, maxAttempts = 2 }) {
  const db = globalThis.InazumaAccount.getFirestoreInstance();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    publish({ status: "downloading", restoreStage: "read-manifest-start", restoreReadCount: 0, manifestRevisionStart: null, manifestRevisionEnd: null, error: null, problemSector: null }, token);
    const startDocument = await readServerDocument(db, "users", uid, "cloudSave", "manifest"); publish({ restoreStage: "validate-manifest-start" }, token);
    const startRaw = startDocument.exists() ? startDocument.data() : null, manifestStart = core.validateManifest(startRaw, uid);
    publish({ restoreStage: "read-sectors", cloudRevision: manifestStart.revision, manifestRevisionStart: manifestStart.revision }, token);
    const documents = await Promise.all(core.SECTOR_NAMES.map((name) => readServerDocument(db, "users", uid, "saveSectors", name)));
    const payloads = {}; let validationError = null, hallIndex = null, hallPayloads = [];
    try {
      publish({ restoreStage: "validate-sectors" }, token);
      for (let i = 0; i < core.SECTOR_NAMES.length; i += 1) { const name = core.SECTOR_NAMES[i]; payloads[name] = await core.validateSectorDocument(name, documents[i].exists() ? documents[i].data() : null, manifestStart); }
      publish({ restoreStage: "validate-hall-index" }, token); hallIndex = core.validateHallIndex(payloads.hall_index, manifestStart);
      publish({ restoreStage: "read-hall" }, token); const hallDocuments = await Promise.all(hallIndex.teamIds.map((teamId) => readServerDocument(db, "users", uid, "hallOfFame", teamId)));
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

async function reconcile(uid, id, manifest, prepared, token) {
  const metadata = readMetadata(uid, id); const localHashes = Object.fromEntries(core.SECTOR_NAMES.map((name) => [name, sectorHash(prepared, name)]));
  const base = { revision: manifest.revision, cloudRevision: manifest.revision, localRevision: metadata?.revision ?? null, hallOfFameCount: manifest.sectors.hallOfFameCount, lastCompletedAt: new Date().toISOString(), localProgressSummary: core.inspectLocalProgress(prepared.snapshot).summary, error: null, problemSector: null };
  if (!metadata) { const progress = core.inspectLocalProgress(prepared.snapshot); if (hashesMatchManifest(manifest, prepared)) { const repaired = metadataFrom(uid, id, manifest, prepared); writeMetadata(uid, repaired); publish({ ...base, status: "synced", localRevision: manifest.revision, lastSyncedAt: repaired.lastSyncedAt }, token); } else publish({ ...base, status: progress.meaningful ? "local-conflict" : "cloud-available" }, token); return; }
  if (manifest.revision > metadata.revision) {
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
  if (associationInFlight) return associationInFlight; const auth = globalThis.InazumaAccount?.getState();
  if (auth?.status !== "authenticated" || !auth.uid || !auth.profileComplete) return null; const uid = auth.uid;
  if (!force && automaticUid === uid) return null; automaticUid = uid; const token = generation, id = deviceId(); publish({ ...initial, status: "checking", uid, deviceId: id }, token);
  let progress = null;
  associationInFlight = (async () => { try { await globalThis.InazumaAccount.ready; const db = globalThis.InazumaAccount.getFirestoreInstance(); const manifestDocument = await readDocument(db, "users", uid, "cloudSave", "manifest");
    const prepared = await core.prepareSnapshot(core.readLocalSnapshot());
    progress = core.inspectLocalProgress(prepared.snapshot);
    if (manifestDocument.exists()) { const raw = manifestDocument.data(), manifest = core.validateManifest(raw, uid); cachedManifest = { uid, token, raw, data: manifest }; await reconcile(uid, id, manifest, prepared, token); return; }
    if (!progress.meaningful) { automaticUid = null; publish({ status: "awaiting-local-save", localProgressSummary: progress.summary, error: null, problemSector: null }, token); return; }
    publish({ status: "uploading" }, token); const raw = await upload(uid, id, prepared, db), manifest = core.validateManifest(raw, uid); cachedManifest = { uid, token, raw, data: manifest }; const metadata = metadataFrom(uid, id, manifest, prepared); writeMetadata(uid, metadata); publish({ status: "synced", revision: 1, localRevision: 1, cloudRevision: 1, hallOfFameCount: prepared.hallEntries.length, lastSyncedAt: metadata.lastSyncedAt }, token);
  } catch (error) { const manifestProblem = error?.problemSector === "manifest" || error?.code === "unsupported-cloud-schema"; console.warn("Cloud association:", { code: error?.code || "association-failed", problemSector: error?.problemSector || null, localProgressReasons: progress?.reasons || [] }); publish({ status: manifestProblem ? "restore-error" : "error", error: error?.code || "association-failed", problemSector: error?.problemSector || null }, token); } finally { associationInFlight = null; } })(); return associationInFlight;
}

async function syncNow() {
  if (syncInFlight) return syncInFlight; if (!dirtySectors.size || !cachedManifest || ["sync-conflict", "local-conflict", "cloud-update-available"].includes(state.status)) return null;
  clearTimer(); const token = generation, uid = cachedManifest.uid, id = deviceId(), cycle = new Set(dirtySectors); let attemptedRevision = null; cycle.forEach((name) => dirtySectors.delete(name));
  syncInFlight = (async () => { try { if (!current(token, uid)) return; const prepared = await core.prepareSnapshot(core.readLocalSnapshot()); core.preflight(prepared); const old = cachedManifest.data;
    const changed = [...cycle].filter((name) => sectorHash(prepared, name) !== old.sectorHashes[name]);
    if (!changed.length) { publish({ status: "synced", pendingSectors: [...dirtySectors] }, token); return; }
    publish({ status: "syncing", pendingSectors: [...new Set([...changed, ...dirtySectors])], error: null }, token);
    const nextRevision = old.revision + 1, timestamp = serverTimestamp(), revisions = sectorRevisions(old), hashes = { ...old.sectorHashes }, sectors = { ...old.sectors }; attemptedRevision = nextRevision;
    changed.forEach((name) => { revisions[name] = nextRevision; hashes[name] = sectorHash(prepared, name); if (core.isRunSector(name)) sectors[name] = prepared.payloads[name] !== null; });
    const oldIdsKnown = Array.isArray(old.hallTeamIds); const oldIds = old.hallTeamIds || []; let hallIds = oldIds, hallHashes = { ...(old.hallTeamHashes || {}) }, hallRevisions = { ...(old.hallTeamRevisions || {}) };
    const batch = writeBatch(globalThis.InazumaAccount.getFirestoreInstance());
    changed.forEach((name) => batch.set(doc(globalThis.InazumaAccount.getFirestoreInstance(), "users", uid, "saveSectors", name), sectorDocument(name, prepared.payloads[name], sectorHash(prepared, name), id, timestamp, nextRevision)));
    if (changed.includes("hall_index")) { hallIds = prepared.hallEntries.map((entry) => entry.hallTeamId); hallHashes = {}; const currentEntries = new Map(prepared.hallEntries.map((entry) => [entry.hallTeamId, entry]));
      prepared.hallEntries.forEach((entry) => { hallHashes[entry.hallTeamId] = entry.payloadHash; if (old.hallTeamHashes?.[entry.hallTeamId] !== entry.payloadHash) { hallRevisions[entry.hallTeamId] = nextRevision; batch.set(doc(globalThis.InazumaAccount.getFirestoreInstance(), "users", uid, "hallOfFame", entry.hallTeamId), hallDocument(entry, id, timestamp, nextRevision)); } });
      if (oldIdsKnown) oldIds.filter((teamId) => !currentEntries.has(teamId)).forEach((teamId) => { delete hallRevisions[teamId]; batch.delete(doc(globalThis.InazumaAccount.getFirestoreInstance(), "users", uid, "hallOfFame", teamId)); });
      sectors.hallOfFameCount = hallIds.length;
    }
    const manifestPatch = { revision: nextRevision, updatedAt: timestamp, deviceId: id, sourceDeviceId: id, sectors, sectorHashes: hashes, sectorRevisions: revisions, hallTeamIds: hallIds, hallTeamHashes: hallHashes, hallTeamRevisions: hallRevisions };
    batch.update(doc(globalThis.InazumaAccount.getFirestoreInstance(), "users", uid, "cloudSave", "manifest"), manifestPatch); await batch.commit();
    if (!current(token, uid)) return; const logicalPatch = { ...manifestPatch, updatedAt: new Date().toISOString() }; cachedManifest.raw = { ...cachedManifest.raw, ...logicalPatch }; cachedManifest.data = { ...old, ...logicalPatch }; const metadata = metadataFrom(uid, id, cachedManifest.data, prepared, readMetadata(uid, id) || {}); writeMetadata(uid, metadata); publish({ status: "synced", revision: nextRevision, localRevision: nextRevision, cloudRevision: nextRevision, pendingSectors: [...dirtySectors], lastSyncedAt: metadata.lastSyncedAt, error: null }, token);
  } catch (error) { cycle.forEach((name) => dirtySectors.add(name)); console.warn("Cloud autosync:", { code: error?.code || "sync-failed", attemptedRevision, pendingSectors: [...cycle] }); const conflict = error?.code === "permission-denied" || error?.code === "failed-precondition"; publish({ status: conflict ? "sync-conflict" : "sync-error", pendingSectors: [...dirtySectors], error: error?.code || "sync-failed", attemptedRevision, localRevision: cachedManifest?.data?.revision ?? null }, token); }
  finally { syncInFlight = null; if (dirtySectors.size && !["sync-conflict", "sync-error", "local-conflict", "cloud-update-available"].includes(state.status)) scheduleSync(token); } })(); return syncInFlight;
}
function retrySync() { if (state.status !== "sync-error") return null; return syncNow(); }
function onLocalSave(event) { const sector = event?.detail?.sector; if (!core.SECTOR_NAMES.includes(sector)) return; if (state.status === "awaiting-local-save") { associateLocalSave({ force: true }); return; } if (!cachedManifest || state.uid !== cachedManifest.uid || ["sync-conflict", "local-conflict", "cloud-update-available"].includes(state.status)) return; dirtySectors.add(sector); scheduleSync(); }

function logicalRunJson(run) { if (run === null) return "null"; const logical = core.clone(run); delete logical.storageGeneration; delete logical.storageCommitId; return JSON.stringify(logical); }
function applySnapshot(snapshot) { const options = { suppressCloudEvent: true }; globalThis.RunState.restoreProfile(snapshot.profile, options); for (const [seasonId, run] of Object.entries(snapshot.runs)) { if (run === null) globalThis.RunState.forceDeleteForRestore(seasonId, options); else globalThis.RunState.forceReplaceCanonicalFromSnapshot(core.clone(run), { preserveTimestamps: true, ...options }); const applied = globalThis.RunState.load(seasonId, { readOnly: true }); if (logicalRunJson(applied) !== logicalRunJson(run)) throw Object.assign(new Error("run-restore-verification-failed"), { code: "run-restore-verification-failed", problemSector: `run_${seasonId}` }); } globalThis.AlbumProgress.write(core.clone(snapshot.album), options); globalThis.DevelopmentV2.write(core.clone(snapshot.development), options); globalThis.HallOfFameStorage._saveArchive({ schemaVersion: snapshot.hallOfFame.archiveSchemaVersion, updatedAt: snapshot.hallOfFame.updatedAt, teams: core.clone(snapshot.hallOfFame.teams), index: core.clone(snapshot.hallOfFame.index) }, { preserveTimestamp: true, ...options }); }
async function rollback(snapshot) { applySnapshot(snapshot); const comparison = await core.compareSnapshots(snapshot, core.readLocalSnapshot()); if (!comparison.equivalent) throw Object.assign(new Error("rollback-verification-failed"), { code: "rollback-verification-failed", problemSector: comparison.mismatches[0] }); }
async function restoreCloudSave(options = {}) {
  if (restoreInFlight) return restoreInFlight; if (!options.explicitConflict && !["cloud-available", "cloud-update-available", "restore-error"].includes(state.status)) return null; const auth = globalThis.InazumaAccount?.getState(), uid = auth?.uid, token = generation, cached = cachedManifest; if (!uid || !cached || cached.uid !== uid || cached.token !== token) return null;
  const id = deviceId(), before = core.readLocalSnapshot(); if (!options.explicitConflict && state.status !== "cloud-update-available" && core.inspectLocalProgress(before).meaningful) { publish({ status: "local-conflict" }, token); return null; }
  lastRestoreType = options.restoreType || (options.explicitConflict ? "explicit-conflict-cloud" : state.status === "cloud-update-available" ? "cloud-update" : "initial");
  restoreInFlight = (async () => { let writesStarted = false, restoreStage = "read-manifest-start"; try {
    const { manifest, payloads, hallPayloads } = await downloadStableCloudBundle({ uid, token });
    restoreStage = "reconstruct"; publish({ restoreStage }, token); const restored = core.reconstructSnapshot(payloads, hallPayloads); (manifest.legacyMissingRunSectors || []).forEach((sector) => { const seasonId = sector.slice(4); if (before.runs?.[seasonId] != null) restored.runs[seasonId] = core.clone(before.runs[seasonId]); }); if (!current(token, uid)) return;
    restoreStage = "apply-local"; publish({ status: "restoring", restoreStage }, token); writesStarted = true; applySnapshot(restored);
    restoreStage = "verify-local"; publish({ restoreStage }, token); const comparison = await core.compareSnapshots(restored, core.readLocalSnapshot());
    if (!comparison.equivalent) throw Object.assign(new Error("post-write-verification-failed"), { code: "post-write-verification-failed", problemSector: comparison.mismatches[0] });
    if (!current(token, uid)) { restoreStage = "rollback"; publish({ restoreStage }, token); await rollback(before); return; }
    const prepared = await core.prepareSnapshot(restored), metadata = metadataFrom(uid, id, manifest, prepared, readMetadata(uid, id) || {}); metadata.restoredAt = metadata.lastSyncedAt; writeMetadata(uid, metadata);
    publish({ status: "restored", revision: manifest.revision, localRevision: manifest.revision, cloudRevision: manifest.revision, hallOfFameCount: hallPayloads.length, lastSyncedAt: metadata.lastSyncedAt, error: null, problemSector: null }, token);
  } catch (error) {
    restoreStage = error?.restoreStage || state.restoreStage || restoreStage;
    if (writesStarted) try { restoreStage = "rollback"; publish({ restoreStage }, token); await rollback(before); } catch (rollbackError) { error = rollbackError; }
    console.warn("Cloud save:", { code: error?.code || "restore-failed", problemSector: error?.problemSector || null, restoreStage });
    publish({ status: "restore-error", error: error?.code || "restore-failed", problemSector: error?.problemSector || null, restoreStage }, token);
  } finally { restoreInFlight = null; } })(); return restoreInFlight;
}
function retryRestore() { if (state.status !== "restore-error") return null; return restoreCloudSave({ explicitConflict: lastRestoreType === "explicit-conflict-cloud", restoreType: lastRestoreType }); }
function requestConflictResolution(choice) { if (state.status !== "local-conflict" || conflictInFlight) return false; if (choice === "local") return publish({ status: "conflict-confirm-local" }); if (choice === "cloud") return publish({ status: "conflict-confirm-cloud" }); return false; }
async function resolveConflictUseLocal() {
  if (conflictInFlight) return conflictInFlight; if (state.status !== "conflict-confirm-local" || !cachedManifest) return null;
  const token = generation, uid = cachedManifest.uid, cached = cachedManifest, id = deviceId();
  conflictInFlight = (async () => { let attemptedRevision = null; try {
    if (!current(token, uid)) return; publish({ status: "conflict-resolving-local", error: null }, token);
    const prepared = await core.prepareSnapshot(core.readLocalSnapshot()); core.preflight(prepared); if (!current(token, uid)) return;
    const old = cached.data, nextRevision = old.revision + 1, timestamp = serverTimestamp(), revisions = sectorRevisions(old), hashes = { ...old.sectorHashes }, sectors = { ...old.sectors }; attemptedRevision = nextRevision;
    const changed = core.SECTOR_NAMES.filter((name) => sectorHash(prepared, name) !== (old.sectorHashes?.[name] ?? null));
    changed.forEach((name) => { revisions[name] = nextRevision; hashes[name] = sectorHash(prepared, name); if (core.isRunSector(name)) sectors[name] = prepared.payloads[name] !== null; });
    const hallIds = prepared.hallEntries.map((entry) => entry.hallTeamId), hallHashes = {}, hallRevisions = { ...(old.hallTeamRevisions || {}) }, entries = new Map(prepared.hallEntries.map((entry) => [entry.hallTeamId, entry]));
    const db = globalThis.InazumaAccount.getFirestoreInstance(), batch = writeBatch(db);
    changed.forEach((name) => batch.set(doc(db, "users", uid, "saveSectors", name), sectorDocument(name, prepared.payloads[name], sectorHash(prepared, name), id, timestamp, nextRevision)));
    prepared.hallEntries.forEach((entry) => { hallHashes[entry.hallTeamId] = entry.payloadHash; if (old.hallTeamHashes?.[entry.hallTeamId] !== entry.payloadHash) { hallRevisions[entry.hallTeamId] = nextRevision; batch.set(doc(db, "users", uid, "hallOfFame", entry.hallTeamId), hallDocument(entry, id, timestamp, nextRevision)); } });
    (old.hallTeamIds || []).filter((teamId) => !entries.has(teamId)).forEach((teamId) => { delete hallRevisions[teamId]; batch.delete(doc(db, "users", uid, "hallOfFame", teamId)); }); sectors.hallOfFameCount = hallIds.length;
    const manifestPatch = { revision: nextRevision, updatedAt: timestamp, deviceId: id, sourceDeviceId: id, sectors, sectorHashes: hashes, sectorRevisions: revisions, hallTeamIds: hallIds, hallTeamHashes: hallHashes, hallTeamRevisions: hallRevisions };
    batch.update(doc(db, "users", uid, "cloudSave", "manifest"), manifestPatch); await batch.commit();
    if (!current(token, uid)) return; const logicalPatch = { ...manifestPatch, updatedAt: new Date().toISOString() }; cached.raw = { ...cached.raw, ...logicalPatch }; cached.data = { ...old, ...logicalPatch }; const metadata = metadataFrom(uid, id, cached.data, prepared, readMetadata(uid, id) || {}); writeMetadata(uid, metadata); dirtySectors.clear(); publish({ status: "synced", revision: nextRevision, localRevision: nextRevision, cloudRevision: nextRevision, pendingSectors: [], lastSyncedAt: metadata.lastSyncedAt, error: null }, token);
  } catch (error) { const stale = error?.code === "permission-denied" || error?.code === "failed-precondition"; publish({ status: stale ? "sync-conflict" : "sync-error", error: error?.code || "conflict-resolution-failed", attemptedRevision }, token); } finally { conflictInFlight = null; } })(); return conflictInFlight;
}
async function resolveConflictUseCloud() { if (conflictInFlight) return conflictInFlight; if (state.status !== "conflict-confirm-cloud") return null; const token = generation; publish({ status: "conflict-resolving-cloud", error: null }, token); conflictInFlight = restoreCloudSave({ explicitConflict: true }); try { return await conflictInFlight; } finally { conflictInFlight = null; } }
function updateFromCloud() { return state.status === "cloud-update-available" ? restoreCloudSave() : null; }
function checkForCloudUpdate() {
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
function authChanged(event) { const auth = event?.detail || globalThis.InazumaAccount?.getState(); const sameUid = auth?.status === "authenticated" && auth.uid && state.uid === auth.uid; if (sameUid) { if (auth.profileComplete && !associationInFlight && !cachedManifest && automaticUid !== auth.uid && state.status !== "awaiting-local-save") associateLocalSave(); return; } generation += 1; clearTimer(); associationInFlight = null; syncInFlight = null; checkInFlight = null; conflictInFlight = null; cachedManifest = null; dirtySectors = new Set(); reloadUsed = false; if (auth?.status === "authenticated" && auth.uid) { publish({ ...initial, uid: auth.uid }); if (auth.profileComplete) associateLocalSave(); } else if (auth?.status === "signed-out") { automaticUid = null; publish({ ...initial, status: "signed-out" }); } else publish({ ...initial, uid: auth?.uid || null }); }
globalThis.addEventListener("inazuma:auth-state-changed", authChanged); globalThis.addEventListener("inazuma:local-save-committed", onLocalSave); globalThis.addEventListener("online", () => { if (state.status === "sync-error") scheduleSync(); }, { passive: true });
const ready = Promise.resolve(globalThis.InazumaAccount?.ready).then(() => authChanged());
globalThis.InazumaCloudSave = Object.freeze({ ready, getState: () => ({ ...state, pendingSectors: [...dirtySectors] }), associateLocalSave, retryAssociation: () => { automaticUid = null; return associateLocalSave({ force: true }); }, syncNow, retrySync, checkForCloudUpdate, updateFromCloud, restoreCloudSave, retryRestore, requestConflictResolution, resolveConflictUseLocal, resolveConflictUseCloud, reloadAfterRestore });
