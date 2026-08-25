'use strict';
const assert = require('assert');
const crypto = require('crypto').webcrypto;
const core = require('../js/cloud-save-core.js');

(async () => {
  const calls = [];
  const apis = {
    RunState: { loadProfile: () => (calls.push('profile'), { team: 'Raimon' }), load: (id, options) => (calls.push(`run:${id}:${options?.readOnly}`), id === 'ie1' ? { seasonId: id } : null) },
    AlbumProgress: { read: () => (calls.push('album'), { unlocked: { ie1: [2, 1] }, ignored: undefined }) },
    DevelopmentV2: { read: () => (calls.push('development'), { schemaVersion: 5, coins: 12 }) },
    HallOfFameStorage: { ARCHIVE_SCHEMA_VERSION: 2, _loadArchive: () => (calls.push('hall'), { schemaVersion: 2, updatedAt: 'now', teams: [{ hallTeamId: 'hall_1', archiveKey: 'run::1', fullRoster: [] }], index: [{ hallTeamId: 'hall_1', teamName: 'Raimon' }] }) },
  };
  const snapshot = core.readLocalSnapshot(apis);
  assert.deepStrictEqual(calls, ['hall', 'profile', 'run:ie1:true', 'run:ie2:true', 'run:ie1_s2:true', 'run:ie1_s3:true', 'run:orion:true', 'album', 'development']);
  assert.strictEqual(snapshot.runs.ie1.seasonId, 'ie1'); assert.strictEqual(snapshot.runs.ie2, null); assert.strictEqual(snapshot.runs.ie1_s2, null); assert.strictEqual(snapshot.runs.ie1_s3, null); assert.strictEqual(snapshot.runs.orion, null);
  assert.strictEqual(snapshot.development.schemaVersion, 5); assert.strictEqual(snapshot.hallOfFame.teams.length, 1);
  assert.ok(!core.stableSerialize(snapshot).includes('backup')); assert.ok(!('ignored' in snapshot.album));

  const original = { z: 1, a: { d: undefined, b: 2 }, list: [3, undefined, 1] };
  assert.strictEqual(core.stableSerialize(original), '{"a":{"b":2},"list":[3,null,1],"z":1}');
  assert.strictEqual(original.a.d, undefined); assert.strictEqual(original.list[1], undefined);
  const hashA = await core.hash(original, crypto); const hashAgain = await core.hash({ list: [3, undefined, 1], a: { b: 2 }, z: 1 }, crypto);
  assert.strictEqual(hashA, hashAgain); assert.notStrictEqual(hashA, await core.hash({ z: 2 }, crypto));

  const codecCases = [
    ['a', 'b'],
    [['a', 'b'], ['c', 'd']],
    [[[['deep']]]],
    [{ team: 'Raimon', players: ['Mark', 'Axel'] }],
    { edges: [['a', 'b'], ['b', 'c']], map: { layers: [[1], [2]] } },
    { __inazumaCloudArrayV1: ['game-value'], __inazumaCloudEscapedObjectV1: { preserved: true } },
  ];
  function assertFirestoreSafe(value, parentIsArray = false) {
    if (Array.isArray(value)) { if (parentIsArray) assert.fail('encoded output contains a direct nested array'); value.forEach((item) => assertFirestoreSafe(item, true)); }
    else if (value && typeof value === 'object') Object.values(value).forEach((item) => assertFirestoreSafe(item, false));
  }
  for (const value of codecCases) {
    const before = JSON.stringify(value), encoded = core.encodeFirestorePayload(value);
    assertFirestoreSafe(encoded); assert.deepStrictEqual(core.decodeFirestorePayload(encoded), value); assert.strictEqual(JSON.stringify(value), before, 'codec does not mutate input');
  }
  const realRun = { currentZone: { edges: [['a', 'b'], ['b', 'c']] } };
  const encodedRun = core.encodeFirestorePayload(realRun);
  assertFirestoreSafe(encodedRun); assert.deepStrictEqual(core.decodeFirestorePayload(encodedRun), realRun);
  assert.strictEqual(await core.hash(core.decodeFirestorePayload(encodedRun), crypto), await core.hash(realRun, crypto), 'hash remains logical');

  const prepared = await core.prepareSnapshot(snapshot, crypto); core.preflight(prepared);
  assert.strictEqual(prepared.payloads.run_ie2, null); assert.strictEqual(prepared.payloads.hall_index.count, 1);
  assert.ok(!('fullRoster' in prepared.payloads.hall_index)); assert.strictEqual(prepared.hallEntries[0].hallTeamId, 'hall_1');
  const manifest = core.buildManifest(prepared, 'uid-1', 'device-1', 'timestamp');
  assert.strictEqual(manifest.schemaVersion, 1); assert.strictEqual(manifest.revision, 1);
  assert.strictEqual(manifest.sectors.run_ie1, true); assert.strictEqual(manifest.sectors.run_ie2, false); assert.strictEqual(manifest.sectors.hallOfFameCount, 1);
  assert.strictEqual(manifest.sectors.run_ie1_s2, false); assert.strictEqual(manifest.sectorHashes.run_ie1_s2, null); assert.strictEqual(manifest.sectors.run_ie1_s3, false); assert.strictEqual(manifest.sectorHashes.run_ie1_s3, null);
  assert.strictEqual(manifest.sectorHashes.run_ie2, null); assert.strictEqual(manifest.sectorHashes.album, prepared.hashes.album);

  const oversized = await core.prepareSnapshot({ ...snapshot, album: { data: 'x'.repeat(core.DOCUMENT_LIMIT_BYTES) } }, crypto);
  assert.throws(() => core.preflight(oversized), (error) => error.code === 'document-too-large' && error.problemSector === 'album');
  const hugeHall = await core.prepareSnapshot({ ...snapshot, hallOfFame: { ...snapshot.hallOfFame, teams: [{ hallTeamId: 'huge', archiveKey: 'huge', data: 'x'.repeat(core.DOCUMENT_LIMIT_BYTES) }] } }, crypto);
  assert.throws(() => core.preflight(hugeHall), (error) => error.code === 'document-too-large' && error.problemSector === 'hallOfFame/huge');
  const inflated = await core.prepareSnapshot({ ...snapshot, album: { nested: Array.from({ length: 30000 }, () => ['a', 'b']) } }, crypto);
  assert.ok(core.byteSize(inflated.payloads.album) < core.DOCUMENT_LIMIT_BYTES, 'logical payload remains below the limit');
  assert.throws(() => core.preflight(inflated), (error) => error.code === 'document-too-large' && error.problemSector === 'album', 'encoded document inflation is measured');

  const empty = { profile: { teamIdentity: null }, runs: { ie1: null, ie2: null }, album: { schemaVersion: 1, collections: { ie1: { unlockedPlayerIds: {} } } }, development: { schemaVersion: 5, coins: 0, cups: 0, projects: { Buono: 0 }, projectBuild: { Buono: 0 }, players: {}, evolutionHistory: [], redeemedRunIds: [], victoryRewardRunIds: [], projectPullLedger: {} }, hallOfFame: { archiveSchemaVersion: 2, teams: [], index: [] } };
  const frozen = JSON.stringify(empty); const inspected = core.inspectLocalProgress(empty);
  assert.strictEqual(inspected.empty, true); assert.strictEqual(inspected.meaningful, false); assert.deepStrictEqual(inspected.reasons, []); assert.strictEqual(JSON.stringify(empty), frozen, 'inspection does not mutate');
  for (const [reason, change] of [
    ['profile', { profile: { teamIdentity: { name: 'Raimon' } } }],
    ['run_ie1', { runs: { ie1: { runId: 'one' }, ie2: null } }],
    ['run_ie2', { runs: { ie1: null, ie2: { runId: 'two' } } }],
    ['run_ie1_s2', { runs: { ie1: null, ie2: null, ie1_s2: { runId: 'season-two' } } }],
    ['album', { album: { collections: { ie1: { unlockedPlayerIds: { 1: {} } } } } }],
    ['development', { development: { coins: 1 } }],
    ['hall_of_fame', { hallOfFame: { teams: [{ hallTeamId: 'h' }] } }],
  ]) { const candidate = { ...empty, ...change }; const result = core.inspectLocalProgress(candidate); assert.strictEqual(result.meaningful, true); assert.ok(result.reasons.includes(reason)); }

  const validManifest = core.buildManifest(prepared, 'uid-1', 'device-1', 'timestamp');
  assert.strictEqual(core.validateManifest(validManifest, 'uid-1').revision, 1);
  const legacyManifest = JSON.parse(JSON.stringify(validManifest)); delete legacyManifest.sectors.run_ie1_s2; delete legacyManifest.sectorHashes.run_ie1_s2; delete legacyManifest.sectorRevisions.run_ie1_s2;
  assert.strictEqual(core.validateManifest(legacyManifest, 'uid-1').sectors.run_ie1_s2, false);
  assert.throws(() => core.validateManifest({ ...validManifest, accountUid: 'other' }, 'uid-1'), /invalid-manifest/);
  assert.throws(() => core.validateManifest({ ...validManifest, schemaVersion: 2 }, 'uid-1'), /unsupported-cloud-schema/);
  assert.throws(() => core.validateManifest({ ...validManifest, revision: 0 }, 'uid-1'), /invalid-manifest/);
  assert.throws(() => core.validateManifest({ ...validManifest, sectorHashes: { ...validManifest.sectorHashes, album: null } }, 'uid-1'), /invalid-manifest/);
  const sector = { schemaVersion: 1, revision: 1, sector: 'album', payload: prepared.payloads.album, payloadHash: prepared.hashes.album, sourceDeviceId: 'device-1' };
  assert.deepStrictEqual(await core.validateSectorDocument('album', sector, validManifest, crypto), prepared.payloads.album);
  const encodedSector = { ...sector, payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(prepared.payloads.album) };
  assert.deepStrictEqual(await core.validateSectorDocument('album', encodedSector, validManifest, crypto), prepared.payloads.album);
  await assert.rejects(() => core.validateSectorDocument('album', { ...encodedSector, payloadEncoding: 'future-v2' }, validManifest, crypto), (error) => error.code === 'unsupported-payload-encoding' && error.problemSector === 'album');
  await assert.rejects(() => core.validateSectorDocument('album', { ...sector, payloadHash: '0'.repeat(64) }, validManifest, crypto), /hash-mismatch/);
  const absentRun = { schemaVersion: 1, revision: 1, sector: 'run_ie2', payload: null, payloadHash: null };
  assert.strictEqual(await core.validateSectorDocument('run_ie2', absentRun, validManifest, crypto), null);
  const legacyNullHash = await core.hash(null, crypto);
  assert.strictEqual(await core.validateSectorDocument('run_ie2', { ...absentRun, payloadHash: legacyNullHash }, validManifest, crypto), null);
  await assert.rejects(
    () => core.validateSectorDocument('run_ie2', { ...absentRun, payloadHash: '0'.repeat(64) }, validManifest, crypto),
    (error) => error.code === 'hash-mismatch' && error.problemSector === 'run_ie2',
  );
  await assert.rejects(
    () => core.validateSectorDocument('run_ie2', { ...absentRun, payloadHash: 'not-a-sha256' }, validManifest, crypto),
    (error) => error.code === 'invalid-sector' && error.problemSector === 'run_ie2',
  );
  await assert.rejects(
    () => core.validateSectorDocument('run_ie2', { ...absentRun, payload: {} }, validManifest, crypto),
    (error) => error.code === 'invalid-sector' && error.problemSector === 'run_ie2',
  );
  await assert.rejects(
    () => core.validateSectorDocument('run_ie1', { schemaVersion: 1, revision: 1, sector: 'run_ie1', payload: prepared.payloads.run_ie1, payloadHash: null }, validManifest, crypto),
    (error) => error.code === 'invalid-sector' && error.problemSector === 'run_ie1',
  );
  await assert.rejects(
    () => core.validateSectorDocument('album', { ...sector, payloadHash: null }, validManifest, crypto),
    (error) => error.code === 'invalid-sector' && error.problemSector === 'album',
  );
  const hallPayload = core.validateHallIndex(prepared.payloads.hall_index, validManifest);
  assert.deepStrictEqual(hallPayload.teamIds, ['hall_1']);
  assert.throws(() => core.validateHallIndex({ ...hallPayload, teamIds: ['hall_1', 'hall_1'], count: 2 }, { ...validManifest, sectors: { ...validManifest.sectors, hallOfFameCount: 2 } }), /invalid-hall-index/);
  const hallDoc = { schemaVersion: 1, revision: 1, hallTeamId: 'hall_1', archiveKey: prepared.hallEntries[0].archiveKey, payload: prepared.hallEntries[0].payload, payloadHash: prepared.hallEntries[0].payloadHash };
  assert.deepStrictEqual(await core.validateHallDocument('hall_1', hallDoc, validManifest, crypto), prepared.hallEntries[0].payload);
  const encodedHallDoc = { ...hallDoc, payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(hallDoc.payload) };
  assert.deepStrictEqual(await core.validateHallDocument('hall_1', encodedHallDoc, validManifest, crypto), prepared.hallEntries[0].payload);
  await assert.rejects(() => core.validateHallDocument('hall_1', { ...encodedHallDoc, payloadEncoding: 'future-v2' }, validManifest, crypto), (error) => error.code === 'unsupported-payload-encoding' && error.problemSector === 'hallOfFame/hall_1');
  const rebuilt = core.reconstructSnapshot(prepared.payloads, [prepared.hallEntries[0].payload]);
  assert.strictEqual(rebuilt.hallOfFame.teams[0].hallTeamId, 'hall_1');
  assert.deepStrictEqual(await core.compareSnapshots(snapshot, snapshot, crypto), { equivalent: true, mismatches: [] });
  const runMismatch = await core.compareSnapshots(snapshot, { ...snapshot, runs: { ...snapshot.runs, ie1: { seasonId: 'ie1', updatedAt: 'changed' } } }, crypto);
  assert.strictEqual(runMismatch.equivalent, false); assert.ok(runMismatch.mismatches.includes('run_ie1'));
  const albumMismatch = await core.compareSnapshots(snapshot, { ...snapshot, album: { changed: true } }, crypto);
  assert.ok(albumMismatch.mismatches.includes('album'));
  const hallMismatch = await core.compareSnapshots(snapshot, { ...snapshot, hallOfFame: { ...snapshot.hallOfFame, teams: [{ ...snapshot.hallOfFame.teams[0], result: 'changed' }] } }, crypto);
  assert.ok(hallMismatch.mismatches.includes('hallOfFame/hall_1'));
  console.log('cloud-save-core-test: ok');
})().catch((error) => { console.error(error); process.exit(1); });
