"use strict";
const assert = require("assert");
const projection = require("../js/road-to-glory/rtg-cloud-snapshot.js");
const adapter = require("../js/road-to-glory/rtg-cloud-local-adapter.js");
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
function campaign(id, season) {
  return {
    schemaVersion: 3, campaignId: id, campaignSeed: "seed-" + id,
    activeSeasonId: season, seasonComplete: false,
    seasonTransitionRewardedIds: [], projects: { Buono: 0 },
    coachPullCount: 2, lives: 2, checkpointMainIndex: 0,
    currentNodeId: "main:occult", furthestNodeIndex: 2,
    defeatedTeamIds: ["team-1"], firstClearMatchIds: ["match-1"],
    attemptsByNode: {}, gacha: { pullCount: 4 },
    coachOwnedIds: id === "rtg-ie-trilogy" ? ["36"] : ["4401"],
    developmentByCardId: {
      "ie2::hero": {
        targetPotential: id === "rtg-ie-trilogy" ? 90 : 70,
        currentRarity: id === "rtg-ie-trilogy" ? "Mondiale" : "Elite",
        evolutionCount: 2, updatedAt: "2026-10-20T00:00:00.000Z"
      }
    },
    activeMatch: null, squads: { [season]: { formationId: "4-4-2", coachId: "36" } }
  };
}
function harness(records, albumValue) {
  const data = clone(records);
  let reads = 0, writes = 0, albumReads = 0, album = albumValue;
  const storage = {
    async readMany(keys) {
      reads++;
      return Object.fromEntries(keys.map(key => [key, clone(data[key])]));
    },
    async write() { writes++; throw new Error("No RTG cloud writes on snapshot read"); },
  };
  const localStorage = {
    getItem(key) {
      assert.strictEqual(key, adapter.ALBUM_KEY);
      albumReads++;
      return album;
    },
    setItem() { writes++; throw new Error("No album writes on snapshot read"); },
  };
  return {
    instance: adapter.create({ storage, localStorage, projector: projection }),
    data, setAlbum: value => { album = value; },
    stats: () => ({ reads, writes, albumReads }),
  };
}
const records = {
  state: campaign("rtg-ie-trilogy", "ie1_s3"),
  "state:rtg-ares-orion": campaign("rtg-ares-orion", "orion"),
  "shared:account": { tokens: 1800, gachaAcquiredCards: [{cardId:"ie1::hero"}] },
};
(async () => {
  const original = clone(records);
  const h = harness(records, JSON.stringify({ version: 1, cardIds: ["old-card", "ie1::hero"] }));
  const result = await h.instance.captureStable();
  assert.strictEqual(result.status, "ready");
  assert.strictEqual(result.snapshot.schemaVersion, 1);
  assert.strictEqual(result.snapshot.shared.tokens, 1800);
  assert.strictEqual(result.snapshot.shared.developmentByCardId["ie2::hero"].currentRarity, "Mondiale");
  assert.deepStrictEqual(result.snapshot.shared.coachOwnedIds, ["36", "4401"]);
  assert.deepStrictEqual(result.snapshot.album.cardIds, ["old-card", "ie1::hero"]);
  assert.strictEqual(result.snapshot.campaigns["rtg-ie-trilogy"].activeSeasonId, "ie1_s3");
  assert.strictEqual(result.snapshot.campaigns["rtg-ares-orion"].activeSeasonId, "orion");
  assert.ok(!("squads" in result.snapshot.campaigns["rtg-ie-trilogy"]));
  assert.deepStrictEqual(h.data, original, "No legacy state modifications");
  assert.deepStrictEqual(h.stats(), { reads: 2, writes: 0, albumReads: 2 });

  const started = harness({ ...records, state: { ...records.state, activeMatch: { status: "active" } } }, null);
  const deferred = await started.instance.captureStable();
  assert.deepStrictEqual(deferred, { status: "deferred", reason: "rtg-cloud-match-in-progress" });
  assert.deepStrictEqual(started.stats(), { reads: 1, writes: 0, albumReads: 1 });
  const otherStarted = harness({ ...records,
    "state:rtg-ares-orion": { ...records["state:rtg-ares-orion"], activeMatch: { status: "completed" } }
  }, null);
  assert.strictEqual((await otherStarted.instance.captureStable()).status, "deferred");

  const noAlbum = harness(records, null);
  assert.deepStrictEqual((await noAlbum.instance.captureStable()).snapshot.album, { version: 1, cardIds: [] });
  const corruptAlbum = harness(records, "{bad json");
  await assert.rejects(corruptAlbum.instance.captureStable(),
    e => e.code === "rtg-cloud-album-corrupt");
  const malformedAlbum = harness(records, JSON.stringify({ version: 2, cardIds: [] }));
  await assert.rejects(malformedAlbum.instance.captureStable(),
    e => e.code === "rtg-cloud-album-corrupt");
  const missingShared = harness({ state: records.state, "state:rtg-ares-orion": records["state:rtg-ares-orion"] },
    JSON.stringify({ version: 1, cardIds: [] }));
  const migrated = await missingShared.instance.captureStable();
  assert.strictEqual(migrated.snapshot.shared.developmentByCardId["ie2::hero"].currentRarity, "Mondiale");
  assert.deepStrictEqual(missingShared.stats(), { reads: 2, writes: 0, albumReads: 2 });

  let flip = 0;
  const unstable = adapter.create({
    storage: { async readMany(keys) {
      flip++;
      return Object.fromEntries(keys.map(key => [key, clone(key === "shared:account"
        ? { ...records[key], tokens: 1800 + flip } : records[key])]));
    } },
    localStorage: { getItem: () => null }, projector: projection,
  });
  await assert.rejects(unstable.captureStable(2),
    e => e.code === "rtg-cloud-local-snapshot-unstable");

  const invalid = harness({ ...records, "shared:account": { tokens: -1, gachaAcquiredCards: [] } }, null);
  await assert.rejects(invalid.instance.captureStable(),
    e => e.code === "rtg-cloud-invalid-shared");
  const empty = harness({}, null);
  const emptySnap = await empty.instance.captureStable();
  assert.strictEqual(emptySnap.snapshot.shared, null);
  assert.deepStrictEqual(emptySnap.snapshot.album.cardIds, []);

  console.log("rtg-cloud-local-adapter-test: PASS (legacy, album, deferred active match, read-only, stable)");
})().catch(error => { console.error(error); process.exitCode = 1; });
