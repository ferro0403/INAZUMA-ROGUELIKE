'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto').webcrypto;
const cloudCore = require('../js/cloud-save-core.js');

const values = new Map();
const localStorage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
const context = {
  console, localStorage,
  SEASON1_CONFIG: { saveKey: 'run', saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: [] },
  SeasonRegistry: { normalizeSeasonId: (id) => id || 'ie1', activeId: () => 'ie1', list: () => [{ id: 'ie1' }] },
  DevelopmentV2: { read: () => ({ players: {} }) },
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync('js/run-state.js', 'utf8'), context);

const timestamp = '2024-01-02T03:04:05.000Z';
const run = context.RunState.createRun({ name: 'Raimon' }, 'ie1');
run.updatedAt = timestamp; run.lastPlayedAt = timestamp;
context.RunState.save(run, { preserveTimestamps: true });
const before = JSON.stringify([...values]);
let saves = 0;
const originalSave = context.RunStorage.save;
context.RunStorage.save = function (...args) { saves += 1; return originalSave.apply(this, args); };
const loaded = context.RunStorage.load('ie1', { readOnly: true });
assert.strictEqual(loaded.updatedAt, timestamp);
assert.strictEqual(saves, 0, 'read-only load never repairs or rewrites storage');
assert.strictEqual(JSON.stringify([...values]), before, 'read-only load leaves every localStorage key unchanged');
assert.strictEqual(values.has('run:ie1_tmp'), false);
(async () => {
  const snapshotApis = {
    RunState: context.RunState,
    AlbumProgress: { read: () => ({ collections: {} }) },
    DevelopmentV2: { read: () => ({ players: {} }) },
    HallOfFameStorage: { ARCHIVE_SCHEMA_VERSION: 1, _loadArchive: () => ({ schemaVersion: 1, updatedAt: null, teams: [], index: [] }) },
  };
  const snapshotBefore = cloudCore.readLocalSnapshot(snapshotApis);
  const storageBefore = JSON.stringify([...values]);
  const snapshotAfter = cloudCore.readLocalSnapshot(snapshotApis);
  assert.strictEqual(await cloudCore.hash(snapshotBefore, crypto), await cloudCore.hash(snapshotAfter, crypto));
  assert.strictEqual(snapshotAfter.runs.ie1.updatedAt, timestamp);
  assert.strictEqual(JSON.stringify([...values]), storageBefore, 'consecutive cloud snapshots do not mutate storage');

  context.RunStorage.load('ie1');
  assert.strictEqual(saves, 1, 'normal load retains repair/save behavior');
  assert.notStrictEqual(context.RunStorage.load('ie1', { readOnly: true }).updatedAt, timestamp, 'normal load still refreshes updatedAt');
  console.log('run-state-read-only-test: ok');
})().catch((error) => { console.error(error); process.exit(1); });
