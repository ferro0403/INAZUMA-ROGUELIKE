(function (global) {
  "use strict";

  const SHADOW_FIELD = "developmentV3";
  const SLOT_CAPACITIES = Object.freeze({ Buono: 50, Forte: 20, Elite: 15, Mondiale: 10, Leggenda: 5 });
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const record = (value) => value && typeof value === "object" && !Array.isArray(value);
  let ensuredRaw = null;
  let ensuredState = null;

  function deps(options = {}) {
    return {
      V2: options.DevelopmentV2 || global.DevelopmentV2,
      V3: options.DevelopmentV3 || global.DevelopmentV3,
      Migration: options.DevelopmentV3Migration || global.DevelopmentV3Migration,
      progression: options.progression || global.InazumaProgression,
      resolveBasePlayer: options.resolveBasePlayer || global.DevelopmentRuntime?.resolveBasePlayer,
      database: options.database,
    };
  }

  function failure(reason, extra = {}) { return { ok: false, migrated: false, deferred: false, reason, ...extra }; }

  function projectV2Compatibility(v3State, resolveBasePlayer, options = {}) {
    const { V2, V3 } = deps(options);
    const validation = V3.validate(v3State);
    if (!validation.valid) throw Object.assign(new Error("development-v3-invalid"), { code: "development-v3-invalid", details: validation.errors });
    const mirror = V2.empty ? V2.empty() : {
      schemaVersion: V2.SCHEMA_VERSION, coins: 0, legacyCups: 0, cupsBySeason: {}, projects: {}, legacyProjectBuild: {}, unlockedEmblems: [], players: {}, evolutionHistory: [], redeemedRunIds: [], victoryRewardRunIds: [],
    };
    for (const key of ["coins", "cupsBySeason", "projects", "unlockedEmblems", "redeemedRunIds", "victoryRewardRunIds"]) mirror[key] = clone(v3State[key]);
    mirror.legacyProjectBuild = Object.fromEntries(V3.PROJECT_RARITIES.map((rarity) => [rarity, Number(v3State.migrationLegacy?.projectBuild?.[rarity] || 0)]));
    const history = [];
    for (const playerId of Object.keys(v3State.players).sort()) {
      const chain = v3State.players[playerId];
      const entries = [];
      if (chain.legacyNormale) entries.push({ id: chain.legacyNormale.migrationId, toRarity: "Normale", ...chain.legacyNormale });
      entries.push(...chain.steps.map((step) => ({ id: step.stepId, toRarity: step.rarity, ...step })));
      if (!entries.length) continue;
      const active = entries.at(-1);
      const base = resolveBasePlayer?.(playerId);
      if (!record(base)) throw Object.assign(new Error("base-player-missing"), { code: "base-player-missing", playerId });
      mirror.players[playerId] = {
        permanentTargetPotential: active.toPotential,
        permanentPotentialBoost: Math.max(0, active.toPotential - Number(base.finalOverall || 0)),
        currentPermanentRarity: active.toRarity,
        evolutionCount: entries.length,
        ...(active.createdAt ? { updatedAt: active.createdAt } : {}),
      };
      for (const entry of entries) history.push({
        id: entry.id, playerId, playerNameSnapshot: String(base.name || playerId), fromRarity: entry.fromRarity,
        toRarity: entry.toRarity, fromPotential: entry.fromPotential, toPotential: entry.toPotential,
        projectsConsumed: entry.receipt.projectsConsumed, cupsConsumed: entry.receipt.cupsConsumed,
        cupsConsumedBySource: clone(entry.receipt.cupsConsumedBySource), coinsConsumed: entry.receipt.coinsConsumed,
        ...(entry.createdAt ? { timestamp: entry.createdAt } : {}),
      });
    }
    mirror.evolutionHistory = history.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")) || String(b.id).localeCompare(String(a.id)));
    return V2.normalize(mirror);
  }

  function envelopeFor(state, options = {}) {
    const d = deps(options);
    const mirror = projectV2Compatibility(state, d.resolveBasePlayer, options);
    mirror[SHADOW_FIELD] = clone(state);
    return mirror;
  }

  function ensureMigrated(options = {}) {
    const d = deps(options);
    let raw;
    try { raw = global.localStorage?.getItem(d.V2.STORAGE_KEY) ?? null; }
    catch (error) { return failure("storage-access-error", { blockers: [{ code: "storage-access-error", detail: error.message }] }); }
    if (raw === ensuredRaw && ensuredState) return { ok: true, migrated: false, deferred: false, reason: null, state: clone(ensuredState) };
    if (global.PersistenceRecoveryGuard?.isBlocked?.()) return { ...failure("restore-recovery-required"), deferred: true };
    let parsed;
    try { parsed = raw == null || raw === "" ? {} : JSON.parse(raw); }
    catch (_) { return failure("invalid-json"); }
    if (!record(parsed)) return failure("invalid-state");
    if (Object.prototype.hasOwnProperty.call(parsed, SHADOW_FIELD)) {
      const validation = d.V3.validate(parsed[SHADOW_FIELD]);
      if (!validation.valid) return failure("development-v3-schema-conflict", { blockers: validation.errors.map((detail) => ({ code: "development-v3-schema-conflict", detail })) });
      ensuredRaw = raw; ensuredState = d.V3.normalize(parsed[SHADOW_FIELD]);
      return { ok: true, migrated: false, deferred: false, reason: null, state: clone(ensuredState) };
    }
    const v2State = d.V2.normalize(parsed);
    const plan = d.Migration.convertState({ ...options, v2State, DevelopmentV2: d.V2, DevelopmentV3: d.V3, resolveBasePlayer: d.resolveBasePlayer, progression: d.progression, database: d.database });
    if (!plan.ok) return { ...failure(plan.blockers?.[0]?.code || "migration-blocked"), blockers: plan.blockers || [] };
    if ((global.localStorage?.getItem(d.V2.STORAGE_KEY) ?? null) !== raw) return { ...failure("development-v3-migration-stale"), deferred: true };
    try {
      const committed = d.V2.write(envelopeFor(plan.state, options));
      ensuredRaw = JSON.stringify(committed); ensuredState = clone(plan.state);
      return { ok: true, migrated: true, deferred: false, reason: null, state: clone(plan.state), developmentState: committed };
    } catch (error) {
      if (["restore-recovery-required", "restore-ownership-lost"].includes(error?.code)) return { ...failure(error.code), deferred: true };
      return failure("persistence", { error });
    }
  }

  function read(options = {}) {
    const result = ensureMigrated(options);
    if (!result.ok) throw Object.assign(new Error(result.reason), { code: result.reason, result });
    return clone(result.state);
  }
  function readCompatibility(options = {}) { const d = deps(options); return projectV2Compatibility(read(options), d.resolveBasePlayer, options); }

  function commit(candidate, options = {}) {
    const d = deps(options); const normalized = d.V3.normalize(candidate); const validation = d.V3.validate(normalized);
    if (!validation.valid) throw Object.assign(new Error("development-v3-invalid"), { code: "development-v3-invalid", details: validation.errors });
    const committed = d.V2.write(envelopeFor(normalized, options), options.writeOptions || {});
    ensuredRaw = JSON.stringify(committed); ensuredState = clone(normalized);
    return { state: clone(normalized), envelope: committed };
  }

  function mutate(mutator, options = {}) { const state = read(options); const candidate = clone(state); mutator(candidate); return commit(candidate, options); }
  function slotUsage(state) {
    const usage = Object.fromEntries(Object.keys(SLOT_CAPACITIES).map((rarity) => [rarity, 0]));
    for (const chain of Object.values(state?.players || {})) { const rarity = chain?.steps?.at?.(-1)?.rarity; if (rarity in usage) usage[rarity] += 1; }
    return usage;
  }
  function slotCapacity(rarity) { return SLOT_CAPACITIES[rarity] ?? 0; }
  function slotRemaining(state, rarity) { return Math.max(0, slotCapacity(rarity) - Number(slotUsage(state)[rarity] || 0)); }
  function canOccupyRarity(state, rarity) { return slotCapacity(rarity) > 0 && slotRemaining(state, rarity) > 0; }
  function activeState(state, base) { const chain = state.players[String(base.playerId)]; const active = chain?.steps?.at(-1) || chain?.legacyNormale; return { chain, rarity: active?.rarity || active?.profile?.category || base.category, potential: Number(active?.toPotential ?? base.finalOverall) }; }

  function evolve(input, options = {}) {
    if (!input?.unlocked) return { ok: false, reason: "locked" };
    if (!input?.freeAgentEligible) return { ok: false, reason: "not_free_agent" };
    let state; try { state = read(options); } catch (error) { return { ok: false, reason: error.code || "migration" }; }
    const d = deps(options), id = String(input.playerId || ""), base = input.basePlayer || d.resolveBasePlayer?.(id);
    if (!record(base) || String(base.playerId) !== id) return { ok: false, reason: "base-player-missing" };
    const current = activeState(state, base), target = d.V2.nextRarity(current.rarity);
    if (!target) return { ok: false, reason: "max" };
    const cost = d.V2.COSTS[target], used = slotUsage(state)[target] || 0, capacity = slotCapacity(target);
    if (capacity && used >= capacity) return { ok: false, reason: "rarity-capacity-full", rarity: target, used, capacity };
    const missing = { coins: Math.max(0, cost.coins - state.coins), cups: Math.max(0, cost.cups - d.V2.totalCups(state)), projects: Math.max(0, cost.projects - Number(state.projects[target] || 0)) };
    if (Object.values(missing).some(Boolean)) return { ok: false, reason: "resources", missing };
    if (!d.V2.validateCupSelection(state, input.cupSelection, cost.cups)) return { ok: false, reason: "cup_selection" };
    const targetPotential = Math.max(current.potential, d.V2.threshold(target));
    let profile; try { profile = d.V3.materializeProfile({ basePlayer: base, targetPotential, category: target, database: options.database, progression: d.progression }); }
    catch (error) { return { ok: false, reason: "profile-materialization-failed", error }; }
    const timestamp = String(options.timestamp || new Date().toISOString());
    const operationId = String(options.operationId || `evo:${encodeURIComponent(id)}:${encodeURIComponent(target)}:${encodeURIComponent(timestamp)}`);
    const receipt = { coinsConsumed: cost.coins, cupsConsumed: cost.cups, cupsConsumedBySource: Object.fromEntries(Object.entries(input.cupSelection || {}).filter(([, n]) => Number(n) > 0).sort(([a], [b]) => a.localeCompare(b)).map(([key, n]) => [key, Number(n)])), projectsConsumed: cost.projects };
    const candidate = clone(state); candidate.coins -= cost.coins;
    d.V2.consumeSelectedCups(candidate, input.cupSelection, cost.cups); if (cost.projects) candidate.projects[target] -= cost.projects;
    const chain = candidate.players[id] || { legacyNormale: null, steps: [] };
    const common = { fromRarity: current.rarity, fromPotential: current.potential, toPotential: targetPotential, profile, receipt, createdAt: timestamp };
    if (target === "Normale") chain.legacyNormale = { migrationId: operationId, ...common };
    else chain.steps.push({ stepId: operationId, rarity: target, ...common });
    candidate.players[id] = chain;
    try { const saved = commit(candidate, options); return { ok: true, state: saved.state, target, targetPotential, receipt: clone(receipt) }; }
    catch (error) { return { ok: false, reason: "persistence", error }; }
  }

  function processRunEnd(payload, options = {}) {
    let state; try { state = read(options); } catch (error) { return { state: null, pull: null, awarded: false, reason: error.code }; }
    if (!payload?.runId || !["victory", "gameover"].includes(payload.endReason) || state.redeemedRunIds.includes(payload.runId)) return { state, pull: null, awarded: false };
    const candidate = clone(state), won = payload.endReason === "victory";
    candidate.coins += Math.max(0, Math.floor(Number(payload.defeatedBosses) || 0)) * 20 + (won ? 100 : 0);
    if (won) { const sid = String(payload.seasonId || global.SeasonRegistry?.activeId?.() || "ie1"); candidate.cupsBySeason[sid] = Number(candidate.cupsBySeason[sid] || 0) + 1; candidate.victoryRewardRunIds.push(payload.runId); }
    candidate.redeemedRunIds.push(payload.runId); try { return { state: commit(candidate, options).state, pull: null, awarded: true }; } catch (error) { return { state, pull: null, awarded: false, reason: "persistence", error }; }
  }
  function purchaseProject(rarity, options = {}) { const price = deps(options).V2.PROJECT_PRICES[rarity]; if (!price) return { ok: false, reason: "invalid" }; let state; try { state = read(options); } catch (error) { return { ok: false, reason: error.code }; } if (state.coins < price) return { ok: false, reason: "coins", state }; state.coins -= price; state.projects[rarity] += 1; try { return { ok: true, state: commit(state, options).state, rarity, price }; } catch (_) { return { ok: false, reason: "persistence", state }; } }
  function purchaseEmblem(product, options = {}) { let state; try { state = read(options); } catch (error) { return { ok: false, reason: error.code }; } const emblemId = String(product?.emblemId || ""); if (!emblemId) return { ok: false, reason: "invalid" }; if (state.unlockedEmblems.includes(emblemId)) return { ok: false, reason: "owned", state }; const coins = Number(product.coins || 0), cups = Number(product.cups || 0), sid = String(product.seasonId || ""); if (state.coins < coins) return { ok: false, reason: "coins", state }; if (Number(state.cupsBySeason[sid] || 0) < cups) return { ok: false, reason: "cups", state }; state.coins -= coins; state.cupsBySeason[sid] -= cups; state.unlockedEmblems.push(emblemId); try { return { ok: true, state: commit(state, options).state, emblemId }; } catch (_) { return { ok: false, reason: "persistence", state }; } }
  function addCompletedProject(rarity, amount = 1, options = {}) { if (!deps(options).V3.PROJECT_RARITIES.includes(rarity)) return false; try { mutate((state) => { state.projects[rarity] += Math.max(0, Math.floor(Number(amount) || 0)); }, options); return true; } catch (_) { return false; } }
  function resetSessionCache() { ensuredRaw = null; ensuredState = null; }

  const api = { SHADOW_FIELD, SLOT_CAPACITIES, ensureMigrated, read, readCompatibility, commit, mutate, projectV2Compatibility, envelopeFor, evolve, processRunEnd, purchaseProject, purchaseEmblem, addCompletedProject, slotUsage, slotCapacity, slotRemaining, canOccupyRarity, activeState, resetSessionCache };
  global.DevelopmentAccountV3 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
