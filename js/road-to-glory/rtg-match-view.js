(function (global) {
  "use strict";

  function create(deps = {}) {
    const escape = deps.escapeHtml || ((value) => String(value ?? ""));
    const compactPlayerCardMarkup = deps.compactPlayerCardMarkup || null;
    const matchFormationCardMarkup = deps.matchFormationCardMarkup || null;
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

    function sharedMatchCard(player, side = "user", attrs = "", extraClass = "") {
      const visualSide = side === "opponent" ? "boss" : "user";
      if (matchFormationCardMarkup) {
        let markup = String(matchFormationCardMarkup(player || {}, {
          side: visualSide,
          readonly: true,
          showEquipment: false,
        }) || "");
        if (attrs) markup = markup.replace(/<button\b/, `<button ${attrs}`);
        if (extraClass) markup = markup.replace(/class="/, `class="${escape(extraClass)} `);
        return markup;
      }
      return card(
        player,
        attrs,
        `run-tactical-card match-player-card match-player-card--${visualSide} boss-match-card boss-match-card--${visualSide} squad-player-card ${extraClass}`
      );
    }

    function duelVisualUrl(player = {}) {
      return String(
        player?.frontFullbodyUrl ||
        player?.frontFullBodyUrl ||
        player?.frontFullbody ||
        player?.fullbodyUrl ||
        player?.fullBodyUrl ||
        player?.portraitUrl ||
        player?.imageUrl ||
        player?.photoUrl ||
        ""
      );
    }

    function duelVisualMarkup(player = {}, side = "user", attrs = "") {
      const name = player?.name || pid(player) || (side === "user" ? "Tu" : "Avversario");
      const visual = duelVisualUrl(player);
      const playerRole = role(player) || "—";
      const overall = player?.overall ?? player?.finalOverall ?? "—";
      return `<button type="button" class="rtg-duel-visual rtg-duel-visual--${escape(side)}" ${attrs}>
        <span class="rtg-duel-render">${visual ? `<img src="${escape(visual)}" alt="${escape(name)}" loading="eager" />` : `<i aria-hidden="true">${escape(String(name).slice(0,1).toUpperCase())}</i>`}</span>
        <span class="rtg-duel-player-copy"><small>${escape(playerRole)} · OVR ${escape(overall)}</small><strong>${escape(name)}</strong></span>
      </button>`;
    }

    function duelTypeLabel(pending = {}) {
      const kind = String(pending.userKind || "").toLowerCase();
      if (kind === "shot") return "TIRO VS PARATA";
      if (kind === "save") return "PARATA VS TIRO";
      if (kind === "dribble") return "DRIBBLING VS DIFESA";
      if (kind === "defense") return "DIFESA VS DRIBBLING";
      const action = String(pending.userBaseActionLabel || "").toLowerCase();
      if (action.includes("tiro")) return "TIRO VS PARATA";
      if (action.includes("parata")) return "PARATA VS TIRO";
      if (action.includes("difesa")) return "DIFESA VS DRIBBLING";
      if (action.includes("drib")) return "DRIBBLING VS DIFESA";
      return "DUELLO A CENTROCAMPO";
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

    function tickerEventMarkup(match, event = {}, isLatest = false) {
      const actorSide = event.actorSide === "opponent" ? "opponent" : "user";
      const opponentSide = actorSide === "user" ? "opponent" : "user";
      const actor = matchPlayer(match, actorSide, event.actorPlayerId);
      const opponent = matchPlayer(match, opponentSide, event.opponentPlayerId);
      const actorName = actor?.name || event.actorPlayerId || "Giocatore";
      const opponentName = opponent?.name || event.opponentPlayerId || "Avversario";
      let copy = "";
      const eventKind = event.kind || (event.zone === "shot" ? "shot" : event.zone === "attack" ? "dribble" : "midfield");
      if (eventKind === "shot") {
        copy = event.actorWon ? `GOAL! ${actorName}` : `${opponentName} ferma ${actorName}`;
      } else if (eventKind === "dribble") {
        copy = event.actorWon ? `${actorName} supera ${opponentName}` : `${opponentName} recupera palla`;
      } else {
        copy = event.actorWon ? `${actorName} vince il duello a centrocampo` : `${opponentName} conquista il possesso`;
      }
      const move = event.actorMove || event.opponentMove;
      return `<div class="rtg-ticker-event ${isLatest ? "is-latest" : ""} ${event.actorWon ? "is-success" : ""} ${event.manual ? "is-manual" : "is-auto"}"><span>${escape(event.minute ?? "—")}'</span><strong>${escape(copy)}</strong>${move ? `<em>${escape(move)}</em>` : ""}</div>`;
    }

    function tickerMarkup(match = {}) {
      const events = Array.from(match.log || []).slice(-3);
      return `<section class="rtg-match-ticker" aria-label="Ultime azioni"><div class="rtg-match-ticker-head"><small>Riepilogo azioni</small><span>${events.length ? "live" : "kick-off"}</span></div><div class="rtg-match-ticker-list">${events.length ? events.map((event,index) => tickerEventMarkup(match, event, index === events.length - 1)).join("") : '<div class="rtg-ticker-empty">Formazioni pronte.</div>'}</div></section>`;
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
      const teamLabel = side === "user" ? "TU" : (squad?.name || "Avversario");
      return `<section class="rtg-prematch-team rtg-prematch-team--${side}">
        <div class="rtg-prematch-team-head">
          <strong>${escape(teamLabel)}</strong>
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

    function formationPitchMarkup(squad = {}, side = "user", mode = "prematch", latest = null) {
      const rows = formationRows(squad?.formationId, squad?.lineup || []);
      const visualSide = side === "opponent" ? "boss" : "user";
      const playerAttr = mode === "prematch" ? "data-rtg-prematch-player" : "data-rtg-field-player";
      const pitchClass = mode === "prematch" ? "rtg-prematch-single-pitch" : "rtg-live-pitch";
      return `<div class="${pitchClass} rtg-shared-match-pitch" data-side="${escape(side)}">
        <div class="boss-match-field-side boss-match-field-side--${visualSide} boss-match-field-side--mobile rtg-shared-match-side" data-rtg-shared-side="${escape(side)}">
          ${rows.map((row) => `<div class="match-formation-line match-formation-line--${escape(String(row.role||"").toLowerCase())} boss-match-line boss-match-line--${escape(String(row.role||"").toLowerCase())} rtg-shared-match-line" data-row-count="${row.players.length}" style="--players-in-row:${row.players.length||1};--row-count:${row.players.length||1};--boss-row-count:${row.players.length||1}">${row.players.map((player) => {
            const currentId = pid(player);
            const latestClass = latest?.actorId === currentId ? "is-latest-actor" : latest?.opponentId === currentId ? "is-latest-opponent" : "";
            return sharedMatchCard(
              player,
              side,
              `${playerAttr}="${escape(currentId)}" data-side="${escape(side)}"`,
              `squad-player-card rtg-shared-match-card ${latestClass}`
            );
          }).join("")}</div>`).join("")}
        </div>
      </div>`;
    }

    function matchupTeamMarkup(squad = {}, side = "user") {
      const label = side === "user" ? "LA TUA SQUADRA" : (squad?.name || "AVVERSARIO");
      return `<article class="rtg-matchup-team rtg-matchup-team--${escape(side)}">
        <small>${escape(side === "user" ? "TU" : "AVVERSARIO")}</small>
        <strong>${escape(label)}</strong>
        <span><b>${escape(squad?.formationId || "—")}</b><em>OVR ${escape(formationAverage(squad) || "—")}</em></span>
      </article>`;
    }

    function inferredUserKind(pending = {}) {
      const direct=String(pending.userKind||"").toLowerCase();
      if(["shot","save","defense","dribble","midfield"].includes(direct))return direct;
      const label=String(pending.userBaseActionLabel||"").toLowerCase();
      if(label.includes("tiro")||label.includes("tira"))return "shot";
      if(label.includes("parata")||label.includes("para"))return "save";
      if(label.includes("difesa")||label.includes("difend"))return "defense";
      if(label.includes("drib"))return "dribble";
      if(String(pending.kind||"").toLowerCase()==="shot")return pending.actorSide==="user"?"shot":"save";
      if(String(pending.kind||"").toLowerCase()==="dribble")return pending.actorSide==="user"?"dribble":"defense";
      return pending.actorSide==="user"?"midfield":"defense";
    }

    function counterpartKind(kind) {
      return ({shot:"save",save:"shot",defense:"dribble",dribble:"defense",midfield:"midfield"})[String(kind||"").toLowerCase()]||"midfield";
    }

    function actionVerb(kind) {
      const key = String(kind || "").toLowerCase();
      if (key === "shot") return "tira";
      if (key === "save") return "prova la parata";
      if (key === "defense") return "difende";
      if (key === "dribble") return "prova il dribbling";
      if (key === "midfield") return "contrasta";
      return "contrasta";
    }

    function actionCallout(pending = {}, user = {}, opponent = {}) {
      const userName = user?.name || "Il tuo giocatore";
      const opponentName = opponent?.name || "L'avversario";
      const userKind=inferredUserKind(pending);
      const aiKind=String(pending.aiKind||counterpartKind(userKind)).toLowerCase();
      const bothMidfield=userKind==="midfield"&&aiKind==="midfield";
      if(bothMidfield){
        const userActs=pending.actorSide==="user";
        return userActs
          ? { user:`${userName} prova a conquistare palla`, opponent:`${opponentName} contrasta` }
          : { user:`${userName} contrasta`, opponent:`${opponentName} prova a conquistare palla` };
      }
      if(userKind===aiKind){
        const userActs=pending.actorSide==="user";
        return userActs
          ? { user:`${userName} ${actionVerb(userKind)}`, opponent:`${opponentName} contrasta` }
          : { user:`${userName} contrasta`, opponent:`${opponentName} ${actionVerb(aiKind)}` };
      }
      return {
        user: `${userName} ${actionVerb(userKind)}`,
        opponent: `${opponentName} ${actionVerb(aiKind)}`,
      };
    }

    function previewProbability(pending = {}, user = {}, opponent = {}, choice = "base") {
      const userIsActor = pending.userSide ? pending.userSide === pending.actorSide : pending.actorSide !== "opponent";
      const userKind=inferredUserKind(pending);
      const aiKind=String(pending.aiKind||counterpartKind(userKind)).toLowerCase();
      const actorKind=String(pending.actorKind||(userIsActor?userKind:aiKind)).toLowerCase();
      const opponentKind=String(pending.opponentKind||(userIsActor?aiKind:userKind)).toLowerCase();
      const userMove = choice === "move" ? pending.userMove : null;
      const runtime = global.RoadToGloryEncounterRuntime;
      if (!runtime?.probability) {
        const actorProbability = Number(pending.normalPreviewProbability ?? 50);
        return Math.max(0,Math.min(100,userIsActor ? actorProbability : 100-actorProbability));
      }
      const actor = userIsActor ? user : opponent;
      const defender = userIsActor ? opponent : user;
      const result = runtime.probability({
        actor,
        opponent:defender,
        actorKind,
        opponentKind,
        actorMove:userIsActor ? userMove : null,
        opponentMove:userIsActor ? null : userMove,
      });
      const actorProbability = Number(result?.probability ?? pending.normalPreviewProbability ?? 50);
      return Math.max(0,Math.min(100,userIsActor ? actorProbability : 100-actorProbability));
    }

    function choiceVerb(kind) {
      return ({shot:"TIRA",save:"PARA",defense:"DIFENDI",dribble:"DRIBBLA",midfield:"CONTRASTA"})[String(kind||"").toLowerCase()] || "GIOCA";
    }

    function resultHeadline(resolution = {}, user = {}, opponent = {}) {
      const userName = user?.name || resolution.userPlayerName || "Il tuo giocatore";
      const opponentName = opponent?.name || resolution.aiPlayerName || "L'avversario";
      const kind = String(resolution.userKind || "").toLowerCase();
      if (kind === "shot") return resolution.userWon ? `${userName} segna!` : `${opponentName} ferma il tiro di ${userName}`;
      if (kind === "save") return resolution.userWon ? `${userName} para!` : `${opponentName} segna`;
      if (kind === "defense") return resolution.userWon ? `${userName} recupera palla` : `${opponentName} supera ${userName}`;
      if (kind === "dribble") return resolution.userWon ? `${userName} supera ${opponentName}` : `${opponentName} ferma ${userName}`;
      return resolution.userWon ? `${userName} conquista il possesso` : `${opponentName} conquista il possesso`;
    }

    function preMatchMarkup(match = {}) {
      const opponentName = match.opponentSquad?.name || "Avversario";
      return `<main class="screen boss-match-screen rtg-prematch-shell rtg-prematch-revolution development-squad-card-scope">
        <header class="topbar rtg-prematch-topbar">
          <div class="rtg-prematch-title"><small>ROAD TO GLORY · SEASON 1</small><h1>Pre-partita</h1></div>
          <div class="rtg-prematch-top-vs"><span>VS</span><strong>${escape(opponentName)}</strong></div>
        </header>
        <div class="content rtg-prematch-content">
          <section class="rtg-prematch-matchup">
            ${matchupTeamMarkup(match.userSquad,"user")}
            <div class="rtg-matchup-vs"><span>VS</span></div>
            ${matchupTeamMarkup(match.opponentSquad,"opponent")}
          </section>
          <section class="rtg-prematch-tactical">
            <div class="rtg-prematch-tabs" role="tablist" aria-label="Formazioni">
              <button type="button" class="active" data-rtg-prematch-tab="user" aria-selected="true">LA TUA SQUADRA <b>${escape(match.userSquad?.formationId || "—")}</b></button>
              <button type="button" data-rtg-prematch-tab="opponent" aria-selected="false">${escape(opponentName)} <b>${escape(match.opponentSquad?.formationId || "—")}</b></button>
            </div>
            <div class="rtg-prematch-field-wrap">
              <div data-rtg-prematch-field="user">${formationPitchMarkup(match.userSquad,"user","prematch")}</div>
              <div data-rtg-prematch-field="opponent" hidden>${formationPitchMarkup(match.opponentSquad,"opponent","prematch")}</div>
            </div>
          </section>
          <button type="button" class="btn btn-yellow rtg-prematch-start" data-rtg-prematch-start>
            <span class="rtg-prematch-start-icon" aria-hidden="true">▶</span>
            <span><small>TUTTO PRONTO</small><strong>INIZIA PARTITA</strong></span>
            <b aria-hidden="true">›</b>
          </button>
        </div>
      </main>`;
    }

    function matchMarkup(match = {}) {
      const opponentName = match.opponentSquad?.name || "CPU";
      const possessionLabel = match.possession === "user" ? "La tua squadra" : opponentName;
      const zoneLabel = ({ midfield:"Centrocampo", attack:"Tre quarti", shot:"Zona tiro" }[match.fieldZone] || "Centrocampo");
      const minute = currentMinute(match);
      const phaseLabel = match.pendingEncounter ? "Scontro in arrivo" : "Palla in gioco";
      const activeSide = match.possession === "opponent" ? "opponent" : "user";
      const last = (match.log || []).at?.(-1) || (match.log || [])[Math.max(0,(match.log||[]).length-1)] || null;
      const latestFor = (side) => {
        if (!last) return null;
        const actorSide = last.actorSide === "opponent" ? "opponent" : "user";
        const opponentSide = actorSide === "user" ? "opponent" : "user";
        return {
          actorId: actorSide === side ? String(last.actorPlayerId||"") : "",
          opponentId: opponentSide === side ? String(last.opponentPlayerId||"") : "",
        };
      };
      return `<main class="screen rtg-match-shell rtg-match-polish-v2 rtg-match-revolution boss-match-screen development-squad-card-scope">
        <header class="topbar rtg-match-topbar">
          <div class="rtg-match-period"><strong class="rtg-match-clock" data-rtg-match-minute>${escape(minute)}'</strong><span>${escape(periodLabel(match.period))}</span></div>
          <div class="rtg-match-score-main"><span>Tu</span><strong>${escape(match.score?.user || 0)} - ${escape(match.score?.opponent || 0)}</strong><span title="${escape(opponentName)}">${escape(opponentName)}</span></div>
          <button type="button" class="btn btn-danger rtg-abandon-button" data-rtg-abandon>Abbandona</button>
        </header>
        <section class="rtg-live-status">
          <div class="rtg-live-ball-state"><i aria-hidden="true"></i><span><small>POSSESSO</small><strong>${escape(possessionLabel)}</strong></span></div>
          <div><small>ZONA</small><strong>${escape(zoneLabel)}</strong></div>
          <div><small>STATO</small><strong>${escape(phaseLabel)}</strong></div>
        </section>
        ${tickerMarkup(match)}
        <div class="content rtg-match-content">
          <section class="rtg-live-formation-panel">
            <div class="rtg-live-team-tabs" role="tablist" aria-label="Formazioni in campo">
              <button type="button" class="${activeSide==="user"?"active":""}" data-rtg-live-tab="user" aria-selected="${activeSide==="user"?"true":"false"}"><span>LA TUA SQUADRA</span><b>${escape(match.userSquad?.formationId||"—")}</b>${match.possession==="user"?'<i>●</i>':""}</button>
              <button type="button" class="${activeSide==="opponent"?"active":""}" data-rtg-live-tab="opponent" aria-selected="${activeSide==="opponent"?"true":"false"}"><span>${escape(opponentName)}</span><b>${escape(match.opponentSquad?.formationId||"—")}</b>${match.possession==="opponent"?'<i>●</i>':""}</button>
            </div>
            <div class="rtg-live-field-wrap">
              <div data-rtg-live-field="user" ${activeSide==="user"?"":"hidden"}>${formationPitchMarkup(match.userSquad,"user","live",latestFor("user"))}</div>
              <div data-rtg-live-field="opponent" ${activeSide==="opponent"?"":"hidden"}>${formationPitchMarkup(match.opponentSquad,"opponent","live",latestFor("opponent"))}</div>
            </div>
          </section>
        </div>
        <div class="rtg-match-overlay" data-rtg-match-overlay></div>
      </main>`;
    }

    function encounterMarkup(match = {}, preview = {}) {
      const pending = match.pendingEncounter || {};
      const user = preview.userPlayer || {};
      const opponent = preview.opponentPlayer || {};
      const selectedChoice = ["base","move"].includes(String(preview.selectedChoice||"")) ? String(preview.selectedChoice) : "";
      const key = `user:${String(pending.userPlayerId || "")}`;
      const uses = Number(match.moveUsesByPlayerId?.[key] || 0);
      const baseProbability = previewProbability(pending,user,opponent,"base");
      const moveProbability = pending.userMove && uses > 0 ? previewProbability(pending,user,opponent,"move") : null;
      const selectedProbability = selectedChoice === "move" && moveProbability != null ? moveProbability : baseProbability;
      const opponentProbability = Math.max(0,100-selectedProbability);
      const moveDelta = moveProbability == null ? 0 : moveProbability-baseProbability;
      const userHasPossession = pending.actorSide === "user";
      const opponentName = match.opponentSquad?.name || "CPU";
      const possessionText = userHasPossession ? "TU HAI PALLA" : `${opponentName} HA PALLA`;
      const possessionClass = userHasPossession ? "is-user" : "is-opponent";
      const callout = actionCallout(pending,user,opponent);
      const baseVerb = choiceVerb(inferredUserKind(pending));
      const selectedLabel = selectedChoice === "move" ? (pending.userMove?.name || "Mossa") : selectedChoice === "base" ? baseVerb : "AZIONE BASE";
      const choiceCard = (choice,label,sub,probability,delta=0,disabled=false) => {
        const selected = selectedChoice === choice;
        const deltaText = delta > 0.05 ? `+${delta.toFixed(1)}%` : delta < -0.05 ? `${delta.toFixed(1)}%` : "BASE";
        return `<button type="button" class="rtg-duel-choice-card ${choice==="move"?"is-move":"is-base"} ${selected?"is-selected":""}" data-rtg-choice="${choice}" ${disabled?"disabled":""}>
          <span class="rtg-choice-icon" aria-hidden="true">${choice==="move"?"⚡":"●"}</span>
          <span class="rtg-choice-copy"><small>${choice==="move"?"MOSSA SPECIALE":"AZIONE BASE"}</small><strong>${escape(label)}</strong><em>${escape(sub)}</em></span>
          <span class="rtg-choice-probability"><small>VITTORIA</small><strong>${escape(Number(probability).toFixed(1))}%</strong><em class="rtg-choice-delta ${delta>0?"is-positive":delta<0?"is-negative":""}">${escape(deltaText)}</em></span>
          ${selected?'<span class="rtg-choice-confirm">TOCCA DI NUOVO PER CONFERMARE</span>':""}
        </button>`;
      };
      return `<section class="panel rtg-duel-card rtg-duel-card--revolution rtg-duel-card--clean rtg-paper-modal">
        <div class="rtg-duel-contextbar">
          <strong class="rtg-duel-possession ${possessionClass}">${escape(possessionText)}</strong>
          <span>${escape(currentMinute(match))}' · ${escape(({midfield:"CENTROCAMPO",attack:"TRE QUARTI",shot:"ZONA TIRO"}[pending.zone || match.fieldZone] || "AZIONE"))}</span>
        </div>
        <header class="rtg-duel-story rtg-duel-story--clean">
          <div><p class="eyebrow">SCONTRO</p><h2>${escape(callout.user)}</h2><p>${escape(callout.opponent)}</p></div>
          <div class="rtg-duel-probability-card"><small>${selectedChoice?"SE CONFERMI":"PROBABILITÀ BASE"}</small><strong>${escape(selectedProbability.toFixed(1))}%</strong><em>${escape(selectedLabel)}</em></div>
        </header>
        <div class="rtg-duel-versus-board">
          <article class="rtg-duel-portrait-panel rtg-duel-portrait-panel--user">
            <span class="rtg-duel-panel-tag">TU</span>
            ${duelVisualMarkup(user,"user",`data-rtg-duel-player="${escape(pid(user))}" data-side="user"`)}
            <strong>${escape(callout.user)}</strong>
          </article>
          <div class="rtg-duel-vs-core" aria-hidden="true"><small>SCONTRO</small><span>VS</span></div>
          <article class="rtg-duel-portrait-panel rtg-duel-portrait-panel--opponent">
            <span class="rtg-duel-panel-tag">${escape(opponentName)}</span>
            ${duelVisualMarkup(opponent,"opponent",`data-rtg-duel-player="${escape(pid(opponent))}" data-side="opponent"`)}
            <strong>${escape(callout.opponent)}</strong>
          </article>
        </div>
        <div class="rtg-duel-meter-clean" aria-label="Probabilità del duello">
          <span>${escape(selectedProbability.toFixed(1))}%</span><i><b style="width:${escape(selectedProbability.toFixed(1))}%"></b></i><span>${escape(opponentProbability.toFixed(1))}%</span>
        </div>
        <section class="rtg-duel-choice-section">
          <div class="rtg-duel-choice-head"><strong>SCEGLI L'AZIONE</strong><span>1° tocco: anteprima · 2° tocco: conferma</span></div>
          <div class="rtg-duel-choice-grid">
            ${choiceCard("base",baseVerb,"Nessun uso consumato",baseProbability,0)}
            ${pending.userMove && uses > 0 ? choiceCard("move",pending.userMove.name,`${uses}/2 usi · Power ${pending.userMove.power || "—"}`,moveProbability,moveDelta) : ""}
          </div>
        </section>
      </section>`;
    }

    function resolvedEncounterMarkup(resolution = {}) {
      const user = resolution.userPlayer || { name: resolution.userPlayerName || "La tua squadra", overall: "—" };
      const opponent = resolution.opponentPlayer || { name: resolution.aiPlayerName || "Avversario", overall: "—" };
      const headline = resultHeadline(resolution,user,opponent);
      const resultClass = resolution.userWon ? "is-win" : "is-loss";
      const scoreUser = resolution.scoreAfter?.user ?? resolution.scoreBefore?.user ?? 0;
      const scoreOpponent = resolution.scoreAfter?.opponent ?? resolution.scoreBefore?.opponent ?? 0;
      const userProbability = Math.max(0, Math.min(100, Number(resolution.probability ?? 50) || 0));
      const opponentProbability = Math.max(0, 100 - userProbability);
      const opponentLabel = resolution.opponentLabel || "AVVERSARIO";
      const userAction = resolution.userChoiceLabel || choiceVerb(resolution.userKind);
      const opponentAction = resolution.aiChoiceLabel || "Azione base";
      return `<section class="panel rtg-duel-card rtg-duel-result rtg-duel-result--revolution rtg-paper-modal development-squad-card-scope ${resultClass}">
        <div class="rtg-duel-result-banner ${resultClass}">
          <div class="rtg-duel-result-status"><span>${resolution.goalSide ? "GOL" : resolution.userWon ? "AZIONE RIUSCITA" : "AZIONE PERSA"}</span><em>ESITO DUELLO</em></div>
          <strong>${escape(headline)}</strong>
        </div>
        <div class="rtg-duel-versus-board rtg-duel-versus-board--result">
          <article class="rtg-duel-portrait-panel rtg-duel-portrait-panel--user rtg-duel-result-player">
            <span class="rtg-duel-panel-tag">TU</span>
            ${duelVisualMarkup(user,"user",pid(user) ? `data-rtg-duel-player="${escape(pid(user))}" data-side="user"` : "")}
            <strong class="rtg-duel-result-action">${escape(userAction)}</strong>
          </article>
          <div class="rtg-duel-vs-core rtg-duel-result-vs" aria-hidden="true"><small>ESITO</small><span>VS</span></div>
          <article class="rtg-duel-portrait-panel rtg-duel-portrait-panel--opponent rtg-duel-result-player">
            <span class="rtg-duel-panel-tag">${escape(opponentLabel)}</span>
            ${duelVisualMarkup(opponent,"opponent",pid(opponent) ? `data-rtg-duel-player="${escape(pid(opponent))}" data-side="opponent"` : "")}
            <strong class="rtg-duel-result-action">${escape(opponentAction)}</strong>
          </article>
        </div>
        <div class="rtg-duel-result-meter" aria-label="Probabilità finale del duello">
          <span><small>TU</small><strong>${escape(userProbability.toFixed(1))}%</strong></span>
          <i><b style="width:${escape(userProbability.toFixed(1))}%"></b></i>
          <span><small>${escape(opponentLabel)}</small><strong>${escape(opponentProbability.toFixed(1))}%</strong></span>
        </div>
        <div class="rtg-duel-result-facts rtg-duel-result-facts--compact">
          <div class="rtg-result-score"><small>PUNTEGGIO</small><strong>${escape(scoreUser)} - ${escape(scoreOpponent)}</strong></div>
          <div><small>ESITO</small><strong>${resolution.goalSide ? "GOL" : resolution.userWon ? "VINTA" : "PERSA"}</strong></div>
        </div>
        ${resolution.goalSide ? `<div class="rtg-duel-goal-confirm"><strong>⚽ GOL CONVALIDATO</strong><span>${escape(headline)} · punteggio aggiornato.</span></div>` : ""}
        <button type="button" class="btn btn-yellow rtg-duel-continue" data-rtg-duel-continue><span>CONTINUA PARTITA</span><b>›</b></button>
      </section>`;
    }

    function halftimeMarkup(model = {}, options = {}) {
      const lineup = model.lineup || [], bench = model.bench || [];
      const selectedId = String(options.selectedPlayerId || "");
      const selected = lineup.find((player) => pid(player) === selectedId) || null;
      const selectedRole = selected ? role(selected) : "";
      const compatibleBench = selected ? bench.filter((player) => role(player) === selectedRole) : [];
      const rows = formationRows(model.formationId, lineup);
      const match = options.match || {};
      const scoreUser = Number(match.score?.user ?? 0);
      const scoreOpponent = Number(match.score?.opponent ?? 0);
      const lineupMarkup = `<div class="rtg-halftime-pitch rtg-shared-match-pitch">
        <div class="boss-match-field-side boss-match-field-side--user boss-match-field-side--mobile rtg-shared-match-side">
          ${rows.map((row) => `<div class="match-formation-line match-formation-line--${escape(String(row.role||"").toLowerCase())} boss-match-line rtg-shared-match-line" data-row-count="${row.players.length}" style="--players-in-row:${row.players.length||1};--row-count:${row.players.length||1};--boss-row-count:${row.players.length||1}">${row.players.map((player) => sharedMatchCard(
            player,
            "user",
            `data-rtg-half-lineup="${escape(pid(player))}" data-role="${escape(role(player))}" aria-pressed="${pid(player)===selectedId?"true":"false"}"`,
            `squad-player-card rtg-halftime-player-card ${pid(player)===selectedId?"selected":""}`
          )).join("")}</div>`).join("")}
        </div>
      </div>`;
      return `<section class="panel rtg-halftime rtg-halftime-revolution rtg-paper-modal development-squad-card-scope">
        <header class="rtg-halftime-scoreboard">
          <div class="rtg-halftime-minute"><strong>45'</strong><span>INTERVALLO</span></div>
          <div class="rtg-halftime-score"><small>TU</small><strong>${escape(scoreUser)} - ${escape(scoreOpponent)}</strong><small>${escape(match.opponentSquad?.name || "AVVERSARIO")}</small></div>
          <div class="rtg-halftime-shape"><small>MODULO</small><strong>${escape(model.formationId || "—")}</strong></div>
        </header>
        <div class="rtg-halftime-tip"><strong>CAMBIO RUOLO PER RUOLO</strong><span>Tocca un titolare, poi una riserva evidenziata.</span></div>
        <div class="rtg-halftime-layout">
          <section class="rtg-halftime-field-panel">
            <div class="rtg-halftime-section-title"><span>IN CAMPO</span><b>45:00</b></div>
            ${lineupMarkup}
          </section>
          <aside class="rtg-halftime-bench-panel">
            <div class="rtg-halftime-section-title"><span>PANCHINA</span><b>${escape(bench.length)}</b></div>
            <div class="rtg-halftime-bench-strip">
              ${bench.map((player) => {
                const compatible = !!selected && role(player) === selectedRole;
                const attrs = [
                  `data-rtg-half-bench-player="${escape(pid(player))}"`,
                  `data-role="${escape(role(player))}"`,
                  compatible ? `data-rtg-half-bench="${escape(pid(player))}"` : "",
                  compatible ? 'aria-disabled="false"' : 'aria-disabled="true"',
                ].filter(Boolean).join(" ");
                return sharedMatchCard(player,"user",attrs,`squad-player-card rtg-halftime-player-card ${selected && !compatible ? "is-incompatible" : compatible ? "is-compatible" : ""}`);
              }).join("")}
            </div>
            ${selected ? `<div class="rtg-halftime-selection"><span>SELEZIONATO</span><strong>${escape(selected.name || selectedId)}</strong><em>${escape(selectedRole)} · ${compatibleBench.length ? `${compatibleBench.length} cambi disponibili` : "nessun cambio disponibile"}</em></div>` : ""}
          </aside>
        </div>
        <button type="button" class="btn btn-yellow rtg-half-confirm" data-rtg-half-confirm><span>SECONDO TEMPO</span><b>CONFERMA E RIPARTI</b></button>
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
          <div><p class="eyebrow">Decisione finale</p><h2>RIGORI</h2><p class="muted">${userAttacks ? "Sei al tiro" : "Sei in porta"} · ${match.shootout?.status === "sudden-death" ? "Sudden death" : `Rigore ${escape(currentKick)} di 5`}</p></div>
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
        <div class="rtg-penalty-choice">
          <div class="rtg-penalty-choice-copy"><strong>${userAttacks ? "DOVE TIRI?" : "DOVE TI TUFFI?"}</strong><span>La CPU sceglie in segreto.</span></div>
          <div class="rtg-penalty-goal" aria-label="Scegli direzione">
            <button type="button" data-rtg-penalty-direction="left"><i></i><span>Sinistra</span></button>
            <button type="button" data-rtg-penalty-direction="center"><i></i><span>Centro</span></button>
            <button type="button" data-rtg-penalty-direction="right"><i></i><span>Destra</span></button>
          </div>
        </div>
        ${moveAvailable ? `<button type="button" class="btn btn-yellow rtg-penalty-move" data-rtg-penalty-move><strong>${escape(moveLabel)}</strong><small>${escape(context.userMoveUses || 0)}/2 usi rimasti</small></button>` : ""}
      </section>`;
    }

    function resultMarkup(match = {}) {
      const won = match.result?.winner === "user";
      return `<section class="panel rtg-match-result rtg-paper-modal"><p class="eyebrow">Road to Glory</p><h2>${won ? "Vittoria!" : match.result?.winner ? "Sconfitta" : "Pareggio"}</h2><strong>${escape(match.score?.user || 0)} - ${escape(match.score?.opponent || 0)}</strong><button type="button" class="btn btn-yellow" data-rtg-result-continue>Continua</button></section>`;
    }

    function bind(root, actions = {}) {
      root?.querySelectorAll?.("[data-rtg-prematch-player]")?.forEach((button) => button.addEventListener("click", () => {
        const playerId = String(button.dataset.rtgPrematchPlayer || "");
        const side = String(button.dataset.side || "");
        if (playerId) actions.onOpenPlayerDetails?.(playerId, side);
      }));
      root?.querySelectorAll?.("[data-rtg-prematch-tab]")?.forEach((button) => button.addEventListener("click", () => {
        const side=String(button.dataset.rtgPrematchTab||"user");
        root.querySelectorAll("[data-rtg-prematch-tab]").forEach((tab)=>{const active=tab.dataset.rtgPrematchTab===side;tab.classList.toggle("active",active);tab.setAttribute("aria-selected",active?"true":"false");});
        root.querySelectorAll("[data-rtg-prematch-field]").forEach((field)=>{field.hidden=field.dataset.rtgPrematchField!==side;});
      }));
      root?.querySelectorAll?.("[data-rtg-live-tab]")?.forEach((button) => button.addEventListener("click", () => {
        const side=String(button.dataset.rtgLiveTab||"user");
        root.querySelectorAll("[data-rtg-live-tab]").forEach((tab)=>{const active=tab.dataset.rtgLiveTab===side;tab.classList.toggle("active",active);tab.setAttribute("aria-selected",active?"true":"false");});
        root.querySelectorAll("[data-rtg-live-field]").forEach((field)=>{field.hidden=field.dataset.rtgLiveField!==side;});
      }));
      root?.querySelector?.("[data-rtg-prematch-start]")?.addEventListener("click", () => actions.onPreMatchStart?.());
      root?.querySelectorAll?.("[data-rtg-choice]")?.forEach((button) => button.addEventListener("click", () => actions.onEncounterChoice?.(button.dataset.rtgChoice)));
      root?.querySelectorAll?.("[data-rtg-duel-player]")?.forEach((button) => button.addEventListener("click", () => {
        const playerId = String(button.dataset.rtgDuelPlayer || "");
        const side = String(button.dataset.side || "");
        if (playerId) actions.onOpenPlayerDetails?.(playerId, side);
      }));
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
