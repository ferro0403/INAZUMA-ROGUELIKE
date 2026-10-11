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
// Compositor playback and controller lifecycle are exercised by rtg-vending-gate-lifecycle-test.js.
