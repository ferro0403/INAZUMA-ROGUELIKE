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
  const api=sandbox.RoadToGloryCoaches,stateApi=sandbox.RoadToGloryState,view=sandbox.RoadToGloryCoachesView;
  const campaign=(name="rtg-ie-trilogy")=>stateApi.createInitial({campaignSeed:"coach-tests",campaignId:name});
  test("Catalogo: 10 Zukan ID univoci e due campagne isolate",()=>{
    assert.equal(api.CATALOG.length,10);
    assert.equal(new Set(api.CATALOG.map(c=>c.id)).size,10);
    assert.equal(api.catalog(campaign()).length,8);
    assert.equal(api.catalog(campaign("rtg-ares-orion")).length,2);
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
  test("UI: nessun potere abilitato, schede e acquisto gestiti",()=>{
    const s=campaign();s.tokens=1000;s.seasonComplete=true;
    assert.match(view.markup(s,{tab:"draw"}),/data-rtg-coaches-pull/);
    assert.match(view.markup(s,{tab:"collection"}),/Ray Dark/);
    assert.match(view.detail(s,"36"),/PROSSIMAMENTE/);
    assert.doesNotMatch(view.detail(s,"36"),/data-rtg-coaches-equip/);
    s.coachOwnedIds=["36"];
    assert.match(view.detail(s,"36"),/data-rtg-coaches-equip/);
  });
})();
