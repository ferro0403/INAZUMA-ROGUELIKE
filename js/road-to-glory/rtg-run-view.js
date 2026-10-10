(function (global) {
  "use strict";

  const RAMEN_STICKER_URL="https://dxi4wb638ujep.cloudfront.net/1/k/z/q/zqioogobuek.png";
  // Restored from the original RTG Album implementation. The Album collection
  // renderer still references this constant; its declaration was accidentally
  // dropped during the Season 2 view refactor, causing a ReferenceError on open.
  const RTG_ALBUM_COVER_URL="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiTljpQy0-8hZqy9NP7BmOZwijtzN9VGYbXEN4bR2bPW8GiaccWADFA3RAlYclPfO8HSr9aEgR8H_NWF-al-1MLXlH6ToD-mMNUKwTsaSKlKvUCEY1xzg_2auQvhA3usKf5qPwV8Iawi6pm/s1600/wallpapers_inazuma11_1_1024x768.jpg";
  const RTG_ALBUM_S2_COVER_URL="https://static.wikia.nocookie.net/inazuma-eleven/images/9/9b/%28Artwork%29_Aliea_Gakuen_captains.jpg/revision/latest?cb=20120722223451";

  function create(deps = {}) {
    const escape = deps.escapeHtml || ((value) => String(value ?? ""));
    const emblem = deps.teamEmblemMarkup || ((teamId) => `<span class="boss-logo-fallback boss-logo-fallback--visible">${escape(String(teamId || "?").slice(0,1).toUpperCase())}</span>`);
    const compactPlayerCardMarkup = deps.compactPlayerCardMarkup || null;
    const playerCardMarkup = deps.playerCardMarkup || null;
    const tokenIcon=()=>`<img class="rtg-token-icon" src="${RAMEN_STICKER_URL}" alt="" aria-hidden="true" draggable="false">`;
    const skinTokens=(markup)=>String(markup||"").replaceAll("◈",tokenIcon());
    function albumRarityClass(category){
      const rarity=String(category||"debole").trim().toLowerCase();
      return `rarity-${["scarso","debole","normale","buono","forte","elite","mondiale","leggenda","aurico"].includes(rarity)?rarity:"debole"}`;
    }


    function tabs(active = "run") {
      const icon = (name) => name === "run"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5 9 4l6 2.5 5-2.5v13.5l-5 2.5-6-2.5-5 2.5V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>'
        : name === "album"
          ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z"/><path d="M7.5 19.5A2.5 2.5 0 0 1 10 17h9M9 8h6M9 11h5"/></svg>'
          : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c.7-3.2 2.4-5 4.5-5s3.8 1.8 4.5 5M12.5 17.5c.7-2.2 1.9-3.4 3.5-3.4 1.8 0 3.2 1.4 4 4"/></svg>';
      return `<nav class="bottom-nav rtg-bottom-nav" aria-label="Road to Glory">
        <button type="button" data-rtg-tab="run" class="${active === "run" ? "active" : ""}" aria-current="${active === "run" ? "page" : "false"}"><span class="nav-icon">${icon("run")}</span><span class="nav-label">Run</span></button>
        <button type="button" data-rtg-tab="squad" class="${active === "squad" ? "active" : ""}" aria-current="${active === "squad" ? "page" : "false"}"><span class="nav-icon">${icon("squad")}</span><span class="nav-label">Squadra</span></button>
      </nav>`;
    }

    const seasonNumber=(seasonId)=>{const sid=String(seasonId||"ie1"),configured=global.RoadToGloryConfig?.season?.(sid)?.seasonNumber;if(configured!==undefined&&configured!==null&&String(configured)!=="")return configured;const match=sid.match(/_s(\d+)$/);return match?Number(match[1]):sid==="ie2"?"AR":sid==="orion"?"OR":1;};
    const seasonLabel=(seasonId)=>{const sid=String(seasonId||"ie1");return sid==="ie2"?"Ares":sid==="orion"?"Orion":`Season ${seasonNumber(sid)}`;};
    const seasonBadge=(seasonId)=>{const sid=String(seasonId||"ie1");return sid==="ie2"?"AR":sid==="orion"?"OR":`S${seasonNumber(sid)}`;};
    function header(state = {}) {
      return `<header class="topbar rtg-main-topbar"><button type="button" class="btn rtg-home-button" data-rtg-home aria-label="Torna alla Home"><span aria-hidden="true">←</span></button><div class="rtg-main-title"><p class="eyebrow">${escape(seasonLabel(state?.activeSeasonId))}</p><strong class="brand">Road to Glory</strong></div><div class="status-strip"><span class="status-pill rtg-token-pill">◈ ${escape(Number(state.tokens) || 0)}</span><span class="status-pill lives">♥ ${escape(Number(state.lives) || 0)} vite</span></div></header>`;
    }
    function lockedMarkup(access = {}) { const count=Math.max(0,Number(access.count)||0); return `<main class="screen rtg-run-screen rtg-locked">${header({tokens:0,lives:0})}<div class="content narrow rtg-locked-content"><section class="panel rtg-lock-card"><p class="eyebrow">Road to Glory</p><h1>La strada non è ancora aperta</h1><p class="muted">Sblocca almeno <strong>15 svincolati</strong> nelle run normali e assicurati di poter formare un undici valido con un portiere.</p><div class="progress-track rtg-lock-progress"><span class="progress-bar" style="width:${Math.min(100,Math.round(count/15*100))}%"></span></div><strong>${escape(count)}/15 svincolati</strong></section></div></main>`; }
    const routeView=global.RoadToGloryRouteView.create({escapeHtml:escape,teamEmblemMarkup:emblem,seasonNumber,header,tabs});
    const {runMarkup,teamRecord,teamName,teamLogoMarkup}=routeView;

    const albumView=global.RoadToGloryAlbumView.create({
      escapeHtml:escape,
      teamEmblemMarkup:emblem,
      playerCardMarkup,
      seasonNumber,
      albumRarityClass,
      albumCoverUrl:RTG_ALBUM_COVER_URL,
      albumSeason2CoverUrl:RTG_ALBUM_S2_COVER_URL,
    });
    const {albumCollectionMarkup,albumTeamsMarkup,albumRosterMarkup}=albumView;

    function requirementsMarkup(eligibility={}){if(!eligibility)return"";const seasonLabel=seasonBadge(eligibility.seasonId);const rows=[["Potenza rosa · max",eligibility.teamPower==null?"—":`${eligibility.teamPower} / ${eligibility.cap}`,!eligibility.reasons?.includes("team-power-cap")],[`Reclute ${seasonLabel} · min`,`${eligibility.recruitCount||0} / ${eligibility.minRecruit||0}`,!eligibility.reasons?.some(code=>code==="min-season-recruits"||code==="min-s1-recruits")],["Reclute recenti · min",`${eligibility.recentRecruitCount||0} / ${eligibility.recentCount||0}`,!eligibility.reasons?.some(code=>code==="recent-season-recruits"||code==="recent-s1-recruits")]];return `<section class="panel rtg-requirements"><p class="eyebrow">Accesso partita</p><h3>Requisiti</h3><div class="rtg-requirements-list">${rows.map(([label,value,ok])=>`<div class="rtg-requirement ${ok?"ok":"bad"}"><span><i aria-hidden="true">${ok?"✓":"!"}</i> ${escape(label)}</span><strong>${escape(value)}</strong></div>`).join("")}</div><p class="rtg-requirements-note">Reclute e potenza considerano tutti i 15 giocatori: titolari + panchina.</p></section>`;}
    function nodeModalMarkup({node,eligibility=null,seasonDb,allowed=true}={}){if(!node)return"";if(node.type==="main"){const label=teamName(seasonDb,node.teamId);return `<div class="rtg-node-modal rtg-paper-modal"><div class="modal-head rtg-node-modal-head"><span class="rtg-node-modal-emblem">${teamLogoMarkup(seasonDb,node.teamId)}</span><div><p class="eyebrow">Partita principale</p><h2>${escape(label)}</h2><p class="muted">Prepara la squadra e rispetta i requisiti della sfida. Vittoria: 350 Gettoni RTG.</p></div></div>${requirementsMarkup(eligibility)}<button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed||!eligibility?.eligible?"disabled":""}>GIOCA</button></div>`;}return `<div class="rtg-node-modal rtg-paper-modal"><div class="modal-head rtg-node-modal-head"><span class="rtg-node-modal-secondary" aria-hidden="true">?</span><div><p class="eyebrow">Svincolati</p><h2>Partita secondaria</h2><p class="muted">Avversari generati nella fascia di potenza del percorso. Vittoria: 200 Gettoni RTG.</p></div></div><button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed?"disabled":""}>GIOCA</button></div>`;}
    function vendingCapsulePalette(rarities=[]){
      const allowed=["normale","buono","forte","elite","mondiale","leggenda","aurico"];
      const available=[...new Set(Array.from(rarities||[]).map(entry=>pullRaritySlug(entry?.rarity)).filter(key=>allowed.includes(key)))];
      const palette=available.length?available:["normale","buono","forte","elite","mondiale"];
      const colors=Array.from({length:14},(_,index)=>index<palette.length?palette[index]:palette[Math.floor(Math.random()*palette.length)]);
      for(let i=colors.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[colors[i],colors[j]]=[colors[j],colors[i]];}
      // Keep the same cosmetic RNG draws; leave room for rolling and the hopper.
      for(let i=colors.length-1;colors.length>10;i--)if(colors.indexOf(colors[i])!==i)colors.splice(i,1);
      return colors;
    }
    function vendingMarkup(model={}){
      const rarities=model.rarities||[],candidates=model.candidates||[],mode=model.mode==="recruitment"?"recruitment":"team",cost=Number(model.cost)||300,canPull=Number(model.tokens)>=cost&&candidates.length>0;
      const capsuleColors=vendingCapsulePalette(rarities);
      const capsules=capsuleColors.map((rarity,index)=>`<div class="rtg-vending-capsule-v9 c${index+1}" data-capsule-rarity="${escape(rarity)}"></div>`).join("");
      const seasonNo=seasonNumber(model.seasonId);
      return `<div class="rtg-vending rtg-paper-modal"><div class="rtg-vending-title"><div><p class="eyebrow">RTG · ${escape(seasonBadge(model.seasonId))}</p><h2>${mode==="recruitment"?`SVINCOLATI ${seasonBadge(model.seasonId)}`:"Distributore"}</h2></div></div>${Number(global.RoadToGloryConfig?.season?.(model.seasonId)?.recruitmentPullCost)>0?`<div class="rtg-vending-mode-toggle" role="group" aria-label="Modalità distributore"><button type="button" data-rtg-vending-mode="team" class="${mode==="team"?"active":""}" aria-pressed="${mode==="team"}">TEAM MODE</button><button type="button" data-rtg-vending-mode="recruitment" class="${mode==="recruitment"?"active":""}" aria-pressed="${mode==="recruitment"}">SVINCOLATI ${escape(seasonBadge(model.seasonId))}</button></div>`:""}<div class="rtg-vending-stage"><div class="rtg-vending-machine-v9 rtg-vending-machine-v12" data-rtg-vending-machine aria-label="Distributore di palline ${escape(seasonLabel(model.seasonId))}"><div class="rtg-vending-head-v9" aria-hidden="true"><span>CAPSULE STATION</span><strong>INAZUMA RTG</strong></div><div class="rtg-vending-window-v9" aria-hidden="true">${capsules}<span class="rtg-vending-funnel-v10"></span><span class="rtg-vending-window-glare-v9"></span></div><div class="rtg-vending-body-v9"><div class="rtg-vending-info-v9"><small>1 CAPSULA</small><strong>${cost}</strong></div><div class="rtg-vending-crank-v9" aria-hidden="true"><span></span></div><div class="rtg-vending-chute-v9" aria-hidden="true"><span class="rtg-vending-chute-well-v9"></span><span class="rtg-vending-chute-flap-v10"></span><div class="rtg-vending-prize-track-v9"><span class="rtg-vending-prize-v9"></span></div></div><div class="rtg-vending-brand-v9" aria-hidden="true">RTG</div></div></div><button type="button" class="btn btn-yellow rtg-vending-pull" data-rtg-pull ${canPull?"":"disabled"}>${canPull?`GIRA · ${cost} ◈`:candidates.length?`MANCANO ${escape(Math.max(0,cost-(Number(model.tokens)||0)))} ◈`:"VINCI UNA SFIDA PER SBLOCCARE GIOCATORI"}</button><div class="rtg-vending-wallet-chip"><span>GETTONI</span><strong>${escape(Number(model.tokens)||0)} ◈</strong></div></div><div class="rtg-vending-ratebar" aria-label="Probabilità">${rarities.map((entry)=>`<span data-rarity="${escape(entry.rarity)}"><b>${escape(entry.rarity)}</b><em>${escape(Number(entry.weight).toFixed(1))}%</em></span>`).join("")}</div><button type="button" class="btn rtg-vending-album-link" data-rtg-vending-album data-rtg-destination="album">ALBUM RTG</button></div>`;
    }
        function pullRaritySlug(value){
      const key=String(value||"Normale").trim().toLowerCase();
      return ["scarso","debole","normale","buono","forte","elite","mondiale","leggenda","aurico"].includes(key)?key:"normale";
    }

    function pullResultMarkup(result={},player={},seasonDb=null){
      const rarity=String(result.rarity||player.category||"Normale").trim()||"Normale";
      const rarityKey=pullRaritySlug(rarity);
      const duplicate=!!result.duplicate;
      const playerName=player.name||result.playerId||"Giocatore";
      const playerRole=String(player.normalizedRole||player.position||player.role||"—").toUpperCase();
      // Resolve the exact team represented by this card/profile. Profile-aware
      // Seasons (S2+) can keep historical teamIds on the canonical player, so
      // player.teamIds[0] is not necessarily the team of the pulled version.
      const teamCandidates=[
        player.resolvedTeamId,
        player.teamId,
        ...(player.teamIds||[]),
      ].map((value)=>String(value||"")).filter(Boolean);
      let pullTeam=teamCandidates.map((candidate)=>teamRecord(seasonDb,candidate)).find(Boolean)||null;
      if(!pullTeam&&player.teamName){
        pullTeam=(seasonDb?.teams||[]).find((entry)=>String(entry.teamName||entry.name||"")===String(player.teamName))||null;
      }
      const teamId=String(pullTeam?.teamId||pullTeam?.id||player.resolvedTeamId||(seasonDb?.requiresProfileAwareRuntime?player.teamId:(player.teamIds?.[0]||player.teamId))||"");
      const teamLabel=String(player.teamName||pullTeam?.teamName||pullTeam?.name||player.teams?.[0]||"Squadra");
      const card=compactPlayerCardMarkup
        ? compactPlayerCardMarkup(player,{
            level:20,
            overall:player?.overall??player?.finalOverall,
            dataAttr:`data-rtg-pull-player-detail="${escape(result.cardId||player?.cardId||player?.playerId||player?.id||result.playerId||"")}" aria-label="Apri scheda di ${escape(playerName)}"`,
            extraClass:"squad-player-card rtg-picker-squad-card rtg-pull-player-card",
            trailingMarkup:(()=>{
              const identity=global.RoadToGloryCardIdentity;
              const meta=identity?.parse?.(result.cardId||player?.cardId||{playerId:result.playerId||player?.playerId,legacySeasonId:result.legacySeasonId||player?.legacySeasonId});
              if(meta?.sourceKind!=="season")return "";
              const label=identity?.legacyLabel?.(meta.legacySeasonId)||"";
              return label?`<span class="rtg-legacy-badge rtg-legacy-tab" data-legacy-season="${escape(label)}" title="Legacy ${escape(label)}">${escape(label)}</span>`:"";
            })(),
          })
        : `<div class="rtg-pull-player-fallback"><strong>${escape(playerName)}</strong><span>Lv 20</span></div>`;
      const revealLabel=duplicate?"DUPLICATO":"NUOVO GIOCATORE";
      return `<div class="rtg-pull-result rtg-paper-modal development-squad-card-scope rtg-pull-result--${rarityKey} ${duplicate?"is-duplicate":"is-new"}" data-rtg-pull-rarity="${escape(rarityKey)}">
        <div class="rtg-pull-result-head">
          <span class="rtg-pull-rarity"><i aria-hidden="true"></i>${escape(rarity)}</span>
          <span class="rtg-pull-series">ROAD TO GLORY · LEGACY ${escape(global.RoadToGloryCardIdentity?.legacyLabel?.(result.legacySeasonId||player?.legacySeasonId)||"S1")}</span>
        </div>
        <div class="rtg-pull-reveal-label"><span>${escape(revealLabel)}</span></div>
        <div class="rtg-pull-result-body">
          <div class="rtg-pull-card-stage rtg-picker-grid" aria-label="Carta giocatore sbloccata">
            ${card}
          </div>
          <div class="rtg-pull-result-copy">
            <h2>${escape(playerName)}</h2>
            <div class="rtg-pull-player-identity">
              <span class="rtg-pull-team">
                <span class="rtg-pull-team-logo" aria-hidden="true">${player.teamLogoUrl?`<img src="${escape(player.teamLogoUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:(teamId?teamLogoMarkup(seasonDb,teamId):"")}</span>
                <strong>${escape(teamLabel)}</strong>
              </span>
              <span class="rtg-pull-role">${escape(playerRole)}</span>
            </div>
            <div class="rtg-pull-meta">
              <span>LV 20</span>
              <span>${escape(rarity)}</span>
            </div>
          </div>
        </div>
        <div class="rtg-pull-balance">
          <span>SALDO RTG</span>
          <strong>${escape(result.balanceAfter)} ◈</strong>
        </div>
        <button type="button" class="btn btn-yellow rtg-pull-continue" data-rtg-pull-continue>CONTINUA</button>
      </div>`;
    }

    function campaignSelectorMarkup(){
      const orionCover="https://i0.wp.com/nicolaraccasceneggiature.altervista.org/wp-content/uploads/2019/05/Dlhck3sVAAA2Lgd-1.jpg?fit=1200%2C896&ssl=1";
      const trilogyCover=global.RoadToGloryConfig?.SEASON3?.albumCover||"assets/rtg/rtg-season3-route-map-user.webp";
      return `<main class="screen rtg-campaign-select"><header class="topbar rtg-main-topbar"><button type="button" class="btn rtg-home-button" data-rtg-campaign-home aria-label="Torna alla Home"><span aria-hidden="true">←</span></button><div class="rtg-main-title"><p class="eyebrow">Road to Glory</p><strong class="brand">Scegli l'avventura</strong></div></header><div class="content narrow rtg-campaign-select-content"><section class="rtg-campaign-intro"><p class="eyebrow">DUE STORIE · DUE RUN</p><h1>ROAD TO GLORY</h1><p>Le campagne avanzano separatamente. Giocatori ottenuti e Gettoni RTG sono condivisi.</p></section><div class="rtg-campaign-grid"><button type="button" class="rtg-campaign-card" data-rtg-campaign="rtg-ie-trilogy"><img class="rtg-campaign-card__image" src="${escape(trilogyCover)}" alt=""><span class="rtg-campaign-shade"></span><span class="rtg-campaign-copy"><small>ROAD TO GLORY</small><strong>Inazuma Eleven 1-2-3</strong><em><b>S1</b><b>S2</b><b>S3</b></em><i>APRI RUN »</i></span></button><button type="button" class="rtg-campaign-card" data-rtg-campaign="rtg-ares-orion"><img class="rtg-campaign-card__image" src="${escape(orionCover)}" alt=""><span class="rtg-campaign-shade"></span><span class="rtg-campaign-copy"><small>ROAD TO GLORY</small><strong>Inazuma Eleven Ares-Orion</strong><em><b>AR</b><b>OR</b></em><i>APRI RUN »</i></span></button></div></div></main>`;
    }

    return Object.freeze({ campaignSelectorMarkup,tabs,lockedMarkup:(...args)=>skinTokens(lockedMarkup(...args)),runMarkup:(...args)=>skinTokens(runMarkup(...args)),albumCollectionMarkup:(...args)=>skinTokens(albumCollectionMarkup(...args)),albumTeamsMarkup:(...args)=>skinTokens(albumTeamsMarkup(...args)),albumRosterMarkup:(...args)=>skinTokens(albumRosterMarkup(...args)),requirementsMarkup,nodeModalMarkup,vendingMarkup:(...args)=>skinTokens(vendingMarkup(...args)),pullResultMarkup:(...args)=>skinTokens(pullResultMarkup(...args))});
  }
  global.RoadToGloryRunView=Object.freeze({create});
})(globalThis);
