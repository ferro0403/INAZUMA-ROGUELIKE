// Home Vento-Fuoco; classi delle carte per squadra. Nessun dato scritto su cloud.
(function (global) {
  "use strict";
  const ID = "vento_fuoco_dev";
  const manifest = global.GameEvents?.get?.(ID);
  const teamByPlayer = new Map((manifest?.cards || []).map(card => [String(card.playerId), card.teamId]));
  function playerClass(player) {
    if (!player) return "";
    const pid = String(player.playerId || player.id || "").trim() ||
      String(player.cardId || "").split("::").at(-1);
    const teamId = teamByPlayer.get(pid);
    return teamId ? "rtg-element-" + teamId : "";
  }
  const teamStyle = team => Object.entries(team.colors || {})
    .filter(([key, value]) => /^[a-z]+$/.test(key) && /^#[0-9a-f]{6}$/i.test(value))
    .map(([key, value]) => "--event-" + key + ":" + value).join(";");
  function home(tools) {
    const teams = tools.teams();
    const fire = teams.find(team => team.teamId === "fire-team");
    const wind = teams.find(team => team.teamId === "blizzard-team");
    if (!fire || !wind) return "";
    const open = tools.isOpen();
    const challenge = team => `<article class="event-page__panel event-page__team" style="${tools.escape(teamStyle(team))}">
      <img src="${tools.escape(team.logo)}" alt="Stemma ${tools.escape(team.name)}" loading="lazy">
      <div><strong>${tools.escape(team.name)}</strong><small>Vittoria: ${tools.coin(300,team.teamId==="fire-team"?"fuoco_stemmi":"vento_stemmi")}</small>
        <small>Fortunata 20%: 600 stemmi</small></div>
      <button type="button" class="btn event-page__cta" data-event-action="start" data-event-team="${tools.escape(team.teamId)}"
        ${open?"":"disabled"}>SFIDA</button></article>`;
    return `<main class="screen event-page event-page--vento-fuoco" data-event-extra="${ID}">
      <header class="event-page__top"><button type="button" class="btn event-page__back" data-event-action="exit"
        aria-label="Esci dall'evento">←</button>
        <div class="event-page__titles"><small>EVENTO LIMITATO · DEV</small><h1>Vento e Fuoco</h1></div>
        <div class="event-page__wallet">${tools.wallet()}</div></header>
      <section class="event-page__panel vf-clash" aria-label="Scontro tra Vento e Fuoco">
        <small>GLI ELEMENTI SI SCONTRANO</small><strong>🔥 FUOCO <span>VS</span> ❄️ VENTO</strong>
        <small>${open?"TEMPO RIMASTO · "+tools.escape(tools.countdown()):"EVENTO NON DISPONIBILE"}</small>
      </section>
      <section class="event-page__grid" aria-label="Sfide evento">${challenge(fire)}${challenge(wind)}</section>
      <nav class="event-page__actions" aria-label="Azioni evento">
        <button type="button" class="btn event-page__cta" data-event-action="pull" ${open?"":"disabled"}>🎰 DISTRIBUTORI</button>
        <button type="button" class="btn" data-event-action="squad">⚽ SQUADRA</button>
        <button type="button" class="btn" data-event-action="album">📖 ALBUM EVENTO</button>
      </nav>
      <section class="event-page__panel"><small>1 ESTRAZIONE · 200 STEMMI</small>
        <p>Due distributori: ciascuno usa soltanto i propri stemmi e contiene 19 giocatori.
          Aiden, Torch, Shawn e Gazelle hanno peso 1, gli altri peso 3.</p>
        <p>Allenatori 4818 e 4602: poteri in definizione. Miximax arriverà dopo.</p>
      </section>
    </main>`;
  }
  global.GameEvents?.extend?.(ID, {
    classes: playerClass,
    home: { render: home }
  });
})(globalThis);
