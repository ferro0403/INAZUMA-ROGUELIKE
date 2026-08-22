'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto').webcrypto;
const core = require('../js/cloud-save-core.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
const sandbox = { console, crypto, TextEncoder, Date, Math, JSON, setTimeout, clearTimeout, localStorage: new MemoryStorage(), dispatchEvent() {}, addEventListener() {}, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } } };
sandbox.globalThis = sandbox; vm.createContext(sandbox);
for (const file of ['season1-config.js', 'season-registry.js', 'run-state.js', 'album-progress.js', 'development-v2.js', 'hall-of-fame.js']) vm.runInContext(fs.readFileSync(`js/${file}`, 'utf8'), sandbox, { filename: file });

function apply(snapshot) {
  const options = { suppressCloudEvent: true };
  sandbox.RunState.restoreProfile(snapshot.profile, options);
  for (const [seasonId, run] of Object.entries(snapshot.runs)) { if (run === null) sandbox.RunState.forceDeleteForRestore(seasonId, options); else sandbox.RunState.forceReplaceCanonicalFromSnapshot(core.clone(run), { preserveTimestamps: true, ...options }); }
  sandbox.AlbumProgress.write(core.clone(snapshot.album), options);
  sandbox.DevelopmentV2.write(core.clone(snapshot.development), options);
  sandbox.HallOfFameStorage._saveArchive({ schemaVersion: snapshot.hallOfFame.archiveSchemaVersion, updatedAt: snapshot.hallOfFame.updatedAt, teams: core.clone(snapshot.hallOfFame.teams), index: core.clone(snapshot.hallOfFame.index) }, { preserveTimestamp: true, ...options });
}
function localSnapshot() { return core.readLocalSnapshot(sandbox); }
function sectorDocument(name, prepared, revision = 1) { const absent = (name === 'run_ie1' || name === 'run_ie2') && prepared.payloads[name] === null; return { schemaVersion: 1, revision, sector: name, payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(prepared.payloads[name]), payloadHash: absent ? null : prepared.hashes[name], sourceDeviceId: 'test-device' }; }
function hallDocument(entry, revision = 1) { return { schemaVersion: 1, revision, hallTeamId: entry.hallTeamId, archiveKey: entry.archiveKey, payloadEncoding: core.PAYLOAD_ENCODING, payload: core.encodeFirestorePayload(entry.payload), payloadHash: entry.payloadHash, sourceDeviceId: 'test-device' }; }

(async () => {
  sandbox.RunState.restoreProfile({ teamIdentity: { name: 'Raimon', logo: 'ignored' } }, { suppressCloudEvent: true });
  const runA = sandbox.RunState.createRun({ name: 'Raimon' }, 'ie1'); Object.assign(runA, { bossIndex: 4, teamLevel: 12, coins: 900, currentZone: { currentNodeId: 'n3', edges: [['n1', 'n2'], ['n2', 'n3']] } }); sandbox.RunState.save(runA, { preserveTimestamps: true, suppressCloudEvent: true });
  sandbox.AlbumProgress.write({ schemaVersion: 1, collections: { ie1: { unlockedPlayerIds: { mark: true, axel: true } } } }, { suppressCloudEvent: true });
  sandbox.DevelopmentV2.write({ schemaVersion: 2, coins: 700, cups: 3, projects: { Buono: 2 }, players: { mark: { level: 4 } } }, { suppressCloudEvent: true });
  sandbox.HallOfFameStorage._saveArchive({ schemaVersion: sandbox.HallOfFameStorage.ARCHIVE_SCHEMA_VERSION, updatedAt: '2026-08-01T00:00:00.000Z', teams: [{ hallTeamId: 'hall-a', archiveKey: 'ie1::run-a', runId: 'run-a', teamName: 'Raimon', finalStartingEleven: [{ id: 'mark' }], fullRoster: [{ id: 'mark' }] }], index: [{ hallTeamId: 'hall-a', teamName: 'Raimon' }] }, { preserveTimestamp: true, suppressCloudEvent: true });
  const snapshotA = localSnapshot(), prepared = await core.prepareSnapshot(snapshotA, crypto), manifest = core.buildManifest(prepared, 'uid-test', 'test-device', 'timestamp');
  const docs = Object.fromEntries(core.SECTOR_NAMES.map(name => [name, sectorDocument(name, prepared)]));
  const payloads = {}; for (const name of core.SECTOR_NAMES) payloads[name] = await core.validateSectorDocument(name, docs[name], manifest, crypto);
  const hallIndex = core.validateHallIndex(payloads.hall_index, manifest), hallDocs = Object.fromEntries(prepared.hallEntries.map(entry => [entry.hallTeamId, hallDocument(entry)])), halls = [];
  for (const id of hallIndex.teamIds) halls.push(await core.validateHallDocument(id, hallDocs[id], manifest, crypto));
  const downloaded = core.reconstructSnapshot(payloads, halls);

  sandbox.RunState.restoreProfile({ teamIdentity: { name: 'Royal' } }, { suppressCloudEvent: true }); const runB = sandbox.RunState.createRun({ name: 'Royal' }, 'ie1'); runB.bossIndex = 1; sandbox.RunState.save(runB, { preserveTimestamps: true, suppressCloudEvent: true, replaceRun: true });
  sandbox.AlbumProgress.write({ schemaVersion: 1, collections: { ie1: { unlockedPlayerIds: { jude: true } } } }, { suppressCloudEvent: true }); sandbox.DevelopmentV2.write({ coins: 2 }, { suppressCloudEvent: true }); sandbox.HallOfFameStorage._saveArchive({ schemaVersion: 2, updatedAt: null, teams: [], index: [] }, { preserveTimestamp: true, suppressCloudEvent: true });
  assert.strictEqual((await core.compareSnapshots(snapshotA, localSnapshot(), crypto)).equivalent, false, 'Snapshot B really differs');
  apply(downloaded); const comparison = await core.compareSnapshots(snapshotA, localSnapshot(), crypto); assert.deepStrictEqual(comparison, { equivalent: true, mismatches: [] }, 'runtime writers restore Snapshot A exactly over Snapshot B');
  assert.deepStrictEqual(localSnapshot().runs.ie1.currentZone.edges, [['n1', 'n2'], ['n2', 'n3']], 'nested arrays survive codec and runtime writers'); assert.strictEqual(localSnapshot().runs.ie2, null); assert.strictEqual(localSnapshot().hallOfFame.teams.length, 1);

  const cloud = fs.readFileSync('js/firebase-cloud-save.js', 'utf8'), ui = fs.readFileSync('js/account-ui.js', 'utf8'); const restore = cloud.slice(cloud.indexOf('async function restoreCloudSave'), cloud.indexOf('function requestConflictResolution'));
  assert.match(cloud, /getDocFromServer/); assert.match(cloud, /maxAttempts = 2/); assert.match(cloud, /cloud-changed-during-download/); assert.match(cloud, /manifestBundleIdentity/); assert.match(cloud, /lastRestoreType === "explicit-conflict-cloud"/);
  assert.doesNotMatch(restore, /writeBatch|batch\.set|batch\.update|batch\.commit/, 'restore has zero cloud writes'); assert.doesNotMatch(cloud, /onSnapshot|setInterval/); assert.match(ui, /Dettaglio:/); assert.match(ui, /Settore:/); assert.match(ui, /Fase:/);
  console.log('cloud-restore-hotfix-test: Snapshot A -> Snapshot B and stable restore checks ok');
})().catch(error => { console.error(error); process.exit(1); });
