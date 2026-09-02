(function (global) {
  "use strict";

  function create(d) {
    const ui = d.ui;
    const app = d.app;
    const document = global.document;
    const { persistGameplayMutation, recordGameplayFailure, fiveUserPlayersBySlot, fiveOpponentPlayersBySlot, normalizeTeamIdentity, specialMatchView, bossMatchTeamMeta, userTeamPlayers, bossTeamPlayers, toast, bossMatchStatusText, bossMatchTimeline, openModal, scrollSnapshot, formatMatchProbability, createOrLoadFiveMatch, ensureFiveVFive, teamById, escapeHtml, bossMatchAverage, fiveMatchField, fiveMatchComparisonMarkup, topbar, resetRenderedViewScroll, bindSectionRootNav, bindBottomNav, showPlayerDetails, showPlayerDetailsFor, bossMatchField, switchBossMatchTab, completeFiveMatch, completeSpecialMatch, completeBossMatch, recoverLegacyResolvedMatchRoutingIfNeeded, closeModal, resolvePendingRunFlow, navigateBossVictoryDestination, showSpecialMatchReward, renderGameOver, renderMap, hearts, openFiveMatchPlayerSwap, fiveMatchPlayerDetail, renderFiveVFive, renderMapFailureRecovery, getFreeAgentsDb } = d;
    const TEST_MATCH_CONTROLS_ENABLED = d.testMatchControlsEnabled;
    const DEV_MODE = d.devMode;
    let run = d.getRun();
    let seasonDb = d.getSeasonDb();
    const syncRun = () => { run = d.getRun(); seasonDb = d.getSeasonDb(); };
function openFiveMatchSimulationModal(match, userName, opponentName) {
    const matchIdentity = ["simulating", "completed"].includes(match?.simulation?.state) ? matchTransactionIdentity(match) : null;
    const resolved = ui.bossMatchState.startsWith("completed");
    const simulating = ui.bossMatchState === "simulating";
    const score = simulationScoreArray(match, resolved);
    const resultLabel = resolved ? (ui.bossMatchState.endsWith("victory") ? "Vittoria" : "Sconfitta") : simulating ? "In corso" : "Pronta";
    const scoreUserEmblem = global.TeamEmblems.teamEmblemMarkup(global.TeamEmblems.resolveTeamEmblem({ teamIdentity: normalizeTeamIdentity(run.teamIdentity), seasonId: run.seasonId, fallbackKind: "user" }), { escape: escapeHtml, className: "five-simulation-emblem" });
    const scoreOpponentEmblem = global.TeamEmblems.teamEmblemMarkup(global.TeamEmblems.resolveTeamEmblem({ specialType: "free-agents", fallbackKind: "free-agents" }), { escape: escapeHtml, className: "five-simulation-emblem" });
    openModal(`<div class="five-simulation-cabin" data-five-simulation-modal data-match-state="${escapeHtml(ui.bossMatchState)}">
      <header class="five-simulation-head"><p class="eyebrow">Cabina partita</p><h2>Simulazione 5v5</h2><strong class="five-simulation-state">${escapeHtml(resultLabel)}</strong></header>
      <section class="boss-match-result-panel five-simulation-score" aria-live="polite">
        <div class="five-match-result-row"><strong>${scoreUserEmblem}${escapeHtml(userName)}</strong><div class="boss-match-score" aria-label="${escapeHtml(`${userName} ${score[0]} - ${score[1]} ${opponentName}`)}"><span>${score[0]}</span><small>-</small><span>${score[1]}</span></div><strong>${escapeHtml(opponentName)}${scoreOpponentEmblem}</strong></div>
        <p>${escapeHtml(bossMatchStatusText())}</p>
      </section>
      <section class="five-simulation-events"><div class="panel-title-row"><h3>Cronaca eventi</h3><span class="match-state-badge">${simulating ? "Live" : resolved ? "Completa" : "In attesa"}</span></div><ol class="boss-match-log match-sim-log" tabindex="0" aria-label="Cronaca partita" aria-live="polite">${ui.bossMatchLog.length ? bossMatchTimeline() : `<li data-empty-log="true"><span>0'</span><b>⚽</b><p>Calcio d'inizio.</p></li>`}</ol></section>
      <footer class="five-simulation-actions"><button type="button" class="btn btn-secondary" id="skip-match-result" ${simulating ? "" : "hidden disabled"}>Vai al risultato</button><button type="button" class="btn btn-yellow btn-primary-action" id="continue-match-result" ${resolved ? "" : "hidden disabled"}>Torna alla mappa</button></footer>
    </div>`, { closeable: false, className: "five-simulation-modal", preserveScroll: scrollSnapshot() });
    document.getElementById("skip-match-result")?.addEventListener("click", skipMatchToResult);
    document.getElementById("continue-match-result")?.addEventListener("click", (event) => continueAfterMatch(event, matchIdentity));
  }

function clearMatchPlaybackTimer() {
    if (ui.matchPlaybackTimer) {
      clearTimeout(ui.matchPlaybackTimer);
      ui.matchPlaybackTimer = null;
    }
  }

function matchTransactionIdentity(match) {
    return { runId: String(run?.runId || ""), matchId: String(match?.matchId || ""), type: String(match?.type || "") };
  }

function canonicalMatchFor(current, identity) {
    const currentMatch = current?.activeMatch;
    if (!identity.runId || !identity.matchId || !identity.type
      || String(current?.runId || "") !== identity.runId
      || String(currentMatch?.matchId || "") !== identity.matchId
      || String(currentMatch?.type || "") !== identity.type) {
      throw Object.assign(new Error("Canonical match identity mismatch"), { code: "match-identity-mismatch" });
    }
    return currentMatch;
  }

function cloneMatchState(match) {
    return typeof structuredClone === "function" ? structuredClone(match) : JSON.parse(JSON.stringify(match));
  }

function commitMatchMutation(label, identity, mutate, options = {}) {
    syncRun();
    const result = persistGameplayMutation({
      label,
      mutate: (current) => mutate(canonicalMatchFor(current, identity), current),
      onCommitted: (value, current) => {
        ui.match = current.activeMatch;
        ui.bossMatchState = ui.match?.state || "pre-match";
        ui.bossMatchLog = ui.match?.log || [];
        options.onCommitted?.(value, current);
      },
      onMutationError: ({ error }) => {
        recordGameplayFailure(label, "mutation", error, "mutation");
        if (error?.code !== "match-identity-mismatch") console.error(`${label} mutation failed`, error);
      },
      rerender: ({ ok, run: recovered }) => {
        if (!ok) {
          ui.match = recovered?.activeMatch || null;
          ui.bossMatchState = ui.match?.state || "pre-match";
          ui.bossMatchLog = ui.match?.log || [];
        }
      },
    });
    syncRun();
    return result;
  }

function stopMatchAfterPersistenceFailure() {
    syncRun();
    clearMatchPlaybackTimer();
    ui.match = run?.activeMatch || null;
    ui.bossMatchState = ui.match?.state || "pre-match";
    ui.bossMatchLog = ui.match?.log || [];
    ui.matchStartLocked = false;
    ui.bossMatchResolving = false;
    updateMatchScoreDom(ui.match, ui.match?.simulation?.state === "completed");
    updateMatchControlsDom();
    return { ok: false, suspended: true };
  }

function matchSeed(match) {
    if (match.simulation?.seed && match.simulation?.state !== "pre-match") return match.simulation.seed;
    return `${run.runId}:${match.type}:${match.nodeId}:${match.attemptNumber || 1}`;
  }

function normalizedMatchPlayer(player) {
    return player ? { ...player, role: player.position, playerId: String(player.playerId) } : null;
  }

function matchLineupSignature(players) {
    return players.map((player) => [player.playerId, player.displayLevel ?? player.level ?? "", player.overall ?? player.finalOverall ?? ""].join(":")).join("|");
  }

function matchSnapshotFromTeam(team) {
    return {
      name: team.name,
      playerIds: team.players.map((player) => String(player.playerId)),
      lineupSignature: matchLineupSignature(team.players),
      players: team.players.map((player) => ({ ...player })),
    };
  }

function simulationTeamsForCurrentMatch(match, options = {}) {
    if (match.type === "five_v_five") {
      const userPlayersBySlot = fiveUserPlayersBySlot();
      const opponentPlayersBySlot = fiveOpponentPlayersBySlot(match);
      const userPlayers = Object.values(userPlayersBySlot).map(normalizedMatchPlayer).filter(Boolean);
      const opponentPlayers = Object.values(opponentPlayersBySlot).map(normalizedMatchPlayer).filter(Boolean);
      return {
        type: "five",
        userTeam: { name: normalizeTeamIdentity(run.teamIdentity).name || "La tua squadra", players: userPlayers },
        opponentTeam: { name: "Svincolati", players: opponentPlayers },
        userSnapshot: matchSnapshotFromTeam({ name: normalizeTeamIdentity(run.teamIdentity).name || "La tua squadra", players: userPlayers }),
      };
    }
    const specialOpponent = match.type === "special_match" ? specialMatchView.opponentMeta(match) : null;
    const boss = specialOpponent?.special || options.boss || seasonDb.bossOrder[run.bossIndex];
    const meta = specialOpponent ? { user: { name: normalizeTeamIdentity(run.teamIdentity).name, formation: run.formationId }, boss: { name: specialOpponent.name, formation: specialOpponent.formation } } : bossMatchTeamMeta(boss);
    const userPlayers = userTeamPlayers().map(normalizedMatchPlayer).filter(Boolean);
    const opponentPlayers = (specialOpponent ? specialOpponent.players : bossTeamPlayers(boss)).map(normalizedMatchPlayer).filter(Boolean);
    return {
      type: "eleven",
      userTeam: { name: meta.user.name, players: userPlayers, formationId: meta.user.formation },
      opponentTeam: { name: meta.boss.name, players: opponentPlayers, formationId: meta.boss.formation },
      userSnapshot: matchSnapshotFromTeam({ name: meta.user.name, players: userPlayers }),
    };
  }

function ensureMatchPreview(match, options = {}) {
    const existingState = match.simulation?.state || match.state || "pre-match";
    if (match.simulation?.valid && existingState !== "pre-match" && !options.forceRefresh) return match.simulation;
    const teams = simulationTeamsForCurrentMatch(match, options);
    // A pre-match preview is deliberately disposable: it is generated with the
    // shared `:preview` seed.  Freezing starts the real, attempt-specific match,
    // so it must never take this shortcut even when the lineup is unchanged.
    if (!options.freeze && match.simulation?.valid && existingState === "pre-match" && !options.forceRefresh && match.simulation.userSnapshot?.lineupSignature === teams.userSnapshot.lineupSignature) return match.simulation;
    const seed = options.freeze ? matchSeed(match) : (match.simulation?.seed || `${run.runId}:${match.type}:${match.nodeId}:preview`);
    const preview = global.MatchSimulator.simulate({ type: teams.type, seed, userTeam: teams.userTeam, opponentTeam: teams.opponentTeam, consecutiveLosses: run.consecutiveLosses });
    if (!preview.valid) return preview;
    match.simulation = {
      ...preview,
      seed: options.freeze ? seed : null,
      state: options.freeze ? "pre-match" : existingState,
      revealedCount: options.freeze ? 0 : (match.simulation?.revealedCount || 0),
      displayedScore: options.freeze ? { user: 0, opponent: 0 } : (match.simulation?.displayedScore || { user: 0, opponent: 0 }),
      resolutionApplied: options.freeze ? false : Boolean(match.simulation?.resolutionApplied),
      manuallyResolved: options.freeze ? false : Boolean(match.simulation?.manuallyResolved),
      userSnapshot: teams.userSnapshot,
    };
    if (options.freeze) match.matchId = global.RunStatistics?.createStableMatchId?.(run, { ...match, simulation: { seed } }) || match.matchId;
    match.lineupSnapshot = teams.userSnapshot;
    match.userPlayerIds = teams.userSnapshot.playerIds.slice();
    match.userStrength = match.simulation.userStrength;
    match.probabilities = match.simulation.probabilities;
    match.score = [match.simulation.displayedScore.user, match.simulation.displayedScore.opponent];
    return match.simulation;
  }

function simulationScoreArray(match, completed = false) {
    const sim = match?.simulation;
    if (!sim?.valid) return match?.score || [0, 0];
    const source = completed || sim.state === "completed" ? sim.score : sim.displayedScore;
    return [source.user, source.opponent];
  }

function visibleTimeline(match) {
    const sim = match?.simulation;
    if (!sim?.valid) return ui.bossMatchLog || [];
    return sim.timeline.slice(0, sim.revealedCount).map(matchEventView);
  }

function matchEventSideClass(side) {
    return side === "user" ? "match-event--user" : side === "opponent" ? "match-event--opponent" : "match-event--neutral";
  }

function matchEventView(ev) {
    return { minute: `${ev.minute}'`, icon: ({goal:"⚽",save:"🧤",counter:"⚡",long_shot:"🎯",post:"🥅",crossbar:"🥅",shot:"👟",defensive_stop:"🛡️",first_half_start:"▶",second_half_start:"▶"})[ev.type] || "•", text: ev.text, side: ev.team === "user" || ev.team === "opponent" ? ev.team : null };
  }

function appendMatchLogEvent(event) {
    const log = document.querySelector(".match-sim-log");
    if (!log) return false;
    if (log.querySelector("[data-empty-log]")) log.innerHTML = "";
    const li = document.createElement("li");
    li.className = matchEventSideClass(event.side);
    const minute = document.createElement("span");
    const icon = document.createElement("b");
    const text = document.createElement("p");
    minute.textContent = event.minute;
    icon.textContent = event.icon;
    text.textContent = event.text;
    li.append(minute, icon, text);
    log.appendChild(li);
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    return true;
  }

function appendMissingMatchLogEvents(events) {
    const log = document.querySelector(".match-sim-log");
    if (!log) return false;
    if (log.querySelector("[data-empty-log]")) log.innerHTML = "";
    const fragment = document.createDocumentFragment();
    events.forEach((event) => {
      const li = document.createElement("li");
      li.className = matchEventSideClass(event.side);
      const minute = document.createElement("span");
      const icon = document.createElement("b");
      const text = document.createElement("p");
      minute.textContent = event.minute;
      icon.textContent = event.icon;
      text.textContent = event.text;
      li.append(minute, icon, text);
      fragment.appendChild(li);
    });
    log.appendChild(fragment);
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
    return true;
  }

function syncCommittedFinalMatchLog() {
    const canonicalLog = ui.match?.log || ui.bossMatchLog || [];
    const event = canonicalLog[canonicalLog.length - 1];
    if (event?.minute !== "FT") return false;
    const last = document.querySelector(".match-sim-log li:last-child");
    if (last?.querySelector("span")?.textContent === event.minute && last?.querySelector("p")?.textContent === event.text) return true;
    return appendMatchLogEvent(event);
  }

function updateMatchScoreDom(match, completed = false) {
    const score = simulationScoreArray(match, completed);
    const values = document.querySelectorAll(".boss-match-score span");
    if (values[0]) values[0].textContent = score[0];
    if (values[1]) values[1].textContent = score[1];
  }

function updateMatchControlsDom() {
    const state = ui.bossMatchState;
    const completed = ui.match?.simulation?.state === "completed" || state.startsWith("completed");
    const resolutionApplied = ui.match?.simulation?.resolutionApplied === true;
    const resolved = completed && resolutionApplied;
    const unresolved = completed && !resolutionApplied;
    const simulating = state === "simulating";
    const simulate = document.getElementById("simulate-boss-match");
    const skip = document.getElementById("skip-match-result");
    const cont = document.getElementById("continue-match-result");
    const editFive = document.getElementById("edit-five-team");
    const status = document.querySelector(".boss-match-result-panel p");
    const simulationModal = document.querySelector("[data-five-simulation-modal]");
    const simulationState = simulationModal?.querySelector(".five-simulation-state");
    const simulationBadge = simulationModal?.querySelector(".match-state-badge");
    if (simulate) {
      simulate.disabled = Boolean(ui.matchStartLocked) || simulating || completed;
      simulate.textContent = ui.matchStartLocked ? "Avvio..." : simulating ? "Simulazione..." : completed ? "Risultato definitivo" : "Simula partita";
    }
    if (editFive) {
      const activeFiveMatch = ui.match?.type === "five_v_five" ? ui.match : null;
      const canEditFiveMatch = activeFiveMatch?.state === "pre-match"
        && ui.bossMatchState === "pre-match"
        && (!activeFiveMatch.simulation || activeFiveMatch.simulation.state === "pre-match");
      editFive.disabled = !canEditFiveMatch;
    }
    if (skip) {
      skip.hidden = !simulating;
      skip.disabled = !simulating;
    }
    if (cont) {
      cont.dataset.resolvedLabel ||= cont.textContent;
      cont.hidden = !completed;
      cont.disabled = !completed || (resolved && Boolean(ui.match?.postMatchNavigationApplied));
      cont.textContent = unresolved ? "Riprova finalizzazione" : cont.dataset.resolvedLabel;
    }
    if (status) status.textContent = bossMatchStatusText();
    if (simulationModal) { simulationModal.dataset.matchState = state; simulationModal.dataset.resolutionApplied = String(resolutionApplied); }
    if (simulationState) simulationState.textContent = completed ? (state.endsWith("victory") ? "Vittoria" : "Sconfitta") : simulating ? "In corso" : "Pronta";
    if (simulationBadge) simulationBadge.textContent = simulating ? "Live" : completed ? "Completa" : "In attesa";
  }

function stepMatchPlayback() {
    syncRun();
    ui.matchPlaybackTimer = null;
    const match = run?.activeMatch;
    const sim = match?.simulation;
    if (!sim || sim.state !== "simulating" || sim.manuallyResolved) return;
    const identity = matchTransactionIdentity(match);
    if (sim.revealedCount >= sim.timeline.length) {
      const completed = commitMatchMutation("match-playback-completed", identity, (currentMatch) => {
        const currentSim = currentMatch.simulation;
        if (currentSim?.state !== "simulating" || currentSim.revealedCount < currentSim.timeline.length) throw new Error("Match is not ready for completion");
        currentSim.state = "completed";
        currentSim.displayedScore = { ...currentSim.score };
        currentMatch.score = [currentSim.score.user, currentSim.score.opponent];
        currentMatch.state = currentSim.winner === "user" ? "completed-victory" : "completed-defeat";
      });
      if (!completed.ok) return stopMatchAfterPersistenceFailure();
      updateMatchScoreDom(ui.match, true);
      updateMatchControlsDom();
      return applySimulationResolution(ui.match);
    }
    const committed = commitMatchMutation("match-playback-event", identity, (currentMatch) => {
      const currentSim = currentMatch.simulation;
      if (currentSim?.state !== "simulating" || currentSim.revealedCount >= currentSim.timeline.length) throw new Error("Match playback cursor changed");
      const event = currentSim.timeline[currentSim.revealedCount];
      currentSim.revealedCount += 1;
      if (event.type === "goal") currentSim.displayedScore[event.team] += 1;
      currentMatch.score = [currentSim.displayedScore.user, currentSim.displayedScore.opponent];
      const view = matchEventView(event);
      currentMatch.log = [...(currentMatch.log || []), view];
      return view;
    });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    appendMatchLogEvent(committed.value);
    updateMatchScoreDom(ui.match);
    updateMatchControlsDom();
    document.getElementById(ui.match.type === "five_v_five" ? "five-match-log-panel" : "")?.scrollIntoView({ block: "nearest" });
    ui.matchPlaybackTimer = setTimeout(stepMatchPlayback, global.MatchSimulatorConfig.eventDelayMs || global.MatchSimulatorConfig.playbackMs);
  }

function startMatchSimulation(match, options = {}) {
    syncRun();
    if (ui.matchStartLocked) return { ok: false, reason: "already-starting" };
    const identity = matchTransactionIdentity(match);
    let liveMatch;
    try {
      liveMatch = canonicalMatchFor(run, identity);
    } catch (error) {
      return { ok: false, reason: "identity-mismatch", error };
    }
    if (liveMatch.simulation?.state === "simulating") return { ok: false, reason: "already-starting" };
    if (liveMatch.simulation?.state && liveMatch.simulation.state !== "pre-match") return { ok: false, reason: "invalid-state" };
    ui.matchStartLocked = true;
    updateMatchControlsDom();
    let frozenMatch;
    try {
      frozenMatch = cloneMatchState(liveMatch);
      const sim = ensureMatchPreview(frozenMatch, { ...options, forceRefresh: false, freeze: true });
      if (!sim.valid) {
        ui.matchStartLocked = false;
        updateMatchControlsDom();
        toast(sim.message || "Formazione non valida: impossibile simulare.");
        return { ok: false, reason: "invalid-lineup" };
      }
    } catch (error) {
      console.error("Match simulation failed to start", error);
      ui.matchStartLocked = false;
      updateMatchControlsDom();
      toast("Errore tecnico: impossibile avviare la simulazione.");
      return { ok: false, reason: "simulation-error", error };
    }
    const sim = frozenMatch.simulation;
    sim.seed = sim.seed || matchSeed(frozenMatch);
    sim.state = "simulating";
    sim.revealedCount = 0;
    sim.displayedScore = { user: 0, opponent: 0 };
    sim.resolutionApplied = false;
    frozenMatch.state = "simulating";
    frozenMatch.log = [];
    frozenMatch.score = [0, 0];
    const committed = commitMatchMutation("match-simulation-start", identity, (currentMatch) => {
      Object.keys(currentMatch).forEach((key) => { delete currentMatch[key]; });
      Object.assign(currentMatch, cloneMatchState(frozenMatch));
    });
    if (!committed.ok) {
      clearMatchPlaybackTimer();
      ui.matchStartLocked = false;
      updateMatchControlsDom();
      return stopMatchAfterPersistenceFailure();
    }
    clearMatchPlaybackTimer();
    ui.matchStartLocked = false;
    updateMatchControlsDom();
    document.getElementById(ui.match?.type === "five_v_five" ? "five-match-log-panel" : "")?.scrollIntoView({ block: "nearest" });
    ui.matchPlaybackTimer = setTimeout(stepMatchPlayback, global.MatchSimulatorConfig.eventDelayMs || global.MatchSimulatorConfig.playbackMs);
    return { ok: true, match: ui.match };
  }

function resumeMatchSimulationIfNeeded(match) {
    syncRun();
    const sim = match?.simulation;
    if (!sim) return;
    if (sim.state === "completed" && sim.resolutionApplied !== true) {
      clearMatchPlaybackTimer();
      return applySimulationResolution(run?.activeMatch);
    }
    if (sim.state !== "simulating") return;
    clearMatchPlaybackTimer();
    ui.matchPlaybackTimer = setTimeout(stepMatchPlayback, global.MatchSimulatorConfig.eventDelayMs || global.MatchSimulatorConfig.playbackMs);
  }

function skipMatchToResult(event) {
    syncRun();
    event?.preventDefault();
    const match = run?.activeMatch;
    const sim = match?.simulation;
    if (!sim || sim.state !== "simulating" || sim.manuallyResolved) return;
    clearMatchPlaybackTimer();
    const missing = sim.timeline.slice(sim.revealedCount).map(matchEventView);
    const identity = matchTransactionIdentity(match);
    const committed = commitMatchMutation("match-playback-skip", identity, (currentMatch) => {
      const currentSim = currentMatch.simulation;
      if (currentSim?.state !== "simulating") throw new Error("Match is not simulating");
      currentSim.revealedCount = currentSim.timeline.length;
      currentSim.displayedScore = { ...currentSim.score };
      currentSim.state = "completed";
      currentMatch.score = [currentSim.score.user, currentSim.score.opponent];
      currentMatch.state = currentSim.winner === "user" ? "completed-victory" : "completed-defeat";
      currentMatch.log = currentSim.timeline.map(matchEventView);
    });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    appendMissingMatchLogEvents(missing);
    updateMatchScoreDom(ui.match, true);
    updateMatchControlsDom();
    document.getElementById(ui.match.type === "five_v_five" ? "five-match-result-panel" : "")?.scrollIntoView({ block: "nearest" });
    applySimulationResolution(ui.match);
  }

function applySimulationResolution(match) {
    const sim = match?.simulation;
    if (!sim || sim.resolutionApplied || sim.manuallyResolved) return;
    return sim.winner === "user" ? (match.type === "five_v_five" ? completeFiveMatch("victory") : match.type === "special_match" ? completeSpecialMatch("victory") : completeBossMatch("victory")) : (match.type === "five_v_five" ? completeFiveMatch("defeat") : match.type === "special_match" ? completeSpecialMatch("defeat") : completeBossMatch("defeat"));
  }

function forceMatchOutcome(result, options = {}) {
    syncRun();
    const match = run?.activeMatch;
    if (!match || ui.matchStartLocked || match.simulation?.resolutionApplied) return;
    ui.matchStartLocked = true;
    updateMatchControlsDom();
    try {
      clearMatchPlaybackTimer();
      const frozenMatch = cloneMatchState(match);
      const sim = ensureMatchPreview(frozenMatch, { ...options, forceRefresh: !frozenMatch.simulation?.valid, freeze: true });
      if (!sim.valid) {
        ui.matchStartLocked = false;
        updateMatchControlsDom();
        return toast(sim.message || "Formazione non valida: impossibile forzare il risultato.");
      }
      const winner = result === "victory" ? "user" : "opponent";
      sim.forcedOutcome = winner === "user" ? "win" : "loss";
      sim.testControl = true;
      sim.state = "completed";
      sim.winner = winner;
      sim.revealedCount = sim.timeline?.length || 0;
      const currentUser = Number(sim.score?.user ?? 0);
      const currentOpponent = Number(sim.score?.opponent ?? 0);
      if (winner === "user" && currentUser <= currentOpponent) sim.score = { user: currentOpponent + 1, opponent: currentOpponent };
      if (winner === "opponent" && currentOpponent <= currentUser) sim.score = { user: currentUser, opponent: currentUser + 1 };
      sim.displayedScore = { ...sim.score };
      frozenMatch.score = [sim.score.user, sim.score.opponent];
      frozenMatch.forcedOutcome = sim.forcedOutcome;
      frozenMatch.testControl = true;
      frozenMatch.log = visibleTimeline(frozenMatch);
      frozenMatch.state = winner === "user" ? "completed-victory" : "completed-defeat";
      const identity = matchTransactionIdentity(match);
      const committed = commitMatchMutation("match-forced-outcome", identity, (currentMatch) => {
        Object.keys(currentMatch).forEach((key) => { delete currentMatch[key]; });
        Object.assign(currentMatch, cloneMatchState(frozenMatch));
      });
      if (!committed.ok) return stopMatchAfterPersistenceFailure();
      appendMissingMatchLogEvents(ui.bossMatchLog);
      updateMatchScoreDom(ui.match, true);
      updateMatchControlsDom();
      return applySimulationResolution(ui.match);
    } catch (error) {
      console.error("Forced match outcome failed", error);
      toast("Errore tecnico: impossibile forzare il risultato.");
    } finally {
      ui.matchStartLocked = false;
      updateMatchControlsDom();
    }
  }

function renderMatch(options = {}) {
    syncRun();
    const legacyRecovery = recoverLegacyResolvedMatchRoutingIfNeeded(run?.activeMatch);
    const allowAutomaticResume = options.allowAutomaticResume !== false && legacyRecovery.ok;
    ui.match = run?.activeMatch || ui.match;
    // Legacy boss resume identity: const boss = seasonDb.bossOrder[Number(ui.match?.bossIndex ?? run.bossIndex)];
    const isSpecial = ui.match?.type === "special_match";
    const specialOpponent = isSpecial ? specialMatchView.opponentMeta(ui.match) : null;
    const boss = specialOpponent?.special || seasonDb.bossOrder[Number(ui.match?.bossIndex ?? run.bossIndex)];
    const isBoss = ui.match?.type === "boss";
    if (!isBoss && !isSpecial) {
      const match = createOrLoadFiveMatch({ id: ui.match?.nodeId });
      ui.match = match;
      run.activeMatch = match;
      ui.bossMatchState = match.state || ui.bossMatchState || "pre-match";
      ui.bossMatchLog = match.log || ui.bossMatchLog || [];
      ensureFiveVFive();
      const userPlayersBySlot = fiveUserPlayersBySlot();
      const opponentPlayersBySlot = fiveOpponentPlayersBySlot(match);
      const identity = normalizeTeamIdentity(run.teamIdentity);
      const userName = identity.name || "La tua squadra";
      const opponentTeamId = match.opponentTeamId || null;
      const opponentTeam = opponentTeamId ? teamById(opponentTeamId) : null;
      const opponentName = opponentTeam?.teamName || opponentTeam?.name || "Svincolati";
      const userEmblem = global.TeamEmblems.resolveTeamEmblem({ teamIdentity: identity, seasonId: run.seasonId, fallbackKind: "user" });
      const opponentEmblem = global.TeamEmblems.resolveTeamEmblem(opponentTeamId
        ? { teamId: opponentTeamId, team: opponentTeam, seasonId: run.seasonId, fallbackKind: "neutral" }
        : { specialType: "free-agents", fallbackKind: "free-agents" });
      const userEmblemMarkup = global.TeamEmblems.teamEmblemMarkup(userEmblem, { escape: escapeHtml, className: "five-match-emblem" });
      const opponentEmblemMarkup = global.TeamEmblems.teamEmblemMarkup(opponentEmblem, { escape: escapeHtml, className: "five-match-emblem" });
      // Rendering is a read boundary. Preview generation may decorate its input,
      // therefore it must only ever receive a disposable match snapshot.
      const previewMatch = cloneMatchState(match);
      const simPreview = ensureMatchPreview(previewMatch);
      const userFivePlayers = Object.values(userPlayersBySlot).filter(Boolean);
      const opponentFivePlayers = Object.values(opponentPlayersBySlot).filter(Boolean);
      const userAverageOverall = simPreview.userStrength?.averageOverall ? Math.round(simPreview.userStrength.averageOverall) : bossMatchAverage(userFivePlayers) || "-";
      const opponentAverageOverall = simPreview.opponentStrength?.averageOverall ? Math.round(simPreview.opponentStrength.averageOverall) : bossMatchAverage(opponentFivePlayers) || "-";
      const simError = !simPreview.valid ? simPreview.message : "";
      ui.bossMatchLog = match.log?.length ? match.log : visibleTimeline(match);
      const activeSide = ui.fiveMatchTab === "opponent" ? "opponent" : "user";
      const resolved = ui.bossMatchState.startsWith("completed");
      const simulating = ui.bossMatchState === "simulating";
      const canEditFiveMatch = match.state === "pre-match"
        && ui.bossMatchState === "pre-match"
        && (!match.simulation || match.simulation.state === "pre-match");
      app.innerHTML = `
        <main class="screen five-match-screen" data-match-state="${escapeHtml(ui.bossMatchState)}">
          ${topbar("Partita 5v5", "", "match")}
          <div class="content five-match-content">
            <section class="five-match-hero">
              <div class="five-match-hero-band">
                <div class="five-match-header-main"><p class="eyebrow">Match rapido</p><h1>Partita 5v5</h1><strong>${resolved ? "Completata" : simulating ? "In corso" : "Preparazione"}</strong></div>
                <span class="five-match-duration">30 <small>minuti</small></span>
              </div>
              <div class="five-match-vs">
                <div class="five-match-team"><strong>${escapeHtml(userName)}</strong><span class="five-match-logo">${userEmblemMarkup}</span><small>${escapeHtml(run.fiveVFive.formation)} · OVR ${escapeHtml(userAverageOverall)} · Forza ${escapeHtml(simPreview.userStrength?.final ?? "-")}</small></div>
                <span class="five-match-vs-badge">VS</span>
                <div class="five-match-team"><strong>${escapeHtml(opponentName)}</strong><span class="five-match-logo">${opponentEmblemMarkup}</span><small>${escapeHtml(match.opponentFormation)} · OVR ${escapeHtml(opponentAverageOverall)} · Forza ${escapeHtml(simPreview.opponentStrength?.final ?? "-")}</small></div>
              </div>
            </section>
            <section class="five-match-pitch-panel">
              <div class="five-match-section-head">
                <h2>Campo tattico</h2>
                <div class="five-match-tabs" role="tablist" aria-label="Squadra visualizzata">
                  <button type="button" class="five-match-team-tab ${activeSide === "user" ? "active" : ""}" data-five-match-tab="user">Tua squadra</button>
                  <button type="button" class="five-match-team-tab ${activeSide === "opponent" ? "active" : ""}" data-five-match-tab="opponent">Avversario</button>
                </div>
                <span class="five-match-formation-badge">${escapeHtml(activeSide === "opponent" ? match.opponentFormation : run.fiveVFive.formation)}</span>
              </div>
              <div class="five-match-field" aria-label="Campo partita 5v5">
                <div class="five-match-mobile-field">${fiveMatchField(activeSide === "opponent" ? opponentPlayersBySlot : userPlayersBySlot, activeSide === "opponent" ? match.opponentFormation : run.fiveVFive.formation, activeSide, true)}</div>
                <aside class="five-match-player-detail" data-five-player-detail hidden aria-live="polite"></aside>
              </div>
            </section>
            <section class="five-match-summary" aria-label="Riepilogo partita 5v5">
              ${fiveMatchComparisonMarkup(userFivePlayers, opponentFivePlayers, { userStrength: simPreview.userStrength?.final ?? "-", userFormation: run.fiveVFive.formation, userOverall: userAverageOverall, probability: formatMatchProbability(simPreview.probabilities?.userChance), opponentStrength: simPreview.opponentStrength?.final ?? "-", opponentFormation: match.opponentFormation, opponentOverall: opponentAverageOverall })}
            </section>
            ${simError ? `<div class="match-sim-error">${escapeHtml(simError)}</div>` : ""}
          </div>
          <section class="panel five-match-controls five-v-five-mobile-actions" aria-label="Azioni partita 5v5">
            <header class="five-match-actions-heading"><span>Azioni partita</span><i aria-hidden="true"></i></header>
            <div class="five-match-primary-actions">
              <button type="button" class="btn five-match-action-cta five-match-action-cta--primary" id="simulate-boss-match" ${simulating || resolved ? "disabled" : ""}>
                <span class="five-match-action-icon" aria-hidden="true"><i class="five-match-play-icon"></i></span>
                <span class="five-match-action-copy"><strong>Simula partita</strong><small>Avvia la simulazione</small></span>
                <span class="five-match-action-mark" aria-hidden="true">›</span>
              </button>
              <button type="button" class="btn five-match-action-cta five-match-action-cta--secondary" id="edit-five-team" ${canEditFiveMatch ? "" : "disabled"}>
                <span class="five-match-action-icon" aria-hidden="true"><i class="five-match-tactics-icon">×</i></span>
                <span class="five-match-action-copy"><strong>Modifica squadra</strong><small>Gestisci titolari</small></span>
                <span class="five-match-action-mark" aria-hidden="true">›</span>
              </button>
            </div>
            ${TEST_MATCH_CONTROLS_ENABLED ? `<div class="match-test-tools"><span>Strumenti di test</span><div class="five-match-test-actions"><button type="button" class="btn btn-tool" id="test-win" ${resolved ? "disabled" : ""}>Vittoria sicura</button>${DEV_MODE ? `<button type="button" class="btn btn-danger" id="test-loss" ${resolved ? "disabled" : ""}>Sconfitta forzata</button>` : ""}</div></div>` : ""}
          </section>
        </main>`;
      resetRenderedViewScroll();
      bindSectionRootNav();
      bindBottomNav();
      document.querySelectorAll("[data-five-match-tab]").forEach((button) => button.addEventListener("click", () => {
        closeFiveMatchPlayerDetail();
        ui.fiveMatchTab = button.dataset.fiveMatchTab;
        document.querySelectorAll("[data-five-match-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.fiveMatchTab === ui.fiveMatchTab));
        const mobileField = document.querySelector(".five-match-mobile-field");
        if (mobileField) mobileField.innerHTML = ui.fiveMatchTab === "opponent"
          ? fiveMatchField(opponentPlayersBySlot, match.opponentFormation, "opponent", true)
          : fiveMatchField(userPlayersBySlot, run.fiveVFive.formation, "user", true);
        const formationBadge = document.querySelector(".five-match-formation-badge");
        if (formationBadge) formationBadge.textContent = ui.fiveMatchTab === "opponent" ? match.opponentFormation : run.fiveVFive.formation;
        bindFiveMatchPlayerButtons();
      }));
      const closeFiveMatchPlayerDetail = () => {
        const detail = document.querySelector("[data-five-player-detail]");
        if (detail) { detail.hidden = true; detail.innerHTML = ""; }
        document.querySelectorAll("[data-five-match-player]").forEach((card) => { card.classList.remove("is-active"); card.setAttribute("aria-pressed", "false"); });
      };
      const positionFiveMatchPlayerDetail = (button, detail) => {
        const field = detail.closest(".five-match-field");
        if (!field) return;
        const fieldRect = field.getBoundingClientRect();
        const cardRect = button.getBoundingClientRect();
        const panelWidth = detail.offsetWidth;
        const panelHeight = detail.offsetHeight;
        const gap = 10;
        const right = cardRect.right - fieldRect.left + gap;
        const left = cardRect.left - fieldRect.left - panelWidth - gap;
        const preferredLeft = right + panelWidth <= fieldRect.width - 6 ? right : left;
        const maxLeft = Math.max(6, fieldRect.width - panelWidth - 6);
        const top = Math.min(Math.max(6, cardRect.top - fieldRect.top + (cardRect.height - panelHeight) / 2), Math.max(6, fieldRect.height - panelHeight - 6));
        detail.style.setProperty("--five-detail-left", `${Math.min(Math.max(6, preferredLeft), maxLeft)}px`);
        detail.style.setProperty("--five-detail-top", `${top}px`);
        detail.dataset.placement = preferredLeft === right ? "right" : "left";
      };
      const bindFiveMatchPlayerButtons = () => document.querySelectorAll("[data-five-match-slot]").forEach((button) => {
        if (button.dataset.boundFiveMatchPlayer === "1") return;
        button.dataset.boundFiveMatchPlayer = "1";
        button.addEventListener("click", () => {
          const id = button.dataset.fiveMatchPlayer;
          const slotKey = button.dataset.fiveMatchSlot;
          const side = button.dataset.fiveMatchSide;
          if (side === "user" && openFiveMatchPlayerSwap(slotKey, match)) return;
          const players = side === "user" ? userPlayersBySlot : opponentPlayersBySlot;
          const player = Object.values(players).find((candidate) => String(candidate?.playerId) === String(id));
          const detail = document.querySelector("[data-five-player-detail]");
          if (!player || !detail) return;
          document.querySelectorAll("[data-five-match-player]").forEach((card) => { card.classList.toggle("is-active", card === button); card.setAttribute("aria-pressed", card === button ? "true" : "false"); });
          detail.innerHTML = fiveMatchPlayerDetail(player, side);
          detail.hidden = false;
          positionFiveMatchPlayerDetail(button, detail);
          detail.querySelector("[data-five-detail-close]")?.addEventListener("click", closeFiveMatchPlayerDetail);
          detail.querySelector("[data-five-detail-sheet]")?.addEventListener("click", () => side === "user"
            ? showPlayerDetails(id)
            : showPlayerDetailsFor(player, { playerId: id, level: player.displayLevel, database: getFreeAgentsDb(), preserveScroll: scrollSnapshot() }));
        });
      });
      bindFiveMatchPlayerButtons();
      document.querySelector(".five-match-values-button")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        const content = document.getElementById(button.getAttribute("aria-controls"));
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", expanded ? "false" : "true");
        if (content) content.hidden = expanded;
      });
      document.getElementById("edit-five-team").addEventListener("click", (event) => {
        event.preventDefault();
        const button = event.currentTarget;
        if (button.disabled) return;
        const activeMatch = run?.activeMatch;
        const editable = activeMatch?.type === "five_v_five"
          && activeMatch.state === "pre-match"
          && ui.bossMatchState === "pre-match"
          && (!activeMatch.simulation || activeMatch.simulation.state === "pre-match");
        if (!editable) { button.disabled = true; return; }
        button.disabled = true;
        const capturedScroll = scrollSnapshot();
        const identity = matchTransactionIdentity(activeMatch);
        const committed = commitMatchMutation("five-match-edit-entry", identity, (currentMatch, current) => {
          if (currentMatch.state !== "pre-match" || (currentMatch.simulation && currentMatch.simulation.state !== "pre-match")) {
            throw Object.assign(new Error("5v5 match is no longer editable"), { code: "five-match-edit-locked" });
          }
          currentMatch.returnScroll = capturedScroll;
          current.phase = "five";
          return { type: currentMatch.type, nodeId: currentMatch.nodeId, scroll: capturedScroll };
        });
        if (!committed.ok) return renderMapFailureRecovery();
        ui.returnToMatchContext = committed.value;
        return renderFiveVFive({ persist: false, returnToMatch: true });
      });
      document.getElementById("test-win")?.addEventListener("click", (event) => { event.preventDefault(); openFiveMatchSimulationModal(match, userName, opponentName); forceMatchOutcome("victory"); });
      document.getElementById("test-loss")?.addEventListener("click", (event) => { event.preventDefault(); openFiveMatchSimulationModal(match, userName, opponentName); forceMatchOutcome("defeat"); });
      document.getElementById("simulate-boss-match").addEventListener("click", (event) => {
        event.preventDefault();
        const started = startMatchSimulation(match);
        if (started?.ok) openFiveMatchSimulationModal(started.match, userName, opponentName);
      });
      if (simulating || resolved) openFiveMatchSimulationModal(match, userName, opponentName);
      if (allowAutomaticResume) resumeMatchSimulationIfNeeded(run?.activeMatch);
      return;
    }

    const userPlayers = userTeamPlayers();
    const bossPlayers = isSpecial ? specialOpponent.players : bossTeamPlayers(boss);
    const meta = isSpecial ? { user: { name: normalizeTeamIdentity(run.teamIdentity).name, logoUrl: "", formation: run.formationId, level: run.teamLevel }, boss: { name: specialOpponent.name, logoUrl: specialOpponent.logoUrl, formation: specialOpponent.formation, level: specialOpponent.level } } : bossMatchTeamMeta(boss);
    const userAverage = bossMatchAverage(userPlayers);
    const bossAverage = bossMatchAverage(bossPlayers);
    const userEmblem = global.TeamEmblems.resolveTeamEmblem({ teamIdentity: normalizeTeamIdentity(run.teamIdentity), seasonId: run.seasonId, fallbackKind: "user" });
    const userEmblemMarkup = global.TeamEmblems.teamEmblemMarkup(userEmblem, { escape: escapeHtml, className: "boss-match-emblem" });
    const activeSide = ui.bossMatchTab === "boss" ? "boss" : "user";
    const resolved = ui.bossMatchState.startsWith("completed");
    const simulating = ui.bossMatchState === "simulating";
    const previewMatch = cloneMatchState(ui.match);
    const simPreview = ensureMatchPreview(previewMatch, { boss });
    const simError = !simPreview.valid ? simPreview.message : "";
    const userProbability = simPreview.probabilities ? formatMatchProbability(simPreview.probabilities.userChance) : null;
    const bossProbability = simPreview.probabilities ? formatMatchProbability(simPreview.probabilities.opponentChance) : null;
    ui.bossMatchLog = ui.match.log?.length ? ui.match.log : visibleTimeline(ui.match);
    const score = simulationScoreArray(ui.match, resolved);
    const scoreLabel = `${meta.user.name} ${score[0]} - ${score[1]} ${meta.boss.name}`;
    const bossStatusLabel = resolved ? (ui.bossMatchState.endsWith("victory") ? "Vittoria" : "Sconfitta") : simulating ? "In corso" : "Preparazione";
    const outcomeClass = resolved ? (ui.bossMatchState.endsWith("victory") ? "boss-match-result-panel--victory" : "boss-match-result-panel--defeat") : "";

    app.innerHTML = `
      <main class="screen boss-match-screen" data-match-state="${ui.bossMatchState}">
        ${topbar(isSpecial ? "Partita speciale" : "Sfida Boss", "", "match")}
        <div class="content boss-match-content">
          <section class="boss-match-hero panel">
            <div class="boss-match-hero-band">
              <div class="boss-match-heading"><p class="eyebrow">Match 11v11</p><h2>${isSpecial ? "Partita speciale" : "Sfida Boss"}</h2></div>
              <span class="boss-match-duration">90 <small>minuti</small></span>
            </div>
            <div class="boss-match-vs" aria-label="Presentazione squadre">
              <div class="boss-match-team"><span class="boss-match-logo">${userEmblemMarkup}</span><strong>${escapeHtml(meta.user.name)}</strong></div>
              <span class="boss-match-vs-badge">VS</span>
              <div class="boss-match-team boss-match-team--boss"><span class="boss-match-logo">${meta.boss.logoUrl ? `<img src="${escapeHtml(meta.boss.logoUrl)}" alt="Stemma ${escapeHtml(meta.boss.name)}" />` : ""}</span><strong>${escapeHtml(meta.boss.name)}</strong><small>${isSpecial ? "Livello" : "Boss Lv"} ${escapeHtml(meta.boss.level)}</small></div>
            </div>
          </section>

          <section class="panel boss-match-pitch-panel" aria-label="Formazioni 11v11">
            <div class="boss-match-section-head">
              <div><p class="eyebrow">Formazioni 11v11</p><h3>Campo tattico</h3></div>
              <span>11 CONTRO 11</span>
            </div>
            <div class="boss-match-tabs" role="tablist" aria-label="Squadra visualizzata">
              <button type="button" class="boss-match-team-tab ${activeSide === "user" ? "active" : ""}" role="tab" aria-selected="${activeSide === "user"}" data-boss-tab="user">La tua squadra</button>
              <button type="button" class="boss-match-team-tab ${activeSide === "boss" ? "active" : ""}" role="tab" aria-selected="${activeSide === "boss"}" data-boss-tab="boss">${isSpecial ? "Avversari" : "Boss"}</button>
            </div>
            <div class="boss-match-field" aria-label="Campo boss match" data-active-boss-side="${escapeHtml(activeSide)}">
              <div class="boss-match-half-label boss-match-half-label--active">${escapeHtml(activeSide === "boss" ? meta.boss.name : meta.user.name)}</div>
              ${bossMatchField({ players: userPlayers, formationId: run.formationId }, "user", false, activeSide !== "user")}
              ${bossMatchField({ players: bossPlayers, formationId: isSpecial ? boss.matchFormation : boss.bossFormation }, "boss", false, activeSide !== "boss")}
              <div class="boss-match-mobile-field">
                ${bossMatchField({ players: userPlayers, formationId: run.formationId }, "user", true, activeSide !== "user")}
                ${bossMatchField({ players: bossPlayers, formationId: isSpecial ? boss.matchFormation : boss.bossFormation }, "boss", true, activeSide !== "boss")}
              </div>
            </div>
          </section>

          <section class="boss-match-summary" aria-label="${isSpecial ? "Riepilogo essenziale della partita speciale" : "Riepilogo essenziale della sfida Boss"}">
            ${fiveMatchComparisonMarkup(userPlayers, bossPlayers, { contentId: "boss-match-values-content", opponentName: meta.boss.name, userStrength: simPreview.userStrength?.final ?? "-", userFormation: meta.user.formation, userOverall: userAverage || "-", probability: userProbability ?? "-", opponentStrength: simPreview.opponentStrength?.final ?? "-", opponentFormation: meta.boss.formation, opponentOverall: bossAverage || "-" })}
            <div class="boss-match-reward-note"><span>Vittoria</span><strong>${isSpecial ? "+1 livello · scelta 1 su 3" : "2 pick 1 di 3 dalla squadra battuta"}</strong></div>
          </section>
          ${simError ? `<div class="match-sim-error">${escapeHtml(simError)}</div>` : ""}
            <div class="boss-match-bottom-grid" ${simulating || resolved ? "" : "hidden"}>
            <section class="panel boss-match-log-panel" ${simulating || resolved ? "" : "hidden"}><div class="panel-title-row"><div><p class="eyebrow">90 minuti · eventi reali</p><h3>Cronaca</h3></div><span class="match-state-badge">${simulating ? "Live" : resolved ? "Completa" : "In attesa"}</span></div><ol class="boss-match-log match-sim-log" tabindex="0" aria-label="Cronaca partita" aria-live="polite">${bossMatchTimeline()}</ol></section>
            <section class="panel boss-match-result-panel ${outcomeClass}" ${simulating || resolved ? "" : "hidden"}><p class="eyebrow">${isSpecial ? "Esito partita speciale" : "Esito Boss"}</p><h3>${escapeHtml(bossStatusLabel)}</h3><div class="five-match-scoreline" aria-live="polite">${escapeHtml(scoreLabel)}</div><div class="boss-match-score" aria-hidden="true"><span>${score[0]}</span><small>-</small><span>${score[1]}</span></div><p>${escapeHtml(bossMatchStatusText())}</p><div class="boss-match-score-teams"><span>${escapeHtml(meta.user.name)}</span><span>${escapeHtml(meta.boss.name)}</span></div><div class="result-badges"><span class="lives" aria-label="Vite ${escapeHtml(run.lives)}">${resolved && ui.bossMatchState.endsWith("victory") ? "+1 livello" : hearts()}</span><span>${resolved && ui.bossMatchState.endsWith("victory") ? (isSpecial ? "Scelta giocatore disponibile" : "Doppia pick boss") : resolved ? "Ritorno al nodo precedente" : "Finalizzazione protetta"}</span></div></section>
          </div>
          <section class="panel boss-match-controls" aria-label="${isSpecial ? "Azioni partita speciale" : "Azioni partita Boss"}">
            <header class="five-match-actions-heading"><span>Azioni partita</span><i aria-hidden="true"></i></header>
            <div class="five-match-primary-actions">
              <button type="button" class="btn five-match-action-cta five-match-action-cta--primary" id="simulate-boss-match" ${simulating || resolved ? "disabled" : ""}><span class="five-match-action-icon" aria-hidden="true"><i class="five-match-play-icon"></i></span><span class="five-match-action-copy"><strong>${simulating ? "Simulazione..." : "Simula partita"}</strong><small>Avvia la simulazione</small></span><span class="five-match-action-mark" aria-hidden="true">›</span></button>
              <button type="button" class="btn five-match-action-cta five-match-action-cta--secondary" id="edit-boss-team" data-nav="squad" ${resolved ? "disabled" : ""}><span class="five-match-action-icon" aria-hidden="true"><i class="five-match-tactics-icon">×</i></span><span class="five-match-action-copy"><strong>Modifica squadra</strong><small>Gestisci titolari</small></span><span class="five-match-action-mark" aria-hidden="true">›</span></button>
              <button type="button" class="btn" id="skip-match-result" ${simulating ? "" : "hidden disabled"}>Vai al risultato</button><button type="button" class="btn btn-yellow" id="continue-match-result" ${resolved ? "" : "hidden disabled"}>Continua</button>
            </div>
            ${TEST_MATCH_CONTROLS_ENABLED ? `<div class="boss-match-test-tools"><span>Strumenti di test</span><div><button type="button" class="btn btn-tool" id="test-win" ${resolved ? "disabled" : ""}>Vittoria sicura</button>${DEV_MODE ? `<button type="button" class="btn btn-danger" id="test-loss" ${resolved ? "disabled" : ""}>Sconfitta forzata</button>` : ""}</div></div>` : ""}
          </section>
        </div>
      </main>`;
    resetRenderedViewScroll();
    bindSectionRootNav();

    bindBottomNav();
    const bossTabList = document.querySelector(".boss-match-tabs");
    bossTabList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-boss-tab]");
      if (!button || button.dataset.bossTab === ui.bossMatchTab) return;
      switchBossMatchTab(button.dataset.bossTab);
    });
    document.querySelectorAll("[data-boss-player]").forEach((button) => button.addEventListener("click", () => {
      const id = button.dataset.bossPlayer;
      if (button.dataset.bossSide === "user") return showPlayerDetails(id);
      const player = bossPlayers.find((candidate) => String(candidate.playerId) === String(id));
      showPlayerDetailsFor(player, { playerId: id, level: player?.displayLevel, database: seasonDb, preserveScroll: scrollSnapshot() });
    }));
    document.querySelector(".boss-match-summary .five-match-values-button")?.addEventListener("click", (event) => {
      const button = event.currentTarget;
      const content = document.getElementById(button.getAttribute("aria-controls"));
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", expanded ? "false" : "true");
      if (content) content.hidden = expanded;
    });
    document.getElementById("test-win")?.addEventListener("click", (event) => { event.preventDefault(); forceMatchOutcome("victory", { boss }); });
    document.getElementById("test-loss")?.addEventListener("click", (event) => { event.preventDefault(); forceMatchOutcome("defeat", { boss }); });
    document.getElementById("simulate-boss-match").addEventListener("click", (event) => { event.preventDefault(); startMatchSimulation(ui.match, { boss }); });
    document.getElementById("skip-match-result")?.addEventListener("click", skipMatchToResult);
    document.getElementById("continue-match-result")?.addEventListener("click", continueAfterMatch);
    if (allowAutomaticResume) resumeMatchSimulationIfNeeded(run?.activeMatch);
  }

function continueAfterMatch(event, expectedIdentity = null) {
    syncRun();
    event?.preventDefault();
    const match = run?.activeMatch || ui.match;
    if (!match || match.postMatchNavigationApplied) return;
    if (expectedIdentity) {
      try {
        canonicalMatchFor(run, expectedIdentity);
      } catch (error) {
        return { ok: false, reason: "identity-mismatch", error };
      }
    }
    const completed = match.simulation?.state === "completed" || String(match.state || "").startsWith("completed");
    if (completed && match.simulation?.resolutionApplied !== true) return applySimulationResolution(run?.activeMatch || match);
    if (match.type === "boss" && match.result === "victory") {
      const flow = resolvePendingRunFlow({ clearMatch: true });
      return navigateBossVictoryDestination(flow);
    }
    const identity = matchTransactionIdentity(match);
    const committed = commitMatchMutation("match-post-navigation", identity, (currentMatch, current) => {
      if (currentMatch.simulation?.resolutionApplied !== true) throw new Error("Match resolution is not durable");
      const action = { ...(currentMatch.pendingPostMatchAction || { type: "map" }) };
      currentMatch.postMatchNavigationApplied = true;
      current.activeMatch = null;
      current.phase = action.type === "game-over" ? "gameover" : action.type === "special-reward" ? "special-reward" : "map";
      return action;
    });
    if (!committed.ok) return stopMatchAfterPersistenceFailure();
    const action = committed.value;
    ui.match = null; ui.bossMatchResolving = false; closeModal({ invokeOnClose: false });
    if (action.toast) toast(action.toast);
    if (action.type === "special-reward") return showSpecialMatchReward();
    if (action.type === "game-over") return renderGameOver();
    return renderMap({ persist: false });
  }

    const api = { openFiveMatchSimulationModal, clearMatchPlaybackTimer, matchTransactionIdentity, canonicalMatchFor, cloneMatchState, commitMatchMutation, stopMatchAfterPersistenceFailure, matchSeed, normalizedMatchPlayer, matchLineupSignature, matchSnapshotFromTeam, simulationTeamsForCurrentMatch, ensureMatchPreview, simulationScoreArray, visibleTimeline, matchEventSideClass, matchEventView, appendMatchLogEvent, appendMissingMatchLogEvents, syncCommittedFinalMatchLog, updateMatchScoreDom, updateMatchControlsDom, stepMatchPlayback, startMatchSimulation, resumeMatchSimulationIfNeeded, skipMatchToResult, applySimulationResolution, forceMatchOutcome, renderMatch, continueAfterMatch };
    return Object.fromEntries(Object.entries(api).map(([name, fn]) => [name, (...args) => { syncRun(); return fn(...args); }]));
  }

  global.MatchControllerRuntime = { create };
})(globalThis);
