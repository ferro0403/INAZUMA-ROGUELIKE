(function(global){
  "use strict";
  // Squad powers only. Selections persist with the Season squad, and effects
  // are snapshotted into the match once; never mutate owned player cards.
  const id=value=>String(value??"");
  const ids=values=>Array.isArray(values)?values.map(id).filter(Boolean):[];
  const cardId=player=>id(player?.cardId||player?.playerId||player?.id||player);
  const RARITIES=Object.freeze(["Scarso","Debole","Normale","Buono","Forte","Elite","Mondiale","Leggenda","Aurico"]);
  const ELEMENTS=Object.freeze(["fire","wind","forest","mountain"]);
  const powerReady=coachId=>["208","1329","1777","1974","4401"].includes(id(coachId));
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
    };
  }
  function fourMoves(player,seasonId){
    const canonical=id(player?.legacyCanonicalPlayerId||player?.playerId||player?.id).split("@")[0];
    const season=id(player?.resolvedSeasonId||player?.legacySeasonId||seasonId||"ie1");
    return global.RtgFourMovesRuntime?.movesFor?.(season,canonical)||[];
  }
  function validConfig(squad,players,seasonId,benchPlayers=[]){
    const config=selected(squad);
    if(!config||!Array.isArray(players)||!Array.isArray(benchPlayers)||
       new Set(config.cardIds).size!==config.cardIds.length)return null;
    const lineup=new Map(players.map(player=>[cardId(player),player]));
    const bench=new Map(benchPlayers.map(player=>[cardId(player),player]));
    if(config.coachId==="208"){
      return config.cardIds.length===2&&config.cardIds.every(key=>lineup.has(key))?config:null;
    }
    if(config.coachId==="1329"){
      if(config.cardIds.length!==1||!lineup.has(config.cardIds[0]))return null;
      if(config.moveIndices.length!==2||new Set(config.moveIndices).size!==2||
         config.moveIndices.some(index=>!Number.isInteger(index)||index<0||index>=4))return null;
      const moves=fourMoves(lineup.get(config.cardIds[0]),seasonId);
      return moves.length===4&&config.moveIndices.every(index=>Number(moves[index]?.ptCost)>0)?config:null;
    }
    if(config.coachId==="1777"){
      // Bench player is excluded from the 15-player *cap average* only.
      return config.cardIds.length===1&&bench.has(config.cardIds[0])?config:null;
    }
    if(config.coachId==="1974"){
      const player=config.cardIds.length===1?
        (lineup.get(config.cardIds[0])||bench.get(config.cardIds[0])):null;
      return player&&nextRarity(rarityOf(player))?config:null;
    }
    if(config.coachId==="4401"){
      return config.cardIds.length===1&&lineup.has(config.cardIds[0])&&
        ELEMENTS.includes(config.element)?config:null;
    }
    return null;
  }
  function eligibleRosterForCap(squad,state){
    const roster=[...(squad?.lineup||[]),...(squad?.bench||[])];
    if(id(squad?.coachId)!=="1777"||!owned(state,"1777"))return roster;
    const config=validConfig(squad,squad.lineup||[],state?.activeSeasonId,squad.bench||[]);
    if(!config)return roster;
    const excluded=config.cardIds[0];
    // Do not change legal roster size, recruits, or any other requirement.
    return roster.filter(player=>cardId(player)!==excluded);
  }
  function applyToMatch(match,squad,state,options={}){
    if(!match||!squad||!owned(state,squad.coachId)||match.coachPowerEffect)return match;
    const config=validConfig(squad,match.userSquad?.lineup||[],match.seasonId,match.userSquad?.bench||[]);
    if(!config)return match;
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
        current["user:"+key]+=50; maximum["user:"+key]+=50;
      }
      return {...match,ptCurrentByPlayerId:current,ptMaxByPlayerId:maximum,coachPowerEffect:effect};
    }
    if(coachId==="1329"||coachId==="1777"){
      return {...match,coachPowerEffect:effect};
    }
    if(coachId==="4401"){
      const lineup=match.userSquad.lineup.map(player=>cardId(player)===card?
        {...player,element:config.element}:player);
      return {...match,userSquad:{...match.userSquad,lineup},coachPowerEffect:effect};
    }
    if(coachId==="1974"){
      const original=[...(match.userSquad?.lineup||[]),...(match.userSquad?.bench||[])]
        .find(player=>cardId(player)===card);
      const target=nextRarity(rarityOf(original));
      if(!original||!target||typeof options.upgradeRarity!=="function")return match;
      const upgraded=options.upgradeRarity(original,target,card);
      if(!upgraded||rarityOf(upgraded)!==target||
         !Number.isFinite(Number(upgraded.overall))||
         !upgraded.stats||typeof upgraded.stats!=="object")return match;
      const ptBreakdown=global.RtgFourMovesRuntime?.ptBreakdown;
      if(typeof ptBreakdown!=="function")return match;
      const total=Number(ptBreakdown(upgraded.stats,target)?.total);
      if(!Number.isInteger(total)||total<0)return match;
      const boosted={
        ...original,...upgraded,cardId:card,playerId:original.playerId,
        tacticalRole:original.tacticalRole,move:original.move,
        activeMove:original.activeMove,category:target,finalRarity:target,
      };
      const transform=arr=>(arr||[]).map(player=>cardId(player)===card?boosted:player);
      effect.previousRarity=rarityOf(original);
      effect.targetRarity=target;
      effect.previousOverall=Number(original.overall);
      const current={...(match.ptCurrentByPlayerId||{}),["user:"+card]:total};
      const maximum={...(match.ptMaxByPlayerId||{}),["user:"+card]:total};
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
  global.RoadToGloryCoachPowerRuntime=Object.freeze({
    RARITIES,ELEMENTS,powerReady,nextRarity,rarityOf,selected,fourMoves,validConfig,
    eligibleRosterForCap,applyToMatch,moveCost,
  });
})(globalThis);
