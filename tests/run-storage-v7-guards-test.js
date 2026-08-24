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
function runtime(storage, seasons = ['ie1']) {
  const context = { console, localStorage: storage, Date, Math, JSON,
    SEASON1_CONFIG: { saveKey: 'run', saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: ['old-a', 'old-b'] },
    SeasonRegistry: { normalizeSeasonId: id => seasons.includes(id) ? id : 'ie1', activeId: () => 'ie1', list: () => seasons.map(id => ({ id })) },
    DevelopmentV2: { read: () => ({ players: {} }) }, dispatchEvent() {}, CustomEvent: class {},
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync('js/run-state.js', 'utf8'), context);
  return context;
}

// A valid canonical primary is absolute authority, even when head and backup
// contain an older exact pair.
const storage = new Storage(), api = runtime(storage);
const run = api.RunState.createRun({ name: 'Raimon' }, 'ie1');
api.RunState.save(run);
const keys = api.RunStorage.keys('ie1'), old = storage.getItem(keys.primary);
run.bossIndex = 1; api.RunState.save(run); const latest = storage.getItem(keys.primary);
storage.setItem(keys.backup, old);
const oldEnvelope = JSON.parse(old);
storage.setItem(keys.head, JSON.stringify({ ...oldEnvelope, payload: undefined }));
assert.throws(() => api.RunStorage.repairCanonicalFromExactBackup('ie1'), error => error.code === 'canonical-primary-already-valid');
assert.strictEqual(storage.getItem(keys.primary), latest, 'repair cannot roll a valid primary back');

// Missing and corrupt primaries can be repaired, byte-for-byte, from an exact
// head/backup proof. The next ordinary save advances exactly one generation.
storage.removeItem(keys.primary);
api.RunStorage.repairCanonicalFromExactBackup('ie1');
assert.strictEqual(storage.getItem(keys.primary), old);
const repaired = api.RunState.load('ie1', { readOnly: true });
api.RunState.save(repaired);
assert.strictEqual(repaired.storageGeneration, oldEnvelope.generation + 1);
const exact = storage.getItem(keys.backup), exactEnvelope = JSON.parse(exact);
storage.setItem(keys.primary, '{corrupt');
storage.setItem(keys.head, JSON.stringify({ ...exactEnvelope, payload: undefined }));
api.RunStorage.repairCanonicalFromExactBackup('ie1');
assert.strictEqual(storage.getItem(keys.primary), exact);

// Recursive legacy comparison observes semantic nested fields but ignores key order.
const legacyStorage = new Storage(), legacyApi = runtime(legacyStorage);
const base = { version: 2, seasonId: 'ie1', phase: 'map', lives: 2, bossIndex: 0, roster: [{ playerId: 'mark', level: 4 }], lineup: ['mark'], bench: [], inventory: [], completedBossIds: [], unlockedTeamIds: [], activeMatch: null, currentZone: { currentNodeId: 'n1' }, postBossFlow: null };
legacyStorage.setItem('old-a', JSON.stringify(base));
legacyStorage.setItem('old-b', JSON.stringify({ ...base, roster: [{ playerId: 'axel', level: 4 }] }));
assert.throws(() => legacyApi.RunState.load('ie1', { readOnly: true }), error => error.code === 'legacy-recovery-required');
legacyStorage.setItem('old-b', JSON.stringify({ ...base, currentZone: { currentNodeId: 'n2' } }));
assert.throws(() => legacyApi.RunState.load('ie1', { readOnly: true }), error => error.code === 'legacy-recovery-required');
legacyStorage.setItem('old-b', JSON.stringify({ ...base, roster: [{ level: 4, playerId: 'mark' }] }));
assert.strictEqual(legacyApi.RunState.load('ie1', { readOnly: true }).roster[0].playerId, 'mark');

// A broken season is represented as recovery state without hiding healthy saves.
const multiStorage = new Storage(), multi = runtime(multiStorage, ['ie1', 'ie2']);
const healthy = multi.RunState.createRun({ name: 'Raimon' }, 'ie1'); multi.RunState.save(healthy);
multiStorage.setItem(multi.RunStorage.keys('ie2').primary, '{broken');
multiStorage.setItem(multi.RunStorage.keys('ie2').head, JSON.stringify({ storageSchemaVersion: 1, seasonId: 'ie2', generation: 2, commitId: 'lost', state: 'active', runId: 'lost' }));
const saves = multi.RunState.activeSaves();
assert(saves.some(entry => entry.season.id === 'ie1' && entry.run));
assert(saves.some(entry => entry.season.id === 'ie2' && entry.recovery));

console.log('run-storage-v7-guards-test: ok');
