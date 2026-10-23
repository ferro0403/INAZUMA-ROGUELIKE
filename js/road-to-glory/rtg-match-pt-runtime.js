(function(global) {
  "use strict";
  // RTG-only, snapshotted match PT. Old matches without ptModeVersion retain 2-use behavior.
  const id=value=>String(value??"");
  const key=(side,pid)=>side+":"+id(pid);
  const playerId=p=>id(p?.cardId||p?.playerId||p?.id);
  const players=s=>[...(s?.lineup||[]),...(s?.bench||[])];
  const inMatch=state=>state?.ptModeVersion===1&&!!state.ptCurrentByPlayerId;
  const runtime=()=>global.RtgFourMovesRuntime;
  const readyForMatch=()=>runtime()?.isReady?.()===true&&!runtime()?.error?.()&&typeof runtime()?.ptBreakdown==="function";
  const kindOf=(kind,hasPossession=true)=>kind==="midfield"?(hasPossession?"dribble":"defense"):kind;
  const getPlayer=(state,side,pid)=>players(side==="user"?state.userSquad:state.opponentSquad)
    .find(p=>playerId(p)===id(pid))||null;
  function initialState(state) {
    if(!readyForMatch())throw Object.assign(new Error("RTG four-move data unavailable"),{code:"rtg-pt-catalog-not-ready"});
    state.ptModeVersion=1;
    state.ptCurrentByPlayerId={};
    state.ptMaxByPlayerId={};
    for(const side of ["user","opponent"]) {
      for(const p of players(side==="user"?state.userSquad:state.opponentSquad)) {
        const stats=p?.baseStats||p?.stats||p;
        const breakdown=runtime().ptBreakdown(stats,p?.finalRarity||p?.category);
        const value=breakdown.total;
        if(!Number.isInteger(value)||value<0)throw new Error("Invalid RTG player PT");
        state.ptCurrentByPlayerId[key(side,playerId(p))]=value;
        state.ptMaxByPlayerId[key(side,playerId(p))]=value;
      }
    }
    return state;
  }
  function pt(state,side,pid) {
    if(!inMatch(state))return null;
    const k=key(side,pid);
    const max=Number(state.ptMaxByPlayerId?.[k]);
    const remaining=Number(state.ptCurrentByPlayerId?.[k]);
    return Number.isFinite(max)&&Number.isFinite(remaining)
      ? {remaining:Math.max(0,Math.min(max,remaining)),max}:null;
  }
  function cost(move) {
    const n=Number(move?.ptCost??move?.power);
    return Number.isInteger(n)&&n>0&&n<=110?n:null;
  }
  function compatible(state,side,pid,kind,hasPossession=true) {
    const player=getPlayer(state,side,pid);
    if(!player)return [];
    const season=id(player.resolvedSeasonId||player.legacySeasonId||
      (side==="user"?state.userSquad?.seasonId:state.opponentSquad?.seasonId)||state.seasonId||"ie1");
    const canonical=id(player.legacyCanonicalPlayerId||player.playerId||player.id||pid);
    const catalog=runtime()?.movesFor?.(season,canonical)||[];
    // A free agent without an extracted 4-move catalog keeps its verified legacy move.
    const moves=catalog.length?catalog:[player.activeMove||player.move].filter(Boolean);
    const type=kindOf(kind,hasPossession);
    return moves.map((m,index)=>({m,index})).filter(({m})=>m&&String(m.type||"").toLowerCase()===type)
      .map(({m,index})=>({...m,ptCost:global.RoadToGloryCoachPowerRuntime?.moveCost?.(state,side,pid,index,cost(m))??cost(m)}));
  }
  function affordable(state,side,pid,options) {
    const balance=pt(state,side,pid)?.remaining??0;
    return (options||[]).map((move,index)=>({move,index}))
      .filter(o=>o.move.ptCost!==null&&o.move.ptCost<=balance);
  }
  function chosenAi(state,side,pid,options,stream) {
    const candidates=affordable(state,side,pid,options);
    if(!candidates.length)return null;
    // Deterministic seeded weighted draw, preferring stronger moves but retaining variety.
    const weights=candidates.map(({move})=>Math.max(1,Number(move.power)||1));
    const total=weights.reduce((a,b)=>a+b,0);
    let ticket=global.RoadToGloryRng.float(state.seed,stream,0)*total;
    for(let i=0;i<candidates.length;i++) {
      ticket-=weights[i];
      if(ticket<0)return candidates[i].move;
    }
    return candidates.at(-1).move;
  }
  function selectedUser(state,pending,choice) {
    if(!/^move:\d+$/.test(choice))throw Object.assign(new Error("Invalid PT move choice"),{code:"rtg-pt-choice-invalid"});
    const index=Number(choice.slice(5));
    const move=pending.userMoveOptions?.[index]||null;
    if(!move||!affordable(state,pending.userSide,pending.userPlayerId,[move]).length)
      throw Object.assign(new Error("Insufficient PT or unavailable move"),{code:"rtg-pt-move-unavailable"});
    return move;
  }
  function consume(state,side,pid,move) {
    if(!move)return;
    const value=cost(move),k=key(side,pid),balance=pt(state,side,pid)?.remaining;
    if(value===null||balance===undefined||value>balance)throw Object.assign(
      new Error("RTG PT insufficient"),{code:"rtg-pt-insufficient",playerId:id(pid),side});
    state.ptCurrentByPlayerId[k]=balance-value;
  }
  global.RoadToGloryMatchPtRuntime=Object.freeze({
    readyForMatch,inMatch,initialState,pt,compatible,affordable,chosenAi,selectedUser,consume,
  });
})(globalThis);
