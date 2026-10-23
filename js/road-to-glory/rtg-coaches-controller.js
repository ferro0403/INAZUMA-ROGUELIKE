(function coachController(global){
  "use strict";
  let busy=false;
  function open(ctx,tab="draw",detailId=null,newCoach=null){
    const coaches=global.RoadToGloryCoaches,view=global.RoadToGloryCoachesView;
    const state=ctx.getCampaign();
    if(!coaches||!view)return ctx.toast?.("Catalogo allenatori non disponibile","error");
    const selected=String(ctx.getSquadDraft()?.coachId??ctx.activeSquad()?.coachId??"");
    const markup=newCoach?view.result(newCoach,state):detailId?view.detail(state,detailId,{equippedId:selected}):view.markup(state,{tab,equippedId:selected});
    ctx.openModal?.(markup,{className:detailId?"rtg-modal player-detail-modal rtg-coaches-modal":"rtg-modal rtg-coaches-modal"});
    const root=ctx.getModalRoot?.();
    // Rasterize the below-fold René art immediately after the modal is
    // inserted, without waiting for a scroll, observer or visibility event.
    view.mountArtwork?.(root);
    const machine=root?.querySelector?.("[data-rtg-vending-machine]");
    const motion=global.RoadToGloryVendingMotion?.mount?.(machine);
    root?.querySelectorAll?.("[data-rtg-coaches-tab]")?.forEach(button=>button.addEventListener("click",()=>open(ctx,button.dataset.rtgCoachesTab)));
    root?.querySelectorAll?.("[data-rtg-coach-detail]")?.forEach(button=>button.addEventListener("click",()=>open(ctx,"collection",button.dataset.rtgCoachDetail)));
    root?.querySelector?.("[data-rtg-coaches-back]")?.addEventListener("click",()=>open(ctx,"collection"));
    root?.querySelector?.("[data-rtg-coaches-collection]")?.addEventListener("click",()=>open(ctx,"collection"));
    root?.querySelector?.("[data-rtg-coaches-pull]")?.addEventListener("click",async(event)=>{
      if(busy)return;
      busy=true;
      if(event?.currentTarget)event.currentTarget.disabled=true;
      let chosen=null;
      try{
        const next=await ctx.repository.update("rtg-coaches-draw",current=>{
          const result=coaches.draw(current);
          chosen=result.coach;
          return result.state;
        });
        ctx.setCampaign(next);
        if(chosen){
          if(machine?.isConnected){
            if(motion){await motion.play("coach");}
            else {machine.classList.add("is-turning");await new Promise(done=>setTimeout(done,650));}
            if(machine.isConnected)machine.classList.add("is-revealing");
          }
          if(!machine||machine.isConnected)open(ctx,"collection",null,chosen);
        }
      }catch(error){ctx.toast?.(error?.message||"Estrazione allenatore fallita","error");}
      finally{motion?.stop?.();busy=false;}
    });
    root?.querySelectorAll?.("[data-rtg-coaches-equip]")?.forEach(button=>button.addEventListener("click",async event=>{
      if(busy)return;
      busy=true;
      const clicked=event.currentTarget;
      clicked.disabled=true;
      const coachId=String(clicked.dataset.rtgCoachesEquip||"");
      try{
        if(coachId&&!coaches.owned(ctx.getCampaign()).has(coachId))throw new Error("Allenatore non posseduto");
        if(ctx.getCampaign()?.activeMatch)throw new Error("Completa prima la partita in corso");
        const sid=ctx.activeSeasonId();
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
        // The selection is visible only after the canonical repository commit;
        // return directly to Squadra so the newly assigned staff is evident.
        ctx.closeModal?.();
        ctx.renderSquad();
        ctx.toast?.(coachId?"Allenatore assegnato alla squadra":"Allenatore rimosso");
      }catch(error){
        ctx.toast?.(error?.message||"Salvataggio allenatore fallito","error");
      }finally{
        busy=false;
        if(clicked?.isConnected)clicked.disabled=false;
      }
    }));
    return state;
  }
  global.RoadToGloryCoachesController=Object.freeze({open});
})(globalThis);
