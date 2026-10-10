'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c={};vm.createContext(c);vm.runInContext(fs.readFileSync('js/road-to-glory/rtg-vending-motion.js','utf8'),c);
assert.equal(typeof c.RoadToGloryVendingMotion.createCycle,'function','the exit must be planned with the same collision simulation as the mixing');
const {createCycle}=c.RoadToGloryVendingMotion;
for(const [width,height,radius] of [[184,208,18],[200,226,19.5]])for(let seed=1;seed<=30;seed++){
 const cycle=createCycle({width,height,radius,count:10,seed});
 assert(cycle.exitedId!==null,'exactly one capsule reaches the gate');
 assert(cycle.duration<4000,'gate must not leave the presentation hanging');
 for(const frame of cycle.frames){
  const balls=frame.balls;
  for(let i=0;i<balls.length;i++){
   const b=balls[i];
   if(b.y>height-radius-12)assert.equal(b.id,cycle.exitedId,'only the captured capsule can pass the gate');
   for(let j=i+1;j<balls.length;j++)assert(Math.hypot(b.x-balls[j].x,b.y-balls[j].y)>=radius*2-1,'exit capsule continues colliding, not crossing the pile');
  }
 }
 const last=cycle.frames.at(-1).balls.find(b=>b.id===cycle.exitedId);
 assert(last.y>=height+radius,'capsule disappears only after entering the concealed chute');
}
const options={width:184,height:208,radius:18,count:10};
assert.notDeepEqual(createCycle({...options,seed:1}).frames,createCycle({...options,seed:2}).frames,'cosmetic seeds create different mixes');
assert.deepEqual(createCycle({...options,seed:1}).frames,createCycle({...options,seed:1}).frames,'fixed cosmetic seed is reproducible without gameplay RNG');
console.log('rtg-vending-gate: PASS (60 cycles, continuous contacts, single gate, varied mixing)');
