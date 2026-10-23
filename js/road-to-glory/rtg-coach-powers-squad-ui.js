(function(global){
  "use strict";
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const id=value=>String(value??"");
  const ELEMENTS=Object.freeze([
    {key:"fire",label:"FUOCO"},{key:"wind",label:"VENTO"},
    {key:"forest",label:"BOSCO"},{key:"mountain",label:"MONTAGNA"},
  ]);
  const POWER_LABELS=Object.freeze({
    "208":"FIDUCIA NEI CAMPIONI","1329":"ALLENAMENTO SPECIALIZZATO",
    "1777":"FUORI QUOTA","1974":"POTENZIALE RISVEGLIATO","4401":"CAMBIO DI ELEMENTO",
  });
  const POWER_NOTES=Object.freeze({
    "208":"Scegli 2 titolari: entrambi avranno +50 PT iniziali e massimi durante la partita.",
    "1329":"Scegli 1 titolare e 2 delle sue 4 mosse: il costo PT sarà dimezzato, arrotondato per eccesso.",
    "1777":"Scegli 1 riserva: per i soli requisiti di overall della prossima partita il suo contributo non sarà conteggiato. Rimane una riserva utilizzabile.",
    "1974":"Scegli 1 titolare o riserva: salirà di 1 rarità fino ad Aurico, con statistiche reali potenziate soltanto nella partita. L'overall d'accesso resta quello originale.",
    "4401":"Scegli 1 titolare e il nuovo elemento da usare per la partita: Fuoco, Vento, Bosco o Montagna.",
  });
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
      coachId,cardIds:existing?.cardIds?.slice()||[],
      moveIndices:existing?.moveIndices?.slice()||[],
      element:existing?.element||"",
    };
    const resolve=key=>{
      const variant=squad?.activeRoleVariantByCardId?.[key]||null;
      return ctx.resolve?.(key,variant)||null;
    };
    const candidates=()=>{
      const roster=[...(squad?.lineup||[]).map(key=>({key:id(key),area:"TITOLARE"})),
        ...(squad?.bench||[]).map(key=>({key:id(key),area:"RISERVA"}))];
      return roster.filter(row=>coachId==="1974"||(
        coachId==="1777"?row.area==="RISERVA":row.area==="TITOLARE"
      )).map(row=>({...row,player:resolve(row.key)}));
    };
    const moves=()=>coachId==="1329"&&choice.cardIds.length===1?
      rules.fourMoves(resolve(choice.cardIds[0]),ctx.seasonId()):[];
    const maxPlayers=()=>coachId==="208"?2:1;
    function canSelect(row){
      return coachId!=="1974"||!!rules.nextRarity(rules.rarityOf(row.player));
    }
    function isComplete(){
      const all=candidates(),selected=all.filter(row=>choice.cardIds.includes(row.key));
      if(selected.length!==maxPlayers()||choice.cardIds.length!==maxPlayers()||
         selected.some(row=>!canSelect(row)))return false;
      if(coachId==="1329"){
        const catalog=moves();
        return catalog.length===4&&choice.moveIndices.length===2&&
          new Set(choice.moveIndices).size===2&&choice.moveIndices.every(index=>
            Number(catalog[index]?.ptCost)>0);
      }
      return coachId!=="4401"||ELEMENTS.some(item=>item.key===choice.element);
    }
    function render(){
      const options=candidates();
      const playerButtons=options.map(row=>{
        const active=choice.cardIds.includes(row.key);
        const label=row.player?.name||row.player?.displayName||row.player?.playerName||row.key;
        const rarity=rules.rarityOf(row.player);
        const canUse=canSelect(row);
        const extra=coachId==="1974"?(rarity+(canUse?" → "+rules.nextRarity(rarity):" · MASSIMA")):row.area;
        return '<button type="button" class="rtg-coach-power-option'+(active?' is-selected':'')+
          '" data-rtg-coach-power-player="'+esc(row.key)+'" aria-pressed="'+active+'"'+
          (canUse?'':' disabled')+'>'+
          '<strong>'+esc(label)+'</strong><span>'+esc(extra)+' · '+
          esc(row.player?.normalizedRole||row.player?.position||row.player?.role||"")+
          '</span>'+(active?'<b>✓</b>':'')+'</button>';
      }).join("");
      const allMoves=moves();
      const moveButtons=coachId==="1329"&&choice.cardIds.length===1
        ?('<div class="rtg-coach-power-choices"><h4>MOSSE SPECIALI ('+choice.moveIndices.length+'/2)</h4>'+
          (allMoves.length===4?allMoves.map((move,index)=>{
            const active=choice.moveIndices.includes(index),cost=Number(move?.ptCost);
            return '<button type="button" class="rtg-coach-power-option'+(active?' is-selected':'')+
              '" data-rtg-coach-power-move="'+index+'" aria-pressed="'+active+'"'+(!(cost>0)?' disabled':'')+'>'+
              '<strong>'+esc(move?.name||"Mossa "+(index+1))+'</strong><span>'+
              esc(cost>0?('PT '+cost+' → '+Math.ceil(cost/2)):'Costo non disponibile')+
              '</span>'+(active?'<b>✓</b>':'')+'</button>';
          }).join(""):'<p>Le quattro mosse speciali non sono disponibili per questo giocatore.</p>')+'</div>')
        :"";
      const elementButtons=coachId==="4401"&&choice.cardIds.length===1?
        ('<div class="rtg-coach-power-choices"><h4>NUOVO ELEMENTO</h4>'+
          ELEMENTS.map(item=>'<button type="button" class="rtg-coach-power-option'+
            (choice.element===item.key?' is-selected':'')+'" data-rtg-coach-power-element="'+
            item.key+'" aria-pressed="'+(choice.element===item.key)+'"><strong>'+item.label+
            '</strong>'+(choice.element===item.key?'<b>✓</b>':'')+'</button>').join("")+
          '</div>'):"";
      const body='<section class="rtg-coach-power-config" aria-label="Configura potere allenatore">'+
        '<h2>'+POWER_LABELS[coachId]+'</h2><p>'+POWER_NOTES[coachId]+'</p>'+
        '<div class="rtg-coach-power-choices"><h4>'+
        (coachId==="1777"?"RISERVE":coachId==="1974"?"TITOLARI E RISERVE":"TITOLARI")+
        ' ('+choice.cardIds.length+'/'+maxPlayers()+')</h4>'+playerButtons+
        '</div>'+moveButtons+elementButtons+'<div class="rtg-coach-power-actions">'+
        '<button type="button" class="btn btn-yellow" data-rtg-coach-power-save '+
        (isComplete()?'':'disabled')+'>CONFERMA POTERE</button>'+
        '<button type="button" class="btn" data-rtg-coach-power-cancel>ANNULLA</button>'+
        '<button type="button" class="btn" data-rtg-coach-power-clear>RIMUOVI POTERE</button>'+
        '</div></section>';
      ctx.openModal?.(body,{className:"rtg-modal rtg-coach-power-modal"});
      const root=ctx.getModalRoot?.();
      root?.querySelectorAll?.("[data-rtg-coach-power-player]")?.forEach(button=>button.addEventListener("click",()=>{
        if(busy||button.disabled)return;
        const key=id(button.dataset.rtgCoachPowerPlayer);
        if(choice.cardIds.includes(key))choice.cardIds=choice.cardIds.filter(value=>value!==key);
        else if(maxPlayers()===1)choice.cardIds=[key];
        else if(choice.cardIds.length<2)choice.cardIds.push(key);
        if(coachId==="1329")choice.moveIndices=[];
        render();
      }));
      root?.querySelectorAll?.("[data-rtg-coach-power-move]")?.forEach(button=>button.addEventListener("click",()=>{
        if(busy||button.disabled)return;
        const index=Number(button.dataset.rtgCoachPowerMove);
        if(choice.moveIndices.includes(index))choice.moveIndices=choice.moveIndices.filter(x=>x!==index);
        else if(choice.moveIndices.length<2)choice.moveIndices.push(index);
        render();
      }));
      root?.querySelectorAll?.("[data-rtg-coach-power-element]")?.forEach(button=>button.addEventListener("click",()=>{
        if(busy)return;
        choice.element=id(button.dataset.rtgCoachPowerElement);
        render();
      }));
      root?.querySelector?.("[data-rtg-coach-power-cancel]")?.addEventListener("click",()=>ctx.closeModal?.());
      root?.querySelector?.("[data-rtg-coach-power-clear]")?.addEventListener("click",async()=>{
        if(busy)return;
        busy=true;
        try{
          const current=ctx.getSquadDraft();
          if(id(current?.coachId)!==coachId)throw new Error("Allenatore cambiato");
          if(ctx.getCampaign()?.activeMatch)throw new Error("Partita già in corso");
          await ctx.saveSquad({...current,coachPowerSelection:null});
          ctx.closeModal?.();ctx.toast?.("Potere rimosso dalla configurazione");
        }catch(error){ctx.toast?.(error?.message||"Impossibile rimuovere il potere","error");}
        finally{busy=false;}
      });
      root?.querySelector?.("[data-rtg-coach-power-save]")?.addEventListener("click",async()=>{
        if(busy||!isComplete())return;
        busy=true;
        try{
          const current=ctx.getSquadDraft();
          if(id(current?.coachId)!==coachId)throw new Error("Allenatore cambiato: riapri la configurazione");
          if(ctx.getCampaign()?.activeMatch)throw new Error("Partita già in corso");
          const draft={...current,coachPowerSelection:{
            coachId,cardIds:choice.cardIds.slice(),moveIndices:choice.moveIndices.slice(),
            element:choice.element,
          }};
          const from=keys=>(keys||[]).map(key=>{
            const player=resolve(key);return player?{...player,cardId:id(key)}:null;
          }).filter(Boolean);
          if(!rules.validConfig(draft,from(draft.lineup),ctx.seasonId(),from(draft.bench)))
            throw new Error("Selezione non valida");
          await ctx.saveSquad(draft);
          ctx.closeModal?.();ctx.toast?.("Potere allenatore configurato per la squadra");
        }catch(error){ctx.toast?.(error?.message||"Impossibile salvare il potere","error");}
        finally{busy=false;}
      });
    }
    render();
  }
  global.RoadToGloryCoachSquadPowerUi=Object.freeze({open});
})(globalThis);
