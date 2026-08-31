'use strict';
const assert = require('assert');
const fs = require('fs');
const P = require('../js/cloud-restore-protocol');
const source = fs.readFileSync('js/firebase-cloud-save.js', 'utf8');
assert.match(source, /InazumaCloudRestoreProtocol\.recover\(/);
for (const forbidden of ['applyRun', 'readRun', 'runGeneration', 'forceReplaceCanonicalFromSnapshot', 'forceDeleteForRestore', 'RunStorage']) assert.ok(!source.includes(forbidden), `Firebase restore must not reference ${forbidden}`);
assert.deepStrictEqual(P.STAGES, ['profile', 'album', 'development', 'hall', 'verify', 'metadata', 'complete']);
let applies = 0;
const journal = P.createJournal({ operationId: 'o', uid: 'u', targetCloudRevision: 1, targetCloudCommitId: 'c', targetManifestIdentity: 'i', sourceLocalEpoch: 0, expectedLocalEpoch: 0, startedAt: 'n', sourceRunProvenance: { ie1: { generation: 9 } }, targetRunHashes: { ie1: 'legacy' } });
assert.ok(!Object.hasOwn(journal, 'runProgress'));
assert.ok(!Object.hasOwn(journal, 'sourceRunProvenance'));
(async () => {
  const result = await P.recover({ journal, loadTarget: async () => ({ snapshot: { profile: {}, runs: { ie1: { legacy: true } }, album: {}, development: {}, hallOfFame: {} }, manifest: { revision: 1 } }), writeJournal: x => x, clearJournal() {}, adapters: { assertOwnership() {}, storeEquals: () => false, applyStore() { applies++; }, verify: () => true, writeMetadata() {} } });
  assert.equal(result.status, 'restored');
  assert.equal(applies, 4, 'only permanent stores are restored');
  console.log('firebase restore is account-permanent only: ok');
})().catch(e => { console.error(e); process.exit(1); });
