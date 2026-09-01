'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Storage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } }
const storage = new Storage();
const context = { console, localStorage: storage, Date, Math, JSON,
  SEASON1_CONFIG: { saveKey: 'run', saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: [] },
  SeasonRegistry: { normalizeSeasonId: id => ['ie1', 'ie1_s2'].includes(id) ? id : 'ie1', activeId: () => 'ie1', list: () => [{ id: 'ie1' }, { id: 'ie1_s2' }] },
  DevelopmentV2: { read: () => ({ players: {} }) }, dispatchEvent() {}, CustomEvent: class {},
};
context.globalThis = context;
vm.runInNewContext(fs.readFileSync('js/run-state.js', 'utf8'), context);
const healthy = context.RunState.createRun({ name: 'Raimon' }, 'ie1');
healthy.lastPlayedAt = '2020-01-01T00:00:00.000Z';
context.RunState.save(healthy, { preserveTimestamps: true });
const brokenKeys = context.RunStorage.keys('ie1_s2');
storage.setItem(brokenKeys.primary, '{broken');
storage.setItem(brokenKeys.head, JSON.stringify({ storageSchemaVersion: 1, seasonId: 'ie1_s2', generation: 999, commitId: 'newer', state: 'active', runId: 'lost' }));
assert.strictEqual(context.RunState.latestActiveSave().run.runId, healthy.runId, 'recovery entry cannot hide the healthy Continue run');
assert.strictEqual(context.RunState.recoverySaves().length, 1);
assert.strictEqual(context.RunState.recoverySaves()[0].season.id, 'ie1_s2');
console.log('multi-season-home-recovery-test: ok');
