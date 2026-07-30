(function (global) {
  "use strict";

  const STORAGE_KEY = "inazumaRoguelike.developmentV2";
  const SCHEMA_VERSION = 2;
  const RARITIES = ["Scarso", "Debole", "Normale", "Buono", "Forte", "Elite", "Mondiale", "Leggenda"];
  const PROJECT_RARITIES = RARITIES.slice(3);
  const COSTS = Object.freeze({
    Normale: { coins: 100, cups: 0, projects: 0 },
    Buono: { coins: 200, cups: 1, projects: 1 },
    Forte: { coins: 400, cups: 2, projects: 1 },
    Elite: { coins: 800, cups: 3, projects: 2 },
    Mondiale: { coins: 1000, cups: 5, projects: 3 },
    Leggenda: { coins: 1500, cups: 8, projects: 4 },
  });
  const ASSETS = Object.freeze({
    Buono: "https://static.wikia.nocookie.net/inazuma-eleven/images/7/71/Charged_Cloud_Charm.png/revision/latest",
    Forte: "https://static.wikia.nocookie.net/inazuma-eleven/images/9/92/Caravan_Keychain.png/revision/latest",
    Elite: "https://static.wikia.nocookie.net/inazuma-eleven/images/7/74/Lightning_Charm.png/revision/latest",
    Mondiale: "https://static.wikia.nocookie.net/inazuma-eleven/images/c/cd/Dragon_Keychain.png/revision/latest",
    Leggenda: "https://static.wikia.nocookie.net/inazuma-eleven/images/a/a0/Wonderbot_Keychain.png/revision/latest",
  });
  const TABLES = Object.freeze({
    5: { safe: { Buono: 100 }, advanced: { Buono: 85, Forte: 15 }, rare: { Buono: 70, Forte: 30 } },
    6: { safe: { Buono: 85, Forte: 15 }, advanced: { Buono: 60, Forte: 40 }, rare: { Buono: 50, Forte: 50 } },
    7: { safe: { Buono: 70, Forte: 30 }, advanced: { Buono: 25, Forte: 65, Elite: 10 }, rare: { Forte: 70, Elite: 30 } },
    8: { safe: { Buono: 35, Forte: 65 }, advanced: { Forte: 60, Elite: 40 }, rare: { Forte: 20, Elite: 80 } },
    9: { safe: { Forte: 65, Elite: 35 }, advanced: { Forte: 20, Elite: 65, Mondiale: 15 }, rare: { Elite: 50, Mondiale: 50 } },
    10: { safe: { Forte: 40, Elite: 60 }, advanced: { Elite: 55, Mondiale: 45 }, rare: { Elite: 25, Mondiale: 75 } },
    victory: { safe: { Buono: 10, Forte: 35, Elite: 55 }, advanced: { Forte: 10, Elite: 55, Mondiale: 35 }, rare: { Elite: 25, Mondiale: 50, Leggenda: 25 } },
  });
  function empty() { return { schemaVersion: SCHEMA_VERSION, coins: 0, cups: 0, projects: Object.fromEntries(PROJECT_RARITIES.map((r) => [r, 0])), players: {}, evolutionHistory: [], redeemedRunIds: [], victoryRewardRunIds: [], projectPullLedger: {} }; }
  function normalize(raw) {
    const value = raw && typeof raw === "object" ? raw : empty(); const base = empty();
    value.schemaVersion = SCHEMA_VERSION; value.coins = Math.max(0, Number(value.coins) || 0); value.cups = Math.max(0, Number(value.cups) || 0);
    value.projects = { ...base.projects, ...(value.projects || {}) }; PROJECT_RARITIES.forEach((r) => value.projects[r] = Math.max(0, Number(value.projects[r]) || 0));
    value.players = value.players && typeof value.players === "object" ? value.players : {}; value.evolutionHistory = Array.isArray(value.evolutionHistory) ? value.evolutionHistory : [];
    value.redeemedRunIds = [...new Set(value.redeemedRunIds || [])]; value.victoryRewardRunIds = [...new Set(value.victoryRewardRunIds || [])]; value.projectPullLedger = value.projectPullLedger && typeof value.projectPullLedger === "object" ? value.projectPullLedger : {};
    return value;
  }
  function read() { try { return normalize(JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || "null")); } catch (_) { return empty(); } }
  function write(value) { const state = normalize(value); global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); return state; }
  function nextRarity(current) { const index = RARITIES.indexOf(current); if (index < 2) return "Normale"; return RARITIES[index + 1] || null; }
  function threshold(rarity) { return global.InazumaProgression?.RARITY_THRESHOLDS?.find((x) => x.category === rarity)?.min ?? ({ Scarso: 0, Debole: 66, Normale: 70, Buono: 75, Forte: 80, Elite: 85, Mondiale: 90, Leggenda: 95 }[rarity]); }
  function weighted(pool, random = Math.random, excluded = []) { const entries = Object.entries(pool).filter(([r, w]) => w > 0 && !excluded.includes(r)); const total = entries.reduce((s, [, w]) => s + w, 0); let roll = random() * total; for (const [rarity, weight] of entries) { roll -= weight; if (roll < 0) return rarity; } return entries.at(-1)?.[0]; }
  function generateChoiceSlots(defeatedBosses, won, random = Math.random) {
    const table = TABLES[won ? "victory" : Math.min(10, Number(defeatedBosses))];
    if (!table || defeatedBosses < 5) return null;
    return { rare: weighted(table.rare, random), advanced: weighted(table.advanced, random), safe: weighted(table.safe, random) };
  }
  function generateChoices(defeatedBosses, won, random = Math.random) { const slots = generateChoiceSlots(defeatedBosses, won, random); return slots ? [slots.rare, slots.advanced, slots.safe] : null; }
  function processRunEnd({ runId, defeatedBosses, endReason }, random = Math.random) { if (!runId || !["victory", "gameover"].includes(endReason)) return { state: read(), pull: null, awarded: false }; const state = read(); const won = endReason === "victory"; let awarded = false;
    if (!state.redeemedRunIds.includes(runId)) { if (defeatedBosses >= 5) state.coins += defeatedBosses * 10 + (won ? 50 : 0); if (won) state.cups += 1; state.redeemedRunIds.push(runId); if (won) state.victoryRewardRunIds.push(runId); awarded = true; }
    if (defeatedBosses >= 5 && !state.projectPullLedger[runId]) state.projectPullLedger[runId] = { runId, endReason, defeatedBosses, choices: generateChoices(defeatedBosses, won, random), generatedAt: new Date().toISOString(), claimed: false, selectedRarity: null };
    write(state); return { state, pull: state.projectPullLedger[runId] || null, awarded };
  }
  function claimPull(runId, rarity) { const state = read(); const pull = state.projectPullLedger[runId]; if (!pull || pull.claimed || !pull.choices.includes(rarity)) return false; pull.claimed = true; pull.selectedRarity = rarity; pull.claimedAt = new Date().toISOString(); state.projects[rarity] += 1; write(state); return true; }
  function projectBuildStatus(rarity, state = read()) {
    const required = Math.max(1, Number(COSTS[rarity]?.projects) || 1);
    const owned = Math.max(0, Number(state?.projects?.[rarity]) || 0);
    const complete = Math.floor(owned / required);
    const remainder = owned % required;
    return { rarity, required, owned, complete, remainder, filled: remainder || (complete ? required : 0), ready: complete > 0 };
  }
  function playerUpgrade(playerId) { return read().players[String(playerId)] || null; }
  function optionsFromUpgrade(player, upgrade) { const boost = Math.max(0, Number(upgrade?.permanentTargetPotential || 0) - Number(player?.finalOverall || 0)); return { potentialBoost: boost, currentOverallBoost: boost, potentialBoostApplications: boost ? [{ amount: boost, appliedLevel: 0, permanent: true }] : [] }; }
  function permanentOptions(player) { return optionsFromUpgrade(player, playerUpgrade(player?.playerId)); }
  function resolvePlayer(player, level, database) { return global.InazumaProgression.getPlayerAtLevel(player, level, database, permanentOptions(player)); }
  function evolve({ playerId, playerName, basePotential, unlocked, freeAgentEligible }) { if (!unlocked) return { ok: false, reason: "locked" }; if (!freeAgentEligible) return { ok: false, reason: "not_free_agent" }; const state = read(); const id = String(playerId); const currentPotential = Math.max(Number(basePotential) || 0, Number(state.players[id]?.permanentTargetPotential) || 0); const currentRarity = global.InazumaProgression?.categoryForPotential?.(currentPotential) || RARITIES.filter((r) => threshold(r) <= currentPotential).at(-1); const target = nextRarity(currentRarity); if (!target) return { ok: false, reason: "max" }; const cost = COSTS[target]; const missing = { coins: Math.max(0, cost.coins - state.coins), cups: Math.max(0, cost.cups - state.cups), projects: Math.max(0, cost.projects - (state.projects[target] || 0)) }; if (Object.values(missing).some(Boolean)) return { ok: false, reason: "resources", missing };
    const targetPotential = Math.max(currentPotential, threshold(target)); state.coins -= cost.coins; state.cups -= cost.cups; if (cost.projects) state.projects[target] -= cost.projects; state.players[id] = { permanentTargetPotential: targetPotential, permanentPotentialBoost: Math.max(0, targetPotential - Number(basePotential || 0)), currentPermanentRarity: target, evolutionCount: Number(state.players[id]?.evolutionCount || 0) + 1, updatedAt: new Date().toISOString() }; state.evolutionHistory.unshift({ id: `evo_${Date.now()}_${id}`, playerId: id, playerNameSnapshot: playerName || id, fromRarity: currentRarity, toRarity: target, fromPotential: currentPotential, toPotential: targetPotential, projectsConsumed: cost.projects, cupsConsumed: cost.cups, coinsConsumed: cost.coins, timestamp: new Date().toISOString() }); write(state); return { ok: true, state, target, targetPotential }; }
  function reset() { return write(empty()); }
  global.DevelopmentV2 = { STORAGE_KEY, SCHEMA_VERSION, RARITIES, PROJECT_RARITIES, COSTS, ASSETS, TABLES, read, write, reset, nextRarity, threshold, weighted, generateChoiceSlots, generateChoices, processRunEnd, claimPull, projectBuildStatus, playerUpgrade, optionsFromUpgrade, permanentOptions, resolvePlayer, evolve };
  if (typeof module !== "undefined" && module.exports) module.exports = global.DevelopmentV2;
})(typeof globalThis !== "undefined" ? globalThis : window);
