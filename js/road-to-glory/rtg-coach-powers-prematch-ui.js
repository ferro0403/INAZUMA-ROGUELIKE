(function(global){
  "use strict";
  const id=x=>String(x??"");
  const esc=s=>id(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const key=p=>id(p?.cardId||p?.playerId||p?.id);
  const role=p=>id(p?.normalizedRole||p?.position||p?.role).toUpperCase();
  const POWER={
    "36":["CAMBIO FORZATO","Seleziona un titolare avversario e la riserva che entrerà al suo posto. Il portiere si sostituisce solo con un altro portiere; gli altri giocatori di movimento possono avere ruoli differenti."],
    "1225":["PRESTITO A SORPRESA","Scegli una riserva avversaria da prendere in prestito e una delle tue 4 riserve da sostituire per questa partita."],
    "1275":["ESAURIMENTO OSCURO","Seleziona 2 titolari avversari. Inizieranno con metà dei PT, mantenendo invariati i PT massimi."],
    "1940":["TECNICA PROIBITA","Seleziona un titolare avversario e blocca 2 delle sue 4 mosse speciali dalla sua scheda giocatore."],
    "4761":["DISORDINE TATTICO","Scegli 2 giocatori di movimento avversari: si scambieranno le posizioni tattiche iniziali. Il portiere non può essere selezionato."],
  };
  let openForMatch=null;
  function open(ctx){
    const match=ctx.getMatch?.(),runtime=global.RoadToGloryCoachPreMatchRuntime;
    if(!match||match.presentation?.preMatchPowerStatus!=="pending"||
       !runtime?.PREMATCH_IDS.includes(id(match.preMatchCoachId)))return;
    const idMatch=id(match.matchId),coach=id(match.preMatchCoachId);
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
      if(coach==="36"){
        if(area==="oppLineup")return oppLineup;
        if(area==="oppBench")return selected.playerIds[0]?
          oppBench.filter(p=>runtime.canSwap(byId(oppLineup,selected.playerIds[0]),p)):[];
        return [];
      }
      if(coach==="1225")return area==="oppBench"?oppBench:area==="userBench"?userBench:[];
      if(coach==="1275"||coach==="1940"||coach==="4761"){
        return area==="oppLineup"?
          oppLineup.filter(p=>coach!=="4761"||role(p)!=="GK"):[];
      }
      return [];
    }
    function setPlayer(area,pid){
      if(!candidatesFor(area).some(p=>key(p)===pid))return;
      if(coach==="36"){
        if(area==="oppLineup")selected.playerIds=[pid];
        else if(selected.playerIds.length===1)selected.playerIds=[selected.playerIds[0],pid];
      }else if(coach==="1225"){
        if(area==="oppBench")selected.playerIds=[pid];
        else if(selected.playerIds.length===1)selected.playerIds.push(pid);
      }else if(coach==="1275"||coach==="4761"){
        if(selected.playerIds.includes(pid))selected.playerIds=selected.playerIds.filter(x=>x!==pid);
        else if(selected.playerIds.length<2)selected.playerIds.push(pid);
      }else if(coach==="1940"){
        selected.playerIds=[pid];selected.moveIndices=[];
        const moves=runtime.movesFor(match,byId(oppLineup,pid));
        if(moves.length!==4)return ctx.toast?.("Quattro mosse speciali non disponibili.","error");
        rememberModalScroll();
        ctx.openPlayerDetails?.(pid,"opponent",{
          allowRoleSwitch:false,onClose:()=>render(),
          coachMovePicker:{moves,selectedIndices:[],onConfirm:indices=>{
            selected.moveIndices=indices;ctx.closeModal?.({invokeOnClose:false});render();
          }},
        });
        return;
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
      const step=coach==="36"?selected.playerIds.length===0?"PRIMA: TITOLARE AVVERSARIO":"POI: RISERVA AVVERSARIA":
        coach==="1225"?selected.playerIds.length===0?"PRIMA: RISERVA AVVERSARIA":"POI: UNA TUA RISERVA":
        coach==="1940"?"GIOCATORE E DUE MOSSE": "SELEZIONA 2 TITOLARI";
      const opposingNeeded=coach!=="1225";
      const opponentCards=fieldMarkup("opponent");
      const ownCards=coach==="1225"?fieldMarkup("user"):"";
      const oppBenchSection=(coach==="36"||coach==="1225")
        ?'<section class="rtg-coach-prematch-area" data-coach-area="oppBench"><h3>PANCHINA AVVERSARIA</h3>'+
          benchMarkup(oppBench,"oppBench")+'</section>':"";
      const ownBenchSection=coach==="1225"
        ?'<section class="rtg-coach-prematch-area" data-coach-area="userBench"><h3>LA TUA PANCHINA</h3>'+
          benchMarkup(userBench,"userBench")+'</section>':"";
      const markup='<section class="rtg-coach-power-config rtg-coach-field-picker development-squad-card-scope rtg-coach-prematch-config" aria-label="Potere allenatore prepartita">'+
        '<h2>'+POWER[coach][0]+'</h2><p>'+POWER[coach][1]+'</p><h3>'+step+
        ' ('+selected.playerIds.length+'/'+(coach==="1940"?1:2)+')</h3>'+
        '<section class="rtg-coach-prematch-area" data-coach-area="oppLineup"><h3>CAMPO AVVERSARIO</h3>'+
        opponentCards+'</section>'+oppBenchSection+
        (coach==="1225"?'<section class="rtg-coach-prematch-area" data-coach-area="userLineup"><h3>LA TUA FORMAZIONE</h3>'+ownCards+'</section>':"")+
        ownBenchSection+
        (coach==="1940"&&selected.playerIds.length?'<p>Mosse selezionate: '+selected.moveIndices.length+'/2. Tocca di nuovo il giocatore per modificarle.</p>':"")+
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
