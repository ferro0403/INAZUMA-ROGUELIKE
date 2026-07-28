(function (global) {
  "use strict";
  const ENABLE_KEY = "inazumaDevToolsEnabled";
  const BACKUP_KEY = "inazumaDevBackup";
  const GAME_KEY = /^(inazuma|album|hall)/i;
  const now = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function storage() { return global.localStorage; }
  function enabled() { return new URLSearchParams(global.location?.search || "").get("dev") === "1" || storage()?.getItem(ENABLE_KEY) === "1"; }
  function enable() { storage()?.setItem(ENABLE_KEY, "1"); return true; }
  function disable() { storage()?.removeItem(ENABLE_KEY); return false; }
  function backupAvailable() { try { return JSON.parse(storage()?.getItem(BACKUP_KEY) || "null"); } catch (_) { return null; } }
  function createBackup() {
    const existing = backupAvailable(); if (existing) return existing;
    const values = {}; for (let index = 0; index < storage().length; index += 1) { const key = storage().key(index); if (GAME_KEY.test(key) && key !== BACKUP_KEY && key !== ENABLE_KEY) values[key] = storage().getItem(key); }
    const backup = { schemaVersion: 1, createdAt: now(), values }; storage().setItem(BACKUP_KEY, JSON.stringify(backup)); return backup;
  }
  function restoreBackup() {
    const backup = backupAvailable(); if (!backup) return false;
    const current = []; for (let index = 0; index < storage().length; index += 1) { const key = storage().key(index); if (GAME_KEY.test(key) && key !== BACKUP_KEY && key !== ENABLE_KEY) current.push(key); }
    current.forEach((key) => storage().removeItem(key)); Object.entries(backup.values || {}).forEach(([key, value]) => storage().setItem(key, value)); return true;
  }
  function beginMutation(run) { createBackup(); if (run) { global.ProjectSystem.migrateRun(run).testToolUsed = true; run.devToolLedger = Array.isArray(run.devToolLedger) ? run.devToolLedger : []; } }
  function record(run, action, details = {}) { const entry = { id: `dev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, action, details: clone(details), isTest: true, origin: "devTools", timestamp: now() }; if (run) run.devToolLedger.push(entry); return entry; }
  function mutate(run, action, details, callback) { beginMutation(run); const result = callback(); record(run, action, details); return result; }
  function addCoins(run, center, amount) { return mutate(run, "coins", { amount }, () => { const value = Math.trunc(Number(amount) || 0); center.coins = Math.max(0, center.coins + value); center.coinLedger.push({ transactionId: `dev-coins:${Date.now()}`, type: "dev-adjustment", amount: value, isTest: true, origin: "devTools", createdAt: now() }); return center.coins; }); }
  function setCoins(run, center, amount) { return mutate(run, "set-coins", { amount }, () => { const before = center.coins; center.coins = Math.max(0, Math.trunc(Number(amount) || 0)); center.coinLedger.push({ transactionId: `dev-coins:${Date.now()}`, type: "dev-set-balance", amount: center.coins - before, isTest: true, origin: "devTools", createdAt: now() }); return center.coins; }); }
  function adjustProject(run, changes) { return mutate(run, "project-progress", changes, () => { const state = global.ProjectSystem.migrateRun(run); const progress = state.players[state.activePlayerId]; if (!progress) throw new Error("Seleziona prima un Progetto"); for (const [key, amount] of Object.entries(changes)) progress[key] = Math.max(0, Number(progress[key] || 0) + Number(amount)); return global.ProjectSystem.recalculate(run, progress); }); }
  function completeProject(run) { return mutate(run, "complete-project", {}, () => { const state = global.ProjectSystem.migrateRun(run); const progress = state.players[state.activePlayerId]; if (!progress) throw new Error("Seleziona prima un Progetto"); const stage = global.ProjectConfig.stageForRarity(progress.permanentRarityAtRunStart); Object.assign(progress, { officialWins: stage.wins, bossWins: stage.bossWins, maxBossWinStreak: stage.bossStreak || progress.maxBossWinStreak, firstAttemptBossWins: stage.firstAttempts || progress.firstAttemptBossWins, rolePoints: stage.role[progress.role] }); Object.assign(progress.finalConditions, { runWon: true, finalStarter: true, finalRoster: true, livesRemaining: Math.max(2, run.lives || 0) }); global.ProjectSystem.recalculate(run, progress); progress.eligibleForCertification = true; return progress; }); }
  function resetProject(run) { return mutate(run, "reset-project", {}, () => { run.projectSystem = global.ProjectSystem.emptyState(); return run.projectSystem; }); }
  function testCertification(run, center, player) { return mutate(run, "test-certification", { playerId: player.playerId }, () => { const progress = completeProject(run); const record = { certificationId: `test_cert_${run.runId}_${player.playerId}_${Date.now()}`, runId: run.runId, playerId: String(player.playerId), displayName: player.name, role: player.position, initialPermanentPotential: progress.permanentPotentialAtRunStart, initialPermanentRarity: progress.permanentRarityAtRunStart, certifiedPotential: progress.targetPotential, certifiedRarity: progress.targetRarity, totalCost: global.ProjectConfig.stageForRarity(progress.permanentRarityAtRunStart).cost, isTest: true, origin: "devTools", certifiedAt: now(), developmentStatus: "pending-investment" }; global.DevelopmentCenter.registerCertification(center, record, player); return record; }); }
  function completeDevelopment(run, center, playerId) { return mutate(run, "complete-development", { playerId }, () => { const player = center.players[String(playerId)]; if (!player?.pendingStage) throw new Error("Nessuno sviluppo pendente"); const remaining = player.pendingStage.totalCost - player.pendingStage.investedCoins; if (center.coins < remaining) addCoins(run, center, remaining - center.coins); return global.DevelopmentCenter.invest(center, playerId, remaining, `dev-invest:${Date.now()}`); }); }
  function resetDevelopment(run, center, playerId) { return mutate(run, "reset-development", { playerId }, () => { delete center.players[String(playerId)]; center.certificationLedger = center.certificationLedger.filter((item) => String(item.playerId) !== String(playerId) || !item.isTest); }); }
  const api = { ENABLE_KEY, BACKUP_KEY, enabled, enable, disable, backupAvailable, createBackup, restoreBackup, beginMutation, record, mutate, addCoins, setCoins, adjustProject, completeProject, resetProject, testCertification, completeDevelopment, resetDevelopment };
  global.ProjectDevTools = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
