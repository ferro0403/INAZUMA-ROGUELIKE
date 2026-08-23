(function (global) {
  "use strict";

  const EPOCH_KEY = "inazuma.persistence.localMutationEpoch";
  let state = { blocked: false, uid: null, operationId: null, stage: null, status: "complete", error: null };

  function failure(error, fallback, stage) {
    const quota = error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014;
    return Object.assign(new Error(quota ? "storage-quota-exceeded" : fallback), { code: quota ? "storage-quota-exceeded" : fallback, stage, cause: error });
  }
  function readEpoch() {
    try { const value = Number(global.localStorage.getItem(EPOCH_KEY) || 0); return Number.isSafeInteger(value) && value >= 0 ? value : 0; }
    catch (error) { throw failure(error, "storage-access-error", "mutation-epoch-read"); }
  }
  function bump(options = {}) {
    if (options.restoreOwnershipToken || options.readOnly) return readEpoch();
    const next = readEpoch() + 1;
    try { global.localStorage.setItem(EPOCH_KEY, String(next)); }
    catch (error) { throw failure(error, "storage-access-error", "mutation-epoch-write"); }
    return next;
  }
  function setBlocked(value = {}) { state = { ...state, ...value, blocked: true, status: value.status || "required" }; return getState(); }
  function clearBlocked(operationId = null) {
    if (operationId && state.operationId && operationId !== state.operationId) throw Object.assign(new Error("restore-ownership-lost"), { code: "restore-ownership-lost" });
    state = { blocked: false, uid: state.uid, operationId: null, stage: "complete", status: "complete", error: null }; return getState();
  }
  function getState() { return { ...state }; }
  function isBlocked() { return state.blocked; }
  function assertWritable(options = {}) {
    if (!state.blocked || (options.restoreOwnershipToken && options.restoreOwnershipToken === state.operationId)) return true;
    throw Object.assign(new Error("restore-recovery-required"), { code: "restore-recovery-required", stage: state.stage, operationId: state.operationId });
  }
  function bindUid(uid) {
    state.uid = uid || null;
    if (!uid) return getState();
    let raw;
    try { raw = global.localStorage.getItem(`inazuma.cloud.restoreJournal.${uid}`); }
    catch (error) { return setBlocked({ uid, status: "safety", stage: "journal-read", error: failure(error, "storage-access-error", "restore-journal-read").code }); }
    if (!raw) return getState();
    try { const journal = JSON.parse(raw); return setBlocked({ uid, operationId: journal.operationId, stage: journal.stage, status: journal.stage === "complete" ? "repair" : "required" }); }
    catch (_) { return setBlocked({ uid, stage: "journal-parse", status: "safety", error: "restore-journal-repair-needed" }); }
  }

  const api = Object.freeze({ EPOCH_KEY, isBlocked, getState, assertWritable, setBlocked, clearBlocked, bindUid, readEpoch, bump, classifyStorageError: failure });
  global.PersistenceRecoveryGuard = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
