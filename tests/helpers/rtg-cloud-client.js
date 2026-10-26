"use strict";
const fs = require("fs"), vm = require("vm");
require("../../js/road-to-glory/rtg-cloud-snapshot");
const BudgetStorage = require("./budget-storage"), { load } = require("./production-runtime");
const { makeFakeIndexedDb } = require("./fake-indexeddb-atomic");
const { attachAuthenticatedCloud } = require("./authenticated-cloud-runtime");
const { input } = require("./rtg-cloud-fixtures");
async function client(backendState, source = input(), options = {}) {
  const local = options.localStorage || new BudgetStorage(), c = load(local, { fullRuntime: true, seasonId: "orion" }).context;
  c.indexedDB = options.indexedDB || makeFakeIndexedDb();
  const files = ["rtg-persistence-runtime", "rtg-card-identity", "rtg-coaches", "rtg-state", "rtg-storage", "rtg-repository", "rtg-cloud-snapshot", "rtg-cloud-local-adapter", "rtg-cloud-restore-adapter"];
  for (const file of files) if (fs.existsSync(`js/road-to-glory/${file}.js`)) vm.runInContext(fs.readFileSync(`js/road-to-glory/${file}.js`, "utf8"), c, { filename: file });
  const storage = c.RoadToGloryStorage.create();
  if (source) {
    await storage.write(source.trilogy, "state"); await storage.write(source.aresOrion, "state:rtg-ares-orion"); await storage.write(source.shared, "shared:account");
    local.setItem("inazuma.rtg.album.v1", JSON.stringify(source.album));
  }
  if (!options.noProfile && !options.reopen) c.RunState.saveProfileTeamIdentity({ name: "Synthetic account" });
  const cloud = await attachAuthenticatedCloud(c, { backendState, configureCore: context => {
    context.PersistenceBootstrapGate.markAuth = auth => context.PersistenceRecoveryGuard.bindUid(auth?.status === "authenticated" ? auth.uid : null);
    vm.runInContext(fs.readFileSync("js/road-to-glory/rtg-cloud-bridge.js", "utf8"), context);
  } });
  const repo = c.RoadToGloryRepository.create({ storage, stateApi: c.RoadToGloryState, seedFactory: () => "new-local-seed" });
  return { c, local, storage, repo, ...cloud };
}

module.exports = { client };
