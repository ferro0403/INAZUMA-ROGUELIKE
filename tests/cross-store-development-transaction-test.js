const assert=require('assert'),fs=require('fs'),vm=require('vm'); const s={console,structuredClone};s.globalThis=s;vm.runInNewContext(fs.readFileSync('js/permanent-effects.js','utf8'),s);
assert.throws(()=>s.PermanentEffects.enqueueDevelopment({runId:'r',seasonId:'ie1',phase:'map'},{endReason:'gameover'}),/terminal proof/i);
const run={runId:'r',seasonId:'ie1',phase:'gameover',gameOver:true,permanentEffectOutbox:[]};s.PermanentEffects.enqueueDevelopment(run,{endReason:'gameover',defeatedBosses:2});
let fail=true,payout=0,redeemed=[];const dev={processRunEnd({runId}){if(fail)throw Error('dev');if(!redeemed.includes(runId)){redeemed.push(runId);payout++}return{state:{redeemedRunIds:redeemed},awarded:payout===1}},read(){return{redeemedRunIds:redeemed}}};
let r=s.PermanentEffects.drain(run,{apis:{DevelopmentV2:dev},save(){}});assert(r.error);assert.strictEqual(payout,0);assert.strictEqual(run.permanentEffectOutbox[0].status,'pending');
fail=false;r=s.PermanentEffects.drain(run,{apis:{DevelopmentV2:dev},save(){throw Error('marker')}});assert(r.error);assert.strictEqual(payout,1);
const fresh=JSON.parse(JSON.stringify(run));fresh.permanentEffectOutbox[0].status='pending';s.PermanentEffects.drain(fresh,{apis:{DevelopmentV2:dev},save(){}});assert.strictEqual(payout,1);assert.strictEqual(fresh.permanentEffectOutbox[0].status,'applied');
console.log('cross-store development transaction tests passed');
