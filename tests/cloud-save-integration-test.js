'use strict';
const assert=require('assert'),fs=require('fs');
const cloud=fs.readFileSync('js/firebase-cloud-save.js','utf8'),html=fs.readFileSync('index.html','utf8');
const order=['persistence-recovery-guard.js','restore-gameplay-routing-gate.js','cloud-save-core.js','cloud-sync-protocol.js','cloud-metadata-protocol.js','cloud-restore-protocol.js','firebase-cloud-save.js'].map(x=>html.indexOf(x));
assert(order.every((x,i)=>x>=0&&(i===0||x>order[i-1])));
for(const token of ['runTransaction','saveCommits','targetCloudCommitId','InazumaCloudRestoreProtocol.recover','restoreProfile','AlbumProgress.write','DevelopmentV2.write','_saveArchive','token !== generation'])assert(cloud.includes(token),token);
for(const forbidden of ['forceReplaceCanonicalFromSnapshot','forceDeleteForRestore','RunStorage','RunState.load('])assert.ok(!cloud.includes(forbidden),forbidden);
assert.match(cloud,/domain === "run"/);
console.log('cloud-save-integration-test: Firebase is wired only to permanent account stores');
