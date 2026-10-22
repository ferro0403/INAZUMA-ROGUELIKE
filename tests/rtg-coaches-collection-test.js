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
  const api=sandbox.RoadToGloryCoaches,stateApi=sandbox.RoadToGloryState,view=sandbox.RoadToGloryCoachesView;
  const campaign=(name="rtg-ie-trilogy")=>stateApi.createInitial({campaignSeed:"coach-tests",campaignId:name});
  test("Ritratti Zukan: tutti i dieci allenatori hanno immagine e figura intera",()=>{
    assert.equal(api.CATALOG.length,10);
    for(const coach of api.CATALOG){
      assert.ok(coach.imageUrl.startsWith("https://dxi4wb638ujep.cloudfront.net/1/k/"));
      assert.ok(coach.frontFullbodyUrl.startsWith("https://dxi4wb638ujep.cloudfront.net/1/k/"));
      assert.ok(coach.imageUrl.endsWith(".png"));
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
    assert.deepEqual(Array.from(stateApi.validate(ares).coachOwnedIds),["4401"]);
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
    assert.match(view.albumCard(api.CATALOG[0],"owned"),/player-card-large pull-player-card/);
    assert.match(view.albumCard(api.CATALOG[0],"owned"),/album-player-card/);
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
    assert.match(view.card(api.CATALOG[9],"owned"),/data-coach-alternate=/);
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
    assert.equal(state.squads.ie1.coachId,"");
    assert.equal(draft.coachId,"");
    assert.deepEqual(sideEffects,["error"]);
    assert.equal(button.disabled,false);
  });
})();
