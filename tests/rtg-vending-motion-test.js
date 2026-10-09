'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={};vm.createContext(context);
const file='js/road-to-glory/rtg-vending-motion.js';
if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),context);
assert(context.RoadToGloryVendingMotion,'visual capsule physics must be available');
const {createSimulation}=context.RoadToGloryVendingMotion;
for(const [width,height,radius] of [[184,156,18],[200,174,19.5]]){
 const s=createSimulation({width,height,radius,count:14});
 const before=s.balls.map(b=>({...b}));
 const peak=before.map(()=>0),sideways=before.map(()=>0);
 let travel=0;
 for(let i=0;i<200;i++){
  s.step(1/120,i<74);
  if(i<74)s.balls.forEach((b,j)=>{peak[j]=Math.max(peak[j],Math.hypot(b.x-before[j].x,b.y-before[j].y));sideways[j]=Math.max(sideways[j],Math.abs(b.x-before[j].x));});
  for(const b of s.balls){
   assert(Number.isFinite(b.x+b.y+b.angle));
   assert(b.x>=radius-.1 && b.x<=width-radius+.1,'capsules stay behind glass side walls');
   assert(b.y>=radius-.1 && b.y<=height-radius+.1,'gravity cannot push through cabinet');
  }
  for(let a=0;a<s.balls.length;a++)for(let b=a+1;b<s.balls.length;b++){
   const x=s.balls[a],y=s.balls[b];
   assert(Math.hypot(x.x-y.x,x.y-y.y)>=radius*2-1,'capsules must collide, not pass through one another');
  }
  if(i===60)travel=s.balls.reduce((sum,b,j)=>sum+Math.hypot(b.x-before[j].x,b.y-before[j].y),0);
 }
 assert(travel>50,'crank transfers visible movement into the pile');
 assert(peak.filter(distance=>distance>radius*2).length>=10,'at least ten capsules visibly tumble by more than their diameter during the crank');
 assert(sideways.filter(distance=>distance>radius*2).length>=6,'mixing exchanges positions across the pile, not just a vertical bounce');
 for(let i=0;i<300;i++)s.step(1/120,false);
 assert(s.balls.every(b=>Math.hypot(b.vx,b.vy)<8),'pile settles after the crank stops');
 const lowest=s.balls.reduce((a,b)=>a.y>b.y?a:b);
 s.remove(lowest.id);
 assert.equal(s.balls.length,13,'only the dispensed capsule leaves the pile');
 for(let i=0;i<120;i++)s.step(1/120,false);
 assert(s.balls.every(b=>Number.isFinite(b.y)));
}
const a=createSimulation({width:184,height:156,radius:18,count:14}),b=createSimulation({width:184,height:156,radius:18,count:14});
for(let i=0;i<90;i++){a.step(1/120,true);b.step(1/120,true);}
assert.deepEqual(a.balls,b.balls,'cosmetic physics never needs gameplay RNG');
console.log('rtg-vending-motion-test: PASS (walls, collisions, gravity, settle, removal, determinism)');

// Browser lifecycle boundary: fake only DOM/scheduler, execute the real motion module.
function harness(reduce=false){
 const frames=new Map(),timers=[];let next=0;
 const classes=()=>{const values=new Set();return {add:(...a)=>a.forEach(x=>values.add(x)),remove:(...a)=>a.forEach(x=>values.delete(x)),contains:x=>values.has(x)};};
 const elements=Array.from({length:14},(_,id)=>({offsetWidth:36,dataset:{capsuleRarity:id%2?'elite':'forte'},classList:classes(),style:{setProperty(k,v){this[k]=v;}}}));
 const chamber={clientWidth:184,clientHeight:156,querySelectorAll:()=>elements};
 const machine={isConnected:true,classList:classes(),dataset:{},querySelector:()=>chamber,querySelectorAll:()=>elements};
 const c={requestAnimationFrame:cb=>{const id=++next;frames.set(id,cb);return id;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:reduce}),setTimeout:cb=>timers.push(cb)};
 vm.createContext(c);vm.runInContext(fs.readFileSync(file,'utf8'),c);
 return {c,frames,timers,machine,elements};
}
for(const reduced of [false,true]){
 const h=harness(reduced),motion=h.c.RoadToGloryVendingMotion.mount(h.machine);
 motion.start();motion.start();assert.equal(h.frames.size,reduced?0:1,'double start cannot leak animation loops');
 const chosen=motion.select(h.elements.filter(e=>e.dataset.capsuleRarity==='elite'));
 assert.equal(chosen.dataset.capsuleRarity,'elite','visible selected capsule matches committed rarity');
 motion.release(chosen);assert(chosen.style['--feed-x'],'feed begins at the current physical pose');
 motion.stop();assert.equal(h.frames.size,0,'success/failure cleanup cancels frames');
 motion.start();motion.stop();assert.equal(h.frames.size,0,'retry supports clean start and stop');
}
{
 const h=harness(),motion=h.c.RoadToGloryVendingMotion.mount(h.machine);motion.start();h.machine.isConnected=false;
 const [id,tick]=h.frames.entries().next().value;h.frames.delete(id);tick(100);
 assert.equal(h.frames.size,0,'closing/replacing the modal stops animation without another frame');
}
(async()=>{
 for(const result of ['success','failure','throw']){
  const h=harness();let click,pulls=0,opens=0;
  const button={disabled:false,isConnected:true,addEventListener:(_event,cb)=>click=cb};
  const root={querySelectorAll:()=>[],querySelector:selector=>selector==='[data-rtg-vending-machine]'?h.machine:selector==='[data-rtg-pull]'?button:null};
  vm.runInContext(fs.readFileSync('js/road-to-glory/rtg-vending-controller.js','utf8'),h.c);
  const runtime=h.c.RoadToGloryVendingController.create({
   getCampaign:()=>({tokens:900}),getSeasonDb:()=>({}),activeConfig:()=>({pullCost:300}),activeSeasonId:()=>'orion',accessibleCards:()=>[],
   gacha:{previewPool:()=>({})},runView:{vendingMarkup:()=>'',pullResultMarkup:()=>''},getModalRoot:()=>root,
   openModal:()=>{opens++;if(opens>1)h.machine.isConnected=false;},
   pull:()=>{pulls++;if(result==='throw')throw Error('save failed');return result==='success'?{result:{rarity:'Elite'},player:{category:'Elite'}}:null;}
  });
  runtime.openVending();const pending=click({currentTarget:button});if(result!=='throw')await click({currentTarget:button});
  // A synchronous failure has already unlocked the button; test a single failure attempt.
  if(result==='throw'){
   await pending.catch(error=>assert.equal(error.message,'save failed'));
  }else{
   assert.equal(pulls,1,'double tap creates only one extraction');
   h.timers.shift()();await Promise.resolve();await Promise.resolve();
   if(result==='success'){
    assert.equal(opens,1,'no result modal before existing reveal delay');
    assert.equal(h.machine.dataset.pullRarity,'elite');
    h.timers.shift()();
   }
   await pending;
  }
  assert.equal(h.frames.size,0,'no presentation loop survives result/failure');
  assert.equal(button.disabled,false);
  assert.equal(opens,result==='success'?2:1,'save failure never shows a prize');
 }
 console.log('rtg-vending-motion lifecycle: PASS (reduced motion, teardown, double tap, failure, reveal boundary)');
})().catch(error=>{console.error(error);process.exitCode=1;});
