(function coachView(global) {
  "use strict";
  const model=()=>global.RoadToGloryCoaches;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fallback=c=>`<span class="rtg-coach-placeholder" aria-hidden="true"><span>⚽</span><b>${esc(c.name.split(" ").map(w=>w[0]).slice(0,2).join(""))}</b></span>`;
  const portrait=(c,fullbody=false)=>{
    const url=fullbody?(c.frontFullbodyUrl||c.imageUrl):(c.imageUrl||c.frontFullbodyUrl);
    return url?`<img class="player-portrait rtg-coach-portrait${fullbody?" rtg-coach-portrait--full":""}" src="${esc(url)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">${fallback(c).replace('class="rtg-coach-placeholder"','class="rtg-coach-placeholder rtg-coach-placeholder--backup"')}`:fallback(c);
  };
  const statusLabel=code=>({owned:"POSSEDUTO",available:"DISPONIBILE",locked:"BLOCCATO","other-campaign":"ALTRA CAMPAGNA"})[code]||"";
  function card(c,status,selected=false){
    return `<button type="button" class="player-card player-card-compact tactical-player-card mini-player rtg-coach-card rtg-coach-card--${esc(status)} ${selected?"is-equipped":""}" data-rtg-coach-detail="${esc(c.id)}" aria-label="Scheda allenatore ${esc(c.name)}"><span class="player-corner player-role">ALL.</span><span class="player-corner player-overall">${esc(c.season.replace("Season ","S"))}</span><div class="player-portrait-wrap">${portrait(c)}</div><div class="player-info"><div class="player-title"><strong>${esc(c.name)}</strong></div><div class="player-meta"><span>${esc(c.team)}</span></div></div><span class="rtg-coach-status">${selected?"IN SQUADRA":esc(statusLabel(status))}</span></button>`;
  }
  function squadSlot(state,coachId=""){
    const c=model().owned(state).has(String(coachId))?model().BY_ID[String(coachId)]:null;
    return `<section class="rtg-coach-squad-slot" aria-label="Allenatore della formazione">
      <div class="rtg-coach-squad-heading"><h2>ALLENATORE</h2><b>STAFF</b></div>
      ${c?`<div class="rtg-coach-squad-selected"><button type="button" data-rtg-squad-coach-detail class="rtg-coach-squad-image" aria-label="Scheda di ${esc(c.name)}">${portrait(c)}</button><div><strong>${esc(c.name)}</strong><span>${esc(c.team)} · ${esc(c.season)}</span><small>Potere non attivo</small></div></div>`:
      `<div class="rtg-coach-squad-empty"><b aria-hidden="true">+</b><span>Nessun allenatore assegnato</span></div>`}
      <div class="rtg-coach-squad-buttons"><button type="button" class="btn" data-rtg-squad-coach-select>${c?"CAMBIA ALLENATORE":"ASSEGNA ALLENATORE"}</button>${c?'<button type="button" class="btn" data-rtg-squad-coach-detail>SCHEDA / RIMUOVI</button>':""}</div>
    </section>`;
  }
  function markup(state,{tab="draw",equippedId=""}={}){
    const coaches=model().catalog(state),free=model().eligible(state),cost=model().COST,canBuy=free.length>0&&Number(state.tokens)>=cost;
    const ownedCount=coaches.filter(c=>model().status(state,c.id)==="owned").length;
    return `<section class="rtg-coaches-window rtg-paper-modal" aria-label="Distributore allenatori"><header class="rtg-coaches-heading"><div><p class="eyebrow">ROAD TO GLORY · COLLEZIONE</p><h2>ALLENATORI</h2><p>${ownedCount}/${coaches.length} ottenuti · 1 carta per allenatore</p></div><span class="rtg-coach-title-stamp">STAFF</span></header><div class="rtg-coaches-tabs"><button type="button" class="${tab==="draw"?"active":""}" data-rtg-coaches-tab="draw">DISTRIBUTORE</button><button type="button" class="${tab==="collection"?"active":""}" data-rtg-coaches-tab="collection">COLLEZIONE</button></div>${tab==="draw"?`<div class="rtg-coaches-vending"><div class="rtg-coaches-vending-emblem" aria-hidden="true"><span>★</span><b>STAFF</b></div><div class="rtg-coaches-vending-description"><strong>${cost} GETTONI RTG</strong><span>${free.length?`${free.length} allenatori disponibili · zero doppioni`:"Nessun allenatore nuovo disponibile"}</span></div><button type="button" class="btn btn-yellow" data-rtg-coaches-pull ${canBuy?"":"disabled"}>${free.length?(canBuy?"ESTRAI ALLENATORE":`SERVONO ${Math.max(0,cost-Number(state.tokens))} GETTONI`):"NESSUNA ESTRAZIONE DISPONIBILE"}</button><small>Portafoglio: ${esc(Number(state.tokens)||0)} gettoni</small></div>`:`<p class="rtg-coaches-collection-intro">Seleziona una carta ottenuta per visualizzarla o assegnarla alla tua formazione. I poteri arriveranno in seguito.</p>`}<div class="rtg-coaches-grid">${coaches.map(c=>card(c,model().status(state,c.id),c.id===equippedId)).join("")}</div><p class="rtg-coaches-help">Una Season deve essere completata per rendere disponibili i suoi allenatori. Nessun doppione.</p></section>`;
  }
  function detail(state,coachId,{equippedId=""}={}){
    const c=model().BY_ID[String(coachId)];
    if(!c)return "";
    const status=model().status(state,c.id),isOwned=status==="owned",selected=isOwned&&c.id===equippedId;
    const name=c.name.split(" "),last=name.pop(),first=name.join(" ");
    return `<section class="rtg-coach-detail rtg-paper-modal" aria-label="Scheda allenatore ${esc(c.name)}"><div class="rtg-coach-detail-hero"><button type="button" class="rtg-coach-detail-back" data-rtg-coaches-back aria-label="Torna agli allenatori">←</button><div class="rtg-coach-role-tag">⚽ ALLENATORI</div><p class="rtg-coach-eyebrow">SCHEDA ALLENATORE</p><h2>${esc(first)}<br><strong>${esc(last)}</strong></h2><div class="rtg-coach-identity"><span>${esc(c.season)}</span><span>${esc(c.team)}</span></div><div class="rtg-coach-hero-portrait">${portrait(c,true)}</div><div class="rtg-coach-card-status">${selected?"ASSEGNATO":esc(statusLabel(status))}</div></div><div class="rtg-coach-detail-body"><h3>★ POTERE ALLENATORE</h3><div class="rtg-coach-power-placeholder"><b>PROSSIMAMENTE</b><p>Il potere non è ancora attivo. Gli allenatori non modificano PT, mosse, statistiche o partite in questa versione.</p></div><div class="rtg-coach-detail-info"><span><small>SQUADRA</small><strong>${esc(c.team)}</strong></span><span><small>SEASON</small><strong>${esc(c.season)}</strong></span><span><small>ID ZUKAN</small><strong>${esc(c.id)}</strong></span></div>${isOwned?`<button type="button" class="btn btn-yellow rtg-coach-equip" data-rtg-coaches-equip="${esc(selected?"":c.id)}">${selected?"RIMUOVI DALLA FORMAZIONE":"ASSEGNA ALLA FORMAZIONE"}</button>`:`<p class="rtg-coach-locked-note">${status==="locked"?`Completa ${esc(c.season)} per sbloccare questa carta nel distributore.`:"Disponibile nell'altra campagna RTG."}</p>`}</div></section>`;
  }
  function result(coach){return `<section class="rtg-coaches-reward rtg-paper-modal"><p>NUOVO ALLENATORE!</p><h2>${esc(coach.name)}</h2><div class="rtg-coaches-reward-card">${card(coach,"owned")}</div><strong>${esc(coach.team)} · ${esc(coach.season)}</strong><p>La carta è stata aggiunta alla tua collezione RTG.</p><button type="button" class="btn btn-yellow" data-rtg-coaches-collection>VAI ALLA COLLEZIONE</button></section>`;}
  global.RoadToGloryCoachesView=Object.freeze({card,markup,detail,result,squadSlot});
})(globalThis);
