(function (global) {
  "use strict";

  function create(deps = {}) {
    const escape=deps.escapeHtml;
    const emblem=deps.teamEmblemMarkup;
    const playerCardMarkup=deps.playerCardMarkup||null;
    const seasonNumber=deps.seasonNumber;
    const albumRarityClass=deps.albumRarityClass;
    const RTG_ALBUM_COVER_URL=deps.albumCoverUrl;
    const RTG_ALBUM_S2_COVER_URL=deps.albumSeason2CoverUrl;
    function albumTeamLogoMarkup(team={}){
      if(team?.logoUrl)return `<img src="${escape(team.logoUrl)}" alt="${escape(team.teamName||team.name||"Squadra")}" loading="lazy" decoding="async">`;
      return team?.teamId ? emblem(team.teamId) : '<span class="album-free-agent-logo" aria-hidden="true">⚡</span>';
    }
    function albumCollectionMarkup({state={},unlocked=0,total=0,collections=null}={}){
      const fallbackSeasonId=String(state?.activeSeasonId||"ie1");
      const source=Array.isArray(collections)&&collections.length
        ? collections
        : [{seasonId:fallbackSeasonId,unlocked,total}];
      const cards=source.map((collection)=>{
        const sid=String(collection?.seasonId||"ie1");
        const seasonNo=seasonNumber(sid);
        const seasonTitle=sid==="ie2"?"Inazuma Eleven Ares":sid==="orion"?"Inazuma Eleven Orion":`Inazuma Eleven ${seasonNo}`;
        const safeTotal=Math.max(0,Number(collection?.total)||0),safeUnlocked=Math.max(0,Number(collection?.unlocked)||0);
        const percent=safeTotal?Math.round(safeUnlocked/safeTotal*100):0;
        const countCopy=collection?.pending?"Caricamento dati…":collection?.error?"Dati non disponibili":`${safeUnlocked} / ${safeTotal} giocatori sbloccati`;
        const percentCopy=collection?.pending?"…":collection?.error?"—":`${percent}%`;
        const presentation=global.RoadToGloryConfig?.season?.(sid)||{};
        const coverUrl=presentation.albumCover||(sid==="ie1_s2"?RTG_ALBUM_S2_COVER_URL:RTG_ALBUM_COVER_URL);
        const focalPoint=presentation.albumCoverPosition||(sid==="ie1_s2"?"center 42%":"center");
        const cover=`<span class="album-collection-cover album-collection-cover--hero"><img src="${escape(coverUrl)}" alt="" style="object-position:${escape(focalPoint)}" loading="lazy" decoding="async" onerror="this.hidden=true; this.parentElement.classList.add('is-fallback');"></span>`;
        return `<button type="button" class="panel album-collection-card" data-rtg-album-collection="${escape(sid)}" aria-label="Apri collezione ${escape(seasonTitle)}: ${escape(countCopy)}, ${escape(percentCopy)}">${cover}<span class="album-collection-content album-collection-content--hero"><span class="album-collection-title">${escape(seasonTitle)}</span><span class="album-collection-progress-copy"><span>${escape(countCopy)}</span><strong>${escape(percentCopy)}</strong></span><span class="album-collection-progress-bar" aria-hidden="true"><span style="width:${percent}%"></span></span><span class="album-collection-action">Apri collezione <span aria-hidden="true">→</span></span></span></button>`;
      }).join("");
      return `<main class="album-screen album-collections-screen rtg-album-collections-screen"><header class="topbar album-topbar album-collections-topbar"><button type="button" class="btn section-root-button album-collections-home-button" data-rtg-home aria-label="Torna a Road to Glory"><span aria-hidden="true">←</span></button><div class="album-collections-heading"><p class="eyebrow">ALBUM</p><h1>COLLEZIONI</h1></div><span class="album-collections-topbar-spacer" aria-hidden="true"></span></header><section class="album-collection-grid">${cards}</section></main>`;
    }
    function albumTeamsMarkup({state={},seasonId=null,teams=[]}={}){
      const sid=String(seasonId||state?.activeSeasonId||"ie1");
      const cards=Array.from(teams||[]).map(team=>{
        const total=Number(team.total)||0,unlocked=Number(team.unlocked)||0;
        const percent=total?Math.round(unlocked/total*100):0;
        const complete=total>0&&unlocked===total;
        const logo=albumTeamLogoMarkup(team);
        return `<button type="button" class="panel album-team-card album-team-card--modern ${complete?"album-complete":""}" data-rtg-album-team="${escape(team.teamId)}" aria-label="${escape(team.teamName)}: ${escape(unlocked)} su ${escape(total)} giocatori sbloccati, ${escape(percent)}%"><span class="album-team-card__stage"><span class="album-team-card__watermark" aria-hidden="true">${logo}</span><span class="album-team-logo album-team-card__logo">${logo}</span></span><span class="album-team-card__footer"><span class="album-team-card__heading"><strong class="album-team-card__name">${escape(team.teamName)}</strong><span class="album-team-card__open" aria-hidden="true">→</span></span><span class="album-team-card__progress"><span>${escape(unlocked)} / ${escape(total)} sbloccati</span>${complete?'<b class="album-team-card__complete-state"><span class="album-team-card__complete-check" aria-hidden="true">✓</span>COMPLETA</b>':`<b>${escape(percent)}%</b>`}</span><span class="album-team-card__bar" aria-hidden="true"><span style="width:${percent}%"></span></span></span></button>`;
      }).join("");
      return `<main class="album-screen album-teams-screen rtg-album-teams-screen"><header class="topbar album-topbar album-teams-topbar"><button type="button" class="btn section-root-button album-teams-back-button" data-rtg-album-collection-back aria-label="Torna alle collezioni"><span aria-hidden="true">←</span></button><div class="album-teams-heading"><p class="eyebrow">ALBUM → ${escape(sid==="ie2"?"INAZUMA ELEVEN ARES":sid==="orion"?"INAZUMA ELEVEN ORION":`INAZUMA ELEVEN ${seasonNumber(sid)}`)}</p><h1>SQUADRE</h1></div><span class="album-teams-topbar-spacer" aria-hidden="true"></span></header><section class="album-team-grid album-team-grid--modern">${cards}</section></main>`;
    }
    function albumRosterMarkup({team={},entries=[],allEntries=[],database=null}={}){
      const unlockedIds=new Set(Array.from(entries||[]).map(player=>String(player?.cardId||player?.playerId||player?.id||"")));
      const catalog=Array.from(allEntries||[]);
      const cards=catalog.map(player=>{
        const cardId=String(player?.cardId||player?.playerId||player?.id||"");
        const isUnlocked=unlockedIds.has(cardId);
        const role=String(player?.normalizedRole||player?.position||player?.role||"").toUpperCase();
        const fallbackCard=`<button type="button" class="player-card player-card-large pull-player-card pull-player-card--desktop pull-player-card--mobile album-player-card ${albumRarityClass(player?.category)}" data-rtg-album-player-card aria-label="Apri scheda di ${escape(player?.name||cardId)}"><span class="player-corner player-role" aria-label="Ruolo ${escape(role)}">${escape(role)}</span><span class="player-corner player-overall" aria-label="Overall ${escape(player?.overall??player?.finalOverall??"—")}">${escape(player?.overall??player?.finalOverall??"—")}</span><div class="player-portrait-wrap">${player?.portraitUrl||player?.frontFullbodyUrl||player?.imageUrl?`<img class="player-portrait" src="${escape(player?.portraitUrl||player?.frontFullbodyUrl||player?.imageUrl)}" alt="${escape(player?.name||cardId)}" loading="lazy">`:""}</div><div class="player-info"><div class="player-title"><strong>${escape(player?.name||cardId)}</strong></div><div class="player-meta" aria-label="Dettagli giocatore"><span>${escape(player?.element||player?.type||"")}</span><span>${escape(player?.category||"")}</span></div></div><span class="player-corner player-level" aria-label="Livello 20">Lv 20</span></button>`;
        const card=playerCardMarkup
          ? playerCardMarkup(player,{button:true,dataAttribute:"data-rtg-album-player-card",level:20,database,resolvedPlayer:player,extraClass:"album-player-card"})
          : fallbackCard;
        return `<div class="album-player-entry ${albumRarityClass(player?.category)} ${isUnlocked?"is-unlocked":"is-locked"}" data-rtg-album-player-entry="${escape(cardId)}" data-album-unlocked="${isUnlocked?"true":"false"}">${card}${isUnlocked?"":'<span class="album-player-lock"><span aria-hidden="true">🔒</span>NON SBLOCCATO</span>'}</div>`;
      }).join("");
      const total=catalog.length,unlocked=catalog.filter(player=>unlockedIds.has(String(player?.cardId||player?.playerId||player?.id||""))).length,percent=total?Math.round(unlocked/total*100):0;
      const logo=albumTeamLogoMarkup(team);
      return `<main class="album-screen album-roster-screen album-roster-screen--modern rtg-album-roster-screen"><header class="album-roster-hero"><div class="album-roster-hero__nav"><button type="button" class="btn section-root-button album-roster-back-button" data-rtg-album-back aria-label="Torna alle squadre"><span aria-hidden="true">←</span></button></div><div class="album-roster-hero__identity"><span class="album-team-logo album-roster-hero__logo">${logo}</span><h1 class="album-roster-hero__name">${escape(team.teamName||"Squadra")}</h1></div><div class="album-roster-hero__stats"><span>${escape(unlocked)} / ${escape(total)} giocatori sbloccati</span><strong class="album-roster-percent">${escape(percent)}%</strong></div><span class="album-roster-hero__bar" aria-hidden="true"><span style="width:${percent}%"></span></span></header><section class="album-player-grid album-player-grid--modern" data-rtg-album-roster>${cards}</section></main>`;
    }

    return Object.freeze({albumCollectionMarkup,albumTeamsMarkup,albumRosterMarkup});
  }

  global.RoadToGloryAlbumView=Object.freeze({create});
})(globalThis);
