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
      const account = apis.DevelopmentAccountV3 || global.DevelopmentAccountV3 || apis.DevelopmentV2;
      const result = account.processRunEnd(effect.payload);
      const redeemed = result?.state?.redeemedRunIds?.includes(effect.payload.runId) || account.read().redeemedRunIds.includes(effect.payload.runId);
      return { ok: redeemed, result };
    }
    if (effect.type === TYPES.HALL) {
      const result = apis.HallOfFameStorage.addChampion(effect.payload.snapshot);
      if (result?.persisted !== true) {
        const details = result?.error || {};
        throw Object.assign(new Error(details.message || "Hall effect remains pending"), {
          name: details.name || "Error",
          code: details.code || "hall-finalization-failed",
          stage: details.stage || "hall-finalization",
          problemSector: details.problemSector || "hall_index",
        });
      }
      return { ok: true, result };
    }
    return { ok: false };
  }
  function snapshotMarkerState(run, effect) {
    return {
      effectStatus: effect.status,
      effectAppliedAt: effect.appliedAt,
      hasHallTeamId: Object.prototype.hasOwnProperty.call(run, "hallTeamId"),
      hallTeamId: run.hallTeamId,
      hasFinalization: Boolean(run.finalization),
      finalizationStatus: run.finalization?.status,
      finalizationHallTeamId: run.finalization?.hallTeamId,
    };
  }
  function restoreMarkerState(run, effect, before) {
    effect.status = before.effectStatus;
    effect.appliedAt = before.effectAppliedAt;
    if (before.hasHallTeamId) run.hallTeamId = before.hallTeamId; else delete run.hallTeamId;
    if (before.hasFinalization && run.finalization) {
      run.finalization.status = before.finalizationStatus;
      if (before.finalizationHallTeamId === undefined) delete run.finalization.hallTeamId;
      else run.finalization.hallTeamId = before.finalizationHallTeamId;
    }
  }
  function compactAppliedHallEffect(run, effect, save) {
    if (effect.type !== TYPES.HALL || effect.status !== "applied" || !Object.prototype.hasOwnProperty.call(effect, "payload")) return false;
    const payload = effect.payload, createdAt = effect.createdAt;
    delete effect.payload; delete effect.createdAt;
    try { save(run, { effectCompaction: effect.id }); return true; }
    catch (error) { effect.payload = payload; if (createdAt !== undefined) effect.createdAt = createdAt; throw error; }
  }
  function drain(run, options = {}) {
    if (options.readOnly) return { run, applied: [], pending: outbox(run).filter((item) => item.status === "pending"), readOnly: true };
    const apis = options.apis || global;
    const save = options.save || ((current) => apis.RunState.save(current));
    const applied = [];
    const allowedTypes = options.types ? new Set(options.types) : null;
    for (const receipt of outbox(run).filter((item) => item.status === "applied" && (!allowedTypes || allowedTypes.has(item.type)))) {
      try { compactAppliedHallEffect(run, receipt, save); } catch (error) { return { run, applied, pending: outbox(run).filter((item) => item.status === "pending"), error }; }
    }
    for (const effect of outbox(run).filter((item) => item.status === "pending" && (!allowedTypes || allowedTypes.has(item.type)))) {
      try {
        const outcome = apply(effect, apis);
        if (!outcome.ok) break;
        const markerBefore = snapshotMarkerState(run, effect);
        effect.status = "applied"; effect.appliedAt = now();
        if (effect.type === TYPES.HALL) {
          run.hallTeamId = outcome.result?.team?.hallTeamId || effect.payload.snapshot?.hallTeamId;
          if (run.finalization) { run.finalization.status = "hall-written"; run.finalization.hallTeamId = run.hallTeamId; }
        }
        if (effect.type === TYPES.DEVELOPMENT && run.finalization) run.finalization.status = "development-written";
        try { save(run, { effectMarker: effect.id }); }
        catch (error) { restoreMarkerState(run, effect, markerBefore); throw error; }
        if (effect.type === TYPES.HALL) compactAppliedHallEffect(run, effect, save);
        applied.push(effect.id);
      } catch (error) { return { run, applied, pending: outbox(run).filter((item) => item.status === "pending"), error }; }
    }
    return { run, applied, pending: outbox(run).filter((item) => item.status === "pending") };
  }

  function resumeFinalization(run, options = {}) {
    if (options.readOnly) return { run, status: "read-only", completed: false };
    const apis = options.apis || global;
    const save = options.save || ((current, metadata) => apis.RunState.save(current, metadata));
    while (true) {
      const status = run.finalization?.status;
      if (status === "complete") return { run, status, completed: true };
      if (status === "pending") {
        const result = drain(run, { apis, save, types: [TYPES.HALL] });
        if (result.error || run.finalization?.status !== "hall-written") return { run, status: "pending", completed: false, error: result.error || new Error("Hall effect remains pending") };
        continue;
      }
      if (status === "hall-written") {
        const id = developmentId(run, "victory");
        let effect = outbox(run).find((entry) => entry.id === id);
        if (!effect) {
          const lengthBefore = outbox(run).length;
          try {
            effect = enqueueDevelopment(run, { endReason: "victory", defeatedBosses: Number(run.completedBossIds?.length || run.bossIndex || 0) });
            save(run, { effectEnqueue: effect.id });
          } catch (error) {
            outbox(run).splice(lengthBefore);
            return { run, status: "hall-written", completed: false, error };
          }
        }
        const result = drain(run, { apis, save, types: [TYPES.DEVELOPMENT] });
        if (result.error || run.finalization?.status !== "development-written") return { run, status: "hall-written", completed: false, error: result.error || new Error("Development effect remains pending") };
        continue;
      }
      if (status === "development-written") {
        const before = { phase: run.phase, status, hasHallTeamId: Object.prototype.hasOwnProperty.call(run, "hallTeamId"), hallTeamId: run.hallTeamId };
        run.finalization.status = "complete";
        run.phase = "final-celebration";
        run.hallTeamId = run.finalization.hallTeamId || run.hallTeamId;
        try { save(run, { finalizationComplete: true }); }
        catch (error) {
          run.phase = before.phase;
          run.finalization.status = before.status;
          if (before.hasHallTeamId) run.hallTeamId = before.hallTeamId; else delete run.hallTeamId;
          return { run, status: "development-written", completed: false, error };
        }
        return { run, status: "complete", completed: true };
      }
      return { run, status: status || "missing", completed: false, error: new Error("Invalid finalization state") };
    }
  }

  global.PermanentEffects = Object.freeze({ TYPES, outbox, enqueue, enqueueAlbum, enqueueDevelopment, enqueueHall, assertCanonicalTerminal, albumId, developmentId, hallId, drain, resume: drain, resumeFinalization });
})(typeof window !== "undefined" ? window : globalThis);
