(function (global) {
  "use strict";
  const LOCAL_RUN_ROUTES = new Set(["resume-run", "new-run"]);
  function enter(route, blocked = global.PersistenceRecoveryGuard?.isBlocked?.()) {
    if (LOCAL_RUN_ROUTES.has(route)) return true;
    if (!blocked) return true;
    const detail = { route, recovery: global.PersistenceRecoveryGuard?.getState?.() || null };
    if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("inazuma:restore-gameplay-blocked", { detail }));
    global.InazumaAccountUI?.open?.();
    return false;
  }
  global.RestoreGameplayRoutingGate = Object.freeze({ enter });
  if (typeof module !== "undefined" && module.exports) module.exports = global.RestoreGameplayRoutingGate;
})(globalThis);
