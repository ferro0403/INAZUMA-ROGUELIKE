// Solo l'evento Vento-Fuoco: home, sfide e classi visuali per squadra.
// Usa esclusivamente i dati del manifest e le API comuni; nessuna scrittura.
(function(global) {
  "use strict";
  const ID="vento_fuoco_dev";
  const event=global.GameEvents?.get?.(ID);
  const byId=new Map((event?.cards||[]).map(card=>[String(card.playerId),card.teamId]));
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

  // Anteprima esclusivamente read-only del limite: nessuna modifica all'OVR delle carte.
  function strengthBanner(strength) {
    const current=strength?.current;
    const max=Number(strength?.max);
    const valid=current!=null&&Number.isFinite(Number(current))&&Number.isFinite(max);
    const ratio=valid&&max>0?Math.min(100,Math.max(0,Number(current)/max*100)):0;
    return '<section class="vf-strength '+(valid&&current>max?'is-over-limit':'')+'" aria-label="Forza attuale e limite formazione">'+
      '<div><small>FORZA ATTUALE</small><strong>'+(current==null?'—':esc(current))+'</strong></div>'+
      '<div class="vf-strength__meter" aria-hidden="true"><span style="width:'+ratio+'%"></span></div>'+
      '<div><small>FORZA MASSIMA</small><strong>'+(Number.isFinite(max)?esc(max):'—')+'</strong></div></section>';
  }

  // Read-only snapshot from the native Squadra pitch renderer, not a second roster.
  function lineupMarkup(team,tools) {
    const preview=tools.matchPreview?.(team.teamId);
    if(!preview?.lineup?.length)return "";
    const pitch=String(preview.pitchMarkup||"");
    return '<details class="vf-rival__lineup" data-vf-lineup="'+esc(team.teamId)+'">'+
      '<summary><span class="vf-rival__lineup-label"><small>FORMAZIONE '+esc(preview.formationId||"—")+
      ' · OVR '+esc(preview.overall??"—")+'</small><strong>GLI 11 TITOLARI</strong></span>'+
      '<span class="vf-rival__lineup-toggle"><b>VEDI 11 IN CAMPO</b><b>CHIUDI CAMPO</b><i aria-hidden="true">⌄</i></span></summary>'+
      '<div class="vf-rival__field"><div class="vf-rival__field-head"><span>DISPOSIZIONE TATTICA · '+esc(preview.formationId||"—")+'</span>'+
      '<span>11 TITOLARI</span></div>'+
      '<div class="vf-mini-pitch development-squad-card-scope rtg-squad-shell" aria-label="Formazione su campo di '+esc(team.name)+'">'+
      (pitch||'<p class="vf-rival__unavailable">Anteprima campo non disponibile.</p>')+
      '</div></div></details>';
  }
  function classes(player) {
    if(!player)return "";
    const pid=String(player.playerId||player.cardId?.split("::").at(-1)||"");
    if(player.halloweenFusion||["9900001","9900002"].includes(pid)) {
      const variant=String(player.roleVariantId||player.element||"fire").toLowerCase();
      return "rtg-element-miximax rtg-element-miximax--"+(variant==="wind"?"wind":"fire");
    }
    const team=byId.get(pid);
    return team==="fire-team"?"rtg-element-fire-team":team==="blizzard-team"?"rtg-element-blizzard-team":"";
  }
  function home(tools) {
    const teams=tools.teams();
    const fire=teams.find(t=>t.teamId==="fire-team");
    const ice=teams.find(t=>t.teamId==="blizzard-team");
    if(!fire||!ice)return "";
    const open=tools.isOpen();
    const strength=tools.squadStrength?.()||null;
    const rival=(team,kind)=>{
      const coin=kind==="fire"?"fuoco_stemmi":"vento_stemmi";
      return `<article class="vf-rival vf-rival--${kind}">
        <div class="vf-rival__crest"><img src="${esc(team.logo)}" alt="" loading="lazy"></div>
        <div class="vf-rival__copy"><h2>${esc(team.name)}</h2>
          <p class="vf-rival__reward"><span>Vittoria:</span><strong>${tools.coin(300,coin)}</strong></p>
          <p class="vf-rival__reward"><span>Vittoria fortunata:</span><strong>${tools.coin(600,coin)} <small>gettoni</small></strong></p></div>
        <button type="button" class="vf-rival__challenge" data-event-action="start"
          data-event-team="${esc(team.teamId)}" ${open?"":"disabled"}>SFIDA</button>
        ${lineupMarkup(team,tools)}
      </article>`;
    };
    return `<main class="screen event-page event-page--vento-fuoco" data-event-extra="${ID}">
      <header class="vf-header">
        <button type="button" class="vf-back" data-event-action="exit" aria-label="Torna alle campagne">←</button>
        <div class="vf-heading"><small>EVENTO LIMITATO · DEV</small><h1>Vento e Fuoco</h1></div>
        <div class="vf-wallet" aria-label="Stemmi Fuoco e Vento">${tools.wallet()}</div>
      </header>
      ${strengthBanner(strength)}
      <section class="vf-duel" aria-label="Sfida elementale Fire Team contro Blizzard Team">
        <div class="vf-duel__top"><span>ROAD TO GLORY <i></i> EVENTO ELEMENTALE</span><strong>EDIZIONE SPECIALE</strong></div>
        <div class="vf-duel__main">
          <div class="vf-duel__team vf-duel__team--fire">
            <div class="vf-duel__team-emblem"><img src="${esc(fire.logo)}" alt="Stemma ${esc(fire.name)}" loading="eager"></div>
            <div class="vf-duel__team-name"><strong>FUOCO</strong><small>FIRE TEAM</small></div>
          </div>
          <div class="vf-duel__versus" aria-hidden="true"><span>VS</span></div>
          <div class="vf-duel__team vf-duel__team--ice">
            <div class="vf-duel__team-emblem"><img src="${esc(ice.logo)}" alt="Stemma ${esc(ice.name)}" loading="eager"></div>
            <div class="vf-duel__team-name"><strong>GHIACCIO</strong><small>BLIZZARD TEAM</small></div>
          </div>
        </div>
        <div class="vf-duel__bottom"><span>DUE SQUADRE <b>•</b> DUE SFIDE</span><strong data-halloween-countdown>${open?"SCADENZA · "+esc(tools.countdown()):"EVENTO TERMINATO"}</strong></div>
      </section>
      <section class="vf-rivals" aria-label="Le due partite e le formazioni avversarie">
        ${rival(fire,"fire")}${rival(ice,"ice")}
      </section>
      <button type="button" class="vf-distributors" data-event-action="pull" ${open?"":"disabled"}>
        <span aria-hidden="true">▤</span> DISTRIBUTORI
      </button>
      <button type="button" class="vf-miximax-banner" data-event-action="screen" data-event-screen="miximax"
        aria-label="Apri Miximax: fondi due giocatori sbloccati">
        <img src="${esc(event?.fusions?.banner||"")}" alt="" loading="lazy" referrerpolicy="no-referrer">
        <span class="vf-miximax-banner__copy"><small>FUSIONI ELEMENTALI</small><strong>MIXIMAX</strong><em>UNISCI I POTERI <b aria-hidden="true">›</b></em></span>
      </button>
    </main>`;
  }
  // All 22 players use the actual native Squadra card and detail viewer.
  // No writes, no preview-only card HTML, and no match start from a card tap.
  function bindHome(root,tools) {
    root?.querySelectorAll?.(".vf-mini-pitch [data-rtg-lineup-player]")?.forEach(card=>{
      card.removeAttribute?.("tabindex");
      card.addEventListener?.("click",event=>{
        event.stopPropagation?.();
        const cardId=card.dataset.rtgLineupPlayer;
        if(cardId)tools.openPreviewPlayer?.(cardId);
      });
    });
  }
  // Event-only view. All ownership and availability come from the committed ledger.
  function miximaxScreen(tools) {
    const recipes=tools.fusionRecipes?.()||[];
    const art=event?.fusions?.banner||"";
    // Identical card HTML from RoadToGlorySquadView.playerCard, not a
    // hand-built <img> thumbnail. These cards are read-only and consultable.
    const participant=(player,kind,owned,label)=>{
      const card=String(tools.fusionCard?.(player)||"");
      return '<div class="vf-miximax-entrant '+kind+' '+(owned?'is-owned':'is-missing')+'">'+
        '<div class="vf-miximax-native-card">'+
        (card||'<p class="vf-miximax-unavailable">Carta non disponibile</p>')+'</div>'+
        '<small class="vf-miximax-card-state">'+esc(label)+'</small></div>';
    };
    const pair=entry=>participant(entry.player,"vf-miximax-ingredient",entry.owned,
      entry.owned?"SBLOCCATO":"DA TROVARE");
    const recipeCard=recipe=>{
      const result=recipe.result||{};
      const versions=(result.roleVariants||[]).map(variant=>
        '<span class="'+(variant.element==="Wind"?"vf-wind":"vf-fire")+'">'+
        (variant.element==="Wind"?"VENTO":"FUOCO")+' · '+esc(variant.position)+'</span>').join("");
      const label=recipe.owned?"GIÀ FUSO":recipe.available?"FONDI I GIOCATORI":"REQUISITI MANCANTI";
      const status=recipe.owned?"La fusione è già nel tuo club.":
        recipe.inputs.every(input=>input.owned)?"Puoi eseguire la fusione.":
        "Devi sbloccare entrambi i giocatori nei distributori dell’evento.";
      return '<article class="vf-miximax-recipe" data-vf-recipe="'+esc(recipe.id)+'">'+
        '<div class="vf-miximax-pair development-squad-card-scope rtg-squad-shell" aria-label="Carte Squadra per '+esc(result.name)+'">'+
        recipe.inputs.map(pair).join('<span class="vf-miximax-plus" aria-hidden="true">+</span>')+
        '<span class="vf-miximax-arrow" aria-hidden="true">➜</span>'+
        participant(result,"vf-miximax-result",recipe.owned,recipe.owned?"NEL CLUB":"RISULTATO")+
        '</div>'+
        '<div class="vf-miximax-recipe__info"><h2>'+esc(result.name)+'</h2>'+
        '<div class="vf-miximax-versions">'+versions+'</div><p>'+esc(status)+'</p></div>'+
        '<button type="button" class="btn btn-yellow vf-miximax-fuse" data-vf-fuse-confirm="'+esc(recipe.id)+'" '+
          (recipe.available?'':'disabled')+'>'+label+'</button>'+
        '<div class="vf-miximax-confirm" data-vf-confirm-panel hidden>'+
          '<p><strong>FUSIONE IRREVERSIBILE</strong> · I due giocatori originali saranno consumati. Potrai ritrovarli solo nei distributori dell’evento.</p>'+
          '<div class="vf-miximax-confirm__actions">'+
            '<button type="button" class="btn btn-ghost" data-vf-fuse-cancel>ANNULLA</button>'+
            '<button type="button" class="btn btn-yellow" data-vf-fuse-run="'+esc(recipe.id)+'">CONFERMA FUSIONE</button></div>'+
        '</div></article>';
    };
    return '<main class="screen event-page event-page--vento-fuoco vf-miximax-page">'+
      '<header class="vf-miximax-header"><button type="button" data-event-action="home" class="vf-back" aria-label="Torna alla Home evento">←</button>'+
      '<div><small>VENTO × FUOCO · EVENTO SPECIALE</small><h1>MIXIMAX</h1></div></header>'+
      '<div class="vf-miximax-intro"><img src="'+esc(art)+'" alt="" referrerpolicy="no-referrer">'+
        '<div><small>UNA NUOVA FORZA</small><h2>Due leggende. Un solo giocatore.</h2>'+
        '<p>Unisci gli sbloccati di Fuoco e Blizzard e ottieni due versioni intercambiabili.</p></div></div>'+
      '<section class="vf-miximax-list" aria-label="Ricette Miximax">'+recipes.map(recipeCard).join("")+'</section>'+
      '<p class="vf-miximax-warning"><strong>ATTENZIONE:</strong> i giocatori usati nella fusione scompaiono dalla tua collezione attiva. Puoi sbloccarli nuovamente nell’evento.</p>'+
      '<button type="button" class="btn btn-ghost vf-miximax-return" data-event-action="home">TORNA ALL’EVENTO</button>'+
      '</main>';
  }
  function bindMiximax(root,tools) {
    // Native Squadra cards already contain the correct player/card identity;
    // a click opens the existing read-only player sheet, not the squad editor.
    root?.querySelectorAll?.(".vf-miximax-pair [data-rtg-squad-player]")?.forEach(card=>
      card.addEventListener("click",event=>{
        event.stopPropagation?.();
        tools.openFusionPlayer?.(card.dataset.rtgSquadPlayer);
      }));
    root?.querySelectorAll?.("[data-vf-fuse-confirm]")?.forEach(button=>button.addEventListener("click",()=>{
      const article=button.closest(".vf-miximax-recipe");
      const panel=article?.querySelector("[data-vf-confirm-panel]");
      if(!panel||button.disabled)return;
      button.hidden=true;panel.hidden=false;
    }));
    root?.querySelectorAll?.("[data-vf-fuse-cancel]")?.forEach(button=>button.addEventListener("click",()=>{
      const article=button.closest(".vf-miximax-recipe");
      const panel=article?.querySelector("[data-vf-confirm-panel]");
      const trigger=article?.querySelector("[data-vf-fuse-confirm]");
      if(panel)panel.hidden=true;
      if(trigger){trigger.hidden=false;trigger.focus?.();}
    }));
    root?.querySelectorAll?.("[data-vf-fuse-run]")?.forEach(button=>button.addEventListener("click",()=>{
      if(button.disabled)return;
      button.disabled=true;tools.fuse?.(button.dataset.vfFuseRun);
    }));
  }
  global.GameEvents?.extend?.(ID,{
    classes,home:{render:home,bind:bindHome},
    screens:{miximax:{render:miximaxScreen,bind:bindMiximax}}
  });
})(globalThis);
