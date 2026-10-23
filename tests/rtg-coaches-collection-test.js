(function coachTestSuite(){
  "use strict";
  const assert=require("node:assert/strict");
  const test=require("node:test");
  const vm=require("node:vm");
  const fs=require("node:fs");
  const read=p=>fs.readFileSync(p,"utf8");
  const sandbox={
    RoadToGloryCardIdentity:{
      record:v=>typeof v==="object"?v:{cardId:String(v),playerId:String(v)},
      parse:v=>v
    }
  };
  vm.runInNewContext(read("js/road-to-glory/rtg-coaches.js"),sandbox);
  vm.runInNewContext(read("js/road-to-glory/rtg-rng.js"),sandbox);
  vm.runInNewContext(read("js/road-to-glory/rtg-state.js"),sandbox);
  vm.runInNewContext(read("js/road-to-glory/rtg-coaches-view.js"),sandbox);
  vm.runInNewContext(read("js/road-to-glory/rtg-coaches-controller.js"),sandbox);
  vm.runInNewContext(read("js/road-to-glory/rtg-repository.js"),sandbox);
  const api=sandbox.RoadToGloryCoaches,stateApi=sandbox.RoadToGloryState,view=sandbox.RoadToGloryCoachesView;
  const campaign=(name="rtg-ie-trilogy")=>stateApi.createInitial({campaignSeed:"coach-tests",campaignId:name});
  test("Ritratti Zukan: tutti i dieci allenatori hanno immagine e figura intera",()=>{
    assert.equal(api.CATALOG.length,10);
    for(const coach of api.CATALOG){
      assert.ok(coach.imageUrl.startsWith("https://dxi4wb638ujep.cloudfront.net/1/k/"));
      assert.ok(coach.frontFullbodyUrl.startsWith("https://dxi4wb638ujep.cloudfront.net/1/k/"));
      assert.ok(/\.(png|webp)$/.test(coach.imageUrl));
      assert.ok(coach.teamLogoUrl.startsWith("https://"));
      assert.ok(coach.frontFullbodyUrl.endsWith("_r0_fullbody.webp"));
      assert.ok(view.card(coach,"owned").includes(coach.imageUrl));
      assert.ok(view.detail(campaign(),coach.id).includes(coach.frontFullbodyUrl));
    }
  });
  test("Catalogo: 10 Zukan ID univoci e due campagne isolate",()=>{
    assert.equal(api.CATALOG.length,10);
    assert.equal(new Set(api.CATALOG.map(c=>c.id)).size,10);
    assert.equal(api.catalog(campaign()).length,10);
    assert.equal(api.catalog(campaign("rtg-ares-orion")).length,10);
    assert.equal(api.eligible(campaign("rtg-ares-orion")).length,0);
    assert.equal(api.status(campaign("rtg-ares-orion"),"36"),"locked");
  });
  test("Season bloccate fino al completamento e completamento storico",()=>{
    let s=campaign();s.tokens=4000;
    assert.equal(api.eligible(s).length,0);
    s.seasonComplete=true;
    assert.deepEqual(Array.from(api.eligible(s),c=>c.id),["36","208"]);
    s.activeSeasonId="ie1_s2";s.seasonComplete=false;s.seasonTransitionRewardedIds=["ie1->ie1_s2"];
    assert.equal(api.eligible(s).length,2);
    s.seasonComplete=true;assert.equal(api.eligible(s).length,5);
    s.activeSeasonId="ie1_s3";s.seasonComplete=false;
    assert.equal(api.eligible(s).length,5);
    s.seasonComplete=true;assert.equal(api.eligible(s).length,8);
  });
  test("Acquisto atomico nel modello: costo, RNG, zero doppioni, copia input",()=>{
    let s=campaign();s.tokens=1800;s.seasonComplete=true;
    const first=api.draw(s,sandbox.RoadToGloryRng);
    assert.equal(first.state.tokens,900);
    assert.equal(first.state.coachPullCount,1);
    assert.equal(s.tokens,1800);
    assert.deepEqual(Array.from(s.coachOwnedIds),[]);
    const second=api.draw(first.state,sandbox.RoadToGloryRng);
    assert.equal(second.state.tokens,0);
    assert.equal(second.state.coachOwnedIds.length,2);
    assert.notEqual(first.coach.id,second.coach.id);
    assert.equal(api.eligible(second.state).length,0);
    assert.throws(()=>api.draw(second.state,sandbox.RoadToGloryRng),/Non ci sono nuovi/);
    assert.deepEqual(Array.from(api.owned(s)),[]);
  });
  test("Gettoni insufficienti: nessuna modifica dello stato",()=>{
    const s=campaign();s.seasonComplete=true;s.tokens=899;
    const before=JSON.stringify(s);
    assert.throws(()=>api.draw(s),/insufficienti/);
    assert.equal(JSON.stringify(s),before);
  });
  test("Salvataggio vecchio: nessuna carta e campagna separata",()=>{
    const legacy=campaign();delete legacy.coachOwnedIds;delete legacy.coachPullCount;
    const normalized=stateApi.validate(legacy);
    assert.equal(normalized.coachOwnedIds.length,0);
    assert.equal(normalized.coachPullCount,0);
    const ares=campaign("rtg-ares-orion");ares.seasonComplete=true;ares.coachOwnedIds=["36","4401"];
    assert.deepEqual(Array.from(stateApi.validate(ares).coachOwnedIds),["36","4401"]);
  });
  test("Duplicati nei salvataggi invalidi rigettati",()=>{
    const s=campaign();s.coachOwnedIds=["36","36"];
    assert.throws(()=>stateApi.validate(s),{code:"rtg-coaches-duplicates"});
  });
  test("Equipaggiamento resta nella Season e invalido viene ignorato",()=>{
    const s=campaign();s.coachOwnedIds=["36"];s.squads.ie1.coachId="36";
    assert.equal(stateApi.validate(s).squads.ie1.coachId,"36");
    s.squads.ie1.coachId="208";
    assert.equal(stateApi.validate(s).squads.ie1.coachId,"");
  });
  test("Layout allenatori usa markup reale di carte, schede e distributore",()=>{
    const s=campaign();s.tokens=900;s.seasonComplete=true;
    const html=view.markup(s,{tab:"draw"});
    assert.match(html,/rtg-vending-machine-v12/);
    assert.equal((html.match(/data-capsule-rarity="coach"/g)||[]).length,14);
    assert.match(html,/data-rtg-coaches-pull/);
    assert.match(view.card(api.CATALOG[0],"owned"),/tactical-player-card--mobile/);
    assert.match(view.card(api.CATALOG[0],"owned"),/player-corner player-level/);
    assert.match(view.detail(s,"36"),/player-detail-hero/);
    assert.match(view.detail(s,"36"),/player-detail-content/);
    assert.doesNotMatch(view.detail(s,"36"),/overall-comparison/);
    assert.match(view.albumMarkup(s),/album-player-grid/);
    assert.equal((view.albumMarkup(s).match(/class="album-player-entry /g)||[]).length,10);
    assert.equal((view.markup(s,{tab:"collection"}).match(/data-rtg-coach-detail=/g)||[]).length,10);
    assert.match(view.albumCard(api.CATALOG[0],"owned"),/rtg-coach-album-card/);
    assert.doesNotMatch(view.albumMarkup(s),/album-player-lock/);
    assert.match(view.card(api.CATALOG[0],"owned"),/rtg-picker-squad-card/);
    assert.doesNotMatch(read("js/road-to-glory/rtg-route-view.js"),/data-rtg-open-coaches/);
  });
  test("Squadra: slot allenatore e comandi coerenti",()=>{
    const s=campaign();s.coachOwnedIds=["36"];
    const empty=view.squadSlot(s,"");assert.match(empty,/Nessun allenatore assegnato/);
    assert.match(empty,/data-rtg-squad-coach-select/);
    const active=view.squadSlot(s,"36");assert.match(active,/Ray Dark/);
    assert.match(active,/data-rtg-squad-coach-detail/);
    assert.match(active,/SCHEDA \/ RIMUOVI/);
    assert.match(view.squadSlot(s,"208"),/Nessun allenatore assegnato/);
    assert.match(read("js/road-to-glory/rtg-squad-view-base.js"),/context.coachSlotMarkup/);
  });
  test("UI: nessun potere abilitato, schede e acquisto gestiti",()=>{
    const s=campaign();s.tokens=1000;s.seasonComplete=true;
    assert.match(view.markup(s,{tab:"draw"}),/data-rtg-coaches-pull/);
    assert.match(view.markup(s,{tab:"collection"}),/Ray Dark/);
    assert.match(view.detail(s,"36"),/PROSSIMAMENTE/);
    assert.doesNotMatch(view.detail(s,"36"),/data-rtg-coaches-equip/);
    s.coachOwnedIds=["36"];
    assert.match(view.detail(s,"36"),/data-rtg-coaches-equip/);
  });

  test("Mobile: tre colonne, immagini eager con fallback e pulsante ASSEGNA in collezione",()=>{
    const css=read("css/rtg-coaches.css");
    assert.match(css,/rtg-coaches-modal \.rtg-coaches-grid\s*\{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
    assert.match(css,/rtg-coaches-album \.album-player-grid\s*\{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
    const s=campaign();s.coachOwnedIds=["36"];
    const html=view.markup(s,{tab:"collection"});
    assert.match(html,/data-rtg-coaches-equip="36"/);
    assert.match(html,/ASSEGNA/);
    assert.match(view.card(api.CATALOG[6],"owned"),/loading="eager"/);
    assert.match(view.card(api.CATALOG[6],"owned"),/data-coach-alternate=/);
    assert.match(view.card(api.CATALOG[9],"owned"),/rtg-coach-rene-artwork/);
  });

  test("René: ID Inazugle 4763 e vecchio ID 4761 RTG preservato",()=>{
    const rene=api.BY_ID["4761"];
    assert.equal(rene.zukanId,"4763");
    assert.equal(rene.id,"4761","saved RTG coach identity must not change");
    assert.equal(api.BY_ID["4763"],undefined);
  });
  test("René: sprite PNG preloaded nelle tre card, full-body esclusivo nella scheda",()=>{
    const rene=api.BY_ID["4761"];
    const url="https://dxi4wb638ujep.cloudfront.net/1/k/a/t/atcna3pn7ds.png";
    assert.equal(rene.imageUrl,url);
    for(const html of [view.card(rene,"locked"),view.albumCard(rene,"locked"),view.squadSlot({...campaign(),coachOwnedIds:["4761"]},"4761")]){
      assert.ok(html.includes('class="rtg-coach-rene-artwork '),"dedicated CSS sprite");
      assert.ok(html.includes("background-image:url('"+url+"')"),"official PNG used as background");
      assert.ok(html.includes("data-rtg-rene-artwork"),"sprite can be repainted");
      assert.ok(html.includes('class="rtg-coach-rene-loading"'),"never leave card blank while loading");
      assert.ok(!html.includes('data-coach-fallbacks='),"compact sprite must not enter generic image retry logic");
    }
    const detail=view.detail(campaign(),"4761");
    assert.ok(detail.includes('src="'+rene.frontFullbodyUrl+'"'),"full-body must be source in detail");
    assert.ok(!detail.includes('src="'+url+'"'),"portrait PNG must not replace full-body");
    assert.ok(detail.includes('data-coach-fallbacks="'+url+'|'+rene.imageFallbackUrls[0]+'"'));
    assert.ok(view.card(api.BY_ID["36"],"locked").includes('src="'+api.BY_ID["36"].imageUrl+'"'),"other coach cards untouched");
  });
  test("Full-body loading error falls back proportionally, not oversized portrait",()=>{
    const listeners={};
    vm.runInNewContext(read("js/road-to-glory/rtg-coaches-view.js"),{
      document:{addEventListener(name,cb,capture){listeners[name]=cb;assert.equal(capture,true);}}
    });
    const rene=api.BY_ID["4761"];
    const classes=new Set(["rtg-coach-fullbody"]);
    const image={
      hidden:false,
      src:rene.frontFullbodyUrl,
      style:{display:""},
      dataset:{coachFallbacks:rene.imageUrl,coachFullbodyUrl:rene.frontFullbodyUrl,coachCompactFullbody:"false"},
      getAttribute:attr=>attr==="data-rtg-coach-image"?"4761":null,
      classList:{contains:cls=>classes.has(cls),toggle(cls,val){if(val)classes.add(cls);else classes.delete(cls);}}
    };
    listeners.error({target:image});
    assert.equal(image.src,rene.imageUrl);
    assert.ok(classes.has("rtg-coach-fullbody--portrait-fallback"));
    assert.match(read("css/rtg-coaches.css"),/rtg-coach-fullbody--portrait-fallback/);
  });
  test("René sprite: preload in HTML e nessun img offscreen da decodificare",()=>{
    const html=view.card(api.BY_ID["4761"],"locked");
    assert.match(html,/data-rtg-rene-artwork/);
    assert.match(html,/rtg-coach-rene-artwork/);
    assert.doesNotMatch(html,/data-rtg-coach-image=/);
    assert.doesNotMatch(html,/<img /);
    const page=read("index.html");
    assert.ok(page.includes('rel="preload" as="image" href="'+api.BY_ID["4761"].imageUrl+'"'));
    const css=read("css/rtg-coaches.css");
    assert.match(css,/rtg-coach-rene-artwork\.is-ready \.rtg-coach-rene-loading/);
  });
  test("Safari: preloader decodifica, mostra lo sprite e forza repaint",async()=>{
    const elements=[];
    const events={};
    const classes=new Set();
    const display={
      dataset:{},offsetWidth:72,
      style:{backgroundImage:""},
      classList:{toggle(name,active){if(active)classes.add(name);else classes.delete(name);}}
    };
    const client={
      RoadToGloryCoaches:api,
      Image:class {
        constructor(){elements.push(this);}
        set src(value){this._src=value;}
        get src(){return this._src;}
        decode(){return new Promise(()=>{});} // Safari may delay offscreen decode indefinitely
      },
      document:{
        querySelectorAll(selector){assert.equal(selector,"[data-rtg-rene-artwork]");return [display];},
        addEventListener(type,callback){events[type]=callback;},
        hidden:false,
      }
    };
    vm.runInNewContext(read("js/road-to-glory/rtg-coaches-view.js"),client);
    assert.equal(elements.length,1,"preload started at script evaluation");
    assert.equal(elements[0].src,api.BY_ID["4761"].imageUrl);
    elements[0].onload();
    // The portrait must paint NOW, without waiting for a pending decode().
    assert.ok(classes.has("is-ready"),"visible immediately after bytes load");
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(display.style.backgroundImage,'url("'+api.BY_ID["4761"].imageUrl+'")');
    assert.equal(display.dataset.renePainted,"true");
    const original=display.style;
    display.dataset.renePainted="false";
    events.scroll();
    assert.equal(display.dataset.renePainted,"true","scroll restores paint for below-fold card");
  });


  test("Coach grid non restringe David Arrows o altre card al contenuto dell'immagine",()=>{
    const css=read("css/rtg-coaches.css");
    assert.match(css,/\.rtg-coaches-modal \.rtg-coaches-grid\.rtg-picker-grid\s*\{[^}]*justify-items:stretch!important/);
    assert.match(css,/\.rtg-coaches-modal \.rtg-coach-entry\s*\{[^}]*width:100%!important/);
    assert.match(css,/\.rtg-coaches-modal \.rtg-coach-entry>\.rtg-coach-card\.player-card\s*\{[^}]*width:100%!important/);
    assert.match(view.card(api.BY_ID["1974"],"locked"),/David Arrows/);
  });
  test("Risultato distributore: carta grande, nessuna griglia pull legacy, CTA e saldo",()=>{
    const s=campaign();s.tokens=510;
    const html=view.result(api.CATALOG[0],s);
    assert.match(html,/rtg-coaches-reward-feature/);
    assert.match(html,/rtg-coaches-reward-art/);
    assert.match(html,/SALDO GETTONI RTG/);
    assert.match(html,/510/);
    assert.match(html,/data-rtg-coaches-collection/);
    assert.doesNotMatch(html,/rtg-pull-card-stage|rtg-pull-result-body/);
  });
  test("Assegnazione dal catalogo: committa, aggiorna slot, chiude e ritorna a Squadra",async()=>{
    let state=campaign();state.coachOwnedIds=["36"];
    let draft=stateApi.clone(state.squads.ie1);
    const sequence=[];
    const button={dataset:{rtgCoachesEquip:"36"},disabled:false,isConnected:true,addEventListener(_type,cb){this.handler=cb;}};
    const root={
      querySelector(){return null;},
      querySelectorAll(selector){return selector==="[data-rtg-coaches-equip]"?[button]:[];}
    };
    const ctx={
      getCampaign:()=>state,setCampaign:next=>{state=next;},
      getSquadDraft:()=>draft,setSquadDraft:next=>{draft=next;},
      activeSquad:()=>state.squads.ie1,activeSeasonId:()=>"ie1",
      getActiveSquadSlot:()=>2,storeSquadSlot:(slot,record)=>sequence.push(["slot",slot,record.coachId]),
      openModal:()=>{},getModalRoot:()=>root,
      closeModal:()=>sequence.push("close"),renderSquad:()=>sequence.push("render"),
      toast:(message,type)=>sequence.push(["toast",message,type]),
      repository:{update:async(_label,mutate)=>{
        sequence.push("saving");
        const next=stateApi.validate(mutate(stateApi.clone(state)));
        sequence.push("committed");
        return next;
      }}
    };
    sandbox.RoadToGloryCoachesController.open(ctx,"collection");
    await button.handler({currentTarget:button});
    assert.equal(state.squads.ie1.coachId,"36");
    assert.equal(draft.coachId,"36");
    assert.deepEqual(sequence.slice(0,3),["saving","committed",["slot",2,"36"]]);
    assert.equal(sequence[3],"close");
    assert.equal(sequence[4],"render");
    assert.equal(button.disabled,false);
  });
  test("Assegnazione: se il commit fallisce non modifica Squadra né mostra successo",async()=>{
    let state=campaign();state.coachOwnedIds=["36"];
    let draft=stateApi.clone(state.squads.ie1);
    const sideEffects=[];
    const button={dataset:{rtgCoachesEquip:"36"},disabled:false,isConnected:true,addEventListener(_type,cb){this.handler=cb;}};
    const root={querySelector(){return null;},querySelectorAll(selector){return selector==="[data-rtg-coaches-equip]"?[button]:[];}};
    const ctx={
      getCampaign:()=>state,setCampaign:next=>{state=next;},getSquadDraft:()=>draft,
      setSquadDraft:next=>{draft=next;},activeSquad:()=>state.squads.ie1,
      activeSeasonId:()=>"ie1",getActiveSquadSlot:()=>1,
      storeSquadSlot:()=>sideEffects.push("slot"),closeModal:()=>sideEffects.push("close"),
      renderSquad:()=>sideEffects.push("render"),openModal:()=>{},getModalRoot:()=>root,
      toast:(_message,type)=>sideEffects.push(type),
      repository:{update:async()=>{throw Error("write failure");}}
    };
    sandbox.RoadToGloryCoachesController.open(ctx,"collection");
    await button.handler({currentTarget:button});
    assert.equal(state.squads.ie1.coachId||"","");
    assert.equal(draft.coachId||"","");
    assert.deepEqual(sideEffects,["error"]);
    assert.equal(button.disabled,false);
  });
  test("Il WebP fornito resta come alternativa al PNG ufficiale, non come prima sorgente",()=>{
    const rene=api.BY_ID["4761"];
    assert.equal(rene.imageFallbackUrls[0],"https://dxi4wb638ujep.cloudfront.net/1/k/a/t/atcna3pn7ds.webp");
    assert.match(view.card(rene,"locked"),/atcna3pn7ds\.png/);
    assert.match(view.albumCard(rene,"locked"),/atcna3pn7ds\.png/);
    assert.match(view.result(rene,campaign()),/atcna3pn7ds\.png/);
  });
  test("Dettaglio: stemma squadra nelle due sezioni, senza ID Zukan; risultato senza badge NUOVO",()=>{
    const html=view.detail(campaign(),"1940");
    assert.match(html,/rtg-coach-team-chip/);
    assert.match(html,/rtg-coach-profile-team/);
    assert.match(html,/The_Kingdom_emblem/);
    assert.doesNotMatch(html,/ID Zukan/);
    const reward=view.result(api.BY_ID["4401"],campaign("rtg-ares-orion"));
    assert.match(reward,/NUOVO ALLENATORE!/);
    assert.ok(!reward.includes("<b>NUOVO!</b>"));
  });
  test("Album: nessun banner copre i ritratti e le 10 card sono autonome",()=>{
    const html=view.albumMarkup(campaign());
    assert.equal((html.match(/rtg-coach-album-card/g)||[]).length,10);
    assert.equal((html.match(/rtg-coach-album-status/g)||[]).length,10);
    assert.doesNotMatch(html,/album-player-lock|NON SBLOCCATO/);
    const css=read("css/rtg-coaches.css");
    assert.match(css,/rtg-coach-album-card::before/);
    assert.match(css,/rtg-coach-album-status/);
  });
  test("Condivisione account: lettura legacy non distruttiva, equip cross-campagna e nessun doppione",async()=>{
    const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
    const trilogy=campaign();trilogy.coachOwnedIds=["36"];
    const ares=campaign("rtg-ares-orion");ares.coachOwnedIds=["4401"];ares.seasonComplete=true;
    const storageData=new Map([
      ["state",clone(trilogy)],["state:rtg-ares-orion",clone(ares)],
      ["shared:account",{tokens:3000,gachaAcquiredCards:[],developmentByCardId:{}}],
    ]);
    const writes=[];
    const storage={
      async read(key="state"){return clone(storageData.get(key)||null);},
      async write(value,key="state"){writes.push(key);storageData.set(key,clone(value));},
      async update(fn,key="state"){
        const value=fn(clone(storageData.get(key)||null));
        storageData.set(key,clone(value));return clone(value);
      },
    };
    const repo=sandbox.RoadToGloryRepository.create({storage,seedFactory:()=>"seed"});
    repo.selectCampaign("rtg-ares-orion");
    let a=await repo.read();
    assert.deepEqual(Array.from(a.coachOwnedIds),["36","4401"]);
    assert.equal(api.status(a,"36"),"owned");
    assert.equal(api.eligible(a).length,0);
    assert.equal(writes.length,0,"read must not migrate or write");
    repo.selectCampaign("rtg-ie-trilogy");
    let t=await repo.read();
    assert.deepEqual(Array.from(t.coachOwnedIds),["36","4401"]);
    assert.equal(api.status(t,"4401"),"owned");
    assert.match(view.markup(t,{tab:"collection"}),/data-rtg-coaches-equip="4401"/);
    const updated=await repo.update("cross-campaign-equip",state=>{
      state.squads.ie1.coachId="4401";return state;
    });
    assert.equal(updated.squads.ie1.coachId,"4401");
    assert.equal(storageData.get("state").squads.ie1.coachId,"4401");
    assert.deepEqual(Array.from(storageData.get("shared:account").coachOwnedIds),["36","4401"]);
    repo.selectCampaign("rtg-ares-orion");
    a=await repo.read();assert.equal(api.status(a,"36"),"owned");
    assert.equal(a.tokens,3000);
    assert.equal(storageData.get("state:rtg-ares-orion").coachOwnedIds.length,1,"legacy save preserved");
  });
  test("Legacy recovery: shared account reconstruito dopo write interrotta",async()=>{
    const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
    const ares=campaign("rtg-ares-orion");ares.seasonComplete=true;
    const values=new Map([["state",campaign()],["state:rtg-ares-orion",ares],
      ["shared:account",{tokens:1800,gachaAcquiredCards:[],developmentByCardId:{}}]]);
    let failShared=true;
    const storage={
      async read(key){return clone(values.get(key)||null);},
      async update(fn,key){const next=fn(clone(values.get(key)||null));values.set(key,clone(next));return clone(next);},
      async write(data,key){if(key==="shared:account"&&failShared)throw Error("offline shared");
        values.set(key,clone(data));},
    };
    const repo=sandbox.RoadToGloryRepository.create({storage,seedFactory:()=>"seed"});
    repo.selectCampaign("rtg-ares-orion");
    await assert.rejects(repo.update("draw-with-interrupted-shared",state=>{
      state.coachOwnedIds.push("4401");return state;
    }),/offline shared/);
    const before=values.get("state:rtg-ares-orion");
    assert.deepEqual(before.coachOwnedIds,["4401"]);
    failShared=false;
    repo.selectCampaign("rtg-ie-trilogy");
    const recovered=await repo.read();
    assert.equal(api.status(recovered,"4401"),"owned");
    assert.equal(values.get("shared:account").coachOwnedIds,undefined,"reading never writes shared");
  });

})();
