// Pezzo aggiuntivo dell'evento di prova (solo sviluppo). Mostra come un evento ha una home e schermate tutte sue
// (Parte 2 b) usando solo gli strumenti comuni: saldo, carte possedute, pesca, squadra, partita, dati propri.
// La schermata di esempio (Diario) non consuma carte. Non tocca la parte comune ne' gli altri eventi.
(function (global) {
  "use strict";
  const pill = (tools) => `<div class="event-page__wallet">${tools.wallet()}</div>`;
  const header = (tools, back, title, eyebrow) => `<header class="event-page__top">
      <button type="button" class="btn event-page__back" data-event-action="${back}" aria-label="Indietro">←</button>
      <div class="event-page__titles"><small>${tools.escape(eyebrow)}</small><h1>${tools.escape(title)}</h1></div>
      ${pill(tools)}</header>`;

  function home(tools) {
    const open = tools.isOpen() ? "" : "disabled";
    const teams = tools.teams().map((team) => `<article class="event-page__panel event-page__team">
        <img src="${tools.escape(team.logo)}" alt="" width="56" height="56">
        <div><strong>${tools.escape(team.name)}</strong><small>Sfida la squadra dell'evento</small></div>
        <button type="button" class="btn event-page__cta" data-event-action="start"
          data-event-team="${tools.escape(team.teamId)}" ${open}>SFIDA</button></article>`).join("");
    const data = tools.data();
    const countdown = tools.isOpen() ? tools.countdown() : "TERMINATO";
    return `<main class="screen event-page event-page--prova" data-event-extra="prova_dev">
      ${header(tools, "exit", "Torneo degli Angeli", "EVENTO DI PROVA · HOME PROPRIA")}
      <section class="event-page__panel event-page__hero"><span>Fine evento</span>
        <strong>${tools.escape(countdown)}</strong>
        <small>Timbri sul diario: ${tools.escape(data.visits || 0)}</small></section>
      <section class="event-page__grid">${teams}</section>
      ${guests(tools)}
      <nav class="event-page__actions" aria-label="Azioni dell'evento">
        <button type="button" class="btn" data-event-action="pull">DISTRIBUTORE</button>
        <button type="button" class="btn" data-event-action="squad">SQUADRA</button>
        <button type="button" class="btn" data-event-action="album">COLLEZIONE</button>
        <button type="button" class="btn event-page__cta" data-event-action="screen"
          data-event-screen="diario">DIARIO</button>
      </nav></main>`;
  }

  // Parte 2 (c): carte di un altro evento (Halloween), permesse dal file (uses.cardsFrom): solo da vedere e schierare.
  function guests(tools) {
    const cards = tools.ownedCards({ from: "halloween2026" });
    const names = cards.slice(0, 6).map((card) => tools.escape(card.player?.name || card.playerId)).join(", ");
    return `<section class="event-page__panel" data-event-guests="halloween2026">
      <strong>Carte da Halloween: ${tools.escape(cards.length)}</strong>
      <small>${names || "Nessuna"}${cards.length > 6 ? "…" : ""} · si possono schierare in squadra</small>
    </section>`;
  }

  // Schermata di esempio: elenca le carte possedute dell'evento e salva un dato proprio (i timbri). Non consuma nulla.
  function diary(tools) {
    const cards = tools.ownedCards();
    const list = cards.map((card) => `<span class="event-page__chip" data-diary-card="${tools.escape(card.playerId)}">
        ${tools.escape(card.player?.name || card.playerId)}<small>${tools.escape(card.player?.category || "")}</small>
      </span>`).join("");
    const visits = tools.data().visits || 0;
    return `<main class="screen event-page event-page--prova" data-event-screen-name="diario">
      ${header(tools, "home", "Diario", "EVENTO DI PROVA · SCHERMATA PROPRIA")}
      <section class="event-page__panel"><p>Carte dell'evento che possiedi: ${tools.escape(cards.length)}.
        Timbri sul diario: <strong data-diary-visits>${tools.escape(visits)}</strong>.</p>
        <div class="event-page__chips">${list || "<p>Nessuna carta: apri il distributore.</p>"}</div>
        <button type="button" class="btn event-page__cta" data-diary-stamp>TIMBRA</button>
      </section></main>`;
  }
  function bindDiary(root, tools) {
    root.querySelector("[data-diary-stamp]")?.addEventListener("click", async () => {
      await tools.save((data) => ({ ...data, visits: Number(data.visits || 0) + 1 }));
      tools.toast("Diario timbrato");
      tools.go("diario");
    });
  }

  global.GameEvents?.extend?.("prova_dev", {
    home: { render: home },
    screens: { diario: { render: diary, bind: bindDiary } },
  });
})(globalThis);
