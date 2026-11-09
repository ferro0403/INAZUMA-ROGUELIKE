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
      '<div class="vf-mini-pitch" aria-label="Formazione su campo di '+esc(team.name)+'">'+
      (pitch||'<p class="vf-rival__unavailable">Anteprima campo non disponibile.</p>')+
      '</div></div></details>';
  }
  function classes(player) {
    if(!player)return "";
    const pid=String(player.playerId||player.cardId?.split("::").at(-1)||"");
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
          <p>Vittoria: <strong>${tools.coin(300,coin)}</strong></p>
          <p>Fortunata 20%: <strong>600 stemmi</strong></p>
          ${Number.isFinite(Number(strength?.maxByTeam?.[team.teamId]))?`<p class="vf-rival__limit">Limite formazione: <b>OVR ${esc(strength.maxByTeam[team.teamId])}</b></p>`:""}</div>
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
    </main>`;
  }
  global.GameEvents?.extend?.(ID,{classes,home:{render:home}});
})(globalThis);
