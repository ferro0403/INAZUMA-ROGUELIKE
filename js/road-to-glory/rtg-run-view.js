(function (global) {
  "use strict";

  const MAIN_TEAMS = Object.freeze(["occult","wild","brainwashing","otaku","shuriken","farm","kirkwood","royal","zeus","raimon"]);
  const BLOCKS = Object.freeze([
    Object.freeze({ index:0, start:0, end:2, label:"Primi passi", eyebrow:"Capitolo 1" }),
    Object.freeze({ index:1, start:3, end:5, label:"La sfida cresce", eyebrow:"Capitolo 2" }),
    Object.freeze({ index:2, start:6, end:8, label:"Verso l'élite", eyebrow:"Capitolo 3" }),
    Object.freeze({ index:3, start:9, end:9, label:"Finale", eyebrow:"Capitolo 4" }),
  ]);
  const S2_BLOCKS = Object.freeze([
    Object.freeze({ index:0, start:0,  end:5,  label:"Primo contatto",       eyebrow:"Capitolo 1", height:640, bg:"center 10%" }),
    Object.freeze({ index:1, start:6,  end:9,  label:"Controffensiva",       eyebrow:"Capitolo 2", height:500, bg:"center 24%" }),
    Object.freeze({ index:2, start:10, end:15, label:"La minaccia cresce",   eyebrow:"Capitolo 3", height:640, bg:"center 40%" }),
    Object.freeze({ index:3, start:16, end:21, label:"Fuoco e ghiaccio",     eyebrow:"Capitolo 4", height:640, bg:"center 56%" }),
    Object.freeze({ index:4, start:22, end:25, label:"Verso il Genesis",     eyebrow:"Capitolo 5", height:500, bg:"center 70%" }),
    Object.freeze({ index:5, start:26, end:29, label:"L'ultima resistenza",  eyebrow:"Capitolo 6", height:500, bg:"center 84%" }),
    Object.freeze({ index:6, start:30, end:32, label:"Finale",               eyebrow:"Capitolo 7", height:430, bg:"center bottom" }),
  ]);
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
    function albumTeamLogoMarkup(team={}){
      if(team?.logoUrl)return `<img src="${escape(team.logoUrl)}" alt="${escape(team.teamName||team.name||"Squadra")}" loading="lazy" decoding="async">`;
      return team?.teamId ? emblem(team.teamId) : '<span class="album-free-agent-logo" aria-hidden="true">⚡</span>';
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

    function header(state = {}) {
      return `<header class="topbar rtg-main-topbar"><button type="button" class="btn rtg-home-button" data-rtg-home aria-label="Torna alla Home"><span aria-hidden="true">←</span></button><div class="rtg-main-title"><p class="eyebrow">Season ${String(state?.activeSeasonId||"ie1")==="ie1_s2"?"2":"1"}</p><strong class="brand">Road to Glory</strong></div><div class="status-strip"><span class="status-pill rtg-token-pill">◈ ${escape(Number(state.tokens) || 0)}</span><span class="status-pill lives">♥ ${escape(Number(state.lives) || 0)} vite</span></div></header>`;
    }
    function lockedMarkup(access = {}) { const count=Math.max(0,Number(access.count)||0); return `<main class="screen rtg-run-screen rtg-locked">${header({tokens:0,lives:0})}<div class="content narrow rtg-locked-content"><section class="panel rtg-lock-card"><p class="eyebrow">Road to Glory</p><h1>La strada non è ancora aperta</h1><p class="muted">Sblocca almeno <strong>15 svincolati</strong> nelle run normali e assicurati di poter formare un undici valido con un portiere.</p><div class="progress-track rtg-lock-progress"><span class="progress-bar" style="width:${Math.min(100,Math.round(count/15*100))}%"></span></div><strong>${escape(count)}/15 svincolati</strong></section></div></main>`; }
    function nodeState(state,node,index){if(state?.seasonComplete)return"completed";if(node.id===state?.currentNodeId)return"reachable";const currentIndex=Math.max(0,Number(state?.currentNodeIndex??-1));if(index<currentIndex)return"completed";const clearedSecondary=Number(state?.attemptsByNode?.[node.id]?.clears||0)>0;const defeatedMain=node.type==="main"&&(state?.defeatedTeamIds||[]).includes(node.teamId);if(clearedSecondary||defeatedMain)return"completed";return"locked";}
    function teamRecord(seasonDb,teamId){
      const key=String(teamId||"");
      return (seasonDb?.teams||[]).find((entry)=>String(entry.teamId||entry.id)===key)
        || (seasonDb?.bossOrder||[]).find((entry)=>String(entry.teamId||entry.id)===key)
        || (seasonDb?.specialMatches||[]).find((entry)=>String(entry.teamId||entry.id)===key)
        || null;
    }
    function teamName(seasonDb,teamId){const team=teamRecord(seasonDb,teamId);return team?.name||team?.teamName||String(teamId||"Squadra");}
    function teamLogoMarkup(seasonDb,teamId){
      const team=teamRecord(seasonDb,teamId);
      if(team?.logoUrl)return `<img src="${escape(team.logoUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
      return emblem(teamId);
    }
    function blockForNode(node){if(node.type==="main")return BLOCKS.find((block)=>node.mainIndex>=block.start&&node.mainIndex<=block.end)||BLOCKS[0];const nextIndex=MAIN_TEAMS.indexOf(node.beforeTeamId);return BLOCKS.find((block)=>nextIndex>=block.start&&nextIndex<=block.end)||BLOCKS[0];}
    const ROUTE_PRESETS=Object.freeze([
      Object.freeze([{x:29,y:9},{x:30,y:26},{x:48,y:39},{x:27,y:58},{x:47,y:69},{x:43,y:81},{x:66,y:91}]),
      Object.freeze([{x:64,y:8},{x:75,y:18},{x:71,y:29},{x:61,y:39},{x:68,y:49},{x:58,y:59},{x:47,y:69},{x:26,y:80},{x:65,y:91}]),
      Object.freeze([{x:31,y:8},{x:48,y:18},{x:70,y:30},{x:61,y:40},{x:50,y:50},{x:28,y:60},{x:39,y:70},{x:57,y:80},{x:66,y:91}]),
      Object.freeze([{x:28,y:18},{x:48,y:48},{x:66,y:84}]),
    ]);
    function positions(blockIndex,count){
      const preset=ROUTE_PRESETS[blockIndex];
      if(preset&&preset.length===count)return preset.map((point)=>({x:point.x,y:point.y}));
      if(count<=1)return[{x:50,y:50}];
      const xs=[50,28,67,35,72,31,64,46,70,34];
      return Array.from({length:count},(_,index)=>({x:xs[index%xs.length],y:10+index*(80/Math.max(1,count-1))}));
    }
    function pathSvg(points){
      if(points.length<2)return'<svg class="map-lines rtg-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';
      const d=points.slice(1).reduce((path,next,index)=>{
        const current=points[index],dy=next.y-current.y;
        const c1y=current.y+dy*.42,c2y=next.y-dy*.42;
        return `${path} C ${current.x} ${c1y.toFixed(2)}, ${next.x} ${c2y.toFixed(2)}, ${next.x} ${next.y}`;
      },`M ${points[0].x} ${points[0].y}`);
      return `<svg class="map-lines rtg-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="rtg-route-line-shadow" d="${d}" /><path class="rtg-route-line" d="${d}" /></svg>`;
    }
    function mainNodeMarkup(state,node,index,seasonDb,point){const status=nodeState(state,node,index),disabled=status==="locked"?" disabled":"",label=teamName(seasonDb,node.teamId);return `<button type="button" class="map-node rtg-route-node rtg-route-node--main ${status}" style="left:${point.x}%;top:${point.y}%" data-rtg-node-id="${escape(node.id)}" data-rtg-state="${status}" aria-label="${escape(label)} · ${status==="reachable"?"Prossima partita":status==="completed"?"Completata":"Da sbloccare"}"${status==="reachable"?' aria-current="step"':""}${disabled}><span class="node-icon rtg-main-node-icon">${teamLogoMarkup(seasonDb,node.teamId)}</span><span class="node-label">${escape(label)}</span><span class="rtg-node-status">${status==="reachable"?"GIOCA":status==="completed"?"COMPLETATA":"DA SBLOCCARE"}</span>${node.checkpointAfter?`<span class="rtg-node-checkpoint" data-rtg-checkpoint="${escape(node.teamId)}">⚑</span>`:""}</button>`;}
    function secondaryNodeMarkup(state,node,index,point){const status=nodeState(state,node,index),farmable=Number(state?.attemptsByNode?.[node.id]?.clears||0)>0,disabled=status==="locked"?" disabled":"";return `<button type="button" class="map-node rtg-route-node rtg-route-node--secondary ${status}" style="left:${point.x}%;top:${point.y}%" data-rtg-node-id="${escape(node.id)}" data-rtg-state="${status}" data-rtg-farmable="${farmable?"true":"false"}"${disabled}><span class="node-icon rtg-free-agent-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 3 34 9v12c0 8-14 16-14 16S6 29 6 21V9Z" fill="currentColor"/><path d="m20 12 7 5-3 8h-8l-3-8Z" fill="#fff"/></svg></span><span class="node-label">Svincolati</span><span class="rtg-node-status">${status==="reachable"?"GIOCA":farmable?"RIGIOCA":status==="completed"?"COMPLETATA":"DA SBLOCCARE"}</span></button>`;}
    function blockMarkup(block,entries,state,seasonDb){const points=positions(block.index,entries.length);return `<section class="rtg-map-block rtg-map-block--${block.index+1}" data-rtg-map-block="${block.index+1}"><div class="section-head rtg-route-heading"><div><p class="eyebrow">${escape(block.eyebrow)}</p><h2>${escape(block.label)}</h2></div><span class="rtg-route-count">${entries.length} tappe</span></div><div class="route-map rtg-route-stage" style="--rtg-route-height:${Math.max(260,entries.length*100)}px">${pathSvg(points)}${entries.map(({node,index},localIndex)=>node.type==="main"?mainNodeMarkup(state,node,index,seasonDb,points[localIndex]):secondaryNodeMarkup(state,node,index,points[localIndex])).join("")}</div></section>`;}
    function season2Positions(blockIndex,count){
      const left=blockIndex%2===0;
      const six=left
        ? [{x:31,y:9},{x:64,y:24},{x:42,y:41},{x:70,y:58},{x:35,y:75},{x:62,y:91}]
        : [{x:67,y:9},{x:36,y:24},{x:62,y:41},{x:31,y:58},{x:66,y:75},{x:39,y:91}];
      const four=left
        ? [{x:31,y:14},{x:68,y:38},{x:37,y:63},{x:65,y:86}]
        : [{x:67,y:14},{x:34,y:38},{x:64,y:63},{x:37,y:86}];
      const three=left
        ? [{x:31,y:18},{x:58,y:50},{x:68,y:82}]
        : [{x:67,y:18},{x:40,y:50},{x:31,y:82}];
      const preset=count===6?six:count===4?four:count===3?three:null;
      return preset||positions(blockIndex,count);
    }
    function season2MapMarkup(list,state,seasonDb){
      const indexed=list.map((node,index)=>({node,index}));
      return S2_BLOCKS.map((block)=>{
        const entries=indexed.filter(({index})=>index>=block.start&&index<=block.end);
        const points=season2Positions(block.index,entries.length);
        return `<section class="rtg-map-block rtg-map-block--season2-part rtg-map-block--season2-${block.index+1}" data-rtg-map-block="season2-${block.index+1}"><div class="section-head rtg-route-heading"><div><p class="eyebrow">${escape(block.eyebrow)}</p><h2>${escape(block.label)}</h2></div><span class="rtg-route-count">${entries.length} tappe</span></div><div class="route-map rtg-route-stage rtg-route-stage--season2" style="--rtg-route-height:${block.height}px;--rtg-route-bg-position:${escape(block.bg)}">${pathSvg(points)}${entries.map(({node,index},localIndex)=>node.type==="main"?mainNodeMarkup(state,node,index,seasonDb,points[localIndex]):secondaryNodeMarkup(state,node,index,points[localIndex])).join("")}</div></section>`;
      }).join("");
    }
    function runMarkup({state,nodes,seasonDb,seasonConfig=null}={}){
      const list=Array.from(nodes||[]),sid=String(state?.activeSeasonId||"ie1"),seasonNo=sid==="ie1_s2"?2:1;
      const currentIndex=list.findIndex((node)=>node.id===state?.currentNodeId),viewState={...(state||{}),currentNodeIndex:currentIndex};
      const blocks=sid==="ie1_s2"?season2MapMarkup(list,viewState,seasonDb):BLOCKS.map((block)=>{const entries=list.map((node,index)=>({node,index})).filter((entry)=>blockForNode(entry.node).index===block.index);return blockMarkup(block,entries,viewState,seasonDb);}).join("");
      const currentNode=list[currentIndex],currentLabel=currentNode?.type==="main"?teamName(seasonDb,currentNode.teamId):"Svincolati",complete=!!state?.seasonComplete,cleared=complete?list.length:Math.max(0,currentIndex);
      const currentMark=currentNode?.type==="main"?teamLogoMarkup(seasonDb,currentNode.teamId):`<span class="rtg-journey-free-agent" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 3 34 9v12c0 8-14 16-14 16S6 29 6 21V9Z" fill="currentColor"/><path d="m20 12 7 5-3 8h-8l-3-8Z" fill="#fff"/></svg></span>`;
      const transition=complete&&sid==="ie1"?`<button type="button" class="btn btn-yellow rtg-season-transition" data-rtg-enter-season2>ENTRA NELLA SEASON 2 <span aria-hidden="true">→</span></button>`:"";
      const routeStyle=seasonConfig?.routeBackground?` style="--rtg-season-route-bg:url('${escape(seasonConfig.routeBackground)}')"`:"";
      return `<main class="screen rtg-run-screen${seasonNo===2?" rtg-run-screen--s2":""}${complete?" rtg-run-screen--complete":""}"${routeStyle}>${header(state)}<div class="content narrow rtg-run-content"><section class="rtg-journey-summary ${complete?"rtg-journey-summary--complete":""}" aria-label="Avanzamento percorso"><div class="rtg-journey-main"><div class="rtg-journey-copy">${complete?`<div class="rtg-complete-kicker"><span class="rtg-complete-check" aria-hidden="true">✓</span><span>Season ${seasonNo} completata</span></div>`:`<p class="eyebrow">La tua prossima partita</p>`}<h1>${complete?"Traguardo raggiunto":escape(currentLabel)}</h1><p>${complete?`Percorso concluso · ${list.length} tappe completate`:`Tappa ${Math.max(1,currentIndex+1)} di ${list.length} · ${currentNode?.type==="main"?(currentNode.special?"Partita speciale":"Sfida principale"):"Partita Svincolati"}`}</p></div>${complete?`<div class="rtg-complete-trophy" aria-hidden="true"><span>★</span><b>S${seasonNo}</b></div>`:`<div class="rtg-journey-opponent" aria-hidden="true">${currentMark}</div>`}</div>${!complete&&currentNode?`<button type="button" class="btn btn-yellow" data-rtg-current-node="${escape(currentNode.id)}">Prepara partita <span aria-hidden="true">→</span></button>`:""}${transition}<div class="rtg-journey-progress" role="progressbar" aria-label="Tappe completate nel percorso attuale" aria-valuenow="${cleared}" aria-valuemin="0" aria-valuemax="${list.length}"><span style="width:${list.length?cleared/list.length*100:0}%"></span></div></section><section class="panel rtg-run-command"><div><p class="eyebrow">La tua collezione</p><h2>Rinforza la squadra</h2><p class="muted">Nuovi giocatori dalle squadre sconfitte.</p></div><button type="button" class="btn btn-yellow rtg-vending-button" data-rtg-open-vending>Distributore S${seasonNo} <span>300 ◈</span></button></section><section class="rtg-map rtg-map--season-${seasonNo}" aria-label="Percorso Season ${seasonNo}">${blocks}</section>${complete&&sid==="ie1"?`<section class="rtg-season-complete-footer" aria-label="Continua nella Season 2"><div class="rtg-season-complete-footer__head"><div class="rtg-season-complete-footer__badge" aria-hidden="true"><small>PROSSIMA</small><b>S2</b></div><div class="rtg-season-complete-footer__copy"><p class="eyebrow">SEASON 1 COMPLETATA</p><strong>Continua il viaggio</strong><span>La Season 2 riparte dalla tua squadra attuale.</span></div></div><button type="button" class="btn btn-yellow rtg-season-transition rtg-season-transition--footer" data-rtg-enter-season2><span>ENTRA NELLA SEASON 2</span><b aria-hidden="true">→</b></button></section>`:""}</div>${tabs("run")}</main>`;
    }
    function albumCollectionMarkup({state={},unlocked=0,total=0,collections=null}={}){
      const fallbackSeasonId=String(state?.activeSeasonId||"ie1");
      const source=Array.isArray(collections)&&collections.length
        ? collections
        : [{seasonId:fallbackSeasonId,unlocked,total}];
      const cards=source.map((collection)=>{
        const sid=String(collection?.seasonId||"ie1");
        const seasonNo=sid==="ie1_s2"?2:1;
        const safeTotal=Math.max(0,Number(collection?.total)||0),safeUnlocked=Math.max(0,Number(collection?.unlocked)||0);
        const percent=safeTotal?Math.round(safeUnlocked/safeTotal*100):0;
        const coverUrl=sid==="ie1_s2"?RTG_ALBUM_S2_COVER_URL:RTG_ALBUM_COVER_URL;
        const focalPoint=sid==="ie1_s2"?"center 42%":"center";
        const cover=`<span class="album-collection-cover album-collection-cover--hero"><img src="${escape(coverUrl)}" alt="" style="object-position:${escape(focalPoint)}" loading="lazy" decoding="async" onerror="this.hidden=true; this.parentElement.classList.add('is-fallback');"></span>`;
        return `<button type="button" class="panel album-collection-card" data-rtg-album-collection="${escape(sid)}" aria-label="Apri collezione Inazuma Eleven ${seasonNo}: ${escape(safeUnlocked)} su ${escape(safeTotal)} giocatori sbloccati, ${escape(percent)}%">${cover}<span class="album-collection-content album-collection-content--hero"><span class="album-collection-title">Inazuma Eleven ${seasonNo}</span><span class="album-collection-progress-copy"><span>${escape(safeUnlocked)} / ${escape(safeTotal)} giocatori sbloccati</span><strong>${escape(percent)}%</strong></span><span class="album-collection-progress-bar" aria-hidden="true"><span style="width:${percent}%"></span></span><span class="album-collection-action">Apri collezione <span aria-hidden="true">→</span></span></span></button>`;
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
      return `<main class="album-screen album-teams-screen rtg-album-teams-screen"><header class="topbar album-topbar album-teams-topbar"><button type="button" class="btn section-root-button album-teams-back-button" data-rtg-album-collection-back aria-label="Torna alle collezioni"><span aria-hidden="true">←</span></button><div class="album-teams-heading"><p class="eyebrow">ALBUM → INAZUMA ELEVEN ${sid==="ie1_s2"?"2":"1"}</p><h1>SQUADRE</h1></div><span class="album-teams-topbar-spacer" aria-hidden="true"></span></header><section class="album-team-grid album-team-grid--modern">${cards}</section></main>`;
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

    function requirementsMarkup(eligibility={}){if(!eligibility)return"";const seasonLabel=eligibility.seasonId==="ie1_s2"?"S2":"S1";const rows=[["Potenza rosa · max",eligibility.teamPower==null?"—":`${eligibility.teamPower} / ${eligibility.cap}`,!eligibility.reasons?.includes("team-power-cap")],[`Reclute ${seasonLabel} · min`,`${eligibility.recruitCount||0} / ${eligibility.minRecruit||0}`,!eligibility.reasons?.some(code=>code==="min-season-recruits"||code==="min-s1-recruits")],["Reclute recenti · min",`${eligibility.recentRecruitCount||0} / ${eligibility.recentCount||0}`,!eligibility.reasons?.some(code=>code==="recent-season-recruits"||code==="recent-s1-recruits")]];return `<section class="panel rtg-requirements"><p class="eyebrow">Accesso partita</p><h3>Requisiti</h3><div class="rtg-requirements-list">${rows.map(([label,value,ok])=>`<div class="rtg-requirement ${ok?"ok":"bad"}"><span><i aria-hidden="true">${ok?"✓":"!"}</i> ${escape(label)}</span><strong>${escape(value)}</strong></div>`).join("")}</div><p class="rtg-requirements-note">Reclute e potenza considerano tutti i 15 giocatori: titolari + panchina.</p></section>`;}
    function nodeModalMarkup({node,eligibility=null,seasonDb,allowed=true}={}){if(!node)return"";if(node.type==="main"){const label=teamName(seasonDb,node.teamId);return `<div class="rtg-node-modal rtg-paper-modal"><div class="modal-head rtg-node-modal-head"><span class="rtg-node-modal-emblem">${teamLogoMarkup(seasonDb,node.teamId)}</span><div><p class="eyebrow">Partita principale</p><h2>${escape(label)}</h2><p class="muted">Prepara la squadra e rispetta i requisiti della sfida.</p></div></div>${requirementsMarkup(eligibility)}<button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed||!eligibility?.eligible?"disabled":""}>GIOCA</button></div>`;}return `<div class="rtg-node-modal rtg-paper-modal"><div class="modal-head rtg-node-modal-head"><span class="rtg-node-modal-secondary" aria-hidden="true">?</span><div><p class="eyebrow">Svincolati</p><h2>Partita secondaria</h2><p class="muted">Avversari generati nella fascia di potenza del percorso. Vittoria: 100–150 Gettoni RTG.</p></div></div><button type="button" class="btn btn-yellow" data-rtg-start-node ${!allowed?"disabled":""}>GIOCA</button></div>`;}
    function vendingCapsulePalette(rarities=[]){
      const allowed=["normale","buono","forte","elite","mondiale","leggenda","aurico"];
      const available=[...new Set(Array.from(rarities||[]).map(entry=>pullRaritySlug(entry?.rarity)).filter(key=>allowed.includes(key)))];
      const palette=available.length?available:["normale","buono","forte","elite","mondiale"];
      const colors=Array.from({length:14},(_,index)=>index<palette.length?palette[index]:palette[Math.floor(Math.random()*palette.length)]);
      for(let i=colors.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[colors[i],colors[j]]=[colors[j],colors[i]];}
      return colors;
    }
    function vendingMarkup(model={}){
      const rarities=model.rarities||[],candidates=model.candidates||[],canPull=Number(model.tokens)>=300&&candidates.length>0;
      const capsuleColors=vendingCapsulePalette(rarities);
      const capsules=capsuleColors.map((rarity,index)=>`<div class="rtg-vending-capsule-v9 c${index+1}" data-capsule-rarity="${escape(rarity)}"></div>`).join("");
      const seasonNo=String(model.seasonId||"ie1")==="ie1_s2"?2:1;
      return `<div class="rtg-vending rtg-paper-modal"><div class="rtg-vending-title"><div><p class="eyebrow">RTG · S${seasonNo}</p><h2>Distributore</h2></div></div><div class="rtg-vending-stage"><div class="rtg-vending-machine-v9 rtg-vending-machine-v12" data-rtg-vending-machine aria-label="Distributore di palline Season ${seasonNo}"><div class="rtg-vending-head-v9" aria-hidden="true"><span>CAPSULE STATION</span><strong>INAZUMA RTG</strong></div><div class="rtg-vending-window-v9" aria-hidden="true">${capsules}<span class="rtg-vending-funnel-v10"></span><span class="rtg-vending-window-glare-v9"></span></div><div class="rtg-vending-body-v9"><div class="rtg-vending-info-v9"><small>1 CAPSULA</small><strong>300</strong></div><div class="rtg-vending-crank-v9" aria-hidden="true"><span></span></div><div class="rtg-vending-chute-v9" aria-hidden="true"><span class="rtg-vending-chute-well-v9"></span><span class="rtg-vending-chute-flap-v10"></span><div class="rtg-vending-prize-track-v9"><span class="rtg-vending-prize-v9"></span></div></div><div class="rtg-vending-brand-v9" aria-hidden="true">RTG</div></div></div><div class="rtg-vending-wallet-chip"><span>GETTONI</span><strong>${escape(Number(model.tokens)||0)} ◈</strong></div></div><div class="rtg-vending-ratebar" aria-label="Probabilità">${rarities.map((entry)=>`<span data-rarity="${escape(entry.rarity)}"><b>${escape(entry.rarity)}</b><em>${escape(Number(entry.weight).toFixed(1))}%</em></span>`).join("")}</div><button type="button" class="btn rtg-vending-album-link" data-rtg-vending-album data-rtg-destination="album" onclick="document.querySelector('[data-rtg-open-album]')?.click()">ALBUM RTG</button><button type="button" class="btn btn-yellow rtg-vending-pull" data-rtg-pull ${canPull?"":"disabled"}>${canPull?"GIRA · 300 ◈":candidates.length?`MANCANO ${escape(Math.max(0,300-(Number(model.tokens)||0)))} ◈`:"VINCI UNA SFIDA PER SBLOCCARE GIOCATORI"}</button></div>`;
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

    return Object.freeze({tabs,lockedMarkup:(...args)=>skinTokens(lockedMarkup(...args)),runMarkup:(...args)=>skinTokens(runMarkup(...args)),albumCollectionMarkup:(...args)=>skinTokens(albumCollectionMarkup(...args)),albumTeamsMarkup:(...args)=>skinTokens(albumTeamsMarkup(...args)),albumRosterMarkup:(...args)=>skinTokens(albumRosterMarkup(...args)),requirementsMarkup,nodeModalMarkup,vendingMarkup:(...args)=>skinTokens(vendingMarkup(...args)),pullResultMarkup:(...args)=>skinTokens(pullResultMarkup(...args))});
  }
  global.RoadToGloryRunView=Object.freeze({create});
})(globalThis);
