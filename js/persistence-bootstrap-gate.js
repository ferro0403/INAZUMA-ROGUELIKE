(function (global) {
  "use strict";
  let settled = false, resolveReady;
  const recoveryReady = new Promise((resolve) => { resolveReady = resolve; });
  function markAuth(auth) {
    if (auth?.status === "authenticated" && auth.uid) global.PersistenceRecoveryGuard.bindUid(auth.uid);
    else if (["signed-out", "unavailable"].includes(auth?.status)) global.PersistenceRecoveryGuard.bindUid(null);
    else return false;
    if (!settled) { settled = true; resolveReady(global.PersistenceRecoveryGuard.getState()); }
    return true;
  }
  function isReady() { return settled; }
  function gameplayReady() { return settled && !global.PersistenceRecoveryGuard.isBlocked(); }
  function whenWritable(callback) {
    let used = false; const run = () => { if (!used && gameplayReady()) { used = true; global.removeEventListener?.("inazuma:persistence-recovery-state-changed", run); callback(); } };
    run(); if (!used) global.addEventListener?.("inazuma:persistence-recovery-state-changed", run); return () => { used = true; global.removeEventListener?.("inazuma:persistence-recovery-state-changed", run); };
  }
  const api = Object.freeze({ recoveryReady, markAuth, isReady, gameplayReady, whenWritable }); global.PersistenceBootstrapGate = api; if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
