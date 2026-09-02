(function (global) {
  "use strict";
  function create(deps) {
    const run = () => deps.getRun();
    function drainPermanentEffects() {
      const result = global.PermanentEffects.drain(run());
      if (result.error) console.error("Permanent effect remains pending", result.error);
      return result;
    }
    function rewardPresentation(defeatedBosses, endReason) {
      const bosses = Math.max(0, Number(defeatedBosses) || 0);
      return { endReason, coins: bosses * 20 + (endReason === "victory" ? 100 : 0), cups: endReason === "victory" ? 1 : 0, seen: false };
    }
    function resolveDevelopmentEndRunFlow({ endReason, onComplete }) {
      const currentRun = run();
      const defeatedBosses = Number(currentRun.completedBossIds?.length || currentRun.bossIndex || 0);
      const effectId = global.PermanentEffects.developmentId(currentRun, endReason);
      const existingEffect = currentRun.permanentEffectOutbox?.find((entry) => entry.id === effectId);
      const prepared = existingEffect ? { ok: true } : deps.persistMutation({ label: "terminal-development-effect", mutate: (current) => {
        global.PermanentEffects.assertCanonicalTerminal(current, endReason);
        return global.PermanentEffects.enqueueDevelopment(current, { endReason, defeatedBosses });
      } });
      if (!prepared.ok) return deps.view.renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete }));
      const drained = drainPermanentEffects();
      const effect = run().permanentEffectOutbox.find((entry) => entry.id === effectId);
      if (drained.error || effect?.status !== "applied") return deps.view.renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete }));
      if (!run().developmentRewardPresentation || run().developmentRewardPresentation.endReason !== endReason) {
        const presentation = deps.persistMutation({ label: "development-reward-presentation-create", mutate: (current) => {
          const currentEffect = current.permanentEffectOutbox?.find((entry) => entry.id === effectId);
          if (currentEffect?.status !== "applied") throw new Error("Development effect must be applied before reward presentation");
          if (!current.developmentRewardPresentation || current.developmentRewardPresentation.endReason !== endReason) current.developmentRewardPresentation = rewardPresentation(defeatedBosses, endReason);
          return current.developmentRewardPresentation;
        } });
        if (!presentation.ok) return deps.view.renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete }));
      }
      const continueFlow = () => deps.persistMutation({ label: "development-reward-presentation-seen", mutate: (current) => {
        const presentation = current.developmentRewardPresentation;
        if (!presentation || presentation.endReason !== endReason) throw new Error("Development reward presentation changed");
        presentation.seen = true;
      }, onCommitted: () => onComplete(), rerender: ({ ok }) => { if (!ok) deps.view.renderTerminalEffectPending(() => resolveDevelopmentEndRunFlow({ endReason, onComplete })); } });
      if (!run().developmentRewardPresentation.seen) return deps.view.renderDevelopmentRewardReveal(run().developmentRewardPresentation, continueFlow);
      return onComplete();
    }
    function renderGameOver({ developmentResolved = false } = {}) {
      const currentRun = run();
      if (currentRun.phase !== "gameover") {
        const committed = deps.persistMutation({ label: "gameover-route", mutate: (current) => {
          if (!current.gameOver && Number(current.lives || 0) > 0) throw new Error("Game over route requires a terminal run");
          current.gameOver = true; current.phase = "gameover"; deps.enqueueGameOverDevelopmentEffect(current);
        } });
        if (!committed.ok) return;
      }
      const seasonDb = deps.getSeasonDb();
      const bossReached = Math.min(Number(run().bossIndex || 0) + 1, seasonDb.bossOrder.length);
      if (!developmentResolved) return resolveDevelopmentEndRunFlow({ endReason: "gameover", onComplete: () => renderGameOver({ developmentResolved: true }) });
      return deps.view.renderGameOver({ bossReached, bossTotal: seasonDb.bossOrder.length, level: global.LevelProgression.formatLevel(run(), run().seasonId), overall: deps.averageOverall(), wins: Number(run().statistics?.winsTotal || 0), onRestart: deps.startNewRun, onHome: deps.renderHome });
    }
    return { drainPermanentEffects, resolveDevelopmentEndRunFlow, renderGameOver };
  }
  global.GameOverController = { create };
})(globalThis);
