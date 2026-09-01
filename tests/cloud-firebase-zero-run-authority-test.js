'use strict';
const assert=require('assert'),fs=require('fs');
const files=['js/firebase-cloud-save.js','js/cloud-save-core.js','js/cloud-restore-protocol.js'];
const stripComments=source=>source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:])\/\/.*$/gm,'$1');
const forbidden=[/\bRunState\s*\.\s*(?:load|save|remove)\s*\(/,/\bRunStorage\s*\.\s*(?:save|remove|forceReplaceCanonicalFromSnapshot|forceDeleteForRestore|diagnostics)\s*\(/,/\b(?:applyRun|readRun|runGeneration)\s*[:(]/];
for(const file of files){const executable=stripComments(fs.readFileSync(file,'utf8'));for(const pattern of forbidden)assert.doesNotMatch(executable,pattern,`${file} contains active run authority ${pattern}`);}
const core=require('../js/cloud-save-core'),restore=require('../js/cloud-restore-protocol');assert.deepStrictEqual(core.SECTOR_NAMES,['profile','album','development','hall_index']);assert.deepStrictEqual(restore.STAGES,['profile','album','development','hall','verify','metadata','complete']);
console.log('Firebase production wiring has zero RunStorage authority: ok');
