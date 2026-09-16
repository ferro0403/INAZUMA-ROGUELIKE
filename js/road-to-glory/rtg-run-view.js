(function (global) {
  "use strict";

  const BLOCKS=Object.freeze([
    Object.freeze({index:0,start:0,end:2,label:"Primi passi"}),
    Object.freeze({index:1,start:3,end:5,label:"La sfida cresce"}),
    Object.freeze({index:2,start:6,end:8,label:"Verso l'élite"}),
    Object.freeze({index:3,start:9,end:9,label:"Finale"}),
  ]);

  function create(deps={}){
    const escape=deps.escapeHtml||((value)=>String(value??""));
    const emblem=deps.teamEmblemMarkup||((teamId)=>`<span class="rtg-team-fallback">${escape(String(teamId||"?").slice(0,1).toUpperCase())}</span>`);

    function tabs(active="run"){
      return `<nav class="rtg-tabs" aria-label="Road to Glory"><button type="button" class="rtg-tab ${active==="run"?"active":""}" data-rtg-tab="run">Run</button><button type="button" class="rtg-tab ${active==="squad"?"active":""}" data-rtg-tab="squad">Squadra</button></nav>`;
    }

    function lockedMarkup(access={}){
      const count=Math.max(0,Number(access.count)||0);
      return `<main class="rtg-shell rtg-locked"><header class="rtg-header"><button type="button" class="rtg-back" data-rtg-home>‹ Home</button><div><small>Modalità permanente</small><h1>Road to Glory</h1></div></header><section class="rtg-lock-card"><span class="rtg-lock-icon" aria-hidden="true">⚡</span><h2>La strada non è ancora aperta</h2><p>Sblocca almeno <strong>15 svincolati</strong> nelle run normali e assicurati di poter formare un undici valido con un portiere.</p><div class="rtg-lock-progress"><strong>${escape(count)}/15</strong><span><i style="width:${Math.min(100,Math.round(count/15*100))}%"></i></span></div></section></main>`;
    }

    function nodeState(state,node,index){
      if(state?.seasonComplete)return"completed";
      if(node.id===state?.currentNodeId)return"current";
      const currentIndex=Math.max(0,Number(state?.currentNodeIndex??-1));
      if(index<currentIndex)return"completed";
      const clearedSecondary=Number(state?.attemptsByNode?.[node.id]?.clears||0)>0;
      const defeatedMain=node.type==="main"&&(state?.defeatedTeamIds||[]).includes(node.teamId);
      if(clearedSecondary||defeatedMain)return"completed";
      return"locked";
    }

    function teamName(seasonDb,teamId){
      const team=(seasonDb?.teams||[]).find(t=>String(t.teamId||t.id)===String(teamId));
      return team?.name||team?.teamName||String(teamId||"Squadra");
    }

    function mainNodeMarkup(state,node,index,seasonDb){
      const status=nodeState(state,node,index);
      const disabled=status==="locked"?" disabled":"";
      return `<button type="button" class="rtg-node rtg-node--main rtg-node--${status}" data-rtg-node-id="${escape(node.id)}" data-rtg-state="${status}"${disabled}><span class="rtg-node-emblem">${emblem(node.teamId)}</span><span class="rtg-node-copy"><small>Partita principale</small><strong>${escape(teamName(seasonDb,node.teamId))}</strong></span></button>${node.checkpointAfter?`<div class="rtg-checkpoint" data-rtg-checkpoint="${escape(node.teamId)}"><span>⚑</span> Checkpoint</div>`:""}`;
    }

    function secondaryNodeMarkup(state,node,index){
      const status=nodeState(state,node,index);
      const farmable=Number(state?.attemptsByNode?.[node.id]?.clears||0)>0;
      const disabled=status==="locked"?" disabled":"";
      return `<button type="button" class="rtg-node rtg-node--secondary rtg-node--${status}" data-rtg-node-id="${escape(node.id)}" data-rtg-state="${status}" data-rtg-farmable="${farmable?"true":"false"}"${disabled}><span class="rtg-node-emblem rtg-free-agent-mark" aria-hidden="true">?</span><span class="rtg-node-copy"><small>${farmable?"Rigiocabile":"Svincolati"}</small><strong>Partita secondaria</strong></span></button>`;
    }

    function blockForNode(node){
      if(node.type==="main")return BLOCKS.find(block=>node.mainIndex>=block.start&&node.mainIndex<=block.end)||BLOCKS[0];
      const nextIndex=["occult","wild","brainwashing","otaku","shuriken","farm","kirkwood","royal","zeus","raimon"].indexOf(node.beforeTeamId);
      return BLOCKS.find(block=>nextIndex>=block.start&&nextIndex<=block.end)||BLOCKS[0];
    }

    function runMarkup({state,nodes,seasonDb}={}){
      const list=Array.from(nodes||[]);
      const currentIndex=list.findIndex(node=>node.id===state?.currentNodeId);
      const viewState={...(state||{}),currentNodeIndex:currentIndex};
      const blocks=BLOCKS.map(block=>{
        const blockNodes=list.map((node,index)=>({node,index})).filter(entry=>blockForNode(entry.node).index===block.index);
        return `<section class="rtg-map-block rtg-map-block--${block.index+1}" data-rtg-map-block="${block.index+1}"><div class="rtg-map-block-title"><small>Capitolo ${block.index+1}</small><strong>${escape(block.label)}</strong></div><div class="rtg-map-path">${blockNodes.map(({node,index})=>node.type==="main"?mainNodeMarkup(viewState,node,index,seasonDb):secondaryNodeMarkup(viewState,node,index)).join("")}</div></section>`;
      }).join("");
      return `<main class="rtg-shell"><header class="rtg-header"><button type="button" class="rtg-back" data-rtg-home>‹ Home</button><div><small>Season 1</small><h1>Road to Glory</h1></div><div class="rtg-wallet"><strong>◈ ${escape(Number(state?.tokens)||0)}</strong><span>♥ ${escape(Number(state?.lives)||0)} vite</span></div></header>${tabs("run")}<section class="rtg-run-toolbar"><button type="button" class="rtg-vending-button" data-rtg-open-vending>Distributore S1 <span>300 ◈</span></button></section><section class="rtg-map" aria-label="Percorso Season 1">${blocks}</section></main>`;
    }

    function requirementsMarkup(eligibility={}){
      if(!eligibility)return"";
      const rows=[
        ["Potenza RTG",eligibility.teamPower==null?"—":`${eligibility.teamPower} / ${eligibility.cap}`,!eligibility.reasons?.includes("team-power-cap")],
        ["Reclute S1",`${eligibility.recruitCount||0} / ${eligibility.minRecruit||0}`,!eligibility.reasons?.includes("min-s1-recruits")],
        ["Reclute recenti",`${eligibility.recentRecruitCount||0} / ${eligibility.recentCount||0}`,!eligibility.reasons?.includes("recent-s1-recruits")],
      ];
      return `<section class="rtg-requirements"><h3>Requisiti</h3>${rows.map(([label,value,ok])=>`<div class="rtg-requirement ${ok?"ok":"bad"}"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join("")}</section>`;
    }

    function vendingMarkup(model={}){
      const rarities=model.rarities||[];
      return `<div class="rtg-vending"><div class="rtg-vending-machine" aria-hidden="true"><span>⚽</span><i></i></div><h2>Distributore Season 1</h2><p>Ogni squadra battuta aggiunge i suoi giocatori al distributore.</p><div class="rtg-vending-rates">${rarities.map(r=>`<span><strong>${escape(r.rarity)}</strong><em>${escape(Number(r.weight).toFixed(1))}%</em></span>`).join("")}</div><div class="rtg-vending-wallet">Gettoni: <strong>${escape(Number(model.tokens)||0)}</strong></div><button type="button" data-rtg-pull ${Number(model.tokens)<300||!(model.candidates||[]).length?"disabled":""}>Pesca · 300 ◈</button>`;
    }

    function pullResultMarkup(result={},player={}){
      return `<div class="rtg-pull-result"><small>${escape(result.rarity||player.category||"")}</small><h2>${escape(player.name||result.playerId||"Giocatore")}</h2><p>${result.duplicate?`Duplicato · rimborso ${escape(result.refund)} ◈`:"Nuovo giocatore RTG!"}</p><strong>Saldo: ${escape(result.balanceAfter)} ◈</strong></div>`;
    }

    return Object.freeze({tabs,lockedMarkup,runMarkup,requirementsMarkup,vendingMarkup,pullResultMarkup});
  }

  global.RoadToGloryRunView=Object.freeze({create});
})(globalThis);
