"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

const flush = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
};
const waitForPurchaseRerender = () => new Promise((resolve) => setTimeout(resolve, 550));
const gameplay = (run) => Object.fromEntries([
  "runId", "seasonId", "roster", "lineup", "bench", "inventory", "activeMatch",
  "currentZone", "lives", "bossIndex", "postBossFlow", "pendingBossVictory", "phase",
].map((key) => [key, structuredClone(run?.[key])]));

function runFixture(runId) {
  return { saveVersion: 2, runId, seasonId: "ie1", phase: "squad", teamIdentity: { name: "Runtime Team" }, lives: 2, bossIndex: 0, roster: [], lineup: [], bench: [], inventory: [], completedBossIds: [], unlockedTeamIds: [], fiveVFive: { formation: "diamond", assignments: {} } };
}

function createRuntime(storage, runId) {
  const seasonDb = require("../data/IE1_season_compact.json");
  const runtime = load(storage, { fullRuntime: true, run: runFixture(runId), seasonId: "ie1", seasonDb, useProductionDevelopmentAccount: true });
  vm.runInContext(fs.readFileSync("js/shop-catalog.js", "utf8"), runtime.context, { filename: "shop-catalog.js" });
  runtime.context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => 0;
  runtime.context.__INAZUMA_UI_TEST__.setPermanentClubTestContext({ run: runtime.context.RunState.load("ie1"), seasonDb, freeAgentsDb: { players: [] }, activeSeason: { id: "ie1" } });
  return { runtime, seasonDb };
}

(async () => {
  // CONTROLLER FALLBACK: without the pre-existing legacy purchase overlay, the controller remains usable.
  const fallbackSetup = createRuntime(new BudgetStorage(), "controller-fallback");
  await flush();
  fallbackSetup.runtime.context.DevelopmentAccountV3.mutate((account) => { account.coins = 300; });
  await fallbackSetup.runtime.context.__INAZUMA_UI_TEST__.renderHome();
  fallbackSetup.runtime.query("#open-shop-home").click();
  await flush();
  fallbackSetup.runtime.query('[data-buy-project="Buono"]').click();
  await flush();
  assert.equal(fallbackSetup.runtime.context.DevelopmentAccountV3.read().projects.Buono, 1, "controller fallback purchases directly");
  fallbackSetup.runtime.destroy();

  const storage = new BudgetStorage();
  const { runtime, seasonDb } = createRuntime(storage, "polished-purchase-flow");
  const { context, query } = runtime;
  await flush();
  context.RunState.saveProfileTeamIdentity({ name: "Persistent Team", emblemId: "default-lightning" });
  context.DevelopmentAccountV3.mutate((account) => { account.coins = 5000; account.cupsBySeason.ie1 = 5; });
  const initialGameplay = gameplay(runtime.canonical);

  // PRE-EXISTING LEGACY SHOP PURCHASE OVERLAY: loaded after app.js, matching index.html.
  vm.runInContext(fs.readFileSync("js/shop-ui-polish.js", "utf8"), context, { filename: "shop-ui-polish.js" });
  await context.__INAZUMA_UI_TEST__.renderHome();
  query("#open-shop-home").click();
  await flush();
  assert.match(context.document.getElementById("app").innerHTML, /data-shop-tab="general" aria-current="page"/);

  const beforeCancel = structuredClone(context.DevelopmentAccountV3.read());
  query('[data-buy-project="Buono"]').click();
  assert.ok(query("#shop-buy-overlay"), "real project click opens the purchase overlay");
  assert.match(query("#shop-buy-overlay").innerHTML, /CONFERMA ACQUISTO/);
  assert.deepStrictEqual(context.DevelopmentAccountV3.read(), beforeCancel, "opening the overlay does not mutate account state");
  query(".shop-buy-modal__cancel").click();
  assert.equal(query("#shop-buy-overlay"), null);
  assert.deepStrictEqual(context.DevelopmentAccountV3.read(), beforeCancel);
  assert.ok(query('[data-buy-project="Buono"]'), "Shop remains interactive after cancel");
  assert.deepStrictEqual(gameplay(runtime.canonical), initialGameplay);

  query('[data-buy-project="Buono"]').click();
  const beforeProject = structuredClone(context.DevelopmentAccountV3.read());
  query(".shop-buy-modal__confirm").click();
  assert.equal(context.DevelopmentAccountV3.read().projects.Buono, beforeProject.projects.Buono + 1);
  assert.equal(context.DevelopmentAccountV3.read().coins, beforeProject.coins - context.DevelopmentV2.PROJECT_PRICES.Buono);
  await waitForPurchaseRerender();
  assert.match(context.document.getElementById("app").innerHTML, /data-shop-tab="general" aria-current="page"/);
  assert.deepStrictEqual(gameplay(runtime.canonical), initialGameplay);

  // Open while affordable, then make funds insufficient before confirming to exercise the real modal error path.
  query('[data-buy-project="Buono"]').click();
  context.DevelopmentAccountV3.mutate((account) => { account.coins = 0; });
  const beforeInsufficient = structuredClone(context.DevelopmentAccountV3.read());
  query(".shop-buy-modal__confirm").click();
  assert.deepStrictEqual(context.DevelopmentAccountV3.read(), beforeInsufficient);
  assert.equal(query(".shop-buy-modal__status").textContent, "MONETE INSUFFICIENTI");
  assert.ok(query("#shop-buy-overlay"), "failed purchase remains in the modal without false success");
  query(".shop-buy-modal__cancel").click();
  assert.deepStrictEqual(gameplay(runtime.canonical), initialGameplay);

  const product = context.ShopCatalog.build().find((item) => item.seasonId === "ie1" && item.shopSection === "ie1");
  assert.ok(product, "IE1 must expose a real emblem product");
  context.DevelopmentAccountV3.mutate((account) => { account.coins = product.coins + 1000; account.cupsBySeason.ie1 = product.cups + 2; });
  query('[data-shop-tab="ie1"]').click();
  await flush();
  const beforeEmblem = structuredClone(context.DevelopmentAccountV3.read());
  query(`[data-buy-emblem="${product.emblemId}"]`).click();
  assert.ok(query("#shop-buy-overlay"));
  query(".shop-buy-modal__confirm").click();
  const purchased = context.DevelopmentAccountV3.read();
  assert.equal(purchased.unlockedEmblems.filter((id) => id === product.emblemId).length, 1);
  assert.equal(purchased.coins, beforeEmblem.coins - product.coins);
  assert.equal(purchased.cupsBySeason.ie1, beforeEmblem.cupsBySeason.ie1 - product.cups);
  await waitForPurchaseRerender();
  await flush();
  const ownedButton = query(`[data-buy-emblem="${product.emblemId}"]`);
  assert.equal(ownedButton.disabled, true);
  assert.match(context.document.getElementById("app").innerHTML, /POSSEDUTO/);
  assert.deepStrictEqual(gameplay(runtime.canonical), initialGameplay);

  await context.__INAZUMA_UI_TEST__.renderHome();
  query("#open-settings-home").click();
  await flush();
  query("#settings-edit-name").click();
  assert.match(runtime.modalMarkup, /MODIFICA NOME SQUADRA/i);
  assert.equal(query("#team-name-input").value, "Persistent Team");
  query("#cancel-team-name").click();
  assert.equal(context.RunState.loadProfile().teamIdentity.name, "Persistent Team");
  assert.deepStrictEqual(gameplay(runtime.canonical), initialGameplay);

  query("#settings-change-emblem").click();
  await flush();
  assert.ok(query(`[data-settings-emblem="${product.emblemId}"]`), "purchased emblem is available in Settings");
  query(`[data-settings-emblem="${product.emblemId}"]`).click();
  await flush();
  assert.equal(context.RunState.loadProfile().teamIdentity.emblemId, product.emblemId);
  assert.match(query(`[data-settings-emblem="${product.emblemId}"]`).className, /is-selected/);
  query(".settings-back").click();
  const toggle = query("#settings-smart-lineup");
  toggle.checked = true;
  toggle.dispatchEvent({ type: "change", target: toggle });
  assert.equal(context.RunState.loadProfile().preferences.smartAutoLineup, true);
  assert.deepStrictEqual(gameplay(runtime.canonical), initialGameplay);

  const expectedAccount = structuredClone(context.DevelopmentAccountV3.read());
  const reopened = runtime.reopen({ seasonDb });
  await flush();
  const reopenedProfile = reopened.context.RunState.loadProfile();
  assert.equal(reopened.context.DevelopmentAccountV3.read().projects.Buono, expectedAccount.projects.Buono);
  assert.ok(reopened.context.DevelopmentAccountV3.read().unlockedEmblems.includes(product.emblemId));
  assert.equal(reopenedProfile.teamIdentity.emblemId, product.emblemId);
  assert.equal(reopenedProfile.preferences.smartAutoLineup, true);
  assert.equal(reopenedProfile.teamIdentity.name, "Persistent Team");
  assert.deepStrictEqual(gameplay(reopened.canonical), initialGameplay);
  console.log("shop/settings production paths: controller fallback and polished purchase/profile/reopen flows OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
