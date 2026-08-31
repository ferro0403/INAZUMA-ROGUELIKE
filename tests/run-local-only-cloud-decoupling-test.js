'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const BudgetStorage = require('./helpers/budget-storage');
const core = require('../js/cloud-save-core');

function runtime(storage) {
  const events = [];
  const c = { console, localStorage: storage, Date, Math, JSON, structuredClone, TextEncoder, crypto: global.crypto,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent: event => (events.push(event), true), addEventListener() {},
    SEASON1_CONFIG: { saveKey: 'run', saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: [] },
    SeasonRegistry: { normalizeSeasonId: id => String(id || 'ie1').toLowerCase(), activeId: () => 'ie1', list: () => ['ie1', 'ie2', 'ie1_s2', 'ie1_s3', 'orion', 'future_test_season'].map(id => ({ id })), database: () => ({}) },
    DevelopmentRuntime: { buildRunSnapshot: () => ({ developmentPlayerSnapshot: {} }) },
  };
  c.globalThis = c; vm.createContext(c);
  for (const file of ['persistence-recovery-guard.js', 'run-state.js']) vm.runInContext(fs.readFileSync(`js/${file}`, 'utf8'), c, { filename: file });
  c.events = events;
  return c;
}

const storage = new BudgetStorage();
let c = runtime(storage);
const ids = ['ie1', 'ie2', 'ie1_s2', 'ie1_s3', 'orion', 'future_test_season'];
for (const id of ids) {
  const run = c.RunState.createRun({ name: id }, id);
  c.RunState.save(run);
  assert.equal(c.RunState.load(id, { readOnly: true }).runId, run.runId);
  run.bossIndex = 3;
  c.RunState.save(run);
  c = runtime(storage);
  assert.equal(c.RunState.load(id, { readOnly: true }).bossIndex, 3, `${id} survives reload locally`);
}

const uid = 'authenticated-user';
storage.setItem(`inazuma.cloud.restoreJournal.${uid}`, JSON.stringify({ schemaVersion: 3, uid, operationId: 'legacy', stage: 'run-ie1', runProgress: { ie1: { status: 'pending' } } }));
c.PersistenceRecoveryGuard.bindUid(uid);
assert.equal(c.PersistenceRecoveryGuard.isBlocked(), true, 'legacy cloud journal still protects permanent stores');
let run = c.RunState.load('ie1', { readOnly: true }); run.bossIndex = 4;
c.RunState.save(run);
assert.equal(c.RunState.load('ie1', { readOnly: true }).bossIndex, 4, 'cloud journal cannot block a run save');
c.RunState.remove('orion', { expectedGeneration: c.RunStorage.diagnostics('orion').canonicalGeneration });
assert.equal(c.RunState.load('orion'), null, 'cloud journal cannot block a local run removal');

storage.removeItem(`inazuma.cloud.restoreJournal.${uid}`);
storage.setItem(`inazuma.cloud.restoreTerminal.${uid}`, JSON.stringify({ reason: 'legacy-cloud-target-not-immutable' }));
c.PersistenceRecoveryGuard.bindUid(uid);
assert.equal(c.PersistenceRecoveryGuard.getState().status, 'terminal-recovery');
run = c.RunState.load('ie2', { readOnly: true }); run.bossIndex = 5;
c.RunState.save(run);
assert.equal(c.RunState.load('ie2', { readOnly: true }).bossIndex, 5, 'terminal cloud recovery cannot block a run save');

const runEvents = c.events.filter(event => event.type === 'inazuma:local-save-committed');
assert.ok(runEvents.length > 0);
assert.ok(runEvents.every(event => event.detail.domain === 'run'));
assert.ok(runEvents.every(event => !core.SECTOR_NAMES.includes(event.detail.sector)), 'no run is an active cloud sector');
assert.ok(!fs.readFileSync('js/firebase-cloud-save.js', 'utf8').includes('RunStorage'));
assert.ok(!fs.readFileSync('js/firebase-cloud-save.js', 'utf8').includes('RunState.load('));
const appSource = fs.readFileSync('js/app.js', 'utf8');
assert.ok(!appSource.includes('await global.PersistenceBootstrapGate?.ready'), 'cloud auth bootstrap cannot gate local gameplay startup');
console.log('all present and future RunStorage seasons are cloud-independent: ok');
