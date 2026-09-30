(function (global) {
  "use strict";

  function create(deps={}){
    let campaign=deps.getCampaign();
    let selectedDevelopmentCardId=null;
    let developmentQuery="";
    let developmentRarity="Tutti";
    let developmentVisibleCount=24;
    const DEVELOPMENT_PLAYER_PAGE_SIZE=24;
    function developmentRoleVariant(cardId){
      const variants=deps.getSquadDraft()?.activeRoleVariantByCardId||deps.activeSquad(campaign)?.activeRoleVariantByCardId||{};
      return variants?.[deps.id(cardId)]||null;
    }
    function developmentCardIds(state=campaign){
      if(!deps.economy)return[];
      return Array.from(deps.economy.ownedCardIds(state)||[]).filter((cardId)=>deps.economy.isEligibleOwnedCard(state,cardId));
    }
    function developmentPlayers(){
      return developmentCardIds().map((cardId)=>deps.resolved(cardId,developmentRoleVariant(cardId))).filter(Boolean)
        .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"it"));
    }
    function filteredDevelopmentPlayers(players){
      const needle=String(developmentQuery||"").trim().toLocaleLowerCase("it");
      return players.filter((player)=>{
        const matchesName=!needle||String(player.name||"").toLocaleLowerCase("it").includes(needle);
        const matchesRarity=developmentRarity==="Tutti"||String(player.category||"")===developmentRarity;
        return matchesName&&matchesRarity;
      });
    }
    function developmentModelFor(cardId){
      const key=deps.id(cardId);
      if(!key||!deps.economy)return null;
      const player=deps.resolved(key,developmentRoleVariant(key));
      const standard=deps.resolvedStandard(key,developmentRoleVariant(key));
      if(!player||!standard)return null;
      const preview=deps.economy.previewEvolution(campaign,{
        cardId:key,
        basePotential:Number(standard.potential??standard.finalOverall??standard.overall??0),
        baseRarity:standard.category,
      });
      let after=null;
      if(preview?.ok){
        const developmentByCardId={...(campaign?.developmentByCardId||{}),[key]:{
          ...(campaign?.developmentByCardId?.[key]||{}),
          targetPotential:preview.targetPotential,
          currentRarity:preview.target,
        }};
        after=deps.resolvedWithDevelopment(key,developmentRoleVariant(key),developmentByCardId);
      }
      return {player,standard,preview,after};
    }
    function renderShop(options={}){
      campaign=deps.getCampaign();
      if(!deps.economyView||!deps.economy)return deps.renderRun();
      selectedDevelopmentCardId=null;
      deps.renderHtml(deps.economyView.shopMarkup({state:campaign}),{preserveScroll:options.preserveScroll===true});
      deps.app?.querySelector?.("[data-rtg-economy-back]")?.addEventListener("click",()=>deps.renderHome?.({initialPage:"rtg"}));
      deps.app?.querySelector?.("[data-rtg-open-development]")?.addEventListener("click",()=>renderDevelopment("players"));
      deps.app?.querySelectorAll?.("[data-rtg-buy-project]")?.forEach((button)=>button.addEventListener("click",async()=>{
        if(button.disabled)return;
        const shopScrollY=Number(global.scrollY||global.pageYOffset||0);
        button.disabled=true;
        let outcome=null;
        campaign=await deps.repository.update("rtg-buy-project",current=>{
          outcome=deps.economy.purchaseProject(current,button.dataset.rtgBuyProject);
          return outcome?.ok?outcome.state:current;
        });
        deps.setCampaign(campaign);
        deps.toast?.(outcome?.ok?"PROGETTO ACQUISTATO":outcome?.reason==="tokens"?"GETTONI RTG INSUFFICIENTI":"ACQUISTO NON COMPLETATO",outcome?.ok?undefined:"error");
        renderShop({preserveScroll:true});
        const restoreShopScroll=()=>global.scrollTo?.(0,shopScrollY);
        if(typeof global.requestAnimationFrame==="function")global.requestAnimationFrame(()=>global.requestAnimationFrame(restoreShopScroll));
        else if(typeof global.setTimeout==="function")global.setTimeout(restoreShopScroll,0);
        else restoreShopScroll();
        return campaign;
      }));
      deps.mountDevQuickTools();
      return campaign;
    }
    function bindDevelopmentGrid(players){
      const results=deps.app?.querySelector?.("[data-rtg-development-results]");
      if(!results)return;
      const refresh=()=>{
        const filtered=filteredDevelopmentPlayers(players);
        const visible=filtered.slice(0,developmentVisibleCount);
        const remaining=Math.max(0,filtered.length-visible.length);
        results.innerHTML=deps.economyView.playerGrid(visible)+(remaining>0?`<div class="development-load-more-wrap"><button type="button" class="btn btn-yellow development-load-more" data-rtg-development-load-more><span>MOSTRA ALTRI <b>${Math.min(DEVELOPMENT_PLAYER_PAGE_SIZE,remaining)}</b></span><small>${visible.length} di ${filtered.length}</small></button></div>`:"");
      };
      results.onclick=(event)=>{
        const loadMore=event.target?.closest?.("[data-rtg-development-load-more]");
        if(loadMore){developmentVisibleCount+=DEVELOPMENT_PLAYER_PAGE_SIZE;refresh();return;}
        const element=event.target?.closest?.("[data-rtg-development-player]");
        if(!element)return;
        selectedDevelopmentCardId=deps.id(element.dataset.rtgDevelopmentPlayer);
        renderDevelopment("players");
      };
      const search=deps.app?.querySelector?.("[data-rtg-development-search]");
      search?.addEventListener("input",(event)=>{developmentQuery=event.currentTarget.value||"";developmentVisibleCount=DEVELOPMENT_PLAYER_PAGE_SIZE;refresh();});
      deps.app?.querySelector?.("[data-rtg-development-rarity]")?.addEventListener("change",(event)=>{developmentRarity=event.currentTarget.value||"Tutti";developmentVisibleCount=DEVELOPMENT_PLAYER_PAGE_SIZE;refresh();});
      refresh();
    }
    function renderDevelopment(tab="players"){
      campaign=deps.getCampaign();
      if(!deps.economyView||!deps.economy)return deps.renderRun();
      const players=developmentPlayers();
      if(selectedDevelopmentCardId&&!players.some((player)=>deps.id(player.cardId||player.playerId)===deps.id(selectedDevelopmentCardId)))selectedDevelopmentCardId=null;
      const selected=selectedDevelopmentCardId?developmentModelFor(selectedDevelopmentCardId):null;
      const filtered=filteredDevelopmentPlayers(players);
      deps.renderHtml(deps.economyView.developmentMarkup({
        state:campaign,
        players,
        filteredPlayers:filtered,
        selected,
        tab,
        query:developmentQuery,
        rarity:developmentRarity,
      }));
      deps.app?.querySelector?.("[data-rtg-economy-back]")?.addEventListener("click",()=>{
        selectedDevelopmentCardId=null;
        deps.renderHome?.({initialPage:"rtg"});
      });
      deps.app?.querySelectorAll?.("[data-rtg-development-tab]")?.forEach((button)=>button.addEventListener("click",()=>renderDevelopment(button.dataset.rtgDevelopmentTab)));
      deps.app?.querySelector?.("[data-rtg-open-shop]")?.addEventListener("click",()=>renderShop());
      deps.app?.querySelectorAll?.("[data-rtg-change-development-player]")?.forEach((button)=>button.addEventListener("click",()=>{
        selectedDevelopmentCardId=null;
        renderDevelopment("players");
      }));
      deps.app?.querySelector?.("[data-rtg-development-selected-card]")?.addEventListener("click",()=>deps.openPlayerDetails(selectedDevelopmentCardId));
      deps.app?.querySelector?.("[data-rtg-prepare-evolution]")?.addEventListener("click",()=>openEvolutionConfirmation());
      if(!selectedDevelopmentCardId&&tab==="players")bindDevelopmentGrid(players);
      deps.mountDevQuickTools();
      return campaign;
    }
    function openEvolutionConfirmation(){
      campaign=deps.getCampaign();
      const model=developmentModelFor(selectedDevelopmentCardId);
      if(!model?.preview?.ok||!model.preview.ready)return deps.toast?.("RISORSE RTG INSUFFICIENTI","error");
      deps.openModal?.(deps.economyView.evolutionConfirmMarkup(model),{closeable:false,className:"development-confirm-modal rtg-development-confirm-modal"});
      const modalRoot=deps.getModalRoot?.();
      modalRoot?.querySelector?.("[data-rtg-cancel-evolution]")?.addEventListener("click",()=>deps.closeModal?.());
      modalRoot?.querySelector?.("[data-rtg-confirm-evolution]")?.addEventListener("click",async(event)=>{
        const button=event.currentTarget;
        if(button.disabled)return;
        button.disabled=true;
        let outcome=null;
        const basePotential=Number(model.standard.potential??model.standard.finalOverall??model.standard.overall??0);
        const baseRarity=model.standard.category;
        campaign=await deps.repository.update("rtg-evolve-card",current=>{
          outcome=deps.economy.evolve(current,{
            cardId:selectedDevelopmentCardId,
            basePotential,
            baseRarity,
            expectedTarget:model.preview.target,
          });
          return outcome?.ok?outcome.state:current;
        });
        deps.setCampaign(campaign);
        deps.closeModal?.({invokeOnClose:false});
        if(!outcome?.ok){
          deps.toast?.(outcome?.reason==="stale"?"EVOLUZIONE CAMBIATA: RIPROVA":"RISORSE RTG CAMBIATE: EVOLUZIONE NON COMPLETATA","error");
          return renderDevelopment("players");
        }
        deps.toast?.(`${model.player.name}: ${outcome.target}`);
        return renderDevelopment("players");
      });
    }

    return Object.freeze({renderShop,renderDevelopment});
  }
  global.RoadToGloryDevelopmentController=Object.freeze({create});
})(globalThis);
