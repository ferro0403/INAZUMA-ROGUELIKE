const assert = require('assert'), fs = require('fs'), vm = require('vm');
function runtime() { const sandbox = { console, structuredClone, AlbumProgress: {}, DevelopmentV2: {}, HallOfFameStorage: {} }; sandbox.globalThis=sandbox; vm.runInNewContext(fs.readFileSync('js/permanent-effects.js','utf8'),sandbox); return sandbox; }
const g=runtime(), album=new Set(), run={runId:'run-a',seasonId:'ie1',phase:'squad',roster:[],permanentEffectOutbox:[]};
const acquire=()=>{run.roster.push({playerId:'mark'});g.PermanentEffects.enqueueAlbum(run,{playerId:'mark',source:'recruit',actionId:'action-1'});};
assert.throws(()=>{acquire();throw Error('run-save');}); assert.strictEqual(album.size,0,'Run failure cannot write Album');
let failAlbum=true,saves=0; const apis={AlbumProgress:{unlockAlbumPlayer(c,id){if(failAlbum)throw Error('album');album.add(`${c}:${id}`);return true;}},DevelopmentV2:{},HallOfFameStorage:{}};
let result=g.PermanentEffects.drain(run,{apis,save(){saves++;}}); assert(result.error); assert.strictEqual(run.permanentEffectOutbox[0].status,'pending');
failAlbum=false; result=g.PermanentEffects.drain(run,{apis,save(){saves++;}}); assert.deepStrictEqual([...album],['ie1:mark']); assert.strictEqual(run.permanentEffectOutbox[0].status,'applied');
const copy=JSON.parse(JSON.stringify(run)); copy.permanentEffectOutbox[0].status='pending'; g.PermanentEffects.drain(copy,{apis,save(){}}); assert.strictEqual(album.size,1,'stable retry is set-idempotent');
const draft={runId:'draft',seasonId:'ie1',permanentEffectOutbox:[]}; ['a','b','c'].forEach(id=>g.PermanentEffects.enqueueAlbum(draft,{playerId:id,source:'initial_draft',actionId:`draft:${id}`})); assert.strictEqual(new Set(draft.permanentEffectOutbox.map(x=>x.id)).size,3); g.PermanentEffects.enqueueAlbum(draft,{playerId:'a',source:'initial_draft',actionId:'draft:a'}); assert.strictEqual(draft.permanentEffectOutbox.length,3);
console.log('cross-store album transaction tests passed');
