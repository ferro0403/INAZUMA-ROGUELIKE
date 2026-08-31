'use strict';
const assert = require('assert');
const crypto = require('crypto').webcrypto;
const core = require('../js/cloud-save-core.js');

(async () => {
  const calls = [];
  const apis = {
    RunState: { loadProfile: () => (calls.push('profile'), { teamIdentity: { name: 'Raimon' } }), load: () => { throw new Error('cloud snapshot must never read a run'); } },
    RunStorage: { diagnostics: () => { throw new Error('cloud snapshot must never inspect run provenance'); } },
    AlbumProgress: { read: () => (calls.push('album'), { collections: { ie1: { unlockedPlayerIds: { p1: true } } } }) },
    DevelopmentV2: { read: () => (calls.push('development'), { schemaVersion: 5, coins: 12 }) },
    HallOfFameStorage: { ARCHIVE_SCHEMA_VERSION: 2, _loadArchive: () => (calls.push('hall'), { schemaVersion: 2, updatedAt: 'now', teams: [{ hallTeamId: 'hall_1', archiveKey: 'account::1', roster: [['p1'], ['p2']] }], index: [{ hallTeamId: 'hall_1' }] }) },
  };
  const snapshot = core.readLocalSnapshot(apis);
  assert.deepStrictEqual(calls, ['hall', 'profile', 'album', 'development']);
  assert.ok(!Object.hasOwn(snapshot, 'runs')); assert.ok(!Object.hasOwn(snapshot, 'runProvenance'));
  assert.deepStrictEqual(core.SECTOR_NAMES, ['profile', 'album', 'development', 'hall_index']);

  const deterministic = { z: 1, a: { omitted: undefined, b: 2 }, nested: [[1, 2], [{ x: 3 }]], sparse: [undefined] };
  const frozen = JSON.stringify(deterministic);
  assert.equal(core.stableSerialize(deterministic), core.stableSerialize({ sparse: [null], nested: [[1, 2], [{ x: 3 }]], a: { b: 2 }, z: 1 }));
  assert.equal(JSON.stringify(deterministic), frozen, 'serialization does not mutate input');
  assert.equal(await core.hash(deterministic, crypto), await core.hash({ a: { b: 2 }, nested: [[1, 2], [{ x: 3 }]], sparse: [null], z: 1 }, crypto));
  assert.notEqual(await core.hash(deterministic, crypto), await core.hash({ z: 2 }, crypto));

  const codecCases = [['a'], [['a', 'b'], ['c']], [[[['deep']]]], [{ players: ['p1', 'p2'] }], { __inazumaCloudArrayV1: ['game'], nested: [[1]] }];
  function assertFirestoreSafe(value, parentArray = false) {
    if (Array.isArray(value)) { assert.equal(parentArray, false, 'Firestore payload has no directly nested arrays'); value.forEach(item => assertFirestoreSafe(item, true)); }
    else if (value && typeof value === 'object') Object.values(value).forEach(item => assertFirestoreSafe(item, false));
  }
  for (const value of codecCases) { const before = JSON.stringify(value), encoded = core.encodeFirestorePayload(value); assertFirestoreSafe(encoded); assert.deepStrictEqual(core.decodeFirestorePayload(encoded), value); assert.equal(JSON.stringify(value), before); }

  const prepared = await core.prepareSnapshot({ ...snapshot, runs: { future_test_season: { secret: true } } }, crypto);
  assert.deepStrictEqual(Object.keys(prepared.payloads).sort(), [...core.SECTOR_NAMES].sort());
  assert.ok(!core.stableSerialize(prepared).includes('future_test_season')); core.preflight(prepared);
  const oversized = await core.prepareSnapshot({ ...snapshot, album: { data: 'x'.repeat(core.DOCUMENT_LIMIT_BYTES) } }, crypto);
  assert.throws(() => core.preflight(oversized), error => error.code === 'document-too-large' && error.problemSector === 'album');
  const inflated = await core.prepareSnapshot({ ...snapshot, album: { nested: Array.from({ length: 30000 }, () => ['a', 'b']) } }, crypto);
  assert.ok(core.byteSize(inflated.payloads.album) < core.DOCUMENT_LIMIT_BYTES);
  assert.throws(() => core.preflight(inflated), error => error.code === 'document-too-large' && error.problemSector === 'album');

  const manifest = core.buildManifest(prepared, 'uid-1', 'device-1', 'timestamp');
  assert.deepStrictEqual(Object.keys(manifest.sectorHashes).sort(), [...core.SECTOR_NAMES].sort()); assert.equal(core.validateManifest(manifest, 'uid-1').revision, 1);
  assert.throws(() => core.validateManifest({ ...manifest, accountUid: 'other' }, 'uid-1'), /invalid-manifest/);
  assert.throws(() => core.validateManifest({ ...manifest, schemaVersion: 2 }, 'uid-1'), /unsupported-cloud-schema/);
  assert.throws(() => core.validateManifest({ ...manifest, revision: 0 }, 'uid-1'), /invalid-manifest/);
  assert.throws(() => core.validateManifest({ ...manifest, sectorHashes: { ...manifest.sectorHashes, album: null } }, 'uid-1'), /invalid-manifest/);

  const albumDoc = { schemaVersion: 1, revision: 1, sector: 'album', payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(prepared.payloads.album), payloadHash: prepared.hashes.album, sourceDeviceId: 'device-1' };
  assert.deepStrictEqual(await core.validateSectorDocument('album', albumDoc, manifest, crypto), prepared.payloads.album);
  await assert.rejects(() => core.validateSectorDocument('album', { ...albumDoc, payloadEncoding: 'future-v2' }, manifest, crypto), error => error.code === 'unsupported-payload-encoding');
  await assert.rejects(() => core.validateSectorDocument('album', { ...albumDoc, payloadHash: '0'.repeat(64) }, manifest, crypto), error => error.code === 'hash-mismatch');

  const hallIndex = core.validateHallIndex(prepared.payloads.hall_index, manifest); assert.deepStrictEqual(hallIndex.teamIds, ['hall_1']);
  assert.throws(() => core.validateHallIndex({ ...hallIndex, teamIds: ['hall_1', 'hall_1'], count: 2 }, { ...manifest, sectors: { ...manifest.sectors, hallOfFameCount: 2 } }), /invalid-hall-index/);
  const hallEntry = prepared.hallEntries[0], hallDoc = { schemaVersion: 1, revision: 1, hallTeamId: hallEntry.hallTeamId, archiveKey: hallEntry.archiveKey, payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(hallEntry.payload), payloadHash: hallEntry.payloadHash };
  assert.deepStrictEqual(await core.validateHallDocument('hall_1', hallDoc, manifest, crypto), hallEntry);
  await assert.rejects(() => core.validateHallDocument('hall_1', { ...hallDoc, payloadEncoding: 'future-v2' }, manifest, crypto), error => error.code === 'unsupported-payload-encoding');
  await assert.rejects(() => core.validateHallDocument('hall_1', { ...hallDoc, payloadHash: '0'.repeat(64) }, manifest, crypto), error => error.code === 'hash-mismatch');

  const legacy = JSON.parse(JSON.stringify(manifest)); Object.assign(legacy.sectors, { run_ie1: true, run_future: true }); Object.assign(legacy.sectorHashes, { run_ie1: 'a'.repeat(64), run_future: 'b'.repeat(64) }); Object.assign(legacy.sectorRevisions, { run_ie1: 1, run_future: 1 }); legacy.runProvenance = { ie1: { runId: 'legacy' } };
  assert.equal(core.validateManifest(legacy, 'uid-1').revision, 1);
  const next = core.buildManifest(prepared, 'uid-1', 'device-1', 'later', { revision: 2, baseRevision: 1, cloudCommitId: 'c2', expectedManifest: legacy });
  assert.deepStrictEqual(next.runProvenance, legacy.runProvenance); assert.equal(next.sectorHashes.run_ie1, legacy.sectorHashes.run_ie1); assert.equal(next.sectorHashes.run_future, legacy.sectorHashes.run_future); assert.equal(next.sectorRevisions.run_ie1, 1); assert.equal(next.sectorRevisions.run_future, 1);

  const rebuilt = core.reconstructSnapshot(prepared.payloads, prepared.hallEntries); assert.ok(!Object.hasOwn(rebuilt, 'runs'));
  assert.deepStrictEqual(await core.compareSnapshots(snapshot, { ...snapshot, runs: { ie1: { changed: true } } }, crypto), { equivalent: true, mismatches: [] });
  for (const [sector, changed] of [['profile', { teamIdentity: { name: 'Royal' } }], ['album', { collections: {} }], ['development', { coins: 99 }]]) { const result = await core.compareSnapshots(snapshot, { ...snapshot, [sector]: changed }, crypto); assert.ok(result.mismatches.includes(sector)); }
  const hallResult = await core.compareSnapshots(snapshot, { ...snapshot, hallOfFame: { ...snapshot.hallOfFame, teams: [{ ...snapshot.hallOfFame.teams[0], result: 'changed' }] } }, crypto); assert.ok(hallResult.mismatches.includes('hallOfFame/hall_1'));
  console.log('cloud-save-core permanent-account safety and local-only run contract: ok');
})().catch(error => { console.error(error); process.exit(1); });
