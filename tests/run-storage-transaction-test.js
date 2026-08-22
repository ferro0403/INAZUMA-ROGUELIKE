'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class FaultStorage {
  constructor(shared = new Map()) { this.values = shared; this.failSet = null; this.failRemove = false; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { if (this.failSet === key) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); this.values.set(key, String(value)); }
  removeItem(key) { if (this.failRemove) throw new Error('remove blocked'); this.values.delete(key); }
}
function runtime(storage) {
  const context = { console, localStorage: storage, Date, Math, JSON,
    SEASON1_CONFIG: { saveKey: 'run', saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: ['old-v1'] },
    SeasonRegistry: { normalizeSeasonId: (id) => ['ie1', 'ie2'].includes(id) ? id : 'ie1', activeId: () => 'ie1', list: () => [{ id: 'ie1' }, { id: 'ie2' }] },
    DevelopmentV2: { read: () => ({ players: {} }) }, dispatchEvent() {}, CustomEvent: class {},
  }; context.globalThis = context; vm.runInNewContext(fs.readFileSync('js/run-state.js', 'utf8'), context); return context;
}

const shared = new Map(), storage = new FaultStorage(shared), a = runtime(storage);
const run = a.RunState.createRun({ name: 'Raimon' }, 'ie1');
a.RunState.save(run); assert.strictEqual(run.storageGeneration, 1);
run.bossIndex = 9; a.RunState.save(run); assert.strictEqual(run.storageGeneration, 2);
assert.strictEqual(runtime(new FaultStorage(shared)).RunState.load('ie1').bossIndex, 9, 'fresh VM sees exact latest commit');

const stale = runtime(new FaultStorage(shared)).RunState.load('ie1');
run.bossIndex = 10; a.RunState.save(run);
stale.bossIndex = 3;
assert.throws(() => runtime(new FaultStorage(shared)).RunState.save(stale), (error) => error.code === 'stale-write');
assert.strictEqual(a.RunState.load('ie1').bossIndex, 10, 'stale tab cannot roll back progress');

const beforeFailure = run.storageGeneration; storage.failSet = 'run:ie1'; run.bossIndex = 11;
assert.throws(() => a.RunState.save(run), (error) => error.code === 'canonical-write-failed' && error.stage === 'primary-write');
storage.failSet = null; assert.strictEqual(a.RunState.load('ie1').bossIndex, 10); assert.strictEqual(run.storageGeneration, beforeFailure);
a.RunState.save(run); assert.strictEqual(a.RunState.load('ie1').bossIndex, 11, 'retry succeeds after quota is available');

storage.failSet = 'run:ie1_backup'; run.bossIndex = 12; a.RunState.save(run); storage.failSet = null;
assert.strictEqual(a.RunState.load('ie1').bossIndex, 12, 'optional backup failure does not fail canonical commit');

const deletedGeneration = run.storageGeneration + 1; storage.failRemove = true; a.RunState.remove('ie1', { expectedGeneration: run.storageGeneration }); storage.failRemove = false;
assert.strictEqual(JSON.parse(shared.get('run:ie1_head')).generation, deletedGeneration);
shared.set('old-v1', JSON.stringify({ ...run, storageGeneration: undefined, storageCommitId: undefined }));
assert.strictEqual(runtime(new FaultStorage(shared)).RunState.load('ie1'), null, 'tombstone defeats leftover legacy data');
assert.throws(() => a.RunState.save(run), (error) => error.code === 'stale-write', 'deleted run cannot be resurrected by stale writer');

const replacement = a.RunState.createRun({ name: 'Royal' }, 'ie1');
a.RunState.save(replacement, { replaceRun: true });
assert.notStrictEqual(replacement.runId, run.runId); assert.strictEqual(replacement.storageGeneration, deletedGeneration + 1);
assert.throws(() => a.RunState.save(run), (error) => error.code === 'stale-write', 'old lineage cannot overwrite replacement run');

// The primary envelope is authoritative; head is only a fallible witness.
const headFailureStorage = new FaultStorage(shared); const headRuntime = runtime(headFailureStorage);
const latest = headRuntime.RunState.load('ie1'); latest.bossIndex = 13;
headFailureStorage.failSet = 'run:ie1_head'; headRuntime.RunState.save(latest); headFailureStorage.failSet = null;
assert.strictEqual(runtime(new FaultStorage(shared)).RunState.load('ie1').bossIndex, 13, 'verified primary survives stale head in a fresh VM');
const staleAfterHeadFailure = { ...replacement, bossIndex: 1 };
assert.throws(() => runtime(new FaultStorage(shared)).RunState.save(staleAfterHeadFailure, { replaceRun: true }), (error) => error.code === 'stale-write', 'replaceRun does not bypass generation checks');

shared.delete('run:ie1_head');
const withoutHead = runtime(new FaultStorage(shared)).RunState.load('ie1'); withoutHead.bossIndex = 14;
runtime(new FaultStorage(shared)).RunState.save(withoutHead);
assert.strictEqual(runtime(new FaultStorage(shared)).RunState.load('ie1').bossIndex, 14, 'a valid primary remains saveable without head');

const staleDeleteGeneration = withoutHead.storageGeneration;
const advanced = runtime(new FaultStorage(shared)).RunState.load('ie1'); advanced.bossIndex = 15; runtime(new FaultStorage(shared)).RunState.save(advanced);
assert.throws(() => runtime(new FaultStorage(shared)).RunState.remove('ie1', { expectedGeneration: staleDeleteGeneration }), (error) => error.code === 'stale-write', 'stale delete cannot remove a newer commit');
assert.throws(() => runtime(new FaultStorage(shared)).RunState.remove('ie1'), (error) => error.code === 'missing-expected-generation');

const other = a.RunState.createRun({ name: 'Zeus' }, 'ie2'); a.RunState.save(other);
assert.strictEqual(other.storageGeneration, 1, 'generations are independent by season');

const envelope = JSON.parse(shared.get('run:ie1')); envelope.payload.version = 999; shared.set('run:ie1', JSON.stringify(envelope)); shared.delete('run:ie1_backup');
assert.throws(() => a.RunState.load('ie1'), (error) => error.code === 'canonical-unrecoverable', 'future payload is not normalized or silently rolled back');

console.log('run-storage-transaction-test: ok');
