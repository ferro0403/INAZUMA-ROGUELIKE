(function(global){
  "use strict";
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const id=value=>String(value??"");
  // Same element glyphs as the existing player-detail badges.
  const ELEMENTS=Object.freeze([
    {key:"fire",label:"FUOCO",art:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.4 3.6 5 5.2 5 9.4A5 5 0 1 1 7 12c0-2.3 1.2-4.3 3.4-6.3-.1 2.2.5 3.7 1.6 4.7.9-2 .7-4.5 0-7.4Z"/></svg>'},
    {key:"wind",label:"VENTO",art:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h10.5c2 0 2.5-3 0-3-1.1 0-1.8.5-2.2 1.2"/><path d="M3 12h15c2.4 0 2.8 3.5.2 3.5-1.2 0-2-.6-2.4-1.4"/><path d="M3 16h8"/></svg>'},
    {key:"forest",label:"ALBERO",art:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 7.5 9h2.3L6 14h4v4H8v3h8v-3h-2v-4h4l-3.8-5h2.3L12 3Z"/></svg>'},
    {key:"mountain",label:"MONTAGNA",art:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 19 6.2-10 3.1 4.6L15.5 9 21 19H3Z"/><path d="m7.5 12 1.8 1.1 1.4-1.1"/></svg>'},
  ]);
  const NAMES={
    "208":"FIDUCIA NEI CAMPIONI","1329":"ALLENAMENTO SPECIALIZZATO",
    "1777":"FUORI QUOTA","1974":"POTENZIALE RISVEGLIATO","4401":"TRASFORMAZIONE TOTALE",
  };
  const NOTES={
    "208":"Tocca due titolari direttamente sul campo. Entrambi riceveranno +50 PT iniziali e massimi.",
    "1329":"Tocca un titolare sul campo: tutte le sue mosse speciali disponibili costeranno la metà dei PT.",
    "1777":"Tocca una riserva sulla panchina: nel calcolo dell'overall squadra conterà al massimo 60. I valori reali non cambiano.",
    "1974":"Tocca una carta sul campo o in panchina: potrai vedere qui sotto la rarità successiva e le statistiche che aumentano.",
    "4401":"Scegli 2 titolari. Per ognuno imposta un elemento diverso dall'originale: tutte le sue mosse speciali disponibili cambiano nello stesso elemento. Potenza e costo PT non cambiano.",
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
      moveIndices:previous?.moveIndices?.slice()||[],element:previous?.element||"",
      targets:coachId==="4401"&&previous?.targets?.length===2?
        previous.targets.map(t=>({cardId:t.cardId,element:t.element,moveIndices:t.moveIndices.slice()})):[]};
    if(coachId==="4401")choice.cardIds=choice.targets.map(t=>t.cardId);
    let retainedModalTop=0;
    const rememberModalScroll=()=>{const modal=ctx.getModalRoot?.()?.querySelector?.(".modal");if(modal)retainedModalTop=modal.scrollTop||0;};
    const restoreModalScroll=()=>{
      const modal=ctx.getModalRoot?.()?.querySelector?.(".modal");
      if(!modal)return;
      const restore=()=>{if(modal.isConnected!==false)modal.scrollTop=retainedModalTop;};
      const raf=global.requestAnimationFrame;
      if(typeof raf==="function")raf(()=>raf(restore));else restore();
    };
    const resolve=key=>ctx.resolve?.(key,squad.activeRoleVariantByCardId?.[key]||null);
    const ownElement=key=>rules.elementKey?.(resolve(key)?.element||resolve(key)?.type)||"";
    const from=keys=>(keys||[]).map(key=>{
      const p=resolve(key);return p?{...p,cardId:id(key)}:null;
    }).filter(Boolean);
    const selectionSquad=()=>({...squad,coachPowerSelection:choice});
    const valid=()=>!!rules.validConfig(selectionSquad(),from(squad.lineup),ctx.seasonId(),from(squad.bench));
    const cap=["208","4401"].includes(coachId)?2:1;
    const allowed=key=>coachId==="1777"?(squad.bench||[]).includes(key):
      coachId==="1974"?[...(squad.lineup||[]),...(squad.bench||[])].includes(key)&&
        !!rules.nextRarity(rules.rarityOf(resolve(key))):
        (squad.lineup||[]).includes(key);
    function pick(key){
      if(busy||!allowed(key))return;
      if(coachId==="4401"){
        const index=choice.targets.findIndex(t=>t.cardId===key);
        if(index>=0)choice.targets.splice(index,1);
        else if(choice.targets.length<2)choice.targets.push({cardId:key,element:"",moveIndices:[]});
        choice.cardIds=choice.targets.map(t=>t.cardId);
        return render();
      }
      // A single starter is enough: the next match affects every real move.
      if(coachId==="1329"){
        choice.cardIds=choice.cardIds.includes(key)?[]:[key];
        choice.moveIndices=[]; // no fixed two-move choice
        return render();
      }
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
      const elementButtons=coachId==="4401"&&choice.targets.length
        ?'<div class="rtg-coach-picker-elements rtg-coach-yi-targets"><h4>TRASFORMAZIONE DEI GIOCATORI</h4>'+
          choice.targets.map((target,index)=>{
            const originalElement=ownElement(target.cardId);
            const player=resolve(target.cardId);
            const name=esc(player?.name||player?.displayName||player?.playerName||target.cardId);
            const options=ELEMENTS.filter(e=>e.key!==originalElement).map(e=>
              '<button type="button" class="btn rtg-coach-element-choice'+(target.element===e.key?' is-selected':'')+
              '" data-rtg-coach-power-element="'+e.key+'" data-rtg-coach-power-target="'+esc(target.cardId)+
              '" data-element="'+e.key+'" aria-pressed="'+(target.element===e.key)+'">'+
              '<span class="rtg-coach-element-art">'+e.art+'</span><span>'+e.label+'</span></button>'
            ).join("");
            const available=rules.availableMoveIndices(rules.fourMoves(resolve(target.cardId),ctx.seasonId()));
            return '<section class="rtg-coach-yi-target"><h4>GIOCATORE '+(index+1)+' · '+name+'</h4>'+
              '<div class="rtg-coach-yi-element-options">'+options+'</div>'+
              '<p class="rtg-coach-yi-all-moves">TUTTE LE '+(available?.length||0)+' MOSSE DISPONIBILI</p></section>';
          }).join("")+'</div>':"";
      const title=coachId==="1777"?"SCEGLI UNA RISERVA":"SCEGLI SUL CAMPO";
      const summary=coachId==="1329"&&choice.cardIds[0]
        ?' · TUTTE LE '+(rules.availableMoveIndices(rules.fourMoves(resolve(choice.cardIds[0]),ctx.seasonId()))?.length||0)+' MOSSE':
        coachId==="4401"?' · TUTTE LE MOSSE':"";
      const main='<section class="rtg-coach-power-config rtg-coach-field-picker development-squad-card-scope" aria-label="Configura potere allenatore">'+
        '<h2>'+NAMES[coachId]+'</h2><p>'+NOTES[coachId]+'</p>'+
        '<h3>'+title+' ('+choice.cardIds.length+'/'+cap+summary+')</h3>'+
        '<div class="rtg-coach-picker-pitch squad-field-panel">'+pitch+'</div>'+
        '<section class="rtg-coach-picker-bench"><h3>PANCHINA</h3><div class="rtg-coach-picker-bench-grid">'+bench+'</div></section>'+
        elementButtons+projectedChanges()+overallPreview()+
        '<div class="rtg-coach-power-actions"><button type="button" class="btn btn-yellow" data-rtg-coach-power-save'+
        (valid()?'':' disabled')+'>CONFERMA POTERE</button>'+
        '<button type="button" class="btn" data-rtg-coach-power-cancel>ANNULLA</button>'+
        '<button type="button" class="btn" data-rtg-coach-power-clear>RIMUOVI POTERE</button></div></section>';
      const active=ctx.getModalRoot?.()?.querySelector?.(".rtg-coach-power-config");
      if(active)active.outerHTML=main;
      else {ctx.openModal?.(main,{className:"rtg-modal rtg-coach-power-modal"});restoreModalScroll();}
      const root=ctx.getModalRoot?.();
      root?.querySelectorAll?.(".rtg-coach-field-picker [data-rtg-squad-player]")?.forEach(button=>{
        const key=id(button.dataset.rtgSquadPlayer),ok=allowed(key),isSelected=choice.cardIds.includes(key);
        button.disabled=!ok;button.setAttribute("aria-pressed",isSelected?"true":"false");
        button.closest(".rtg-squad-card-slot")?.classList.toggle("rtg-coach-power-picked",isSelected);
        if(ok)button.addEventListener("click",()=>pick(key));
      });
      root?.querySelectorAll?.("[data-rtg-coach-power-element]")?.forEach(button=>button.addEventListener("click",()=>{
        if(busy)return;
        const target=choice.targets.find(t=>t.cardId===id(button.dataset.rtgCoachPowerTarget));
        const next=id(button.dataset.rtgCoachPowerElement);
        if(!target||ownElement(target.cardId)===next)return;
        target.element=next;render();
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
            targets:choice.targets.map(t=>({cardId:t.cardId,element:t.element,moveIndices:t.moveIndices.slice()})),
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
