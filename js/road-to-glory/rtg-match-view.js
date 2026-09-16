(function (global) {
  "use strict";

  function create(deps = {}) {
    const escape = deps.escapeHtml || ((value) => String(value ?? ""));
    const compactPlayerCardMarkup = deps.compactPlayerCardMarkup || null;
    const formationLayout = deps.formationLayout || global.FormationLayout || null;
    const formationById = deps.formationById || ((id) => global.SeasonRegistry?.database?.("ie1")?.formations?.eleven?.find?.((item) => String(item.id) === String(id)) || null);
    const pid = (player) => String(player?.playerId || player?.id || "");
    const role = (player) => String(player?.normalizedRole || player?.position || player?.role || "").toUpperCase();

    function fallbackCard(player, attrs = "", extraClass = "") {
      return `<button type="button" class="player-card player-card-compact tactical-player-card mini-player ${escape(extraClass)}" ${attrs}>
        <span class="player-corner player-role">${escape(role(player))}</span>
        <span class="player-corner player-overall">${escape(player?.overall ?? player?.finalOverall ?? "—")}</span>
        <div class="player-info"><div class="player-title"><strong>${escape(player?.name || pid(player))}</strong></div><div class="player-meta"><span>${escape(role(player))}</span><span>Lv 20</span></div></div>
        <span class="player-corner player-level">Lv 20</span>
      </button>`;
    }

    function card(player, attrs = "", extraClass = "") {
      if (compactPlayerCardMarkup) {
        return compactPlayerCardMarkup(player || {}, {
          level: 20,
          overall: player?.overall ?? player?.finalOverall ?? "—",
          dataAttr: attrs,
          extraClass,
          detailLayout: "stacked",
        });
      }
      return fallbackCard(player || {}, attrs, extraClass);
    }

    function periodLabel(period) {
      return ({
        first_half: "1° tempo",
        second_half: "2° tempo",
        extra_first: "1° suppl.",
        extra_second: "2° suppl.",
        halftime: "Intervallo",
      }[period] || "Partita");
    }

    function formationRows(formationId, players = []) {
      const formation = formationById(formationId) || { requirements: { FW:3, MF:3, DF:4, GK:1 } };
      const byRole = new Map(["FW","MF","DF","GK"].map((key) => [key, players.filter((player) => role(player) === key)]));
      const rows = formationLayout?.displayRows?.(formation) || [
        { role:"FW", count:Number(formation.requirements?.FW || 0) },
        { role:"MF", count:Number(formation.requirements?.MF || 0) },
        { role:"DF", count:Number(formation.requirements?.DF || 0) },
        { role:"GK", count:Number(formation.requirements?.GK || 0) },
      ];
      return rows.map((row) => ({
        ...row,
        players:(byRole.get(String(row.role).toUpperCase()) || []).splice(0, Number(row.count || 0)),
      })).filter((row) => row.players.length);
    }

    function fieldSide(squad, side) {
      const rows = formationRows(squad?.formationId, squad?.lineup || []);
      const visualSide = side === "opponent" ? "boss" : "user";
      return `<div class="match-formation match-formation--${side} rtg-match-formation rtg-match-formation--${side}">
        ${rows.map((row) => `<div class="match-formation-line match-formation-line--${String(row.role).toLowerCase()} rtg-match-line" data-row-count="${row.players.length}" style="--players-in-row:${row.players.length || 1};--row-count:${row.players.length || 1}">
          ${row.players.map((player) => card(
            player,
            `data-rtg-field-player="${escape(pid(player))}" data-role="${escape(role(player))}" data-side="${side}"`,
            `run-tactical-card match-player-card match-player-card--${visualSide} boss-match-card boss-match-card--${visualSide} rtg-field-card`
          )).join("")}
        </div>`).join("")}
      </div>`;
    }

    function matchPlayer(match, side, playerId) {
      const squad = side === "user" ? match?.userSquad : match?.opponentSquad;
      return [...(squad?.lineup || []), ...(squad?.bench || [])].find((player) => pid(player) === String(playerId || "")) || null;
    }

    function tickerEventMarkup(match, event = {}) {
      const actorSide = event.actorSide === "opponent" ? "opponent" : "user";
      const opponentSide = actorSide === "user" ? "opponent" : "user";
      const actor = matchPlayer(match, actorSide, event.actorPlayerId);
      const opponent = matchPlayer(match, opponentSide, event.opponentPlayerId);
      const actorName = actor?.name || event.actorPlayerId || "Giocatore";
      const opponentName = opponent?.name || event.opponentPlayerId || "Avversario";
      let copy = "";
      if (event.zone === "shot") {
        copy = event.actorWon ? `GOAL! ${actorName}` : `${opponentName} ferma ${actorName}`;
      } else if (event.zone === "attack") {
        copy = event.actorWon ? `${actorName} supera ${opponentName}` : `${opponentName} recupera palla`;
      } else {
        copy = event.actorWon ? `${actorName} vince il duello a centrocampo` : `${opponentName} conquista il possesso`;
      }
      const move = event.actorMove || event.opponentMove;
      return `<div class="rtg-ticker-event ${event.actorWon ? "is-success" : ""} ${event.manual ? "is-manual" : "is-auto"}"><span>${escape(event.minute ?? "—")}'</span><strong>${escape(copy)}</strong>${move ? `<em>${escape(move)}</em>` : ""}</div>`;
    }

    function tickerMarkup(match = {}) {
      const events = Array.from(match.log || []).slice(-3);
      return `<section class="rtg-match-ticker" aria-label="Ultime azioni"><div class="rtg-match-ticker-head"><small>Ultime azioni</small><span>${events.length ? "live" : "kick-off"}</span></div><div class="rtg-match-ticker-list">${events.length ? events.map((event) => tickerEventMarkup(match, event)).join("") : '<div class="rtg-ticker-empty">Formazioni pronte.</div>'}</div></section>`;
    }

    function formationAverage(squad = {}) {
      const players = squad?.lineup || [];
      if (!players.length) return 0;
      return Math.round(players.reduce((sum, player) => sum + (Number(player?.overall ?? player?.finalOverall) || 0), 0) / players.length);
    }

    function currentMinute(match = {}) {
      if (match.status === "penalties") return 120;
      if (match.status === "halftime" || match.period === "halftime") return 45;
      const pending = Number(match.pendingEncounter?.minute);
      if (Number.isFinite(pending)) return Math.max(0, Math.round(pending));
      const log = match.log || [];
      const last = Number(log[log.length - 1]?.minute);
      if (Number.isFinite(last)) return Math.max(0, Math.round(last));
      if (match.period === "extra_first" || match.period === "extra_second") {
        return 90 + Math.round((Math.min(6, Number(match.extraActionIndex) || 0) / 6) * 30);
      }
      return Math.round((Math.min(Number(match.actionTarget) || 0, Number(match.actionIndex) || 0) / Math.max(1, Number(match.actionTarget) || 1)) * 90);
    }

    function animateClock(root, fromMinute, toMinute, duration = 720) {
      const element = root?.querySelector?.("[data-rtg-match-minute]");
      if (!element) return;
      const from = Math.max(0, Number(fromMinute) || 0);
      const to = Math.max(from, Number(toMinute) || 0);
      const raf = global.requestAnimationFrame;
      if (typeof raf !== "function" || to <= from) {
        element.textContent = `${Math.round(to)}'`;
        return;
      }
      const started = Date.now();
      const frame = () => {
        const progress = Math.min(1, (Date.now() - started) / Math.max(120, duration));
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = `${Math.round(from + (to - from) * eased)}'`;
        if (progress < 1) raf(frame);
      };
      raf(frame);
    }

    function preMatchFormation(squad = {}, side = "user") {
      const rows = formationRows(squad?.formationId, squad?.lineup || []);
      return `<section class="rtg-prematch-team rtg-prematch-team--${side}">
        <div class="rtg-prematch-team-head">
          <div><small>${side === "user" ? "LA TUA SQUADRA" : "AVVERSARIO"}</small><strong>${escape(side === "user" ? "Road to Glory XI" : (squad?.name || "CPU"))}</strong></div>
          <span><b>${escape(squad?.formationId || "—")}</b><em>OVR ${escape(formationAverage(squad) || "—")}</em></span>
        </div>
        <div class="rtg-prematch-pitch">
          ${rows.map((row) => `<div class="rtg-prematch-row" style="--row-count:${Math.max(1,row.players.length)}">${row.players.map((player) => card(
            player,
            `data-rtg-prematch-player="${escape(pid(player))}" data-side="${side}"`,
            `squad-player-card rtg-prematch-player-card ${side === "opponent" ? "boss-match-card boss-match-card--boss" : ""}`
          )).join("")}</div>`).join("")}
        </div>
      </section>`;
    }

    function preMatchMarkup(match = {}) {
      return `<main class="screen boss-match-screen rtg-prematch-shell development-squad-card-scope">
        <header class="topbar rtg-prematch-topbar">
          <div><p class="eyebrow">Road to Glory</p><h1>Pre-partita</h1></div>
          <div class="rtg-prematch-vs"><strong>VS</strong><span>${escape(match.opponentSquad?.name || "Avversario")}</span></div>
        </header>
        <div class="content rtg-prematch-content">
          <div class="rtg-prematch-banner">
            <span>FORMAZIONI UFFICIALI</span>
            <strong>Controlla gli undici prima del calcio d'inizio</strong>
          </div>
          <div class="rtg-prematch-grid">
            ${preMatchFormation(match.userSquad, "user")}
            ${preMatchFormation(match.opponentSquad, "opponent")}
          </div>
          <button type="button" class="btn btn-yellow rtg-prematch-start" data-rtg-prematch-start>INIZIA PARTITA</button>
        </div>
      </main>`;
    }

    function matchMarkup(match = {}) {
      const opponentName = match.opponentSquad?.name || "CPU";
      const possessionLabel = match.possession === "user" ? "TU" : opponentName;
      const zoneLabel = ({ midfield:"Centrocampo", attack:"Attacco", shot:"Tiro" }[match.fieldZone] || "Centrocampo");
      const actionCurrent = Math.min(Number(match.actionTarget || 0), Number(match.actionIndex || 0) + 1);
      const minute = currentMinute(match);
      return `<main class="screen rtg-match-shell boss-match-screen">
        <header class="topbar rtg-match-topbar">
          <div class="rtg-match-period"><strong class="rtg-match-clock" data-rtg-match-minute>${escape(minute)}'</strong><span>${escape(periodLabel(match.period))}</span></div>
          <div class="rtg-match-score-main"><span>Tu</span><strong>${escape(match.score?.user || 0)} - ${escape(match.score?.opponent || 0)}</strong><span title="${escape(opponentName)}">${escape(opponentName)}</span></div>
          <button type="button" class="btn btn-danger rtg-abandon-button" data-rtg-abandon>Abbandona</button>
        </header>
        <div class="rtg-match-flowbar">
          <span><small>Possesso</small><strong>${escape(possessionLabel)}</strong></span>
          <span><small>Zona</small><strong>${escape(zoneLabel)}</strong></span>
          <span><small>Azione</small><strong>${escape(actionCurrent)} / ${escape(match.actionTarget || "—")}</strong></span>
        </div>
        ${tickerMarkup(match)}
        <div class="content rtg-match-content">
          <section class="panel rtg-static-field rtg-static-field--main">
            <div class="rtg-field-team-label rtg-field-team-label--opponent">${escape(opponentName)}</div>
            ${fieldSide(match.opponentSquad, "opponent")}
            <div class="rtg-field-midline"><span>VS</span></div>
            ${fieldSide(match.userSquad, "user")}
            <div class="rtg-field-team-label rtg-field-team-label--user">La tua squadra</div>
          </section>
        </div>
        <div class="rtg-match-overlay" data-rtg-match-overlay></div>
      </main>`;
    }

    function encounterMarkup(match = {}, preview = {}) {
      const pending = match.pendingEncounter || {};
      const user = preview.userPlayer || {};
      const opponent = preview.opponentPlayer || {};
      const key = `user:${String(pending.userPlayerId || "")}`;
      const uses = Number(match.moveUsesByPlayerId?.[key] || 0);
      const probability = Number(preview.probability ?? pending.normalPreviewProbability ?? 50);
      const userHasPossession = pending.actorSide === "user";
      return `<section class="panel rtg-duel-card rtg-paper-modal development-squad-card-scope">
        <div class="rtg-duel-head"><div><p class="eyebrow">${escape(currentMinute(match))}' · SCONTRO</p><h2>${escape(pending.userBaseActionLabel || "Azione")}</h2></div><strong>${escape(probability.toFixed(1))}%</strong></div>
        <div class="rtg-duel-context"><span>${userHasPossession ? "Hai il possesso" : "CPU in possesso"}</span><span>Scelta CPU nascosta</span></div>
        <div class="progress-track rtg-probability"><span class="progress-bar" style="width:${Math.max(10, Math.min(90, probability))}%"></span></div>
        <div class="rtg-versus rtg-versus--cards">
          <article><small>Tu</small>${card(user, `data-rtg-duel-user="${escape(pid(user))}"`, "run-tactical-card match-player-card match-player-card--user squad-player-card rtg-duel-player-card")}</article>
          <b>VS</b>
          <article><small>Avversario</small>${card(opponent, `data-rtg-duel-opponent="${escape(pid(opponent))}"`, "run-tactical-card match-player-card match-player-card--boss boss-match-card boss-match-card--boss squad-player-card rtg-duel-player-card")}</article>
        </div>
        <div class="button-row rtg-duel-actions">
          <button type="button" class="btn btn-yellow rtg-action-button" data-rtg-choice="base">${escape(pending.userBaseActionLabel || "Azione")}</button>
          ${pending.userMove && uses > 0 ? `<button type="button" class="btn rtg-action-button rtg-action-button--move" data-rtg-choice="move"><strong>${escape(pending.userMove.name)}</strong><small>${escape(uses)}/2 · Power ${escape(pending.userMove.power || "—")}</small></button>` : ""}
        </div>
      </section>`;
    }

    function resolvedEncounterMarkup(resolution = {}) {
      return `<section class="panel rtg-duel-card rtg-duel-result rtg-paper-modal">
        <p class="eyebrow">Esito duello</p>
        <h2>${resolution.userWon ? "Duello vinto!" : "Duello perso"}</h2>
        ${resolution.outcomeLabel ? `<div class="rtg-duel-consequence">${escape(resolution.outcomeLabel)}</div>` : ""}
        <div class="rtg-duel-summary">
          <div><small>Tu</small><strong>${escape(resolution.userPlayerName || "La tua squadra")}</strong><span>${escape(resolution.userChoiceLabel || "Azione base")}</span></div>
          <b>VS</b>
          <div><small>CPU</small><strong>${escape(resolution.aiPlayerName || "Avversario")}</strong><span>${escape(resolution.aiChoiceLabel || "Azione base")}</span></div>
        </div>
        <p class="rtg-final-probability">Probabilità finale <strong>${escape(Number(resolution.probability || 50).toFixed(1))}%</strong></p>
        <button type="button" class="btn btn-yellow rtg-duel-continue" data-rtg-duel-continue>Continua</button>
      </section>`;
    }

    function halftimeMarkup(model = {}, options = {}) {
      const lineup = model.lineup || [], bench = model.bench || [];
      const selectedId = String(options.selectedPlayerId || "");
      const selected = lineup.find((player) => pid(player) === selectedId) || null;
      const selectedRole = selected ? role(selected) : "";
      const compatibleBench = selected ? bench.filter((player) => role(player) === selectedRole) : [];
      const rows = formationRows(model.formationId, lineup);
      return `<section class="panel rtg-halftime rtg-paper-modal development-squad-card-scope">
        <div class="rtg-halftime-head">
          <div><p class="eyebrow">45' · INTERVALLO</p><h2>Formazione</h2><p class="muted">Controlla il campo. Tocca un titolare e poi una riserva dello stesso ruolo per effettuare il cambio.</p></div>
          <strong>45:00</strong>
        </div>
        <div class="rtg-halftime-layout">
          <section class="rtg-halftime-field-panel">
            <div class="rtg-halftime-section-title"><span>IN CAMPO</span><b>${escape(model.formationId || "—")}</b></div>
            <div class="rtg-halftime-pitch">
              ${rows.map((row) => `<div class="rtg-halftime-pitch-row" style="--row-count:${Math.max(1,row.players.length)}">${row.players.map((player) => card(
                player,
                `data-rtg-half-lineup="${escape(pid(player))}" data-role="${escape(role(player))}" aria-pressed="${pid(player)===selectedId?"true":"false"}"`,
                `squad-player-card rtg-halftime-player-card ${pid(player)===selectedId?"selected":""}`
              )).join("")}</div>`).join("")}
            </div>
          </section>
          <aside class="rtg-halftime-bench-panel">
            <div class="rtg-halftime-section-title"><span>PANCHINA</span><b>4</b></div>
            <div class="rtg-halftime-bench-strip">
              ${bench.map((player) => {
                const compatible = !!selected && role(player) === selectedRole;
                const attrs = [
                  `data-rtg-half-bench-player="${escape(pid(player))}"`,
                  `data-role="${escape(role(player))}"`,
                  compatible ? `data-rtg-half-bench="${escape(pid(player))}"` : "",
                  compatible ? 'aria-disabled="false"' : 'aria-disabled="true"',
                ].filter(Boolean).join(" ");
                return card(player, attrs, `squad-player-card rtg-halftime-player-card ${selected && !compatible ? "is-incompatible" : compatible ? "is-compatible" : ""}`);
              }).join("")}
            </div>
            <div class="rtg-halftime-change-box">
              ${selected ? `<p class="eyebrow">CAMBIO SELEZIONATO</p><strong>${escape(selected.name || selectedId)} · ${escape(selectedRole)}</strong><span>${compatibleBench.length ? `${compatibleBench.length} riserve compatibili evidenziate` : "Nessuna riserva compatibile"}</span>` : '<strong>Seleziona un titolare sul campo</strong><span>Le riserve compatibili verranno evidenziate.</span>'}
            </div>
          </aside>
        </div>
        <button type="button" class="btn btn-yellow rtg-half-confirm" data-rtg-half-confirm>CONFERMA SECONDO TEMPO</button>
      </section>`;
    }

    function penaltyMarkup(match = {}, context = {}) {
      const history = match.shootout?.history || [];
      const row = (side) => {
        const kicks = history.filter((item) => item.attackingSide === side);
        const slots = Math.max(5, kicks.length + (match.shootout?.status === "sudden-death" ? 1 : 0));
        return Array.from({ length: slots }, (_, index) => {
          const item = kicks[index];
          const state = !item ? "pending" : item.outcome === "goal" ? "goal" : "save";
          const label = !item ? "•" : item.outcome === "goal" ? "✓" : "✕";
          return `<span class="rtg-penalty-dot rtg-penalty-dot--${state}" aria-label="${state}">${label}</span>`;
        }).join("");
      };
      const last = history.at?.(-1) || history[history.length - 1] || null;
      const currentKick = Number(match.shootout?.kicks?.[context.attackingSide] || 0) + 1;
      const userAttacks = context.attackingSide === "user";
      const moveLabel = context.userMove?.name || (context.userRole === "save" ? "Mossa di parata" : "Mossa di tiro");
      const moveAvailable = context.userMoveAvailable ?? context.canUseMove ?? false;
      return `<section class="panel rtg-penalty-panel rtg-paper-modal development-squad-card-scope">
        <div class="rtg-penalty-head">
          <div><p class="eyebrow">Decisione finale</p><h2>Rigori</h2><p class="muted">${userAttacks ? "Sei al tiro" : "Sei in porta"} · Rigore ${escape(currentKick)}${match.shootout?.status === "sudden-death" ? " · Sudden death" : " di 5"}</p></div>
          <strong class="rtg-penalty-score">${escape(match.shootout?.score?.user || 0)} - ${escape(match.shootout?.score?.opponent || 0)}</strong>
        </div>
        <div class="rtg-penalty-history">
          <div><b>TU</b><span>${row("user")}</span></div>
          <div><b>CPU</b><span>${row("opponent")}</span></div>
        </div>
        ${last ? `<div class="rtg-penalty-last ${last.outcome === "goal" ? "is-goal" : "is-save"}"><strong>${last.outcome === "goal" ? "GOAL" : "PARATA"}</strong><span>Ultimo rigore</span></div>` : ""}
        <div class="rtg-penalty-versus">
          <article><small>Tiratore</small>${card(context.shooter || {}, `data-rtg-penalty-shooter="${escape(pid(context.shooter))}"`, "squad-player-card rtg-penalty-player-card")}</article>
          <b>VS</b>
          <article><small>Portiere</small>${card(context.keeper || {}, `data-rtg-penalty-keeper="${escape(pid(context.keeper))}"`, "squad-player-card rtg-penalty-player-card")}</article>
        </div>
        <p class="rtg-penalty-instruction">${userAttacks ? "Scegli dove tirare." : "Scegli dove tuffarti."} La CPU decide senza vedere la tua scelta.</p>
        <div class="rtg-penalty-directions">
          <button class="btn" data-rtg-penalty-direction="left">← Sinistra</button>
          <button class="btn" data-rtg-penalty-direction="center">Centro</button>
          <button class="btn" data-rtg-penalty-direction="right">Destra →</button>
        </div>
        ${moveAvailable ? `<button type="button" class="btn btn-yellow rtg-penalty-move" data-rtg-penalty-move><strong>${escape(moveLabel)}</strong><small>${escape(context.userMoveUses || 0)}/2 usi rimasti</small></button>` : ""}
      </section>`;
    }

    function resultMarkup(match = {}) {
      const won = match.result?.winner === "user";
      return `<section class="panel rtg-match-result rtg-paper-modal"><p class="eyebrow">Road to Glory</p><h2>${won ? "Vittoria!" : match.result?.winner ? "Sconfitta" : "Pareggio"}</h2><strong>${escape(match.score?.user || 0)} - ${escape(match.score?.opponent || 0)}</strong><button type="button" class="btn btn-yellow" data-rtg-result-continue>Continua</button></section>`;
    }

    function bind(root, actions = {}) {
      root?.querySelector?.("[data-rtg-prematch-start]")?.addEventListener("click", () => actions.onPreMatchStart?.());
      root?.querySelectorAll?.("[data-rtg-choice]")?.forEach((button) => button.addEventListener("click", () => actions.onEncounterChoice?.(button.dataset.rtgChoice)));
      root?.querySelector?.("[data-rtg-abandon]")?.addEventListener("click", () => actions.onAbandon?.());
      root?.querySelector?.("[data-rtg-half-confirm]")?.addEventListener("click", () => actions.onHalftimeConfirm?.());
      root?.querySelectorAll?.("[data-rtg-penalty-direction]")?.forEach((button) => button.addEventListener("click", () => actions.onPenaltyDirection?.(button.dataset.rtgPenaltyDirection)));
      root?.querySelector?.("[data-rtg-penalty-move]")?.addEventListener("click", () => actions.onPenaltyMove?.());
      root?.querySelector?.("[data-rtg-result-continue]")?.addEventListener("click", () => actions.onContinue?.());
    }

    return Object.freeze({ preMatchMarkup, matchMarkup, encounterMarkup, resolvedEncounterMarkup, halftimeMarkup, penaltyMarkup, resultMarkup, currentMinute, animateClock, bind });
  }

  global.RoadToGloryMatchView = Object.freeze({ create });
})(globalThis);
