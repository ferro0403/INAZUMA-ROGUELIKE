(function (global) {
  "use strict";

  const TOKEN_URL="https://dxi4wb638ujep.cloudfront.net/1/k/z/q/zqioogobuek.png";

  function create(deps={}){
    const escape=deps.escapeHtml||((value)=>String(value??""));
    const compactPlayerCardMarkup=deps.compactPlayerCardMarkup||null;
    const economy=deps.economy||global.RoadToGloryEconomy;

    const rtgTokenIcon=(className="")=>`<img class="rtg-token-icon ${escape(className)}" src="${TOKEN_URL}" alt="" aria-hidden="true" draggable="false">`;
    const rarityClass=(rarity)=>`rarity-${String(rarity||"debole").trim().toLowerCase()}`;

    function projectImage(rarity){
      return global.DevelopmentV2?.ASSETS?.[rarity]||"";
    }

    function shopMarkup({state={}}={}){
      const cards=economy.PROJECT_RARITIES.map((rarity)=>{
        const price=economy.PROJECT_PRICES[rarity];
        return `<article class="shop-product shop-project shop-project--${escape(rarity.toLowerCase())}">
          <img src="${escape(projectImage(rarity))}" alt="">
          <h3>PROGETTO ${escape(rarity.toUpperCase())}</h3>
          <p>Posseduti <b>×${escape(state.projects?.[rarity]||0)}</b></p>
          <strong class="rtg-shop-price">${rtgTokenIcon("rtg-shop-price-icon")}${escape(price)} GETTONI</strong>
          <button class="btn btn-yellow" data-rtg-buy-project="${escape(rarity)}" ${Number(state.tokens||0)<price?"disabled":""}>ACQUISTA</button>
        </article>`;
      }).join("");
      return `<main class="shop-screen rtg-shop-screen">
        <header class="shop-header">
          <button type="button" class="shop-back" data-rtg-economy-back aria-label="Torna a Road to Glory">←</button>
          <div><p class="eyebrow">ROAD TO GLORY</p><h1>NEGOZIO</h1></div>
        </header>
        <section class="shop-wallet rtg-shop-wallet">
          <div class="shop-coins">${rtgTokenIcon()}<span><small>GETTONI RTG</small><b>${escape(Number(state.tokens)||0)}</b></span></div>
        </section>
        <section class="shop-grid">${cards}</section>
        <section class="rtg-economy-crosslink"><button type="button" class="btn btn-yellow" data-rtg-open-development>CENTRO DI SVILUPPO</button></section>
      </main>`;
    }

    function squadCard(player,dataAttr=""){
      if(!player)return "";
      if(!compactPlayerCardMarkup){
        return `<article class="development-squad-card"><strong>${escape(player.name||player.playerId||"Giocatore")}</strong><span>OVR ${escape(player.overall??player.finalOverall??"—")}</span></article>`;
      }
      return compactPlayerCardMarkup(player,{
        level:player.displayLevel??player.level??20,
        overall:player.overall??player.finalOverall,
        dataAttr,
        extraClass:"squad-player-card development-squad-card",
      });
    }

    function projectInventoryMarkup(state={}){
      return economy.PROJECT_RARITIES.map((rarity)=>`<article class="project-inventory-item ${rarityClass(rarity)}">
        <span class="project-inventory-image"><img src="${escape(projectImage(rarity))}" alt="" loading="lazy"></span>
        <strong>${escape(rarity)}</strong>
        <b>×${escape(state.projects?.[rarity]||0)}</b>
      </article>`).join("");
    }

    function resourceIcon(type,rarity=""){
      if(type==="project"){
        return `<span class="development-resource-icon project-image-frame"><img src="${escape(projectImage(rarity))}" alt="" loading="lazy" decoding="async"></span>`;
      }
      return `<span class="development-resource-icon rtg-development-token-icon">${rtgTokenIcon()}</span>`;
    }

    function requirement({type,rarity="",label,current=null,required=0,ready=true,compact=false}={}){
      const tag=compact?"span":"article";
      const value=current==null?`×${escape(required)}`:`${escape(current)} / ${escape(required)}`;
      return `<${tag} class="development-requirement ${ready?"is-ready":"is-missing"}">
        ${resourceIcon(type,rarity)}
        <span><small>${escape(label)}</small><strong>${value}</strong></span>
        ${compact?"":`<b aria-label="${ready?"Requisito soddisfatto":"Requisito mancante"}">${ready?"✓":"!"}</b>`}
      </${tag}>`;
    }

    function playerGrid(players=[]){
      if(!players.length)return '<p class="empty-state">Nessun giocatore RTG corrisponde ai filtri.</p>';
      return players.map((player)=>{
        const key=player.cardId||player.playerId;
        return `<div data-rtg-development-player="${escape(key)}">${squadCard(player,`data-rtg-development-card="${escape(key)}" aria-label="Seleziona ${escape(player.name||"giocatore")}"`)}${player.category==="Aurico"?'<span class="development-max" aria-label="Rarità massima">MAX</span>':""}</div>`;
      }).join("");
    }


    function playerPaginationMarkup(page=1,totalPages=1,total=0){
      if(totalPages<=1)return "";
      const prev=page>1?`<button type="button" class="btn btn-ghost" data-rtg-development-page="${page-1}">← PRECEDENTI</button>`:"";
      const next=page<totalPages?`<button type="button" class="btn btn-ghost" data-rtg-development-page="${page+1}">SUCCESSIVI →</button>`:"";
      return `<nav class="development-pagination" aria-label="Pagine giocatori">${prev}<strong>${escape(page)} / ${escape(totalPages)}</strong>${next}<small>${escape(total)} giocatori</small></nav>`;
    }

    function selectedMarkup(model={}){
      const player=model.player;
      if(!player)return "";
      const key=player.cardId||player.playerId;
      const selectedCard=`<div class="development-selected-card">${squadCard(player,`data-rtg-development-selected-card="${escape(key)}" aria-label="Apri la scheda di ${escape(player.name||"giocatore")}"`)}</div>`;
      if(!model.preview?.ok&&model.preview?.reason==="max"){
        return `<section class="development-selected development-squad-card-scope"><p class="eyebrow">GIOCATORE SELEZIONATO</p><div class="development-selected-layout">${selectedCard}<div class="development-selected-copy"><h2>${escape(player.name)}</h2><p class="development-max-copy">MAX · RARITÀ MASSIMA</p><button class="btn btn-ghost" data-rtg-change-development-player>CAMBIA GIOCATORE</button></div></div></section>`;
      }
      const preview=model.preview;
      if(!preview?.ok)return "";
      const projectMissing=Math.max(0,Number(preview.missing?.projects)||0);
      const tokenMissing=Math.max(0,Number(preview.missing?.tokens)||0);
      const missing=[
        projectMissing?`MANCA ${projectMissing} PROGETTO ${String(preview.target).toUpperCase()}`:"",
        tokenMissing?`MANCANO ${tokenMissing} GETTONI`:"",
      ].filter(Boolean);
      const projectRequirement=preview.cost.projects?requirement({
        type:"project",rarity:preview.target,label:`Progetto ${preview.target}`,
        current:preview.haveProject,required:preview.cost.projects,ready:projectMissing===0,
      }):"";
      return `<section class="development-selected development-squad-card-scope">
        <p class="eyebrow">GIOCATORE SELEZIONATO</p>
        <div class="development-selected-layout">
          ${selectedCard}
          <div class="development-selected-copy">
            <h2>${escape(player.name)}</h2>
            <strong class="development-rarity-step">${escape(preview.currentRarity)} <span>→</span> ${escape(preview.target)}</strong>
            <p class="development-potential">Overall / potenziale <b>${escape(player.overall)} / ${escape(player.potential)}</b> → <b>${escape(model.after?.overall??preview.targetPotential)} / ${escape(preview.targetPotential)}</b></p>
            <h3>REQUISITI EVOLUZIONE</h3>
            <div class="development-requirements">
              ${projectRequirement}
              ${requirement({type:"tokens",label:"Gettoni RTG",current:preview.tokens,required:preview.cost.tokens,ready:tokenMissing===0})}
            </div>
            ${missing.length?`<p class="development-missing">${escape(missing.join(" · "))}</p>`:'<p class="development-ready-copy">Tutti i requisiti sono soddisfatti.</p>'}
            <div class="button-row">
              <button class="btn btn-ghost" data-rtg-change-development-player>CAMBIA GIOCATORE</button>
              <button class="btn btn-yellow" data-rtg-prepare-evolution ${preview.ready?"":"disabled"}>EVOLVI A ${escape(String(preview.target).toUpperCase())}</button>
            </div>
          </div>
        </div>
      </section>`;
    }

    function developmentMarkup({state={},players=[],filteredPlayers=[],selected=null,tab="players",query="",rarity="Tutti"}={}){
      const projectTotal=economy.PROJECT_RARITIES.reduce((sum,key)=>sum+Number(state.projects?.[key]||0),0);
      const rarityOptions=["Tutti",...economy.RARITIES].map((value)=>`<option value="${escape(value)}" ${value===rarity?"selected":""}>${value==="Tutti"?"Tutte":escape(value)}</option>`).join("");
      const playerBody=selected
        ? selectedMarkup(selected)
        : `<div class="development-filters">
            <label class="development-search-field"><span aria-hidden="true">⌕</span><input class="development-search" data-rtg-development-search value="${escape(query)}" placeholder="Cerca giocatore…" aria-label="Cerca giocatore per nome" autocomplete="off"></label>
            <label class="development-rarity-field"><span>RARITÀ</span><select data-rtg-development-rarity>${rarityOptions}</select></label>
          </div>
          <section class="album-player-grid development-player-grid development-squad-card-scope" data-rtg-development-results>${playerGrid(filteredPlayers.length||query||rarity!=="Tutti"?filteredPlayers:players)}</section>`;
      const projectsBody=`<section class="development-projects">
        <div class="development-section-heading"><div><p class="eyebrow">INVENTARIO RTG</p><h2>PROGETTI COMPLETI</h2></div><p>Disponibili esclusivamente per le evoluzioni Road to Glory.</p></div>
        <div class="project-inventory-grid">${projectInventoryMarkup(state)}</div>
        <button class="btn btn-yellow" data-rtg-open-shop>APRI NEGOZIO</button>
      </section>`;
      return `<main class="development-screen rtg-development-screen">
        <header class="topbar">
          <button type="button" class="btn btn-ghost development-back-button" data-rtg-economy-back aria-label="Torna a Road to Glory">←</button>
          <div><p class="eyebrow">ROAD TO GLORY · CRESCITA PERMANENTE</p><h1>CENTRO DI SVILUPPO</h1></div>
        </header>
        <section class="development-wallet">
          <span>${resourceIcon("tokens")}<span>GETTONI RTG <strong>${escape(Number(state.tokens)||0)}</strong></span></span>
          <span><span>PROGETTI <strong>${escape(projectTotal)}</strong></span></span>
        </section>
        <nav class="development-tabs">
          <button class="${tab==="players"?"active":""}" data-rtg-development-tab="players">GIOCATORI</button>
          <button class="${tab==="projects"?"active":""}" data-rtg-development-tab="projects">PROGETTI</button>
        </nav>
        <div class="rtg-development-note">Solo le carte RTG ottenute dalle squadre sbloccate possono essere evolute.</div>
        <div data-rtg-development-content>${tab==="projects"?projectsBody:playerBody}</div>
      </main>`;
    }

    function evolutionConfirmMarkup({player,after,preview}={}){
      const stats=Object.keys(after?.stats||{}).flatMap((stat)=>{
        const before=Number(player?.stats?.[stat]||0);
        const next=Number(after?.stats?.[stat]||0);
        const delta=next-before;
        return delta>0?[{stat,before,next,delta}]:[];
      });
      const labels={attack:"ATT",physical:"FIS",stamina:"RES",control:"TEC",defense:"DIF",speed:"VEL",grit:"GRI",save:"PAR"};
      const statsMarkup=stats.map((entry)=>`<li><strong>${escape(labels[entry.stat]||entry.stat.toUpperCase())}</strong><span>${escape(entry.before)} <b aria-hidden="true">→</b> ${escape(entry.next)}</span><em>+${escape(entry.delta)}</em></li>`).join("");
      const projectCost=preview.cost.projects?requirement({type:"project",rarity:preview.target,label:`Progetto ${preview.target}`,required:preview.cost.projects,compact:true}):"";
      return `<div class="development-detail development-confirm rtg-development-confirm">
        <p class="eyebrow">CONFERMA EVOLUZIONE RTG</p>
        <h2>${escape(player.name)}</h2>
        <div class="development-evolution-preview development-squad-card-scope">
          <div><small>ATTUALE · ${escape(preview.currentRarity)} · OVR ${escape(player.overall)}</small>${squadCard(player)}</div>
          <span class="development-evolution-arrow" aria-hidden="true">→</span>
          <div><small>NUOVA · ${escape(preview.target)} · OVR ${escape(after?.overall??preview.targetPotential)}</small>${squadCard(after||player)}</div>
        </div>
        <section class="development-stat-increases"><h3>AUMENTO STATISTICHE</h3><ul>${statsMarkup||"<li><span>Nessuna statistica cambia.</span></li>"}</ul></section>
        <h3 class="development-confirm-requirements-title">REQUISITI</h3>
        <div class="development-confirm-costs">
          ${projectCost}
          ${requirement({type:"tokens",label:"Gettoni RTG",required:preview.cost.tokens,compact:true})}
        </div>
        <div class="button-row">
          <button class="btn btn-ghost" data-rtg-cancel-evolution>ANNULLA</button>
          <button class="btn btn-yellow" data-rtg-confirm-evolution>CONFERMA EVOLUZIONE</button>
        </div>
      </div>`;
    }

    return Object.freeze({
      shopMarkup,
      developmentMarkup,
      evolutionConfirmMarkup,
      projectInventoryMarkup,
      playerGrid,
      squadCard,
      tokenIcon:rtgTokenIcon,
      rtgTokenIcon,
      playerPaginationMarkup,
      rarityClass,
    });
  }

  global.RoadToGloryEconomyView=Object.freeze({create});
})(globalThis);
