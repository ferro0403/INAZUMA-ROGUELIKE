'use strict';
const assert = require('assert');
const crypto = require('crypto').webcrypto;
const core = require('../js/cloud-save-core.js');

(async () => {
  const calls = [];
  const apis = {
    RunState: {
      loadProfile: () => (calls.push('profile'), { teamIdentity: { name: 'Raimon' } }),
      load: () => { throw new Error('cloud snapshot must never read a run'); },
    },
    RunStorage: { diagnostics: () => { throw new Error('cloud snapshot must never inspect run provenance'); } },
    AlbumProgress: { read: () => (calls.push('album'), { collections: {} }) },
    DevelopmentV2: { read: () => (calls.push('development'), { schemaVersion: 5, coins: 12 }) },
    HallOfFameStorage: { ARCHIVE_SCHEMA_VERSION: 2, _loadArchive: () => (calls.push('hall'), { schemaVersion: 2, updatedAt: 'now', teams: [{ hallTeamId: 'hall_1', archiveKey: 'account::1' }], index: [] }) },
  };
  const snapshot = core.readLocalSnapshot(apis);
  assert.deepStrictEqual(calls, ['hall', 'profile', 'album', 'development']);
  assert.ok(!Object.hasOwn(snapshot, 'runs'));
  assert.ok(!Object.hasOwn(snapshot, 'runProvenance'));
  assert.deepStrictEqual(core.SECTOR_NAMES, ['profile', 'album', 'development', 'hall_index']);

  const prepared = await core.prepareSnapshot({ ...snapshot, runs: { future_test_season: { secret: true } } }, crypto);
  assert.deepStrictEqual(Object.keys(prepared.payloads).sort(), [...core.SECTOR_NAMES].sort());
  assert.ok(!core.stableSerialize(prepared).includes('future_test_season'));
  core.preflight(prepared);

  const manifest = core.buildManifest(prepared, 'uid-1', 'device-1', 'timestamp');
  assert.deepStrictEqual(Object.keys(manifest.sectorHashes).sort(), [...core.SECTOR_NAMES].sort());
  assert.strictEqual(core.validateManifest(manifest, 'uid-1').revision, 1);

  const legacy = JSON.parse(JSON.stringify(manifest));
  Object.assign(legacy.sectors, { run_ie1: true, run_future: true });
  Object.assign(legacy.sectorHashes, { run_ie1: 'a'.repeat(64), run_future: 'b'.repeat(64) });
  Object.assign(legacy.sectorRevisions, { run_ie1: 1, run_future: 1 });
  legacy.runProvenance = { ie1: { runId: 'legacy' } };
  assert.strictEqual(core.validateManifest(legacy, 'uid-1').revision, 1, 'legacy run metadata is tolerated');
  const next = core.buildManifest(prepared, 'uid-1', 'device-1', 'later', { revision: 2, baseRevision: 1, cloudCommitId: 'c2', expectedManifest: legacy });
  assert.deepStrictEqual(next.runProvenance, legacy.runProvenance);
  assert.strictEqual(next.sectorHashes.run_ie1, legacy.sectorHashes.run_ie1, 'legacy run metadata is preserved, not rewritten');
  assert.strictEqual(next.sectorHashes.run_future, legacy.sectorHashes.run_future);

  const rebuilt = core.reconstructSnapshot(prepared.payloads, prepared.hallEntries);
  assert.ok(!Object.hasOwn(rebuilt, 'runs'));
  const runDifference = await core.compareSnapshots(snapshot, { ...snapshot, runs: { ie1: { different: true } } }, crypto);
  assert.deepStrictEqual(runDifference, { equivalent: true, mismatches: [] });
  const permanentDifference = await core.compareSnapshots(snapshot, { ...snapshot, development: { coins: 99 } }, crypto);
  assert.ok(permanentDifference.mismatches.includes('development'));
  console.log('cloud-save-core account-permanent domain: ok');
})().catch((error) => { console.error(error); process.exit(1); });
