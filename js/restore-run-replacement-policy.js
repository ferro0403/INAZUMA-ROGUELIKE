(function (global) {
  "use strict";
  function logical(value) { if (value === null) return "null"; const copy = JSON.parse(JSON.stringify(value)); delete copy.storageGeneration; delete copy.storageCommitId; return JSON.stringify(copy); }
  function decide(local, target, proof = {}) {
    if (logical(local) === logical(target)) return { allowed: true, reason: "equivalent" };
    if (proof.explicitConflictCloud === true) return { allowed: true, reason: "explicit-user-confirmation" };
    if (proof.safeAutomaticReplace === true) return { allowed: true, reason: "verified-unchanged-local-or-empty" };
    return { allowed: false, reason: "continuation-not-proven" };
  }
  const api = Object.freeze({ decide }); global.InazumaRestoreRunReplacementPolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
