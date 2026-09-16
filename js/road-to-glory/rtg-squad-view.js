(function (global) {
  "use strict";

  function create(deps={}){
    const escape=deps.escapeHtml||((value)=>String(value??""));
    const resolver=deps.playerResolver||global.RoadToGloryPlayerResolver;

    function playerCard(player,source,attrs=""){
      const role=player?.normalizedRole||player?.position||"—";
      const portrait=player?.portraitUrl||player?.portrait||player?.imageUrl||"";
      return `<button type="button" class="rtg-player-card" ${attrs}><span class="rtg-player-portrait">${portrait?`<img src="${escape(portrait)}" alt="" loading="lazy" />`:"<i>⚡</i>"}</span><span class="rtg-player-copy"><strong>${escape(player?.name||player?.playerId||"Giocatore")}</strong><small>${escape(role)} · OVR ${escape(player?.overall??player?.finalOverall??"—")}</small></span>${source?`<em>${escape(source)}</em>`:""}</button>`;
    }

    function renderModel({state,freeAgentIds=[],seasonDb,freeAgentsDb=null}={}){
      const seasonId=String(state?.activeSeasonId||"ie1");
      const squad=state?.squads?.[seasonId]||state?.squads?.ie1||{formationId:null,lineup:[],bench:[],activeRoleVariantByPlayerId:{}};
      const gacha=new Set((state?.gachaAcquiredPlayerIds||[]).map(String));
      const accessible=Array.from(new Set([...(freeAgentIds||[]).map(String),...gacha]));
      const resolve=(playerId)=>resolver?.resolveAtLevel20?.(playerId,seasonId,squad.activeRoleVariantByPlayerId?.[playerId]||null,freeAgentsDb)||{playerId,name:playerId,overall:"—",level:20};
      const sourceFor=(playerId)=>gacha.has(String(playerId))?"RTG":"Svincolato";
      const collection=accessible.map(playerId=>({playerId,source:sourceFor(playerId),player:resolve(playerId)})).sort((a,b)=>(Number(b.player?.overall)||0)-(Number(a.player?.overall)||0)||String(a.player?.name||"").localeCompare(String(b.player?.name||"")));
      return Object.freeze({
        seasonId,
        formationId:squad.formationId,
        formations:Object.freeze(Array.from(seasonDb?.formations?.eleven||[])),
        lineup:Object.freeze((squad.lineup||[]).map(playerId=>({playerId:String(playerId),source:sourceFor(playerId),player:resolve(String(playerId))}))),
        bench:Object.freeze((squad.bench||[]).map(playerId=>({playerId:String(playerId),source:sourceFor(playerId),player:resolve(String(playerId))}))),
        collection:Object.freeze(collection),
        activeRoleVariantByPlayerId:{...(squad.activeRoleVariantByPlayerId||{})},
      });
    }

    function markup(model={}){
      const formations=model.formations||[];
      const lineup=model.lineup||[],bench=model.bench||[];
      const collection=model.collection||[];
      return `<main class="rtg-shell rtg-squad-shell"><header class="rtg-header"><button type="button" class="rtg-back" data-rtg-home>‹ Home</button><div><small>Season 1</small><h1>Road to Glory</h1></div><div class="rtg-squad-level">LV 20</div></header><nav class="rtg-tabs" aria-label="Road to Glory"><button type="button" class="rtg-tab" data-rtg-tab="run">Run</button><button type="button" class="rtg-tab active" data-rtg-tab="squad">Squadra</button></nav><section class="rtg-squad-content"><div class="rtg-squad-toolbar"><label>Modulo <select data-rtg-formation>${formations.map(f=>`<option value="${escape(f.id)}" ${String(f.id)===String(model.formationId)?"selected":""}>${escape(f.formation||f.name||f.id)}</option>`).join("")}</select></label><button type="button" class="rtg-squad-action" data-rtg-save-squad>Salva squadra</button></div><section class="rtg-squad-pitch"><h2>Titolari</h2><div class="rtg-squad-grid">${lineup.map(entry=>playerCard(entry.player,entry.source,`data-rtg-lineup-player="${escape(entry.playerId)}"`)).join("")}</div></section><section class="rtg-bench"><h2>Panchina</h2><div class="rtg-bench-grid">${bench.map(entry=>playerCard(entry.player,entry.source,`data-rtg-bench-player="${escape(entry.playerId)}"`)).join("")}</div></section><section class="rtg-collection"><div class="rtg-collection-head"><h2>Giocatori disponibili</h2><div><select data-rtg-role-filter><option value="all">Tutti i ruoli</option><option>GK</option><option>DF</option><option>MF</option><option>FW</option></select><select data-rtg-source-filter><option value="all">Tutte le fonti</option><option value="Svincolato">Svincolati</option><option value="RTG">RTG</option></select></div></div><div class="rtg-collection-grid">${collection.map(entry=>playerCard(entry.player,entry.source,`data-rtg-collection-player="${escape(entry.playerId)}" data-role="${escape(entry.player?.normalizedRole||entry.player?.position||"")}" data-source="${escape(entry.source)}"`)).join("")}</div></section></section></main>`;
    }

    function bind(root,actions={}){
      let selected=null;
      root?.querySelector?.("[data-rtg-formation]")?.addEventListener("change",event=>actions.onFormationChange?.(event.target.value));
      root?.querySelector?.("[data-rtg-save-squad]")?.addEventListener("click",()=>actions.onSave?.());
      root?.querySelectorAll?.("[data-rtg-lineup-player],[data-rtg-bench-player],[data-rtg-collection-player]")?.forEach(button=>{
        button.addEventListener("click",()=>{
          const current=button.dataset.rtgLineupPlayer||button.dataset.rtgBenchPlayer||button.dataset.rtgCollectionPlayer;
          if(!selected){selected=current;button.classList.add("selected");actions.onOpenPlayer?.(current);return;}
          if(selected===current){selected=null;button.classList.remove("selected");return;}
          const first=selected;selected=null;root.querySelectorAll?.(".rtg-player-card.selected")?.forEach(el=>el.classList.remove("selected"));actions.onSwap?.(first,current);
        });
      });
      const applyFilters=()=>{
        const role=root.querySelector?.("[data-rtg-role-filter]")?.value||"all";
        const source=root.querySelector?.("[data-rtg-source-filter]")?.value||"all";
        root.querySelectorAll?.("[data-rtg-collection-player]")?.forEach(card=>{
          card.hidden=(role!=="all"&&card.dataset.role!==role)||(source!=="all"&&card.dataset.source!==source);
        });
      };
      root?.querySelector?.("[data-rtg-role-filter]")?.addEventListener("change",applyFilters);
      root?.querySelector?.("[data-rtg-source-filter]")?.addEventListener("change",applyFilters);
    }

    return Object.freeze({renderModel,markup,bind,playerCard});
  }

  global.RoadToGlorySquadView=Object.freeze({create});
})(globalThis);
