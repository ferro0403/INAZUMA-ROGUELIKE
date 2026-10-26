"use strict";
const assert = require("assert");
const projection = require("../js/road-to-glory/rtg-cloud-snapshot");
const core = require("../js/cloud-save-core");
const { input, account, clone } = require("./helpers/rtg-cloud-fixtures");
(async () => {
  const rtg = projection.project(input());
  const legacy = await core.prepareSnapshot(account());
  const prepared = await core.prepareSnapshot(account(rtg));
  assert.deepStrictEqual(prepared.snapshot.rtg, core.normalize(rtg), "RTG must survive the canonical cloud preparation");
  assert.deepStrictEqual(core.SECTOR_NAMES, ["profile", "album", "development", "hall_index"]);
  assert.deepStrictEqual(core.sectorNames(prepared), [...core.SECTOR_NAMES, "rtg"]);
  assert.deepStrictEqual(core.sectorNames(legacy), core.SECTOR_NAMES);
  assert.equal(prepared.hashes.rtg, await core.hash(rtg));
  const manifest = core.buildManifest(prepared, "u", "d", "now", { cloudCommitId: "c" });
  assert.equal(manifest.sectors.rtg, true);
  assert.equal(manifest.sectorHashes.rtg, prepared.hashes.rtg);
  assert.equal(manifest.sectorRevisions.rtg, 1);
  assert.deepStrictEqual(core.sectorNames(manifest), [...core.SECTOR_NAMES, "rtg"]);
  core.validateManifest(manifest, "u");
  for (const mutate of [m => delete m.sectorHashes.rtg, m => delete m.sectorRevisions.rtg, m => { m.sectors.rtg = false; }, m => { m.sectorRevisions.rtg = 2; }]) {
    const malformed = clone(manifest); mutate(malformed);
    assert.throws(() => core.validateManifest(malformed, "u"));
  }
  const reconstructed = core.reconstructSnapshot(prepared.payloads, []);
  assert.deepStrictEqual(reconstructed.rtg, prepared.snapshot.rtg);
  const changed = account(clone(rtg)); changed.rtg.shared.tokens += 1;
  assert.deepStrictEqual((await core.compareSnapshots(account(rtg), changed)).mismatches, ["rtg"]);
  assert.equal((await core.compareSnapshots(account(), account(rtg))).equivalent, false);
  assert.equal(core.inspectLocalProgress({ ...account(), profile: {}, rtg }).meaningful, true, "RTG-only account cannot be mistaken for empty");
  assert.throws(() => core.preflight(prepared, core.byteSize(prepared.payloads.rtg) - 1), e => e.code === "document-too-large");
  assert.throws(() => core.buildManifest(legacy, "u", "d", "now", { expectedManifest: manifest, revision: 2 }), e => e.code === "rtg-cloud-checkpoint-required");
  const bad = clone(rtg); bad.campaigns["rtg-ie-trilogy"].activeMatch = { status: "active" };
  await assert.rejects(core.prepareSnapshot(account(bad)));
  const doc = { schemaVersion: 1, sector: "rtg", revision: 1, payload: rtg, payloadHash: prepared.hashes.rtg };
  assert.deepStrictEqual(await core.validateSectorDocument("rtg", doc, manifest), core.normalize(rtg));
  await assert.rejects(core.validateSectorDocument("rtg", { ...doc, payload: { ...rtg, schemaVersion: 999 } }, manifest));
  console.log("rtg-cloud-core-sector-test: PASS (optional sector, legacy, hashes, integrity, conflict, no downgrade)");
})().catch(error => { console.error(error); process.exitCode = 1; });
