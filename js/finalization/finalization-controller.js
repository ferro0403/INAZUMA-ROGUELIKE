(function (global) {
  "use strict";
  function create(deps) {
    const run = () => deps.getRun();

    function finishResume(result, render) {
      if (!result.completed) {
        if (result.error) {
          console.error("Finalization remains resumable", result.error);
          deps.recoverCanonicalRun?.();
          deps.toast("Finalizzazione non completata. Riprova con Continua.");
        }
        if (render) renderPending(result);
        return result;
      }
      if (!render) return result;
      return deps.resolveDevelopment({ endReason: "victory", onComplete: () => renderCelebration(run().hallTeamId, { developmentResolved: true, rewardPresentationResolved: true }) });
    }

    function resume({ render = true } = {}) {
      if (!global.RestoreGameplayRoutingGate?.enter("finalization")) return { completed: false, blocked: true };
      const operation = global.PermanentEffects.resumeFinalization(run());
      if (operation && typeof operation.then === "function") {
        return operation.then((result) => finishResume(result, render)).catch((error) => finishResume({ run: run(), status: run()?.finalization?.status || "pending", completed: false, error }, render));
      }
      return finishResume(operation, render);
    }

    function renderPending(result = {}) {
      return deps.view.renderPending(result, () => {
        const retry = document.getElementById("retry-run-finalization");
        retry.disabled = true;
        const handle = (resumed) => {
          if (resumed.completed) return deps.resolveDevelopment({ endReason: "victory", onComplete: () => renderCelebration(run().hallTeamId, { developmentResolved: true, rewardPresentationResolved: true }) });
          deps.toast("Finalizzazione ancora in sospeso. Puoi riprovare senza perdere la vittoria.", "error");
          return renderPending(resumed);
        };
        const resumed = resume({ render: false });
        if (resumed && typeof resumed.then === "function") return resumed.then(handle);
        return handle(resumed);
      });
    }
    function ensureSummaryState(hallTeamId) {
      const current = run();
      const targetHallTeamId = hallTeamId || current?.hallTeamId || null;
      if (current?.phase === "final-summary" && String(current?.hallTeamId || "") === String(targetHallTeamId || "")) {
        return { ok: true, skipped: true, run: current };
      }
      return deps.persistMutation({
        label: "finalization-summary-navigation",
        mutate(next) {
          next.phase = "final-summary";
          if (targetHallTeamId) next.hallTeamId = targetHallTeamId;
        },
      });
    }
    function victoryRewardPresentationSeen() {
      const presentation = run()?.developmentRewardPresentation;
      return presentation?.endReason === "victory" && presentation?.seen === true;
    }
    function renderCelebration(hallTeamId, { developmentResolved = false, rewardPresentationResolved = false } = {}) {
      if (!developmentResolved || run().finalization?.status !== "complete") return resume();
      if (!rewardPresentationResolved && !victoryRewardPresentationSeen()) return resume();
      const team = deps.championTeam(hallTeamId || run()?.hallTeamId);
      if (!team) return deps.renderHome();
      const go = () => {
        const committed = ensureSummaryState(team.hallTeamId);
        if (!committed.ok) return committed;
        return renderSummary(team.hallTeamId, { developmentResolved: true });
      };
      return deps.view.renderCelebration(team, go);
    }
    function renderSummary(hallTeamId, { developmentResolved = false } = {}) {
      if (!developmentResolved || run().finalization?.status !== "complete") return resume();
      const team = deps.championTeam(hallTeamId || run()?.hallTeamId);
      if (!team) return deps.renderHome();
      const committed = ensureSummaryState(team.hallTeamId);
      if (!committed.ok) return committed;
      const summaries = global.HallOfFameStorage.listSummaries();
      const ordinal = summaries.findIndex((item) => item.hallTeamId === team.hallTeamId) + 1;
      return deps.view.renderSummary(team, ordinal);
    }
    return { resume, renderPending, renderCelebration, renderSummary };
  }
  global.FinalizationController = { create };
})(globalThis);
