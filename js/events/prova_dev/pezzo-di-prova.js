// Pezzo aggiuntivo dell'evento di prova (solo sviluppo). Mostra come un evento ha una home e schermate tutte sue
// (Parte 2 b) usando solo gli strumenti comuni: saldo, carte possedute, pesca, squadra, partita, dati propri,
// scambio di carte. Non tocca la parte comune ne' gli altri eventi.
(function (global) {
  "use strict";
  const LAB_COST = 1; // stelle per una creazione
  const pill = (tools) => `<div class="event-page__wallet">${tools.wallet()}</div>`;
  const header = (tools, back, title, eyebrow) => `<header class="event-page__top">
      <button type="button" class="btn event-page__back" data-event-action="${back}" aria-label="Indietro">←</button>
      <div class="event-page__titles"><small>${tools.escape(eyebrow)}</small><h1>${tools.escape(title)}</h1></div>${pill(tools)}</header>`;
  let picked = [];

  function home(tools) {
    const teams = tools.teams().map((team) => `<article class="event-page__panel event-page__team">
        <img src="${tools.escape(team.logo)}" alt="" width="56" height="56">
        <div><strong>${tools.escape(team.name)}</strong><small>Sfida la squadra dell'evento</small></div>
        <button type="button" class="btn event-page__cta" data-event-action="start" data-event-team="${tools.escape(team.teamId)}"
          ${tools.isOpen() ? "" : "disabled"}>SFIDA</button></article>`).join("");
    const data = tools.data();
    return `<main class="screen event-page event-page--prova" data-event-extra="prova_dev">
      ${header(tools, "exit", "Laboratorio degli Angeli", "EVENTO DI PROVA · HOME PROPRIA")}
      <section class="event-page__panel event-page__hero"><span>Fine evento</span><strong>${tools.escape(tools.isOpen() ? tools.countdown() : "TERMINATO")}</strong>
        <small>Creazioni nel laboratorio: ${tools.escape(data.creations || 0)}</small></section>
      <section class="event-page__grid">${teams}</section>
      <nav class="event-page__actions" aria-label="Azioni dell'evento">
        <button type="button" class="btn" data-event-action="pull">DISTRIBUTORE</button>
        <button type="button" class="btn" data-event-action="squad">SQUADRA</button>
        <button type="button" class="btn" data-event-action="album">COLLEZIONE</button>
        <button type="button" class="btn event-page__cta" data-event-action="screen" data-event-screen="lab">LABORATORIO</button>
      </nav></main>`;
  }

  function lab(tools) {
    const cards = tools.ownedCards().filter((card) => !tools.inSquad(card.playerId));
    const list = cards.map((card) => `<button type="button" class="event-page__chip ${picked.includes(card.playerId) ? "is-picked" : ""}"
        data-lab-card="${tools.escape(card.playerId)}">${tools.escape(card.player?.name || card.playerId)}
        <small>${tools.escape(card.player?.category || "")}</small></button>`).join("");
    const stars = tools.balance("stelle_prova");
    return `<main class="screen event-page event-page--prova" data-event-screen-name="lab">
      ${header(tools, "home", "Laboratorio", "EVENTO DI PROVA · SCHERMATA PROPRIA")}
      <section class="event-page__panel"><p>Scegli 2 carte dell'evento che non sono in squadra: diventano 1 carta dell'evento
        che non hai ancora. Costo: ${LAB_COST} ${tools.escape("stella")}. Hai ${tools.escape(stars)} stelle.</p>
        <div class="event-page__chips">${list || "<p>Nessuna carta disponibile: apri il distributore.</p>"}</div>
        <button type="button" class="btn event-page__cta" data-lab-create ${picked.length === 2 && stars >= LAB_COST ? "" : "disabled"}>CREA</button>
      </section></main>`;
  }
  function bindLab(root, tools) {
    root.querySelectorAll("[data-lab-card]").forEach((el) => el.addEventListener("click", () => {
      const id = el.dataset.labCard;
      picked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id].slice(-2);
      tools.go("lab");
    }));
    root.querySelector("[data-lab-create]")?.addEventListener("click", async () => {
      const owned = new Set(tools.ownedCards().map((card) => card.playerId));
      const event = global.GameEvents.get(tools.eventId);
      const created = event.cards.map((card) => card.playerId).find((pid) => !owned.has(pid));
      if (!created) return tools.toast("Hai gia' tutte le carte dell'evento.");
      const [a, b] = picked;
      picked = [];
      await tools.exchangeCards([a, b], [created]);
      await tools.spend("stelle_prova", LAB_COST);
      await tools.save((data) => ({ ...data, creations: Number(data.creations || 0) + 1 }));
      tools.toast(`Nuova carta: ${tools.player(created)?.name || created}`);
      tools.go("lab");
    });
  }

  global.GameEvents?.extend?.("prova_dev", {
    home: { render: home },
    screens: { lab: { render: lab, bind: bindLab } },
  });
})(globalThis);
