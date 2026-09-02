(function (global) {
  "use strict";
  function create(deps) {
    const run = () => deps.getRun();
    function resume({ render = true } = {}) {
      if (!global.RestoreGameplayRoutingGate?.enter("finalization")) return { completed: false, blocked: true };
      const result = global.PermanentEffects.resumeFinalization(run());
      if (!result.completed) {
        if (result.error) { console.error("Finalization remains resumable", result.error); deps.toast("Finalizzazione non completata. Riprova con Continua."); }
        if (render) renderPending(result);
        return result;
      }
      if (!render) return result;
      return deps.resolveDevelopment({ endReason: "victory", onComplete: () => renderCelebration(run().hallTeamId, { developmentResolved: true }) });
    }
    function renderPending(result = {}) {
      return deps.view.renderPending(result, () => {
        const retry = document.getElementById("retry-run-finalization");
        retry.disabled = true;
        const resumed = resume({ render: false });
        if (resumed.completed) return deps.resolveDevelopment({ endReason: "victory", onComplete: () => renderCelebration(run().hallTeamId, { developmentResolved: true }) });
        deps.toast("Finalizzazione ancora in sospeso. Puoi riprovare senza perdere la vittoria.", "error");
        renderPending(resumed);
      });
    }
    function renderCelebration(hallTeamId, { developmentResolved = false } = {}) {
      if (!developmentResolved || run().finalization?.status !== "complete") return resume();
      const team = deps.championTeam(hallTeamId || run()?.hallTeamId);
      if (!team) return deps.renderHome();
      const go = () => { run().phase = "final-summary"; try { global.RunState.save(run()); } catch (error) { console.error("save failed (renderFinalCelebration)", error); } renderSummary(team.hallTeamId, { developmentResolved: true }); };
      return deps.view.renderCelebration(team, go);
    }
    function renderSummary(hallTeamId, { developmentResolved = false } = {}) {
      if (!developmentResolved || run().finalization?.status !== "complete") return resume();
      const team = deps.championTeam(hallTeamId || run()?.hallTeamId);
      if (!team) return deps.renderHome();
      const summaries = global.HallOfFameStorage.listSummaries();
      const ordinal = summaries.findIndex((item) => item.hallTeamId === team.hallTeamId) + 1;
      run().phase = "final-summary"; run().hallTeamId = team.hallTeamId;
      try { global.RunState.save(run()); } catch (error) { console.error("save failed (renderFinalSummary)", error); }
      return deps.view.renderSummary(team, ordinal);
    }
    return { resume, renderPending, renderCelebration, renderSummary };
  }
  global.FinalizationController = { create };
})(globalThis);
