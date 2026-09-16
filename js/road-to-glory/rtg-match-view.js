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
      return `<div class="match-formation match-formation--${side} rtg-match-formation rtg-match-formation--${side}">
        ${rows.map((row) => `<div class="match-formation-line match-formation-line--${String(row.role).toLowerCase()} rtg-match-line" data-row-count="${row.players.length}" style="--players-in-row:${row.players.length || 1};--row-count:${row.players.length || 1}">
          ${row.players.map((player) => card(
            player,
            `data-rtg-field-player="${escape(pid(player))}" data-role="${escape(role(player))}" data-side="${side}"`,
            `run-tactical-card match-player-card match-player-card--${side} boss-match-card boss-match-card--${side} rtg-field-card`
          )).join("")}
        </div>`).join("")}
      </div>`;
    }

    function matchMarkup(match = {}) {
      return `<main class="screen rtg-match-shell boss-match-screen">
        <header class="topbar rtg-match-topbar">
          <div><p class="eyebrow">Road to Glory</p><strong class="brand">${escape(periodLabel(match.period))}</strong></div>
          <div class="rtg-match-score-main"><span>Tu</span><strong>${escape(match.score?.user || 0)} - ${escape(match.score?.opponent || 0)}</strong><span>CPU</span></div>
          <button type="button" class="btn btn-danger" data-rtg-abandon>Abbandona</button>
        </header>
        <div class="content rtg-match-content">
          <section class="panel rtg-static-field rtg-static-field--main">
            <div class="rtg-field-team-label rtg-field-team-label--opponent">Avversario</div>
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
      return `<section class="panel rtg-duel-card rtg-paper-modal development-squad-card-scope">
        <div class="rtg-duel-head"><div><p class="eyebrow">Duello</p><h2>${escape(pending.userBaseActionLabel || "Azione")}</h2></div><strong>${escape(probability.toFixed(1))}%</strong></div>
        <div class="progress-track rtg-probability"><span class="progress-bar" style="width:${Math.max(10, Math.min(90, probability))}%"></span></div>
        <div class="rtg-versus rtg-versus--cards">
          <article><small>Tu</small>${card(user, `data-rtg-duel-user="${escape(pid(user))}"`, "run-tactical-card match-player-card match-player-card--user squad-player-card rtg-duel-player-card")}</article>
          <b>VS</b>
          <article><small>Avversario</small>${card(opponent, `data-rtg-duel-opponent="${escape(pid(opponent))}"`, "run-tactical-card match-player-card match-player-card--opponent squad-player-card rtg-duel-player-card")}</article>
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
        <small>Scelta IA: <strong>${escape(resolution.aiChoiceLabel || "Azione base")}</strong></small>
        <h2>${resolution.userWon ? "Duello vinto!" : "Duello perso"}</h2>
        <p>Probabilità finale <strong>${escape(Number(resolution.probability || 50).toFixed(1))}%</strong></p>
      </section>`;
    }

    function halftimeMarkup(model = {}) {
      const lineup = model.lineup || [], bench = model.bench || [];
      return `<section class="panel rtg-halftime rtg-paper-modal development-squad-card-scope">
        <div class="modal-head"><div><p class="eyebrow">45° minuto</p><h2>Intervallo</h2><p class="muted">Come nella gestione squadra: seleziona due giocatori dello stesso ruolo. Le cariche delle mosse non si ricaricano.</p></div></div>
        <div class="rtg-halftime-grid">
          <div><h3>Campo</h3><div class="rtg-halftime-cards">${lineup.map((player) => card(player, `data-rtg-half-lineup="${escape(pid(player))}" data-role="${escape(role(player))}"`, "squad-player-card rtg-halftime-player-card")).join("")}</div></div>
          <div><h3>Panchina</h3><div class="rtg-halftime-cards">${bench.map((player) => card(player, `data-rtg-half-bench="${escape(pid(player))}" data-role="${escape(role(player))}"`, "squad-player-card rtg-halftime-player-card")).join("")}</div></div>
        </div>
        <button type="button" class="btn btn-yellow rtg-half-confirm" data-rtg-half-confirm>Conferma secondo tempo</button>
      </section>`;
    }

    function penaltyMarkup(match = {}, context = {}) {
      return `<section class="panel rtg-penalty-panel rtg-paper-modal">
        <p class="eyebrow">Decisione finale</p><h2>Rigori</h2><p class="muted">Scegli la direzione senza vedere la scelta avversaria.</p>
        <div class="rtg-penalty-directions">
          <button class="btn" data-rtg-penalty-direction="left">Sinistra</button>
          <button class="btn" data-rtg-penalty-direction="center">Centro</button>
          <button class="btn" data-rtg-penalty-direction="right">Destra</button>
        </div>
        ${context.canUseMove ? `<button type="button" class="btn btn-yellow rtg-penalty-move" data-rtg-penalty-move>Usa mossa</button>` : ""}
        <div class="rtg-shootout-score">${escape(match.shootout?.score?.user || 0)} - ${escape(match.shootout?.score?.opponent || 0)}</div>
      </section>`;
    }

    function resultMarkup(match = {}) {
      const won = match.result?.winner === "user";
      return `<section class="panel rtg-match-result rtg-paper-modal"><p class="eyebrow">Road to Glory</p><h2>${won ? "Vittoria!" : match.result?.winner ? "Sconfitta" : "Pareggio"}</h2><strong>${escape(match.score?.user || 0)} - ${escape(match.score?.opponent || 0)}</strong><button type="button" class="btn btn-yellow" data-rtg-result-continue>Continua</button></section>`;
    }

    function bind(root, actions = {}) {
      root?.querySelectorAll?.("[data-rtg-choice]")?.forEach((button) => button.addEventListener("click", () => actions.onEncounterChoice?.(button.dataset.rtgChoice)));
      root?.querySelector?.("[data-rtg-abandon]")?.addEventListener("click", () => actions.onAbandon?.());
      root?.querySelector?.("[data-rtg-half-confirm]")?.addEventListener("click", () => actions.onHalftimeConfirm?.());
      root?.querySelectorAll?.("[data-rtg-penalty-direction]")?.forEach((button) => button.addEventListener("click", () => actions.onPenaltyDirection?.(button.dataset.rtgPenaltyDirection)));
      root?.querySelector?.("[data-rtg-penalty-move]")?.addEventListener("click", () => actions.onPenaltyMove?.());
      root?.querySelector?.("[data-rtg-result-continue]")?.addEventListener("click", () => actions.onContinue?.());
    }

    return Object.freeze({ matchMarkup, encounterMarkup, resolvedEncounterMarkup, halftimeMarkup, penaltyMarkup, resultMarkup, bind });
  }

  global.RoadToGloryMatchView = Object.freeze({ create });
})(globalThis);
