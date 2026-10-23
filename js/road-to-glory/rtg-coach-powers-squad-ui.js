(function(global){
  "use strict";
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const id=value=>String(value??"");
  let busy=false;
  function open(ctx){
    const rules=global.RoadToGloryCoachPowerRuntime;
    const squad=ctx.getSquadDraft?.();
    const coachId=id(squad?.coachId);
    if(!rules?.powerReady(coachId)||!global.RoadToGloryCoaches?.owned?.(ctx.getCampaign())?.has(coachId))
      return ctx.toast?.("Il potere di questo allenatore non è ancora configurabile.","error");
    if(ctx.getCampaign()?.activeMatch)return ctx.toast?.("Completa prima la partita in corso.","error");
    const existing=rules.selected(squad);
    const choice={
      coachId,
      cardIds:existing?.cardIds?.slice()||[],
      moveIndices:existing?.moveIndices?.slice()||[],
    };
    const resolve=(key)=>{
      const variant=squad?.activeRoleVariantByCardId?.[key]||null;
      return ctx.resolve?.(key,variant)||null;
    };
    const players=()=>Array.from(squad?.lineup||[]).map(key=>({key:id(key),player:resolve(key)}));
    const moves=()=>choice.cardIds.length===1?rules.fourMoves(resolve(choice.cardIds[0]),ctx.seasonId()):[];
    function isComplete(){
      if(coachId==="208")return choice.cardIds.length===2;
      const all=moves();
      return choice.cardIds.length===1&&all.length===4&&choice.moveIndices.length===2&&
        choice.moveIndices.every(index=>Number(all[index]?.ptCost)>0);
    }
    function render(){
      const entries=players();
      const note=coachId==="208"
        ?"Seleziona 2 titolari: +50 PT iniziali e massimi a entrambi."
        :"Seleziona 1 titolare e 2 delle sue 4 mosse: ciascun costo PT si dimezza (arrotondato per eccesso).";
      const playerButtons=entries.map(({key,player})=>{
        const active=choice.cardIds.includes(key);
        const label=player?.name||player?.displayName||player?.playerName||key;
        return '<button type="button" class="rtg-coach-power-option'+(active?' is-selected':'')+
          '" data-rtg-coach-power-player="'+esc(key)+'" aria-pressed="'+active+'">'+
          '<strong>'+esc(label)+'</strong><span>'+esc(player?.normalizedRole||player?.position||player?.role||"")+
          '</span>'+(active?'<b>✓</b>':'')+'</button>';
      }).join("");
      const allMoves=moves();
      const moveButtons=coachId==="1329"&&choice.cardIds.length===1
        ?('<div class="rtg-coach-power-choices"><h4>MOSSE SPECIALI ('+choice.moveIndices.length+'/2)</h4>'+
          (allMoves.length===4?allMoves.map((move,index)=>{
            const active=choice.moveIndices.includes(index),cost=Number(move?.ptCost);
            return '<button type="button" class="rtg-coach-power-option'+(active?' is-selected':'')+
              '" data-rtg-coach-power-move="'+index+'" aria-pressed="'+active+'" '+(!(cost>0)?'disabled':'')+'>'+
              '<strong>'+esc(move?.name||"Mossa "+(index+1))+'</strong><span>'+
              esc(cost>0?('PT '+cost+' → '+Math.ceil(cost/2)):'Costo non disponibile')+
              '</span>'+(active?'<b>✓</b>':'')+'</button>';
          }).join(""):'<p>Le quattro mosse speciali non sono disponibili per questo giocatore.</p>')+'</div>')
        :"";
      const body='<section class="rtg-coach-power-config" aria-label="Configura potere allenatore">'+
        '<h2>'+esc(coachId==="208"?"FIDUCIA NEI CAMPIONI":"ALLENAMENTO SPECIALIZZATO")+'</h2>'+
        '<p>'+esc(note)+'</p><div class="rtg-coach-power-choices"><h4>TITOLARI ('+
        choice.cardIds.length+'/'+(coachId==="208"?"2":"1")+')</h4>'+playerButtons+
        '</div>'+moveButtons+'<div class="rtg-coach-power-actions">'+
        '<button type="button" class="btn btn-yellow" data-rtg-coach-power-save '+(isComplete()?'':'disabled')+
        '>CONFERMA POTERE</button><button type="button" class="btn" data-rtg-coach-power-cancel>ANNULLA</button>'+
        '<button type="button" class="btn" data-rtg-coach-power-clear>AZZERA SELEZIONE</button></div></section>';
      ctx.openModal?.(body,{className:"rtg-modal rtg-coach-power-modal"});
      const root=ctx.getModalRoot?.();
      root?.querySelectorAll?.("[data-rtg-coach-power-player]")?.forEach(button=>button.addEventListener("click",()=>{
        if(busy)return;
        const key=id(button.dataset.rtgCoachPowerPlayer);
        if(choice.cardIds.includes(key))choice.cardIds=choice.cardIds.filter(value=>value!==key);
        else if(coachId==="1329")choice.cardIds=[key];
        else if(choice.cardIds.length<2)choice.cardIds.push(key);
        if(coachId==="1329")choice.moveIndices=[];
        render();
      }));
      root?.querySelectorAll?.("[data-rtg-coach-power-move]")?.forEach(button=>button.addEventListener("click",()=>{
        if(busy)return;
        const index=Number(button.dataset.rtgCoachPowerMove);
        if(choice.moveIndices.includes(index))choice.moveIndices=choice.moveIndices.filter(x=>x!==index);
        else if(choice.moveIndices.length<2)choice.moveIndices.push(index);
        render();
      }));
      root?.querySelector?.("[data-rtg-coach-power-cancel]")?.addEventListener("click",()=>ctx.closeModal?.());
      root?.querySelector?.("[data-rtg-coach-power-clear]")?.addEventListener("click",()=>{
        if(busy)return;
        choice.cardIds=[];choice.moveIndices=[];render();
      });
      root?.querySelector?.("[data-rtg-coach-power-save]")?.addEventListener("click",async()=>{
        if(busy||!isComplete())return;
        busy=true;
        try{
          const current=ctx.getSquadDraft();
          if(id(current?.coachId)!==coachId)throw new Error("Allenatore cambiato: riapri la configurazione");
          if(ctx.getCampaign()?.activeMatch)throw new Error("Partita già in corso");
          const draft={...current,coachPowerSelection:{
            coachId,cardIds:choice.cardIds.slice(),moveIndices:choice.moveIndices.slice()
          }};
          const lineup=draft.lineup.map(key=>resolve(key)).filter(Boolean).map((player,index)=>({
            ...player,cardId:id(draft.lineup[index])
          }));
          if(!rules.validConfig(draft,lineup,ctx.seasonId()))throw new Error("Selezione non valida");
          await ctx.saveSquad(draft);
          ctx.closeModal?.();
          ctx.toast?.("Potere allenatore configurato per la squadra");
        }catch(error){ctx.toast?.(error?.message||"Impossibile salvare il potere","error");}
        finally{busy=false;}
      });
    }
    render();
  }
  global.RoadToGloryCoachSquadPowerUi=Object.freeze({open});
})(globalThis);
