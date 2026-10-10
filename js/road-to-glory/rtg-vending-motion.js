(function(global){
  'use strict';
  // Cosmetic only: no player data, RNG, rewards, storage or gameplay timers.
  // Fixed 120 Hz steps keep contacts stable on both 60 Hz and 120 Hz displays.
  function createSimulation({width,height,radius,count,seed=1,hopper=false}){
    const balls=[],diameter=radius*2,columns=Math.floor(width/diameter),clearance=radius*.8;
    let time=0,gateOpen=false,captured=null;
    const direction=seed%2?1:-1,speed=8+(seed%7)*.32;
    for(let row=0,id=0;id<count;row++){
      const n=columns-(row%2),spacing=diameter+.2;
      for(let column=0;column<n&&id<count;column++,id++){
        balls.push({id,x:width/2+(column-(n-1)/2)*spacing,y:height-radius-4-row*diameter*.88,vx:0,vy:0,angle:(id*37)%65-32});
      }
    }
    function walls(b){
      if(b.x<radius){b.x=radius;b.vx=Math.abs(b.vx)*.22;}
      if(b.x>width-radius){b.x=width-radius;b.vx=-Math.abs(b.vx)*.22;}
      if(b.y<radius){b.y=radius;b.vy=Math.abs(b.vy)*.22;}
      const offset=b.x-width/2;
      const floor=hopper?height-radius-12-Math.max(0,Math.abs(offset)-clearance)*.48:height-radius-3-4*Math.abs(offset)/(width/2);
      if(hopper&&gateOpen&&captured===null&&Math.abs(offset)<=clearance&&b.y>=floor-.5)captured=b.id;
      if(b.id===captured){
        if(b.y>height-radius-12){b.x=Math.max(width/2-clearance,Math.min(width/2+clearance,b.x));b.vx*=.9;}
        return;
      }
      if(b.y>floor){
        b.y=floor;
        if(hopper&&Math.abs(offset)>clearance){
          const slope=Math.sign(offset)*.48,normalVelocity=(b.vx*slope+b.vy)/(1+slope*slope);
          if(normalVelocity>0){b.vx-=normalVelocity*slope;b.vy-=normalVelocity;}
        }else if(b.vy>0){b.vy=-b.vy*.12;b.vx*=.94;}
      }
    }
    function step(dt,driven=false){
      dt=Math.min(1/120,Math.max(0,dt));time+=dt;
      // A rotating agitator carries the pile around its axis. Contacts still
      // resolve every step: capsules roll past each other instead of moving as
      // one rigid block, then fall freely once the crank disengages.
      const drive=driven?Math.min(1,time/.08)*Math.min(1,Math.max(0,(.62-time)/.12)):0;
      for(const b of balls){
        // A small eccentric feeder prevents two capsules bridging the throat.
        if(hopper&&gateOpen&&captured===null&&b.y>height-radius*4){
          b.vx+=Math.sin(time*19+seed)*750*dt;
        }
        if(drive>0){
          const dx=b.x-width/2,dy=b.y-height*.55;
          b.vx+=(-dy*(hopper?speed*direction:9)-b.vx)*22*drive*dt;
          b.vy+=(dx*(hopper?speed*direction:9)-b.vy)*22*drive*dt;
        }
        b.vy+=850*dt;
        b.vx*=.996;b.vy*=.998;
        b.x+=b.vx*dt;b.y+=b.vy*dt;
        b.angle+=b.vx*dt/radius*180/Math.PI;
        walls(b);
      }
      for(let iteration=0;iteration<20;iteration++){
        for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
          const a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y;
          const distance=Math.hypot(dx,dy);
          if(distance>=diameter)continue;
          const nx=distance?dx/distance:1,ny=distance?dy/distance:0;
          const correction=(diameter-distance)*.5;
          a.x-=nx*correction;a.y-=ny*correction;b.x+=nx*correction;b.y+=ny*correction;
          const approach=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
          if(approach<0){
            const impulse=-approach*.58;
            a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
            const tangent=(b.vx-a.vx)*-ny+(b.vy-a.vy)*nx;
            a.vx+=-ny*tangent*.035;a.vy+=nx*tangent*.035;
            b.vx-=-ny*tangent*.035;b.vy-=nx*tangent*.035;
          }
        }
        balls.forEach(walls);
      }
    }
    // Place the pile at rest before the modal is painted, not falling on open.
    for(let i=0;i<180;i++)step(1/120);
    time=0;balls.forEach(b=>{b.vx=0;b.vy=0;});
    return {balls,step,begin(){time=0;},openGate(){gateOpen=true;},get captured(){return captured;},remove(id){const index=balls.findIndex(b=>b.id===id);if(index>=0)balls.splice(index,1);}};
  }

  function createCycle(options){
    const simulation=createSimulation({...options,hopper:true}),frames=[];
    const snapshot=time=>frames.push({time,balls:simulation.balls.map(b=>({id:b.id,x:b.x,y:b.y,angle:b.angle}))});
    snapshot(0);
    let duration=0,exitTime=null;
    for(let i=1;i<=420;i++){
      if(i===90)simulation.openGate();
      simulation.step(1/120,i<75);
      duration=i/120*1000;
      if(i%2===0)snapshot(duration);
      const captured=simulation.balls.find(b=>b.id===simulation.captured);
      if(captured&&captured.y>=options.height+options.radius&&exitTime===null)exitTime=duration;
      if(exitTime!==null&&duration>=exitTime+600){if(i%2)snapshot(duration);break;}
    }
    return {frames,duration,exitTime,exitedId:simulation.captured};
  }

  let sequence=0;
  function mount(machine){
    const chamber=machine?.querySelector?.('.rtg-vending-window-v9');
    const elements=Array.from(chamber?.querySelectorAll?.('[data-capsule-rarity]')||[]);
    if(!elements.length||!chamber.clientWidth||!elements[0].animate)return null;
    const width=chamber.clientWidth,height=chamber.clientHeight,radius=elements[0].offsetWidth/2;
    if(!radius||width<radius*4)return null;
    const entropy=new Uint32Array(1);
    global.crypto?.getRandomValues?.(entropy);
    const seed=(entropy[0]||Date.now())+(++sequence);
    const cycle=createCycle({width,height,radius,count:elements.length,seed});
    if(cycle.exitTime===null)return null;
    let animations=[],active=null,observer=null,stopped=false;
    const reduced=()=>global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const transform=b=>`translate3d(${(b.x-radius).toFixed(2)}px,${(b.y-radius).toFixed(2)}px,0) rotate(${b.angle.toFixed(2)}deg)`;
    for(const b of cycle.frames[0].balls){
      const el=elements[b.id];el.style.left='0px';el.style.top='0px';el.style.bottom='auto';el.style.transform=transform(b);
    }
    function play(rarity){
      if(active)return active;
      stopped=false;
      const selected=elements[cycle.exitedId];
      // The reward is already committed. Bind its cosmetic colour BEFORE the
      // crank moves, never recolour a travelling capsule or change the reward.
      const matching=elements.find(el=>el.dataset.capsuleRarity===rarity);
      if(matching)matching.dataset.capsuleRarity=selected.dataset.capsuleRarity;
      selected.dataset.capsuleRarity=rarity;
      machine.style?.setProperty?.('--rtg-gate-duration',`${Math.max(150,cycle.exitTime-750)}ms`);
      machine.classList.add('is-turning');
      if(reduced()){
        selected.style.opacity='0';
        active=Promise.resolve(machine.isConnected);return active;
      }
      animations=elements.map((el,id)=>{
        const duration=id===cycle.exitedId?cycle.exitTime:cycle.duration;
        const frames=cycle.frames.filter(frame=>frame.time<=duration);
        const keyframes=frames.map(frame=>({offset:frame.time/duration,transform:transform(frame.balls[id])}));
        if(keyframes.at(-1).offset<1)keyframes.push({...keyframes.at(-1),offset:1});
        const animation=el.animate(keyframes,{duration,easing:'linear',fill:'forwards'});
        animation.finished.catch(()=>{});return animation;
      });
      if(global.MutationObserver&&machine.parentNode){
        observer=new global.MutationObserver(()=>{if(!machine.isConnected)stop();});
        observer.observe(machine.parentNode,{childList:true,subtree:true});
      }
      active=animations[cycle.exitedId].finished.then(()=>!stopped&&machine.isConnected,()=>false);
      return active;
    }
    function stop(){
      stopped=true;observer?.disconnect();observer=null;
      animations.forEach(animation=>animation.cancel());animations=[];active=null;
    }
    machine.classList.add('has-capsule-physics');
    return Object.freeze({play,stop});
  }
  global.RoadToGloryVendingMotion=Object.freeze({createSimulation,createCycle,mount});
})(globalThis);
