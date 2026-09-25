(function (global) {
  "use strict";

  const id=(value)=>String(value??"");
  const roleOf=(player)=>String(player?.normalizedRole||player?.position||player?.role||"").toUpperCase();
  const overallOf=(player)=>Number(player?.finalOverall??player?.overall??0)||0;

  function deterministicCandidate(pool,{seed,attemptNumber,buildAttempt,slot,target,used}){
    const ranked=pool
      .filter((player)=>!used.has(id(player.playerId||player.id)))
      .map((player)=>({
        player,
        distance:Math.abs(overallOf(player)-target),
        jitter:global.RoadToGloryRng.float(seed,`secondary-player-rank:${attemptNumber}:${buildAttempt}:${slot}`,id(player.playerId||player.id).split("").reduce((s,ch)=>s+ch.charCodeAt(0),0)),
      }))
      .sort((a,b)=>a.distance-b.distance||a.jitter-b.jitter||id(a.player.playerId||a.player.id).localeCompare(id(b.player.playerId||b.player.id)));
    if(!ranked.length)return null;
    const window=Math.min(18,ranked.length);
    const pickIndex=global.RoadToGloryRng.int(seed,`secondary-player-pick:${attemptNumber}:${buildAttempt}:${slot}`,slot,window);
    return ranked[pickIndex]?.player||ranked[0].player;
  }

  function buildCandidate({seed,attemptNumber,buildAttempt,freeAgentsDb,formations,targetMin,targetMax,playerResolver}){
    const formationList=(formations||[]).filter((formation)=>Array.isArray(formation?.slotRoles)&&formation.slotRoles.length===11);
    if(!formationList.length)throw Object.assign(new Error("No RTG secondary formation"),{code:"rtg-secondary-formation-unavailable"});
    const formation=formationList[global.RoadToGloryRng.int(seed,`secondary-formation:${attemptNumber}`,buildAttempt,formationList.length)];
    const spread=Math.max(0,Number(targetMax)-Number(targetMin));
    const target=Number(targetMin)+(spread*global.RoadToGloryRng.float(seed,`secondary-target:${attemptNumber}`,buildAttempt));
    const byRole={GK:[],DF:[],MF:[],FW:[]};
    for(const player of freeAgentsDb?.players||[]){
      const role=roleOf(player);
      if(byRole[role])byRole[role].push(player);
    }
    const used=new Set(),playerIds=[];
    for(let slot=0;slot<formation.slotRoles.length;slot+=1){
      const role=String(formation.slotRoles[slot]||"").toUpperCase();
      const player=deterministicCandidate(byRole[role]||[],{seed,attemptNumber,buildAttempt,slot,target,used});
      if(!player)return null;
      const playerId=id(player.playerId||player.id);
      used.add(playerId);playerIds.push(playerId);
    }
    const teamPower=global.RoadToGlorySquadRuntime.teamPower({
      lineup:playerIds,
      activeSeasonId:"ie1",
      playerResolver,
      freeAgentsDb,
    });
    return Object.freeze({formationId:id(formation.id),playerIds:Object.freeze(playerIds),teamPower,name:"Svincolati"});
  }

  function generate({seed,attemptNumber=1,freeAgentsDb,formations,targetMin,targetMax,playerResolver}={}){
    const min=Number(targetMin),max=Number(targetMax);
    if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)throw Object.assign(new Error("Invalid RTG secondary band"),{code:"rtg-secondary-opponent-band-invalid"});
    let closest=null,closestDistance=Infinity;
    for(let buildAttempt=0;buildAttempt<64;buildAttempt+=1){
      const candidate=buildCandidate({seed,attemptNumber,buildAttempt,freeAgentsDb,formations,targetMin:min,targetMax:max,playerResolver});
      if(!candidate)continue;
      if(candidate.teamPower>=min&&candidate.teamPower<=max)return candidate;
      const distance=candidate.teamPower<min?min-candidate.teamPower:candidate.teamPower-max;
      if(distance<closestDistance){closestDistance=distance;closest=candidate;}
    }
    throw Object.assign(new Error("Nessuna squadra svincolati nella fascia RTG richiesta"),{
      code:"rtg-secondary-opponent-band-unavailable",
      targetMin:min,targetMax:max,closestPower:closest?.teamPower??null,
    });
  }

  global.RoadToGloryOpponentGenerator=Object.freeze({generate});
})(globalThis);
