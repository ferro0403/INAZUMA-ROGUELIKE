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

  function create(deps={}){
    const escape=deps.escapeHtml;
    const emblem=deps.teamEmblemMarkup;
    const seasonNumber=deps.seasonNumber;
    const header=deps.header;
    const tabs=deps.tabs;
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
    function routeBackgroundValue(seasonConfig){
      const runtimeAresSource=seasonConfig?.seasonId==="ie2" ? global.__RTG_ARES_ROUTE_MAP_DATA_URL : "";
      const source=String(runtimeAresSource||seasonConfig?.routeBackground||"").trim();
      if(!source)return "";
      const absolute=/^(?:https?:|data:|\/)/.test(source)?source:`/${source.replace(/^\.\//,"")}`;
      return `--rtg-route-image:url('${escape(absolute)}');`;
    }
    function season2MapMarkup(list,state,seasonDb,seasonConfig){
      const indexed=list.map((node,index)=>({node,index}));
      const blocks=list.length<=33?S2_BLOCKS:Array.from({length:Math.ceil(list.length/6)},(_,index)=>Object.freeze({index,start:index*6,end:Math.min(list.length-1,index*6+5),label:index===Math.ceil(list.length/6)-1?"Finale":`Tappa ${index+1}`,eyebrow:`Capitolo ${index+1}`,height:640,bg:`center ${Math.round(index/Math.max(1,Math.ceil(list.length/6)-1)*100)}%`}));
      return blocks.filter((block)=>block.start<list.length).map((block)=>{
        const entries=indexed.filter(({index})=>index>=block.start&&index<=block.end);
        const points=season2Positions(block.index,entries.length);
        return `<section class="rtg-map-block rtg-map-block--season2-part rtg-map-block--season2-${block.index+1}" data-rtg-map-block="season2-${block.index+1}"><div class="section-head rtg-route-heading"><div><p class="eyebrow">${escape(block.eyebrow)}</p><h2>${escape(block.label)}</h2></div><span class="rtg-route-count">${entries.length} tappe</span></div><div class="route-map rtg-route-stage rtg-route-stage--season2" style="${routeBackgroundValue(seasonConfig)}--rtg-route-height:${block.height}px;--rtg-route-bg-position:${escape(block.bg)}">${pathSvg(points)}${entries.map(({node,index},localIndex)=>node.type==="main"?mainNodeMarkup(state,node,index,seasonDb,points[localIndex]):secondaryNodeMarkup(state,node,index,points[localIndex])).join("")}</div></section>`;
      }).join("");
    }
    function runMarkup({state,nodes,seasonDb,seasonConfig=null}={}){
      const list=Array.from(nodes||[]),sid=String(state?.activeSeasonId||"ie1"),seasonNo=seasonConfig?.seasonNumber??seasonNumber(sid),seasonBadge=sid==="ie2"?"AR":sid==="orion"?"OR":`S${seasonNo}`,seasonName=sid==="ie2"?"Ares":sid==="orion"?"Orion":`Season ${seasonNo}`;
      const currentIndex=list.findIndex((node)=>node.id===state?.currentNodeId),viewState={...(state||{}),currentNodeIndex:currentIndex};
      const blocks=sid!=="ie1"?season2MapMarkup(list,viewState,seasonDb,seasonConfig):BLOCKS.map((block)=>{const entries=list.map((node,index)=>({node,index})).filter((entry)=>blockForNode(entry.node).index===block.index);return blockMarkup(block,entries,viewState,seasonDb);}).join("");
      const currentNode=list[currentIndex],currentLabel=currentNode?.type==="main"?teamName(seasonDb,currentNode.teamId):"Svincolati",complete=!!state?.seasonComplete,cleared=complete?list.length:Math.max(0,currentIndex);
      const currentMark=currentNode?.type==="main"?teamLogoMarkup(seasonDb,currentNode.teamId):`<span class="rtg-journey-free-agent" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M20 3 34 9v12c0 8-14 16-14 16S6 29 6 21V9Z" fill="currentColor"/><path d="m20 12 7 5-3 8h-8l-3-8Z" fill="#fff"/></svg></span>`;
      const resolvedSeasonConfig=seasonConfig||global.RoadToGloryConfig?.season?.(sid)||null;
      const nextSeasonId=resolvedSeasonConfig?.nextSeasonId??(sid==="ie1"?"ie1_s2":null),nextSeasonNo=nextSeasonId?seasonNumber(nextSeasonId):null;
      const transition=complete&&nextSeasonId?`<button type="button" class="btn btn-yellow rtg-season-transition" data-rtg-enter-next-season>ENTRA NELLA SEASON ${nextSeasonNo} <span aria-hidden="true">→</span></button>`:"";
      return `<main class="screen rtg-run-screen${seasonNo>=2?" rtg-run-screen--s2":""}${seasonConfig?.routeClass?` ${escape(seasonConfig.routeClass)}`:""}${complete?" rtg-run-screen--complete":""}">${header(state)}<div class="content narrow rtg-run-content"><section class="rtg-journey-summary ${complete?"rtg-journey-summary--complete":""}" aria-label="Avanzamento percorso"><div class="rtg-journey-main"><div class="rtg-journey-copy">${complete?`<div class="rtg-complete-kicker"><span class="rtg-complete-check" aria-hidden="true">✓</span><span>${escape(seasonName)} completata</span></div>`:`<p class="eyebrow">La tua prossima partita</p>`}<h1>${complete?"Traguardo raggiunto":escape(currentLabel)}</h1><p>${complete?`Percorso concluso · ${list.length} tappe completate`:`Tappa ${Math.max(1,currentIndex+1)} di ${list.length} · ${currentNode?.type==="main"?(currentNode.special?"Partita speciale":"Sfida principale"):"Partita Svincolati"}`}</p></div>${complete?`<div class="rtg-complete-trophy" aria-hidden="true"><span>★</span><b>${escape(seasonBadge)}</b></div>`:`<div class="rtg-journey-opponent" aria-hidden="true">${currentMark}</div>`}</div>${!complete&&currentNode?`<button type="button" class="btn btn-yellow" data-rtg-current-node="${escape(currentNode.id)}">Prepara partita <span aria-hidden="true">→</span></button>`:""}${transition}<div class="rtg-journey-progress" role="progressbar" aria-label="Tappe completate nel percorso attuale" aria-valuenow="${cleared}" aria-valuemin="0" aria-valuemax="${list.length}"><span style="width:${list.length?cleared/list.length*100:0}%"></span></div></section><section class="panel rtg-run-command"><div><p class="eyebrow">La tua collezione</p><h2>Rinforza la squadra</h2><p class="muted">Nuovi giocatori dalle squadre sconfitte.</p></div><button type="button" class="btn btn-yellow rtg-vending-button" data-rtg-open-vending>Distributore ${escape(seasonName)} <span>300 ◈</span></button></section><section class="rtg-map rtg-map--season-${escape(seasonBadge.toLowerCase())}" aria-label="Percorso ${escape(seasonName)}">${blocks}</section>${complete&&nextSeasonId?`<section class="rtg-season-complete-footer" aria-label="Continua nella Season ${nextSeasonNo}"><div class="rtg-season-complete-footer__head"><div class="rtg-season-complete-footer__badge" aria-hidden="true"><small>PROSSIMA</small><b>S${nextSeasonNo}</b></div><div class="rtg-season-complete-footer__copy"><p class="eyebrow">SEASON ${seasonNo} COMPLETATA</p><strong>Continua il viaggio</strong><span>La Season ${nextSeasonNo} riparte dalla tua squadra attuale. Entrando ricevi <b>+1.000 Gettoni RTG</b>.</span></div></div><button type="button" class="btn btn-yellow rtg-season-transition rtg-season-transition--footer" data-rtg-enter-next-season><span>ENTRA NELLA SEASON ${nextSeasonNo}</span><b aria-hidden="true">→</b></button></section>`:""}</div>${tabs("run")}</main>`;
    }
    return Object.freeze({runMarkup,teamRecord,teamName,teamLogoMarkup});
  }
  global.RoadToGloryRouteView=Object.freeze({create});
})(globalThis);
