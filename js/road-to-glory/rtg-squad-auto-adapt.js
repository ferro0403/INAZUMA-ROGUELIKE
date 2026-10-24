(function(global){
  "use strict";
  // Deterministic, bounded, formation-aware RTG squad planner. Owns no persistence.
  // First find a minimum-power feasible 15-card roster (nested quotas), then
  // spend the remaining power budget without losing recruitment requirements.
  const role=e=>String(e?.role||"").toUpperCase();
  const id=e=>String(e?.playerId||"");
  const cost=e=>Number(e?.contribution||0);
  function slotRoles(formation){
    const slots=Array.isArray(formation?.slotRoles)&&formation.slotRoles.length===11
      ?formation.slotRoles.map(v=>String(v).toUpperCase())
      :Object.entries(formation?.requirements||{}).flatMap(([r,n])=>Array.from({length:Number(n)||0},()=>String(r).toUpperCase()));
    return slots.length===11&&slots.filter(s=>s==="GK").length===1
      &&slots.every(s=>["GK","DF","MF","FW"].includes(s))?slots:null;
  }
  function layout(entries,formation,forcedId){
    const slots=slotRoles(formation);
    if(!slots||entries.length!==15)return null;
    const keepers=entries.filter(e=>role(e)==="GK"&&id(e)!==forcedId);
    if(!keepers.length)return null;
    const initialGK=keepers.sort((a,b)=>Number(b.inLineup||0)-Number(a.inLineup||0)
      ||cost(b)-cost(a)||id(a).localeCompare(id(b)))[0];
    const movement=entries.filter(e=>role(e)!=="GK"&&id(e)!==forcedId);
    if(movement.length<10)return null;
    const lineup=new Array(11);
    const used=new Set([id(initialGK)]);
    lineup[slots.indexOf("GK")]=id(initialGK);
    // Fill scarcest tactical positions first, but permit any movement role.
    const outfieldSlots=slots.map((r,i)=>({r,i})).filter(x=>x.r!=="GK");
    outfieldSlots.sort((a,b)=>{
      const count=r=>movement.filter(e=>role(e)===r).length;
      return count(a.r)-count(b.r)||a.i-b.i;
    });
    for(const {r,i} of outfieldSlots){
      const chosen=movement.filter(e=>!used.has(id(e))).sort((a,b)=>
        Number(role(b)===r)-Number(role(a)===r)||
        Number(b.inLineup||0)-Number(a.inLineup||0)||
        cost(b)-cost(a)||id(a).localeCompare(id(b)))[0];
      if(!chosen)return null;
      lineup[i]=id(chosen);used.add(id(chosen));
    }
    const bench=entries.filter(e=>!used.has(id(e))).map(id);
    return bench.length===4&&(!forcedId||bench.includes(forcedId))?{lineup,bench}:null;
  }
  function plan({pool=[],formations=[],constraint={},fixedBenchId="",originalSquad={},evaluate}={}){
    const cap=Number(constraint.cap),minRecruit=Math.max(0,Number(constraint.minRecruit)||0),
      minRecent=Math.max(0,Number(constraint.recentCount)||0);
    if(!Number.isFinite(cap)||minRecruit>15||minRecent>minRecruit||pool.length<15||!formations.length)return null;
    const seen=new Set();
    const entries=pool.filter(e=>{
      const key=id(e);
      if(!key||seen.has(key)||!Number.isFinite(cost(e)))return false;
      seen.add(key);return true;
    }).map(e=>({...e,role:role(e),recruit:!!e.recruit,recent:!!e.recent,
      inLineup:(originalSquad?.lineup||[]).includes(id(e))}));
    const forced=fixedBenchId?entries.find(e=>id(e)===fixedBenchId):null;
    if(fixedBenchId&&!forced)return null;
    const remaining=entries.filter(e=>id(e)!==fixedBenchId);
    const countKey=x=>[x.n,x.r,x.t,x.g].join(":");
    const root={n:forced?1:0,r:forced?.recruit?1:0,t:forced?.recent?1:0,
      g:role(forced)==="GK"?1:0,sum:forced?cost(forced):0,
      keep:Number(!!forced?.inLineup),chain:forced?{e:forced,prev:null}:null};
    const dp=new Map([[countKey(root),root]]);
    for(const e of remaining){
      const previous=Array.from(dp.values());
      for(const item of previous){
        if(item.n>=15)continue;
        const g=item.g+Number(role(e)==="GK");
        if(g>5)continue; // exactly 11 on field and at most four bench keepers
        const next={n:item.n+1,r:Math.min(minRecruit,item.r+Number(e.recruit)),
          t:Math.min(minRecent,item.t+Number(e.recent)),
          g,sum:item.sum+cost(e),keep:item.keep+Number(e.inLineup),
          chain:{e,prev:item.chain}};
        const key=countKey(next),prior=dp.get(key);
        if(!prior||next.sum<prior.sum-1e-8||
           (Math.abs(next.sum-prior.sum)<1e-8&&next.keep>prior.keep))dp.set(key,next);
      }
    }
    const neededGK=role(forced)==="GK"?2:1;
    const final=Array.from(dp.values()).filter(x=>x.n===15&&x.r>=minRecruit&&x.t>=minRecent&&x.g>=neededGK&&x.g<=5)
      .sort((a,b)=>a.sum-b.sum||b.keep-a.keep)[0];
    if(!final||final.sum>cap*15+1e-8)return null;
    const chosen=[];for(let node=final.chain;node;node=node.prev)chosen.push(node.e);
    let total=final.sum;
    const selected=new Set(chosen.map(id));
    const roleOf=entry=>role(entry)==="GK";
    const rec=x=>x.reduce((n,e)=>n+Number(e.recruit),0),
      recent=x=>x.reduce((n,e)=>n+Number(e.recent),0);
    // Monotonic one-card upgrades: never exceed cap or violate 15-card quotas.
    // 45 steps bound mobile CPU while still using available cap headroom.
    for(let step=0;step<45;step++){
      const recruits=rec(chosen),recents=recent(chosen),gk=chosen.filter(roleOf).length;
      let best=null;
      for(let i=0;i<chosen.length;i++){
        const outgoing=chosen[i];
        if(id(outgoing)===fixedBenchId)continue;
        for(const incoming of entries){
          if(selected.has(id(incoming)))continue;
          const gain=cost(incoming)-cost(outgoing);
          if(gain<=1e-7||total+gain>cap*15+1e-8)continue;
          if(recruits-Number(outgoing.recruit)+Number(incoming.recruit)<minRecruit||
             recents-Number(outgoing.recent)+Number(incoming.recent)<minRecent)continue;
          const nextGk=gk-Number(roleOf(outgoing))+Number(roleOf(incoming));
          if(nextGk<neededGK||nextGk>5)continue;
          // Keep GK-only constraints, allow FW/MF/DF swaps freely.
          const spreadImprovement=Math.abs(cost(outgoing)-cap)-Math.abs(cost(incoming)-cap);
          if(!best||spreadImprovement>best.spreadImprovement+1e-8||
             (Math.abs(spreadImprovement-best.spreadImprovement)<1e-8&&gain>best.gain+1e-8)||
             (Math.abs(spreadImprovement-best.spreadImprovement)<1e-8&&Math.abs(gain-best.gain)<1e-8&&id(incoming)<id(best.incoming)))
            best={i,outgoing,incoming,gain,spreadImprovement};
        }
      }
      if(!best)break;
      selected.delete(id(best.outgoing));selected.add(id(best.incoming));
      chosen[best.i]=best.incoming;total+=best.gain;
    }
    const preferred=String(originalSquad?.formationId||"");
    let winner=null;
    for(const formation of formations){
      const arranged=layout(chosen,formation,fixedBenchId);
      if(!arranged)continue;
      const proposed={...originalSquad,formationId:String(formation.id),...arranged,
        lineupOrderedBySlot:true,activeRoleVariantByCardId:{...(originalSquad?.activeRoleVariantByCardId||{})}};
      const eligibility=evaluate?.(proposed,formation);
      if(!eligibility?.eligible)continue; // authoritative RTG contract wins
      const playerById=new Map(chosen.map(e=>[id(e),e]));
      const slots=slotRoles(formation);
      const roleMismatch=proposed.lineup.reduce((n,k,i)=>n+Number(role(playerById.get(k))!==slots[i]),0);
      const score={squad:proposed,eligibility,targetShortfall:Math.max(0,cap*15-total),
        balanceSpread:roleMismatch,
        penalty:roleMismatch*100+Number(String(formation.id)!==preferred)*0.001};
      if(!winner||score.penalty<winner.penalty)winner=score;
    }
    return winner;
  }
  global.RoadToGlorySquadAutoAdapt=Object.freeze({plan,layout,slotRoles});
})(globalThis);
