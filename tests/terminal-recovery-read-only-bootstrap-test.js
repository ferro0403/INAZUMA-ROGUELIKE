"use strict";

const assert = require("assert");
const fs = require("fs");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

(async () => {
  const uid = "historical-user";
  const storage = new BudgetStorage();
  const runtime = load(storage, ["persistence-recovery-guard.js", "persistence-bootstrap-gate.js", "run-state.js", "album-progress.js"]);
  const albumKey = runtime.AlbumProgress.STORAGE_KEY;
  const gameplayRun = runtime.RunState.createRun({ name: "IE1" }, "ie1");
  runtime.RunState.save(gameplayRun);
  const albumBefore = JSON.stringify({ schemaVersion: 1, collections: { ie1: { unlockedPlayerIds: { "free-a": { firstUnlockedAt: "2025-01-01", firstSource: "legacy" } } } } });
  storage.setItem(albumKey, albumBefore);
  storage.setItem(runtime.PersistenceRecoveryGuard.EPOCH_KEY, "168");
  storage.setItem(`inazuma.cloud.restoreTerminal.${uid}`, JSON.stringify({ operationId: "completed-legacy-restore" }));

  let cloudEvents = 0;
  runtime.dispatchEvent = event => { if (event.type === "inazuma:local-save-committed") cloudEvents += 1; };
  runtime.PersistenceBootstrapGate.markAuth({ status: "authenticated", uid });
  await runtime.PersistenceBootstrapGate.ready;
  assert.equal(await runtime.PersistenceBootstrapGate.whenAccessible(), true);
  assert.equal(runtime.PersistenceRecoveryGuard.isBlocked(), true);
  assert.equal(runtime.PersistenceRecoveryGuard.getState().status, "terminal-recovery");

  assert.doesNotThrow(() => runtime.AlbumProgress.configureFreeAgentIds(["free-a"]));
  const memoryProgress = runtime.AlbumProgress.read();
  assert(memoryProgress.collections.ie2.unlockedPlayerIds["free-a"], "the configured free-agent ID is synchronized in the in-memory normalized view");
  assert.equal(storage.getItem(albumKey), albumBefore, "Album storage remains byte-for-byte identical");
  assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), 168, "read-only bootstrap does not reserve a mutation epoch");
  assert.equal(cloudEvents, 0, "read-only bootstrap emits no cloud-save event");
  assert.equal(runtime.PersistenceRecoveryGuard.isBlocked(), true, "bootstrap does not weaken the recovery fence");
  assert.throws(() => runtime.AlbumProgress.write(memoryProgress), error => error?.code === "restore-recovery-required", "gameplay Album writes remain fenced");
  assert.throws(() => runtime.RunState.save(gameplayRun), error => error?.code === "restore-recovery-required", "gameplay run writes remain fenced");

  // The production bootstrap reaches its render/account setup after the same
  // accessible gate and memory-only configuration; audit its automatic Home
  // migrations so none can write while the fence is active.
  const app = fs.readFileSync("js/app.js", "utf8");
  const accountUi = fs.readFileSync("js/account-ui.js", "utf8");
  const index = fs.readFileSync("index.html", "utf8");
  assert.match(app, /configureAlbumForBootstrap[\s\S]*persist: persistenceWritesAllowed\(\)/);
  assert.match(app, /persistenceWritesAllowed\(\) && \(!run\?\.finalization/);
  assert.match(app, /persistenceWritesAllowed\(\) && run && global\.RoguelikeRules\.migrateDefeatedBossPlayerLevels/);
  assert.match(app, /buttonMarkup\?\.\(\)/, "Home retains the Account entry point");
  assert.match(app, /await renderHome\(\)/, "production init waits for Home bootstrap completion");

  const homeStorage = new BudgetStorage();
  const homeSeed = load(homeStorage);
  homeSeed.RunState.save(homeSeed.RunState.createRun({ name: "IE1" }, "ie1"));
  homeStorage.setItem(`inazuma.cloud.restoreTerminal.${uid}`, JSON.stringify({ operationId: "home-bootstrap" }));
  const homeRuntime = load(homeStorage, { fullRuntime: true, seasonId: "ie1", seasonDb: { seasonId: "ie1", players: [], teams: [], formations: { eleven: [] }, bossOrder: [] } });
  homeRuntime.context.PersistenceRecoveryGuard.bindUid(uid);
  const homeEpoch = homeRuntime.context.PersistenceRecoveryGuard.readEpoch();
  const homeOperationStart = homeStorage.operations.length;
  await assert.doesNotReject(() => homeRuntime.context.__INAZUMA_UI_TEST__.renderHome(), "the real Home render path completes during terminal recovery");
  assert.deepEqual(homeStorage.operations.slice(homeOperationStart).filter(operation => operation.method !== "getItem"), [], "Home and its Account entry bootstrap perform no storage writes");
  assert.equal(homeRuntime.context.PersistenceRecoveryGuard.readEpoch(), homeEpoch);
  assert.equal(homeRuntime.context.PersistenceRecoveryGuard.isBlocked(), true);

  homeRuntime.context.InazumaAccountUI = { buttonMarkup: () => '<button type="button" data-account-trigger><span>ACCOUNT</span></button>' };
  const persistenceFallback = homeRuntime.context.__INAZUMA_UI_TEST__.showLoadError({ code: "restore-recovery-required" });
  assert.match(persistenceFallback, /restore-recovery-required/);
  assert.match(persistenceFallback, /data-account-trigger/);
  assert.doesNotMatch(persistenceFallback, /Live Server|AVVIA_GIOCO\.bat/);
  const databaseFallback = homeRuntime.context.__INAZUMA_UI_TEST__.showLoadError(new Error("Database non raggiungibili"));
  assert.match(databaseFallback, /Live Server/);
  assert.match(databaseFallback, /AVVIA_GIOCO\.bat/);
  assert.doesNotMatch(databaseFallback, /data-account-trigger/);

  runtime.PersistenceRecoveryGuard.bindUid(null);
  storage.setItem(albumKey, albumBefore);
  const epochBeforeWritable = runtime.PersistenceRecoveryGuard.readEpoch();
  runtime.AlbumProgress.configureFreeAgentIds(["free-a"]);
  const persisted = JSON.parse(storage.getItem(albumKey));
  assert(persisted.collections.ie2.unlockedPlayerIds["free-a"], "normal writable bootstrap still persists syncFreeAgentUnlocks");
  assert.equal(runtime.PersistenceRecoveryGuard.readEpoch(), epochBeforeWritable + 1);

  assert.match(app, /result\.repaired === true \? "Riparazione salvataggio completata\. Report copiato\." : "Nessuna modifica necessaria\. Report copiato\."/);
  assert.match(index, /js\/album-progress\.js\?v=20260826-terminal-recovery-bootstrap-1/);
  assert.match(index, /js\/app\.js\?v=20260826-terminal-recovery-bootstrap-1/);
  assert.match(app, /const databaseError = !persistenceError && \(global\.location\?\.protocol === "file:"/);
  assert.match(app, /InazumaAccountUI\?\.buttonMarkup\?\.\(\)/, "the persistence fallback renders the production Account trigger");
  assert.match(accountUi, /document\.addEventListener\("click", onClick\)/, "Account uses a global delegated click binding for dynamically rendered triggers");
  assert.match(accountUi, /target\.matches\("\[data-account-trigger\]"\)\) open\(/, "clicking the fallback trigger opens Account");
  assert.match(app, /Apri Account per controllare lo stato del salvataggio/);
  console.log("terminal recovery bootstrap is memory-only, keeps gameplay fenced, and writable Album sync is preserved: ok");
})().catch(error => { console.error(error); process.exit(1); });
