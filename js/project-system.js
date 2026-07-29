(function (global) {
  "use strict";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const idOf = (value) => String(value?.playerId ?? value?.id ?? value ?? "");
  const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

  function emptyState() {
    return { schemaVersion: 1, activePlayerId: null, testToolUsed: false, certificationCompleted: false, certifiedPlayerId: null, processedMatchIds: [], importantMatchParticipation: [], players: {}, pendingCertification: null };
  }
  function migrateRun(run) {
    if (!run.projectSystem || Number(run.projectSystem.schemaVersion) !== 1) run.projectSystem = emptyState();
    const state = run.projectSystem;
    state.processedMatchIds = Array.from(new Set((state.processedMatchIds || []).map(String)));
    state.importantMatchParticipation = Array.isArray(state.importantMatchParticipation) ? state.importantMatchParticipation : [];
    state.players = state.players && typeof state.players === "object" ? state.players : {};
    state.activePlayerId = state.activePlayerId == null ? null : String(state.activePlayerId);
    return state;
  }
  function freeAgentSet(freeAgents) { return new Set((freeAgents?.players || freeAgents || []).map(idOf)); }
  function rosterSet(run) { return new Set((run?.roster || []).map(idOf)); }
  function eligibility({ run, player, freeAgents, developmentCenter }) {
    const id = idOf(player);
    if (!id || !freeAgentSet(freeAgents).has(id)) return { eligible: false, reason: "Non appartiene al pool svincolati" };
    if (!rosterSet(run).has(id)) return { eligible: false, reason: "Non è presente nella rosa" };
    const permanent = developmentCenter?.players?.[id];
    if (permanent?.pendingStage) return { eligible: false, reason: "Sviluppo Centro incompleto" };
    const rarity = permanent?.permanentRarity || player.category;
    if (rarity === "Leggenda" || !global.ProjectConfig.stageForRarity(rarity)) return { eligible: false, reason: "Rarità massima" };
    return { eligible: true, reason: null, rarity, permanent };
  }
  function makeProgress(player, permanent) {
    const rarity = permanent?.permanentRarity || player.category;
    const potential = Number(permanent?.permanentPotential ?? player.finalOverall ?? player.potential ?? 0);
    const stage = global.ProjectConfig.stageForRarity(rarity);
    const targetPotential = Number(global.ProjectConfig.thresholdFor(stage.to));
    return { playerId: idOf(player), role: player.position || player.normalizedRole || "FW", permanentPotentialAtRunStart: potential, permanentRarityAtRunStart: rarity, targetPotential, targetRarity: stage.to, requiredGrowth: Math.max(0, targetPotential - potential), projectBoost: 0, progressPercent: 0, officialWins: 0, qualifyingMatches: 0, bossWins: 0, currentBossWinStreak: 0, maxBossWinStreak: 0, firstAttemptBossWins: 0, defeatsAfterProjectStart: 0, bossAttempts: {}, rolePoints: 0, finalConditions: { runWon: false, finalRoster: false, finalStarter: false, livesRemaining: 0 }, importantMatchesStarted: [], finalMatchStarted: false, eligibleForCertification: false };
  }
  function select(run, player, context) {
    const state = migrateRun(run); const check = eligibility({ run, player, ...context });
    if (!check.eligible) return check;
    const id = idOf(player);
    if (!state.players[id]) state.players[id] = makeProgress(player, check.permanent);
    const previousPlayerId = state.activePlayerId;
    state.activePlayerId = id;
    return { eligible: true, activePlayerId: id, previousPlayerId, progress: state.players[id] };
  }
  function reconcileRoster(run) { const state = migrateRun(run); if (state.activePlayerId && !rosterSet(run).has(state.activePlayerId)) state.activePlayerId = null; return state; }
  function effectiveBoost(run, playerId) { const state = migrateRun(run); const id = idOf(playerId); return state.activePlayerId === id ? Number(state.players[id]?.projectBoost || 0) : 0; }

  function objectiveEntries(progress, stage, run) {
    const roleTarget = Number(stage.role[progress.role] || stage.role.FW);
    const usage = [{ value: progress.officialWins, target: stage.wins }];
    const role = [{ value: progress.rolePoints, target: roleTarget }];
    const boss = [{ value: progress.bossWins, target: stage.bossWins }];
    if (stage.bossStreak != null) boss.push({ value: progress.maxBossWinStreak, target: stage.bossStreak });
    if (stage.firstAttempts != null) boss.push({ value: progress.firstAttemptBossWins, target: stage.firstAttempts });
    if (stage.maxDefeats != null) boss.push({ value: progress.defeatsAfterProjectStart <= stage.maxDefeats });
    const final = [{ value: progress.finalConditions.runWon }];
    if (stage.finalRoster) final.push({ value: progress.finalConditions.finalRoster });
    if (stage.finalStarter) final.push({ value: progress.finalConditions.finalStarter });
    if (stage.minLives != null) final.push({ value: progress.finalConditions.livesRemaining, target: stage.minLives });
    if (stage.allInitialLives) final.push({ value: progress.finalConditions.livesRemaining >= Number(run.initialLives ?? global.RunState?.initialRunLives?.() ?? 2) });
    if (stage.importantStarts != null) final.push({ value: importantStarts(run, progress.playerId, stage.importantStarts), target: stage.importantStarts });
    if (stage.noTestTools) final.push({ value: !run.projectSystem.testToolUsed });
    return { usage, role, boss, final };
  }
  function entryRatio(entry) { return entry.target == null ? (entry.value ? 1 : 0) : clamp01(Number(entry.value) / Number(entry.target)); }
  function recalculate(run, progress) {
    const stage = global.ProjectConfig.stageForRarity(progress.permanentRarityAtRunStart);
    const groups = objectiveEntries(progress, stage, run); let total = 0;
    for (const [name, entries] of Object.entries(groups)) total += global.ProjectConfig.GROUP_WEIGHTS[name] * entries.reduce((sum, entry) => sum + entryRatio(entry), 0) / entries.length;
    progress.progressPercent = Math.min(100, Math.round(total * 10000) / 100);
    progress.projectBoost = total >= 1 ? progress.requiredGrowth : Math.floor(progress.requiredGrowth * total);
    progress.eligibleForCertification = total >= 1 && !run.projectSystem.testToolUsed;
    progress.groups = Object.fromEntries(Object.entries(groups).map(([name, entries]) => [name, Math.round(entries.reduce((sum, entry) => sum + entryRatio(entry), 0) / entries.length * 100)]));
    return progress;
  }
  function snapshotMatch(run, match) {
    const state = reconcileRoster(run); const id = state.activePlayerId; const lineup = (match.lineup || run.lineup || []).map(idOf);
    return { matchId: String(match.matchId), matchType: match.matchType || match.type, bossId: match.bossId || null, bossIndex: match.bossIndex ?? run.bossIndex ?? null, attempt: Number(match.attempt || 1), activeProjectPlayerId: id, lineup, projectStarted: Boolean(id && lineup.includes(id)), test: Boolean(match.test), runVersion: run.version };
  }
  function importantStarts(run, playerId, count) {
    const state = migrateRun(run); const wanted = Math.max(0, Number(count || 0));
    const latest = state.importantMatchParticipation.filter((entry) => entry.completed).sort((a, b) => a.order - b.order).slice(-wanted);
    return latest.length === wanted && latest.every((entry) => entry.playerId === String(playerId) && entry.started) ? wanted : 0;
  }
  function rolePoints(progress, result) {
    if (!result.won) return 0; const goals = Number(result.goalsFor || 0); const conceded = Number(result.goalsAgainst || 0); const boss = result.matchType === "boss" || result.matchType === "final";
    const personalGoals = (result.scorers || []).filter((id) => idOf(id) === progress.playerId).length;
    if (progress.role === "FW") return personalGoals * (boss ? 2 : 1);
    if (progress.role === "MF") return (boss && goals >= 2 ? 3 : goals >= 2 ? 2 : goals >= 1 ? 1 : 0) + (personalGoals ? 1 : 0);
    if (progress.role === "DF") return boss && conceded === 0 ? 3 : conceded === 0 ? 2 : conceded <= 1 ? 1 : 0;
    if (progress.role === "GK") return boss && conceded === 0 ? 3 : conceded === 0 ? 2 : conceded === 1 ? 1 : 0;
    return 0;
  }
  function processMatch(run, snapshot, result, modeOverrides = {}) {
    const state = migrateRun(run); const matchId = String(snapshot?.matchId || "");
    if (!matchId || state.processedMatchIds.includes(matchId)) return { processed: false, reason: "duplicate-or-missing" };
    state.processedMatchIds.push(matchId);
    const mode = global.ProjectConfig.mode(modeOverrides);
    if (mode.importantMatchTypes.includes(snapshot.matchType)) state.importantMatchParticipation.push({ matchId, matchType: snapshot.matchType, bossIndex: snapshot.bossIndex ?? null, activeProjectPlayerId: snapshot.activeProjectPlayerId || null, playerId: snapshot.activeProjectPlayerId || null, started: Boolean(snapshot.projectStarted), completed: Boolean(result.completed), order: state.importantMatchParticipation.length + 1 });
    if (!snapshot.projectStarted || !result.official || !result.completed || result.forced || snapshot.test || result.test) { if (result.forced || snapshot.test || result.test) state.testToolUsed = true; return { processed: false, reason: "not-qualifying" }; }
    const progress = state.players[snapshot.activeProjectPlayerId]; if (!progress) return { processed: false, reason: "not-selected" };
    progress.role = result.role || progress.role;
    progress.qualifyingMatches += 1;
    if (result.won) progress.officialWins += 1; else { progress.defeatsAfterProjectStart += 1; progress.currentBossWinStreak = 0; }
    progress.rolePoints += rolePoints(progress, { ...result, matchType: snapshot.matchType });
    if (snapshot.matchType === "boss" || snapshot.matchType === "final") {
      const bossId = String(snapshot.bossId || snapshot.matchId); const previousAttempts = Number(progress.bossAttempts[bossId] || 0); progress.bossAttempts[bossId] = previousAttempts + 1;
      if (result.won) { progress.bossWins += 1; progress.currentBossWinStreak += 1; progress.maxBossWinStreak = Math.max(progress.maxBossWinStreak, progress.currentBossWinStreak); if (previousAttempts === 0) progress.firstAttemptBossWins += 1; }
    }
    if (mode.importantMatchTypes.includes(snapshot.matchType)) progress.importantMatchesStarted = [...progress.importantMatchesStarted, matchId].slice(-mode.finalPhaseMatches);
    if (snapshot.matchType === "final") { progress.finalMatchStarted = true; progress.finalConditions.finalStarter = true; progress.finalConditions.finalRoster = true; }
    return { processed: true, progress: recalculate(run, progress) };
  }
  function markRunEnd(run, { won, livesRemaining, finalRoster = [], finalLineup = [] }) {
    const state = migrateRun(run);
    Object.values(state.players).forEach((progress) => { progress.finalConditions = { ...progress.finalConditions, runWon: Boolean(won), livesRemaining: Number(livesRemaining || 0), finalRoster: finalRoster.map(idOf).includes(progress.playerId), finalStarter: finalLineup.map(idOf).includes(progress.playerId) }; recalculate(run, progress); if (!won) progress.projectBoost = 0; });
    return Object.values(state.players).filter((progress) => progress.eligibleForCertification && won && !state.testToolUsed);
  }

  function prepareCertification(run, playerIds) {
    const state = migrateRun(run);
    if (state.certificationCompleted) return state.pendingCertification;
    const eligibleIds = (playerIds || Object.keys(state.players)).map(String).filter((id) => state.players[id]?.eligibleForCertification);
    if (!eligibleIds.length || state.testToolUsed) return null;
    if (state.pendingCertification) return state.pendingCertification;
    state.pendingCertification = { certificationId: `cert_${run.runId}_${eligibleIds.join("_")}`, runId: run.runId, eligiblePlayerIds: eligibleIds, selectedPlayerId: null, status: "pending", createdAt: new Date().toISOString() };
    return state.pendingCertification;
  }
  function certificationRecord(run, playerId, player, mode = "default") {
    const state = migrateRun(run); const pending = state.pendingCertification; const id = idOf(playerId); const progress = state.players[id];
    if (!pending || pending.status !== "pending" || !pending.eligiblePlayerIds.includes(id) || state.certificationCompleted) return null;
    const stage = global.ProjectConfig.stageForRarity(progress.permanentRarityAtRunStart);
    return { certificationId: `${pending.certificationId}_${id}`, runId: run.runId, playerId: id, displayName: player?.name || id, role: progress.role, initialPermanentPotential: progress.permanentPotentialAtRunStart, initialPermanentRarity: progress.permanentRarityAtRunStart, certifiedPotential: progress.targetPotential, certifiedRarity: progress.targetRarity, mode, certifiedAt: new Date().toISOString(), completedObjectives: clone(progress.groups || {}), projectStatistics: { officialWins: progress.officialWins, qualifyingMatches: progress.qualifyingMatches, maxBossWinStreak: progress.maxBossWinStreak, firstAttemptBossWins: progress.firstAttemptBossWins, defeats: progress.defeatsAfterProjectStart }, bossWins: progress.bossWins, rolePoints: progress.rolePoints, excludedTemporaryBonuses: true, developmentStatus: "pending-investment", totalCost: stage.cost };
  }
  function completeCertification(run, playerId, player, mode) {
    const state = migrateRun(run); const record = certificationRecord(run, playerId, player, mode); if (!record) return null;
    state.certificationCompleted = true; state.certifiedPlayerId = record.playerId; state.pendingCertification = { ...state.pendingCertification, selectedPlayerId: record.playerId, status: "completed", certificationId: record.certificationId };
    return record;
  }

  const api = { emptyState, migrateRun, eligibility, select, reconcileRoster, effectiveBoost, recalculate, snapshotMatch, processMatch, markRunEnd, rolePoints, importantStarts, objectiveEntries, prepareCertification, certificationRecord, completeCertification };
  global.ProjectSystem = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
