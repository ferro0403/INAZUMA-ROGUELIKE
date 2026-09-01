(function (global) {
  "use strict";

  const canonicalId = (candidate) => global.PlayerIdentity.canonicalPlayerId(candidate);

  function uniqueCandidates(candidates) {
    const byId = new Map();
    (candidates || []).forEach((candidate) => {
      const id = canonicalId(candidate);
      if (id && !byId.has(id)) byId.set(id, candidate);
    });
    return [...byId.values()];
  }

  function assertUniqueCandidates(candidates) {
    const ids = (candidates || []).map(canonicalId);
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
      const error = new Error("Pull candidates must have unique canonical playerIds");
      error.code = "pull-candidate-invariant";
      throw error;
    }
    return candidates;
  }

  global.PullInvariants = Object.freeze({ uniqueCandidates, assertUniqueCandidates });
})(globalThis);
