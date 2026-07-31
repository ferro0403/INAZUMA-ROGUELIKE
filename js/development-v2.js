(function (global) {
  "use strict";

  const STORAGE_KEY = "inazumaRoguelike.developmentV2";
  const SCHEMA_VERSION = 5;
  const RARITIES = ["Scarso", "Debole", "Normale", "Buono", "Forte", "Elite", "Mondiale", "Leggenda"];
  const PROJECT_RARITIES = RARITIES.slice(3);
  const COSTS = Object.freeze({
    Normale: { coins: 100, cups: 0, projects: 0 },
    Buono: { coins: 200, cups: 1, projects: 1 },
    Forte: { coins: 400, cups: 2, projects: 1 },
    Elite: { coins: 800, cups: 3, projects: 1 },
    Mondiale: { coins: 1000, cups: 5, projects: 1 },
    Leggenda: { coins: 1500, cups: 8, projects: 1 },
  });
  const BUILD_REQUIREMENTS = Object.freeze({ Buono: 1, Forte: 2, Elite: 4, Mondiale: 4, Leggenda: 4 });
  const LEGACY_BUILD_REQUIREMENTS = Object.freeze({ Buono: 1, Forte: 1, Elite: 2, Mondiale: 3, Leggenda: 4 });
  const ASSETS = Object.freeze({
    Buono: "https://dxi4wb638ujep.cloudfront.net/1/k/i/m/im08lvscqau.webp",
    Forte: "https://dxi4wb638ujep.cloudfront.net/1/k/p/g/pgsrd8dyplu.png",
    Elite: "https://dxi4wb638ujep.cloudfront.net/1/k/a/n/anad1wjpht0.png",
    Mondiale: "https://dxi4wb638ujep.cloudfront.net/1/k/c/j/cj7t4wj1bx8.png",
    Leggenda: "https://dxi4wb638ujep.cloudfront.net/1/k/g/i/gibitioquoe.png",
  });
  const DEVELOPMENT_RESOURCE_ASSETS = Object.freeze({
    coins: "https://dxi4wb638ujep.cloudfront.net/1/k/r/e/rez8i1pp0p8.webp",
    cups: "https://dxi4wb638ujep.cloudfront.net/1/k/t/t/ttzfl1b8nbe.png",
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
  function empty() { const counters = () => Object.fromEntries(PROJECT_RARITIES.map((r) => [r, 0])); return { schemaVersion: SCHEMA_VERSION, coins: 0, cups: 0, projectBuild: counters(), projects: counters(), players: {}, evolutionHistory: [], redeemedRunIds: [], victoryRewardRunIds: [], projectPullLedger: {} }; }
  function normalize(raw) {
    const value = raw && typeof raw === "object" ? raw : empty(); const base = empty();
    const legacyV2 = Number(value.schemaVersion || 0) < SCHEMA_VERSION && !value.projectBuild;
    value.coins = Math.max(0, Number(value.coins) || 0); value.cups = Math.max(0, Number(value.cups) || 0);
    value.projects = { ...base.projects, ...(value.projects || {}) }; value.projectBuild = { ...base.projectBuild, ...(value.projectBuild || {}) };
    PROJECT_RARITIES.forEach((r) => { const owned = Math.max(0, Math.floor(Number(value.projects[r]) || 0)); if (legacyV2) { const legacyRequired = LEGACY_BUILD_REQUIREMENTS[r]; value.projects[r] = Math.floor(owned / legacyRequired); value.projectBuild[r] = owned % legacyRequired; } else { value.projects[r] = owned; value.projectBuild[r] = Math.max(0, Math.floor(Number(value.projectBuild[r]) || 0)) % BUILD_REQUIREMENTS[r]; } });
    value.schemaVersion = SCHEMA_VERSION;
    value.players = value.players && typeof value.players === "object" ? value.players : {}; value.evolutionHistory = Array.isArray(value.evolutionHistory) ? value.evolutionHistory : [];
    value.redeemedRunIds = [...new Set(value.redeemedRunIds || [])]; value.victoryRewardRunIds = [...new Set(value.victoryRewardRunIds || [])]; value.projectPullLedger = value.projectPullLedger && typeof value.projectPullLedger === "object" ? value.projectPullLedger : {};
    return value;
  }
  function read() { try { return normalize(JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || "null")); } catch (_) { return empty(); } }
  function write(value) { const state = normalize(value); global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); return state; }
  function nextRarity(current) { const index = RARITIES.indexOf(current); if (index < 2) return "Normale"; return RARITIES[index + 1] || null; }
  function groupEvolutionHistory(history = []) {
    const groups = new Map();
    history.forEach((entry) => {
      const playerId = String(entry?.playerId || "");
      if (!playerId) return;
      const group = groups.get(playerId) || { playerId, entries: [] };
      group.entries.push(entry);
      groups.set(playerId, group);
    });
    return [...groups.values()].map((group) => {
      group.entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const first = group.entries[0];
      const latest = group.entries[group.entries.length - 1];
      return { ...group, playerNameSnapshot: latest.playerNameSnapshot || first.playerNameSnapshot || group.playerId, fromRarity: first.fromRarity, toRarity: latest.toRarity, timestamp: latest.timestamp, evolutionCount: group.entries.length, coinsConsumed: group.entries.reduce((sum, entry) => sum + Number(entry.coinsConsumed || 0), 0), cupsConsumed: group.entries.reduce((sum, entry) => sum + Number(entry.cupsConsumed || 0), 0), projectsConsumed: group.entries.reduce((sum, entry) => sum + Number(entry.projectsConsumed || 0), 0) };
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
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
  function addProjectModules(rarity, amount, state = null) { if (!PROJECT_RARITIES.includes(rarity)) return null; const value = state || read(); const modulesAdded = Math.max(0, Math.floor(Number(amount) || 0)); const required = BUILD_REQUIREMENTS[rarity]; const total = value.projectBuild[rarity] + modulesAdded; const projectsCompleted = Math.floor(total / required); value.projectBuild[rarity] = total % required; value.projects[rarity] += projectsCompleted; write(value); return { modulesAdded, projectsCompleted, remainder: value.projectBuild[rarity], required }; }
  function addCompletedProject(rarity, amount = 1) { if (!PROJECT_RARITIES.includes(rarity)) return false; const state = read(); state.projects[rarity] += Math.max(0, Math.floor(Number(amount) || 0)); write(state); return true; }
  function claimPull(runId, rarity) { const state = read(); const pull = state.projectPullLedger[runId]; if (!pull || pull.claimed || !pull.choices.includes(rarity)) return false; pull.claimed = true; pull.selectedRarity = rarity; pull.claimedAt = new Date().toISOString(); const build = addProjectModules(rarity, 1, state); return { rarity, ...build }; }
  function projectBuildStatus(rarity, state = read()) {
    const required = BUILD_REQUIREMENTS[rarity]; const owned = Math.max(0, Number(state?.projects?.[rarity]) || 0); const remainder = Math.max(0, Number(state?.projectBuild?.[rarity]) || 0);
    return { rarity, required, owned, complete: owned, remainder, filled: remainder, ready: owned > 0 };
  }
  function playerUpgrade(playerId) { return read().players[String(playerId)] || null; }
  function optionsFromUpgrade(player, upgrade) { const boost = Math.max(0, Number(upgrade?.permanentTargetPotential || 0) - Number(player?.finalOverall || 0)); return { potentialBoost: boost, currentOverallBoost: boost, potentialBoostApplications: boost ? [{ amount: boost, appliedLevel: 0, permanent: true }] : [] }; }
  function permanentOptions(player) { return optionsFromUpgrade(player, playerUpgrade(player?.playerId)); }
  function resolvePlayer(player, level, database) { return global.InazumaProgression.getPlayerAtLevel(player, level, database, permanentOptions(player)); }
  function evolve({ playerId, playerName, basePotential, unlocked, freeAgentEligible }) { if (!unlocked) return { ok: false, reason: "locked" }; if (!freeAgentEligible) return { ok: false, reason: "not_free_agent" }; const state = read(); const id = String(playerId); const currentPotential = Math.max(Number(basePotential) || 0, Number(state.players[id]?.permanentTargetPotential) || 0); const currentRarity = global.InazumaProgression?.categoryForPotential?.(currentPotential) || RARITIES.filter((r) => threshold(r) <= currentPotential).at(-1); const target = nextRarity(currentRarity); if (!target) return { ok: false, reason: "max" }; const cost = COSTS[target]; const missing = { coins: Math.max(0, cost.coins - state.coins), cups: Math.max(0, cost.cups - state.cups), projects: Math.max(0, cost.projects - (state.projects[target] || 0)) }; if (Object.values(missing).some(Boolean)) return { ok: false, reason: "resources", missing };
    const targetPotential = Math.max(currentPotential, threshold(target)); state.coins -= cost.coins; state.cups -= cost.cups; if (cost.projects) state.projects[target] -= cost.projects; state.players[id] = { permanentTargetPotential: targetPotential, permanentPotentialBoost: Math.max(0, targetPotential - Number(basePotential || 0)), currentPermanentRarity: target, evolutionCount: Number(state.players[id]?.evolutionCount || 0) + 1, updatedAt: new Date().toISOString() }; state.evolutionHistory.unshift({ id: `evo_${Date.now()}_${id}`, playerId: id, playerNameSnapshot: playerName || id, fromRarity: currentRarity, toRarity: target, fromPotential: currentPotential, toPotential: targetPotential, projectsConsumed: cost.projects, cupsConsumed: cost.cups, coinsConsumed: cost.coins, timestamp: new Date().toISOString() }); write(state); return { ok: true, state, target, targetPotential }; }
  function reset() { return write(empty()); }
  global.DevelopmentV2 = { STORAGE_KEY, SCHEMA_VERSION, RARITIES, PROJECT_RARITIES, COSTS, BUILD_REQUIREMENTS, ASSETS, DEVELOPMENT_RESOURCE_ASSETS, TABLES, read, write, reset, nextRarity, groupEvolutionHistory, threshold, weighted, generateChoiceSlots, generateChoices, processRunEnd, claimPull, addProjectModules, addCompletedProject, projectBuildStatus, playerUpgrade, optionsFromUpgrade, permanentOptions, resolvePlayer, evolve };
  if (typeof module !== "undefined" && module.exports) module.exports = global.DevelopmentV2;
})(typeof globalThis !== "undefined" ? globalThis : window);
