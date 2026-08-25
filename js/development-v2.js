(function (global) {
  "use strict";

  const STORAGE_KEY = "inazumaRoguelike.developmentV2";
  const SCHEMA_VERSION = 7;
  const SEASON_IDS = Object.freeze(["ie1", "ie1_s2", "ie1_s3", "ie2", "orion"]);
  const RARITIES = ["Scarso", "Debole", "Normale", "Buono", "Forte", "Elite", "Mondiale", "Leggenda"];
  const PROJECT_RARITIES = RARITIES.slice(3);
  const PROJECT_PRICES = Object.freeze({ Buono: 250, Forte: 500, Elite: 1000, Mondiale: 1600, Leggenda: 2500 });
  const COSTS = Object.freeze({
    Normale: { coins: 100, cups: 0, projects: 0 }, Buono: { coins: 200, cups: 1, projects: 1 },
    Forte: { coins: 400, cups: 2, projects: 1 }, Elite: { coins: 800, cups: 3, projects: 1 },
    Mondiale: { coins: 1000, cups: 5, projects: 1 }, Leggenda: { coins: 1500, cups: 8, projects: 1 },
  });
  const ASSETS = Object.freeze({ Buono: "https://dxi4wb638ujep.cloudfront.net/1/k/i/m/im08lvscqau.webp", Forte: "https://dxi4wb638ujep.cloudfront.net/1/k/p/g/pgsrd8dyplu.png", Elite: "https://dxi4wb638ujep.cloudfront.net/1/k/a/n/anad1wjpht0.png", Mondiale: "https://dxi4wb638ujep.cloudfront.net/1/k/c/j/cj7t4wj1bx8.png", Leggenda: "https://dxi4wb638ujep.cloudfront.net/1/k/g/i/gibitioquoe.png" });
  const DEVELOPMENT_RESOURCE_ASSETS = Object.freeze({
    coins: "https://dxi4wb638ujep.cloudfront.net/1/k/r/e/rez8i1pp0p8.webp",
    cups: "https://dxi4wb638ujep.cloudfront.net/1/k/t/t/ttzfl1b8nbe.png",
    cupsBySeason: Object.freeze({
      ie1: "https://dxi4wb638ujep.cloudfront.net/1/k/t/t/ttzfl1b8nbe.png",
      ie1_s2: "https://dxi4wb638ujep.cloudfront.net/1/k/a/m/am1r5xc99es.png",
      ie1_s3: "https://dxi4wb638ujep.cloudfront.net/1/k/8/k/8kamtdks40c.png",
      ie2: "https://dxi4wb638ujep.cloudfront.net/1/k/r/a/radfiq7yd5u.png",
      orion: "https://dxi4wb638ujep.cloudfront.net/1/k/h/7/h7qfo5ydzhc.png",
    }),
  });
  const counters = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));
  function empty() { return { schemaVersion: SCHEMA_VERSION, coins: 0, legacyCups: 0, cupsBySeason: counters(SEASON_IDS), projects: counters(PROJECT_RARITIES), legacyProjectBuild: counters(PROJECT_RARITIES), unlockedEmblems: [], players: {}, evolutionHistory: [], redeemedRunIds: [], victoryRewardRunIds: [] }; }
  function normalize(raw) {
    const source = raw && typeof raw === "object" ? raw : {}; const value = { ...empty(), ...source };
    value.coins = Math.max(0, Math.floor(Number(source.coins) || 0));
    const legacyBalance = Math.max(0, Math.floor(Number(source.legacyCups ?? source.cups) || 0));
    value.cupsBySeason = { ...counters(SEASON_IDS), ...(source.cupsBySeason || {}) };
    Object.keys(value.cupsBySeason).forEach((id) => { value.cupsBySeason[id] = Math.max(0, Math.floor(Number(value.cupsBySeason[id]) || 0)); });
    // Pre-season-specific cups had no reliable run/season attribution. Migrate
    // the remaining legacy balance to IE1 once, as the canonical legacy season.
    if (legacyBalance > 0) value.cupsBySeason.ie1 = Math.max(0, Number(value.cupsBySeason.ie1) || 0) + legacyBalance;
    value.legacyCups = 0;
    value.projects = { ...counters(PROJECT_RARITIES), ...(source.projects || {}) };
    value.legacyProjectBuild = { ...counters(PROJECT_RARITIES), ...(source.legacyProjectBuild || source.projectBuild || {}) };
    PROJECT_RARITIES.forEach((rarity) => { value.projects[rarity] = Math.max(0, Math.floor(Number(value.projects[rarity]) || 0)); value.legacyProjectBuild[rarity] = Math.max(0, Math.floor(Number(value.legacyProjectBuild[rarity]) || 0)); });
    value.unlockedEmblems = [...new Set((source.unlockedEmblems || []).map(String))];
    value.players = source.players && typeof source.players === "object" ? source.players : {};
    value.evolutionHistory = Array.isArray(source.evolutionHistory) ? source.evolutionHistory : [];
    value.redeemedRunIds = [...new Set(source.redeemedRunIds || [])]; value.victoryRewardRunIds = [...new Set(source.victoryRewardRunIds || [])];
    value.schemaVersion = SCHEMA_VERSION; delete value.cups; delete value.projectBuild; delete value.projectPullLedger; return value;
  }
  function read() {
    try {
      const rawText = global.localStorage?.getItem(STORAGE_KEY) || "null";
      const parsed = JSON.parse(rawText);
      const state = normalize(parsed);
      const legacyBalance = parsed && typeof parsed === "object" ? Math.max(0, Math.floor(Number(parsed.legacyCups ?? parsed.cups) || 0)) : 0;
      const needsMigration = !!parsed && (Number(parsed.schemaVersion) !== SCHEMA_VERSION || legacyBalance > 0 || Object.prototype.hasOwnProperty.call(parsed, "cups"));
      if (needsMigration) global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    } catch (error) { if (error?.name === "SecurityError") throw Object.assign(new Error("storage-access-error"), { code: "storage-access-error", stage: "development-read", cause: error }); return empty(); }
  }
  function write(value, options = {}) { global.PersistenceRecoveryGuard?.assertWritable(options); global.PersistenceRecoveryGuard?.reserve(options); global.PersistenceRecoveryGuard?.assertWritable(options); const state = normalize(value); global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state)); if (!options.suppressCloudEvent && typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("inazuma:local-save-committed", { detail: { sector: "development", operation: "write", source: "gameplay" } })); return state; }
  function totalCups(state = read()) { return Number(state.legacyCups || 0) + Object.values(state.cupsBySeason || {}).reduce((sum, count) => sum + Number(count || 0), 0); }
  function defaultCupSelection(state, amount) { let remaining=Math.max(0,Math.floor(Number(amount)||0)); const selection={}; const order=Object.entries(state.cupsBySeason||{}).sort((a,b)=>Number(b[1])-Number(a[1])||SEASON_IDS.indexOf(a[0])-SEASON_IDS.indexOf(b[0])||a[0].localeCompare(b[0])); for(const[id,count]of order){const used=Math.min(remaining,Math.max(0,Math.floor(Number(count)||0)));selection[id]=used;remaining-=used;} return selection; }
  function validateCupSelection(state, selection, required) { if(!selection||typeof selection!=="object"||Array.isArray(selection))return false; let total=0; for(const[id,raw]of Object.entries(selection)){const amount=Number(raw); if(!Object.prototype.hasOwnProperty.call(state.cupsBySeason||{},id)||!Number.isInteger(amount)||amount<0||amount>Number(state.cupsBySeason[id]||0))return false; total+=amount;} return total===Math.max(0,Math.floor(Number(required)||0)); }
  function consumeSelectedCups(state, selection, required) { if(!validateCupSelection(state,selection,required))return false; for(const[id,amount]of Object.entries(selection))state.cupsBySeason[id]-=amount; return true; }
  function processRunEnd({ runId, seasonId, defeatedBosses, endReason }) { if (!runId || !["victory", "gameover"].includes(endReason)) return { state: read(), pull: null, awarded: false }; const state = read(); if (state.redeemedRunIds.includes(runId)) return { state, pull: null, awarded: false }; const won = endReason === "victory"; state.coins += Math.max(0, Math.floor(Number(defeatedBosses) || 0)) * 20 + (won ? 100 : 0); if (won) { const sid = String(seasonId || global.SeasonRegistry?.activeId?.() || "ie1"); state.cupsBySeason[sid] = Math.max(0, Number(state.cupsBySeason[sid]) || 0) + 1; state.victoryRewardRunIds.push(runId); } state.redeemedRunIds.push(runId); return { state: write(state), pull: null, awarded: true }; }
  function purchaseProject(rarity) { const price = PROJECT_PRICES[rarity]; if (!price) return { ok: false, reason: "invalid" }; const state = read(); if (state.coins < price) return { ok: false, reason: "coins", state }; state.coins -= price; state.projects[rarity] += 1; try { return { ok: true, state: write(state), rarity, price }; } catch (_) { return { ok: false, reason: "persistence", state: read() }; } }
  function purchaseEmblem(product) { const state = read(); const emblemId = String(product?.emblemId || ""); if (!emblemId) return { ok: false, reason: "invalid" }; if (state.unlockedEmblems.includes(emblemId)) return { ok: false, reason: "owned", state }; const coins = Number(product.coins || 0), cups = Number(product.cups || 0), sid = String(product.seasonId || ""); if (state.coins < coins) return { ok: false, reason: "coins", state }; if (Number(state.cupsBySeason[sid] || 0) < cups) return { ok: false, reason: "cups", state }; state.coins -= coins; state.cupsBySeason[sid] -= cups; state.unlockedEmblems.push(emblemId); try { return { ok: true, state: write(state), emblemId }; } catch (_) { return { ok: false, reason: "persistence", state: read() }; } }
  function addCompletedProject(rarity, amount = 1) { if (!PROJECT_RARITIES.includes(rarity)) return false; const state = read(); state.projects[rarity] += Math.max(0, Math.floor(Number(amount) || 0)); write(state); return true; }
  function nextRarity(current) { const index = RARITIES.indexOf(current); return index < 2 ? "Normale" : RARITIES[index + 1] || null; }
  function threshold(rarity) { return global.InazumaProgression?.RARITY_THRESHOLDS?.find((x) => x.category === rarity)?.min ?? ({ Scarso: 0, Debole: 66, Normale: 70, Buono: 75, Forte: 80, Elite: 85, Mondiale: 90, Leggenda: 95 }[rarity]); }
  function groupEvolutionHistory(history = []) { const groups = new Map(); history.forEach((entry) => { const id = String(entry?.playerId || ""); if (id) groups.set(id, [...(groups.get(id) || []), entry]); }); return [...groups.entries()].map(([playerId, entries]) => { entries.sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp)); const first=entries[0], latest=entries.at(-1); return { playerId, entries, playerNameSnapshot: latest.playerNameSnapshot || playerId, fromRarity:first.fromRarity,toRarity:latest.toRarity,timestamp:latest.timestamp,evolutionCount:entries.length,coinsConsumed:entries.reduce((s,e)=>s+Number(e.coinsConsumed||0),0),cupsConsumed:entries.reduce((s,e)=>s+Number(e.cupsConsumed||0),0),projectsConsumed:entries.reduce((s,e)=>s+Number(e.projectsConsumed||0),0) }; }).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)); }
  function playerUpgrade(id) { return read().players[String(id)] || null; }
  function optionsFromUpgrade(player, upgrade) { const boost=Math.max(0,Number(upgrade?.permanentTargetPotential||0)-Number(player?.finalOverall||0)); return { potentialBoost:boost,currentOverallBoost:boost,potentialBoostApplications:boost?[{amount:boost,appliedLevel:0,permanent:true}]:[] }; }
  function permanentOptions(player) { return optionsFromUpgrade(player, playerUpgrade(player?.playerId)); }
  function resolvePlayer(player, level, database) { return global.InazumaProgression.getPlayerAtLevel(player, level, database, permanentOptions(player)); }
  function evolve({ playerId, playerName, basePotential, unlocked, freeAgentEligible, cupSelection }) { if (!unlocked) return {ok:false,reason:"locked"}; if (!freeAgentEligible) return {ok:false,reason:"not_free_agent"}; const state=read(), id=String(playerId), currentPotential=Math.max(Number(basePotential)||0,Number(state.players[id]?.permanentTargetPotential)||0), currentRarity=global.InazumaProgression?.categoryForPotential?.(currentPotential)||RARITIES.filter(r=>threshold(r)<=currentPotential).at(-1), target=nextRarity(currentRarity); if(!target)return{ok:false,reason:"max"}; const cost=COSTS[target], missing={coins:Math.max(0,cost.coins-state.coins),cups:Math.max(0,cost.cups-totalCups(state)),projects:Math.max(0,cost.projects-(state.projects[target]||0))}; if(Object.values(missing).some(Boolean))return{ok:false,reason:"resources",missing}; if(!validateCupSelection(state,cupSelection,cost.cups))return{ok:false,reason:"cup_selection"}; const next=normalize(state); next.coins-=cost.coins; consumeSelectedCups(next,cupSelection,cost.cups); if(cost.projects)next.projects[target]-=cost.projects; const targetPotential=Math.max(currentPotential,threshold(target)), timestamp=new Date().toISOString(); next.players[id]={permanentTargetPotential:targetPotential,permanentPotentialBoost:Math.max(0,targetPotential-Number(basePotential||0)),currentPermanentRarity:target,evolutionCount:Number(next.players[id]?.evolutionCount||0)+1,updatedAt:timestamp}; next.evolutionHistory.unshift({id:`evo_${Date.now()}_${id}`,playerId:id,playerNameSnapshot:playerName||id,fromRarity:currentRarity,toRarity:target,fromPotential:currentPotential,toPotential:targetPotential,projectsConsumed:cost.projects,cupsConsumed:cost.cups,cupsConsumedBySource:Object.fromEntries(Object.entries(cupSelection).filter(([,n])=>n>0)),coinsConsumed:cost.coins,timestamp}); return {ok:true,state:write(next),target,targetPotential}; }
  function reset(){return write(empty());}
  global.DevelopmentV2={STORAGE_KEY,SCHEMA_VERSION,SEASON_IDS,RARITIES,PROJECT_RARITIES,PROJECT_PRICES,COSTS,ASSETS,DEVELOPMENT_RESOURCE_ASSETS,read,write,reset,totalCups,defaultCupSelection,validateCupSelection,consumeSelectedCups,processRunEnd,purchaseProject,purchaseEmblem,addCompletedProject,nextRarity,threshold,groupEvolutionHistory,playerUpgrade,optionsFromUpgrade,permanentOptions,resolvePlayer,evolve};
  if(typeof module!=="undefined"&&module.exports)module.exports=global.DevelopmentV2;
})(typeof globalThis!=="undefined"?globalThis:window);
