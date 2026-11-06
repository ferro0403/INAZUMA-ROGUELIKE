(function(global){
  "use strict";
  const id=x=>String(x??"");
  const esc=s=>id(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const key=p=>id(p?.cardId||p?.playerId||p?.id);
  const role=p=>id(p?.normalizedRole||p?.position||p?.role).toUpperCase();
  // Titolo e spiegazione del potere prepartita: dai dati dell'allenatore (power.ui), non scritti qui.
  const powerUi=coachId=>global.RoadToGloryCoaches?.BY_ID?.[coachId]?.power?.ui||{};
  let openForMatch=null;
  function open(ctx){
    const match=ctx.getMatch?.(),runtime=global.RoadToGloryCoachPreMatchRuntime;
    if(!match||match.presentation?.preMatchPowerStatus!=="pending"||
       !runtime?.PREMATCH_IDS.includes(id(match.preMatchCoachId)))return;
    const idMatch=id(match.matchId),coach=id(match.preMatchCoachId);
    const power=runtime.powerOf?.(coach),coachType=power?.type||"";
    const selected={playerIds:[],moveIndices:[]};
    openForMatch=idMatch;
    let retainedModalTop=0;
    const rememberModalScroll=()=>{const modal=ctx.getModalRoot?.()?.querySelector?.(".modal");if(modal)retainedModalTop=modal.scrollTop||0;};
    const restoreModalScroll=()=>{
      const modal=ctx.getModalRoot?.()?.querySelector?.(".modal");
      if(!modal)return;
      const restore=()=>{if(modal.isConnected!==false)modal.scrollTop=retainedModalTop;};
      const raf=global.requestAnimationFrame;
      if(typeof raf==="function")raf(()=>raf(restore));else restore();
    };
    const byId=(arr,x)=>arr.find(p=>key(p)===x)||null;
    const o=match.opponentSquad||{},u=match.userSquad||{};
    const oppLineup=o.lineup||[],oppBench=o.bench||[],userBench=u.bench||[];
    const valid=()=>!!runtime.validate(match,coach,selected);
    function candidatesFor(area){
      if(coachType==="swapOpponentStarter"){
        if(area==="oppLineup")return oppLineup;
        if(area==="oppBench")return selected.playerIds[0]?
          oppBench.filter(p=>runtime.canSwap(byId(oppLineup,selected.playerIds[0]),p)):[];
        return [];
      }
      if(coachType==="borrowOpponentReserve")return area==="oppBench"?oppBench:area==="userBench"?userBench:[];
      if(coachType==="drainOpponentPt"||coachType==="blockOpponentMoves"||coachType==="swapOpponentPositions"){
        return area==="oppLineup"?
          oppLineup.filter(p=>coachType!=="swapOpponentPositions"||role(p)!=="GK"):[];
      }
      return [];
    }
    function setPlayer(area,pid){
      if(!candidatesFor(area).some(p=>key(p)===pid))return;
      if(coachType==="swapOpponentStarter"){
        if(area==="oppLineup")selected.playerIds=[pid];
        else if(selected.playerIds.length===1)selected.playerIds=[selected.playerIds[0],pid];
      }else if(coachType==="borrowOpponentReserve"){
        if(area==="oppBench")selected.playerIds=[pid];
        else if(selected.playerIds.length===1)selected.playerIds.push(pid);
      }else if(coachType==="drainOpponentPt"||coachType==="swapOpponentPositions"){
        if(selected.playerIds.includes(pid))selected.playerIds=selected.playerIds.filter(x=>x!==pid);
        else if(selected.playerIds.length<2)selected.playerIds.push(pid);
      }else if(coachType==="blockOpponentMoves"){
        selected.playerIds=[pid];selected.moveIndices=[];
        return render();
      }
      render();
    }
    function fieldMarkup(side){
      const squad=side==="opponent"?o:u;
      return ctx.squadView?.matchPitchMarkup?.(squad,{side,mode:"prematch"})||"";
    }
    function benchMarkup(players,area){
      if(!players.length)return '<p class="rtg-coach-prematch-empty">Nessuna riserva disponibile.</p>';
      return '<div class="rtg-coach-picker-bench-grid">'+players.map(p=>
        ctx.squadView?.playerCard?.({cardId:key(p),playerId:id(p.playerId),source:"",player:p}, "bench",{readOnly:true})||"").join("")+'</div>';
    }
    function render(){
      if(openForMatch!==idMatch||ctx.getMatch?.()?.matchId!==idMatch)return;
      const disabled=valid()?"":" disabled";
      const step=coachType==="swapOpponentStarter"?selected.playerIds.length===0?"PRIMA: TITOLARE AVVERSARIO":"POI: RISERVA AVVERSARIA":
        coachType==="borrowOpponentReserve"?selected.playerIds.length===0?"PRIMA: RISERVA AVVERSARIA":"POI: UNA TUA RISERVA":
        coachType==="blockOpponentMoves"?"GIOCATORE · TUTTE LE MOSSE": "SELEZIONA 2 TITOLARI";
      const opposingNeeded=coachType!=="borrowOpponentReserve";
      const opponentCards=fieldMarkup("opponent");
      const ownCards=coachType==="borrowOpponentReserve"?fieldMarkup("user"):"";
      const oppBenchSection=(coachType==="swapOpponentStarter"||coachType==="borrowOpponentReserve")
        ?'<section class="rtg-coach-prematch-area" data-coach-area="oppBench"><h3>PANCHINA AVVERSARIA</h3>'+
          benchMarkup(oppBench,"oppBench")+'</section>':"";
      const ownBenchSection=coachType==="borrowOpponentReserve"
        ?'<section class="rtg-coach-prematch-area" data-coach-area="userBench"><h3>LA TUA PANCHINA</h3>'+
          benchMarkup(userBench,"userBench")+'</section>':"";
      const markup='<section class="rtg-coach-power-config rtg-coach-field-picker development-squad-card-scope rtg-coach-prematch-config" aria-label="Potere allenatore prepartita">'+
        '<h2>'+powerUi(coach).title+'</h2><p>'+powerUi(coach).note+'</p><h3>'+step+
        ' ('+selected.playerIds.length+'/'+(power?.params?.picks||2)+')</h3>'+
        '<section class="rtg-coach-prematch-area" data-coach-area="oppLineup"><h3>CAMPO AVVERSARIO</h3>'+
        opponentCards+'</section>'+oppBenchSection+
        (coachType==="borrowOpponentReserve"?'<section class="rtg-coach-prematch-area" data-coach-area="userLineup"><h3>LA TUA FORMAZIONE</h3>'+ownCards+'</section>':"")+
        ownBenchSection+
        (coachType==="blockOpponentMoves"&&selected.playerIds.length?'<p>Tutte le mosse speciali disponibili del giocatore selezionato saranno bloccate.</p>':"")+
        '<div class="rtg-coach-power-actions">'+
        '<button type="button" class="btn btn-yellow" data-coach-prematch-apply'+disabled+'>CONFERMA POTERE</button>'+
        '<button type="button" class="btn" data-coach-prematch-skip>CONTINUA SENZA POTERE</button></div></section>';
      const active=ctx.getModalRoot?.()?.querySelector?.(".rtg-coach-prematch-config");
      if(active)active.outerHTML=markup;
      else {ctx.openModal?.(markup,{className:"rtg-modal rtg-coach-power-modal"});restoreModalScroll();}
      const root=ctx.getModalRoot?.();
      root?.querySelectorAll?.("[data-coach-area] [data-rtg-squad-player]")?.forEach(button=>{
        const area=button.closest("[data-coach-area]")?.dataset.coachArea||"",pid=id(button.dataset.rtgSquadPlayer);
        const enabled=candidatesFor(area).some(p=>key(p)===pid);
        button.disabled=!enabled;
        const selectedCard=selected.playerIds.includes(pid);
        button.setAttribute("aria-pressed",selectedCard?"true":"false");
        button.closest(".rtg-squad-card-slot")?.classList.toggle("rtg-coach-power-picked",selectedCard);
        if(enabled)button.addEventListener("click",()=>setPlayer(area,pid));
      });
      root?.querySelector?.("[data-coach-prematch-apply]")?.addEventListener("click",async()=>{
        if(!valid()||openForMatch!==idMatch)return;
        openForMatch=null; // prevent double submit
        try{await ctx.commit?.(idMatch,selected,false);ctx.closeModal?.();ctx.render?.();}
        catch(e){openForMatch=idMatch;ctx.toast?.(e?.message||"Impossibile salvare il potere","error");render();}
      });
      root?.querySelector?.("[data-coach-prematch-skip]")?.addEventListener("click",async()=>{
        if(openForMatch!==idMatch)return;
        openForMatch=null;
        try{await ctx.commit?.(idMatch,null,true);ctx.closeModal?.();ctx.render?.();}
        catch(e){openForMatch=idMatch;ctx.toast?.(e?.message||"Impossibile continuare","error");render();}
      });
    }
    render();
  }
  global.RoadToGloryCoachPreMatchUi=Object.freeze({open});
})(globalThis);
