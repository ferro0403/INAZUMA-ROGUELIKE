"use strict";
const assert = require("assert"), fs = require("fs"), vm = require("vm");
const { makeFakeIndexedDb } = require("./helpers/fake-indexeddb-atomic");
const projection = require("../js/road-to-glory/rtg-cloud-snapshot");
const { clone, input } = require("./helpers/rtg-cloud-fixtures");
function load(failures = {}) {
  const values = new Map(); let albumFailure = false;
  const localStorage = { getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (albumFailure && key === "inazuma.rtg.album.v1") throw Object.assign(Error("quota"), { name: "QuotaExceededError" }); values.set(key, String(value)); }, removeItem: key => values.delete(key) };
  const c = { globalThis: null, console, Object, Array, String, Number, Math, Set, Map, JSON, Promise, Error, TypeError, RegExp,
    localStorage, indexedDB: makeFakeIndexedDb(failures), RoadToGloryCloudSnapshot: projection };
  c.globalThis = c; vm.createContext(c);
  for (const path of ["js/persistence-recovery-guard.js", "js/road-to-glory/rtg-card-identity.js", "js/road-to-glory/rtg-coaches.js", "js/road-to-glory/rtg-state.js", "js/road-to-glory/rtg-storage.js", "js/road-to-glory/rtg-cloud-local-adapter.js", "js/road-to-glory/rtg-cloud-restore-adapter.js"]) {
    if (fs.existsSync(path)) vm.runInContext(fs.readFileSync(path, "utf8"), c, { filename: path });
  }
  const storage = c.RoadToGloryStorage.create();
  return { c, storage, values, localStorage, setAlbumFailure: value => { albumFailure = value; } };
}
(async () => {
  const failures = {}, h = load(failures), source = input();
  assert.ok(h.c.RoadToGloryCloudRestoreAdapter?.create, "the journal must have an RTG restore adapter");
  const adapter = h.c.RoadToGloryCloudRestoreAdapter.create({ storage: h.storage, localStorage: h.localStorage, stateApi: h.c.RoadToGloryState, projector: projection });
  await h.storage.write(source.trilogy, "state"); await h.storage.write(source.aresOrion, "state:rtg-ares-orion"); await h.storage.write(source.shared, "shared:account");
  const localSquads = clone(source.trilogy.squads);
  h.localStorage.setItem("inazuma.rtg.squad-slots.v2.ie1", '{"1":{"formationId":"local"}}');
  const slots = h.localStorage.getItem("inazuma.rtg.squad-slots.v2.ie1");
  const remoteInput = input(); remoteInput.shared.tokens = 27; remoteInput.shared.coachOwnedIds = [];
  remoteInput.trilogy.coachOwnedIds = []; remoteInput.aresOrion.coachOwnedIds = [];
  const target = projection.project(remoteInput);
  await adapter.preflight(target);
  const journal = { uid: "u", operationId: "op-restore", stage: "rtg" };
  h.localStorage.setItem("inazuma.cloud.restoreJournal.u", JSON.stringify(journal)); h.c.PersistenceRecoveryGuard.bindUid("u");
  const options = { restoreOwnershipToken: journal.operationId, suppressCloudEvent: true };
  const before = clone(await h.storage.readMany(["state", "state:rtg-ares-orion", "shared:account"]));
  failures.failPutKey = "shared:account";
  await assert.rejects(adapter.apply(target, journal), e => e.code === "storage-quota-exceeded");
  assert.deepStrictEqual(clone(await h.storage.readMany(Object.keys(before))), before, "both campaigns roll back on shared put failure");
  delete failures.failPutKey;
  h.setAlbumFailure(true);
  await assert.rejects(adapter.apply(target, journal));
  assert.equal((await h.storage.read("shared:account")).tokens, 27, "IDB commit is durable while journal covers Album retry");
  assert.equal(await adapter.equals(target), false);
  h.setAlbumFailure(false);
  await adapter.apply(target, journal);
  assert.equal(await adapter.verify(target, journal), true);
  assert.deepStrictEqual(clone((await h.storage.read("state")).squads), localSquads);
  assert.deepStrictEqual(clone((await h.storage.read("state")).coachOwnedIds), []);
  assert.deepStrictEqual(clone((await h.storage.read("state:rtg-ares-orion")).coachOwnedIds), []);
  assert.equal(h.localStorage.getItem("inazuma.rtg.squad-slots.v2.ie1"), slots);
  assert.equal((await h.storage.read("state")).gacha.recruitmentPullCount, 9);
  await adapter.apply(target, journal);
  assert.equal(await adapter.verify(target, journal), true, "retry is idempotent");
  const noCampaignInput = input(); noCampaignInput.trilogy = null;
  const noCampaign = projection.project(noCampaignInput);
  await adapter.apply(noCampaign, journal);
  assert.equal(await h.storage.read("state"), null);
  assert.deepStrictEqual(clone(await h.storage.read("local:squads:rtg-ie-trilogy")), localSquads, "unstarted cloud campaign preserves device squads locally");
  assert.equal(await adapter.verify(noCampaign, journal), true);
  const active = clone(source.aresOrion); active.activeMatch = { status: "active" };
  await h.storage.write(active, "state:rtg-ares-orion", options);
  await assert.rejects(adapter.preflight(target), e => e.code === "rtg-cloud-match-in-progress");
  await assert.rejects(adapter.apply(target, journal), e => e.code === "rtg-cloud-match-in-progress");
  assert.equal((await h.storage.read("state:rtg-ares-orion")).activeMatch.status, "active");
  const bad = clone(target); bad.shared.tokens = -1;
  await assert.rejects(adapter.apply(bad, journal));
  console.log("rtg-cloud-restore-adapter-test: PASS (atomic rollback, interrupted Album, retry, configurations, null, active match, integrity)");
})().catch(error => { console.error(error); process.exitCode = 1; });
