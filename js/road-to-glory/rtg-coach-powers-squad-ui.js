(function(global){
  "use strict";
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const id=value=>String(value??"");
  const ELEMENTS=Object.freeze([
    {key:"fire",label:"FUOCO"},{key:"wind",label:"VENTO"},
    {key:"forest",label:"BOSCO"},{key:"mountain",label:"MONTAGNA"},
  ]);
  const NAMES={
    "208":"FIDUCIA NEI CAMPIONI","1329":"ALLENAMENTO SPECIALIZZATO",
    "1777":"FUORI QUOTA","1974":"POTENZIALE RISVEGLIATO","4401":"CAMBIO DI ELEMENTO",
  };
  const NOTES={
    "208":"Tocca due titolari direttamente sul campo. Entrambi riceveranno +50 PT iniziali e massimi.",
    "1329":"Tocca un titolare sul campo per aprire la sua scheda e selezionarvi due delle quattro mosse.",
    "1777":"Tocca una riserva sulla panchina: nel calcolo dell'overall squadra conterà al massimo 60. I valori reali non cambiano.",
    "1974":"Tocca una carta sul campo o in panchina: potrai vedere qui sotto la rarità successiva e le statistiche che aumentano.",
    "4401":"Tocca un titolare sul campo e scegli Fuoco, Vento, Bosco o Montagna per la prossima partita.",
  };
  let busy=false;
  function open(ctx){
    const rules=global.RoadToGloryCoachPowerRuntime,squad=ctx.getSquadDraft?.();
    const coachId=id(squad?.coachId);
    if(!rules?.powerReady(coachId)||!global.RoadToGloryCoaches?.owned?.(ctx.getCampaign())?.has(coachId))
      return ctx.toast?.("Il potere di questo allenatore non è configurabile.","error");
    if(ctx.getCampaign()?.activeMatch)return ctx.toast?.("Completa prima la partita in corso.","error");
    const previous=rules.selected(squad);
    const choice={coachId,cardIds:previous?.cardIds?.slice()||[],
      moveIndices:previous?.moveIndices?.slice()||[],element:previous?.element||""};
    const resolve=key=>ctx.resolve?.(key,squad.activeRoleVariantByCardId?.[key]||null);
    const from=keys=>(keys||[]).map(key=>{
      const p=resolve(key);return p?{...p,cardId:id(key)}:null;
    }).filter(Boolean);
    const selectionSquad=()=>({...squad,coachPowerSelection:choice});
    const valid=()=>!!rules.validConfig(selectionSquad(),from(squad.lineup),ctx.seasonId(),from(squad.bench));
    const cap=coachId==="208"?2:1;
    const allowed=key=>coachId==="1777"?(squad.bench||[]).includes(key):
      coachId==="1974"?[...(squad.lineup||[]),...(squad.bench||[])].includes(key)&&
        !!rules.nextRarity(rules.rarityOf(resolve(key))):
        (squad.lineup||[]).includes(key);
    function openMoves(key){
      const player=resolve(key),moves=rules.fourMoves(player,ctx.seasonId());
      if(moves.length!==4||moves.some(m=>!(Number(m?.ptCost)>0)))
        return ctx.toast?.("Le quattro mosse non sono disponibili per questo giocatore.","error");
      const prevSelected=choice.cardIds[0]===key?choice.moveIndices.slice():[];
      choice.cardIds=[key];choice.moveIndices=prevSelected;
      ctx.openPlayerDetails?.(key,{
        allowRoleSwitch:false,onClose:()=>render(),
        coachMovePicker:{
          moves,selectedIndices:choice.moveIndices,
          onConfirm:indices=>{
            choice.cardIds=[key];choice.moveIndices=indices;
            ctx.closeModal?.({invokeOnClose:false});render();
          },
        },
      });
    }
    function pick(key){
      if(busy||!allowed(key))return;
      if(coachId==="1329")return openMoves(key);
      if(choice.cardIds.includes(key))choice.cardIds=choice.cardIds.filter(x=>x!==key);
      else if(cap===1)choice.cardIds=[key];
      else if(choice.cardIds.length<2)choice.cardIds.push(key);
      render();
    }
    function projectedChanges(){
      if(coachId!=="1974"||choice.cardIds.length!==1)return "";
      const preview=ctx.previewChoice?.(choice.cardIds[0],choice);
      if(!preview)return '<p class="rtg-coach-picker-note">Rarità massima o anteprima non disponibile: scegli un altro giocatore.</p>';
      const original=preview.original||{},updated=preview.player||{};
      return '<section class="rtg-coach-power-projection"><h4>ANTEPRIMA POTENZIAMENTO</h4>'+
        '<strong>'+esc(original.name||"Giocatore")+' · '+esc(original.category)+' → '+esc(updated.category)+
        '</strong><p>Overall personale: '+esc(original.overall)+' → '+esc(updated.overall)+
        ' (non modifica l’overall squadra per i requisiti)</p>'+
        (preview.stats?.length?'<div class="rtg-coach-preview-stat-grid">'+preview.stats.map(item=>
          '<span><strong>'+esc(item.label)+'</strong> '+esc(item.before)+' → '+
          esc(item.after)+' <b>+'+esc(item.after-item.before)+'</b></span>').join("")+'</div>':
          '<p>Nessuna statistica aumentata.</p>')+'</section>';
    }
    function overallPreview(){
      if(coachId!=="1777"||choice.cardIds.length!==1)return "";
      const overall=ctx.previewSquadOverall?.(choice);
      if(!overall||!Number.isFinite(overall.before)||!Number.isFinite(overall.after))return "";
      return '<section class="rtg-coach-power-projection" aria-label="Overall squadra con Fuori quota">'+
        '<h4>OVERALL SQUADRA · ANTEPRIMA</h4><strong>'+esc(overall.before)+
        ' → '+esc(overall.after)+'</strong><p>La media resta su 15 giocatori. Solo la riserva scelta pesa al massimo 60.</p></section>';
    }
    function render(){
      const model=ctx.getModel?.();
      const pitch=ctx.squadView?.lineupPitchMarkup?.(model?.lineupRows||[],{readOnly:true})||"";
      const bench=(model?.bench||[]).map(row=>ctx.squadView?.playerCard?.(row,"bench",{readOnly:true})||"").join("");
      const elementButtons=coachId==="4401"&&choice.cardIds.length===1
        ?'<div class="rtg-coach-picker-elements"><h4>ELEMENTO PER LA PARTITA</h4>'+
          ELEMENTS.map(e=>'<button type="button" class="btn'+(choice.element===e.key?' is-selected':'')+
          '" data-rtg-coach-power-element="'+e.key+'" aria-pressed="'+(choice.element===e.key)+'">'+
          e.label+'</button>').join("")+'</div>':"";
      const title=coachId==="1777"?"SCEGLI UNA RISERVA":"SCEGLI SUL CAMPO";
      const summary=coachId==="1329"?' · MOSSE '+choice.moveIndices.length+'/2':"";
      const main='<section class="rtg-coach-power-config rtg-coach-field-picker" aria-label="Configura potere allenatore">'+
        '<h2>'+NAMES[coachId]+'</h2><p>'+NOTES[coachId]+'</p>'+
        '<h3>'+title+' ('+choice.cardIds.length+'/'+cap+summary+')</h3>'+
        '<div class="rtg-coach-picker-pitch squad-field-panel">'+pitch+'</div>'+
        '<section class="rtg-coach-picker-bench"><h3>PANCHINA</h3><div class="rtg-coach-picker-bench-grid">'+bench+'</div></section>'+
        elementButtons+projectedChanges()+overallPreview()+
        '<div class="rtg-coach-power-actions"><button type="button" class="btn btn-yellow" data-rtg-coach-power-save'+
        (valid()?'':' disabled')+'>CONFERMA POTERE</button>'+
        '<button type="button" class="btn" data-rtg-coach-power-cancel>ANNULLA</button>'+
        '<button type="button" class="btn" data-rtg-coach-power-clear>RIMUOVI POTERE</button></div></section>';
      ctx.openModal?.(main,{className:"rtg-modal rtg-coach-power-modal"});
      const root=ctx.getModalRoot?.();
      root?.querySelectorAll?.(".rtg-coach-field-picker [data-rtg-squad-player]")?.forEach(button=>{
        const key=id(button.dataset.rtgSquadPlayer),ok=allowed(key),isSelected=choice.cardIds.includes(key);
        button.disabled=!ok;button.setAttribute("aria-pressed",isSelected?"true":"false");
        button.closest(".rtg-squad-card-slot")?.classList.toggle("rtg-coach-power-picked",isSelected);
        if(ok)button.addEventListener("click",()=>pick(key));
      });
      root?.querySelectorAll?.("[data-rtg-coach-power-element]")?.forEach(button=>button.addEventListener("click",()=>{
        if(busy)return;choice.element=id(button.dataset.rtgCoachPowerElement);render();
      }));
      root?.querySelector?.("[data-rtg-coach-power-cancel]")?.addEventListener("click",()=>ctx.closeModal?.());
      root?.querySelector?.("[data-rtg-coach-power-clear]")?.addEventListener("click",async()=>{
        if(busy)return;
        busy=true;
        try{
          const current=ctx.getSquadDraft();
          if(id(current?.coachId)!==coachId||ctx.getCampaign()?.activeMatch)throw new Error("Configurazione non più disponibile");
          await ctx.saveSquad({...current,coachPowerSelection:null});
          ctx.closeModal?.();ctx.toast?.("Potere rimosso dalla configurazione");
        }catch(error){ctx.toast?.(error?.message||"Impossibile rimuovere il potere","error");}
        finally{busy=false;}
      });
      root?.querySelector?.("[data-rtg-coach-power-save]")?.addEventListener("click",async()=>{
        if(busy||!valid())return;
        busy=true;
        try{
          const current=ctx.getSquadDraft();
          if(id(current?.coachId)!==coachId||ctx.getCampaign()?.activeMatch)throw new Error("Configurazione non più disponibile");
          const draft={...current,coachPowerSelection:{
            coachId,cardIds:choice.cardIds.slice(),moveIndices:choice.moveIndices.slice(),element:choice.element,
          }};
          if(!rules.validConfig(draft,from(draft.lineup),ctx.seasonId(),from(draft.bench)))throw new Error("Selezione non valida");
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
