(function (global) {
  "use strict";
  const STORAGE_KEY = "inazuma_roguelike_development_center_v1";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function empty() { return { schemaVersion: 1, coins: 0, redeemedRunIds: [], coinLedger: [], certificationLedger: [], investmentLedger: [], players: {} }; }
  function migrate(input) {
    const state = input && typeof input === "object" ? clone(input) : empty(); state.schemaVersion = 1;
    state.coins = Math.max(0, Number(state.coins || 0));
    for (const key of ["redeemedRunIds", "coinLedger", "certificationLedger", "investmentLedger"]) state[key] = Array.isArray(state[key]) ? state[key] : [];
    state.players = state.players && typeof state.players === "object" ? state.players : {};
    state.redeemedRunIds = Array.from(new Set(state.redeemedRunIds.map(String))); return state;
  }
  function load(storage = global.localStorage) { try { return migrate(JSON.parse(storage?.getItem(STORAGE_KEY) || "null")); } catch (_) { return empty(); } }
  function save(state, storage = global.localStorage) { const normalized = migrate(state); storage?.setItem(STORAGE_KEY, JSON.stringify(normalized)); Object.assign(state, normalized); return state; }
  function registerCertification(state, record, player) {
    if (state.certificationLedger.some((entry) => entry.certificationId === record.certificationId)) return state.players[record.playerId];
    const id = String(record.playerId); const current = state.players[id] || { playerId: id, displayName: record.displayName, role: record.role, originalOverall: Number(player?.finalOverall || record.initialPermanentPotential), originalPotential: Number(player?.finalOverall || record.initialPermanentPotential), originalRarity: player?.category || record.initialPermanentRarity, permanentCurrentOverallBoost: 0, permanentPotentialBoost: 0, permanentPotential: record.initialPermanentPotential, permanentRarity: record.initialPermanentRarity, certificationCount: 0, projectRunWins: 0, pendingStage: null, history: [] };
    if (current.pendingStage) throw new Error("Esiste già uno sviluppo certificato incompleto");
    current.certificationCount += 1; current.projectRunWins += 1;
    current.pendingStage = { certificationId: record.certificationId, fromPotential: record.initialPermanentPotential, fromRarity: record.initialPermanentRarity, certifiedPotential: record.certifiedPotential, certifiedRarity: record.certifiedRarity, totalCost: record.totalCost, investedCoins: 0, unlockedGrowth: 0 };
    state.players[id] = current; state.certificationLedger.push(clone(record)); return current;
  }
  function investmentPreview(state, playerId, amount) {
    const player = state.players[String(playerId)]; const stage = player?.pendingStage; const spend = Math.floor(Number(amount));
    if (!stage) throw new Error("Nessuno sviluppo in corso"); if (!Number.isFinite(spend) || spend <= 0) throw new Error("Importo non valido");
    const remaining = stage.totalCost - stage.investedCoins; if (spend > state.coins) throw new Error("Saldo insufficiente"); if (spend > remaining) throw new Error("Importo superiore al costo rimanente");
    const investedCoins = stage.investedCoins + spend; const difference = stage.certifiedPotential - stage.fromPotential; const unlockedGrowth = investedCoins === stage.totalCost ? difference : Math.floor(difference * investedCoins / stage.totalCost);
    return { spend, balanceAfter: state.coins - spend, investedCoins, percent: investedCoins / stage.totalCost * 100, unlockedGrowth, newPoint: unlockedGrowth > stage.unlockedGrowth, completed: investedCoins === stage.totalCost };
  }
  function invest(state, playerId, amount, transactionId) {
    const tx = String(transactionId || ""); if (!tx) throw new Error("transactionId obbligatorio");
    const existing = state.investmentLedger.find((entry) => entry.transactionId === tx); if (existing) return { ...existing, duplicate: true };
    const id = String(playerId); const player = state.players[id]; const preview = investmentPreview(state, id, amount); const stage = player.pendingStage;
    state.coins = preview.balanceAfter; stage.investedCoins = preview.investedCoins; stage.unlockedGrowth = preview.unlockedGrowth;
    player.permanentPotentialBoost = preview.unlockedGrowth; player.permanentCurrentOverallBoost = preview.unlockedGrowth; player.permanentPotential = Math.min(99, stage.fromPotential + preview.unlockedGrowth);
    const ledger = { transactionId: tx, playerId: id, type: "investment", amount: preview.spend, certificationId: stage.certificationId, createdAt: new Date().toISOString(), completed: preview.completed };
    state.investmentLedger.push(ledger); state.coinLedger.push({ ...ledger, amount: -preview.spend });
    if (preview.completed) { player.permanentPotential = stage.certifiedPotential; player.permanentRarity = stage.certifiedRarity; player.history.push({ ...clone(stage), completedAt: ledger.createdAt }); player.pendingStage = null; }
    return { ...ledger, ...preview, permanentPotential: player.permanentPotential, permanentRarity: player.permanentRarity };
  }
  function applyUserPermanentDevelopment(player, development, level, database) {
    const record = development?.players?.[String(player?.playerId)]; if (!record) return clone(player);
    return global.InazumaProgression.getPlayerAtLevel(player, Math.floor(Number(level || 0)), database, { potentialBoost: record.permanentPotentialBoost, currentOverallBoost: record.permanentCurrentOverallBoost, potentialBoostApplications: [{ amount: record.permanentPotentialBoost, appliedLevel: 0 }] });
  }
  function snapshotForRun(state) { return clone(Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, { permanentCurrentOverallBoost: player.permanentCurrentOverallBoost, permanentPotentialBoost: player.permanentPotentialBoost, permanentPotential: player.permanentPotential, permanentRarity: player.permanentRarity }]))); }
  const api = { STORAGE_KEY, empty, migrate, load, save, registerCertification, investmentPreview, invest, applyUserPermanentDevelopment, snapshotForRun };
  global.DevelopmentCenter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
