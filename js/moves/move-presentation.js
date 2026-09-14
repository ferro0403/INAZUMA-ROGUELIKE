(function (global) {
  "use strict";
  const ELEMENTS=Object.freeze({
    fire:Object.freeze({key:"fire",label:"Fuoco"}),
    wind:Object.freeze({key:"wind",label:"Vento"}),
    mountain:Object.freeze({key:"mountain",label:"Montagna"}),
    forest:Object.freeze({key:"forest",label:"Albero"}),
  });
  const TYPE_LABELS=Object.freeze({shot:"Attacco",defense:"Difesa",dribble:"Dribbling",save:"Parata"});
  const EVENT_ICONS=Object.freeze({goal:"⚽",save:"🧤",counter:"⚡",long_shot:"🎯",post:"🥅",crossbar:"🥅",shot:"👟",defensive_stop:"🛡️",dribble:"↝",recovery:"↺",key_pass:"➜",build_up:"◆",first_half_start:"▶",second_half_start:"▶"});
  function escapeFallback(value){return String(value??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function normalizeElement(value){const key=String(value||"").trim().toLowerCase();return ELEMENTS[key]||{key:"neutral",label:String(value||"-")};}
  function typeLabel(type){return TYPE_LABELS[String(type||"").toLowerCase()]||String(type||"-");}
  function eventIcon(type){return EVENT_ICONS[type]||"◇";}
  function eventTextMarkup(event,escapeHtml=escapeFallback){
    const text=String(event?.text||""),moveName=String(event?.moveName||"");
    if(!moveName)return escapeHtml(text);
    const index=text.indexOf(moveName);if(index<0)return escapeHtml(text);
    const element=normalizeElement(event?.moveElement);
    return `${escapeHtml(text.slice(0,index))}<strong class="match-move-name move-element--${element.key}">${escapeHtml(moveName)}</strong>${escapeHtml(text.slice(index+moveName.length))}`;
  }
  function detailMarkup(move,escapeHtml=escapeFallback){
    if(!move)return "";
    const element=normalizeElement(move.element);
    return `<div class="player-move-card move-element--${element.key}">
      <div class="player-move-copy"><span class="player-move-kicker">Mossa assegnata</span><strong class="player-move-name">${escapeHtml(move.name)}</strong>
      <div class="player-move-meta"><span><small>Elemento</small><b>${escapeHtml(element.label)}</b></span><span><small>Categoria</small><b>${escapeHtml(typeLabel(move.type))}</b></span></div></div>
      <div class="player-move-power"><small>Potenza</small><strong>${escapeHtml(move.power)}</strong></div>
    </div>`;
  }
  global.MovePresentationRuntime=Object.freeze({normalizeElement,typeLabel,eventIcon,eventTextMarkup,detailMarkup});
})(globalThis);
