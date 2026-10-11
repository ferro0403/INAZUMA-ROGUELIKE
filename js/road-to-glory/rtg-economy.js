(function (global) {
  "use strict";

  const RARITIES = Object.freeze(["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]);
  const PROJECT_RARITIES = Object.freeze(["Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]);
  const PROJECT_PRICES = Object.freeze({
    Buono:150,
    Forte:300,
    Elite:500,
    Mondiale:800,
    Leggenda:1200,
    Aurico:1800,
  });
  const EVOLUTION_COSTS = Object.freeze({
    Normale:Object.freeze({tokens:100,projects:0}),
    Buono:Object.freeze({tokens:200,projects:1}),
    Forte:Object.freeze({tokens:350,projects:1}),
    Elite:Object.freeze({tokens:550,projects:1}),
    Mondiale:Object.freeze({tokens:800,projects:1}),
    Leggenda:Object.freeze({tokens:1100,projects:1}),
    Aurico:Object.freeze({tokens:1200,projects:1}),
  });

  const clone=(value)=>value==null?value:JSON.parse(JSON.stringify(value));
  const id=(value)=>String(value??"").trim();
  const integer=(value,fallback=0)=>{
    const numeric=Number(value);
    return Number.isFinite(numeric)?Math.trunc(numeric):fallback;
  };

  function emptyProjects(){
    return Object.fromEntries(PROJECT_RARITIES.map((rarity)=>[rarity,0]));
  }

  function threshold(rarity){
    const fromDevelopment=global.DevelopmentV2?.threshold?.(rarity);
    if(Number.isFinite(Number(fromDevelopment)))return Number(fromDevelopment);
    return ({Normale:70,Buono:75,Forte:80,Elite:85,Mondiale:90,Leggenda:95,Aurico:99})[rarity]??0;
  }

  function nextRarity(current){
    const direct=global.DevelopmentV2?.nextRarity?.(current);
    if(direct)return direct;
    const index=RARITIES.indexOf(String(current||""));
    return index<2?"Normale":RARITIES[index+1]||null;
  }

  function categoryForPotential(potential,fallback="Scarso"){
    const category=global.InazumaProgression?.categoryForPotential?.(Number(potential),fallback);
    if(RARITIES.includes(category))return category;
    const value=Number(potential)||0;
    return RARITIES.filter((rarity)=>threshold(rarity)<=value).at(-1)||fallback;
  }

  function cardIdFromOwnedEntry(entry,seasonId="ie1"){
    const identity=global.RoadToGloryCardIdentity;
    try{
      if(identity?.record)return id(identity.record(entry,seasonId)?.cardId);
      if(identity?.parse)return id(identity.parse(entry)?.cardId);
    }catch(_error){}
    return id(entry?.cardId||entry);
  }

  function ownedCardIds(state){
    return new Set((state?.gachaAcquiredCards||[])
      .map((entry)=>cardIdFromOwnedEntry(entry,state?.activeSeasonId||"ie1"))
      .filter(Boolean));
  }

  function isEligibleOwnedCard(state,cardId){
    const key=id(cardId);
    if(!key||!ownedCardIds(state).has(key))return false;
    const parsed=global.RoadToGloryCardIdentity?.parse?.(key);
    return !parsed||parsed.sourceKind!=="free_agents";
  }

  function normalizeDevelopmentRecord(record={}){
    const targetPotential=Math.max(0,Math.min(99,integer(record.targetPotential,0)));
    const currentRarity=RARITIES.includes(record.currentRarity)
      ? record.currentRarity
      : (targetPotential?categoryForPotential(targetPotential):null);
    return {
      targetPotential,
      currentRarity,
      evolutionCount:Math.max(0,integer(record.evolutionCount,0)),
      updatedAt:record.updatedAt?String(record.updatedAt):null,
    };
  }

  function previewEvolution(state,{cardId,basePotential,baseRarity}={}){
    const key=id(cardId);
    if(!isEligibleOwnedCard(state,key))return {ok:false,reason:"not-owned"};
    const record=normalizeDevelopmentRecord(state?.developmentByCardId?.[key]||{});
    const base=Math.max(0,Math.min(99,integer(basePotential,0)));
    const currentPotential=Math.max(base,record.targetPotential||0);
    const currentRarity=record.currentRarity||(
      RARITIES.includes(baseRarity)?baseRarity:categoryForPotential(currentPotential)
    );
    const target=nextRarity(currentRarity);
    if(!target)return {ok:false,reason:"max",cardId:key,currentPotential,currentRarity};
    const cost=EVOLUTION_COSTS[target];
    if(!cost)return {ok:false,reason:"invalid-target",cardId:key,currentPotential,currentRarity,target};
    const projects=state?.projects&&typeof state.projects==="object"?state.projects:{};
    const haveProject=Math.max(0,integer(projects[target],0));
    const tokens=Math.max(0,integer(state?.tokens,0));
    const missing={
      tokens:Math.max(0,cost.tokens-tokens),
      projects:Math.max(0,cost.projects-haveProject),
    };
    return {
      ok:true,
      cardId:key,
      currentPotential,
      currentRarity,
      target,
      targetPotential:Math.max(currentPotential,threshold(target)),
      cost:{...cost},
      haveProject,
      tokens,
      missing,
      ready:missing.tokens===0&&missing.projects===0,
    };
  }

  function purchaseProject(inputState,rarity){
    const key=String(rarity||"");
    const price=PROJECT_PRICES[key];
    if(!price)return {ok:false,reason:"invalid",state:inputState};
    const currentTokens=Math.max(0,integer(inputState?.tokens,0));
    if(currentTokens<price)return {ok:false,reason:"tokens",price,missing:price-currentTokens,state:inputState};
    const state=clone(inputState);
    state.projects={...emptyProjects(),...(state.projects||{})};
    state.tokens=currentTokens-price;
    state.projects[key]=Math.max(0,integer(state.projects[key],0))+1;
    return {ok:true,state,rarity:key,price,balanceAfter:state.tokens};
  }

  function evolve(inputState,{cardId,basePotential,baseRarity,expectedTarget}={}){
    const preview=previewEvolution(inputState,{cardId,basePotential,baseRarity});
    if(!preview.ok)return {...preview,state:inputState};
    if(expectedTarget&&preview.target!==expectedTarget){
      return {ok:false,reason:"stale",expectedTarget,actualTarget:preview.target,state:inputState};
    }
    if(!preview.ready){
      return {ok:false,reason:"resources",missing:preview.missing,target:preview.target,state:inputState};
    }
    const state=clone(inputState);
    state.projects={...emptyProjects(),...(state.projects||{})};
    state.developmentByCardId=state.developmentByCardId&&typeof state.developmentByCardId==="object"
      ? {...state.developmentByCardId}
      : {};
    state.tokens=Math.max(0,integer(state.tokens,0))-preview.cost.tokens;
    if(preview.cost.projects){
      state.projects[preview.target]=Math.max(0,integer(state.projects[preview.target],0))-preview.cost.projects;
    }
    const previous=normalizeDevelopmentRecord(state.developmentByCardId[preview.cardId]||{});
    state.developmentByCardId[preview.cardId]={
      targetPotential:preview.targetPotential,
      currentRarity:preview.target,
      evolutionCount:previous.evolutionCount+1,
      updatedAt:new Date().toISOString(),
    };
    return {
      ok:true,
      state,
      cardId:preview.cardId,
      fromRarity:preview.currentRarity,
      target:preview.target,
      targetPotential:preview.targetPotential,
      cost:preview.cost,
      balanceAfter:state.tokens,
    };
  }

  global.RoadToGloryEconomy=Object.freeze({
    RARITIES,
    PROJECT_RARITIES,
    PROJECT_PRICES,
    EVOLUTION_COSTS,
    emptyProjects,
    threshold,
    nextRarity,
    categoryForPotential,
    ownedCardIds,
    isEligibleOwnedCard,
    normalizeDevelopmentRecord,
    previewEvolution,
    purchaseProject,
    evolve,
  });
})(globalThis);
