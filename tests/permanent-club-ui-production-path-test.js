"use strict";

const assert = require("assert");
const { load } = require("./helpers/production-runtime");
const freeAgentFixture = require("../data/FREE_AGENTS_compact.json");

function storageHarness() {
  const values = new Map(), writes = [];
  return {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { values.set(key, String(value)); writes.push(String(key)); },
    removeItem: key => values.delete(key),
    writes,
  };
}

const clone = value => structuredClone(value);
const flush = async () => { await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)); };
const runFields = run => Object.fromEntries(["roster", "lineup", "bench", "inventory", "activeMatch", "currentZone", "lives", "bossIndex", "postBossFlow", "pendingBossVictory"].map(key => [key, clone(run?.[key])]));

async function main() {
  const storage = storageHarness();
  const alpha = clone(freeAgentFixture.players.find((player) => player.category === "Normale"));
  const beta = clone(freeAgentFixture.players.find((player) => player.category === "Debole"));
  const seasonDb = { seasonId: "ie1", players: [alpha, beta], teams: [{ teamId: "raimon-test", teamName: "Raimon Test", playerIds: [alpha.playerId, beta.playerId] }], formations: { eleven: [] }, bossOrder: [], recruitmentPool: { entries: [] } };
  const freeAgentsDb = { players: [beta] };
  const run = { saveVersion: 2, runId: "permanent-ui-run", seasonId: "ie1", phase: "map", lives: 2, bossIndex: 1, roster: [{ playerId: alpha.playerId, source: "ie2" }], lineup: [alpha.playerId], bench: [], inventory: [{ itemId: "ball" }], activeMatch: null, fiveVFive: { formation: "diamond", assignments: {} }, completedBossIds: [], map: { nodes: [] }, currentZone: 0, postBossFlow: null, pendingBossVictory: null };

  const runtime = load(storage, { fullRuntime: true, run, seasonId: "ie1", seasonDb, useProductionDevelopmentAccount: true });
  const { context, query, queryAll } = runtime;
  const ui = context.__INAZUMA_UI_TEST__;
  const canonical = context.RunState.load("ie1", { readOnly: true });
  ui.setPermanentClubTestContext({ run: canonical, seasonDb, freeAgentsDb, activeSeason: { id: "ie1" } });
  const developmentState = context.DevelopmentV3.empty();
  developmentState.coins = 20;
  const targetPotential = context.DevelopmentV2.threshold("Buono");
  developmentState.players[String(beta.playerId)] = { legacyNormale: null, steps: [{
    stepId: "beta-buono", rarity: "Buono", fromRarity: beta.category, fromPotential: Number(beta.finalOverall), toPotential: targetPotential,
    profile: context.DevelopmentV3.materializeProfile({ basePlayer: beta, targetPotential, category: "Buono", database: freeAgentsDb, progression: context.InazumaProgression }),
    receipt: { coinsConsumed: 200, cupsConsumed: 1, cupsConsumedBySource: { ie2: 1 }, projectsConsumed: 1 }, createdAt: "2026-09-01T00:00:00.000Z",
  }] };
  context.DevelopmentAccountV3.commit(developmentState, { database: freeAgentsDb });
  const baselineRun = runFields(runtime.canonical);

  // BASE #387 behavior: opening Album backfills a historical local recruit into Album, without persisting run normalization.
  assert.equal(context.AlbumProgress.isAlbumPlayerUnlocked("ie1", alpha.playerId), false);
  await ui.renderAlbumCollections();
  assert.match(context.document.getElementById("app").innerHTML, /Inazuma Eleven 1/);
  assert.equal(context.AlbumProgress.isAlbumPlayerUnlocked("ie1", alpha.playerId), true, "legacy run recruit is backfilled");
  assert.deepStrictEqual(runFields(runtime.canonical), baselineRun, "Album leaves canonical gameplay fields unchanged");
  query('[data-album-collection="ie1"]').click(); await flush();
  assert.match(context.document.getElementById("app").innerHTML, /Raimon Test/);
  query('[data-album-team="raimon-test"]').click(); await flush();
  const rosterMarkup = context.document.getElementById("app").innerHTML;
  assert.match(rosterMarkup, /1 \/ 2 giocatori sbloccati/); assert.match(rosterMarkup, /data-album-roster/);
  query(`[data-album-player-entry="${alpha.playerId}"]`).click();
  assert.ok(runtime.modalMarkup.includes(alpha.name)); assert.match(runtime.modalMarkup, /album-detail-badge/);

  const champion = { archiveKey: "permanent-ui-run::ie2::ie2::boss", hallTeamId: "hall-permanent-ui", runId: "champion-run", teamName: "Golden Raimon", modeId: "ie2", seasonId: "ie1", seasonName: "Ares", victoryDate: "2026-09-01T00:00:00.000Z", finalBossId: "boss", finalBossName: "Royal", finalFormation: "4-3-3", finalAverageOverall: 81, finalStartingEleven: [{ ...alpha, role: alpha.position, finalRarity: "Buono", finalOverall: 81, finalLevel: 20, finalStats: alpha.stats }], fullRoster: [{ ...alpha, role: alpha.position, finalRarity: "Buono", finalOverall: 81, finalLevel: 20, finalStats: alpha.stats }], bench: [], playerStatistics: { [alpha.playerId]: { goals: 3 } }, runStatistics: {}, awards: [{ id: "mvp", label: "MVP", playerId: alpha.playerId, playerName: alpha.name }] };
  context.HallOfFameStorage.addChampion(champion); const hallWritesBefore = storage.writes.filter(key => key.includes("hallOfFame")).length;
  ui.renderHallOfFame();
  assert.match(context.document.getElementById("app").innerHTML, /Golden Raimon/); assert.ok(context.document.getElementById("app").innerHTML.includes(alpha.name));
  query('[data-open-hall-team="hall-permanent-ui"]').click();
  assert.match(context.document.getElementById("app").innerHTML, /4-3-3/); assert.match(context.document.getElementById("app").innerHTML, /MVP/);
  query(`[data-hall-player="${alpha.playerId}"]`).click(); assert.ok(runtime.modalMarkup.includes(alpha.name)); assert.match(runtime.modalMarkup, /player-detail-historical/);
  assert.equal(storage.writes.filter(key => key.includes("hallOfFame")).length, hallWritesBefore, "Hall browsing performs no Hall write");
  assert.deepStrictEqual(runFields(runtime.canonical), baselineRun, "Hall leaves canonical gameplay fields unchanged");

  context.AlbumProgress.unlockAlbumPlayer("ie1", beta.playerId, { source: "test-fixture" });
  ui.renderDevelopmentCenter("players");
  const search = query("#development-search"); search.value = beta.name; search.dispatchEvent({ type: "input", target: search });
  const rarity = query("#development-rarity"); rarity.value = "Buono"; rarity.dispatchEvent({ type: "change", target: rarity });
  assert.equal(queryAll(`[data-development-player="${beta.playerId}"]`).length > 0, true, "search/rarity retains the evolved player");
  queryAll(`[data-development-player="${beta.playerId}"]`).at(-1).click();
  assert.ok(context.document.getElementById("development-tab-content").innerHTML.includes(beta.name)); assert.match(context.document.getElementById("development-tab-content").innerHTML, /Buono/);
  queryAll(`[data-development-selected-card="${beta.playerId}"]`).at(-1).click(); assert.ok(runtime.modalMarkup.includes(beta.name)); assert.match(runtime.modalMarkup, /Potenziale/);

  ui.renderDevelopmentCenter("management");
  const managementRarity = query("#development-management-rarity"); managementRarity.value = "Buono"; managementRarity.dispatchEvent({ type: "change", target: managementRarity });
  const managementMarkup = context.document.getElementById("development-tab-content").innerHTML;
  assert.match(managementMarkup, /Buono · 75/); assert.match(managementMarkup, /0 \/ 50|1 \/ 50/); assert.match(managementMarkup, /BASE/);
  queryAll(`[data-open-management-player="${beta.playerId}"]`).at(-1).click(); assert.ok(runtime.modalMarkup.includes(beta.name));
  ui.renderDevelopmentCenter("management");
  queryAll(`[data-regress-management-player="${beta.playerId}"]`).at(-1).click(); assert.match(runtime.modalMarkup, /CONFERMA REGRESSIONE/);
  queryAll("[data-confirm-regression]").at(-1).click();
  const regressed = context.DevelopmentAccountV3.read();
  assert.equal(regressed.players[String(beta.playerId)], undefined); assert.equal(regressed.coins, 220); assert.equal(regressed.cupsBySeason.ie2, 1);
  assert.match(context.document.getElementById("app").innerHTML, /CENTRO DI SVILUPPO/);
  assert.deepStrictEqual(runFields(runtime.canonical), baselineRun, "Development leaves canonical gameplay fields unchanged");

  for (const delegate of ["developmentCurrencyIcon", "bindHallPlayerDetails", "renderHallOfFameDetail", "renderDevelopmentCenter"]) assert.equal(typeof ui[delegate], "function", `${delegate} remains callable`);
  assert.match(ui.developmentCurrencyIcon("coins"), /development-resource-icon/);
  const cloud = context.InazumaCloudSaveCore.readLocalSnapshot();
  assert.deepStrictEqual(Object.keys(cloud).sort(), ["album", "development", "hallOfFame", "profile"]);
  for (const forbidden of ["run", "roster", "lineup", "bench", "inventory", "activeMatch", "currentZone", "lives", "bossIndex", "postBossFlow"]) assert.equal(Object.hasOwn(cloud, forbidden), false);
  runtime.destroy();
  console.log("permanent club UI production paths: Album, backfill, Hall, Development players/management/regression and cloud boundary OK");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
