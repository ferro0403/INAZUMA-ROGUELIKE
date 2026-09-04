"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const BudgetStorage = require("./helpers/budget-storage");
const { load } = require("./helpers/production-runtime");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function controllerContext(extra = {}) {
  const context = {
    console,
    structuredClone,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Error,
    Date,
    Math,
    Map,
    Set,
    SEASON1_CONFIG: {
      saveVersion: 2,
      nodeLabels: {},
      maxInventory: 20,
    },
    RunState: { clone: structuredClone },
    MapEngine: {},
    ...extra,
  };
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

async function main() {
  // RunState legacy primitives must restore the mounted runtime if their own save fails.
  {
    const storage = new BudgetStorage(2_000_000);
    const context = load(storage);
    const run = context.RunState.createRun({ name: "Persistence Audit" }, "ie1");
    run.lastPlayedAt = "2026-01-01T00:00:00.000Z";
    run.phase = "match";
    run.lives = 2;
    run.currentZone = {
      bossIndex: 0,
      bossId: "boss",
      currentNodeId: "start",
      pendingNodeId: "match",
      path: ["start"],
      nodes: [],
      edges: [],
      completedNodeIds: ["start"],
    };
    run.activeMatch = { type: "boss", previousNodeId: "start" };
    run.checkpoint = { marker: "old-checkpoint" };
    context.RunState.save(run, { replaceRun: true });

    const canonical = clone(context.RunState.load("ie1", { readOnly: true }));
    storage.budget = 0;
    assert.throws(() => context.RunState.touch(run), /storage-unavailable|canonical-write-failed|write-locked/);
    assert.equal(run.lastPlayedAt, canonical.lastPlayedAt, "touch failure restores lastPlayedAt");
    assert.equal(run.storageGeneration, canonical.storageGeneration, "touch failure keeps canonical generation mounted");

    assert.throws(() => context.RunState.createCheckpoint(run), /storage-unavailable|canonical-write-failed|write-locked/);
    assert.deepEqual(run.checkpoint, canonical.checkpoint, "checkpoint failure restores the previous checkpoint");

    assert.throws(() => context.RunState.restoreAfterLoss(run, "start", "boss"), /storage-unavailable|canonical-write-failed|write-locked/);
    assert.equal(run.lives, canonical.lives, "loss save failure restores lives");
    assert.equal(run.phase, canonical.phase, "loss save failure restores phase");
    assert.equal(run.currentZone.pendingNodeId, canonical.currentZone.pendingNodeId, "loss save failure restores zone navigation");
  }

  // Map-zone generation is probe-only until persistGameplayMutation commits it.
  {
    let run = {
      runId: "map-audit",
      seasonId: "ie1",
      phase: "squad",
      bossIndex: 0,
      completedBossIds: [],
      unlockedTeamIds: [],
      roster: [], lineup: [], bench: [], inventory: [], effects: {}, randomEventHistory: [],
      fiveVFive: null, activeMatch: null, pendingBossVictory: null, postBossFlow: null,
      currentZone: null,
      checkpoint: null,
      teamIdentity: { name: "Audit" },
    };
    const zone = {
      bossIndex: 0,
      bossId: "boss",
      currentNodeId: "start",
      startNodeId: "start",
      pendingNodeId: null,
      completedNodeIds: ["start"],
      path: ["start"],
      nodes: [{ id: "start", type: "start", layer: 0 }],
      edges: [],
    };
    const context = controllerContext({
      BossGameOverRuntime: {
        ensureCurrentZoneMutation({ run: current }) {
          if (!current.currentZone) {
            current.currentZone = clone(zone);
            return { changed: true, generated: true, boss: { teamId: "boss" } };
          }
          return { changed: false, generated: false, boss: { teamId: "boss" } };
        },
      },
    });
    vm.runInContext(fs.readFileSync("js/map/run-map-controller.js", "utf8"), context, { filename: "run-map-controller.js" });

    let persistenceCalls = 0;
    const baseDeps = {
      getRun: () => run,
      getUi: () => ({}),
      getSeasonDb: () => ({ bossOrder: [{ teamId: "boss", teamName: "Boss" }] }),
      app: { innerHTML: "" },
      modalRoot: {},
      DEV_MODE: false,
      topbar: () => "",
      bottomNav: () => "",
      escapeHtml: String,
      teamById: () => null,
      resetRenderedViewScroll() {}, bindSectionRootNav() {}, bindBottomNav() {}, openBossPreviewModal() {},
      openDevLegendaryPull() {}, toast() {}, renderPostBossRecovery() {}, resumeRun() {},
      matchTransactionIdentity() {}, commitMatchMutation() {}, recoverInterruptedSpecialMatchAccess: () => true,
      recoverInterruptedBossAccess: () => true, ensureFiveVFive() {}, fiveRoleForPlayerId() {}, createOrLoadFiveMatch() {},
      specialMatchController: {}, bossMatchFromNode() {}, renderFiveVFive() {}, renderMatch() {}, openPull() {},
      resolveTradeNode() {}, closeModal() {}, itemDefinitionById() {}, weightedItemCandidates: () => [], inventoryItemIdentity() {},
      groupedOwnedInventoryItems: () => [], itemStatLabel() {}, itemIcon: () => "", openModal() {}, cssEscape: String,
      receiveItem() {}, nodeRouter: { dispatch() {} },
    };

    let mode = "fail";
    baseDeps.persistGameplayMutation = (spec) => {
      persistenceCalls += 1;
      if (mode === "fail") return { ok: false, run, error: new Error("quota") };
      const candidate = clone(run);
      const value = spec.mutate(candidate);
      run = candidate;
      return { ok: true, run, value };
    };
    const controller = context.RunMapControllerRuntime.create(baseDeps);

    const before = clone(run);
    const failed = controller.ensureCurrentZone({ label: "resume-map-navigation", rerenderOnFailure: false });
    assert.equal(failed.ok, false, "failed map-zone commit reports failure");
    assert.deepEqual(run, before, "failed map-zone commit never pre-mutates mounted runtime");
    assert.equal(persistenceCalls, 1);

    mode = "success";
    const committed = controller.ensureCurrentZone({ label: "resume-map-navigation", rerenderOnFailure: false });
    assert.equal(committed.ok, true);
    assert.equal(run.phase, "map", "map phase becomes visible only after commit");
    assert.deepEqual(run.currentZone, zone, "generated zone is committed canonically");
    assert.deepEqual(run.checkpoint.currentZone, zone, "zone and checkpoint are part of the same transaction");
    assert.equal(persistenceCalls, 2);

    const idempotent = controller.ensureCurrentZone({ label: "resume-map-navigation", rerenderOnFailure: false });
    assert.equal(idempotent.ok, true);
    assert.equal(persistenceCalls, 2, "already-canonical map resume does not create another commit");
  }

  // Season selection must return false and preserve recovered state when timestamp/migration persistence fails.
  {
    const original = {
      runId: "season-audit",
      seasonId: "ie1",
      lastPlayedAt: "2026-01-01T00:00:00.000Z",
      roster: [{ playerId: "p", source: "season1", level: 0 }],
      finalization: null,
      permanentEffectOutbox: [],
    };
    let mounted = clone(original);
    const context = controllerContext({
      RunState: {
        clone,
        load: () => clone(original),
        persistMutationOrRecover(current) {
          for (const key of Object.keys(current)) delete current[key];
          Object.assign(current, clone(original));
          return { ok: false, run: current, error: new Error("quota") };
        },
      },
      RoguelikeRules: {
        migrateDefeatedBossPlayerLevels(target) {
          target.roster[0].level = 10;
          return 1;
        },
      },
    });
    vm.runInContext(fs.readFileSync("js/run-entry/season-selection-controller.js", "utf8"), context, { filename: "season-selection-controller.js" });
    const controller = context.SeasonSelectionController.create({
      loadSeason: async () => {},
      setRun: (next) => { mounted = next; },
      getRun: () => mounted,
      getActiveSeason: () => ({ id: "ie1" }),
      getSeasonDb: () => ({}),
      ensureRunSchema() {}, drainPermanentEffects() {},
    });
    const selected = await controller.selectSeason("ie1", { markPlayed: true });
    assert.equal(selected, false, "season resume blocks navigation after failed persistence");
    assert.deepEqual(mounted, original, "season resume keeps recovered canonical state mounted");
  }

  // New-run lifecycle may own one direct first save, but UI must not advance if it fails.
  {
    let setRunCalls = 0;
    let formationCalls = 0;
    let closeCalls = 0;
    const toasts = [];
    const candidate = { runId: "new-run", seasonId: "ie1", phase: "formation" };
    const context = controllerContext({
      RunState: {
        createRun: () => candidate,
        save() { throw new Error("quota"); },
        load: () => null,
        isActiveRun: () => false,
        saveProfileTeamIdentity() {},
      },
    });
    vm.runInContext(fs.readFileSync("js/run-entry/season-selection-controller.js", "utf8"), context, { filename: "season-selection-controller.js" });
    const controller = context.NewRunController.create({
      normalizeTeamIdentity: (value) => value,
      getActiveSeason: () => ({ id: "ie1" }),
      setRun: () => { setRunCalls += 1; },
      closeModal: () => { closeCalls += 1; },
      renderFormationChoice: () => { formationCalls += 1; },
      toast: (message) => toasts.push(message),
    });
    assert.equal(controller.startRunWithIdentity({ name: "Audit" }), false);
    assert.equal(setRunCalls, 0, "failed new-run first save never mounts unsaved run");
    assert.equal(formationCalls, 0, "failed new-run first save never renders formation");
    assert.equal(closeCalls, 0, "failed new-run first save keeps current modal/context available");
    assert.equal(toasts.length, 1);
  }

  console.log("final persistence audit: rollback primitives, atomic map resume and lifecycle save guards OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
