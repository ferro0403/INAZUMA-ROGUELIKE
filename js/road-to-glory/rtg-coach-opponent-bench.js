(function(global){
  "use strict";
  // Add actual unused roster cards to the *opponent match snapshot only*.
  // No generated/fake cards, no changes to normal matches or permanent rosters.
  const id=x=>String(x??"");
  const pid=p=>id(p?.cardId||p?.playerId||p?.id);
  const canonical=p=>id(p?.legacyCanonicalPlayerId||p?.playerId||p?.id).split("@")[0];
  function build({opponent,node,teamRecord,freeAgentsDb,resolveForTeam,resolveStandard}={}){
    if(!opponent||!["36","1225"].includes(id(node?.coachId)))return opponent;
    const used=new Set((opponent.lineup||[]).flatMap(p=>[pid(p),canonical(p)]));
    const candidates=[];
    if(node.type==="main"){
      for(const key of (teamRecord?.playerIds||[])){
        const p=resolveForTeam?.(key,node.teamId);
        if(p&&![pid(p),canonical(p)].some(x=>used.has(x)))candidates.push(p);
      }
    }else{
      for(const p of (freeAgentsDb?.players||[])){
        const key=id(p?.playerId||p?.id);
        if(!used.has(key)){
          const resolved=resolveStandard?.(key);
          if(resolved)candidates.push(resolved);
        }
      }
    }
    const avg=(opponent.lineup||[]).reduce((sum,p)=>sum+Number(p.overall||0),0)/
      Math.max(1,(opponent.lineup||[]).length);
    const ordered=candidates.sort((a,b)=>
      Math.abs(Number(a.overall||0)-avg)-Math.abs(Number(b.overall||0)-avg)||
      canonical(a).localeCompare(canonical(b)));
    const bench=[];
    for(const player of ordered){
      if(bench.length===4)break;
      if(used.has(pid(player))||used.has(canonical(player)))continue;
      bench.push(player);used.add(pid(player));used.add(canonical(player));
    }
    return {...opponent,bench};
  }
  global.RoadToGloryCoachOpponentBench=Object.freeze({build});
})(globalThis);
