// Pezzo aggiuntivo di Halloween (Passo 3.6d): l'aspetto "vampiro" delle 16 carte Halloween che lo hanno nel file
// dell'evento (cards[].vampire). Vale solo per Halloween: la parte comune chiede le classi in piu' con
// GameEvents.extraClasses(player, place) / GameEvents.hook(id, "classes", player, place) e non sa niente dei vampiri.
// Le regole di stile restano in css/rtg-halloween-event.css (classi halloween-vampire-* e halloween-vampiro).
(function (global) {
  "use strict";
  const BY_PLACE = Object.freeze({
    card: "halloween-vampire-player",
    "match-card": "halloween-vampire-player",
    "event-card": "halloween-vampire-card",
    "detail-visual": "halloween-vampiro",
    duel: "halloween-vampiro",
    actor: "halloween-vampiro",
    "detail-modal": "halloween-detail-vampire",
  });
  global.GameEvents?.extend?.("halloween2026", {
    classes(player, place) {
      if (place === "crest") return "halloween-vampiro"; // lo stemma della squadra dell'evento
      return player?.halloweenVampire === true ? BY_PLACE[place] || "" : "";
    },
  });
})(globalThis);
