import { doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const core = globalThis.InazumaCloudSaveCore;
const DEVICE_KEY = "inazuma.cloud.deviceId";
const initial = { status: "idle", uid: null, revision: null, deviceId: null, error: null, problemSector: null, hallOfFameCount: 0, lastCompletedAt: null };
let state = { ...initial };
let generation = 0;
let inFlight = null;
let automaticUid = null;

function deviceId() {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `device-${Date.now().toString(36)}-${Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    localStorage.setItem(DEVICE_KEY, value);
  }
  return value;
}
function publish(patch, token = generation) {
  if (token !== generation) return;
  state = { ...state, ...patch };
  globalThis.dispatchEvent(new CustomEvent("inazuma:cloud-save-state-changed", { detail: { ...state } }));
}
function sectorDocument(name, payload, payloadHash, id, timestamp) { return { schemaVersion: 1, revision: 1, sector: name, payload, payloadHash, updatedAt: timestamp, sourceDeviceId: id }; }

async function upload(uid, id, prepared, db) {
  core.preflight(prepared);
  const timestamp = serverTimestamp();
  const halls = prepared.hallEntries.map((entry) => ({ ref: doc(db, "users", uid, "hallOfFame", entry.hallTeamId), data: { schemaVersion: 1, revision: 1, ...entry, updatedAt: timestamp, sourceDeviceId: id } }));
  const sectors = core.SECTOR_NAMES.map((name) => ({ ref: doc(db, "users", uid, "saveSectors", name), data: sectorDocument(name, prepared.payloads[name], prepared.hashes[name], id, timestamp) }));
  const finalOperations = [...sectors, { ref: doc(db, "users", uid, "cloudSave", "manifest"), data: core.buildManifest(prepared, uid, id, timestamp) }];
  if (halls.length + finalOperations.length <= 400) {
    const batch = writeBatch(db); [...halls, ...finalOperations].forEach((operation) => batch.set(operation.ref, operation.data)); await batch.commit(); return;
  }
  for (let offset = 0; offset < halls.length; offset += 400) {
    const batch = writeBatch(db); halls.slice(offset, offset + 400).forEach((operation) => batch.set(operation.ref, operation.data)); await batch.commit();
  }
  const finalBatch = writeBatch(db); finalOperations.forEach((operation) => finalBatch.set(operation.ref, operation.data)); await finalBatch.commit();
}

async function associateLocalSave({ force = false } = {}) {
  if (inFlight) return inFlight;
  const authState = globalThis.InazumaAccount?.getState();
  if (authState?.status !== "authenticated" || !authState.uid || !authState.profileComplete) return null;
  const uid = authState.uid;
  if (!force && automaticUid === uid) return null;
  automaticUid = uid;
  const token = generation;
  const id = deviceId();
  publish({ ...initial, status: "checking", uid, deviceId: id }, token);
  inFlight = (async () => {
    try {
      await globalThis.InazumaAccount.ready;
      const db = globalThis.InazumaAccount.getFirestoreInstance();
      const manifest = await getDoc(doc(db, "users", uid, "cloudSave", "manifest"));
      if (manifest.exists()) {
        const data = manifest.data(); publish({ status: "associated", revision: data.revision || 1, hallOfFameCount: data.sectors?.hallOfFameCount || 0, lastCompletedAt: new Date().toISOString(), error: null }, token); return;
      }
      publish({ status: "uploading" }, token);
      const prepared = await core.prepareSnapshot(core.readLocalSnapshot());
      core.preflight(prepared);
      await upload(uid, id, prepared, db);
      const completed = new Date().toISOString();
      localStorage.setItem(`inazuma.cloud.association.${uid}`, JSON.stringify({ uid, revision: 1, associatedAt: completed, deviceId: id, status: "associated" }));
      publish({ status: "associated", revision: 1, hallOfFameCount: prepared.hallEntries.length, lastCompletedAt: completed, error: null, problemSector: null }, token);
    } catch (error) { publish({ status: "error", error: error?.code || "association-failed", problemSector: error?.problemSector || null }, token); }
    finally { inFlight = null; }
  })();
  return inFlight;
}
function authChanged(event) {
  const auth = event?.detail || globalThis.InazumaAccount?.getState();
  generation += 1;
  if (auth?.status === "authenticated" && auth.uid && auth.profileComplete) associateLocalSave();
  else if (auth?.status === "signed-out") { automaticUid = null; publish({ ...initial, status: "signed-out" }); }
  else publish({ ...initial, status: "idle", uid: auth?.uid || null });
}

globalThis.addEventListener("inazuma:auth-state-changed", authChanged);
const ready = Promise.resolve(globalThis.InazumaAccount?.ready).then(() => authChanged());
globalThis.InazumaCloudSave = Object.freeze({ ready, getState: () => ({ ...state }), associateLocalSave, retryAssociation: () => { automaticUid = null; return associateLocalSave({ force: true }); } });
