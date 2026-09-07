(function (global) {
  "use strict";

  function outboxComplete(run) {
    return (Array.isArray(run?.permanentEffectOutbox) ? run.permanentEffectOutbox : []).every((entry) => entry?.status === "applied");
  }

  function developmentPresentationSeen(run, endReason) {
    const presentation = run?.developmentRewardPresentation;
    return presentation?.endReason === endReason && presentation?.seen === true;
  }

  function victoryHallExists(run) {
    const hallTeamId = run?.hallTeamId || run?.finalization?.hallTeamId || null;
    if (!hallTeamId) return false;
    try { return !!global.HallOfFameStorage?.getTeam?.(hallTeamId); }
    catch (_) { return false; }
  }

  function eligibility(run) {
    if (!run?.runId || !run?.seasonId || !Number.isInteger(Number(run?.storageGeneration))) return { eligible: false, reason: "missing-canonical-identity" };
    if (!outboxComplete(run)) return { eligible: false, reason: "permanent-effects-pending" };

    const phase = String(run.phase || "");
    if (run.gameOver === true || phase === "gameover") {
      if (!developmentPresentationSeen(run, "gameover")) return { eligible: false, reason: "gameover-reward-presentation-pending" };
      return { eligible: true, reason: "gameover-complete", endReason: "gameover" };
    }

    if (run.finalization?.status === "complete") {
      if (!developmentPresentationSeen(run, "victory")) return { eligible: false, reason: "victory-reward-presentation-pending" };
      if (!victoryHallExists(run)) return { eligible: false, reason: "hall-proof-missing" };
      return { eligible: true, reason: "victory-complete", endReason: "victory" };
    }

    return { eligible: false, reason: "run-not-terminal" };
  }

  function cleanup(run, options = {}) {
    const proof = eligibility(run);
    if (!proof.eligible) return { ok: true, cleaned: false, ...proof };
    if (global.PersistenceRecoveryGuard?.isBlocked?.()) return { ok: false, cleaned: false, reason: "restore-recovery-required" };
    const expectedGeneration = Number(run.storageGeneration);
    try {
      const result = global.RunState.remove(run.seasonId, {
        expectedGeneration,
        source: options.source || "terminal-run-cleanup",
        suppressCloudEvent: true,
      });
      return { ok: true, cleaned: true, ...proof, seasonId: run.seasonId, runId: run.runId, generation: result.generation };
    } catch (error) {
      return { ok: false, cleaned: false, ...proof, seasonId: run.seasonId, runId: run.runId, error };
    }
  }

  function cleanupStored(options = {}) {
    const excludeRunId = options.excludeRunId ? String(options.excludeRunId) : null;
    const results = [];
    const seasons = global.SeasonRegistry?.list?.() || [];
    seasons.forEach((season) => {
      let stored = null;
      try { stored = global.RunState?.load?.(season.id, { readOnly: true }) || null; }
      catch (error) { results.push({ ok: false, cleaned: false, seasonId: season.id, reason: "read-failed", error }); return; }
      if (!stored || (excludeRunId && String(stored.runId) === excludeRunId)) return;
      const proof = eligibility(stored);
      if (!proof.eligible) return;
      results.push(cleanup(stored, { source: options.source || "terminal-run-cleanup-scan" }));
    });
    return results;
  }

  global.TerminalRunCleanup = Object.freeze({ eligibility, cleanup, cleanupStored, outboxComplete });
})(globalThis);
