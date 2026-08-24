(function (global) {
  "use strict";
  let resolved = false, resolveReady; const waiters = new Set();
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  function markAuth(auth) { if (auth?.status === "authenticated" && auth.uid) global.PersistenceRecoveryGuard?.bindUid(auth.uid); else if (auth?.status === "signed-out") global.PersistenceRecoveryGuard?.bindUid(null); if (!resolved && ["authenticated", "signed-out"].includes(auth?.status)) { resolved = true; resolveReady(auth); } notify(); }
  function notify() { if (global.PersistenceRecoveryGuard?.isBlocked?.()) return false; for (const resolve of waiters) resolve(); waiters.clear(); return true; }
  async function whenWritable() { await ready; if (!global.PersistenceRecoveryGuard?.isBlocked?.()) return true; await new Promise((resolve) => waiters.add(resolve)); return true; }
  global.PersistenceBootstrapGate = Object.freeze({ ready, markAuth, whenWritable, notify });
  if (typeof module !== "undefined" && module.exports) module.exports = global.PersistenceBootstrapGate;
})(globalThis);
