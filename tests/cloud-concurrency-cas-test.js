const assert = require('assert');
const P = require('../js/cloud-sync-protocol');
const identity = (x) => JSON.stringify([x?.revision, x?.cloudCommitId]);
(async () => {
  for (let c = 0; c <= 8; c++) {
    const store = P.memory(), base = { revision: 1, cloudCommitId: 'old' };
    await P.publish({ store, expected: null, commitId: 'old', writes: [{ sector: 'profile' }], manifest: base, identity });
    if (c === 0) {
      const fresh = P.memory();
      const results = await Promise.allSettled([
        P.publish({ store: fresh, expected: null, commitId: 'a', writes: [1], manifest: { revision: 1, cloudCommitId: 'a' }, identity }),
        P.publish({ store: fresh, expected: null, commitId: 'b', writes: [2], manifest: { revision: 1, cloudCommitId: 'b' }, identity }),
      ]);
      assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
    } else if (c === 5) {
      await assert.rejects(P.publish({ store, expected: base, commitId: 'bad', writes: [1], manifest: { revision: 2, cloudCommitId: 'bad' }, identity, failChunk: 0 }));
      assert.equal(store.manifest().cloudCommitId, 'old');
    } else if (c === 7) {
      const writes = Array.from({ length: 409 }, (_, i) => ({ i }));
      await assert.rejects(P.publish({ store, expected: base, commitId: 'large', writes, manifest: { revision: 2, cloudCommitId: 'large' }, identity, failChunk: 1 }));
      assert.equal(store.manifest().cloudCommitId, 'old'); assert.equal(store.staged('large').length, 400);
    } else {
      const next = { revision: 2, cloudCommitId: `c${c}` };
      const result = await P.publish({ store, expected: base, commitId: next.cloudCommitId, writes: [{ sector: c }], manifest: next, identity, isCurrent: () => c !== 8 });
      assert.equal(store.visible().length, 1); if (c === 8) assert.equal(result.synced, false);
      await assert.rejects(P.publish({ store, expected: base, commitId: 'loser', writes: [2], manifest: { revision: 2, cloudCommitId: 'loser' }, identity }), (e) => e.code === 'cloud-cas-conflict');
    }
  }
  console.log('cloud concurrency production protocol C0-C8: ok');
})().catch((e) => { console.error(e); process.exit(1); });
