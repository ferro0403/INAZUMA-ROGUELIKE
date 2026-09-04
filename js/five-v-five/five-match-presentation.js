(function (global) {
  "use strict";

  function create(deps = {}) {
    const {
      getRun, getUi, getFreeAgentsDb, getFreeAgentsById,
      ensureFiveVFive, resolvedRosterPlayer, escapeHtml, playerPortraitUrl, rarityClass,
      imageFallbackAttributes, resolvePlayerVisual, scrollSnapshot, renderFivePlayerPicker,
      restorePageScroll, commitFiveEditorMutation, fiveRoleForPlayerId, renderMatch,
      afterNextPaint, cssEscape,
    } = deps;

    if (typeof getRun !== "function" || typeof getUi !== "function" || typeof getFreeAgentsDb !== "function" || typeof getFreeAgentsById !== "function") {
      throw new Error("FiveMatchPresentationRuntime requires dynamic state getters");
    }

  const fiveMatchMarkupCache = new Map();
  function fiveMatchCacheKey(prefix, ...parts) { return [prefix, ...parts.map((part) => String(part ?? ""))].join("|"); }
  function memoizedFiveMatchMarkup(key, factory) {
    if (fiveMatchMarkupCache.size > 80) fiveMatchMarkupCache.clear();
    if (!fiveMatchMarkupCache.has(key)) fiveMatchMarkupCache.set(key, factory());
    return fiveMatchMarkupCache.get(key);
  }

  function fiveFormationRows(formationId, playersBySlot) {
    const formation = global.FiveVFive.formationById(formationId);
    return ["attack", "midfield", "defense", "goal"].map((line) => ({
      line,
      slots: formation.slots.filter((slot) => slot.line === line).map((slot) => ({ ...slot, player: playersBySlot[slot.key] || null })),
    })).filter((row) => row.slots.length);
  }

  function fiveUserPlayersBySlot() {
    ensureFiveVFive();
    return Object.fromEntries(Object.entries(getRun().fiveVFive.slots).map(([slot, id]) => [slot, resolvedRosterPlayer(id)]));
  }

  function fiveOpponentLevel() {
    return Math.max(0, Math.floor(Number(getRun().teamLevel || 0)));
  }

  function createOrLoadFiveMatch(node, activeRun = getRun()) {
    if (activeRun.activeMatch?.type === "five_v_five" && activeRun.activeMatch.nodeId === node.id && activeRun.activeMatch.opponents?.length === 5) return activeRun.activeMatch;
    const opponentRandom = global.DraftEngine.randomFromSeed(`${activeRun.runId}:${node.id}:fiveOpponents`);
    const formation = opponentRandom() < 0.5 ? "1-2-1" : "1-1-2";
    const slots = global.FiveVFive.formationById(formation).slots;
    const userIds = new Set((activeRun.roster || []).map((entry) => String(entry.playerId)));
    const used = new Set();
    const opponents = slots.map((slot) => {
      const pool = (getFreeAgentsDb().players || []).filter((player) => !used.has(String(player.playerId)) && !userIds.has(String(player.playerId)) && player.position === slot.role);
      const fallback = (getFreeAgentsDb().players || []).filter((player) => !used.has(String(player.playerId)) && !userIds.has(String(player.playerId)));
      const availablePool = pool.length ? pool : fallback;
      const source = availablePool[Math.floor(opponentRandom() * availablePool.length)];
      if (!source) return null;
      used.add(String(source.playerId));
      return { slotKey: slot.key, playerId: String(source.playerId) };
    }).filter(Boolean);
    const attempts = Object.keys(activeRun.statistics?.processedMatchIds || {}).filter((id) => id.includes(`::${node.id}::five_v_five::`)).length + 1;
    const match = {
      nodeId: node.id,
      previousNodeId: activeRun.currentZone?.currentNodeId || activeRun.activeMatch?.previousNodeId || null,
      type: "five_v_five",
      state: "pre-match",
      result: null,
      level: Math.max(0, Math.floor(Number(activeRun.teamLevel || 0))),
      opponentFormation: formation,
      opponents,
      log: [],
      score: [0, 0],
      attemptNumber: attempts,
    };
    match.matchId = global.RunStatistics?.createStableMatchId?.(activeRun, match) || null;
    return match;
  }

  function fiveOpponentPlayersBySlot(match) {
    const level = Number(match.level ?? fiveOpponentLevel());
    return Object.fromEntries((match.opponents || []).map((opponent) => {
      const source = getFreeAgentsById().get(String(opponent.playerId));
      if (!source) return [opponent.slotKey, null];
      const resolved = global.InazumaProgression.getPlayerAtLevel(source, Math.floor(level), getFreeAgentsDb());
      return [opponent.slotKey, { ...resolved, displayLevel: level, source: "free_agents", playerId: String(opponent.playerId) }];
    }));
  }

  function fiveMatchCard(player, side, slot) {
    if (!player) return `<button type="button" class="five-match-card five-match-card--${side} five-match-card--empty" data-five-match-slot="${escapeHtml(slot.key)}" data-five-match-side="${side}" aria-label="Riempi slot ${escapeHtml(slot.key)}, ruolo ${escapeHtml(slot.role)}"><span class="five-match-card-empty-mark" aria-hidden="true">+</span><strong>Slot ${escapeHtml(slot.key)}</strong><span class="five-match-card-role">${escapeHtml(slot.role)}</span></button>`;
    const role = player.position || player.normalizedRole || "-";
    const key = fiveMatchCacheKey("half-card", side, slot.key, player.playerId, player.name, role, player.category, playerPortraitUrl(player));
    const label = side === "user" ? `Cambia ${player.name}, slot ${slot.key}` : `Dettagli rapidi di ${player.name}`;
    return memoizedFiveMatchMarkup(key, () => `<button type="button" class="five-match-card five-match-card--${side} ${rarityClass(player.category)}" data-five-match-player="${escapeHtml(player.playerId)}" data-five-match-slot="${escapeHtml(slot.key)}" data-five-match-side="${side}" aria-pressed="false" aria-label="${escapeHtml(label)}">
      <span class="five-match-card-portrait"><img src="${escapeHtml(playerPortraitUrl(player))}" alt="" loading="lazy" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} /></span>
      <strong title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>
      <span class="five-match-card-role" aria-label="Ruolo ${escapeHtml(role)}">${escapeHtml(role)}</span>
    </button>`);
  }

  function fiveMatchPlayerDetail(player, side) {
    if (!player) return "";
    const stats = player.stats || player.finalStats || {};
    const essentials = player.position === "GK"
      ? [["Parata", stats.save], ["Difesa", stats.defense], ["Grinta", stats.grit], ["Controllo", stats.control]]
      : [["Attacco", stats.attack], ["Controllo", stats.control], ["Difesa", stats.defense], ["Velocità", stats.speed]];
    return `<div class="five-match-player-detail-copy ${rarityClass(player.category)}">
      <div class="five-match-detail-head">
        <div class="five-match-detail-identity"><small>${side === "user" ? "Tua squadra" : "Avversario"}</small><strong>${escapeHtml(player.name)}</strong></div>
        <b class="five-match-detail-role">${escapeHtml(player.position || player.normalizedRole || "-")}</b>
        <button type="button" class="five-match-detail-close" data-five-detail-close aria-label="Chiudi dettaglio">×</button>
      </div>
      <div class="five-match-detail-scout">
        <span class="five-match-detail-portrait"><img src="${escapeHtml(playerPortraitUrl(player))}" alt="" ${imageFallbackAttributes(resolvePlayerVisual(player).cardFallbacks)} /></span>
        <div class="five-match-detail-meta"><span><small>Livello</small><strong>LV ${escapeHtml(player.displayLevelText ?? player.displayLevel ?? 0)}</strong></span><span class="five-match-detail-overall"><small>OVR</small><strong>${escapeHtml(player.overall ?? player.finalOverall ?? "-")}</strong></span><span><small>Rarità</small><strong>${escapeHtml(player.category || "-")}</strong></span><span><small>Elemento / tipo</small><strong>${escapeHtml(player.element || player.type || "-")}</strong></span></div>
      </div>
      <div class="five-match-detail-stats" aria-label="Statistiche chiave">${essentials.map(([label, value]) => `<span><small>${label}</small><strong>${escapeHtml(value ?? "-")}</strong></span>`).join("")}</div>
      <button type="button" class="five-match-detail-sheet" data-five-detail-sheet="${escapeHtml(player.playerId)}" data-five-detail-side="${side}">Scheda completa</button>
    </div>`;
  }

  function fiveMatchField(playersBySlot, formationId, side, mobile = false) {
    const slotKey = Object.entries(playersBySlot || {}).map(([slot, player]) => `${slot}:${player?.playerId || ""}:${player?.overall || ""}:${player?.displayLevel || ""}`).join(",");
    const key = fiveMatchCacheKey("field", formationId, side, mobile ? "mobile" : "desktop", slotKey);
    return memoizedFiveMatchMarkup(key, () => `<div class="five-match-field-side five-match-field-side--${side} ${mobile ? "five-match-field-side--mobile" : ""}" data-five-field-side="${side}" ${mobile ? "" : ""}>
      ${fiveFormationRows(formationId, playersBySlot).map((row) => `<div class="five-match-line five-match-line--${row.line}" data-row-count="${row.slots.length}" style="--five-row-count:${row.slots.length || 1}">${row.slots.map((slot) => fiveMatchCard(slot.player, side, slot)).join("")}</div>`).join("")}
    </div>`);
  }

  function openFiveMatchPlayerSwap(slotKey, match) {
    const editable = match?.state === "pre-match" && getUi().bossMatchState === "pre-match" && (!match.simulation || match.simulation.state === "pre-match");
    const slot = global.FiveVFive.formationById(getRun().fiveVFive?.formation).slots.find((item) => item.key === slotKey);
    if (!editable || !slot) return false;
    const pageScroll = scrollSnapshot();
    const field = document.querySelector(".five-match-mobile-field");
    if (!field) return false;
    field.querySelector(".five-selector")?.remove();
    field.insertAdjacentHTML("beforeend", renderFivePlayerPicker({ selectedSlot: slotKey, selectedRole: slot.role }));
    const picker = field.querySelector(".five-selector");
    const closePicker = () => global.FiveFormationFloatingPicker?.close(picker);
    global.FiveFormationFloatingPicker?.prepare(picker, { onClose: () => restorePageScroll(pageScroll) });
    picker?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-five-player]");
      if (!button || !picker.contains(button) || button.disabled) return;
      const liveMatch = getRun()?.activeMatch;
      if (!(liveMatch?.type === "five_v_five" && liveMatch.state === "pre-match" && getUi().bossMatchState === "pre-match" && (!liveMatch.simulation || liveMatch.simulation.state === "pre-match"))) return;
      const playerId = button.dataset.fivePlayer;
      button.disabled = true;
      const committed = commitFiveEditorMutation("five-match-quick-swap", (current) => {
        const currentMatch = current.activeMatch;
        if (!(currentMatch?.type === "five_v_five" && currentMatch.state === "pre-match" && (!currentMatch.simulation || currentMatch.simulation.state === "pre-match"))) {
          throw new Error("La formazione 5v5 non è più modificabile");
        }
        return global.FiveVFive.assign(current, slotKey, playerId, (id) => fiveRoleForPlayerId(id, current));
      }, {
        onCommitted: (_value, current) => {
          getUi().match = current.activeMatch;
          getUi().bossMatchState = current.activeMatch?.state || "pre-match";
          getUi().bossMatchLog = current.activeMatch?.log || [];
          closePicker();
          renderMatch();
          afterNextPaint(() => { restorePageScroll(pageScroll); document.querySelector(`[data-five-match-side="user"][data-five-match-slot="${cssEscape(slotKey)}"]`)?.focus?.({ preventScroll: true }); });
        },
      });
      if (!committed.ok) return;
    });
    return true;
  }


  function fiveMatchStatAverage(players, statNames) {
    const list = (players || []).filter(Boolean);
    if (!list.length) return "-";
    const totals = list.map((player) => {
      const stats = player.finalStats || player.stats || {};
      const values = statNames.map((name) => Number(stats[name] ?? 0)).filter((value) => Number.isFinite(value));
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    });
    return Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length);
  }

  function fiveMatchComparisonMarkup(userPlayers, opponentPlayers, summary = {}) {
    const rows = [
      ["Attacco", ["attack"], ["attack"]],
      ["Controllo", ["control"], ["control"]],
      ["Difesa", ["defense", "grit"], ["defense", "grit"]],
      ["Velocità", ["speed"], ["speed"]],
      ["Portiere", ["save"], ["save"]],
    ];
    const opponentName = summary.opponentName || "Svincolati";
    const contentId = summary.contentId || "five-match-values-content";
    const value = (key) => summary[key] ?? "-";
    return `<section class="five-match-values" data-values-panel>
      <button type="button" class="five-match-values-button" aria-expanded="false" aria-controls="${escapeHtml(contentId)}">
        <span class="five-match-value"><small>Forza</small><strong>${escapeHtml(value("userStrength"))}</strong></span>
        <span class="five-match-value five-match-value--accent"><small>Probabilità</small><strong>${escapeHtml(value("probability"))}%</strong></span>
        <span class="five-match-value"><small>Confronto</small><strong>${escapeHtml(value("userStrength"))}–${escapeHtml(value("opponentStrength"))}</strong></span>
        <span class="five-match-value"><small>Statistiche</small><strong>Dettagli</strong></span>
        <span class="five-match-values-toggle" aria-label="Apri statistiche" aria-hidden="true">+</span>
      </button>
      <div class="five-match-values-content" id="${escapeHtml(contentId)}" hidden>
        <div class="five-match-core-values">
          <div><span>La tua forza</span><strong>${escapeHtml(value("userStrength"))}</strong><small>${escapeHtml(value("userFormation"))} · OVR ${escapeHtml(value("userOverall"))}</small></div>
          <div class="five-match-probability"><span>Probabilità vittoria</span><strong>${escapeHtml(value("probability"))}%</strong><small>Dato usato dalla simulazione</small></div>
          <div><span>Forza ${escapeHtml(opponentName)}</span><strong>${escapeHtml(value("opponentStrength"))}</strong><small>${escapeHtml(value("opponentFormation"))} · OVR ${escapeHtml(value("opponentOverall"))}</small></div>
        </div>
        <div class="five-match-traits" aria-label="Valori tecnici, Tu e ${escapeHtml(opponentName)}">${rows.map(([label, userStats, opponentStats]) => {
        const userValue = fiveMatchStatAverage(userPlayers, userStats);
        const opponentValue = fiveMatchStatAverage(opponentPlayers, opponentStats);
        return `<div class="five-match-trait"><span>${escapeHtml(label)}</span><strong>${escapeHtml(userValue)}</strong><small>${escapeHtml(opponentValue)}</small></div>`;
      }).join("")}</div>
      </div>
    </section>`;
  }

  function formatMatchProbability(value) {
    const chance = Number(value);
    if (!Number.isFinite(chance)) return "-";
    return Number(chance.toFixed(1)).toLocaleString("it-IT", { maximumFractionDigits: 1 });
  }


    return {
      fiveFormationRows,
      fiveUserPlayersBySlot,
      fiveOpponentLevel,
      createOrLoadFiveMatch,
      fiveOpponentPlayersBySlot,
      fiveMatchCard,
      fiveMatchPlayerDetail,
      fiveMatchField,
      openFiveMatchPlayerSwap,
      fiveMatchStatAverage,
      fiveMatchComparisonMarkup,
      formatMatchProbability,
    };
  }

  global.FiveMatchPresentationRuntime = { create };
})(globalThis);
