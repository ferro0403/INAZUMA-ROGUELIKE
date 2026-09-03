from pathlib import Path

path = Path('js/app.js')
source = path.read_text()
start = source.index('  function devSkipCurrentBoss')
end = source.index('  function mountRunDevQuickTools', start)
replacement = '''  function devSkipCurrentBoss({ renderResult = true, expectedBossIndex = null } = {}) {
    if (!DEV_MODE || !run || run.gameOver || run.phase === "complete") return false;
    const bossIndex = expectedBossIndex == null ? Number(run.bossIndex || 0) : Number(expectedBossIndex);
    const boss = seasonDb.bossOrder[bossIndex];
    if (!boss) return false;
    const bossId = String(boss.teamId);
    if (run.completedBossIds.includes(bossId)) {
      if (renderResult) navigateBossVictoryDestination({ destination: "none" });
      return true;
    }
    if (Number(run.bossIndex || 0) !== bossIndex) return false;
    const committed = persistGameplayMutation({
      label: "dev-skip-current-boss",
      mutate: (current) => {
        if (Number(current.bossIndex || 0) !== bossIndex) throw Object.assign(new Error("DEV boss target changed"), { code: "dev-boss-target-stale" });
        current.postBossFlow = { bossIndex, status: "next-zone", remainingRewards: 0 };
        current.pendingBossVictory = null;
        current.activeMatch = null;
        current.currentZone = null;
        return global.BossGameOverRuntime.applyBossVictoryHandoffMutation({
          run: current,
          seasonDb,
          ensureCurrentZoneMutation,
          buildFinalization: (finalBoss) => {
            const snapshot = buildChampionSnapshot(finalBoss);
            current.finalization = { status: "pending", archiveKey: snapshot.archiveKey, hallTeamId: snapshot.hallTeamId };
            global.PermanentEffects.enqueueHall(current, snapshot);
          },
        });
      },
      onCommitted: () => {
        ui.pendingReward = null;
        ui.match = null;
        closeModal();
      },
    });
    if (!committed.ok) return false;
    let destination = committed.value || { destination: "none" };
    if (destination.destination === "finalization-pending") {
      const finalization = resumeRunFinalization({ render: false });
      destination = finalization.completed
        ? { destination: "season-complete", finalization }
        : { destination: "finalization-pending", finalization };
    }
    if (destination.destination === "map") {
      try { global.RunState.createCheckpoint?.(run); }
      catch (error) { console.warn("Unable to persist DEV boss checkpoint", error); }
    }
    if (renderResult) navigateBossVictoryDestination(destination);
    return true;
  }

  function devSkipToCompletedBosses(target) {
    if (!DEV_MODE || !run) return false;
    const cappedTarget = Math.min(Math.max(0, target), Math.max(0, seasonDb.bossOrder.length - 1));
    while (run.completedBossIds.length < cappedTarget) {
      const expectedBossIndex = Number(run.bossIndex || 0);
      if (!devSkipCurrentBoss({ renderResult: false, expectedBossIndex })) return false;
    }
    renderMap({ persist: false });
    return true;
  }

  function devGameOverNow() {
    if (!DEV_MODE || !run) return false;
    if (run.gameOver) {
      renderGameOver();
      return true;
    }
    const committed = persistGameplayMutation({
      label: "dev-gameover-now",
      mutate: (current) => {
        current.lives = 0;
        current.gameOver = true;
        current.phase = "gameover";
        current.activeMatch = null;
        current.pendingBossVictory = null;
        current.postBossFlow = null;
        enqueueGameOverDevelopmentEffect(current);
      },
      onCommitted: () => { ui.match = null; },
    });
    if (!committed.ok) return false;
    renderGameOver();
    return true;
  }

'''
source = source[:start] + replacement + source[end:]
old = '    const nextBoss = seasonDb?.bossOrder?.[run.bossIndex];\n    if (!nextBoss) return;'
new = '    const devBossIndex = Number(run.bossIndex || 0);\n    const nextBoss = seasonDb?.bossOrder?.[devBossIndex];\n    if (!nextBoss) return;'
if old not in source:
    raise SystemExit('DEV quick tools boss anchor not found')
source = source.replace(old, new, 1)
old = '    panel.querySelector(\'[data-dev-run="skip"]\')?.addEventListener("click", () => devSkipCurrentBoss());'
new = '    panel.querySelector(\'[data-dev-run="skip"]\')?.addEventListener("click", () => devSkipCurrentBoss({ expectedBossIndex: devBossIndex }));'
if old not in source:
    raise SystemExit('DEV skip handler anchor not found')
source = source.replace(old, new, 1)
path.write_text(source)
