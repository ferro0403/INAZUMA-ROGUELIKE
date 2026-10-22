(function coachView(global) {
  "use strict";
  const model=()=>global.RoadToGloryCoaches;
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fallback=c=>`<span class="rtg-coach-placeholder" aria-hidden="true"><span>⚽</span><b>${esc(c.name.split(" ").map(w=>w[0]).slice(0,2).join(""))}</b></span>`;

  // Full-body artwork MUST remain primary in coach details, irrespective of the
  // thumbnail. The legacy RTG id 4761 identifies Rene (Inazugle id 4763).
  const portraitCandidates=(c,fullbody=false,preferFullbodyThumbnail=false)=>{
    const extra=Array.isArray(c.imageFallbackUrls)?c.imageFallbackUrls:[];
    const sources=(fullbody||preferFullbodyThumbnail)
      ?[c.frontFullbodyUrl,c.imageUrl,...extra]
      :[c.imageUrl,...extra,c.frontFullbodyUrl];
    return [...new Set(sources.map(url=>String(url||"").trim()).filter(Boolean))];
  };
  function recoverPortraitImage(image){
    if(!image?.dataset)return false;
    const remaining=String(image.dataset.coachFallbacks||"").split("|").filter(Boolean);
    const next=remaining.shift();
    image.dataset.coachFallbacks=remaining.join("|");
    if(next){
      image.hidden=false;
      if(image.style?.removeProperty)image.style.removeProperty("display");
      else if(image.style)image.style.display="";
      image.classList?.toggle?.("rtg-coach-portrait--fullbody-thumbnail",next===image.dataset.coachFullbodyUrl&&image.dataset.coachCompactFullbody==="true");
      image.classList?.toggle?.("rtg-coach-fullbody--portrait-fallback",image.classList?.contains?.("rtg-coach-fullbody")&&next!==image.dataset.coachFullbodyUrl);
      image.src=next;
      return true;
    }
    image.hidden=true;
    if(image.style?.setProperty)image.style.setProperty("display","none","important");
    else if(image.style)image.style.display="none";
    const backup=image.nextElementSibling;
    if(backup?.style)backup.style.display="grid";
    return false;
  }
  // Capture image events on document: dynamically inserted modal cards may be
  // detached/replaced while loading; per-element inline onerror was unreliable
  // on the user's mobile preview and could leave a completely blank card.
  const isCoachPortrait=img=>img?.getAttribute?.("data-rtg-coach-image")!==null&&img?.getAttribute?.("data-rtg-coach-image")!==undefined;
  global.document?.addEventListener?.("error",event=>{
    if(isCoachPortrait(event.target))recoverPortraitImage(event.target);
  },true);
  global.document?.addEventListener?.("load",event=>{
    const image=event.target;
    if(isCoachPortrait(image)&&(Number(image.naturalWidth)<=1||Number(image.naturalHeight)<=1))
      recoverPortraitImage(image);
  },true);
  const portrait=(c,fullbody=false,preferFullbodyThumbnail=false)=>{
    if(!fullbody&&String(c.zukanId||"")==="4763"){
      // Direct official Inazugle thumbnail. This bypasses the generic player
      // portrait and its retry/visibility state, which left Rene blank in
      // mobile selection even though the SAME PNG loaded in his detail.
      // No guessed image extensions or fallback network URLs on these cards.
      const backup=fallback(c).replace('class="rtg-coach-placeholder"','class="rtg-coach-placeholder rtg-coach-placeholder--backup"');
      return `<img class="rtg-coach-portrait--rene-direct" src="${esc(c.imageUrl)}" alt="${esc(c.name)}" loading="eager" decoding="sync" referrerpolicy="no-referrer" onerror="this.onerror=null;this.hidden=true;this.style.setProperty('display','none','important');this.nextElementSibling?.classList.add('is-visible')">${backup}`;
    }
    const urls=portraitCandidates(c,fullbody,preferFullbodyThumbnail);
    const [url,...alternates]=urls;
    const backup=fallback(c).replace('class="rtg-coach-placeholder"','class="rtg-coach-placeholder rtg-coach-placeholder--backup"');
    const compactFullbody=preferFullbodyThumbnail&&!fullbody;
    const fullbodyArt=compactFullbody&&url===c.frontFullbodyUrl;
    return url?`<img class="${fullbody?"player-fullbody player-fullbody--fullbody rtg-coach-fullbody":"player-portrait rtg-coach-portrait"} ${fullbodyArt?"rtg-coach-portrait--fullbody-thumbnail":""}" src="${esc(url)}" data-rtg-coach-image="${esc(c.id)}" data-coach-alternate="${esc(alternates[0]||"")}" data-coach-fallbacks="${esc(alternates.join("|"))}" data-coach-fullbody-url="${esc(c.frontFullbodyUrl||"")}" data-coach-compact-fullbody="${compactFullbody}" alt="${esc(c.name)}" loading="eager" decoding="async">${backup}`:fallback(c);
  };
  const teamEmblem=c=>c.teamLogoUrl
    ? `<img class="rtg-coach-team-logo" src="${esc(c.teamLogoUrl)}" alt="" aria-hidden="true" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/emblems/neutral-team.svg'">`
    : '<span class="rtg-coach-team-icon" aria-hidden="true">⚽</span>';
  const statusLabel=code=>({owned:"POSSEDUTO",available:"DISPONIBILE",locked:"BLOCCATO","other-campaign":"ALTRA CAMPAGNA"})[code]||"";
  function card(c,status="locked",selected=false){
    const state=statusLabel(status);
    // Same markup/classes as PlayerView.compactCard: the card differs only in data and orange trim.
    return `<button type="button" class="player-card player-card-compact tactical-player-card tactical-player-card--desktop tactical-player-card--mobile mini-player squad-player-card rtg-picker-squad-card rtg-coach-card ${selected?"selected":""} ${status==="locked"?"rtg-coach-locked":""}" data-rtg-coach-detail="${esc(c.id)}" aria-label="Scheda allenatore ${esc(c.name)}">
      <span class="player-corner player-role" aria-label="Allenatore">ALL.</span><span class="player-corner player-overall" aria-label="${esc(c.season)}">${esc(c.season.replace("Season ","S"))}</span>
      <div class="player-portrait-wrap">${portrait(c)}</div>
      <div class="player-info"><div class="player-title"><strong title="${esc(c.name)}">${esc(c.name)}</strong></div>
      <div class="player-meta" aria-label="Dettagli allenatore"><span>${esc(c.team)}</span><span>${esc(state)}</span></div></div>
      <span class="player-corner player-level" aria-label="Staff">STAFF</span>
    </button>`;
  }
  // Exact structural counterpart of RoadToGloryAlbumView.albumRosterMarkup's
  // full-size player card; mini cards are ONLY used in the Squad/selection modal.
  // Coach album cards deliberately avoid the normal Album lock overlay: on a
  // three-column phone grid that overlay covered the portrait and even the name.
  function albumCard(c,status="locked"){
    return `<button type="button" class="player-card rtg-coach-album-card" data-rtg-coach-detail="${esc(c.id)}" aria-label="Apri scheda di ${esc(c.name)}">
      <span class="player-corner player-role" aria-label="Allenatore">ALL.</span>
      <span class="player-corner player-overall" aria-label="${esc(c.season)}">${esc(c.season.replace("Season ","S"))}</span>
      <div class="player-portrait-wrap">${portrait(c)}</div>
      <div class="player-info"><div class="player-title"><strong title="${esc(c.name)}">${esc(c.name)}</strong></div></div>
    </button>`;
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
  function vending(state){
    const free=model().eligible(state),cost=model().COST,tokens=Number(state.tokens)||0,canBuy=free.length>0&&tokens>=cost;
    const capsules=Array.from({length:14},(_,i)=>`<div class="rtg-vending-capsule-v9 c${i+1}" data-capsule-rarity="coach"></div>`).join("");
    // Same machine markup and capsule classes as RoadToGloryRunView.vendingMarkup.
    const token='<img class="rtg-token-icon" src="https://dxi4wb638ujep.cloudfront.net/1/k/z/q/zqioogobuek.png" alt="" aria-hidden="true">';
    return `<div class="rtg-vending rtg-vending--coaches rtg-paper-modal">
      <div class="rtg-vending-title"><div><p class="eyebrow">RTG · STAFF</p><h2>Distributore allenatori</h2></div></div>
      <div class="rtg-vending-stage"><div class="rtg-vending-machine-v9 rtg-vending-machine-v12" data-rtg-vending-machine aria-label="Distributore allenatori">
        <div class="rtg-vending-head-v9" aria-hidden="true"><span>CAPSULE STATION</span><strong>INAZUMA RTG</strong></div>
        <div class="rtg-vending-window-v9" aria-hidden="true">${capsules}<span class="rtg-vending-funnel-v10"></span><span class="rtg-vending-window-glare-v9"></span></div>
        <div class="rtg-vending-body-v9"><div class="rtg-vending-info-v9"><small>1 CAPSULA</small><strong>${cost}</strong></div><div class="rtg-vending-crank-v9" aria-hidden="true"><span></span></div><div class="rtg-vending-chute-v9" aria-hidden="true"><span class="rtg-vending-chute-well-v9"></span><span class="rtg-vending-chute-flap-v10"></span><div class="rtg-vending-prize-track-v9"><span class="rtg-vending-prize-v9"></span></div></div><div class="rtg-vending-brand-v9" aria-hidden="true">RTG</div></div>
      </div>
      <button type="button" class="btn btn-yellow rtg-vending-pull" data-rtg-coaches-pull ${canBuy?"":"disabled"}>${canBuy?`GIRA · ${cost} ${token}`:free.length?`MANCANO ${Math.max(0,cost-tokens)} ${token}`:"NESSUN ALLENATORE NUOVO"}</button>
      <div class="rtg-vending-wallet-chip"><span>GETTONI</span><strong>${tokens} ${token}</strong></div></div>
      <div class="rtg-coach-vending-notice">${free.length?`${free.length} allenatori disponibili`:"Completa una Season per sbloccare gli allenatori."} · Nessun doppione.</div>
      <button type="button" class="btn rtg-vending-album-link" data-rtg-coaches-tab="collection">ALBUM ALLENATORI</button>
    </div>`;
  }
  function markup(state,{tab="draw",equippedId=""}={}){
    const coaches=model().catalog(state),got=coaches.filter(c=>model().status(state,c.id)==="owned").length;
    return `<section class="rtg-coaches-window" aria-label="Allenatori"><header class="rtg-coaches-heading"><div><p class="eyebrow">ROAD TO GLORY · COLLEZIONE</p><h2>ALLENATORI</h2><p>${got} / ${coaches.length} ottenuti</p></div></header>
      <div class="rtg-coaches-tabs"><button type="button" class="${tab==="draw"?"active":""}" data-rtg-coaches-tab="draw">DISTRIBUTORE</button><button type="button" class="${tab==="collection"?"active":""}" data-rtg-coaches-tab="collection">COLLEZIONE</button></div>
      ${tab==="draw"?vending(state):`<div class="rtg-coaches-grid rtg-picker-grid">${coaches.map(c=>`<div class="rtg-coach-entry ${model().status(state,c.id)==="owned"?"is-unlocked":"is-locked"}">${card(c,model().status(state,c.id),equippedId===c.id)}${model().status(state,c.id)==="owned"?`<button type="button" class="rtg-coach-quick-equip" data-rtg-coaches-equip="${equippedId===c.id?"":esc(c.id)}" aria-label="${equippedId===c.id?"Rimuovi":"Assegna"} ${esc(c.name)}">${equippedId===c.id?"✓ ASSEGNATO":"＋ ASSEGNA"}</button>`:""}</div>`).join("")}</div>`}
    </section>`;
  }
  function detail(state,coachId,{equippedId=""}={}){
    const c=model().BY_ID[String(coachId)];if(!c)return "";
    const status=model().status(state,c.id),isOwned=status==="owned",selected=isOwned&&c.id===equippedId;
    // Same PlayerView.detailMarkup DOM sections, replacing overall/stats with ability data.
    return `<div class="player-detail-layout rtg-coach-detail rarity-coach" aria-label="Scheda allenatore ${esc(c.name)}">
      <section class="player-detail-hero ${c.name.length>18?"player-detail-hero--extra-long-name":c.name.length>12?"player-detail-hero--long-name":""}">
        <div class="player-detail-identity">
          <div class="player-detail-team">${teamEmblem(c)}<strong>ALLENATORI</strong></div>
          <div class="player-detail-heading"><p class="eyebrow">Scheda allenatore</p></div>
          <h2 class="player-detail-name">${esc(c.name)}</h2>
          <div class="player-detail-tags"><span class="role-chip"><b>${esc(c.season)}</b></span><span class="role-chip rtg-coach-team-chip">${teamEmblem(c)}${esc(c.team)}</span></div>
          <p class="detail-category"><span aria-hidden="true">★</span><small>Stato</small><strong>${selected?"ASSEGNATO":esc(statusLabel(status))}</strong></p>
        </div><div class="player-detail-visual rarity-coach">${portrait(c,true)}</div>
      </section>
      <section class="player-detail-content">
        <section class="player-detail-section"><h3><span>Potere allenatore</span></h3><div class="rtg-coach-power"><strong>PROSSIMAMENTE</strong><p>Il potere non è ancora attivo; verrà applicato soltanto prima delle partite.</p></div></section>
        <section class="player-detail-section"><h3><span>Informazioni</span></h3><div class="rtg-coach-profile-meta"><span><small>Squadra</small><b class="rtg-coach-profile-team">${teamEmblem(c)}${esc(c.team)}</b></span><span><small>Season</small><b>${esc(c.season)}</b></span></div>
        ${isOwned?`<button type="button" class="btn btn-yellow rtg-coach-equip" data-rtg-coaches-equip="${selected?"":esc(c.id)}">${selected?"RIMUOVI DALLA FORMAZIONE":"ASSEGNA ALLA FORMAZIONE"}</button>`:`<p class="rtg-coach-locked-note">${status==="locked"?`Completa ${esc(c.season)} per ottenere questa carta.`:"Disponibile nell'altra campagna."}</p>`}
        <button type="button" class="btn rtg-coach-back" data-rtg-coaches-back>← TORNA AGLI ALLENATORI</button></section>
      </section>
    </div>`;
  }
  function albumMarkup(state){
    const coaches=model().catalog(state),owned=model().owned(state),got=coaches.filter(c=>owned.has(c.id)).length,total=coaches.length;
    return `<main class="album-screen album-roster-screen album-roster-screen--modern rtg-album-roster-screen rtg-coaches-album">
      <header class="album-roster-hero"><div class="album-roster-hero__nav"><button type="button" class="btn section-root-button album-roster-back-button" data-rtg-album-coaches-back>←</button></div><div class="album-roster-hero__identity"><span class="album-team-logo album-roster-hero__logo">⚽</span><h1 class="album-roster-hero__name">ALLENATORI</h1></div><div class="album-roster-hero__stats"><span>${got} / ${total} allenatori sbloccati</span><strong class="album-roster-percent">${total?Math.round(100*got/total):0}%</strong></div><span class="album-roster-hero__bar"><span style="width:${total?100*got/total:0}%"></span></span></header>
      <section class="album-player-grid album-player-grid--modern" data-rtg-album-coaches>${coaches.map(c=>`<div class="album-player-entry rtg-coach-album-entry ${owned.has(c.id)?"is-unlocked":"is-locked"}" data-rtg-album-coach-entry="${esc(c.id)}">${albumCard(c,model().status(state,c.id))}<span class="rtg-coach-album-status ${owned.has(c.id)?"is-owned":""}">${owned.has(c.id)?"✓ OTTENUTO":"🔒 BLOCCATO"}</span></div>`).join("")}</section>
    </main>`;
  }
  function result(coach,state=null){
    // Separate coach reveal from the player pull result layout: no 92px card,
    // tilted frame, accidental min-height, or empty column on mobile.
    return `<div class="rtg-coaches-reward rtg-paper-modal" aria-label="Allenatore ottenuto">
      <header class="rtg-coaches-reward-heading"><span>ROAD TO GLORY · STAFF</span></header>
      <h2 class="rtg-coaches-reward-title">NUOVO ALLENATORE!</h2>
      <div class="rtg-coaches-reward-feature"><div class="rtg-coaches-reward-art">${card(coach,"owned")}</div>
        <div class="rtg-coaches-reward-info"><small>${esc(coach.season)} · STAFF</small><h3>${esc(coach.name)}</h3>
          <p>${esc(coach.team)}</p><span class="rtg-coaches-reward-unlocked">✓ AGGIUNTO ALLA COLLEZIONE</span></div>
      </div>
      ${state?`<div class="rtg-coaches-reward-balance"><span>SALDO GETTONI RTG</span><strong>${esc(Number(state.tokens)||0)}</strong></div>`:""}
      <button type="button" class="btn btn-yellow rtg-coaches-reward-continue" data-rtg-coaches-collection>CONTINUA →</button>
    </div>`;
  }
  global.RoadToGloryCoachesView=Object.freeze({card,albumCard,squadSlot,vending,markup,detail,albumMarkup,result});
})(globalThis);
