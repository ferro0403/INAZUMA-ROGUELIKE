'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
function runtime(storage) {
  const context = { console, localStorage: storage, Date, Math, JSON,
    SEASON1_CONFIG: { saveKey: 'run', saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: [] },
    SeasonRegistry: { normalizeSeasonId: id => id || 'ie1', activeId: () => 'ie1', list: () => [{ id: 'ie1' }] },
    DevelopmentV2: { read: () => ({ players: {} }) }, dispatchEvent() {}, CustomEvent: class {},
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync('js/run-state.js', 'utf8'), context);
  return context;
}

const storage = new Storage(), api = runtime(storage), keys = api.RunStorage.keys('ie1');
const run = api.RunState.createRun({ name: 'Raimon' }, 'ie1');
api.RunState.save(run);
const oldBackup = storage.getItem(keys.backup), oldEnvelope = JSON.parse(oldBackup);
const futureEnvelope = JSON.stringify({ ...oldEnvelope, storageSchemaVersion: 2, generation: 20, commitId: 'future-20' });
storage.setItem(keys.primary, futureEnvelope);
storage.setItem(keys.head, JSON.stringify({ ...oldEnvelope, payload: undefined }));
assert.throws(() => api.RunStorage.repairCanonicalFromExactBackup('ie1'), error => error.code === 'unsupported-storage-schema');
assert.strictEqual(storage.getItem(keys.primary), futureEnvelope, 'future envelope bytes must remain untouched');

const futurePayload = JSON.stringify({ ...oldEnvelope, generation: 21, commitId: 'future-payload-21', payload: { ...oldEnvelope.payload, version: 99 } });
storage.setItem(keys.primary, futurePayload);
assert.throws(() => api.RunStorage.repairCanonicalFromExactBackup('ie1'), error => error.code === 'unsupported-run-save-version');
assert.strictEqual(storage.getItem(keys.primary), futurePayload, 'future payload bytes must remain untouched');
console.log('run-storage-future-schema-repair-test: ok');
