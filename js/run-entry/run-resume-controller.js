(function (global) {
  "use strict";
  global.RunResumeController = {
    create(d) {
      return {
        async resumeRun() {
          await d.selectSeason(
            d.getRun()?.seasonId || d.getActiveSeason()?.id,
            { markPlayed: true },
          );
          let run = d.getRun();
          if (!run) return d.renderHome();
          if (
            run.phase === "finalization" ||
            (run.finalization && run.finalization.status !== "complete")
          )
            return d.resumeFinalization();
          const probe = global.RunState.clone(run);
          if (
            global.MapEngine.normalizeSpecialMatchNode(probe, d.getSeasonDb())
          ) {
            const normalized = d.persistGameplayMutation({
              label: "special-node-normalize-resume",
              mutate(current) {
                const previous =
                  current.currentZone?.nodes?.find(
                    (node) => node.type === "special_match",
                  ) || null;
                const active =
                  current.activeMatch?.type === "special_match"
                    ? current.activeMatch
                    : null;
                const nodeId =
                  active?.nodeId == null ? null : String(active.nodeId);
                const changed = global.MapEngine.normalizeSpecialMatchNode(
                  current,
                  d.getSeasonDb(),
                );
                if (!changed) return { changed: false };
                if (active && previous && nodeId === String(previous.id)) {
                  const node = current.currentZone?.nodes?.find(
                    (candidate) =>
                      candidate.type === "special_match" &&
                      (!active.specialMatchId ||
                        String(candidate.specialMatchId) ===
                          String(active.specialMatchId)),
                  );
                  if (!node)
                    throw Object.assign(
                      new Error("Normalized special match node unavailable"),
                      { code: "special-node-normalization-mismatch" },
                    );
                  active.nodeId = node.id;
                }
                return { changed: true };
              },
            });
            if (!normalized.ok) return d.renderMapFailureRecovery();
          }
          const recovery = d.recoverInterruptedMatchAccess();
          if (!recovery.ok) return d.renderMapFailureRecovery();
          run = d.getRun();
          if (run.gameOver || run.phase === "gameover")
            return d.renderGameOver();
          if (run.phase === "formation") return d.renderFormationChoice();
          if (run.phase === "draft") return d.renderDraft();
          if (run.pendingSpecialMatchReward) return d.showSpecialMatchReward();
          if (run.postBossFlow) return d.resumePostBossFlow();
          if (run.phase === "final-summary")
            return d.renderFinalSummary(run.hallTeamId, {
              developmentResolved: true,
            });
          if (run.phase === "final-celebration" || run.phase === "complete")
            return d.renderFinalCelebration(run.hallTeamId, {
              developmentResolved: true,
            });
          if (run.phase === "squad") return d.renderSquad();
          if (run.phase === "five")
            return d.renderFiveVFive({
              persist: false,
              returnToMatch: run.activeMatch?.type === "five_v_five",
            });
          if (run.phase === "inventory") return d.renderInventory();
          if (run.phase === "match" && run.activeMatch) {
            d.setMatchUi(run.activeMatch);
            return d.renderMatch();
          }
          d.ensureCurrentZone();
          if (d.resumePendingItemReward()) return;
          return d.renderMap();
        },
      };
    },
  };
})(globalThis);
