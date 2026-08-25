const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const BudgetStorage = require('./helpers/budget-storage');

const RUN_IDS = ['ie1', 'ie2', 'ie1_s2', 'ie1_s3', 'orion'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function runtime(storage) {
  const c = {
    console,
    localStorage: storage,
    module: { exports: {} },
    globalThis: null,
    CustomEvent: class {},
    dispatchEvent() {},
  };
  c.globalThis = c;
  for (const file of [
    'persistence-recovery-guard.js',
    'persistence-bootstrap-gate.js',
    'cloud-restore-protocol.js',
    'cloud-restore-resume-coordinator.js',
  ]) {
    c.module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(`js/${file}`, 'utf8'), c, { filename: file });
  }
  return c;
}

function createJournal(c, uid = 'u', commitId = 'C1') {
  return c.InazumaCloudRestoreProtocol.createJournal({
    operationId: `op-${uid}`,
    uid,
    restoreType: 'journal-recovery',
    targetCloudRevision: 7,
    targetCloudCommitId: commitId,
    targetManifestIdentity: 'M1',
    sourceLocalEpoch: 0,
    expectedLocalEpoch: 0,
    sourceRunProvenance: Object.fromEntries(RUN_IDS.map((id) => [id, { generation: 0 }])),
    targetRunHashes: Object.fromEntries(RUN_IDS.map((id) => [id, `hash-${id}`])),
    startedAt: '2026-08-24T00:00:00.000Z',
  });
}

function createTarget() {
  return {
    manifest: { revision: 7, cloudCommitId: 'C1' },
    snapshot: {
      profile: { name: 'cloud-profile' },
      runs: Object.fromEntries(RUN_IDS.map((id) => [id, { seasonId: id, checkpoint: 7 }])),
      album: { unlocked: ['p1'] },
      development: { points: 42 },
      hallOfFame: { teams: [{ id: 'hall-1' }] },
    },
  };
}

function createRecoveryHarness(c, storage, uid = 'u') {
  const key = `inazuma.cloud.restoreJournal.${uid}`;
  const target = createTarget();
  const local = {
    profile: { name: 'local-profile' },
    runs: Object.fromEntries(RUN_IDS.map((id) => [id, null])),
    album: { unlocked: [] },
    development: { points: 0 },
    hallOfFame: { teams: [] },
  };
  const runGeneration = Object.fromEntries(RUN_IDS.map((id) => [id, 0]));
  const state = {
    activeUid: uid,
    failTarget: false,
    clearFailures: 0,
    targetCommitIds: [],
    applyCount: 0,
    metadataWrites: 0,
    loadBarrier: null,
  };

  const adaptersFor = (journal) => ({
    assertActive: async () => {
      if (state.activeUid !== journal.uid) throw Object.assign(new Error('restore-ownership-lost'), { code: 'restore-ownership-lost' });
    },
    readRun: async (id) => clone(local.runs[id]),
    runGeneration: async (id) => runGeneration[id],
    runEquals: async (actual, wanted) => equal(actual, wanted),
    assertOwnership: async (activeJournal) => {
      if (state.activeUid !== activeJournal.uid) throw Object.assign(new Error('restore-ownership-lost'), { code: 'restore-ownership-lost' });
      c.PersistenceRecoveryGuard.assertWritable({ restoreOwnershipToken: activeJournal.operationId });
    },
    applyRun: async (id, wanted) => {
      local.runs[id] = clone(wanted);
      runGeneration[id] += 1;
      state.applyCount += 1;
    },
    storeEquals: async (name, targetSnapshot) => {
      const keyName = name === 'hall' ? 'hallOfFame' : name;
      return equal(local[keyName], targetSnapshot[keyName]);
    },
    applyStore: async (name, targetSnapshot) => {
      const keyName = name === 'hall' ? 'hallOfFame' : name;
      local[keyName] = clone(targetSnapshot[keyName]);
      state.applyCount += 1;
    },
    verify: async (targetSnapshot) => equal(local, targetSnapshot),
    writeMetadata: async () => { state.metadataWrites += 1; },
  });

  async function resumeInterrupted(journal) {
    return c.InazumaCloudRestoreProtocol.recover({
      journal,
      loadTarget: async (activeJournal) => {
        state.targetCommitIds.push(activeJournal.targetCloudCommitId);
        if (state.loadBarrier) await state.loadBarrier;
        if (state.failTarget) throw Object.assign(new Error('target-fetch-failed'), { code: 'restore-journal-repair-needed' });
        assert.equal(activeJournal.targetCloudCommitId, 'C1');
        return clone(target);
      },
      writeJournal: (next) => {
        storage.setItem(key, JSON.stringify(next));
        return next;
      },
      clearJournal: () => {
        if (state.clearFailures > 0) {
          state.clearFailures -= 1;
          const error = new Error('journal-clear-failed');
          error.name = 'SecurityError';
          throw error;
        }
        storage.removeItem(key);
      },
      adapters: adaptersFor(journal),
      onBlocked: (activeJournal) => c.PersistenceRecoveryGuard.setBlocked({
        uid: activeJournal.uid,
        operationId: activeJournal.operationId,
        stage: activeJournal.stage,
        status: 'running',
      }),
      onComplete: (activeJournal) => c.PersistenceRecoveryGuard.clearBlocked(activeJournal.operationId),
    });
  }

  return { key, target, local, state, resumeInterrupted };
}

function routeOptions(c, storage, harness, counters = {}) {
  const uid = harness.state.activeUid;
  return {
    auth: { status: 'authenticated', uid },
    readJournal: (accountUid) => {
      const raw = storage.getItem(`inazuma.cloud.restoreJournal.${accountUid}`);
      return raw ? JSON.parse(raw) : null;
    },
    normalAssociate: () => { counters.normal = (counters.normal || 0) + 1; return 'associated'; },
    resumeInterrupted: harness.resumeInterrupted,
    publish: (patch) => { counters.published = patch; },
    onWritable: () => c.PersistenceBootstrapGate.notify(),
  };
}

(async () => {
  // B6 + B12: fresh boot with journal and no cached manifest resumes once,
  // duplicate auth/routing events dedupe, protocol clears the journal itself,
  // guard clears, and bootstrap resumes exactly once.
  {
    const storage = new BudgetStorage();
    const c = runtime(storage);
    const journal = createJournal(c);
    storage.setItem('inazuma.cloud.restoreJournal.u', JSON.stringify(journal));
    const harness = createRecoveryHarness(c, storage);
    const counters = { normal: 0 };
    c.PersistenceBootstrapGate.markAuth({ status: 'authenticated', uid: 'u' });
    let configure = 0, home = 0;
    const bootstrap = c.PersistenceBootstrapGate.whenWritable().then(() => { configure += 1; home += 1; });
    const options = routeOptions(c, storage, harness, counters);
    const [first, duplicate] = await Promise.all([
      c.CloudRestoreResumeCoordinator.route(options),
      c.CloudRestoreResumeCoordinator.route(options),
    ]);
    await bootstrap;
    assert.equal(first.status, 'restored');
    assert.equal(duplicate.status, 'restored');
    assert.equal(counters.normal, 0);
    assert.deepEqual(harness.state.targetCommitIds, ['C1']);
    assert.equal(storage.getItem(harness.key), null);
    assert.equal(c.PersistenceRecoveryGuard.isBlocked(), false);
    assert.deepEqual([configure, home], [1, 1]);
    assert(harness.state.applyCount > 0);
  }

  // B7 + B8: immutable target fetch failure leaves journal/guard intact;
  // retry succeeds against the exact same target without cachedManifest.
  {
    const storage = new BudgetStorage();
    const c = runtime(storage);
    const journal = createJournal(c);
    storage.setItem('inazuma.cloud.restoreJournal.u', JSON.stringify(journal));
    const harness = createRecoveryHarness(c, storage);
    const counters = { normal: 0 };
    c.PersistenceBootstrapGate.markAuth({ status: 'authenticated', uid: 'u' });
    let writable = false;
    const bootstrap = c.PersistenceBootstrapGate.whenWritable().then(() => { writable = true; });
    harness.state.failTarget = true;
    const options = routeOptions(c, storage, harness, counters);
    await assert.rejects(c.CloudRestoreResumeCoordinator.route(options), (error) => error.code === 'restore-journal-repair-needed');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(writable, false);
    assert.equal(counters.normal, 0);
    assert(c.PersistenceRecoveryGuard.isBlocked());
    assert(storage.getItem(harness.key));
    harness.state.failTarget = false;
    const result = await c.CloudRestoreResumeCoordinator.retry(options);
    await bootstrap;
    assert.equal(result.status, 'restored');
    assert.equal(writable, true);
    assert.deepEqual(harness.state.targetCommitIds, ['C1', 'C1']);
    assert.equal(storage.getItem(harness.key), null);
    assert.equal(c.PersistenceRecoveryGuard.isBlocked(), false);
  }

  // B9: failure to clear a completed journal keeps recovery blocked. Retry
  // performs no duplicate store/run application and clears through the real protocol.
  {
    const storage = new BudgetStorage();
    const c = runtime(storage);
    const journal = createJournal(c);
    storage.setItem('inazuma.cloud.restoreJournal.u', JSON.stringify(journal));
    const harness = createRecoveryHarness(c, storage);
    harness.state.clearFailures = 1;
    c.PersistenceBootstrapGate.markAuth({ status: 'authenticated', uid: 'u' });
    let writableCount = 0;
    const bootstrap = c.PersistenceBootstrapGate.whenWritable().then(() => { writableCount += 1; });
    const options = routeOptions(c, storage, harness, { normal: 0 });
    const first = await c.CloudRestoreResumeCoordinator.route(options);
    assert.equal(first.status, 'restore-repair-needed');
    assert(c.PersistenceRecoveryGuard.isBlocked());
    assert(storage.getItem(harness.key));
    assert.equal(writableCount, 0);
    const appliedBeforeRetry = harness.state.applyCount;
    const retry = await c.CloudRestoreResumeCoordinator.retry(options);
    await bootstrap;
    assert.equal(retry.status, 'restored');
    assert.equal(harness.state.applyCount, appliedBeforeRetry);
    assert.equal(writableCount, 1);
    assert.equal(storage.getItem(harness.key), null);
    assert.equal(c.PersistenceRecoveryGuard.isBlocked(), false);
  }

  // B10: clean authenticated boot takes the normal association path.
  {
    const storage = new BudgetStorage();
    const c = runtime(storage);
    const harness = createRecoveryHarness(c, storage, 'clean');
    const counters = { normal: 0 };
    await c.CloudRestoreResumeCoordinator.route(routeOptions(c, storage, harness, counters));
    assert.equal(counters.normal, 1);
  }

  // B11: signed-out state never reads recovery storage or associates.
  {
    const storage = new BudgetStorage();
    const c = runtime(storage);
    let normal = 0, reads = 0;
    const result = await c.CloudRestoreResumeCoordinator.route({
      auth: { status: 'signed-out' },
      readJournal: () => { reads += 1; throw new Error('must-not-read'); },
      normalAssociate: () => { normal += 1; },
    });
    assert.equal(result, null);
    assert.deepEqual([reads, normal], [0, 0]);
  }

  // Account switch safety: a recovery started for A cannot write after auth moves to B.
  {
    const storage = new BudgetStorage();
    const c = runtime(storage);
    const journal = createJournal(c, 'a');
    storage.setItem('inazuma.cloud.restoreJournal.a', JSON.stringify(journal));
    const harness = createRecoveryHarness(c, storage, 'a');
    let releaseTarget;
    harness.state.loadBarrier = new Promise((resolve) => { releaseTarget = resolve; });
    c.PersistenceBootstrapGate.markAuth({ status: 'authenticated', uid: 'a' });
    const options = routeOptions(c, storage, harness, { normal: 0 });
    const recovery = c.CloudRestoreResumeCoordinator.route(options);
    await new Promise((resolve) => setImmediate(resolve));
    harness.state.activeUid = 'b';
    c.PersistenceBootstrapGate.markAuth({ status: 'authenticated', uid: 'b' });
    releaseTarget();
    await assert.rejects(recovery, (error) => error.code === 'restore-ownership-lost');
    assert(storage.getItem('inazuma.cloud.restoreJournal.a'));
    assert.equal(harness.state.applyCount, 0);
  }

  console.log('restore bootstrap interrupted resume B6-B12: ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

// Production wiring assertions: interrupted recovery is independent of cachedManifest
// and can only load the journal's exact immutable commit.
const cloudSource = fs.readFileSync('js/firebase-cloud-save.js', 'utf8');
assert.match(cloudSource, /CloudRestoreResumeCoordinator\.route/);
assert.match(cloudSource, /function resumeInterruptedRestore/);
assert.match(cloudSource, /const interrupted = readRestoreJournal\(uid\); if \(interrupted\) return resumeInterruptedRestore\(interrupted\)/);
const resumeBody = cloudSource.slice(
  cloudSource.indexOf('async function resumeInterruptedRestore'),
  cloudSource.indexOf('async function restoreCloudSave'),
);
assert.doesNotMatch(resumeBody, /cachedManifest/);
const journalLoader = cloudSource.slice(
  cloudSource.indexOf('async function downloadCloudBundleForJournal'),
  cloudSource.indexOf('async function reconcile'),
);
assert.match(journalLoader, /if \(!journal\.targetCloudCommitId\) throw restoreError\("restore-journal-repair-needed", "manifest"\)/);
assert.doesNotMatch(journalLoader, /downloadStableCloudBundle/);
assert.match(cloudSource, /auth\.uid !== uid \|\| token !== generation/);
