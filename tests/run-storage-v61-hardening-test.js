'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Storage {
  constructor() { this.values = new Map(); this.failPrimary = false; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.failPrimary && key === 'run:ie1') throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const localStorage = new Storage();
const context = { console, localStorage, SEASON1_CONFIG: { saveKey: 'run', saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: [] }, SeasonRegistry: { normalizeSeasonId: id => id || 'ie1', activeId: () => 'ie1', list: () => [{ id: 'ie1' }] }, DevelopmentV2: { read: () => ({ players: {} }) } };
context.globalThis = context; vm.runInNewContext(fs.readFileSync('js/run-state.js', 'utf8'), context);

const run = context.RunState.createRun({ name: 'Raimon' }, 'ie1');
context.RunState.save(run); const generation1 = run.storageGeneration;
const other = context.RunState.createRun({ name: 'Royal' }, 'ie1');
assert.throws(() => context.RunState.save(other), error => error.code === 'lineage-mismatch');
context.RunState.save(other, { replaceRun: true });
assert.strictEqual(other.storageGeneration, generation1 + 1);

localStorage.failPrimary = true;
const result = context.RunState.persistMutationOrRecover(other, candidate => { candidate.lives = 0; candidate.inventory.push({ id: 'consumed' }); });
assert.strictEqual(result.ok, false); assert.strictEqual(other.lives, 2); assert.strictEqual(other.inventory.length, 0);
localStorage.failPrimary = false;
assert.strictEqual(context.RunState.persistMutationOrRecover(other, candidate => { candidate.lives = 1; }).ok, true);
assert.strictEqual(other.lives, 1);

const keys = context.RunStorage.keys('ie1'); const exact = localStorage.getItem(keys.primary); localStorage.setItem(keys.backup, exact); localStorage.values.delete(keys.primary);
const recovered = context.RunStorage.load('ie1', { readOnly: true }); assert.strictEqual(recovered.storageGeneration, other.storageGeneration);
context.RunStorage.repairCanonicalFromExactBackup('ie1'); context.RunState.save(recovered);
assert.strictEqual(recovered.storageGeneration, other.storageGeneration + 1);

const envelope = JSON.parse(localStorage.getItem(keys.primary)); envelope.commitId = null; localStorage.setItem(keys.primary, JSON.stringify(envelope)); localStorage.values.delete(keys.head); localStorage.values.delete(keys.backup);
assert.throws(() => context.RunStorage.load('ie1'), error => ['corrupt-storage-envelope', 'canonical-unrecoverable'].includes(error.code));
const future = { storageSchemaVersion: 99, seasonId: 'ie1', generation: 1, commitId: 'x', state: 'active', runId: 'x', payload: {} }; localStorage.setItem(keys.primary, JSON.stringify(future));
assert.throws(() => context.RunStorage.load('ie1'), error => error.code === 'unsupported-storage-schema' || error.code === 'canonical-unrecoverable');
console.log('run-storage-v61-hardening-test: ok');
