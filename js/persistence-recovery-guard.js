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
  function reserve(options = {}) {
    if (options.restoreOwnershipToken || options.readOnly) return readEpoch();
    const next = readEpoch() + 1;
    try { global.localStorage.setItem(EPOCH_KEY, String(next)); }
    catch (error) { throw failure(error, "storage-access-error", "mutation-epoch-write"); }
    return next;
  }
  const bump = reserve;
  function notify() { if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("inazuma:persistence-recovery-state-changed", { detail: getState() })); }
  function setBlocked(value = {}) { state = { ...state, ...value, blocked: true, status: value.status || "required" }; notify(); return getState(); }
  function clearBlocked(operationId = null) {
    if (operationId && state.operationId && operationId !== state.operationId) throw Object.assign(new Error("restore-ownership-lost"), { code: "restore-ownership-lost" });
    state = { blocked: false, uid: state.uid, operationId: null, stage: "complete", status: "complete", error: null }; notify(); return getState();
  }
  function getState() { return { ...state }; }
  function isBlocked() { return state.blocked; }
  function persistentJournal() {
    if (!state.uid) return null;
    try { const raw = global.localStorage.getItem(`inazuma.cloud.restoreJournal.${state.uid}`); return raw ? JSON.parse(raw) : null; }
    catch (error) { throw failure(error, "storage-access-error", "restore-fence-read"); }
  }
  function assertWritable(options = {}) {
    const journal = persistentJournal();
    if (options.restoreOwnershipToken) {
      if (journal?.uid === state.uid && journal.operationId === options.restoreOwnershipToken && journal.stage !== "complete") return true;
      throw Object.assign(new Error("restore-ownership-lost"), { code: "restore-ownership-lost", operationId: options.restoreOwnershipToken });
    }
    if (!journal && !state.blocked) return true;
    throw Object.assign(new Error("restore-recovery-required"), { code: "restore-recovery-required", stage: journal?.stage || state.stage, operationId: journal?.operationId || state.operationId });
  }
  function bindUid(uid) {
    state = { blocked: false, uid: uid || null, operationId: null, stage: null, status: "complete", error: null };
    if (!uid) { notify(); return getState(); }
    let raw;
    try { raw = global.localStorage.getItem(`inazuma.cloud.restoreJournal.${uid}`); }
    catch (error) { return setBlocked({ uid, status: "safety", stage: "journal-read", error: failure(error, "storage-access-error", "restore-journal-read").code }); }
    if (!raw) { notify(); return getState(); }
    try { const journal = JSON.parse(raw); return setBlocked({ uid, operationId: journal.operationId, stage: journal.stage, status: journal.stage === "complete" ? "repair" : "required" }); }
    catch (_) { return setBlocked({ uid, stage: "journal-parse", status: "safety", error: "restore-journal-repair-needed" }); }
  }

  const api = Object.freeze({ EPOCH_KEY, isBlocked, getState, assertWritable, setBlocked, clearBlocked, bindUid, readEpoch, reserve, bump, persistentJournal, classifyStorageError: failure });
  global.PersistenceRecoveryGuard = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
