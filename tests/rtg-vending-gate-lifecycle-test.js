'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(reduce=false){
 const animations=[],timers=[],observers=[];
 const classes=()=>{const set=new Set();return {add:(...a)=>a.forEach(x=>set.add(x)),remove:(...a)=>a.forEach(x=>set.delete(x)),contains:x=>set.has(x)};};
 const elements=Array.from({length:10},(_,id)=>({offsetWidth:36,dataset:{capsuleRarity:id%2?'elite':'forte'},classList:classes(),style:{},animate(keyframes,options){
  let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});
  const animation={keyframes,options,finished,resolve,cancel(){this.cancelled=true;reject(Error('cancelled'));},el:this};animations.push(animation);return animation;
 }}));
 const chamber={clientWidth:184,clientHeight:208,querySelectorAll:()=>elements};
 const machine={isConnected:true,parentNode:{},classList:classes(),dataset:{},querySelector:()=>chamber,querySelectorAll:()=>elements};
 const c={Date:{now:()=>1},matchMedia:()=>({matches:reduce}),setTimeout:cb=>timers.push(cb),MutationObserver:class{constructor(cb){this.cb=cb;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/road-to-glory/rtg-vending-motion.js','utf8'),c);
 return {c,animations,timers,observers,machine,elements};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
(async()=>{
 for(const reduced of [false,true]){
  const h=harness(reduced),motion=h.c.RoadToGloryVendingMotion.mount(h.machine);
  assert(motion);const pending=motion.play('elite');assert.equal(motion.play('elite'),pending,'double play shares the same presentation');
  if(!reduced){
   assert.equal(h.animations.length,10);
   const exit=h.animations.reduce((a,b)=>a.options.duration<b.options.duration?a:b);
   assert.equal(exit.el.dataset.capsuleRarity,'elite','the travelling capsule has the committed rarity from the first frame');
   assert(exit.keyframes.length>30,'one continuous collision-resolved trajectory');
   assert.equal(h.elements.filter(e=>e.dataset.capsuleRarity==='elite').length,5,'colour binding preserves the decorative palette');
   exit.resolve();
  }else assert.equal(h.animations.length,0,'reduced-motion creates no animated trajectory');
  assert.equal(await pending,true);motion.stop();assert(h.animations.every(a=>a.cancelled));
 }
 {
  const h=harness(),motion=h.c.RoadToGloryVendingMotion.mount(h.machine),pending=motion.play('elite');
  h.machine.isConnected=false;h.observers[0].cb();
  assert.equal(await pending,false,'closing the modal cancels the pending result sequence');
  assert(h.animations.every(a=>a.cancelled));
 }
 for(const result of ['success','failure','throw','close']){
  const h=harness();let click,pulls=0,opens=0;
  const button={disabled:false,isConnected:true,addEventListener:(_event,cb)=>click=cb};
  const root={querySelectorAll:()=>[],querySelector:s=>s==='[data-rtg-vending-machine]'?h.machine:s==='[data-rtg-pull]'?button:null};
  vm.runInContext(fs.readFileSync('js/road-to-glory/rtg-vending-controller.js','utf8'),h.c);
  const runtime=h.c.RoadToGloryVendingController.create({getCampaign:()=>({tokens:900}),getSeasonDb:()=>({}),activeConfig:()=>({pullCost:300}),activeSeasonId:()=>'orion',accessibleCards:()=>[],gacha:{previewPool:()=>({})},runView:{vendingMarkup:()=>'',pullResultMarkup:()=>''},getModalRoot:()=>root,openModal:()=>{opens++;if(opens>1)h.machine.isConnected=false;},pull:()=>{pulls++;if(result==='throw')throw Error('save failed');return result==='failure'?null:{result:{rarity:'Elite'},player:{category:'Elite'}};}});
  runtime.openVending();const pending=click({currentTarget:button});
  if(result==='throw')await pending.catch(e=>assert.equal(e.message,'save failed'));
  else{
   await click({currentTarget:button});await flush();assert.equal(pulls,1);
   if(result==='success'){
    assert(!h.machine.classList.contains('is-revealing'),'flap cannot open before the capsule clears the hopper');
    h.animations.reduce((a,b)=>a.options.duration<b.options.duration?a:b).resolve();await flush();
    assert(h.machine.classList.contains('is-revealing'),'flap opens after physical delivery');assert.equal(opens,1);
    assert.equal(h.timers.length,1);h.timers.shift()();
   }else if(result==='close'){h.machine.isConnected=false;h.observers[0].cb();}
   else {assert.equal(h.animations.length,0);assert.equal(h.timers.length,0,'failed commit starts no animation or reveal timer');}
   await pending;
  }
  assert.equal(button.disabled,false);assert.equal(opens,result==='success'?2:1);assert(h.animations.every(a=>a.cancelled));
 }
 console.log('rtg-vending-gate lifecycle: PASS (rarity binding, gate/flap ordering, reduced motion, close, failure, double tap)');
})().catch(e=>{console.error(e);process.exitCode=1;});
