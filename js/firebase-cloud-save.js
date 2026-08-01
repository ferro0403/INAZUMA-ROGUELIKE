import { doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const core = globalThis.InazumaCloudSaveCore;
const DEVICE_KEY = "inazuma.cloud.deviceId";
const initial = { status: "idle", uid: null, revision: null, deviceId: null, error: null, problemSector: null, hallOfFameCount: 0, lastCompletedAt: null, localProgressSummary: null, restoreReadCount: 0 };
let state = { ...initial };
let generation = 0;
let associationInFlight = null;
let restoreInFlight = null;
let automaticUid = null;
let cachedManifest = null;
let reloadUsed = false;

function deviceId() {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `device-${Date.now().toString(36)}-${Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    localStorage.setItem(DEVICE_KEY, value);
  }
  return value;
}
function publish(patch, token = generation) {
  if (token !== generation) return false;
  state = { ...state, ...patch };
  globalThis.dispatchEvent(new CustomEvent("inazuma:cloud-save-state-changed", { detail: { ...state } }));
  return true;
}
function current(token, uid) {
  const auth = globalThis.InazumaAccount?.getState();
  return token === generation && auth?.status === "authenticated" && auth.uid === uid && cachedManifest?.uid === uid && cachedManifest.token === token;
}
function association(uid, id, revision) {
  try {
    const value = JSON.parse(localStorage.getItem(`inazuma.cloud.association.${uid}`) || "null");
    return value?.uid === uid && value.deviceId === id && value.revision === revision && value.status === "associated" ? value : null;
  } catch (_) { return null; }
}
function sectorDocument(name, payload, payloadHash, id, timestamp) { return { schemaVersion: 1, revision: 1, sector: name, payload, payloadHash, updatedAt: timestamp, sourceDeviceId: id }; }

async function upload(uid, id, prepared, db) {
  core.preflight(prepared);
  const timestamp = serverTimestamp();
  const halls = prepared.hallEntries.map((entry) => ({ ref: doc(db, "users", uid, "hallOfFame", entry.hallTeamId), data: { schemaVersion: 1, revision: 1, ...entry, updatedAt: timestamp, sourceDeviceId: id } }));
  const sectors = core.SECTOR_NAMES.map((name) => { const absent = (name === "run_ie1" || name === "run_ie2") && prepared.payloads[name] === null; return { ref: doc(db, "users", uid, "saveSectors", name), data: sectorDocument(name, prepared.payloads[name], absent ? null : prepared.hashes[name], id, timestamp) }; });
  const finalOperations = [...sectors, { ref: doc(db, "users", uid, "cloudSave", "manifest"), data: core.buildManifest(prepared, uid, id, timestamp) }];
  if (halls.length + finalOperations.length <= 400) { const batch = writeBatch(db); [...halls, ...finalOperations].forEach((operation) => batch.set(operation.ref, operation.data)); await batch.commit(); return; }
  for (let offset = 0; offset < halls.length; offset += 400) { const batch = writeBatch(db); halls.slice(offset, offset + 400).forEach((operation) => batch.set(operation.ref, operation.data)); await batch.commit(); }
  const finalBatch = writeBatch(db); finalOperations.forEach((operation) => finalBatch.set(operation.ref, operation.data)); await finalBatch.commit();
}

async function readDocument(db, ...path) { return getDoc(doc(db, ...path)); }

async function associateLocalSave({ force = false } = {}) {
  if (associationInFlight) return associationInFlight;
  const authState = globalThis.InazumaAccount?.getState();
  if (authState?.status !== "authenticated" || !authState.uid || !authState.profileComplete) return null;
  const uid = authState.uid;
  if (!force && automaticUid === uid) return null;
  automaticUid = uid;
  const token = generation;
  const id = deviceId();
  publish({ ...initial, status: "checking", uid, deviceId: id }, token);
  associationInFlight = (async () => {
    try {
      await globalThis.InazumaAccount.ready;
      const db = globalThis.InazumaAccount.getFirestoreInstance();
      const manifestDocument = await readDocument(db, "users", uid, "cloudSave", "manifest");
      if (manifestDocument.exists()) {
        const manifest = core.validateManifest(manifestDocument.data(), uid);
        cachedManifest = { uid, token, data: manifest };
        const progress = core.inspectLocalProgress(core.readLocalSnapshot());
        const base = { revision: manifest.revision, hallOfFameCount: manifest.sectors.hallOfFameCount, lastCompletedAt: new Date().toISOString(), localProgressSummary: progress.summary, error: null, problemSector: null };
        if (association(uid, id, manifest.revision)) publish({ ...base, status: "associated" }, token);
        else publish({ ...base, status: progress.meaningful ? "local-conflict" : "cloud-available" }, token);
        return;
      }
      publish({ status: "uploading" }, token);
      const prepared = await core.prepareSnapshot(core.readLocalSnapshot());
      core.preflight(prepared);
      await upload(uid, id, prepared, db);
      const completed = new Date().toISOString();
      localStorage.setItem(`inazuma.cloud.association.${uid}`, JSON.stringify({ uid, revision: 1, associatedAt: completed, deviceId: id, status: "associated" }));
      publish({ status: "associated", revision: 1, hallOfFameCount: prepared.hallEntries.length, lastCompletedAt: completed, error: null, problemSector: null }, token);
    } catch (error) {
      const manifestProblem = error?.problemSector === "manifest" || error?.code === "unsupported-cloud-schema";
      console.warn("Cloud save:", error?.code || "association-failed");
      publish({ status: manifestProblem ? "restore-error" : "error", error: error?.code || "association-failed", problemSector: error?.problemSector || null }, token);
    } finally { associationInFlight = null; }
  })();
  return associationInFlight;
}

function applySnapshot(snapshot) {
  globalThis.RunState.restoreProfile(snapshot.profile);
  for (const [seasonId, run] of Object.entries(snapshot.runs)) run === null ? globalThis.RunState.remove(seasonId) : globalThis.RunState.save(core.clone(run), { preserveTimestamps: true });
  globalThis.AlbumProgress.write(core.clone(snapshot.album));
  globalThis.DevelopmentV2.write(core.clone(snapshot.development));
  globalThis.HallOfFameStorage._saveArchive({ schemaVersion: snapshot.hallOfFame.archiveSchemaVersion, updatedAt: snapshot.hallOfFame.updatedAt, teams: core.clone(snapshot.hallOfFame.teams), index: core.clone(snapshot.hallOfFame.index) }, { preserveTimestamp: true });
}
async function rollback(snapshot) {
  applySnapshot(snapshot);
  const comparison = await core.compareSnapshots(snapshot, core.readLocalSnapshot());
  if (!comparison.equivalent) throw Object.assign(new Error("rollback-verification-failed"), { code: "rollback-verification-failed", problemSector: comparison.mismatches[0], mismatchSectors: comparison.mismatches });
}

async function restoreCloudSave() {
  if (restoreInFlight) return restoreInFlight;
  if (state.status !== "cloud-available" && state.status !== "restore-error") return null;
  const auth = globalThis.InazumaAccount?.getState();
  const uid = auth?.uid;
  const token = generation;
  const cached = cachedManifest;
  if (!uid || !cached || cached.uid !== uid || cached.token !== token) return null;
  const id = deviceId();
  const before = core.readLocalSnapshot();
  if (core.inspectLocalProgress(before).meaningful) { publish({ status: "local-conflict", localProgressSummary: core.inspectLocalProgress(before).summary }, token); return null; }
  restoreInFlight = (async () => {
    let writesStarted = false;
    try {
      const db = globalThis.InazumaAccount.getFirestoreInstance();
      const manifest = core.validateManifest(cached.data, uid);
      publish({ status: "downloading", error: null, problemSector: null, restoreReadCount: 0 }, token);
      const documents = await Promise.all(core.SECTOR_NAMES.map((name) => readDocument(db, "users", uid, "saveSectors", name)));
      const rawSectors = Object.fromEntries(core.SECTOR_NAMES.map((name, index) => {
        const item = documents[index]; return [name, item.exists() ? item.data() : null];
      }));
      const payloads = {};
      for (const name of core.SECTOR_NAMES) payloads[name] = await core.validateSectorDocument(name, rawSectors[name], manifest);
      const hallIndex = core.validateHallIndex(payloads.hall_index, manifest);
      const hallDocuments = await Promise.all(hallIndex.teamIds.map((teamId) => readDocument(db, "users", uid, "hallOfFame", teamId)));
      publish({ status: "verifying", restoreReadCount: 6 + hallDocuments.length }, token);
      const hallPayloads = [];
      for (let index = 0; index < hallIndex.teamIds.length; index += 1) {
        const document = hallDocuments[index];
        hallPayloads.push(await core.validateHallDocument(hallIndex.teamIds[index], document.exists() ? document.data() : null, manifest));
      }
      const restored = core.reconstructSnapshot(payloads, hallPayloads);
      if (!current(token, uid)) return;
      publish({ status: "restoring" }, token);
      writesStarted = true;
      applySnapshot(restored);
      const comparison = await core.compareSnapshots(restored, core.readLocalSnapshot());
      if (!comparison.equivalent) throw Object.assign(new Error("post-write-verification-failed"), { code: "post-write-verification-failed", problemSector: comparison.mismatches[0], mismatchSectors: comparison.mismatches });
      if (!current(token, uid)) { await rollback(before); return; }
      const completed = new Date().toISOString();
      localStorage.setItem(`inazuma.cloud.association.${uid}`, JSON.stringify({ uid, revision: manifest.revision, associatedAt: completed, restoredAt: completed, deviceId: id, status: "associated" }));
      publish({ status: "restored", revision: manifest.revision, hallOfFameCount: hallPayloads.length, lastCompletedAt: completed, error: null, problemSector: null }, token);
    } catch (error) {
      if (writesStarted) { try { await rollback(before); } catch (rollbackError) { console.warn("Cloud save:", { code: rollbackError?.code || "rollback-failed", problemSector: rollbackError?.problemSector || null, mismatchSectors: rollbackError?.mismatchSectors || [] }); } }
      localStorage.removeItem(`inazuma.cloud.association.${uid}`);
      console.warn("Cloud save:", { code: error?.code || "restore-failed", problemSector: error?.problemSector || null, mismatchSectors: error?.mismatchSectors || [] });
      publish({ status: "restore-error", error: error?.code || "restore-failed", problemSector: error?.problemSector || null }, token);
    } finally { restoreInFlight = null; }
  })();
  return restoreInFlight;
}

function reloadAfterRestore() {
  if (state.status !== "restored" || reloadUsed) return false;
  reloadUsed = true;
  globalThis.location.reload();
  return true;
}
function authChanged(event) {
  const auth = event?.detail || globalThis.InazumaAccount?.getState();
  generation += 1;
  associationInFlight = null;
  cachedManifest = null;
  reloadUsed = false;
  if (auth?.status === "authenticated" && auth.uid && auth.profileComplete) associateLocalSave();
  else if (auth?.status === "signed-out") { automaticUid = null; publish({ ...initial, status: "signed-out" }); }
  else publish({ ...initial, status: "idle", uid: auth?.uid || null });
}

globalThis.addEventListener("inazuma:auth-state-changed", authChanged);
const ready = Promise.resolve(globalThis.InazumaAccount?.ready).then(() => authChanged());
globalThis.InazumaCloudSave = Object.freeze({ ready, getState: () => ({ ...state }), associateLocalSave, retryAssociation: () => { automaticUid = null; return associateLocalSave({ force: true }); }, restoreCloudSave, retryRestore: restoreCloudSave, reloadAfterRestore });
