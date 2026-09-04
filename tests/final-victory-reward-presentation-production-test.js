"use strict";

const assert = require("assert");
const { load } = require("./helpers/production-runtime");
const BudgetStorage = require("./helpers/budget-storage");
const ie2 = require("../data/IE2_season_compact.json");

async function main() {
  const finalBossIndex = ie2.bossOrder.length - 1;
  const run = {
    runId: "ie2-final-victory-reward-presentation",
    seasonId: "ie2",
    lives: 2,
    bossIndex: finalBossIndex,
    phase: "match",
    completedBossIds: ie2.bossOrder.slice(0, -1).map((boss) => boss.teamId),
    unlockedTeamIds: [],
    inventory: [],
    roster: [],
    lineup: [],
    bench: [],
    formationId: "4-3-3",
    teamIdentity: { name: "Raimon" },
    statistics: {},
    currentZone: {
      nodes: [{ id: "barcelona-final", type: "boss" }],
      path: [],
      completedNodeIds: [],
    },
    activeMatch: {
      matchId: "final-victory-reward-match",
      type: "boss",
      bossIndex: finalBossIndex,
      nodeId: "barcelona-final",
      state: "playing",
      simulation: {
        resolutionApplied: false,
        score: { user: 2, opponent: 1 },
      },
    },
  };

  const storage = new BudgetStorage(2_000_000);
  const roguelikeRules = {
    defeatedBossRewardLevel: (boss) => Number(boss?.bossLevel || 1),
    resolveDevelopmentEffectiveMetadata: () => ({}),
    applyEquipment: (stats) => stats,
    isProfileAwareRosterEntry: () => false,
    migrateDefeatedBossPlayerLevels: () => false,
  };
  let runtime = load(storage, { run, seasonDb: ie2, contextOverrides: { RoguelikeRules: roguelikeRules } });
  let flow = runtime.seam;

  flow.completeBossMatch("victory");
  flow.resolvePendingRunFlow({ clearMatch: true });
  while (flow.getRun().postBossFlow?.remainingRewards > 0) flow.advanceBossReward();

  let saved = runtime.canonical;
  assert.equal(saved.finalization?.status, "complete", "finalization must already be canonically complete");
  assert.equal(saved.phase, "final-celebration", "canonical terminal phase must be final-celebration before reward presentation continue");
  assert(saved.completedBossIds.includes(ie2.bossOrder.at(-1).teamId));

  const expectedCoins = ie2.bossOrder.length * 20 + 100;
  let account = runtime.context.DevelopmentV2.read();
  assert.equal(account.coins, expectedCoins, "victory coins must already be applied exactly once before presentation");
  assert.equal(account.cupsBySeason.ie2, 1, "IE2 victory cup must already be applied exactly once before presentation");
  assert(account.redeemedRunIds.includes(run.runId));
  assert.equal(runtime.hall.length, 1, "Hall of Fame entry must already be persisted");
  assert.equal(runtime.redeemed.size, 1, "Development run redemption must be unique");

  assert(
    flow.getAppMarkup().includes("data-development-reward-reveal"),
    "successful final boss must show RICOMPENSE RUN before Celebration",
  );
  assert(flow.getAppMarkup().includes("RICOMPENSE RUN"));
  assert(flow.getAppMarkup().includes("COPPA SEASON"));
  saved = runtime.canonical;
  assert.deepStrictEqual(
    {
      endReason: saved.developmentRewardPresentation?.endReason,
      coins: saved.developmentRewardPresentation?.coins,
      cups: saved.developmentRewardPresentation?.cups,
      seen: saved.developmentRewardPresentation?.seen,
    },
    { endReason: "victory", coins: expectedCoins, cups: 1, seen: false },
  );

  // Reopen after finalization completed but before the reveal is acknowledged:
  // the reward screen must remain the first terminal UI and rewards must not reapply.
  runtime = runtime.reopen({ seasonDb: ie2 });
  flow = runtime.seam;
  await flow.resumeRun();
  assert(flow.getAppMarkup().includes("data-development-reward-reveal"), "reopen before seen must resume reward reveal");
  account = runtime.context.DevelopmentV2.read();
  assert.equal(account.coins, expectedCoins);
  assert.equal(account.cupsBySeason.ie2, 1);
  assert.equal(runtime.hall.length, 1);
  assert.equal(runtime.redeemed.size, 1);

  // Persistence failure on Continue must not mark presentation seen or advance UI.
  storage.fail = { method: "setItem" };
  const failingContinue = runtime.query("#development-reward-continue");
  assert(failingContinue, "reward Continue button must exist");
  failingContinue.click();
  saved = runtime.canonical;
  assert.equal(saved.developmentRewardPresentation?.seen, false, "failed Continue must leave canonical presentation unseen");
  assert(runtime.query("#retry-terminal-effect"), "failed Continue must expose retry UI");
  account = runtime.context.DevelopmentV2.read();
  assert.equal(account.coins, expectedCoins);
  assert.equal(account.cupsBySeason.ie2, 1);
  assert.equal(runtime.hall.length, 1);

  // Retry restores the same reveal; successful Continue marks it seen then opens Celebration.
  storage.fail = null;
  runtime.query("#retry-terminal-effect").click();
  assert(runtime.query("#development-reward-continue"), "retry must restore reward reveal");
  const continueButton = runtime.query("#development-reward-continue");
  continueButton.click();
  continueButton.click(); // double-tap safety: permanent rewards must remain exactly once.
  saved = runtime.canonical;
  assert.equal(saved.developmentRewardPresentation?.seen, true);
  assert.equal(saved.phase, "final-celebration");
  assert(flow.getAppMarkup().includes("final-celebration-screen"), "Continue must open Celebration");
  account = runtime.context.DevelopmentV2.read();
  assert.equal(account.coins, expectedCoins);
  assert.equal(account.cupsBySeason.ie2, 1);
  assert.equal(account.redeemedRunIds.filter((id) => id === run.runId).length, 1);
  assert.equal(runtime.hall.length, 1);

  // Reopen after seen must not show the reward screen again; Celebration then Summary remain canonical.
  runtime = runtime.reopen({ seasonDb: ie2 });
  flow = runtime.seam;
  await flow.resumeRun();
  assert(!flow.getAppMarkup().includes("data-development-reward-reveal"));
  assert(flow.getAppMarkup().includes("final-celebration-screen"));
  const finalContinue = runtime.query("#final-continue");
  assert(finalContinue, "Celebration Continue must exist");
  finalContinue.click();
  saved = runtime.canonical;
  assert.equal(saved.phase, "final-summary");
  assert(flow.getAppMarkup().includes("final-summary-screen"));

  runtime = runtime.reopen({ seasonDb: ie2 });
  flow = runtime.seam;
  await flow.resumeRun();
  assert.equal(runtime.canonical.phase, "final-summary");
  assert(flow.getAppMarkup().includes("final-summary-screen"));
  account = runtime.context.DevelopmentV2.read();
  assert.equal(account.coins, expectedCoins);
  assert.equal(account.cupsBySeason.ie2, 1);
  assert.equal(account.redeemedRunIds.filter((id) => id === run.runId).length, 1);
  assert.equal(runtime.hall.length, 1);
  assert.equal(runtime.canonical.permanentEffectOutbox.filter((effect) => effect.type === "development-run-end").length, 1);
  assert.equal(runtime.canonical.permanentEffectOutbox.filter((effect) => effect.type === "hall-champion").length, 1);

  console.log("final victory reward presentation: real final boss -> rewards -> reveal -> quota retry -> Celebration -> Summary exactly once OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
