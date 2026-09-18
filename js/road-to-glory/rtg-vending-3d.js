(function(global){
  "use strict";

  const THREE_URL="https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js";
  const instances=new WeakMap();
  let threePromise=null;

  function loadThree(){
    if(!threePromise){
      threePromise=import(THREE_URL).catch((error)=>{
        threePromise=null;
        throw error;
      });
    }
    return threePromise;
  }

  function canvasTexture(THREE,text,{width=512,height=160,bg="#111216",fg="#ffd21f",sub="",subColor="#ffffff"}={}){
    const canvas=document.createElement("canvas");
    canvas.width=width; canvas.height=height;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle=bg; ctx.fillRect(0,0,width,height);
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillStyle=subColor;
    ctx.font="900 34px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    if(sub)ctx.fillText(sub.toUpperCase(),width/2,height*.30);
    ctx.fillStyle=fg;
    ctx.font="1000 64px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(String(text).toUpperCase(),width/2,sub?height*.68:height*.52);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;
    return texture;
  }

  function addBox(THREE,parent,size,position,material,rotation=[0,0,0]){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow=true;
    mesh.receiveShadow=true;
    parent.add(mesh);
    return mesh;
  }

  function addCapsule(THREE,parent,position,rotation,colorA,colorB,scale=1){
    const group=new THREE.Group();
    const topMat=new THREE.MeshStandardMaterial({color:colorA,roughness:.34,metalness:.03});
    const bottomMat=new THREE.MeshStandardMaterial({color:colorB,roughness:.4,metalness:.02});
    const edgeMat=new THREE.MeshStandardMaterial({color:0x111216,roughness:.48,metalness:.1});
    const top=new THREE.Mesh(new THREE.SphereGeometry(.19,20,12,0,Math.PI*2,0,Math.PI/2),topMat);
    const bottom=new THREE.Mesh(new THREE.SphereGeometry(.19,20,12,0,Math.PI*2,Math.PI/2,Math.PI/2),bottomMat);
    const seam=new THREE.Mesh(new THREE.TorusGeometry(.19,.018,8,28),edgeMat);
    seam.rotation.x=Math.PI/2;
    group.add(top,bottom,seam);
    group.position.set(...position);
    group.rotation.set(...rotation);
    group.scale.setScalar(scale);
    group.traverse((obj)=>{if(obj.isMesh)obj.castShadow=true;});
    parent.add(group);
    return group;
  }

  function createMachine(THREE){
    const group=new THREE.Group();
    const yellow=new THREE.MeshStandardMaterial({color:0xffd21f,roughness:.28,metalness:.12});
    const yellowDark=new THREE.MeshStandardMaterial({color:0xc89210,roughness:.42,metalness:.15});
    const ink=new THREE.MeshStandardMaterial({color:0x111216,roughness:.34,metalness:.18});
    const metal=new THREE.MeshStandardMaterial({color:0xaeb3b7,roughness:.22,metalness:.72});
    const white=new THREE.MeshStandardMaterial({color:0xfffcf1,roughness:.45,metalness:.02});
    const glass=new THREE.MeshPhysicalMaterial({
      color:0xe9fbff,
      transparent:true,
      opacity:.20,
      roughness:.08,
      metalness:0,
      transmission:.32,
      thickness:.2,
      depthWrite:false,
      side:THREE.DoubleSide
    });

    // Rear chassis and lower cabinet.
    addBox(THREE,group,[2.25,3.55,.76],[0,.05,-.24],ink);
    addBox(THREE,group,[2.05,1.62,1.08],[0,-1.05,.08],yellow);
    addBox(THREE,group,[1.94,1.28,1.17],[0,-1.12,.13],yellowDark);

    // Top brand cap.
    addBox(THREE,group,[2.04,.48,1.02],[0,1.58,.04],ink);
    const brandTexture=canvasTexture(THREE,"RTG",{width:640,height:180,bg:"#111216",fg:"#ffd21f",sub:"INAZUMA",subColor:"#ffffff"});
    const brand=new THREE.Mesh(
      new THREE.PlaneGeometry(1.62,.44),
      new THREE.MeshBasicMaterial({map:brandTexture,transparent:false})
    );
    brand.position.set(0,1.59,.57);
    group.add(brand);

    // Capsule globe and back plate.
    const back=new THREE.Mesh(new THREE.CircleGeometry(1.02,48),new THREE.MeshStandardMaterial({color:0xf5efd1,roughness:.55}));
    back.scale.set(1,1.08,1);
    back.position.set(0,.55,-.02);
    group.add(back);

    const capsuleGroup=new THREE.Group();
    capsuleGroup.position.z=.18;
    group.add(capsuleGroup);
    const capsuleData=[
      [-.58,.78,.13,.2,0xffffff,0x111216,.95],
      [.45,.96,.06,-.4,0xffffff,0x111216,.92],
      [-.62,.32,.13,.8,0xffffff,0xffd21f,.92],
      [-.14,.28,.20,-.3,0x111216,0xffd21f,1.03],
      [.45,.34,.14,.5,0xffffff,0xffd21f,.96],
      [-.48,-.10,.16,-.5,0xfffdf4,0xffd21f,.90],
      [.02,-.18,.18,.1,0xffffff,0x111216,.94],
      [.52,-.10,.12,-.4,0xffffff,0xffd21f,.90]
    ];
    const capsules=capsuleData.map(([x,y,z,r,a,b,s])=>addCapsule(THREE,capsuleGroup,[x,y,z],[0,r,r*.45],a,b,s));

    const globe=new THREE.Mesh(new THREE.SphereGeometry(1.08,48,36),glass);
    globe.scale.set(1,1.07,.55);
    globe.position.set(0,.54,.31);
    globe.renderOrder=8;
    group.add(globe);

    // Globe rim to sell depth.
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1.075,.045,12,64),ink);
    rim.scale.y=1.07;
    rim.position.set(0,.54,.61);
    group.add(rim);

    // Front control panel.
    addBox(THREE,group,[1.72,.82,.16],[0,-.94,.69],ink);
    addBox(THREE,group,[.78,.48,.08],[-.43,-.92,.80],white);
    const priceTexture=canvasTexture(THREE,"300 ◈",{width:500,height:240,bg:"#fffdf4",fg:"#111216",sub:"1 PALLINA",subColor:"#111216"});
    const priceLabel=new THREE.Mesh(new THREE.PlaneGeometry(.70,.40),new THREE.MeshBasicMaterial({map:priceTexture}));
    priceLabel.position.set(-.43,-.92,.855);
    group.add(priceLabel);

    // Metal crank.
    const knobGroup=new THREE.Group();
    knobGroup.position.set(.52,-.92,.83);
    const outer=new THREE.Mesh(new THREE.CylinderGeometry(.30,.30,.12,40),metal);
    outer.rotation.x=Math.PI/2;
    knobGroup.add(outer);
    const inner=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.135,40),yellow);
    inner.rotation.x=Math.PI/2; inner.position.z=.02;
    knobGroup.add(inner);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.16,24),ink);
    hub.rotation.x=Math.PI/2; hub.position.z=.04;
    knobGroup.add(hub);
    const handle=addBox(THREE,knobGroup,[.08,.34,.09],[.0,.18,.10],ink,[0,0,.48]);
    handle.castShadow=true;
    group.add(knobGroup);

    // Prize chute.
    addBox(THREE,group,[1.22,.32,.12],[0,-1.48,.73],ink);
    const chuteInner=addBox(THREE,group,[.88,.13,.05],[0,-1.48,.80],yellow);
    chuteInner.castShadow=false;

    // Feet.
    addBox(THREE,group,[.48,.14,.72],[-.63,-1.93,.02],ink);
    addBox(THREE,group,[.48,.14,.72],[.63,-1.93,.02],ink);

    // Decorative side bevel strips.
    addBox(THREE,group,[.10,1.45,.05],[-1.01,-1.07,.65],ink,[0,0,-.04]);
    addBox(THREE,group,[.10,1.45,.05],[1.01,-1.07,.65],ink,[0,0,.04]);

    group.rotation.y=-.10;
    group.rotation.x=-.015;
    return {group,capsuleGroup,capsules,knobGroup};
  }

  async function init(host){
    if(!host || instances.has(host))return instances.get(host);
    host.classList.add("is-3d-loading");
    const THREE=await loadThree();
    if(!host.isConnected)return null;

    const width=Math.max(220,host.clientWidth||300);
    const height=Math.max(320,host.clientHeight||420);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(global.devicePixelRatio||1,1.75));
    renderer.setSize(width,height,false);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.domElement.className="rtg-vending-3d-canvas";
    renderer.domElement.setAttribute("aria-hidden","true");

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(31,width/height,.1,100);
    camera.position.set(0,.16,6.4);
    camera.lookAt(0,-.05,0);

    scene.add(new THREE.HemisphereLight(0xffffff,0x51430d,2.4));
    const key=new THREE.DirectionalLight(0xffffff,4.0);
    key.position.set(3.4,5.6,5.2); key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);
    scene.add(key);
    const warm=new THREE.PointLight(0xffd21f,18,8,2);
    warm.position.set(-2.4,.2,3.2);
    scene.add(warm);
    const fill=new THREE.PointLight(0xb7dcff,11,7,2);
    fill.position.set(2.2,2.3,2.8);
    scene.add(fill);

    const built=createMachine(THREE);
    const machine=built.group;
    machine.position.y=.1;
    scene.add(machine);

    const shadow=new THREE.Mesh(
      new THREE.CircleGeometry(1.65,48),
      new THREE.MeshBasicMaterial({color:0x111216,transparent:true,opacity:.14,depthWrite:false})
    );
    shadow.scale.set(1,.28,1);
    shadow.position.set(0,-2.02,-.05);
    scene.add(shadow);

    host.prepend(renderer.domElement);

    const state={
      THREE,renderer,scene,camera,machine,
      capsules:built.capsules,capsuleGroup:built.capsuleGroup,knobGroup:built.knobGroup,
      spinStart:0,spinDuration:0,spinResolve:null,
      pointerX:null,targetRotY:-.10,userRotY:-.10,
      startTime:performance.now(),raf:0,resizeObserver:null
    };
    instances.set(host,state);
    host.classList.remove("is-3d-loading");
    host.classList.add("is-3d-ready");

    function resize(){
      if(!host.isConnected)return;
      const w=Math.max(220,host.clientWidth||300);
      const h=Math.max(320,host.clientHeight||420);
      renderer.setSize(w,h,false);
      camera.aspect=w/h;
      camera.updateProjectionMatrix();
    }
    const ro=new ResizeObserver(resize);
    ro.observe(host); state.resizeObserver=ro;

    host.addEventListener("pointerdown",(event)=>{
      state.pointerX=event.clientX;
      host.setPointerCapture?.(event.pointerId);
      host.classList.add("is-dragging");
    });
    host.addEventListener("pointermove",(event)=>{
      if(state.pointerX==null)return;
      const dx=event.clientX-state.pointerX;
      state.pointerX=event.clientX;
      state.targetRotY=Math.max(-.42,Math.min(.32,state.targetRotY+dx*.006));
    });
    const endPointer=()=>{
      state.pointerX=null;
      host.classList.remove("is-dragging");
      state.targetRotY=-.10;
    };
    host.addEventListener("pointerup",endPointer);
    host.addEventListener("pointercancel",endPointer);

    function animate(now){
      if(!host.isConnected){
        cancelAnimationFrame(state.raf);
        ro.disconnect();
        renderer.dispose();
        instances.delete(host);
        return;
      }
      const elapsed=(now-state.startTime)/1000;
      const idle=Math.sin(elapsed*.75)*.025;
      state.userRotY+=(state.targetRotY-state.userRotY)*.08;
      machine.rotation.y=state.userRotY+idle;
      machine.position.y=.10+Math.sin(elapsed*1.15)*.018;

      built.capsules.forEach((capsule,index)=>{
        capsule.rotation.z+=Math.sin(elapsed*1.3+index)*.0016;
      });

      if(state.spinStart&&state.spinDuration){
        const p=Math.min(1,(now-state.spinStart)/state.spinDuration);
        const ease=1-Math.pow(1-p,3);
        built.knobGroup.rotation.z=ease*Math.PI*2.35;
        built.capsuleGroup.rotation.z=Math.sin(p*Math.PI*8)*(1-p)*.12;
        built.capsules.forEach((capsule,index)=>{
          capsule.position.y+=Math.sin(p*Math.PI*10+index)*.0045*(1-p);
        });
        machine.rotation.z=Math.sin(p*Math.PI*10)*(1-p)*.014;
        if(p>=1){
          state.spinStart=0; state.spinDuration=0;
          machine.rotation.z=0;
          built.knobGroup.rotation.z=0;
          const resolve=state.spinResolve; state.spinResolve=null;
          resolve?.();
        }
      }
      renderer.render(scene,camera);
      state.raf=requestAnimationFrame(animate);
    }
    state.raf=requestAnimationFrame(animate);
    return state;
  }

  function mount(root=document){
    const host=root?.querySelector?.("[data-rtg-vending-3d]") || (root?.matches?.("[data-rtg-vending-3d]")?root:null);
    if(!host)return Promise.resolve(null);
    if(instances.has(host))return Promise.resolve(instances.get(host));
    return init(host).catch((error)=>{
      console.warn("[RTG] 3D vending unavailable, using CSS fallback.",error);
      host.classList.remove("is-3d-loading");
      host.classList.add("is-3d-failed");
      return null;
    });
  }

  async function spin(root=document){
    const host=root?.querySelector?.("[data-rtg-vending-3d]") || (root?.matches?.("[data-rtg-vending-3d]")?root:null);
    if(!host)return;
    const state=instances.get(host) || await mount(root);
    if(!state)return;
    if(state.spinResolve){
      await new Promise((resolve)=>setTimeout(resolve,70));
      return spin(root);
    }
    return new Promise((resolve)=>{
      state.spinResolve=resolve;
      state.spinStart=performance.now();
      state.spinDuration=720;
    });
  }

  global.RoadToGloryVending3D=Object.freeze({mount,spin});
})(globalThis);
