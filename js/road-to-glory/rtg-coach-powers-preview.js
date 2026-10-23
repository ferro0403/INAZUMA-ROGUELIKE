(function(global){
  "use strict";
  // RTG Squad-only projection. Every result is ephemeral and read-only;
  // neither permanent card data nor the canonical campaign is mutated.
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const id=x=>String(x??"");
  const cardId=x=>id(x?.cardId||x?.playerId||x?.id||x);
  const statOrder=["attack","control","speed","stamina","grit","defense","physical","save"];
  const label={attack:"Tiro",control:"Controllo",speed:"Velocità",stamina:"Resistenza",
    grit:"Grinta",defense:"Difesa",physical:"Fisico",save:"Parata"};
  const elementNames={fire:"Fuoco",wind:"Vento",forest:"Albero",mountain:"Montagna"};
  function projected({player,cardId:ref,squad,state,seasonId,playerResolver,freeAgentsDb}={}){
    if(!player||!squad||!ref)return null;
    const engine=global.RoadToGloryCoachPowerRuntime;
    if(!engine?.powerReady(squad.coachId)||
       !global.RoadToGloryCoaches?.owned?.(state)?.has?.(id(squad.coachId)))return null;
    const config=engine.selected(squad),key=id(ref);
    if(!config||!config.cardIds.includes(key))return null;
    // No stale selection preview when the player was moved or ownership changed.
    const all=[...(squad.lineup||[]),...(squad.bench||[])].map(cardId);
    if(!all.includes(key))return null;
    const coachId=config.coachId,details={coachId,player,original:player,note:"",stats:[],pt:null,costs:{}};
    if(coachId==="208"){
      if(config.cardIds.length!==2||!config.cardIds.every(x=>(squad.lineup||[]).map(cardId).includes(x)))return null;
      const base=global.RtgFourMovesRuntime?.ptBreakdown?.(player.baseStats||player.stats||player,player.finalRarity||player.category);
      if(!base)return null;
      details.pt={...base,total:base.total+50,coachBonus:50};details.badge="+50 PT";
      details.note="FIDUCIA NEI CAMPIONI · +50 PT iniziali e massimi per la partita";
    }else if(coachId==="1329"){
      if((squad.lineup||[]).every(x=>cardId(x)!==key)||config.moveIndices.length!==2)return null;
      const moves=engine.fourMoves(player,seasonId);
      if(moves.length!==4||new Set(config.moveIndices).size!==2)return null;
      for(const index of config.moveIndices){
        const price=Number(moves[index]?.ptCost);
        if(!Number.isInteger(price)||price<=0)return null;
        details.costs[index]=Math.ceil(price/2);
      }
      details.note="ALLENAMENTO SPECIALIZZATO · 2 mosse a metà costo PT";details.badge="PT -50%";
    }else if(coachId==="1777"){
      if((squad.bench||[]).every(x=>cardId(x)!==key)||config.cardIds.length!==1)return null;
      const overall=Number(player.overall);
      details.note="FUORI QUOTA · OVR reale "+overall+" · contributo al limite squadra "+Math.min(overall,60)+" (su 15 giocatori)";
      details.badge="CAP "+Math.min(overall,60);
    }else if(coachId==="4401"){
      if((squad.lineup||[]).every(x=>cardId(x)!==key)||
         !engine.ELEMENTS.includes(config.element)||config.cardIds.length!==1)return null;
      details.player={...player,element:elementNames[config.element]||config.element};
      details.note="CAMBIO DI ELEMENTO · "+(elementNames[config.element]||config.element)+" durante la partita";
      details.badge=elementNames[config.element]||config.element;
    }else if(coachId==="1974"){
      if(config.cardIds.length!==1)return null;
      const target=engine.nextRarity(engine.rarityOf(player));
      if(!target)return null;
      const upgraded=global.RoadToGloryCoachRarityPower?.upgrade?.({
        player,targetRarity:target,cardId:key,playerResolver,freeAgentsDb,seasonId,squad,
      });
      if(!upgraded||engine.rarityOf(upgraded)!==target)return null;
      const baseStats=player.stats||player.baseStats||{};
      const newStats=upgraded.stats||{};
      details.stats=statOrder.map(k=>({key:k,label:label[k]||k,before:Number(baseStats[k]||0),
        after:Number(newStats[k]||0)})).filter(row=>row.after>row.before);
      details.player={...player,...upgraded,cardId:key,playerId:player.playerId,
        baseStats:{...baseStats},category:target,finalRarity:target};
      details.pt=global.RtgFourMovesRuntime?.ptBreakdown?.(newStats,target)||null;
      details.badge=target;
      details.note="POTENZIALE RISVEGLIATO · "+engine.rarityOf(player)+" → "+target+
        " · OVR "+Number(player.overall)+" → "+Number(upgraded.overall)+
        " in partita. Il limite squadra continua a usare l'OVR originale.";
    }else return null;
    return details;
  }
  function decorateDetail({root,info,movePicker}={}){
    const content=root?.querySelector?.(".player-detail-content");
    if(!content)return;
    if(info){
      const banner=root.ownerDocument?.createElement?.("section");
      if(banner){
        banner.className="player-detail-section rtg-coach-player-preview";
        banner.innerHTML='<h3><span>Potere allenatore · anteprima Squadra</span></h3><p>'+
          esc(info.note)+'</p>'+(info.stats.length?
          '<div class="rtg-coach-preview-stat-grid">'+info.stats.map(x=>'<span><strong>'+
            esc(x.label)+'</strong> '+esc(x.before)+' → '+esc(x.after)+
            ' <b>+'+esc(x.after-x.before)+'</b></span>').join("")+'</div>':"");
        content.insertBefore(banner,content.firstChild);
      }
      if(info.pt){
        const top=root.querySelector(".rtg-pt-top strong");
        if(top)top.textContent=info.pt.total+" PT";
        const box=root.querySelector(".rtg-pt-breakdown");
        if(box)box.innerHTML='<div><span>PT base (effettivi in partita)</span><strong>'+
          esc(info.pt.base)+' PT</strong></div><div><span>Bonus rarità</span><strong>+'+
          esc(info.pt.bonus)+' PT</strong></div>'+
          (info.pt.coachBonus?'<div><span>Bonus allenatore</span><strong>+'+
          esc(info.pt.coachBonus)+' PT</strong></div>':"");
        const note=root.querySelector(".rtg-pt-note");
        if(note)note.textContent="Anteprima effettiva per la prossima partita. La carta permanente non cambia.";
      }
      for(const [index,value] of Object.entries(info.costs)){
        const card=root.querySelectorAll(".rtg-four-moves-item")?.[Number(index)];
        const text=card?.querySelector(".rtg-pt-cost strong");
        if(text){text.textContent=value+" PT (potere allenatore)";card.classList.add("rtg-coach-move-discount");}
      }
    }
    if(!movePicker)return;
    const cards=Array.from(root.querySelectorAll(".rtg-four-moves-item"));
    const state=new Set(movePicker.selectedIndices||[]);
    const allowed=Array.isArray(movePicker.moves)?movePicker.moves:[];
    const controls=[];
    cards.forEach((card,index)=>{
      const move=allowed[index],cost=Number(move?.ptCost);
      if(!move||!Number.isInteger(cost)||cost<=0)return;
      const button=root.ownerDocument.createElement("button");
      button.type="button";button.className="btn rtg-coach-move-select";
      const update=()=>{
        button.textContent=state.has(index)?"✓ MOSSA SELEZIONATA":"SELEZIONA QUESTA MOSSA";
        button.classList.toggle("is-selected",state.has(index));
        card.classList.toggle("is-selected",state.has(index));
      };
      button.addEventListener("click",()=>{
        if(state.has(index))state.delete(index);else if(state.size<2)state.add(index);
        controls.forEach(fn=>fn());
      });
      card.appendChild(button);controls.push(update);update();
    });
    const finish=root.ownerDocument.createElement("button");
    finish.type="button";finish.className="btn btn-yellow rtg-coach-moves-confirm";
    const updateFinish=()=>{
      finish.disabled=state.size!==2;
      finish.textContent="CONFERMA LE MOSSE ("+state.size+"/2)";
    };
    controls.push(updateFinish);updateFinish();
    finish.addEventListener("click",()=>{if(state.size===2)movePicker.onConfirm?.([...state].sort());});
    const section=root.querySelector(".player-detail-rtg-four-moves");
    section?.appendChild(finish);
  }
  global.RoadToGloryCoachSquadPreview=Object.freeze({projected,decorateDetail});
})(globalThis);
