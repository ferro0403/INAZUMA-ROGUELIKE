(function (global) {
  "use strict";

  function create({ storage, stateApi = global.RoadToGloryState, seedFactory } = {}) {
    if (!storage) throw new TypeError("RTG storage required");
    if (!stateApi) throw new TypeError("RTG state API required");
    if (typeof seedFactory !== "function") throw new TypeError("RTG seed factory required");

    async function read() {
      const raw = await storage.read();
      return raw == null ? null : stateApi.validate(raw);
    }

    async function ensureCampaign() {
      return storage.update((currentRaw) => {
        if (currentRaw != null) {
          const current = stateApi.validate(currentRaw);
          const match = current.activeMatch;
          const matchEngine = global.RoadToGloryMatchEngine;
          // A reload used to render an active match exactly at its persisted
          // minute without restarting the simulation flow. Advance only when
          // the match is genuinely waiting for the engine: never skip the
          // prematch, a duel, halftime or penalties that require user input.
          if (
            match &&
            match.status === "active" &&
            match.presentation?.preMatchSeen !== false &&
            !match.pendingEncounter &&
            typeof matchEngine?.prepareNext === "function"
          ) {
            current.activeMatch = matchEngine.prepareNext(stateApi.clone(match));
          }
          return stateApi.validate(current);
        }
        return stateApi.validate(stateApi.createInitial({ campaignSeed: seedFactory() }));
      });
    }

    async function update(label, updater) {
      if (typeof updater !== "function") throw new TypeError("RTG updater required");
      return storage.update((currentRaw) => {
        const current = currentRaw == null
          ? stateApi.createInitial({ campaignSeed: seedFactory() })
          : stateApi.validate(currentRaw);
        const next = updater(stateApi.clone(current));
        if (next && typeof next.then === "function") {
          throw Object.assign(new Error("Async RTG updater not supported"), {
            code: "rtg-async-updater-not-supported",
            label,
          });
        }
        return stateApi.validate(next == null ? current : next);
      });
    }

    return Object.freeze({ read, ensureCampaign, update });
  }

  global.RoadToGloryRepository = Object.freeze({ create });
})(globalThis);
