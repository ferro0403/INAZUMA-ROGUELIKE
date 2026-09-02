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
const gameplay = (run) => Object.fromEntries(["runId", "seasonId", "roster", "lineup", "bench", "inventory", "activeMatch", "currentZone", "lives", "bossIndex", "postBossFlow", "pendingBossVictory", "phase"].map((key) => [key, structuredClone(run?.[key])]));

(async () => {
  const storage = new BudgetStorage();
  const run = { saveVersion: 2, runId: "shop-settings-run", seasonId: "ie1", phase: "squad", teamIdentity: { name: "Runtime Team" }, lives: 2, bossIndex: 0, roster: [], lineup: [], bench: [], inventory: [], completedBossIds: [], unlockedTeamIds: [], fiveVFive: { formation: "diamond", assignments: {} } };
  const seasonDb = { seasonId: "ie1", players: [], teams: [], bossOrder: [], formations: { eleven: [] } };
  const runtime = load(storage, { fullRuntime: true, run, seasonId: "ie1", seasonDb, useProductionDevelopmentAccount: true });
  const { context, query } = runtime;
  vm.runInContext(fs.readFileSync("js/shop-catalog.js", "utf8"), context, { filename: "shop-catalog.js" });
  await flush();
  context.RoguelikeRules.migrateDefeatedBossPlayerLevels = () => 0;
  context.RunState.saveProfileTeamIdentity({ name: "Persistent Team", emblemId: "default-lightning" });
  context.DevelopmentAccountV3.mutate((account) => { account.coins = 300; });
  runtime.context.__INAZUMA_UI_TEST__.setPermanentClubTestContext({ run: context.RunState.load("ie1"), seasonDb, freeAgentsDb: { players: [] }, activeSeason: { id: "ie1" } });
  const before = gameplay(runtime.canonical);

  await context.__INAZUMA_UI_TEST__.renderHome();
  query("#open-shop-home").click();
  await flush();
  assert.match(context.document.getElementById("app").innerHTML, /shop-screen/);
  assert.match(context.document.getElementById("app").innerHTML, /data-shop-tab="general" aria-current="page"/);
  assert.match(context.document.getElementById("app").innerHTML, /shop-wallet/);
  assert.ok(query("[data-buy-project]"));
  const projectButton = query('[data-buy-project="Buono"]');
  projectButton.onclick();
  await flush();
  assert.equal(context.DevelopmentAccountV3.read().coins, 50);
  assert.equal(context.DevelopmentAccountV3.read().projects.Buono, 1);
  const afterPurchase = structuredClone(context.DevelopmentAccountV3.read());
  query('[data-buy-project="Buono"]').onclick();
  await flush();
  assert.deepStrictEqual(context.DevelopmentAccountV3.read(), afterPurchase, "insufficient-coins purchase leaves account unchanged");
  assert.match(context.document.getElementById("app").innerHTML, /data-shop-tab="general" aria-current="page"/);
  assert.deepStrictEqual(gameplay(runtime.canonical), before);

  query('[data-shop-tab="ie1"]').onclick();
  await flush();
  assert.match(context.document.getElementById("app").innerHTML, /data-shop-tab="ie1" aria-current="page"/);
  query('[data-shop-tab="ie1_s2"]').onclick();
  await flush();
  assert.match(context.document.getElementById("app").innerHTML, /data-shop-tab="ie1_s2" aria-current="page"/);
  assert.deepStrictEqual(gameplay(runtime.canonical), before);

  await context.__INAZUMA_UI_TEST__.renderHome();
  query("#open-settings-home").click();
  await flush();
  let markup = context.document.getElementById("app").innerHTML;
  assert.match(markup, /PROFILO SQUADRA/);
  assert.match(markup, /Persistent Team/);
  assert.match(markup, /AUTO-FORMAZIONE INTELLIGENTE/);
  const toggle = query("#settings-smart-lineup");
  toggle.checked = true;
  toggle.dispatchEvent({ type: "change", currentTarget: toggle, target: toggle });
  assert.equal(context.RunState.loadProfile().preferences.smartAutoLineup, true);
  assert.deepStrictEqual(gameplay(runtime.canonical), before);

  query("#settings-change-emblem").click();
  await flush();
  markup = context.document.getElementById("app").innerHTML;
  assert.match(markup, /STEMMI DISPONIBILI/);
  assert.match(markup, /SELEZIONATO/);
  query("#settings-open-shop").click();
  await flush();
  assert.match(context.document.getElementById("app").innerHTML, /data-shop-tab="general" aria-current="page"/);
  assert.deepStrictEqual(gameplay(runtime.canonical), before);

  const reopened = runtime.reopen({ seasonDb });
  await flush();
  assert.equal(reopened.context.RunState.loadProfile().preferences.smartAutoLineup, true);
  assert.equal(reopened.context.RunState.loadProfile().teamIdentity.name, "Persistent Team");
  console.log("shop/settings production paths: Home, tabs, settings, profile mutations, run immutability and reopen OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
