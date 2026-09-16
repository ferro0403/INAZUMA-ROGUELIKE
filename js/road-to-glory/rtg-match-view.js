(function (global) {
  "use strict";

  function create(deps={}){
    const escape=deps.escapeHtml||((value)=>String(value??""));
    const pid=(p)=>String(p?.playerId||p?.id||"");
    const role=(p)=>String(p?.normalizedRole||p?.position||p?.role||"");

    function fieldPlayer(player,side,index){
      return `<div class="rtg-field-player rtg-field-player--${side}" data-rtg-field-player="${escape(pid(player))}" data-role="${escape(role(player))}" style="--slot:${index}"><span>${escape(player?.name||pid(player))}</span><small>${escape(role(player))}</small></div>`;
    }

    function periodLabel(period){
      return ({first_half:"1° tempo",second_half:"2° tempo",extra_first:"1° suppl.",extra_second:"2° suppl.",halftime:"Intervallo"}[period]||"Partita");
    }

    function matchMarkup(match={}){
      const user=match.userSquad?.lineup||[],opp=match.opponentSquad?.lineup||[];
      return `<main class="rtg-shell rtg-match-shell"><header class="rtg-match-score"><span>${escape(periodLabel(match.period))}</span><strong>${escape(match.score?.user||0)} - ${escape(match.score?.opponent||0)}</strong><button type="button" data-rtg-abandon>Abbandona</button></header><section class="rtg-static-field"><div class="rtg-half rtg-half--opponent">${opp.map((p,i)=>fieldPlayer(p,"opponent",i)).join("")}</div><div class="rtg-center-line"></div><div class="rtg-half rtg-half--user">${user.map((p,i)=>fieldPlayer(p,"user",i)).join("")}</div></section><div class="rtg-match-overlay" data-rtg-match-overlay></div></main>`;
    }

    function encounterMarkup(match={},preview={}){
      const pending=match.pendingEncounter||{};
      const user=preview.userPlayer||{};
      const opponent=preview.opponentPlayer||{};
      const key=`user:${String(pending.userPlayerId||"")}`;
      const uses=Number(match.moveUsesByPlayerId?.[key]||0);
      const probability=Number(preview.probability??pending.normalPreviewProbability??50);
      return `<section class="rtg-duel-card"><div class="rtg-duel-label"><span>${escape(pending.userBaseActionLabel||"Azione")}</span><strong>${escape(probability.toFixed(1))}%</strong></div><div class="rtg-probability"><i style="width:${Math.max(10,Math.min(90,probability))}%"></i></div><div class="rtg-versus"><article><small>Tu</small><strong>${escape(user.name||pending.userPlayerId||"")}</strong><span>OVR ${escape(user.overall??user.finalOverall??"—")}</span></article><b>VS</b><article><small>Avversario</small><strong>${escape(opponent.name||pending.opponentPlayerId||"")}</strong><span>OVR ${escape(opponent.overall??opponent.finalOverall??"—")}</span></article></div><div class="rtg-duel-actions"><button type="button" class="rtg-action-button" data-rtg-choice="base">${escape(pending.userBaseActionLabel||"Azione")}</button>${pending.userMove&&uses>0?`<button type="button" class="rtg-action-button rtg-action-button--move" data-rtg-choice="move"><strong>${escape(pending.userMove.name)}</strong><small>${escape(uses)}/2 · Power ${escape(pending.userMove.power||"—")}</small></button>`:""}</div></section>`;
    }

    function resolvedEncounterMarkup(resolution={}){
      return `<section class="rtg-duel-card rtg-duel-result"><small>Scelta IA: <strong>${escape(resolution.aiChoiceLabel||"Azione base")}</strong></small><h2>${resolution.userWon?"Duello vinto!":"Duello perso"}</h2><p>Probabilità finale <strong>${escape(Number(resolution.probability||50).toFixed(1))}%</strong></p></section>`;
    }

    function halftimeMarkup(model={}){
      const lineup=model.lineup||[],bench=model.bench||[];
      return `<section class="rtg-halftime"><h2>Intervallo</h2><p>Puoi cambiare formazione e usare tutti e 4 i panchinari. Le cariche delle mosse restano quelle del primo tempo.</p><div class="rtg-halftime-grid"><div><h3>Campo</h3>${lineup.map(p=>`<button type="button" data-rtg-half-lineup="${escape(pid(p))}">${escape(p.name||pid(p))} · ${escape(role(p))}</button>`).join("")}</div><div><h3>Panchina</h3>${bench.map(p=>`<button type="button" data-rtg-half-bench="${escape(pid(p))}">${escape(p.name||pid(p))} · ${escape(role(p))}</button>`).join("")}</div></div><button type="button" class="rtg-action-button" data-rtg-half-confirm>Conferma secondo tempo</button></section>`;
    }

    function penaltyMarkup(match={},context={}){
      return `<section class="rtg-penalty-panel"><h2>Rigori</h2><p>Scegli la direzione senza vedere la scelta avversaria.</p><div class="rtg-penalty-directions"><button data-rtg-penalty-direction="left">Sinistra</button><button data-rtg-penalty-direction="center">Centro</button><button data-rtg-penalty-direction="right">Destra</button></div>${context.canUseMove?`<button type="button" class="rtg-action-button rtg-action-button--move" data-rtg-penalty-move>Usa mossa</button>`:""}<div class="rtg-shootout-score">${escape(match.shootout?.score?.user||0)} - ${escape(match.shootout?.score?.opponent||0)}</div></section>`;
    }

    function resultMarkup(match={}){
      const won=match.result?.winner==="user";
      return `<section class="rtg-match-result"><h2>${won?"Vittoria!":match.result?.winner?"Sconfitta":"Pareggio"}</h2><strong>${escape(match.score?.user||0)} - ${escape(match.score?.opponent||0)}</strong><button type="button" class="rtg-action-button" data-rtg-result-continue>Continua</button></section>`;
    }

    function bind(root,actions={}){
      root?.querySelectorAll?.("[data-rtg-choice]")?.forEach(button=>button.addEventListener("click",()=>actions.onEncounterChoice?.(button.dataset.rtgChoice)));
      root?.querySelector?.("[data-rtg-abandon]")?.addEventListener("click",()=>actions.onAbandon?.());
      root?.querySelector?.("[data-rtg-half-confirm]")?.addEventListener("click",()=>actions.onHalftimeConfirm?.());
      root?.querySelectorAll?.("[data-rtg-penalty-direction]")?.forEach(button=>button.addEventListener("click",()=>actions.onPenaltyDirection?.(button.dataset.rtgPenaltyDirection)));
      root?.querySelector?.("[data-rtg-penalty-move]")?.addEventListener("click",()=>actions.onPenaltyMove?.());
      root?.querySelector?.("[data-rtg-result-continue]")?.addEventListener("click",()=>actions.onContinue?.());
    }

    return Object.freeze({matchMarkup,encounterMarkup,resolvedEncounterMarkup,halftimeMarkup,penaltyMarkup,resultMarkup,bind});
  }

  global.RoadToGloryMatchView=Object.freeze({create});
})(globalThis);
