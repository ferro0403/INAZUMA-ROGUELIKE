(function (global) {
  "use strict";

  const TYPES = Object.freeze({ ALBUM: "album-unlock", DEVELOPMENT: "development-run-end", HALL: "hall-champion" });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();

  function outbox(run) {
    if (!Array.isArray(run.permanentEffectOutbox)) run.permanentEffectOutbox = [];
    return run.permanentEffectOutbox;
  }
  function albumId(run, playerId, source, actionId) { return `${run.runId}:album:${source}:${playerId}:${actionId}`; }
  function developmentId(run, endReason) { return `${run.runId}:development:${endReason}`; }
  function hallId(run) { return `${run.runId}:hall:${run.seasonId}`; }
  function enqueue(run, effect) {
    if (!effect?.id || !effect?.type) throw new TypeError("Permanent effect requires a stable id and type");
    const existing = outbox(run).find((item) => item.id === effect.id);
    if (existing) return existing;
    const entry = { id: String(effect.id), type: effect.type, payload: clone(effect.payload || {}), status: "pending", createdAt: effect.createdAt || now(), appliedAt: null };
    outbox(run).push(entry);
    return entry;
  }
  function enqueueAlbum(run, { playerId, source, actionId }) {
    const stableAction = String(actionId || `${source}:${playerId}`);
    return enqueue(run, { id: albumId(run, playerId, source, stableAction), type: TYPES.ALBUM, payload: { collectionId: run.seasonId, playerId: String(playerId), source, actionId: stableAction } });
  }
  function assertCanonicalTerminal(run, endReason) {
    const terminal = run?.gameOver === true || ["gameover", "complete", "finalization", "final-celebration", "final-summary"].includes(String(run?.phase || ""));
    if (!run?.runId || !run?.seasonId || !terminal || !["gameover", "victory"].includes(endReason)) throw Object.assign(new Error("Canonical terminal proof required"), { code: "terminal-proof-required" });
    return true;
  }
  function enqueueDevelopment(run, { endReason, defeatedBosses }) {
    assertCanonicalTerminal(run, endReason);
    return enqueue(run, { id: developmentId(run, endReason), type: TYPES.DEVELOPMENT, payload: { runId: run.runId, seasonId: run.seasonId, endReason, defeatedBosses: Math.max(0, Number(defeatedBosses) || 0) } });
  }
  function enqueueHall(run, snapshot) {
    return enqueue(run, { id: hallId(run), type: TYPES.HALL, payload: { archiveKey: snapshot.archiveKey, snapshot: clone(snapshot) } });
  }
  function apply(effect, apis) {
    if (effect.type === TYPES.ALBUM) return { ok: apis.AlbumProgress.unlockAlbumPlayer(effect.payload.collectionId, effect.payload.playerId, { source: effect.payload.source, applicationKey: effect.id }) !== undefined };
    if (effect.type === TYPES.DEVELOPMENT) {
      const result = apis.DevelopmentV2.processRunEnd(effect.payload);
      const redeemed = result?.state?.redeemedRunIds?.includes(effect.payload.runId) || apis.DevelopmentV2.read().redeemedRunIds.includes(effect.payload.runId);
      return { ok: redeemed, result };
    }
    if (effect.type === TYPES.HALL) { const result = apis.HallOfFameStorage.addChampion(effect.payload.snapshot); return { ok: result?.persisted === true, result }; }
    return { ok: false };
  }
  function drain(run, options = {}) {
    if (options.readOnly) return { run, applied: [], pending: outbox(run).filter((item) => item.status === "pending"), readOnly: true };
    const apis = options.apis || global;
    const save = options.save || ((current) => apis.RunState.save(current));
    const applied = [];
    for (const effect of outbox(run).filter((item) => item.status === "pending")) {
      try {
        const outcome = apply(effect, apis);
        if (!outcome.ok) break;
        effect.status = "applied"; effect.appliedAt = now();
        if (effect.type === TYPES.HALL) { run.hallTeamId = outcome.result.team.hallTeamId; if (run.finalization) run.finalization.status = "hall-written"; }
        if (effect.type === TYPES.DEVELOPMENT && run.finalization) run.finalization.status = "development-written";
        save(run, { effectMarker: effect.id });
        applied.push(effect.id);
      } catch (error) { return { run, applied, pending: outbox(run).filter((item) => item.status === "pending"), error }; }
    }
    return { run, applied, pending: outbox(run).filter((item) => item.status === "pending") };
  }

  global.PermanentEffects = Object.freeze({ TYPES, outbox, enqueue, enqueueAlbum, enqueueDevelopment, enqueueHall, assertCanonicalTerminal, albumId, developmentId, hallId, drain, resume: drain });
})(typeof window !== "undefined" ? window : globalThis);
