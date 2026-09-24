(function (global) {
  "use strict";

  function create(deps = {}) {
    const escape = deps.escapeHtml || ((value) => String(value ?? ""));
    const compactPlayerCardMarkup = deps.compactPlayerCardMarkup || null;
    const matchFormationCardMarkup = deps.matchFormationCardMarkup || null;
    const squadPitchMarkup = deps.squadPitchMarkup || null;
    const teamEmblemMarkup = deps.teamEmblemMarkup || null;
    const userTeamMeta = deps.userTeamMeta || null;
    const formationLayout = deps.formationLayout || global.FormationLayout || null;
    const formationById = deps.formationById || ((id) => global.SeasonRegistry?.database?.("ie1")?.formations?.eleven?.find?.((item) => String(item.id) === String(id)) || null);
    const pid = (player) => String(player?.cardId || player?.playerId || player?.id || "");
    const role = (player) => String(player?.normalizedRole || player?.position || player?.role || "").toUpperCase();
    const DUEL_RARITY_CLASS = Object.freeze({
      Scarso:"rarity-scarso",
      Debole:"rarity-debole",
      Normale:"rarity-normale",
      Buono:"rarity-buono",
      Forte:"rarity-forte",
      Elite:"rarity-elite",
      Mondiale:"rarity-mondiale",
      Leggenda:"rarity-leggenda",
      Aurico:"rarity-aurico",
    });
    function duelRarityClass(player = {}) {
      const category = String(player?.finalRarity || player?.category || "Normale");
      return global.PlayerView?.rarityClass?.(category) || DUEL_RARITY_CLASS[category] || "rarity-normale";
    }
    function moveCategoryClass(move = null, fallbackKind = "") {
      const raw = String(move?.type || "").trim().toLowerCase();
      const fallback = String(fallbackKind || "").trim().toLowerCase();
      const aliases = {
        shot:"shot",shoot:"shot",tiro:"shot",
        defense:"defense",defence:"defense",block:"defense",contrast:"defense",contrasto:"defense",
        dribble:"dribble",dribbling:"dribble",
        save:"save",catch:"save",keeper:"save",parata:"save"
      };
      const type = aliases[raw] || aliases[fallback] || "neutral";
      return `move-category--${type}`;
    }
    function duelActionCategory(kind = "", side = "user", actorSide = "user") {
      const normalized = String(kind || "").trim().toLowerCase();
      if (normalized === "midfield") return side === actorSide ? "move-category--dribble" : "move-category--defense";
      return moveCategoryClass(null, normalized);
    }
    const userNameFor = (value = {}) => value?.userSquad?.name || value?.name || userTeamMeta?.()?.name || "La tua squadra";
    const emblem = (squad = {}, side = "user", className = "rtg-match-team-emblem") => teamEmblemMarkup?.(squad, side, className) || "";

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

    function duelElementLabel(player = {}) {
      const raw = String(player?.element || "").trim();
      const key = raw.toLowerCase();
      if (["fire","fuoco"].includes(key)) return "Fuoco";
      if (["wind","vento"].includes(key)) return "Vento";
      if (["forest","albero","wood","bosco"].includes(key)) return "Albero";
      if (["mountain","montagna","earth","terra"].includes(key)) return "Montagna";
      return raw || "—";
    }

    function duelElementClass(player = {}) {
      const key = String(player?.element || "").trim().toLowerCase();
      if (["fire","fuoco"].includes(key)) return "is-fire";
      if (["mountain","montagna"].includes(key)) return "is-mountain";
      if (["forest","albero","wood","bosco"].includes(key)) return "is-forest";
      if (["wind","vento"].includes(key)) return "is-wind";
      return "";
    }

    function duelElementKey(player = {}) {
      const key = String(player?.element || "").trim().toLowerCase();
      if (["fire","fuoco"].includes(key)) return "fire";
      if (["forest","albero","wood","bosco"].includes(key)) return "forest";
      if (["wind","vento"].includes(key)) return "wind";
      if (["mountain","montagna","earth","terra"].includes(key)) return "mountain";
      return "";
    }

    function duelElementIcon(player = {}) {
      const key = duelElementKey(player);
      return ({
        fire:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1.4 3.6 5 5.2 5 9.4A5 5 0 1 1 7 12c0-2.3 1.2-4.3 3.4-6.3-.1 2.2.5 3.7 1.6 4.7.9-2 .7-4.5 0-7.4Z"/></svg>',
        mountain:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 19 6.2-10 3.1 4.6L15.5 9 21 19H3Z"/><path d="m7.5 12 1.8 1.1 1.4-1.1"/></svg>',
        forest:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 7.5 9h2.3L6 14h4v4H8v3h8v-3h-2v-4h4l-3.8-5h2.3L12 3Z"/></svg>',
        wind:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h10.5c2 0 2.5-3 0-3-1.1 0-1.8.5-2.2 1.2"/><path d="M3 12h15c2.4 0 2.8 3.5.2 3.5-1.2 0-2-.6-2.4-1.4"/><path d="M3 16h8"/></svg>'
      })[key] || "";
    }

    function duelElementDisadvantaged(player = {}, opponent = {}) {
      const mine = duelElementKey(player);
      const theirs = duelElementKey(opponent);
      const beats = {fire:"forest",forest:"wind",wind:"mountain",mountain:"fire"};
      return !!mine && !!theirs && beats[theirs] === mine;
    }

    function duelCompareVisualMarkup(player = {}, side = "user", attrs = "", opponent = null) {
      const name = player?.name || pid(player) || (side === "user" ? "Tu" : "Avversario");
      const visual = duelVisualUrl(player);
      const playerRole = role(player) || "—";
      const overall = player?.overall ?? player?.finalOverall ?? "—";
      const element = duelElementLabel(player);
      const elementClass = duelElementClass(player);
      const elementStateClass = opponent && duelElementDisadvantaged(player,opponent) ? "is-element-disadvantaged" : "";
      return `<button type="button" class="rtg-duel-visual rtg-duel-visual--compare rtg-duel-visual--${escape(side)} ${escape(elementClass)}" ${attrs}>
        <span class="rtg-duel-render">${visual ? `<img src="${escape(visual)}" alt="${escape(name)}" loading="eager" />` : `<i aria-hidden="true">${escape(String(name).slice(0,1).toUpperCase())}</i>`}</span>
        <span class="rtg-duel-player-copy">
          <strong class="rtg-duel-player-name">${escape(name)}</strong>
          <span class="rtg-duel-player-meta">
            <small><b>${escape(playerRole)}</b><span>OVR ${escape(overall)}</span></small>
            <em class="rtg-duel-player-element has-native-element-icon ${escape(elementClass)} ${escape(elementStateClass)}">${duelElementIcon(player)}<span>${escape(element)}</span></em>
          </span>
        </span>
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
      const kind = event.kind || (event.zone === "shot" ? "shot" : event.zone === "attack" ? "dribble" : "midfield");
      const winnerSide = event.actorWon ? actorSide : opponentSide;
      const focusPlayer = event.actorWon ? actor : opponent;
      const possessionBefore = String(event.possessionBefore || "");
      const possessionAfter = String(event.possessionAfter || "");
      const hasPossessionSnapshot = ["user","opponent"].includes(possessionBefore) && ["user","opponent"].includes(possessionAfter);
      const effectiveNoTurnover = !event.goalSide && (hasPossessionSnapshot ? possessionBefore === possessionAfter : !event.manual);
      const possessionSide = hasPossessionSnapshot ? possessionAfter : actorSide;
      const possessionTeamName = possessionSide === "user"
        ? userNameFor(match)
        : (match?.opponentSquad?.name || "la squadra avversaria");
      let type = "build_up", baseCopy = "";
      if (kind === "shot") {
        type = event.actorWon ? "goal" : "save";
        baseCopy = event.actorWon ? `GOL! ${actorName} segna.` : `${opponentName} ferma il tiro di ${actorName}.`;
      } else if (kind === "dribble") {
        type = event.actorWon ? "dribble" : (effectiveNoTurnover ? "build_up" : "defensive_stop");
        baseCopy = event.actorWon
          ? `${actorName} supera ${opponentName}.`
          : effectiveNoTurnover
            ? `${opponentName} ferma ${actorName}. Possesso invariato per ${possessionTeamName}.`
            : `${opponentName} ferma ${actorName} e recupera palla.`;
      } else {
        type = event.actorWon || effectiveNoTurnover ? "build_up" : "recovery";
        baseCopy = event.actorWon
          ? `${actorName} vince il duello a centrocampo.`
          : effectiveNoTurnover
            ? `${opponentName} vince il duello a centrocampo, ma il possesso resta a ${possessionTeamName}.`
            : `${opponentName} conquista il possesso.`;
      }
      const actorActionKind = kind === "shot" ? "shot" : kind === "dribble" ? "dribble" : "midfield";
      const opponentActionKind = kind === "shot" ? "save" : kind === "dribble" ? "defense" : "midfield";
      const winningMove = event.actorWon ? event.actorMove : event.opponentMove;
      const winningKind = event.actorWon ? actorActionKind : opponentActionKind;
      const winningName = event.actorWon ? actorName : opponentName;
      const losingName = event.actorWon ? opponentName : actorName;
      // Automatic simulation is not allowed to create a turnover. If its internal
      // duel roll favours the defending player, describe it as a failed pressure/tackle
      // instead of claiming that the defender stopped/won while possession stayed put.
      const simulatedNoTurnoverLoss = effectiveNoTurnover && !event.manual && !event.actorWon && kind !== "shot";
      const copy = simulatedNoTurnoverLoss
        ? event.opponentMove
          ? `${opponentName} usa ${event.opponentMove} su ${actorName}, ma fallisce. Il possesso resta a ${possessionTeamName}.`
          : kind === "dribble"
            ? `${opponentName} prova il tackle su ${actorName}, ma non riesce a recuperare palla. Possesso invariato per ${possessionTeamName}.`
            : `${opponentName} prova a recuperare palla su ${actorName}, ma non ci riesce. Il possesso resta a ${possessionTeamName}.`
        : effectiveNoTurnover && !event.actorWon && kind !== "shot"
          ? kind === "dribble"
            ? `${opponentName} prova a fermare ${actorName}, ma fallisce. Possesso invariato per ${possessionTeamName}.`
            : `${opponentName} prova a fermare ${actorName}, ma il possesso resta a ${possessionTeamName}.`
          : winningMove
            ? `${moveOutcomeClause(winningName,losingName,winningKind,winningMove,true)}.`
            : baseCopy;
      const moveNames = winningMove ? [winningMove] : [];
      const moveName = winningMove || null;
      const presented = {
        type,
        text: copy,
        icon: global.MovePresentationRuntime?.eventIcon?.(type) || "◇",
        playerId: pid(focusPlayer),
        portraitUrl: duelVisualUrl(focusPlayer),
        moveName,
      };
      const marker = global.MovePresentationRuntime?.eventMarkerMarkup?.(presented, escape)
        || (presented.portraitUrl && presented.playerId
          ? `<span class="match-event-avatar" aria-hidden="true"><img src="${escape(presented.portraitUrl)}" alt="" loading="lazy" /></span>`
          : `<span class="match-event-symbol" aria-hidden="true">${escape(presented.icon)}</span>`);
      const kindLabel = ({goal:"Gol",save:"Parata",dribble:"Dribbling",defensive_stop:"Difesa",recovery:"Recupero",build_up:"Duello"}[type] || "Azione");
      const content = global.MovePresentationRuntime?.eventContentMarkup?.(presented, escape)
        || `<span class="match-event-kind">${escape(kindLabel)}</span><span class="match-event-copy">${escape(copy)}</span>`;
      return `<li class="match-event--${escape(winnerSide)} match-event-type--${escape(type)} ${moveNames.length ? "uses-special-move" : ""} ${isLatest ? "is-latest" : ""} ${event.manual ? "is-manual" : "is-auto"}"><span>${escape(event.minute ?? "—")}'</span><b class="match-event-marker">${marker}</b><p>${content}</p></li>`;
    }

    function tickerMarkup(match = {}) {
      const events = Array.from(match.log || []);
      return `<section class="rtg-match-ticker rtg-match-event-feed" aria-label="Riepilogo azioni">
        <div class="panel-title-row"><h3>Riepilogo azioni</h3><span class="match-state-badge">${events.length ? "LIVE" : "KICK-OFF"}</span></div>
        <ol class="boss-match-log match-sim-log rtg-match-ticker-list">${events.length
          ? events.map((event,index) => tickerEventMarkup(match,event,index === events.length - 1)).join("")
          : `<li class="match-event--neutral match-event-type--build_up rtg-ticker-empty"><span>0'</span><b class="match-event-marker"><span class="match-event-symbol">◇</span></b><p><span class="match-event-kind">PARTENZA</span><span class="match-event-copy">Formazioni pronte.</span></p></li>`}
        </ol>
      </section>`;
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
      if (squadPitchMarkup) return squadPitchMarkup(squad, { side, mode, latest });
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
      const label = side === "user" ? userNameFor(squad) : (squad?.name || "AVVERSARIO");
      return `<article class="rtg-matchup-team rtg-matchup-team--${escape(side)}">
        <div class="rtg-matchup-emblem">${emblem(squad,side,"rtg-matchup-team-emblem")}</div>
        <div class="rtg-matchup-team-copy">
          <small>${escape(side === "user" ? "TU" : "AVVERSARIO")}</small>
          <strong>${escape(label)}</strong>
          <span><b>${escape(squad?.formationId || "—")}</b><em>OVR ${escape(formationAverage(squad) || "—")}</em></span>
        </div>
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

    function baseResultActionLabel(kind, isActor = false) {
      const key = String(kind || "").toLowerCase();
      if (key === "shot") return "Tiro";
      if (key === "save") return "Parata";
      if (key === "dribble") return "Dribbling";
      if (key === "defense") return "Difesa";
      if (key === "midfield") return isActor ? "Dribbling" : "Difesa";
      return "Azione base";
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

    function moveOutcomeClause(name, opponentName, kind, moveName, won) {
      const move = String(moveName || "la mossa");
      const action = String(kind || "").toLowerCase();
      if (action === "shot") return won ? `${name} segna con ${move}` : `${name} non riesce a segnare con ${move}`;
      if (action === "save") return won ? `${name} para con ${move}` : `${name} non riesce a parare con ${move}`;
      if (action === "dribble") return won ? `${name} supera ${opponentName} con ${move}` : `${name} non supera ${opponentName} con ${move}`;
      if (action === "defense") return won ? `${name} ferma ${opponentName} con ${move}` : `${name} non riesce a fermare ${opponentName} con ${move}`;
      return won ? `${name} vince il duello a centrocampo con ${move}` : `${name} non vince il duello a centrocampo con ${move}`;
    }

    function moveAwareResultHeadline(resolution = {}, user = {}, opponent = {}) {
      const base = resultHeadline(resolution,user,opponent);
      const userName = user?.name || resolution.userPlayerName || "Il tuo giocatore";
      const opponentName = opponent?.name || resolution.aiPlayerName || "L'avversario";
      const userWon = !!resolution.userWon;
      if (userWon && resolution.userUsedMove && resolution.userChoiceLabel) {
        return `${moveOutcomeClause(userName,opponentName,resolution.userKind,resolution.userChoiceLabel,true)}.`;
      }
      if (!userWon && resolution.aiUsedMove && resolution.aiChoiceLabel) {
        return `${moveOutcomeClause(opponentName,userName,resolution.aiKind,resolution.aiChoiceLabel,true)}.`;
      }
      return base;
    }

    function preMatchMarkup(match = {}) {
      const opponentName = match.opponentSquad?.name || "Avversario";
      const userName = userNameFor(match);
      return `<main class="screen boss-match-screen rtg-prematch-shell rtg-prematch-revolution development-squad-card-scope">
        <header class="topbar rtg-prematch-topbar">
          <div class="rtg-prematch-title"><small>ROAD TO GLORY · SEASON 1</small><h1>Pre-partita</h1></div>
          <div class="rtg-prematch-top-match" aria-label="${escape(userName)} contro ${escape(opponentName)}">
            <span class="rtg-prematch-top-team rtg-prematch-top-team--user">${emblem(match.userSquad,"user","rtg-prematch-top-emblem")}<b>${escape(userName)}</b></span>
            <i>VS</i>
            <span class="rtg-prematch-top-team rtg-prematch-top-team--opponent"><b>${escape(opponentName)}</b>${emblem(match.opponentSquad,"opponent","rtg-prematch-top-emblem")}</span>
          </div>
        </header>
        <div class="content rtg-prematch-content">
          <section class="rtg-prematch-matchup">
            ${matchupTeamMarkup(match.userSquad,"user")}
            <div class="rtg-matchup-vs"><span>VS</span></div>
            ${matchupTeamMarkup(match.opponentSquad,"opponent")}
          </section>
          <section class="rtg-prematch-tactical">
            <div class="rtg-prematch-tabs" role="tablist" aria-label="Formazioni">
              <button type="button" class="active" data-rtg-prematch-tab="user" aria-selected="true">${escape(userName)} <b>${escape(match.userSquad?.formationId || "—")}</b></button>
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
      const userName = userNameFor(match);
      const possessionLabel = match.possession === "user" ? userName : opponentName;
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
        <header class="topbar rtg-match-topbar rtg-match-scoreboard">
          <div class="rtg-match-period"><small>LIVE</small><strong class="rtg-match-clock" data-rtg-match-minute>${escape(minute)}'</strong><span>${escape(periodLabel(match.period))}</span></div>
          <div class="rtg-match-score-main">
            <span class="rtg-score-team rtg-score-team--user">${emblem(match.userSquad,"user","rtg-score-emblem")}<b title="${escape(userName)}">${escape(userName)}</b></span>
            <strong class="rtg-score-capsule">${escape(match.score?.user || 0)} - ${escape(match.score?.opponent || 0)}</strong>
            <span class="rtg-score-team rtg-score-team--opponent">${emblem(match.opponentSquad,"opponent","rtg-score-emblem")}<b title="${escape(opponentName)}">${escape(opponentName)}</b></span>
          </div>
          <button type="button" class="btn btn-danger rtg-abandon-button" aria-label="Abbandona partita" title="Abbandona partita" data-rtg-abandon><span aria-hidden="true">×</span><b>ABBANDONA</b></button>
        </header>
        <section class="rtg-live-status rtg-live-commandbar ${match.possession === "user" ? "is-user-possession" : "is-opponent-possession"}">
          <div class="rtg-live-command rtg-live-command--possession"><span class="rtg-live-command-index">01</span><i aria-hidden="true"></i><span><small>POSSESSO</small><strong>${escape(possessionLabel)}</strong></span></div>
          <div class="rtg-live-command"><span class="rtg-live-command-index">02</span><span><small>ZONA</small><strong>${escape(zoneLabel)}</strong></span></div>
        </section>
        ${tickerMarkup(match)}
        <div class="content rtg-match-content">
          <section class="rtg-live-formation-panel">
            <div class="rtg-live-team-tabs" role="tablist" aria-label="Formazioni in campo">
              <button type="button" class="${activeSide==="user"?"active":""}" data-rtg-live-tab="user" aria-selected="${activeSide==="user"?"true":"false"}"><span>${escape(userName)}</span><b>${escape(match.userSquad?.formationId||"—")}</b>${match.possession==="user"?'<i>●</i>':""}</button>
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

    function moveElementLabel(value){
      const key=String(value||"").trim().toLowerCase();
      return ({fire:"FUOCO",fuoco:"FUOCO",forest:"ALBERO",wood:"ALBERO",tree:"ALBERO",albero:"ALBERO",wind:"VENTO",vento:"VENTO",mountain:"MONTAGNA",montagna:"MONTAGNA"})[key]||String(value||"").toUpperCase();
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
      const moveDelta = moveProbability == null ? 0 : moveProbability-baseProbability;
      const userHasPossession = pending.actorSide === "user";
      const opponentName = match.opponentSquad?.name || "CPU";
      const possessionText = userHasPossession ? "TU HAI PALLA" : `${opponentName} HA PALLA`;
      const possessionClass = userHasPossession ? "is-user" : "is-opponent";
      const callout = actionCallout(pending,user,opponent);
      const baseVerb = choiceVerb(inferredUserKind(pending));
      const selectedLabel = selectedChoice === "move" ? (pending.userMove?.name || "Mossa") : selectedChoice === "base" ? baseVerb : "AZIONE BASE";
      const userKind = inferredUserKind(pending);
      const aiKind = String(pending.aiKind || counterpartKind(userKind)).toLowerCase();
      const userMoveSelected = selectedChoice === "move" && !!pending.userMove && uses > 0;
      const userActionShort = userMoveSelected ? pending.userMove.name : baseResultActionLabel(userKind,pending.actorSide==="user");
      const opponentActionShort = baseResultActionLabel(aiKind,pending.actorSide==="opponent");
      const userRarityClass = duelRarityClass(user);
      const opponentRarityClass = duelRarityClass(opponent);
      const choiceCard = (choice,label,sub,probability,delta=0,disabled=false,categoryClass="") => {
        const selected = selectedChoice === choice;
        const deltaText = delta > 0.05 ? `+${delta.toFixed(1)}%` : delta < -0.05 ? `${delta.toFixed(1)}%` : "BASE";
        return `<button type="button" class="rtg-duel-choice-card ${choice==="move"?"is-move":"is-base"} ${escape(categoryClass)} ${selected?"is-selected":""}" data-rtg-choice="${choice}" data-rtg-confirm="${selected?"1":"0"}" ${disabled?"disabled":""}>
          <span class="rtg-choice-icon" aria-hidden="true">${choice==="move"?"⚡":"●"}</span>
          <span class="rtg-choice-copy"><strong>${escape(label)}</strong>${String(sub).includes("|ELEMENT|")?(()=>{const [main,el,key]=String(sub).split("|ELEMENT|");const parts=String(el||"").split("|");return `<em>${escape(main)}</em><span class="rtg-move-element-badge element-${escape(parts[1]||key||"")}"><i></i>${escape(parts[0]||"")}</span>`;})():`<em>${escape(sub)}</em>`}</span>
          <span class="rtg-choice-probability"><strong>${escape(Number(probability).toFixed(1))}%</strong><em class="rtg-choice-delta ${delta>0?"is-positive":delta<0?"is-negative":""}">${escape(deltaText)}</em></span>
          ${selected?'<span class="rtg-choice-confirm">TOCCA DI NUOVO PER CONFERMARE</span>':""}
        </button>`;
      };
      return `<section class="panel rtg-duel-card rtg-duel-card--revolution rtg-duel-card--clean rtg-paper-modal ${userHasPossession ? "is-user-possession" : "is-opponent-possession"} ${userMoveSelected ? "is-user-move-preview" : ""}">
        <div class="rtg-duel-contextbar">
          <strong class="rtg-duel-possession ${possessionClass}">${escape(possessionText)}</strong>
          <span class="rtg-duel-context-meta"><b class="rtg-duel-minute">${escape(currentMinute(match))}'</b><b class="rtg-duel-zone">${escape(({midfield:"CENTROCAMPO",attack:"TRE QUARTI",shot:"ZONA TIRO"}[pending.zone || match.fieldZone] || "AZIONE"))}</b></span>
        </div>
        <header class="rtg-duel-story rtg-duel-story--clean rtg-duel-story--minimal">
          <div><p class="eyebrow">SCONTRO</p><h2>${escape(duelTypeLabel(pending))}</h2></div>
        </header>
        <div class="rtg-duel-versus-board">
          <article class="rtg-duel-portrait-panel rtg-duel-portrait-panel--user ${escape(userRarityClass)} ${userMoveSelected ? "has-special-move" : ""}">
            <div class="rtg-duel-panel-heading"><span class="rtg-duel-panel-tag">TU</span><span class="rtg-duel-action-chip ${userMoveSelected ? `rtg-duel-action-chip--move ${moveCategoryClass(pending.userMove,userKind)}` : ""}">${escape(userActionShort)}</span></div>
            ${duelCompareVisualMarkup(user,"user",`data-rtg-duel-player="${escape(pid(user))}" data-side="user"`,opponent)}
            ${userMoveSelected ? `<div class="rtg-duel-active-move ${duelActionCategory(userKind,"user",pending.actorSide)}"><small>MOSSA SPECIALE</small><strong>${escape(pending.userMove.name)}</strong><em>POWER ${escape(pending.userMove.power ?? "—")}</em></div>` : ""}
          </article>
          <div class="rtg-duel-vs-core" aria-hidden="true"><small>SCONTRO</small><span>VS</span></div>
          <article class="rtg-duel-portrait-panel rtg-duel-portrait-panel--opponent ${escape(opponentRarityClass)}">
            <div class="rtg-duel-panel-heading"><span class="rtg-duel-panel-tag">${escape(opponentName)}</span><span class="rtg-duel-action-chip">${escape(opponentActionShort)}</span></div>
            ${duelCompareVisualMarkup(opponent,"opponent",`data-rtg-duel-player="${escape(pid(opponent))}" data-side="opponent"`,user)}
          </article>
        </div>
        <section class="rtg-duel-choice-section">
          <div class="rtg-duel-choice-head"><strong>SCEGLI L'AZIONE</strong><span>1° tocco: anteprima · 2° tocco: conferma</span></div>
          <div class="rtg-duel-choice-grid">
            ${choiceCard("base",baseVerb,"Nessun uso consumato",baseProbability,0)}
            ${pending.userMove && uses > 0 ? choiceCard("move",pending.userMove.name,`${uses}/2 USI · POWER ${pending.userMove.power || "—"}${pending.userMove.element ? `|ELEMENT|${moveElementLabel(pending.userMove.element)}|${String(pending.userMove.element).toLowerCase()}` : ""}`,moveProbability,moveDelta,false,moveCategoryClass(pending.userMove,userKind)) : ""}
          </div>
        </section>
      </section>`;
    }

    function finalComparisonMarkup(resolution = {}) {
      const user=resolution.userPlayer||{name:resolution.userPlayerName||"La tua squadra",overall:"—"};
      const opponent=resolution.opponentPlayer||{name:resolution.aiPlayerName||"Avversario",overall:"—"};
      const userAction=resolution.userChoiceLabel||baseResultActionLabel(resolution.userKind,resolution.actorSide==="user");
      const aiAction=resolution.aiChoiceLabel||baseResultActionLabel(resolution.aiKind,resolution.actorSide==="opponent");
      const final=Math.max(0,Math.min(100,Number(resolution.probability??50)));
      const other=100-final;
      const userMove=!!resolution.userUsedMove, aiMove=!!resolution.aiUsedMove;
      const userMoveCategory=duelActionCategory(resolution.userKind,"user",resolution.actorSide);
      const aiMoveCategory=duelActionCategory(resolution.aiKind,"opponent",resolution.actorSide);
      const userRarityClass=duelRarityClass(user), opponentRarityClass=duelRarityClass(opponent);
      return `<section class="panel rtg-duel-card rtg-duel-card--clean rtg-duel-resolving rtg-paper-modal development-squad-card-scope">
        <div class="rtg-duel-resolving-head"><small>SCELTE BLOCCATE</small><strong>CONFRONTO FINALE</strong></div>
        <div class="rtg-duel-versus-board rtg-duel-versus-board--resolving">
          <article class="rtg-duel-portrait-panel rtg-duel-result-player rtg-duel-portrait-panel--user ${escape(userRarityClass)} ${userMove?"has-special-move":""}">${duelCompareVisualMarkup(user,"user","",opponent)}<div class="rtg-duel-resolving-action ${userMove?`is-move ${escape(userMoveCategory)}`:""}"><small>${userMove?"MOSSA":"AZIONE"}</small><strong>${escape(userAction)}</strong>${userMove?`<em>POWER ${escape(resolution.userMovePower??"—")}${resolution.userMoveElement?` · ${escape(moveElementLabel(resolution.userMoveElement))}`:""}</em>`:""}</div></article>
          <div class="rtg-duel-vs-core rtg-duel-vs-core--resolving"><small>PROBABILITÀ</small><span>VS</span></div>
          <article class="rtg-duel-portrait-panel rtg-duel-result-player rtg-duel-portrait-panel--opponent ${escape(opponentRarityClass)} ${aiMove?"has-special-move":""}">${duelCompareVisualMarkup(opponent,"opponent","",user)}<div class="rtg-duel-resolving-action ${aiMove?`is-move ${escape(aiMoveCategory)}`:""}"><small>${aiMove?"MOSSA":"AZIONE"}</small><strong>${escape(aiAction)}</strong>${aiMove?`<em>POWER ${escape(resolution.aiMovePower??"—")}${resolution.aiMoveElement?` · ${escape(moveElementLabel(resolution.aiMoveElement))}`:""}</em>`:""}</div></article>
        </div>
        <div class="rtg-duel-final-probability rtg-duel-final-probability--persistent"><small>PROBABILITÀ EFFETTIVA</small><div class="rtg-duel-prob-sides"><span><em>TU</em><strong>${escape(final.toFixed(1))}%</strong></span><i>VS</i><span><em>AVVERSARIO</em><strong>${escape(other.toFixed(1))}%</strong></span></div></div>
        <div class="rtg-duel-resolving-footer"><span>RISOLUZIONE AUTOMATICA</span><b><i></i><i></i><i></i></b></div>
      </section>`;
    }

    function resolvingEncounterMarkup(resolution = {}) {
      const user = resolution.userPlayer || { name: resolution.userPlayerName || "La tua squadra", overall:"—" };
      const opponent = resolution.opponentPlayer || { name: resolution.aiPlayerName || "Avversario", overall:"—" };
      const opponentLabel = resolution.opponentLabel || "AVVERSARIO";
      const userAction = resolution.userChoiceLabel || baseResultActionLabel(resolution.userKind,resolution.actorSide==="user");
      const aiAction = resolution.aiChoiceLabel || baseResultActionLabel(resolution.aiKind,resolution.actorSide==="opponent");
      const userMove = !!resolution.userUsedMove;
      const aiMove = !!resolution.aiUsedMove;
      const userMoveCategory = duelActionCategory(resolution.userKind,"user",resolution.actorSide);
      const aiMoveCategory = duelActionCategory(resolution.aiKind,"opponent",resolution.actorSide);
      const userRarityClass = duelRarityClass(user);
      const opponentRarityClass = duelRarityClass(opponent);
      return `<section class="panel rtg-duel-card rtg-duel-card--clean rtg-duel-resolving rtg-paper-modal development-squad-card-scope">
        <div class="rtg-duel-resolving-head"><small>SCONTRO IN CORSO</small><strong>CHI AVRÀ LA MEGLIO?</strong></div>
        <div class="rtg-duel-versus-board rtg-duel-versus-board--resolving">
          <article class="rtg-duel-portrait-panel rtg-duel-result-player rtg-duel-portrait-panel--user ${escape(userRarityClass)} ${userMove?"has-special-move":""}">
            ${duelCompareVisualMarkup(user,"user","",opponent)}
            <div class="rtg-duel-resolving-action ${userMove?`is-move ${escape(userMoveCategory)}`:""}"><small>${userMove?"MOSSA":"AZIONE"}</small><strong>${escape(userAction)}</strong>${userMove?`<em>POWER ${escape(resolution.userMovePower ?? "—")}</em>`:""}</div>
          </article>
          <div class="rtg-duel-vs-core rtg-duel-vs-core--resolving" aria-hidden="true"><small>RISOLUZIONE</small><span>VS</span><i></i></div>
          <article class="rtg-duel-portrait-panel rtg-duel-result-player rtg-duel-portrait-panel--opponent ${escape(opponentRarityClass)} ${aiMove?"has-special-move":""}">
            ${duelCompareVisualMarkup(opponent,"opponent","",user)}
            <div class="rtg-duel-resolving-action ${aiMove?`is-move ${escape(aiMoveCategory)}`:""}"><small>${aiMove?"MOSSA":"AZIONE"}</small><strong>${escape(aiAction)}</strong>${aiMove?`<em>POWER ${escape(resolution.aiMovePower ?? "—")}</em>`:""}</div>
          </article>
        </div>
        <div class="rtg-duel-resolving-footer"><span>CALCOLO SCONTRO</span><b><i></i><i></i><i></i></b></div>
      </section>`;
    }

    function resolvedEncounterMarkup(resolution = {}) {
      const user = resolution.userPlayer || { name: resolution.userPlayerName || "La tua squadra", overall: "—" };
      const opponent = resolution.opponentPlayer || { name: resolution.aiPlayerName || "Avversario", overall: "—" };
      const headline = moveAwareResultHeadline(resolution,user,opponent);
      const resultClass = resolution.userWon ? "is-win" : "is-loss";
      const scoreUser = resolution.scoreAfter?.user ?? resolution.scoreBefore?.user ?? 0;
      const scoreOpponent = resolution.scoreAfter?.opponent ?? resolution.scoreBefore?.opponent ?? 0;
      const opponentLabel = resolution.opponentLabel || "AVVERSARIO";
      const userWon = !!resolution.userWon;
      const userBaseAction = baseResultActionLabel(resolution.userKind,resolution.actorSide === "user");
      const opponentBaseAction = baseResultActionLabel(resolution.aiKind,resolution.actorSide === "opponent");
      const userWinningMove = userWon && !!resolution.userUsedMove;
      const opponentWinningMove = !userWon && !!resolution.aiUsedMove;
      const userAction = resolution.userChoiceLabel || userBaseAction;
      const opponentAction = resolution.aiChoiceLabel || opponentBaseAction;
      const userMoveCategory = duelActionCategory(resolution.userKind,"user",resolution.actorSide);
      const opponentMoveCategory = duelActionCategory(resolution.aiKind,"opponent",resolution.actorSide);
      const userRarityClass = duelRarityClass(user);
      const opponentRarityClass = duelRarityClass(opponent);
      const loserStyle = "opacity:.46;filter:grayscale(.92) saturate(.28) brightness(.82);transform:scale(.985);";
      return `<section class="panel rtg-duel-card rtg-duel-result rtg-duel-result--revolution rtg-paper-modal development-squad-card-scope ${resultClass} ${(userWinningMove || opponentWinningMove) ? "has-special-move" : ""}">
        <div class="rtg-duel-result-banner ${resultClass} ${(userWinningMove||opponentWinningMove)?`has-move ${escape(userWinningMove?userMoveCategory:opponentMoveCategory)}`:""}">
          <div class="rtg-duel-result-status"><span>${resolution.goalSide ? "GOL" : userWon ? "AZIONE RIUSCITA" : "AZIONE PERSA"}</span><em>${(userWinningMove || opponentWinningMove) ? "MOSSA SPECIALE USATA" : "ESITO DUELLO"}</em></div>
          <strong>${escape(headline)}</strong>
        </div>
        <div class="rtg-duel-versus-board rtg-duel-versus-board--result">
          <article class="rtg-duel-portrait-panel rtg-duel-result-player rtg-duel-portrait-panel--user ${escape(userRarityClass)} ${userWon ? "is-duel-winner" : "is-duel-loser"}" ${userWon ? "" : `style="${loserStyle}"`}>
            ${duelCompareVisualMarkup(user,"user",pid(user) ? `data-rtg-duel-player="${escape(pid(user))}" data-side="user"` : "",opponent)}
            ${userWon && userWinningMove
              ? `<div class="rtg-duel-result-move ${escape(userMoveCategory)}"><small>MOSSA</small><strong>${escape(userAction)}</strong><em>POWER ${escape(resolution.userMovePower ?? "—")}</em></div>`
              : ""}
          </article>
          <div class="rtg-duel-result-vs" aria-hidden="true"><small>ESITO</small><span>VS</span></div>
          <article class="rtg-duel-portrait-panel rtg-duel-result-player rtg-duel-portrait-panel--opponent ${escape(opponentRarityClass)} ${userWon ? "is-duel-loser" : "is-duel-winner"}" ${userWon ? `style="${loserStyle}"` : ""}>
            ${duelCompareVisualMarkup(opponent,"opponent",pid(opponent) ? `data-rtg-duel-player="${escape(pid(opponent))}" data-side="opponent"` : "",user)}
            ${!userWon && opponentWinningMove
              ? `<div class="rtg-duel-result-move rtg-duel-result-move--opponent ${escape(opponentMoveCategory)}"><small>MOSSA</small><strong>${escape(opponentAction)}</strong><em>POWER ${escape(resolution.aiMovePower ?? "—")}</em></div>`
              : ""}
          </article>
        </div>
        ${resolution.goalSide ? `<div class="rtg-duel-goal-confirm rtg-duel-goal-celebration"><span class="rtg-goal-burst">GOL!</span><div><small>PUNTEGGIO AGGIORNATO</small><strong>${escape(scoreUser)} - ${escape(scoreOpponent)}</strong><em>Ripresa dal centrocampo</em></div></div>` : ""}
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
      const userName = userNameFor(match);
      const lineupMarkup = squadPitchMarkup
        ? squadPitchMarkup(model, { side:"user", mode:"halftime", selectedId })
        : `<div class="rtg-halftime-pitch rtg-shared-match-pitch">
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
        <div class="rtg-halftime-break-banner">
          <span>45' · FINE PRIMO TEMPO</span>
          <strong>INTERVALLO</strong>
          <em>PREPARA LA SQUADRA PER LA RIPRESA</em>
        </div>
        <header class="rtg-halftime-scoreboard">
          <div class="rtg-halftime-minute"><small>FINE 1° TEMPO</small><strong>45'</strong></div>
          <div class="rtg-halftime-score"><span class="rtg-halftime-score-emblem rtg-halftime-score-emblem--user">${emblem(match.userSquad || {}, "user", "rtg-halftime-team-logo")}</span><strong>${escape(scoreUser)} - ${escape(scoreOpponent)}</strong><span class="rtg-halftime-score-emblem rtg-halftime-score-emblem--opponent">${emblem(match.opponentSquad || {}, "opponent", "rtg-halftime-team-logo")}</span></div>
          <div class="rtg-halftime-shape"><small>MODULO</small><strong>${escape(model.formationId || "—")}</strong></div>
        </header>
        <div class="rtg-halftime-layout">
          <section class="rtg-halftime-field-panel">
            <div class="rtg-halftime-section-title"><span>IN CAMPO</span><b>45:00</b></div>
            ${lineupMarkup}
          </section>
          <aside class="rtg-halftime-bench-panel">
            <div class="rtg-halftime-section-title"><span>PANCHINA</span></div>
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

    function penaltyBallSvg() {
      // CC0 sprite by gothicfan95 / OpenGameArt. Kept as a real raster sprite
      // instead of drawing another synthetic ball in CSS/SVG.
      return `<img
        src="https://opengameart.org/sites/default/files/SoccerBall.png"
        alt=""
        aria-hidden="true"
        draggable="false"
        decoding="async"
        referrerpolicy="no-referrer"
        class="rtg-penalty-ball-sprite"
        style="display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto"
      >`;
    }

    function penaltyGoalSvg() {
      return `<svg viewBox="0 0 900 300" preserveAspectRatio="none" aria-hidden="true" focusable="false"
        style="position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none">
        <defs>
          <linearGradient id="rtgPenaltySky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#eef9fd"/>
            <stop offset=".72" stop-color="#d7edf5"/>
            <stop offset="1" stop-color="#cfe6ed"/>
          </linearGradient>
          <linearGradient id="rtgPenaltyGrass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#86ad6d"/>
            <stop offset="1" stop-color="#678f53"/>
          </linearGradient>
        </defs>

        <rect width="900" height="300" fill="url(#rtgPenaltySky)"/>
        <path d="M0 201H900V300H0Z" fill="url(#rtgPenaltyGrass)"/>
        <path d="M0 201H900V214H0Z" fill="#dce8d7" opacity=".9"/>
        <path d="M0 236H900" stroke="#5d844c" stroke-width="3" opacity=".35"/>

        <!-- soft cast shadow behind the frame -->
        <path d="M51 224V31H849V224" fill="none" stroke="#111216" stroke-width="19" stroke-linejoin="round" opacity=".13"/>

        <!-- recessed back of the net gives the goal actual depth -->
        <path d="M111 66H789L770 207H130Z" fill="#ffffff" opacity=".20" stroke="#b7d0d9" stroke-width="2"/>

        <!-- back net: vertical strands converge slightly with perspective -->
        <g fill="none" stroke="#9ec2d0" stroke-width="2" opacity=".52">
          <path d="M151 66 164 207"/>
          <path d="M218 66 228 207"/>
          <path d="M285 66 292 207"/>
          <path d="M352 66 356 207"/>
          <path d="M419 66 420 207"/>
          <path d="M486 66 484 207"/>
          <path d="M553 66 548 207"/>
          <path d="M620 66 612 207"/>
          <path d="M687 66 676 207"/>
          <path d="M754 66 740 207"/>
        </g>

        <!-- back net: horizontal strands get wider toward the front -->
        <g fill="none" stroke="#a7cad7" stroke-width="2" opacity=".50">
          <path d="M108 82H792"/>
          <path d="M106 104H794"/>
          <path d="M104 128H796"/>
          <path d="M101 154H799"/>
          <path d="M98 181H802"/>
          <path d="M94 207H806"/>
        </g>

        <!-- side netting -->
        <g fill="none" stroke="#a7cad7" stroke-width="2" opacity=".48">
          <path d="M64 43 111 66M64 78 108 82M64 113 106 104M64 148 103 128M64 181 99 154M64 214 94 207"/>
          <path d="M836 43 789 66M836 78 792 82M836 113 794 104M836 148 797 128M836 181 801 154M836 214 806 207"/>
          <path d="M64 43 94 207M836 43 806 207"/>
        </g>

        <!-- floor of the net -->
        <g fill="none" stroke="#c5d8d0" stroke-width="2" opacity=".58">
          <path d="M94 207 130 224M175 207 196 224M256 207 262 224M337 207 328 224M418 207 394 224M499 207 460 224M580 207 526 224M661 207 592 224M742 207 658 224M806 207 724 224"/>
          <path d="M130 224H770"/>
        </g>

        <!-- goal frame -->
        <path d="M64 216V37H836V216" fill="none" stroke="#c9cece" stroke-width="18" stroke-linejoin="round"/>
        <path d="M64 216V37H836V216" fill="none" stroke="#fffdf7" stroke-width="13" stroke-linejoin="round"/>
        <path d="M70 211V44H830V211" fill="none" stroke="#f5f6f2" stroke-width="3" stroke-linejoin="round"/>

        <!-- highlights make the white tubing look rounded instead of flat -->
        <path d="M69 207V47M77 44H824M831 47V207" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".95"/>
        <path d="M61 219 91 219M809 219 839 219" stroke="#d9ddd8" stroke-width="5" stroke-linecap="round"/>

        <!-- pitch markings -->
        <path d="M0 222H900" stroke="#edf3e9" stroke-width="5" opacity=".88"/>
        <path d="M450 224V300" stroke="#f3f7ef" stroke-width="4" stroke-dasharray="12 11" opacity=".82"/>
        <ellipse cx="450" cy="272" rx="13" ry="4" fill="#edf3e9" opacity=".82"/>

        <!-- subtle grounding under the posts -->
        <ellipse cx="67" cy="221" rx="24" ry="5" fill="#405d39" opacity=".18"/>
        <ellipse cx="833" cy="221" rx="24" ry="5" fill="#405d39" opacity=".18"/>
      </svg>`;
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
          <div class="rtg-penalty-goal rtg-penalty-goal--illustrated" aria-label="Scegli direzione" style="position:relative;min-height:158px;overflow:hidden;background:#eaf6fb;padding:0 8px;border-bottom-width:8px">
            ${penaltyGoalSvg()}
            <button type="button" aria-label="Tira a sinistra" data-rtg-penalty-direction="left" style="z-index:2;min-height:150px">
              <span class="rtg-penalty-ball-wrap">${penaltyBallSvg()}</span>
              <span class="rtg-penalty-direction-label">Sinistra</span>
            </button>
            <button type="button" aria-label="Tira al centro" data-rtg-penalty-direction="center" style="z-index:2;min-height:150px">
              <span class="rtg-penalty-ball-wrap">${penaltyBallSvg()}</span>
              <span class="rtg-penalty-direction-label">Centro</span>
            </button>
            <button type="button" aria-label="Tira a destra" data-rtg-penalty-direction="right" style="z-index:2;min-height:150px">
              <span class="rtg-penalty-ball-wrap">${penaltyBallSvg()}</span>
              <span class="rtg-penalty-direction-label">Destra</span>
            </button>
          </div>
        </div>
        ${moveAvailable ? `<button type="button" class="btn btn-yellow rtg-penalty-move" data-rtg-penalty-move><strong>${escape(moveLabel)}</strong><small>${escape(context.userMoveUses || 0)}/2 usi rimasti</small></button>` : ""}
      </section>`;
    }

    function resultMarkup(match = {}) {
      const winner = match.result?.winner || null;
      const won = winner === "user";
      const lost = !!winner && winner !== "user";
      const label = won ? "VITTORIA" : lost ? "SCONFITTA" : "PAREGGIO";
      const userName = userNameFor(match);
      const opponentName = match.opponentSquad?.name || "Avversario";
      return `<section class="panel rtg-match-result rtg-match-result--cabin rtg-paper-modal ${won ? "is-win" : lost ? "is-loss" : "is-draw"}">
        <header class="rtg-final-head">
          <div><p class="eyebrow">ROAD TO GLORY · RISULTATO</p><h2>${escape(label)}</h2></div>
          <strong class="rtg-final-state">${escape(label)}</strong>
        </header>
        <section class="rtg-final-score-panel">
          <div class="rtg-final-team rtg-final-team--user">${emblem(match.userSquad,"user","rtg-final-emblem")}<strong>${escape(userName)}</strong></div>
          <div class="rtg-final-score" aria-label="${escape(`${userName} ${match.score?.user || 0} - ${match.score?.opponent || 0} ${opponentName}`)}"><span>${escape(match.score?.user || 0)}</span><small>-</small><span>${escape(match.score?.opponent || 0)}</span></div>
          <div class="rtg-final-team rtg-final-team--opponent"><strong>${escape(opponentName)}</strong>${emblem(match.opponentSquad,"opponent","rtg-final-emblem")}</div>
        </section>
        <div class="rtg-final-verdict"><span>${won ? "MATCH COMPLETATO" : lost ? "RIPROVA DAL PERCORSO" : "PAREGGIO REGISTRATO"}</span></div>
        <button type="button" class="btn btn-yellow rtg-final-continue" data-rtg-result-continue><span>TORNA A ROAD TO GLORY</span><b>›</b></button>
      </section>`;
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
      root?.querySelectorAll?.("[data-rtg-choice]")?.forEach((button) => button.addEventListener("click", () => actions.onEncounterChoice?.(button.dataset.rtgChoice, button.dataset.rtgConfirm === "1")));
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

    return Object.freeze({ preMatchMarkup, matchMarkup, encounterMarkup, finalComparisonMarkup, resolvingEncounterMarkup, resolvedEncounterMarkup, halftimeMarkup, penaltyMarkup, resultMarkup, currentMinute, animateClock, bind });
  }

  global.RoadToGloryMatchView = Object.freeze({ create });
})(globalThis);
