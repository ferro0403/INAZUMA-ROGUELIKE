(function(global){
  "use strict";
  // Pre-match coach powers: effects live only in the saved activeMatch snapshot.
  const id=x=>String(x??"");
  const pid=p=>id(p?.cardId||p?.playerId||p?.id);
  const role=p=>id(p?.tacticalRole||p?.normalizedRole||p?.position||p?.role).toUpperCase();
  const actualRole=p=>id(p?.normalizedRole||p?.position||p?.role).toUpperCase();
  const indices=list=>Array.isArray(list)?list.map(Number):[];
  const ids=list=>Array.isArray(list)?list.map(id):[];
  const PREMATCH_IDS=Object.freeze(["36","1225","1275","1940","4761"]);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function owns(state,coachId){return global.RoadToGloryCoaches?.owned?.(state)?.has?.(id(coachId))===true;}
  function coachFor(state,seasonId){
    const coachId=id(state?.squads?.[id(seasonId)]?.coachId);
    return PREMATCH_IDS.includes(coachId)&&owns(state,coachId)?coachId:"";
  }
  function canSwap(target,replacement){
    if(!target||!replacement||pid(target)===pid(replacement))return false;
    const a=actualRole(target),b=actualRole(replacement);
    return a==="GK"?b==="GK":a!=="GK"&&b!=="GK";
  }
  function movesFor(match,player){
    const season=id(player?.resolvedSeasonId||player?.legacySeasonId||match?.seasonId||"ie1");
    const canonical=id(player?.legacyCanonicalPlayerId||player?.playerId||player?.id).split("@")[0];
    return global.RtgFourMovesRuntime?.movesFor?.(season,canonical)||[];
  }
  function validate(match,coachId,selection){
    if(!match||id(match.preMatchCoachId)!==id(coachId)||!selection||
       match.presentation?.preMatchPowerStatus!=="pending")return null;
    const opponents=match.opponentSquad||{},users=match.userSquad||{};
    const oppLineup=opponents.lineup||[],oppBench=opponents.bench||[],userBench=users.bench||[];
    const byId=(players,key)=>players.find(p=>pid(p)===id(key));
    const players=ids(selection.playerIds);
    switch(id(coachId)){
      case "36": {
        if(players.length!==2)return null;
        const a=byId(oppLineup,players[0]),b=byId(oppBench,players[1]);
        return canSwap(a,b)?{playerIds:players}:null;
      }
      case "1225": {
        if(players.length!==2)return null;
        const a=byId(oppBench,players[0]),b=byId(userBench,players[1]);
        return a&&b&&pid(a)!==pid(b)&&
          ![...(users.lineup||[]),...userBench].some(p=>pid(p)===pid(a))
          ?{playerIds:players}:null;
      }
      case "1275":
        return players.length===2&&new Set(players).size===2&&
          players.every(key=>byId(oppLineup,key))&&match.ptModeVersion===1
            ?{playerIds:players}:null;
      case "1940": {
        if(players.length!==1)return null;
        const p=byId(oppLineup,players[0]),catalog=movesFor(match,p);
        // Store every available real move in the new match; old match snapshots stay unchanged.
        return p&&catalog.length>0&&catalog.length<=4&&
          catalog.every(m=>Number.isInteger(Number(m?.ptCost))&&Number(m.ptCost)>0)
          ?{playerIds:players,moveIndices:catalog.map((_,index)=>index)}:null;
      }
      case "4761":
        return players.length===2&&new Set(players).size===2&&players.every(key=>{
          const player=byId(oppLineup,key);return player&&actualRole(player)!=="GK";
        })?{playerIds:players}:null;
      default:return null;
    }
  }
  function apply(match,coachId,selection){
    if(!match||match.presentation?.preMatchPowerStatus!=="pending")return match;
    const valid=validate(match,coachId,selection);
    if(!valid)return null;
    const next=clone(match),opp=next.opponentSquad,user=next.userSquad,players=valid.playerIds;
    const idx=(list,key)=>list.findIndex(p=>pid(p)===key);
    if(coachId==="36"){
      const i=idx(opp.lineup,players[0]),j=idx(opp.bench,players[1]),starter=opp.lineup[i],reserve=opp.bench[j];
      opp.lineup[i]={...reserve,tacticalRole:role(starter)};
      opp.bench[j]={...starter,tacticalRole:role(reserve)};
    }else if(coachId==="1225"){
      const i=idx(opp.bench,players[0]),j=idx(user.bench,players[1]);
      const borrowed=opp.bench.splice(i,1)[0],displaced=user.bench[j];
      user.bench[j]=borrowed;
      // The displaced player is out of this match, not sent to the opponent.
      next.userRosterIds=[...(user.lineup||[]),...(user.bench||[])].map(pid);
      if(next.ptModeVersion===1){
        const opponentKey="opponent:"+pid(borrowed),userKey="user:"+pid(borrowed);
        next.ptCurrentByPlayerId[userKey]=next.ptCurrentByPlayerId[opponentKey];
        next.ptMaxByPlayerId[userKey]=next.ptMaxByPlayerId[opponentKey];
        delete next.ptCurrentByPlayerId[opponentKey];
        delete next.ptMaxByPlayerId[opponentKey];
        delete next.ptCurrentByPlayerId["user:"+pid(displaced)];
        delete next.ptMaxByPlayerId["user:"+pid(displaced)];
      }
    }else if(coachId==="1275"){
      for(const key of players) {
        const ptKey="opponent:"+key;
        next.ptCurrentByPlayerId[ptKey]=Math.ceil(next.ptCurrentByPlayerId[ptKey]/2);
      }
    }else if(coachId==="4761"){
      const i=idx(opp.lineup,players[0]),j=idx(opp.lineup,players[1]);
      const a=opp.lineup[i],b=opp.lineup[j];
      opp.lineup[i]={...b,tacticalRole:role(a)};
      opp.lineup[j]={...a,tacticalRole:role(b)};
    }
    next.preMatchCoachEffect={coachId,...valid};
    next.presentation.preMatchPowerStatus="applied";
    return next;
  }
  function skip(match){
    if(match?.presentation?.preMatchPowerStatus!=="pending")return null;
    const next=clone(match);
    next.presentation.preMatchPowerStatus="skipped";
    return next;
  }
  function blocked(match,side,playerId,moveIndex){
    const effect=match?.preMatchCoachEffect;
    return side==="opponent"&&effect?.coachId==="1940"&&
      effect.playerIds?.[0]===id(playerId)&&effect.moveIndices?.includes(moveIndex);
  }
  global.RoadToGloryCoachPreMatchRuntime=Object.freeze({
    PREMATCH_IDS,coachFor,validate,apply,skip,blocked,canSwap,movesFor,
  });
})(globalThis);
