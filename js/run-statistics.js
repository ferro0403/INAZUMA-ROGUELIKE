(function (global) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const MATCH_TYPES = { FIVE: "five_v_five", BOSS: "boss" };
  const ACTIONS = Object.freeze({ NODE_COMPLETED: "node_completed", PLAYER_RECRUITED: "player_recruited", PULL_OPENED: "pull_opened", PULL_DECLINED: "pull_declined", REROLL_USED: "reroll_used", LUCKY_CHARM_USED: "lucky_charm_used", ITEM_OBTAINED: "item_obtained", ITEM_USED: "item_used", BOSS_REWARD_CHOSEN: "boss_reward_chosen", BOSS_REWARD_DECLINED: "boss_reward_declined" });
  const RATING_CONFIG = Object.freeze({ base: 6, win: 0.4, loss: -0.3, boss: 0.1, min: 5, max: 10, roles: { FW: { goals: 1.2, shots: 0.08, counterattacks: 0.15, defensiveActions: 0.05 }, MF: { goals: 1.0, shots: 0.06, counterattacks: 0.20, defensiveActions: 0.20 }, DF: { goals: 1.0, shots: 0.05, defensiveActions: 0.35, cleanSheets: 0.4 }, GK: { saves: 0.25, cleanSheets: 0.7, goalsAgainst: -0.12 } } });
  const AWARD_CONFIG = Object.freeze({ mvp: { performance: 1, goals: 1.5, saves: 0.25, defensiveActions: 0.25, bossWins: 0.3, finalHero: 1, roleMultiplier: { FW: 0.95, MF: 1.08, DF: 1.12, GK: 1.05 } } });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso() { return new Date().toISOString(); }
  function playerIdOf(player) { return String(player?.playerId ?? player?.id ?? player?.name ?? ""); }
  function playerRole(player) { return String(player?.position || player?.role || "").toUpperCase(); }
  function playerName(player) { return player?.name || player?.playerName || `Giocatore ${playerIdOf(player)}`.trim(); }
  function numeric(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function round1(value) { return Math.round(Number(value) * 10) / 10; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function stableKeyPart(value) { return String(value ?? "unknown").replace(/[^a-zA-Z0-9_-]+/g, "_"); }

  function createEmptyRunStatistics(startedAt = null) {
    return { schemaVersion: SCHEMA_VERSION, startedAt, completedAt: null, durationMs: 0, matchesTotal: 0, winsTotal: 0, lossesTotal: 0, fiveVFiveMatches: 0, fiveVFiveWins: 0, fiveVFiveLosses: 0, bossMatches: 0, bossWins: 0, bossLosses: 0, bossAttemptsById: {}, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, cleanSheets: 0, currentWinStreak: 0, longestWinStreak: 0, currentLossStreak: 0, longestLossStreak: 0, livesLost: 0, playersRecruited: 0, recruitmentBySource: {}, bossRewardsChosen: 0, bossRewardsDeclined: 0, pullsOpened: 0, freeAgentPulls: 0, teamPulls: 0, legendaryPulls: 0, pullsDeclined: 0, rerollsUsed: 0, luckyCharmsUsed: 0, itemsObtained: 0, itemsUsed: 0, itemsUsedById: {}, intensiveTrainingUsed: 0, nodesCompleted: 0, nodesCompletedByType: {}, processedMatchIds: {}, processedActionIds: {} };
  }

  function createEmptyPlayerStatistics(playerSnapshot = {}) {
    const id = playerIdOf(playerSnapshot);
    return { playerId: id, firstJoinedAt: null, recruitmentSource: null, recruitedAtLevel: null, recruitedOverall: null, appearances: 0, fiveVFiveAppearances: 0, bossAppearances: 0, finalAppearances: 0, starts: 0, wins: 0, losses: 0, bossWins: 0, goals: 0, shots: 0, saves: 0, defensiveActions: 0, counterattacks: 0, posts: 0, crossbars: 0, cleanSheets: 0, ratingTotal: 0, ratingCount: 0, averageRating: null, bestRating: null, bestMatchId: null, finalMatchRating: null, finalMatchGoals: 0, finalMatchSaves: 0, finalMatchDefensiveActions: 0, finalLevel: null, finalOverall: null, overallGrowth: null, role: playerRole(playerSnapshot) || null, playerNameSnapshot: playerName(playerSnapshot), portraitUrlSnapshot: playerSnapshot.portraitUrl || playerSnapshot.image || playerSnapshot.imageUrl || null };
  }

  function ensureRunStatistics(run) {
    if (!run || typeof run !== "object") return run;
    const base = createEmptyRunStatistics(run.createdAt || nowIso());
    run.statistics = { ...base, ...(run.statistics || {}), schemaVersion: SCHEMA_VERSION, processedMatchIds: { ...(run.statistics?.processedMatchIds || {}) }, processedActionIds: { ...(run.statistics?.processedActionIds || {}) }, bossAttemptsById: { ...(run.statistics?.bossAttemptsById || {}) }, recruitmentBySource: { ...(run.statistics?.recruitmentBySource || {}) }, itemsUsedById: { ...(run.statistics?.itemsUsedById || {}) }, nodesCompletedByType: { ...(run.statistics?.nodesCompletedByType || {}) } };
    run.playerStatistics = run.playerStatistics && typeof run.playerStatistics === "object" ? run.playerStatistics : {};
    run.matchHistory = Array.isArray(run.matchHistory) ? run.matchHistory : [];
    run.statisticsComplete = run.statisticsComplete !== undefined ? Boolean(run.statisticsComplete) : true;
    run.statisticsBackfilled = Boolean(run.statisticsBackfilled);
    run.statisticsAvailableFrom = run.statisticsAvailableFrom || run.statistics.startedAt || run.createdAt || null;
    return run;
  }

  function ensurePlayerStatistics(run, playerSnapshot = {}) { if (!run.statistics || !run.playerStatistics) ensureRunStatistics(run); const id = playerIdOf(playerSnapshot); if (!id) return null; run.playerStatistics[id] = { ...createEmptyPlayerStatistics(playerSnapshot), ...(run.playerStatistics[id] || {}), playerId: id, role: (run.playerStatistics[id]?.role || playerRole(playerSnapshot) || null), playerNameSnapshot: run.playerStatistics[id]?.playerNameSnapshot || playerName(playerSnapshot), portraitUrlSnapshot: run.playerStatistics[id]?.portraitUrlSnapshot || playerSnapshot.portraitUrl || playerSnapshot.image || playerSnapshot.imageUrl || null }; return run.playerStatistics[id]; }
  function createStableMatchId(run, activeMatch = {}) { const attempt = activeMatch.attemptNumber ?? activeMatch.attempt ?? activeMatch.simulation?.attemptNumber ?? 1; const seed = activeMatch.simulation?.seed || activeMatch.seed || "no_seed"; return [run?.runId || "run", activeMatch.nodeId || "node", activeMatch.type || activeMatch.matchType || "match", attempt, seed].map(stableKeyPart).join("::"); }
  function createStableActionId(run, actionType, payload = {}) { return payload.actionId || [run?.runId || "run", payload.nodeId || run?.currentZone?.currentNodeId || "global", actionType, payload.resolutionIndex ?? payload.instanceId ?? payload.playerId ?? payload.itemId ?? payload.source ?? "once"].map(stableKeyPart).join("::"); }

  function lineupFromMatch(match) { const players = match?.lineupSnapshot?.players || match?.simulation?.userSnapshot?.players || []; return players.map((p) => ({ ...p, playerId: playerIdOf(p), role: playerRole(p) })).filter((p) => p.playerId); }
  function gkAndDefenders(lineup) { return lineup.filter((p) => ["GK", "DF"].includes(playerRole(p))); }
  function emptyContribution(player) { return { playerId: playerIdOf(player), role: playerRole(player), goals: 0, shots: 0, saves: 0, defensiveActions: 0, counterattacks: 0, posts: 0, crossbars: 0, cleanSheets: 0, rating: null }; }

  function calculatePlayerMatchRating(player, contribution, match) {
    const role = playerRole(player) || contribution.role || "MF"; const weights = RATING_CONFIG.roles[role] || RATING_CONFIG.roles.MF;
    let rating = RATING_CONFIG.base + (match.result === "victory" ? RATING_CONFIG.win : RATING_CONFIG.loss) + (match.matchType === MATCH_TYPES.BOSS ? RATING_CONFIG.boss : 0);
    Object.entries(weights).forEach(([key, weight]) => { rating += numeric(contribution[key] ?? (key === "goalsAgainst" ? match.goalsAgainst : 0)) * weight; });
    return round1(clamp(rating, RATING_CONFIG.min, RATING_CONFIG.max));
  }

  function applyCompletedMatchStatistics(run, matchSnapshot = {}) {
    ensureRunStatistics(run);
    const matchId = matchSnapshot.matchId || createStableMatchId(run, matchSnapshot);
    if (run.statistics.processedMatchIds[matchId]) return run;
    const matchType = matchSnapshot.type || matchSnapshot.matchType || MATCH_TYPES.FIVE;
    const userScore = numeric(matchSnapshot.score?.user ?? matchSnapshot.userScore ?? matchSnapshot.score?.[0]);
    const opponentScore = numeric(matchSnapshot.score?.opponent ?? matchSnapshot.opponentScore ?? matchSnapshot.score?.[1]);
    const result = matchSnapshot.result || (matchSnapshot.winner === "user" || userScore > opponentScore ? "victory" : "defeat");
    const bossId = matchSnapshot.bossId || matchSnapshot.bossTeamId || null;
    const isBoss = matchType === MATCH_TYPES.BOSS;
    const isFinal = Boolean(matchSnapshot.isFinal || matchSnapshot.final || matchSnapshot.bossIndexFinal);
    const lineup = lineupFromMatch(matchSnapshot);
    const lineupIds = new Set(lineup.map((p) => p.playerId));
    const contributions = Object.fromEntries(lineup.map((p) => [p.playerId, emptyContribution(p)]));
    const events = Array.isArray(matchSnapshot.timeline) ? matchSnapshot.timeline : Array.isArray(matchSnapshot.events) ? matchSnapshot.events : Array.isArray(matchSnapshot.simulation?.timeline) ? matchSnapshot.simulation.timeline : [];
    events.forEach((event) => {
      if (event.team !== "user") return;
      const type = String(event.type || "");
      const id = String(event.playerId || "");
      const contribution = lineupIds.has(id) ? contributions[id] : null;
      if (type === "save") { const gk = lineup.find((p) => playerRole(p) === "GK"); if (gk && contributions[gk.playerId]) contributions[gk.playerId].saves += 1; return; }
      if (!contribution) return;
      if (type === "goal") { contribution.goals += 1; contribution.shots += 1; }
      else if (type === "shot" || type === "long_shot") contribution.shots += 1;
      else if (type === "defensive_stop" || type === "defense") contribution.defensiveActions += 1;
      else if (type === "counter") contribution.counterattacks += 1;
      else if (type === "post") { contribution.posts += 1; contribution.shots += 1; }
      else if (type === "crossbar") { contribution.crossbars += 1; contribution.shots += 1; }
    });
    if (opponentScore === 0) gkAndDefenders(lineup).forEach((p) => { if (contributions[p.playerId]) contributions[p.playerId].cleanSheets += 1; });
    const stats = run.statistics;
    stats.matchesTotal += 1; result === "victory" ? stats.winsTotal += 1 : stats.lossesTotal += 1;
    if (matchType === MATCH_TYPES.FIVE) { stats.fiveVFiveMatches += 1; result === "victory" ? stats.fiveVFiveWins += 1 : stats.fiveVFiveLosses += 1; }
    if (isBoss) { stats.bossMatches += 1; result === "victory" ? stats.bossWins += 1 : stats.bossLosses += 1; if (bossId) stats.bossAttemptsById[bossId] = numeric(stats.bossAttemptsById[bossId]) + 1; }
    stats.goalsFor += userScore; stats.goalsAgainst += opponentScore; stats.goalDifference = stats.goalsFor - stats.goalsAgainst; if (opponentScore === 0) stats.cleanSheets += 1;
    if (result === "victory") { stats.currentWinStreak += 1; stats.currentLossStreak = 0; stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentWinStreak); } else { stats.currentLossStreak += 1; stats.currentWinStreak = 0; stats.longestLossStreak = Math.max(stats.longestLossStreak, stats.currentLossStreak); stats.livesLost += 1; }
    lineup.forEach((player) => { const ps = ensurePlayerStatistics(run, player); const c = contributions[player.playerId]; ps.appearances += 1; ps.starts += 1; isBoss ? ps.bossAppearances += 1 : ps.fiveVFiveAppearances += 1; result === "victory" ? ps.wins += 1 : ps.losses += 1; if (isBoss && result === "victory") ps.bossWins += 1; ps.goals += c.goals; ps.shots += c.shots; ps.saves += c.saves; ps.defensiveActions += c.defensiveActions; ps.counterattacks += c.counterattacks; ps.posts += c.posts; ps.crossbars += c.crossbars; ps.cleanSheets += c.cleanSheets; const rating = calculatePlayerMatchRating(player, c, { result, matchType, goalsAgainst: opponentScore }); c.rating = rating; ps.ratingTotal = round1(numeric(ps.ratingTotal) + rating); ps.ratingCount += 1; ps.averageRating = round1(ps.ratingTotal / ps.ratingCount); if (ps.bestRating == null || rating > ps.bestRating || (rating === ps.bestRating && String(matchId) < String(ps.bestMatchId || "~"))) { ps.bestRating = rating; ps.bestMatchId = matchId; } if (isFinal) { ps.finalAppearances += 1; ps.finalMatchRating = rating; ps.finalMatchGoals = c.goals; ps.finalMatchSaves = c.saves; ps.finalMatchDefensiveActions = c.defensiveActions; } });
    const eventCounts = events.reduce((acc, ev) => { acc[ev.type || "unknown"] = numeric(acc[ev.type || "unknown"]) + 1; return acc; }, {});
    run.matchHistory.push({ matchId, matchType, nodeId: matchSnapshot.nodeId || null, bossId, completedAt: matchSnapshot.completedAt || nowIso(), formation: matchSnapshot.formation || matchSnapshot.formationId || null, userScore, opponentScore, result, userStrength: matchSnapshot.userStrength?.final ?? matchSnapshot.userStrength ?? null, opponentStrength: matchSnapshot.opponentStrength?.final ?? matchSnapshot.opponentStrength ?? null, userChance: matchSnapshot.probabilities?.userChance ?? matchSnapshot.userChance ?? null, lineupIds: Array.from(lineupIds), eventCounts, playerContributions: clone(contributions) });
    stats.processedMatchIds[matchId] = { appliedAt: nowIso(), result, matchType };
    return run;
  }

  function recordRunAction(run, actionType, payload = {}) { ensureRunStatistics(run); const id = createStableActionId(run, actionType, payload); if (run.statistics.processedActionIds[id]) return run; const s = run.statistics; if (actionType === ACTIONS.NODE_COMPLETED) { s.nodesCompleted += 1; const t = payload.nodeType || payload.type || "unknown"; s.nodesCompletedByType[t] = numeric(s.nodesCompletedByType[t]) + 1; } else if (actionType === ACTIONS.PLAYER_RECRUITED) { const ps = ensurePlayerStatistics(run, payload.player || { playerId: payload.playerId }); if (ps && !ps.firstJoinedAt) { ps.firstJoinedAt = payload.at || nowIso(); ps.recruitmentSource = payload.source || null; ps.recruitedAtLevel = payload.level ?? null; ps.recruitedOverall = payload.overall ?? payload.player?.overall ?? payload.player?.finalOverall ?? null; } s.playersRecruited += 1; const src = payload.source || "unknown"; s.recruitmentBySource[src] = numeric(s.recruitmentBySource[src]) + 1; } else if (actionType === ACTIONS.PULL_OPENED) { s.pullsOpened += 1; if (payload.pullType === "pull_free_agents") s.freeAgentPulls += 1; else if (payload.pullType === "pull_unlocked_teams") s.teamPulls += 1; else if (payload.pullType === "pull_legendary") s.legendaryPulls += 1; } else if (actionType === ACTIONS.PULL_DECLINED) s.pullsDeclined += 1; else if (actionType === ACTIONS.REROLL_USED) s.rerollsUsed += 1; else if (actionType === ACTIONS.LUCKY_CHARM_USED) s.luckyCharmsUsed += 1; else if (actionType === ACTIONS.ITEM_OBTAINED) s.itemsObtained += 1; else if (actionType === ACTIONS.ITEM_USED) { s.itemsUsed += 1; const itemId = payload.itemId || payload.item?.id || "unknown"; s.itemsUsedById[itemId] = numeric(s.itemsUsedById[itemId]) + 1; if (itemId === "intensive_training" || payload.effect === "potential_boost") s.intensiveTrainingUsed += 1; } else if (actionType === ACTIONS.BOSS_REWARD_CHOSEN) s.bossRewardsChosen += 1; else if (actionType === ACTIONS.BOSS_REWARD_DECLINED) s.bossRewardsDeclined += 1; s.processedActionIds[id] = { appliedAt: nowIso(), actionType }; return run; }

  function snapshotFinalPlayerStats(run, rosterSnapshots = []) { ensureRunStatistics(run); rosterSnapshots.forEach((player) => { const ps = ensurePlayerStatistics(run, player); ps.finalLevel = player.finalLevel ?? player.displayLevel ?? player.level ?? ps.finalLevel; ps.finalOverall = player.finalOverall ?? player.overall ?? ps.finalOverall; ps.overallGrowth = ps.recruitedOverall == null || ps.finalOverall == null ? ps.overallGrowth : Number(ps.finalOverall) - Number(ps.recruitedOverall); }); return run; }
  function playerSnapshot(run, playerId) { const ps = run.playerStatistics?.[String(playerId)] || {}; return { playerId: String(playerId), name: ps.playerNameSnapshot || String(playerId), portraitUrl: ps.portraitUrlSnapshot || null, role: ps.role || null, finalOverall: ps.finalOverall ?? null }; }
  function makeAward(awardId, title, player, description, criteria, score) { return player ? { awardId, id: awardId, title, label: title, playerId: player.playerId, playerNameSnapshot: player.name, playerName: player.name, portraitUrlSnapshot: player.portraitUrl, portraitUrl: player.portraitUrl, description, reason: description, criteria, score: round1(score) } : null; }
  function sortByPlayerId(a, b) { return String(a.playerId).localeCompare(String(b.playerId)); }

  function calculateSeasonAwards(run) {
    ensureRunStatistics(run); const entries = Object.values(run.playerStatistics || {}).filter((p) => p && p.playerId); const awards = [];
    const topScorer = entries.filter((p) => numeric(p.goals) > 0).sort((a,b)=> numeric(b.goals)-numeric(a.goals) || numeric(a.appearances)-numeric(b.appearances) || numeric(b.averageRating)-numeric(a.averageRating) || numeric(b.finalOverall)-numeric(a.finalOverall) || sortByPlayerId(a,b))[0]; if (topScorer) awards.push(makeAward("top_scorer", "Capocannoniere", playerSnapshot(run, topScorer.playerId), `${topScorer.goals} gol registrati dagli eventi congelati`, "gol, presenze, voto medio, overall finale", topScorer.goals));
    const bestGk = entries.filter((p)=>p.role === "GK" && numeric(p.appearances)>0).sort((a,b)=>numeric(b.saves)-numeric(a.saves)||numeric(b.cleanSheets)-numeric(a.cleanSheets)||numeric(b.averageRating)-numeric(a.averageRating)||numeric(b.bossWins)-numeric(a.bossWins)||sortByPlayerId(a,b))[0]; if (bestGk) awards.push(makeAward("best_goalkeeper", "Miglior portiere", playerSnapshot(run,bestGk.playerId), `${bestGk.saves} parate e ${bestGk.cleanSheets} clean sheet`, "parate, clean sheet, voto medio, boss win", bestGk.saves));
    const pillar = entries.filter((p)=>p.role === "DF" && numeric(p.appearances)>0).sort((a,b)=>numeric(b.defensiveActions)-numeric(a.defensiveActions)||numeric(b.cleanSheets)-numeric(a.cleanSheets)||numeric(b.averageRating)-numeric(a.averageRating)||numeric(b.bossAppearances)-numeric(a.bossAppearances)||sortByPlayerId(a,b))[0]; if (pillar) awards.push(makeAward("defensive_pillar", "Pilastro difensivo", playerSnapshot(run,pillar.playerId), `${pillar.defensiveActions} chiusure difensive`, "azioni difensive, clean sheet, voto medio", pillar.defensiveActions));
    const improved = entries.filter((p)=>Number.isFinite(Number(p.overallGrowth))).sort((a,b)=>numeric(b.overallGrowth)-numeric(a.overallGrowth)||(numeric(b.finalLevel)-numeric(b.recruitedAtLevel))-(numeric(a.finalLevel)-numeric(a.recruitedAtLevel))||numeric(b.averageRating)-numeric(a.averageRating)||sortByPlayerId(a,b))[0]; if (improved) awards.push(makeAward("most_improved", "Giocatore più cresciuto", playerSnapshot(run,improved.playerId), `Crescita overall +${improved.overallGrowth}`, "overall finale - overall reclutamento", improved.overallGrowth));
    const finalHero = entries.filter((p)=>numeric(p.finalAppearances)>0).sort((a,b)=>numeric(b.finalMatchRating)-numeric(a.finalMatchRating)||numeric(b.finalMatchGoals)-numeric(a.finalMatchGoals)||numeric(b.finalMatchSaves)-numeric(a.finalMatchSaves)||numeric(b.finalMatchDefensiveActions)-numeric(a.finalMatchDefensiveActions)||numeric(b.finalOverall)-numeric(a.finalOverall)||sortByPlayerId(a,b))[0]; if (finalHero) awards.push(makeAward("final_hero", "Eroe della finale", playerSnapshot(run,finalHero.playerId), `Voto finale ${finalHero.finalMatchRating}`, "voto finale, gol, parate, difesa", finalHero.finalMatchRating));
    const mvp = entries.filter((p)=>numeric(p.appearances)>0).map((p)=>{ const perf = numeric(p.ratingTotal) - 5.5 * numeric(p.ratingCount); const base = Math.max(0, perf)*AWARD_CONFIG.mvp.performance + numeric(p.goals)*AWARD_CONFIG.mvp.goals + numeric(p.saves)*AWARD_CONFIG.mvp.saves + numeric(p.defensiveActions)*AWARD_CONFIG.mvp.defensiveActions + numeric(p.bossWins)*AWARD_CONFIG.mvp.bossWins + (finalHero && finalHero.playerId === p.playerId ? AWARD_CONFIG.mvp.finalHero : 0); return { p, score: base * (AWARD_CONFIG.mvp.roleMultiplier[p.role] || 1) }; }).sort((a,b)=>b.score-a.score||numeric(b.p.averageRating)-numeric(a.p.averageRating)||sortByPlayerId(a.p,b.p))[0]; if (mvp) awards.push(makeAward("mvp", "MVP della run", playerSnapshot(run,mvp.p.playerId), `Indice MVP ${round1(mvp.score)}`, "voti, gol, parate, difesa, boss, finale", mvp.score));
    run.seasonAwards = awards.filter(Boolean); return run.seasonAwards;
  }

  function buildHallOfFameStatisticsSnapshot(run) { ensureRunStatistics(run); calculateSeasonAwards(run); return { statisticsSchemaVersion: SCHEMA_VERSION, statisticsComplete: Boolean(run.statisticsComplete), statisticsStartedAt: run.statistics.startedAt, runStatistics: clone(run.statistics), playerStatistics: clone(run.playerStatistics), matchHistory: clone(run.matchHistory), awards: clone(run.seasonAwards || []) }; }
  function migrateLegacyRunStatistics(run) { ensureRunStatistics(run); if (!run.statistics?.processedMatchIds || Object.keys(run.statistics.processedMatchIds).length === 0) { run.statisticsComplete = false; run.statisticsBackfilled = false; run.statisticsAvailableFrom = null; } return run; }

  global.RunStatistics = { SCHEMA_VERSION, ACTIONS, RATING_CONFIG, AWARD_CONFIG, createEmptyRunStatistics, createEmptyPlayerStatistics, ensureRunStatistics, ensurePlayerStatistics, createStableMatchId, createStableActionId, applyCompletedMatchStatistics, recordRunAction, calculatePlayerMatchRating, calculateSeasonAwards, buildHallOfFameStatisticsSnapshot, snapshotFinalPlayerStats, migrateLegacyRunStatistics };
})(globalThis);
