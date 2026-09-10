(function (global) {
  "use strict";

  const baseEffects = global.PermanentEffects;
  const baseRunSave = global.RunState?.save?.bind(global.RunState);
  const baseRunRemove = global.RunState?.remove?.bind(global.RunState);
  const drains = new Map();

  function storage() { return global.AlbumIndexedDbStorage; }
  function albumType() { return baseEffects?.TYPES?.ALBUM || "album-unlock"; }
  function pendingAlbum(run) {
    return (run?.permanentEffectOutbox || []).filter((entry) => entry?.type === albumType() && entry.status === "pending");
  }
  function pendingForSeason(seasonId) {
    try { return pendingAlbum(global.RunState?.load?.(seasonId, { readOnly: true }) || null); }
    catch (_) { return []; }
  }
  function blocker(seasonId) {
    return Object.assign(new Error("La run contiene effetti Album permanenti ancora da confermare"), {
      code: "album-permanent-effect-pending",
      stage: "album-permanent-effect-run-replacement-guard",
      seasonId: String(seasonId || ""),
      recoverable: true,
    });
  }

  async function markApplied(seasonId, effectId, maxAttempts = 5) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const run = global.RunState?.load?.(seasonId, { readOnly: true });
      if (!run) return { applied: false, reason: "run-missing" };
      const effect = (run.permanentEffectOutbox || []).find((entry) => entry.id === effectId);
      if (!effect) return { applied: false, reason: "effect-missing" };
      if (effect.status === "applied") return { applied: true, alreadyApplied: true };
      if (effect.type !== albumType()) return { applied: false, reason: "effect-type-changed" };
      effect.status = "applied";
      effect.appliedAt = new Date().toISOString();
      try {
        baseRunSave(run, { source: "album-indexeddb-effect-marker", effectMarker: effect.id });
        return { applied: true, alreadyApplied: false };
      } catch (error) {
        if (!["stale-write", "write-locked"].includes(error?.code) || attempt === maxAttempts - 1) throw error;
      }
    }
    return { applied: false, reason: "marker-retry-exhausted" };
  }

  async function drainSeason(seasonId) {
    const repository = storage();
    if (!repository?.isAuthority?.()) return { authority: "legacy", applied: [], pending: pendingForSeason(seasonId) };
    const run = global.RunState?.load?.(seasonId, { readOnly: true });
    if (!run) return { authority: "indexeddb", applied: [], pending: [] };
    const applied = [];
    for (const effect of pendingAlbum(run)) {
      await repository.applyUnlock(effect.payload?.collectionId || run.seasonId, effect.payload?.playerId, {
        source: effect.payload?.source || "permanent-effect",
        applicationKey: effect.id,
        operation: "permanent-effect",
      });
      const marker = await markApplied(run.seasonId, effect.id);
      if (marker.applied) applied.push(effect.id);
    }
    const latest = global.RunState?.load?.(seasonId, { readOnly: true });
    return { authority: "indexeddb", applied, pending: pendingAlbum(latest) };
  }

  function requestDrain(seasonId) {
    const sid = String(seasonId || "");
    if (!sid) return Promise.resolve({ applied: [], pending: [] });
    const previous = drains.get(sid) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => drainSeason(sid));
    drains.set(sid, next);
    next.finally(() => { if (drains.get(sid) === next) drains.delete(sid); }).catch(() => {});
    return next;
  }

  async function resumeStoredRuns() {
    if (!storage()?.isAuthority?.()) return { authority: "legacy", seasons: [] };
    const results = [];
    for (const season of global.SeasonRegistry?.list?.() || []) {
      try {
        const run = global.RunState?.load?.(season.id, { readOnly: true });
        if (!pendingAlbum(run).length) continue;
        results.push({ seasonId: season.id, ...(await requestDrain(season.id)) });
      } catch (error) {
        results.push({ seasonId: season.id, error });
      }
    }
    return { authority: "indexeddb", seasons: results };
  }

  function wrappedDrain(run, options = {}) {
    if (!storage()?.isAuthority?.() || !baseEffects?.drain) return baseEffects.drain(run, options);
    const requested = options.types ? new Set(options.types) : null;
    const wantsAlbum = !requested || requested.has(albumType());
    const nonAlbumTypes = requested
      ? [...requested].filter((type) => type !== albumType())
      : [baseEffects.TYPES.DEVELOPMENT, baseEffects.TYPES.HALL].filter(Boolean);
    let result = { run, applied: [], pending: pendingAlbum(run) };
    if (nonAlbumTypes.length) result = baseEffects.drain(run, { ...options, types: nonAlbumTypes });
    if (wantsAlbum && run?.seasonId) {
      void requestDrain(run.seasonId).catch((error) => console.error("Album permanent effect remains pending", error?.code || error));
    }
    return result;
  }

  function installEffectsBridge() {
    if (!baseEffects?.drain) return;
    global.PermanentEffects = Object.freeze({ ...baseEffects, drain: wrappedDrain, resume: wrappedDrain });
  }

  function installRunGuards() {
    if (!global.RunState || !baseRunSave || !baseRunRemove) return;
    global.RunState.save = function guardedRunSave(run, options = {}) {
      if (storage()?.isAuthority?.() && options.replaceRun) {
        const current = global.RunState.load(run?.seasonId, { readOnly: true });
        if (current && current.runId !== run?.runId && pendingAlbum(current).length) {
          void requestDrain(current.seasonId).catch(() => {});
          throw blocker(current.seasonId);
        }
      }
      return baseRunSave(run, options);
    };
    global.RunState.remove = function guardedRunRemove(seasonId = null, options = {}) {
      if (storage()?.isAuthority?.()) {
        const current = global.RunState.load(seasonId, { readOnly: true });
        if (pendingAlbum(current).length) {
          void requestDrain(current.seasonId).catch(() => {});
          throw blocker(current.seasonId);
        }
      }
      return baseRunRemove(seasonId, options);
    };
  }

  if (typeof global.addEventListener === "function") {
    global.addEventListener("inazuma:local-save-committed", (event) => {
      if (event?.detail?.domain !== "run" || !event.detail.seasonId || !storage()?.isAuthority?.()) return;
      void requestDrain(event.detail.seasonId).catch((error) => console.error("Album permanent effect retry failed", error?.code || error));
    });
  }

  installEffectsBridge();
  installRunGuards();

  const api = Object.freeze({ pendingAlbum, requestDrain, drainSeason, resumeStoredRuns, hasPending: (run) => pendingAlbum(run).length > 0 });
  global.AlbumPermanentEffects = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
