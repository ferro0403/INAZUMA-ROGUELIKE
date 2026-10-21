(function coachController(global){
  "use strict";
  let busy=false;
  function open(ctx,tab="draw",detailId=null,newCoach=null){
    const coaches=global.RoadToGloryCoaches,view=global.RoadToGloryCoachesView;
    const state=ctx.getCampaign();
    if(!coaches||!view)return ctx.toast?.("Catalogo allenatori non disponibile","error");
    const selected=String(ctx.getSquadDraft()?.coachId||ctx.activeSquad()?.coachId||"");
    const markup=newCoach?view.result(newCoach):detailId?view.detail(state,detailId,{equippedId:selected}):view.markup(state,{tab,equippedId:selected});
    ctx.openModal?.(markup,{className:"rtg-modal rtg-coaches-modal"});
    const root=ctx.getModalRoot?.();
    root?.querySelectorAll?.("[data-rtg-coaches-tab]")?.forEach(button=>button.addEventListener("click",()=>open(ctx,button.dataset.rtgCoachesTab)));
    root?.querySelectorAll?.("[data-rtg-coach-detail]")?.forEach(button=>button.addEventListener("click",()=>open(ctx,"collection",button.dataset.rtgCoachDetail)));
    root?.querySelector?.("[data-rtg-coaches-back]")?.addEventListener("click",()=>open(ctx,"collection"));
    root?.querySelector?.("[data-rtg-coaches-collection]")?.addEventListener("click",()=>open(ctx,"collection"));
    root?.querySelector?.("[data-rtg-coaches-pull]")?.addEventListener("click",async()=>{
      if(busy)return;
      busy=true;
      let chosen=null;
      try{
        const next=await ctx.repository.update("rtg-coaches-draw",current=>{
          const result=coaches.draw(current);
          chosen=result.coach;
          return result.state;
        });
        ctx.setCampaign(next);
        if(chosen)open(ctx,"collection",null,chosen);
      }catch(error){ctx.toast?.(error?.message||"Estrazione allenatore fallita","error");}
      finally{busy=false;}
    });
    root?.querySelector?.("[data-rtg-coaches-equip]")?.addEventListener("click",async event=>{
      const coachId=String(event.currentTarget.dataset.rtgCoachesEquip||"");
      if(coachId&&!coaches.owned(ctx.getCampaign()).has(coachId))return ctx.toast?.("Allenatore non posseduto","error");
      if(ctx.getCampaign()?.activeMatch)return ctx.toast?.("Completa prima la partita in corso","error");
      const sid=ctx.activeSeasonId();
      try{
        const updated=await ctx.repository.update("rtg-coaches-equip",current=>{
          if(coachId&&!coaches.owned(current).has(coachId))throw new Error("Allenatore non posseduto");
          const original=current.squads?.[sid];
          if(!original)throw new Error("Formazione RTG non disponibile");
          current.squads[sid]={...original,coachId};
          return current;
        });
        ctx.setCampaign(updated);
        const draft={...(ctx.getSquadDraft()||ctx.activeSquad()),coachId};
        ctx.setSquadDraft(draft);
        ctx.storeSquadSlot(ctx.getActiveSquadSlot(),draft);
        ctx.toast?.(coachId?"Allenatore assegnato alla squadra":"Allenatore rimosso");
        ctx.renderSquad();
        open(ctx,"collection",detailId);
      }catch(error){ctx.toast?.(error?.message||"Salvataggio allenatore fallito","error");}
    });
    return state;
  }
  global.RoadToGloryCoachesController=Object.freeze({open});
})(globalThis);
