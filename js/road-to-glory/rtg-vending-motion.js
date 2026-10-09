(function(global){
  'use strict';
  // Cosmetic only: no player data, RNG, rewards, storage or gameplay timers.
  // Fixed 120 Hz steps keep contacts stable on both 60 Hz and 120 Hz displays.
  function createSimulation({width,height,radius,count}){
    const balls=[],diameter=radius*2,columns=Math.floor(width/diameter);
    let time=0;
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
      const floor=height-radius-3-4*Math.abs(b.x-width/2)/(width/2);
      if(b.y>floor){b.y=floor;if(b.vy>0){b.vy=-b.vy*.12;b.vx*=.94;}}
    }
    function step(dt,driven=false){
      dt=Math.min(1/120,Math.max(0,dt));time+=dt;
      // A rotating agitator carries the pile around its axis. Contacts still
      // resolve every step: capsules roll past each other instead of moving as
      // one rigid block, then fall freely once the crank disengages.
      const drive=driven?Math.min(1,time/.08)*Math.min(1,Math.max(0,(.62-time)/.12)):0;
      for(const b of balls){
        if(drive>0){
          const dx=b.x-width/2,dy=b.y-height*.55;
          b.vx+=(-dy*9-b.vx)*22*drive*dt;
          b.vy+=(dx*9-b.vy)*22*drive*dt;
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
    return {balls,step,begin(){time=0;},remove(id){const index=balls.findIndex(b=>b.id===id);if(index>=0)balls.splice(index,1);}};
  }

  function mount(machine){
    const chamber=machine?.querySelector?.('.rtg-vending-window-v9');
    const elements=Array.from(chamber?.querySelectorAll?.('[data-capsule-rarity]')||[]);
    if(!elements.length||!chamber.clientWidth||!global.requestAnimationFrame)return null;
    const width=chamber.clientWidth,height=chamber.clientHeight,radius=elements[0].offsetWidth/2;
    if(!radius||width<radius*4)return null;
    const simulation=createSimulation({width,height,radius,count:elements.length});
    let frame=null,last=0,elapsed=0,accumulator=0,started=false,feeding=false;
    const reduced=()=>global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const positions=new Map();
    function render(){
      for(const b of simulation.balls){
        const el=elements[b.id];positions.set(el,b);
        el.style.left='0px';el.style.top='0px';el.style.bottom='auto';
        el.style.transform=`translate3d(${(b.x-radius).toFixed(2)}px,${(b.y-radius).toFixed(2)}px,0) rotate(${b.angle.toFixed(2)}deg)`;
      }
    }
    function cancel(){if(frame!==null)global.cancelAnimationFrame(frame);frame=null;}
    function tick(now){
      frame=null;
      if(!machine.isConnected||reduced()){stop();return;}
      const delta=last?Math.min((now-last)/1000,.05):0;last=now;
      elapsed+=delta;accumulator+=delta;
      while(accumulator>=1/120){simulation.step(1/120,!feeding&&elapsed<.62);accumulator-=1/120;}
      render();
      if(elapsed<1.65)frame=global.requestAnimationFrame(tick);
    }
    function start(){
      if(started)return;
      started=true;feeding=false;last=0;elapsed=0;accumulator=0;simulation.begin();
      if(!reduced())frame=global.requestAnimationFrame(tick);
    }
    function select(choices){
      return choices.reduce((best,el)=>{
        const score=c=>{const b=positions.get(c);return b?height-b.y+Math.abs(b.x-width/2)*.3:Infinity;};
        return !best||score(el)<score(best)?el:best;
      },null);
    }
    function release(el){
      const b=positions.get(el);if(!b)return;
      feeding=true;
      el.style.setProperty('--feed-x',`${b.x-radius}px`);
      el.style.setProperty('--feed-y',`${b.y-radius}px`);
      el.style.setProperty('--feed-angle',`${b.angle}deg`);
      el.style.setProperty('--outlet-x',`${width/2-radius}px`);
      el.style.setProperty('--outlet-y',`${height-radius}px`);
      simulation.remove(b.id);
      // Other capsules keep falling into the gap instead of freezing in mid-air.
      if(frame===null&&!reduced()){last=0;elapsed=.62;frame=global.requestAnimationFrame(tick);}
    }
    function stop(){
      cancel();started=false;
      if(machine.isConnected){for(let i=0;i<120;i++)simulation.step(1/120);render();}
    }
    machine.classList.add('has-capsule-physics');render();
    return Object.freeze({start,select,release,stop});
  }
  global.RoadToGloryVendingMotion=Object.freeze({createSimulation,mount});
})(globalThis);
