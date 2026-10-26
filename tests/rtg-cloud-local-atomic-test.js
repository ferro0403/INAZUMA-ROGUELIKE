"use strict";
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const { makeFakeIndexedDb } = require("./helpers/fake-indexeddb-atomic");

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
function load(factory) {
  const context = {
    globalThis: null, window: null, console, Error, TypeError, Object, Array,
    String, Number, Promise, JSON, Math, RegExp, Set, Map, indexedDB: factory,
    RoadToGloryCoaches: { BY_ID: { "36": {}, "4401": {} } },
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  for (const path of ["js/road-to-glory/rtg-storage.js", "js/road-to-glory/rtg-repository.js"]) {
    vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
  }
  const stateApi = {
    DEVELOPMENT_RARITIES: ["Scarso", "Debole", "Normale", "Buono", "Forte", "Elite", "Mondiale", "Leggenda", "Aurico"],
    clone,
    validate(raw) {
      if (raw?.tokens < 0) throw new Error("invalid RTG tokens");
      return clone(raw);
    },
    createInitial({ campaignSeed, campaignId }) {
      return {
        campaignSeed, campaignId,
        activeSeasonId: campaignId === "rtg-ie-trilogy" ? "ie1" : "ie2",
        tokens: 0, gachaAcquiredCards: [], developmentByCardId: {},
        coachOwnedIds: [], coachPullCount: 0,
        seasonTransitionRewardedIds: [], projects: {}, activeMatch: null,
      };
    },
  };
  const storage = context.RoadToGloryStorage.create({ indexedDB: factory });
  const repository = context.RoadToGloryRepository.create({ storage, stateApi, seedFactory: () => "seed" });
  return { context, storage, repository };
}

(async () => {
  const failureOptions = {};
  const factory = makeFakeIndexedDb(failureOptions);
  const { storage, repository } = load(factory);
  const trilogy = {
    campaignId: "rtg-ie-trilogy", campaignSeed: "legacy-trilogy",
    activeSeasonId: "ie1", tokens: 1800, gachaAcquiredCards: [],
    developmentByCardId: { "ie2::hero": { targetPotential: 90, currentRarity: "Mondiale", evolutionCount: 2 } },
    coachOwnedIds: ["36"], coachPullCount: 1, projects: { Buono: 1 },
    seasonTransitionRewardedIds: ["reward-1"],
  };
  const ares = {
    campaignId: "rtg-ares-orion", campaignSeed: "legacy-ares",
    activeSeasonId: "ie2", tokens: 1800, gachaAcquiredCards: [],
    developmentByCardId: { "ie2::hero": { targetPotential: 70, currentRarity: "Elite", evolutionCount: 1 } },
    coachOwnedIds: ["4401"], coachPullCount: 2, projects: { Elite: 2 },
  };
  // Legacy shared payload is intentionally missing development and coaches.
  const shared = { tokens: 1800, gachaAcquiredCards: [] };
  await storage.write(trilogy, "state");
  await storage.write(ares, "state:rtg-ares-orion");
  await storage.write(shared, "shared:account");

  const beforeRead = factory._transactionCount();
  repository.selectCampaign("rtg-ares-orion");
  const seen = await repository.read();
  assert.strictEqual(factory._transactionCount(), beforeRead + 1, "repository.read uses one readonly transaction");
  assert.strictEqual(seen.developmentByCardId["ie2::hero"].currentRarity, "Mondiale");
  assert.deepStrictEqual(Array.from(seen.coachOwnedIds), ["36", "4401"]);
  assert.deepStrictEqual(clone(await storage.read("shared:account")), shared, "read must not persist a hidden migration");

  const beforeFailure = clone(await storage.readMany(["state", "state:rtg-ares-orion", "shared:account"]));
  failureOptions.failPutKey = "shared:account";
  await assert.rejects(repository.update("draw-with-quota-error", (state) => {
    state.tokens -= 900;
    state.coachOwnedIds.push("36");
    state.coachPullCount += 1;
    state.seasonTransitionRewardedIds = ["reward-2"];
    return state;
  }), (error) => error.code === "storage-quota-exceeded");
  delete failureOptions.failPutKey;
  const afterFailure = clone(await storage.readMany(["state", "state:rtg-ares-orion", "shared:account"]));
  assert.deepStrictEqual(afterFailure, beforeFailure,
    "failed second put must roll back both the campaign and shared account");

  const beforeCommit = factory._transactionCount();
  const committed = await repository.update("coach-draw", (state) => {
    state.tokens -= 900;
    state.coachPullCount += 1;
    state.seasonTransitionRewardedIds = ["reward-2"];
    return state;
  });
  assert.strictEqual(factory._transactionCount(), beforeCommit + 1, "one transaction per RTG update");
  assert.strictEqual(committed.tokens, 900);
  const persisted = clone(await storage.readMany(["state", "state:rtg-ares-orion", "shared:account"]));
  assert.strictEqual(persisted["state:rtg-ares-orion"].tokens, 900);
  assert.strictEqual(persisted["shared:account"].tokens, 900);
  assert.strictEqual(persisted["state"].tokens, 1800, "unselected campaign remains untouched");
  assert.strictEqual(persisted["state"].projects.Buono, 1);
  assert.strictEqual(persisted["state:rtg-ares-orion"].projects.Elite, 2);
  assert.deepStrictEqual(persisted["shared:account"].coachOwnedIds, ["36", "4401"]);
  assert.strictEqual(persisted["shared:account"].developmentByCardId["ie2::hero"].currentRarity, "Mondiale");

  const beforeRejectedUpdater = clone(await storage.readMany(["state", "state:rtg-ares-orion", "shared:account"]));
  await assert.rejects(repository.update("reject-gameplay", () => {
    throw new Error("gameplay rejected");
  }), /gameplay rejected/);
  await assert.rejects(repository.update("reject-async", async (state) => state),
    (error) => error.code === "rtg-async-updater-not-supported");
  assert.deepStrictEqual(clone(await storage.readMany(["state", "state:rtg-ares-orion", "shared:account"])), beforeRejectedUpdater);

  repository.selectCampaign("rtg-ie-trilogy");
  const other = await repository.read();
  assert.strictEqual(other.developmentByCardId["ie2::hero"].currentRarity, "Mondiale");
  assert.deepStrictEqual(Array.from(other.coachOwnedIds), ["36", "4401"]);

  const beforeCreate = factory._transactionCount();
  const ensured = await repository.ensureCampaign();
  assert.strictEqual(ensured.campaignSeed, "legacy-trilogy");
  assert.strictEqual(factory._transactionCount(), beforeCreate + 1, "ensureCampaign uses one transaction");

  // New database: the first campaign and shared account appear together.
  const emptyFactory = makeFakeIndexedDb();
  const fresh = load(emptyFactory);
  const created = await fresh.repository.ensureCampaign();
  assert.strictEqual(created.campaignSeed, "seed");
  const createdRecords = clone(await fresh.storage.readMany(["state", "shared:account"]));
  assert.strictEqual(createdRecords.state.campaignSeed, "seed");
  assert.strictEqual(createdRecords["shared:account"].tokens, 0);
  assert.deepStrictEqual(createdRecords["shared:account"].coachOwnedIds, []);

  // A failure in the shared write during initial creation leaves neither record.
  const initialFailure = { failPutKey: "shared:account" };
  const blocked = load(makeFakeIndexedDb(initialFailure));
  await assert.rejects(blocked.repository.ensureCampaign(), (error) => error.code === "storage-quota-exceeded");
  const none = await blocked.storage.readMany(["state", "shared:account"]);
  assert.strictEqual(none.state, undefined);
  assert.strictEqual(none["shared:account"], undefined);

  console.log("rtg-cloud-local-atomic-test: PASS (rollback, legacy read, cross-campaign, single transaction, retry)");
})().catch((error) => { console.error(error); process.exitCode = 1; });
