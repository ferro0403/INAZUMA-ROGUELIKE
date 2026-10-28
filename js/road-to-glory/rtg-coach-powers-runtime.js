(function(global){
  "use strict";
  // Squad powers only. Selections persist with the Season squad, and effects
  // are snapshotted into the match once; never mutate owned player cards.
  const id=value=>String(value??"");
  const ids=values=>Array.isArray(values)?values.map(id).filter(Boolean):[];
  const cardId=player=>id(player?.cardId||player?.playerId||player?.id||player);
  const RARITIES=Object.freeze(["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]);
  const ELEMENTS=Object.freeze(["fire","wind","forest","mountain"]);
  const elementKey=value=>{
    const token=id(value).trim().toLowerCase();
    if(["fire","fuoco"].includes(token))return "fire";
    if(["wind","vento"].includes(token))return "wind";
    if(["forest","wood","tree","bosco","albero"].includes(token))return "forest";
    if(["mountain","montagna"].includes(token))return "mountain";
    return "";
  };
  const powerReady=coachId=>["208","1329","1777","1974","4401","halloween-coach-54"].includes(id(coachId));
  const nextRarity=rarity=>{
    const index=RARITIES.indexOf(String(rarity||""));
    return index>=0&&index<RARITIES.length-1?RARITIES[index+1]:null;
  };
  const rarityOf=player=>String(player?.finalRarity||player?.category||"");
  const owned=(state,coachId)=>global.RoadToGloryCoaches?.owned?.(state)?.has?.(id(coachId))===true;
  function selected(squad){
    const config=squad?.coachPowerSelection;
    if(!config||!powerReady(squad?.coachId)||id(config.coachId)!==id(squad.coachId))return null;
    return {
      coachId:id(config.coachId),
      cardIds:ids(config.cardIds),
      moveIndices:Array.isArray(config.moveIndices)?config.moveIndices.map(Number):[],
      element:id(config.element),
      // Yi v2 has two independent targets; missing means legacy single-element selection.
      targets:Array.isArray(config.targets)?config.targets.slice(0,2).map(t=>({
        cardId:id(t?.cardId),element:id(t?.element),
        moveIndices:Array.isArray(t?.moveIndices)?t.moveIndices.map(Number):[],
      })):[],
    };
  }
  function fourMoves(player,seasonId){
    const canonical=id(player?.legacyCanonicalPlayerId||player?.playerId||player?.id).split("@")[0];
    const season=id(player?.resolvedSeasonId||player?.legacySeasonId||seasonId||"ie1");
    return global.RtgFourMovesRuntime?.movesFor?.(season,canonical)||[];
  }
  const availableMoveIndices=moves=>Array.isArray(moves)&&moves.length>0&&moves.length<=4&&
    moves.every(move=>Number.isInteger(Number(move?.ptCost))&&Number(move.ptCost)>0)
    ?moves.map((_,index)=>index):null;
  function validConfig(squad,players,seasonId,benchPlayers=[]){
    const config=selected(squad);
    if(!config||!Array.isArray(players)||!Array.isArray(benchPlayers)||
       new Set(config.cardIds).size!==config.cardIds.length)return null;
    const lineup=new Map(players.map(player=>[cardId(player),player]));
    const bench=new Map(benchPlayers.map(player=>[cardId(player),player]));
    if(config.coachId==="halloween-coach-54"){
      // The event coach affects only access requirements, never actual player stats.
      return config.cardIds.length===1&&lineup.has(config.cardIds[0])&&
        config.cardIds[0].startsWith("halloween2026::")?config:null;
    }
    if(config.coachId==="208"){
      return config.cardIds.length===2&&config.cardIds.every(key=>lineup.has(key))?config:null;
    }
    if(config.coachId==="1329"){
      if(config.cardIds.length!==1||!lineup.has(config.cardIds[0]))return null;
      const allMoves=availableMoveIndices(fourMoves(lineup.get(config.cardIds[0]),seasonId));
      // Legacy two-move selections remain readable; each NEW match snapshots all real moves.
      return allMoves?{...config,moveIndices:allMoves}:null;
    }
    if(config.coachId==="1777"){
      // Bench player is excluded from the 15-player *cap average* only.
      return config.cardIds.length===1&&bench.has(config.cardIds[0])?config:null;
    }
    if(config.coachId==="1974"){
      // Two distinct cards, each either starter or reserve. A previously saved
      // one-card choice remains valid until the user edits the configuration.
      return config.cardIds.length>=1&&config.cardIds.length<=2&&
        config.cardIds.every(key=>{
          const player=lineup.get(key)||bench.get(key);
          return player&&nextRarity(rarityOf(player));
        })?config:null;
    }
    if(config.coachId==="4401"){
      if(config.targets.length){
        if(config.cardIds.length!==2||config.targets.length!==2||
           new Set(config.targets.map(t=>t.cardId)).size!==2||
           !config.cardIds.every(card=>config.targets.some(t=>t.cardId===card)))return null;
        for(const target of config.targets){
          const player=lineup.get(target.cardId);
          if(!player||!ELEMENTS.includes(target.element)||
             elementKey(player.element||player.type)===target.element||
             !availableMoveIndices(fourMoves(player,seasonId)))return null;
        }
        return {...config,targets:config.targets.map(t=>({...t,
          moveIndices:availableMoveIndices(fourMoves(lineup.get(t.cardId),seasonId))}))};
      }
      // Preserve existing single-player choices from saves made before Total Transformation.
      const target=config.cardIds[0],source=target&&lineup.get(target);
      const allMoves=source?availableMoveIndices(fourMoves(source,seasonId)):null;
      return config.cardIds.length===1&&!!source&&allMoves&&
        ELEMENTS.includes(config.element)&&
        elementKey(source.element||source.type)!==config.element
        ?{...config,targets:[{cardId:target,element:config.element,moveIndices:allMoves}]}:null;
    }
    return null;
  }
  function capOverrideFor(squad,state){
    if(id(squad?.coachId)!=="1777"||!owned(state,"1777"))return null;
    // The power was committed at kickoff. At halftime the protected player
    // may enter the field, but its cap discount must not vanish mid-match.
    const match=state?.activeMatch,effect=match?.coachPowerEffect;
    const selectedId=id(effect?.cardIds?.[0]);
    if(effect?.coachId==="1777"&&selectedId&&
       id(match.seasonId)===id(state?.activeSeasonId)&&
       [...(squad?.lineup||[]),...(squad?.bench||[])].some(p=>cardId(p)===selectedId))
      return selectedId;
    const config=validConfig(squad,squad?.lineup||[],state?.activeSeasonId,squad?.bench||[]);
    return config?.cardIds?.[0]||null;
  }
  function overallDiscountFor(squad,state){
    if(id(squad?.coachId)!=="halloween-coach-54"||!owned(state,"halloween-coach-54"))return null;
    const config=validConfig(squad,squad?.lineup||[],state?.activeSeasonId,squad?.bench||[]);
    return config?{cardId:config.cardIds[0],amount:15}:null;
  }
  function eligibleRosterForCap(squad){
    // Preserve all 15 squad members. The capped value is substituted in teamPower.
    return [...(squad?.lineup||[]),...(squad?.bench||[])];
  }
  function applyToMatch(match,squad,state,options={}){
    if(!match||!squad||!owned(state,squad.coachId)||match.coachPowerEffect)return match;
    const config=validConfig(squad,match.userSquad?.lineup||[],match.seasonId,match.userSquad?.bench||[]);
    if(!config)return match;
    if(config.coachId==="halloween-coach-54")return match; // Strictly no in-match effect or snapshot.
    const coachId=config.coachId,card=config.cardIds[0];
    if(["208","1329","1974"].includes(coachId)&&match.ptModeVersion!==1)return match;
    const effect={
      coachId,cardIds:config.cardIds.slice(),moveIndices:config.moveIndices.slice(),
      element:config.element,
    };
    if(coachId==="208"){
      const current={...(match.ptCurrentByPlayerId||{})};
      const maximum={...(match.ptMaxByPlayerId||{})};
      for(const key of config.cardIds){
        if(!Number.isFinite(current["user:"+key])||!Number.isFinite(maximum["user:"+key]))return match;
        current["user:"+key]+=100; maximum["user:"+key]+=100;
      }
      return {...match,ptCurrentByPlayerId:current,ptMaxByPlayerId:maximum,coachPowerEffect:effect};
    }
    if(coachId==="1329"||coachId==="1777"){
      return {...match,coachPowerEffect:effect};
    }
    if(coachId==="4401"){
      const targets=config.targets||[];
      effect.targets=targets.map(t=>({cardId:t.cardId,element:t.element,moveIndices:t.moveIndices.slice()}));
      const changeById=new Map(targets.map(t=>[t.cardId,t.element]));
      const lineup=match.userSquad.lineup.map(player=>{
        const key=cardId(player);
        const nextElement=changeById.get(key)||(key===card?config.element:null);
        return nextElement?{...player,element:nextElement}:player;
      });
      return {...match,userSquad:{...match.userSquad,lineup},coachPowerEffect:effect};
    }
    if(coachId==="1974"){
      const all=[...(match.userSquad?.lineup||[]),...(match.userSquad?.bench||[])];
      const ptBreakdown=global.RtgFourMovesRuntime?.ptBreakdown;
      if(typeof options.upgradeRarity!=="function"||typeof ptBreakdown!=="function")return match;
      const upgrades=new Map(),snapshot=[];
      // Prepare and validate every upgrade before changing even one player or PT.
      for(const key of config.cardIds){
        const original=all.find(player=>cardId(player)===key);
        const target=nextRarity(rarityOf(original));
        if(!original||!target)return match;
        const upgraded=options.upgradeRarity(original,target,key);
        if(!upgraded||rarityOf(upgraded)!==target||
           !Number.isFinite(Number(upgraded.overall))||
           !upgraded.stats||typeof upgraded.stats!=="object")return match;
        const total=Number(ptBreakdown(upgraded.stats,target)?.total);
        if(!Number.isInteger(total)||total<0)return match;
        const boosted={
          ...original,...upgraded,cardId:key,playerId:original.playerId,
          tacticalRole:original.tacticalRole,move:original.move,
          activeMove:original.activeMove,category:target,finalRarity:target,
        };
        upgrades.set(key,{player:boosted,total});
        snapshot.push({cardId:key,previousRarity:rarityOf(original),
          targetRarity:target,previousOverall:Number(original.overall)});
      }
      const current={...(match.ptCurrentByPlayerId||{})};
      const maximum={...(match.ptMaxByPlayerId||{})};
      for(const [key,entry] of upgrades){
        current["user:"+key]=entry.total;
        maximum["user:"+key]=entry.total;
      }
      const transform=arr=>(arr||[]).map(player=>upgrades.get(cardId(player))?.player||player);
      // Keep the original single-player metadata accessible in old UI/readers.
      Object.assign(effect,snapshot[0],{targets:snapshot});
      return {...match,ptCurrentByPlayerId:current,ptMaxByPlayerId:maximum,
        userSquad:{...match.userSquad,lineup:transform(match.userSquad.lineup),
          bench:transform(match.userSquad.bench)},coachPowerEffect:effect};
    }
    return match;
  }
  function moveCost(match,side,playerId,moveIndex,ordinaryCost){
    const config=match?.coachPowerEffect;
    if(side!=="user"||config?.coachId!=="1329"||config.cardIds?.[0]!==id(playerId)||
       !config.moveIndices?.includes(moveIndex))return ordinaryCost;
    return Number.isInteger(ordinaryCost)&&ordinaryCost>0?Math.ceil(ordinaryCost/2):ordinaryCost;
  }
  function moveElement(match,side,playerId,moveIndex,originalElement){
    if(side!=="user"||match?.coachPowerEffect?.coachId!=="4401")return originalElement;
    const targets=match.coachPowerEffect.targets;
    const target=Array.isArray(targets)?
      targets.find(t=>t.cardId===id(playerId)):null;
    return target?.moveIndices?.includes(moveIndex)&&ELEMENTS.includes(target.element)
      ?target.element:originalElement;
  }
  global.RoadToGloryCoachPowerRuntime=Object.freeze({
    RARITIES,ELEMENTS,elementKey,powerReady,nextRarity,rarityOf,selected,fourMoves,availableMoveIndices,validConfig,
    eligibleRosterForCap,capOverrideFor,overallDiscountFor,applyToMatch,moveCost,moveElement,
  });
})(globalThis);
