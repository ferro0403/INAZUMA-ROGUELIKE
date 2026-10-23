(function(global){
  "use strict";
  // Only two Squad powers are enabled in this first, independently testable batch.
  // All selections belong to a single Season squad; the match stores a snapshot.
  const id=value=>String(value??"");
  const ids=values=>Array.isArray(values)?values.map(id).filter(Boolean):[];
  const cardId=player=>id(player?.cardId||player?.playerId||player?.id);
  const powerReady=coachId=>coachId==="208"||coachId==="1329";
  function selected(squad){
    const config=squad?.coachPowerSelection;
    if(!config||!powerReady(id(squad?.coachId))||id(config.coachId)!==id(squad.coachId))return null;
    return {
      coachId:id(config.coachId),
      cardIds:ids(config.cardIds),
      moveIndices:Array.isArray(config.moveIndices)?config.moveIndices.map(Number):[],
    };
  }
  function fourMoves(player,seasonId){
    const canonical=id(player?.legacyCanonicalPlayerId||player?.playerId||player?.id).split("@")[0];
    const season=id(player?.resolvedSeasonId||player?.legacySeasonId||seasonId||"ie1");
    return global.RtgFourMovesRuntime?.movesFor?.(season,canonical)||[];
  }
  function validConfig(squad,players,seasonId){
    const config=selected(squad);
    if(!config||!Array.isArray(players)||new Set(config.cardIds).size!==config.cardIds.length)return null;
    const lineup=new Map(players.map(player=>[cardId(player),player]));
    if(config.coachId==="208"){
      if(config.cardIds.length!==2||!config.cardIds.every(key=>lineup.has(key)))return null;
      return config;
    }
    if(config.coachId==="1329"){
      if(config.cardIds.length!==1||!lineup.has(config.cardIds[0]))return null;
      if(config.moveIndices.length!==2||new Set(config.moveIndices).size!==2||
         config.moveIndices.some(index=>!Number.isInteger(index)||index<0||index>=4))return null;
      const moves=fourMoves(lineup.get(config.cardIds[0]),seasonId);
      if(moves.length!==4||config.moveIndices.some(index=>!moves[index]||!(Number(moves[index].ptCost)>0)))return null;
      return config;
    }
    return null;
  }
  function applyToMatch(match,squad,state){
    if(!match||!squad||!global.RoadToGloryCoaches?.owned?.(state)?.has?.(id(squad.coachId)))return match;
    if(match.coachPowerEffect)return match; // never double-apply on a resumed match
    const config=validConfig(squad,match.userSquad?.lineup||[],match.seasonId);
    if(!config||match.ptModeVersion!==1)return match; // old pre-PT matches remain unchanged
    const next={...match,coachPowerEffect:{
      coachId:config.coachId,cardIds:config.cardIds.slice(),moveIndices:config.moveIndices.slice()
    }};
    if(config.coachId==="208"){
      next.ptCurrentByPlayerId={...(match.ptCurrentByPlayerId||{})};
      next.ptMaxByPlayerId={...(match.ptMaxByPlayerId||{})};
      for(const card of config.cardIds){
        const key="user:"+card;
        if(!Number.isFinite(Number(next.ptMaxByPlayerId[key]))||
           !Number.isFinite(Number(next.ptCurrentByPlayerId[key])))return match;
        next.ptMaxByPlayerId[key]=Number(next.ptMaxByPlayerId[key])+50;
        next.ptCurrentByPlayerId[key]=Number(next.ptCurrentByPlayerId[key])+50;
      }
    }
    return next;
  }
  function moveCost(match,side,playerId,moveIndex,ordinaryCost){
    const config=match?.coachPowerEffect;
    if(side!=="user"||config?.coachId!=="1329"||config.cardIds?.[0]!==id(playerId)||
       !config.moveIndices?.includes(moveIndex))return ordinaryCost;
    return Number.isInteger(ordinaryCost)&&ordinaryCost>0?Math.ceil(ordinaryCost/2):ordinaryCost;
  }
  global.RoadToGloryCoachPowerRuntime=Object.freeze({
    powerReady,selected,fourMoves,validConfig,applyToMatch,moveCost,
  });
})(globalThis);
