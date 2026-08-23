(function (global) {
  "use strict";
  function enter(route, blocked = global.PersistenceBootstrapGate?.isReady?.() === false || global.PersistenceRecoveryGuard?.isBlocked?.()) {
    if (!blocked) return true;
    const detail = { route, recovery: global.PersistenceRecoveryGuard?.getState?.() || null };
    if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("inazuma:restore-gameplay-blocked", { detail }));
    global.InazumaAccountUI?.open?.();
    return false;
  }
  global.RestoreGameplayRoutingGate = Object.freeze({ enter });
  if (typeof module !== "undefined" && module.exports) module.exports = global.RestoreGameplayRoutingGate;
})(globalThis);
