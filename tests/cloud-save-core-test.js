'use strict';
const assert = require('assert');
const crypto = require('crypto').webcrypto;
const core = require('../js/cloud-save-core.js');

(async () => {
  const calls = [];
  const apis = {
    RunState: { loadProfile: () => (calls.push('profile'), { team: 'Raimon' }), load: (id) => (calls.push(`run:${id}`), id === 'ie1' ? { seasonId: id } : null) },
    AlbumProgress: { read: () => (calls.push('album'), { unlocked: { ie1: [2, 1] }, ignored: undefined }) },
    DevelopmentV2: { read: () => (calls.push('development'), { schemaVersion: 5, coins: 12 }) },
    HallOfFameStorage: { ARCHIVE_SCHEMA_VERSION: 2, _loadArchive: () => (calls.push('hall'), { schemaVersion: 2, updatedAt: 'now', teams: [{ hallTeamId: 'hall_1', archiveKey: 'run::1', fullRoster: [] }], index: [{ hallTeamId: 'hall_1', teamName: 'Raimon' }] }) },
  };
  const snapshot = core.readLocalSnapshot(apis);
  assert.deepStrictEqual(calls, ['hall', 'profile', 'run:ie1', 'run:ie2', 'album', 'development']);
  assert.strictEqual(snapshot.runs.ie1.seasonId, 'ie1'); assert.strictEqual(snapshot.runs.ie2, null);
  assert.strictEqual(snapshot.development.schemaVersion, 5); assert.strictEqual(snapshot.hallOfFame.teams.length, 1);
  assert.ok(!core.stableSerialize(snapshot).includes('backup')); assert.ok(!('ignored' in snapshot.album));

  const original = { z: 1, a: { d: undefined, b: 2 }, list: [3, undefined, 1] };
  assert.strictEqual(core.stableSerialize(original), '{"a":{"b":2},"list":[3,null,1],"z":1}');
  assert.strictEqual(original.a.d, undefined); assert.strictEqual(original.list[1], undefined);
  const hashA = await core.hash(original, crypto); const hashAgain = await core.hash({ list: [3, undefined, 1], a: { b: 2 }, z: 1 }, crypto);
  assert.strictEqual(hashA, hashAgain); assert.notStrictEqual(hashA, await core.hash({ z: 2 }, crypto));

  const prepared = await core.prepareSnapshot(snapshot, crypto); core.preflight(prepared);
  assert.strictEqual(prepared.payloads.run_ie2, null); assert.strictEqual(prepared.payloads.hall_index.count, 1);
  assert.ok(!('fullRoster' in prepared.payloads.hall_index)); assert.strictEqual(prepared.hallEntries[0].hallTeamId, 'hall_1');
  const manifest = core.buildManifest(prepared, 'uid-1', 'device-1', 'timestamp');
  assert.strictEqual(manifest.schemaVersion, 1); assert.strictEqual(manifest.revision, 1);
  assert.strictEqual(manifest.sectors.run_ie1, true); assert.strictEqual(manifest.sectors.run_ie2, false); assert.strictEqual(manifest.sectors.hallOfFameCount, 1);
  assert.strictEqual(manifest.sectorHashes.run_ie2, null); assert.strictEqual(manifest.sectorHashes.album, prepared.hashes.album);

  const oversized = await core.prepareSnapshot({ ...snapshot, album: { data: 'x'.repeat(core.DOCUMENT_LIMIT_BYTES) } }, crypto);
  assert.throws(() => core.preflight(oversized), (error) => error.code === 'document-too-large' && error.problemSector === 'album');
  const hugeHall = await core.prepareSnapshot({ ...snapshot, hallOfFame: { ...snapshot.hallOfFame, teams: [{ hallTeamId: 'huge', archiveKey: 'huge', data: 'x'.repeat(core.DOCUMENT_LIMIT_BYTES) }] } }, crypto);
  assert.throws(() => core.preflight(hugeHall), (error) => error.code === 'document-too-large' && error.problemSector === 'hallOfFame/huge');

  const empty = { profile: { teamIdentity: null }, runs: { ie1: null, ie2: null }, album: { schemaVersion: 1, collections: { ie1: { unlockedPlayerIds: {} } } }, development: { schemaVersion: 5, coins: 0, cups: 0, projects: { Buono: 0 }, projectBuild: { Buono: 0 }, players: {}, evolutionHistory: [], redeemedRunIds: [], victoryRewardRunIds: [], projectPullLedger: {} }, hallOfFame: { archiveSchemaVersion: 2, teams: [], index: [] } };
  const frozen = JSON.stringify(empty); const inspected = core.inspectLocalProgress(empty);
  assert.strictEqual(inspected.empty, true); assert.strictEqual(inspected.meaningful, false); assert.deepStrictEqual(inspected.reasons, []); assert.strictEqual(JSON.stringify(empty), frozen, 'inspection does not mutate');
  for (const [reason, change] of [
    ['profile', { profile: { teamIdentity: { name: 'Raimon' } } }],
    ['run_ie1', { runs: { ie1: { runId: 'one' }, ie2: null } }],
    ['run_ie2', { runs: { ie1: null, ie2: { runId: 'two' } } }],
    ['album', { album: { collections: { ie1: { unlockedPlayerIds: { 1: {} } } } } }],
    ['development', { development: { coins: 1 } }],
    ['hall_of_fame', { hallOfFame: { teams: [{ hallTeamId: 'h' }] } }],
  ]) { const candidate = { ...empty, ...change }; const result = core.inspectLocalProgress(candidate); assert.strictEqual(result.meaningful, true); assert.ok(result.reasons.includes(reason)); }

  const validManifest = core.buildManifest(prepared, 'uid-1', 'device-1', 'timestamp');
  assert.strictEqual(core.validateManifest(validManifest, 'uid-1').revision, 1);
  assert.throws(() => core.validateManifest({ ...validManifest, accountUid: 'other' }, 'uid-1'), /invalid-manifest/);
  assert.throws(() => core.validateManifest({ ...validManifest, schemaVersion: 2 }, 'uid-1'), /unsupported-cloud-schema/);
  assert.throws(() => core.validateManifest({ ...validManifest, revision: 0 }, 'uid-1'), /invalid-manifest/);
  assert.throws(() => core.validateManifest({ ...validManifest, sectorHashes: { ...validManifest.sectorHashes, album: null } }, 'uid-1'), /invalid-manifest/);
  const sector = { schemaVersion: 1, revision: 1, sector: 'album', payload: prepared.payloads.album, payloadHash: prepared.hashes.album, sourceDeviceId: 'device-1' };
  assert.deepStrictEqual(await core.validateSectorDocument('album', sector, validManifest, crypto), prepared.payloads.album);
  await assert.rejects(() => core.validateSectorDocument('album', { ...sector, payloadHash: '0'.repeat(64) }, validManifest, crypto), /hash-mismatch/);
  const absentRun = { schemaVersion: 1, revision: 1, sector: 'run_ie2', payload: null, payloadHash: null };
  assert.strictEqual(await core.validateSectorDocument('run_ie2', absentRun, validManifest, crypto), null);
  await assert.rejects(() => core.validateSectorDocument('run_ie2', { ...absentRun, payload: {} }, validManifest, crypto), /invalid-sector/);
  const hallPayload = core.validateHallIndex(prepared.payloads.hall_index, validManifest);
  assert.deepStrictEqual(hallPayload.teamIds, ['hall_1']);
  assert.throws(() => core.validateHallIndex({ ...hallPayload, teamIds: ['hall_1', 'hall_1'], count: 2 }, { ...validManifest, sectors: { ...validManifest.sectors, hallOfFameCount: 2 } }), /invalid-hall-index/);
  const hallDoc = { schemaVersion: 1, revision: 1, hallTeamId: 'hall_1', archiveKey: prepared.hallEntries[0].archiveKey, payload: prepared.hallEntries[0].payload, payloadHash: prepared.hallEntries[0].payloadHash };
  assert.deepStrictEqual(await core.validateHallDocument('hall_1', hallDoc, validManifest, crypto), prepared.hallEntries[0].payload);
  const rebuilt = core.reconstructSnapshot(prepared.payloads, [prepared.hallEntries[0].payload]);
  assert.strictEqual(rebuilt.hallOfFame.teams[0].hallTeamId, 'hall_1');
  console.log('cloud-save-core-test: ok');
})().catch((error) => { console.error(error); process.exit(1); });
