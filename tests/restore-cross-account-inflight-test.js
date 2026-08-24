const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

const c = {
  console,
  module: { exports: {} },
  globalThis: null,
};
c.globalThis = c;
vm.runInNewContext(fs.readFileSync('js/cloud-restore-resume-coordinator.js', 'utf8'), c, {
  filename: 'cloud-restore-resume-coordinator.js',
});

(async () => {
  const aGate = deferred();
  const bGate = deferred();
  const journals = {
    a: { uid: 'a', operationId: 'op-a', targetCloudCommitId: 'A1' },
    b: { uid: 'b', operationId: 'op-b', targetCloudCommitId: 'B1' },
  };
  const calls = { a: 0, b: 0 };

  const options = (uid, gate) => ({
    auth: { status: 'authenticated', uid },
    readJournal: (accountUid) => journals[accountUid],
    resumeInterrupted: async () => {
      calls[uid] += 1;
      await gate.promise;
      if (uid === 'a') throw Object.assign(new Error('restore-ownership-lost'), { code: 'restore-ownership-lost' });
      return { status: 'restored' };
    },
    publish() {},
    onWritable() {},
  });

  const recoveryA = c.CloudRestoreResumeCoordinator.route(options('a', aGate));
  await new Promise((resolve) => setImmediate(resolve));
  const recoveryB1 = c.CloudRestoreResumeCoordinator.route(options('b', bGate));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.a, 1);
  assert.equal(calls.b, 1);
  assert.equal(c.CloudRestoreResumeCoordinator.isRunning('a'), true);
  assert.equal(c.CloudRestoreResumeCoordinator.isRunning('b'), true);

  // A settles after B has already started. A's finalizer must not clear B's fence.
  aGate.resolve();
  await assert.rejects(recoveryA, (error) => error.code === 'restore-ownership-lost');
  assert.equal(c.CloudRestoreResumeCoordinator.isRunning('a'), false);
  assert.equal(c.CloudRestoreResumeCoordinator.isRunning('b'), true);

  // A duplicate B auth event while B is still running must reuse B's recovery.
  const recoveryB2 = c.CloudRestoreResumeCoordinator.route(options('b', bGate));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.b, 1);

  bGate.resolve();
  const [first, duplicate] = await Promise.all([recoveryB1, recoveryB2]);
  assert.equal(first.status, 'restored');
  assert.equal(duplicate.status, 'restored');
  assert.equal(calls.b, 1);
  assert.equal(c.CloudRestoreResumeCoordinator.isRunning(), false);

  console.log('restore cross-account in-flight fencing: ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
