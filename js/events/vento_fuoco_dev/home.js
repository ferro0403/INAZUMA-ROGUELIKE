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
  function lineupMarkup(team,tools) {
    const preview=tools.matchPreview?.(team.teamId);
    if(!preview?.lineup?.length)return "";
    const cards=preview.lineup.map(p=>{
      const portrait=p?.portraitUrl||p?.fullbodyUrl||"";
      return '<div class="vf-lineup-player" title="'+esc(p?.name||'Giocatore')+'">'+
        '<span class="vf-lineup-player__portrait">'+(portrait?'<img src="'+esc(portrait)+'" alt="" loading="lazy">':'')+'</span>'+
        '<small>'+esc(p?.position||'—')+'</small><strong>'+esc(p?.name||'—')+'</strong></div>';
    }).join("");
    return '<details class="vf-rival__lineup" open><summary><span>FORMAZIONE '+esc(preview.formationId||'—')+
      ' · OVR '+esc(preview.overall??'—')+'</span><b>VEDI 11 TITOLARI</b></summary>'+
      '<div class="vf-lineup-grid" aria-label="Titolari '+esc(team.name)+'">'+cards+'</div></details>';
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
    const image=(id)=>tools.player(id)?.frontFullbodyUrl||tools.player(id)?.fullbodyUrl||"";
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
      <section class="vf-duel" aria-label="Fuoco contro Vento e Ghiaccio">
        <span class="vf-duel__tag">GLI ELEMENTI SI SCONTRANO</span>
        <div class="vf-duel__hot">
          <span class="vf-duel__element" aria-hidden="true">🔥</span>
          ${image("1105")?'<img class="vf-duel__fighter vf-duel__fighter--hot" src="'+esc(image("1105"))+'" alt="" loading="lazy">':""}
        </div>
        <div class="vf-duel__cold">
          <span class="vf-duel__element" aria-hidden="true">❄</span>
          ${image("4538")?'<img class="vf-duel__fighter vf-duel__fighter--cold" src="'+esc(image("4538"))+'" alt="" loading="lazy">':""}
        </div>
        <div class="vf-duel__title"><strong>FUOCO</strong><em>VS</em><strong>VENTO</strong></div>
        <div class="vf-duel__timer" data-halloween-countdown>${open?"TEMPO RIMASTO · "+esc(tools.countdown()):"EVENTO TERMINATO"}</div>
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
