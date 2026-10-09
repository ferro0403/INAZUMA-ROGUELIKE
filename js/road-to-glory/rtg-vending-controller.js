(function (global) {
  "use strict";

  function create(deps = {}) {
    function openVending(mode="team"){
      const campaign=deps.getCampaign(),seasonDb=deps.getSeasonDb();
      const selectedMode=mode==="recruitment"&&Number(deps.activeConfig()?.recruitmentPullCost)>0?"recruitment":"team";
      const pool=deps.gacha.previewPool(campaign,seasonDb,deps.accessibleCards(campaign),selectedMode);
      const cost=selectedMode==="recruitment"?deps.activeConfig()?.recruitmentPullCost:deps.activeConfig()?.pullCost;
      deps.openModal?.(deps.runView.vendingMarkup({...pool,tokens:campaign.tokens,seasonId:deps.activeSeasonId(),mode:selectedMode,cost}),{className:"rtg-modal rtg-vending-modal"});
      const modalRoot=deps.getModalRoot?.();
      const motion=global.RoadToGloryVendingMotion?.mount(modalRoot?.querySelector?.("[data-rtg-vending-machine]"));
      modalRoot?.querySelectorAll?.("[data-rtg-vending-mode]")?.forEach(toggle=>toggle.addEventListener("click",()=>openVending(toggle.dataset.rtgVendingMode)));
      const albumButton=modalRoot?.querySelector?.("[data-rtg-vending-album]");
      if(albumButton)albumButton.onclick=async(event)=>{
        event?.preventDefault?.();
        event?.stopPropagation?.();
        deps.closeModal?.({invokeOnClose:false});
        await deps.renderAlbum();
      };
      modalRoot?.querySelector?.("[data-rtg-pull]")?.addEventListener("click",async(event)=>{
        const button=event.currentTarget;
        if(button?.disabled)return;
        const machine=modalRoot?.querySelector?.("[data-rtg-vending-machine]");
        button.disabled=true;
        machine?.classList?.add("is-turning");
        try{
          motion?.start();
          const preparedPromise=deps.pull({reveal:false,mode:selectedMode});
          await new Promise(resolve=>setTimeout(resolve,620));
          const prepared=await preparedPromise;
          if(!prepared?.result||!prepared?.player)return;
          const rarityKey=String(prepared.result.rarity||prepared.player.category||"normale").trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"-");
          if(machine){
            const capsules=Array.from(machine.querySelectorAll?.("[data-capsule-rarity]")||[]);
            capsules.forEach(capsule=>capsule.classList.remove("is-selected"));
            const matching=capsules.filter(capsule=>capsule.dataset.capsuleRarity===rarityKey);
            const choices=matching.length?matching:capsules;
            const visualChoice=choices.length?choices[Math.floor(Math.random()*choices.length)]:null;
            const selected=motion?.select(choices)||visualChoice;
            if(selected){
              selected.dataset.capsuleRarity=rarityKey;
              selected.classList.add("is-selected");
              motion?.release(selected);
            }
            machine.dataset.pullRarity=rarityKey;
            machine.classList.add("is-revealing");
          }
          await new Promise(resolve=>setTimeout(resolve,980));
          showPullResult(prepared.result,prepared.player,selectedMode);
        }finally{
          motion?.stop();
          machine?.classList?.remove("is-turning","is-revealing");
          if(button?.isConnected)button.disabled=false;
        }
      });
    }
    function showPullResult(result,player,mode="team"){
      if(!result||!player)return null;
      deps.openModal?.(deps.runView.pullResultMarkup(result,player,deps.getSeasonDb()),{
        className:"rtg-modal rtg-pull-modal",
        onClose:()=>openVending(mode),
      });
      const modalRoot=deps.getModalRoot?.();
      modalRoot?.querySelector?.("[data-rtg-pull-player-detail]")?.addEventListener("click",event=>{
        const playerId=deps.id(event.currentTarget?.dataset?.rtgPullPlayerDetail||result.playerId);
        if(!playerId)return;
        deps.openPlayerDetails(playerId,"",{
          onClose:()=>showPullResult(result,player,mode),
        });
      });
      modalRoot?.querySelector?.("[data-rtg-pull-continue]")?.addEventListener("click",()=>{
        deps.closeModal?.();
      });
      return result;
    }
    return Object.freeze({openVending,showPullResult});
  }

  global.RoadToGloryVendingController=Object.freeze({create});
})(globalThis);
