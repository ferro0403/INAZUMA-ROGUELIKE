(function (global) {
  "use strict";
  const ELEMENTS=Object.freeze({
    fire:Object.freeze({key:"fire",label:"Fuoco"}),
    wind:Object.freeze({key:"wind",label:"Vento"}),
    mountain:Object.freeze({key:"mountain",label:"Montagna"}),
    forest:Object.freeze({key:"forest",label:"Albero"}),
  });
  const TYPE_LABELS=Object.freeze({shot:"Tiro",defense:"Difesa",dribble:"Dribbling",save:"Parata"});
  const EVENT_ICONS=Object.freeze({goal:"⚽",save:"🧤",counter:"⚡",long_shot:"🎯",post:"🥅",crossbar:"🥅",shot:"👟",defensive_stop:"🛡️",dribble:"↝",recovery:"↺",key_pass:"➜",build_up:"◆",first_half_start:"▶",second_half_start:"▶"});
  const EVENT_LABELS=Object.freeze({goal:"Gol",save:"Parata",counter:"Contropiede",long_shot:"Tiro da fuori",post:"Palo",crossbar:"Traversa",shot:"Tiro",defensive_stop:"Difesa",dribble:"Dribbling",recovery:"Recupero",key_pass:"Passaggio chiave",build_up:"Manovra",first_half_start:"1° tempo",second_half_start:"2° tempo"});
  function escapeFallback(value){return String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function normalizeElement(value){const key=String(value||"").trim().toLowerCase();return ELEMENTS[key]||{key:"neutral",label:String(value||"-")};}
  function typeLabel(type){return TYPE_LABELS[String(type||"").toLowerCase()]||String(type||"-");}
  function eventIcon(type){return EVENT_ICONS[type]||"◇";}
  function eventLabel(type){return EVENT_LABELS[String(type||"")]||"Azione";}
  function decorateEventVisual(event,resolvePlayerVisual){
    if(!event?.playerId||typeof resolvePlayerVisual!=="function")return event;
    const visual=resolvePlayerVisual({playerId:String(event.playerId)},{playerId:String(event.playerId)})||{};
    return {...event,portraitUrl:visual.cardImageUrl||visual.portraitUrl||null,portraitFallbacks:Array.isArray(visual.cardFallbacks)?visual.cardFallbacks:[]};
  }
  function eventMarkerMarkup(event,escapeHtml=escapeFallback){
    const portraitUrl=String(event?.portraitUrl||"");
    if(portraitUrl&&event?.playerId){
      const fallbacks=[...new Set([portraitUrl,...(Array.isArray(event.portraitFallbacks)?event.portraitFallbacks:[])].filter(Boolean))];
      return `<span class="match-event-avatar" aria-hidden="true"><img src="${escapeHtml(portraitUrl)}" alt="" loading="lazy" data-image-fallbacks="${escapeHtml(JSON.stringify(fallbacks))}" data-image-fallback-index="0" onerror="globalThis.handlePlayerImageError && globalThis.handlePlayerImageError(this)" /></span>`;
    }
    return `<span class="match-event-symbol" aria-hidden="true">${escapeHtml(event?.icon||eventIcon(event?.type))}</span>`;
  }
  function eventTextMarkup(event,escapeHtml=escapeFallback){
    const text=String(event?.text||""),moveName=String(event?.moveName||"");
    if(!moveName)return escapeHtml(text);
    const index=text.indexOf(moveName);if(index<0)return escapeHtml(text);
    const element=normalizeElement(event?.moveElement);
    return `${escapeHtml(text.slice(0,index))}<strong class="match-move-name move-element--${element.key}">${escapeHtml(moveName)}</strong>${escapeHtml(text.slice(index+moveName.length))}`;
  }
  function eventContentMarkup(event,escapeHtml=escapeFallback){
    return `<span class="match-event-kind">${escapeHtml(eventLabel(event?.type))}</span><span class="match-event-copy">${eventTextMarkup(event,escapeHtml)}</span>`;
  }
  function detailMarkup(move,escapeHtml=escapeFallback){
    if(!move)return "";
    const element=normalizeElement(move.element);
    const typeKey=String(move.type||"").toLowerCase();
    return `<div class="player-move-card move-category--${escapeHtml(typeKey)}">
      <div class="player-move-copy"><span class="player-move-kicker">Mossa assegnata</span><strong class="player-move-name">${escapeHtml(move.name)}</strong>
      <div class="player-move-meta"><span class="player-move-element move-element--${element.key}"><small>Elemento</small><b>${escapeHtml(element.label)}</b></span><span class="player-move-category move-category--${escapeHtml(typeKey)}"><small>Categoria</small><b>${escapeHtml(typeLabel(move.type))}</b></span></div></div>
      <div class="player-move-power"><small>Potenza</small><strong>${escapeHtml(move.power)}</strong></div>
    </div>`;
  }
  global.MovePresentationRuntime=Object.freeze({normalizeElement,typeLabel,eventIcon,eventLabel,decorateEventVisual,eventMarkerMarkup,eventTextMarkup,eventContentMarkup,detailMarkup});
})(globalThis);
