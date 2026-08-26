"use strict";

const fs = require("fs");
const vm = require("vm");

function loadModules(storage, files = ["persistence-recovery-guard.js", "run-state.js", "album-progress.js", "development-v2.js", "hall-of-fame.js"]) {
  const c = { console, localStorage: storage, Date, Math, JSON, structuredClone, TextEncoder, crypto: global.crypto,
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o?.detail; } }, dispatchEvent() {}, addEventListener() {},
    SEASON1_CONFIG: { saveKey: "run", saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: [] },
    SeasonRegistry: { normalizeSeasonId: id => ["ie1","ie2","ie1_s2","ie1_s3","orion"].includes(id) ? id : "ie1", activeId: () => "ie1", list: () => ["ie1","ie2","ie1_s2","ie1_s3","orion"].map(id => ({id})), database: () => ({}) } };
  c.globalThis = c; c.DevelopmentV2 = { read: () => ({players:{}}) }; vm.createContext(c);
  for (const file of files) vm.runInContext(fs.readFileSync(`js/${file}`, "utf8"), c, { filename: file });
  return c;
}

function element() {
  return { innerHTML: "", textContent: "", disabled: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, append() {}, remove() {}, removeAttribute() {}, setAttribute() {}, getAttribute() { return null; }, scrollTo() {},
    querySelector() { return element(); }, querySelectorAll() { return []; }, firstElementChild: null };
}

function load(storage, options = {}) {
  if (Array.isArray(options) || !options.run) return loadModules(storage, Array.isArray(options) ? options : undefined);
  let canonical = options.run ? structuredClone(options.run) : null;
  const hall = new Map(), redeemed = new Set(), blockedCalls = [];
  const document = { body: element(), documentElement: element(), scrollingElement: element(), createElement: element,
    getElementById: () => element(), querySelector: () => element(), querySelectorAll: () => [] };
  const c = { console, structuredClone, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, TypeError, Promise, Map, Set, WeakMap, WeakSet, Symbol, Intl, parseInt, parseFloat, isNaN, TextEncoder, crypto: global.crypto, URLSearchParams,
    location: { search: "" }, document, window: null, localStorage: storage, performance: { now: () => 1000 },
    requestAnimationFrame: fn => { fn(2000); return 1; }, cancelAnimationFrame() {}, setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    addEventListener() {}, dispatchEvent() {}, fetch: async () => ({ ok: false, json: async () => ({}) }),
    __INAZUMA_TEST_MODE__: true, alert() {}, MutationObserver: class { observe() {} } };
  c.window = c; c.globalThis = c;
  const noop = () => null;
  c.PersistenceRecoveryGuard = { isBlocked: () => false, setBlocked: value => blockedCalls.push(value), assertWritable() {}, readEpoch: () => 0 };
  c.RestoreGameplayRoutingGate = { enter: () => true };
  c.RunState = {
    save(run) { canonical = structuredClone(run); storage?.setItem?.(`run_${run.seasonId}`, JSON.stringify(canonical)); return run; },
    createCheckpoint: noop,
    touch: noop,
    restoreAfterLoss(run) { run.lives = Math.max(0, Number(run.lives) - 1); run.gameOver = run.lives === 0; run.phase = run.gameOver ? "gameover" : "map"; },
    normalizeTeamIdentity: value => ({ name: value?.name || "Raimon", logo: value?.logo || "inazuma-lightning" }),
  };
  c.GameplayPersistence = { create() { return ({ mutate, onCommitted, rerender }) => { try { const target = c.run || canonical; const value = mutate(target); c.RunState.save(target); onCommitted?.(value, target); return { ok: true, value, run: target }; } catch (error) { console.error("test gameplay transaction", error); rerender?.({ ok: false, error, run: c.run || canonical }); return { ok: false, error, run: c.run || canonical }; } }; } };
  c.MapEngine = { completeNode(zone, id) { const n = zone?.nodes?.find(x => x.id === id); if (n) n.completed = true; }, reachableNodeIds: () => [], ensureCurrentZoneMutation(run, db) { run.currentZone = { zoneIndex: run.bossIndex, currentNodeId: null, completedNodeIds: [], edges: [], path: [], nodes: [{ id: `boss-${run.bossIndex + 1}`, type: "boss" }] }; return { generated: true }; }, ensureCurrentZone(run, db) { return this.ensureCurrentZoneMutation(run, db); } };
  c.PermanentEffects = {
    developmentId: (run, reason) => `${run.runId}:development:${reason}`,
    assertCanonicalTerminal() {},
    enqueueHall(run, snapshot) { run.permanentEffectOutbox ||= []; const id = `${run.runId}:hall:${run.seasonId}`; if (!run.permanentEffectOutbox.some(x => x.id === id)) run.permanentEffectOutbox.push({ id, type: "hall-champion", status: "pending", payload: { snapshot } }); },
    enqueueDevelopment(run, payload) { run.permanentEffectOutbox ||= []; const id = this.developmentId(run, payload.endReason); if (!run.permanentEffectOutbox.some(x => x.id === id)) run.permanentEffectOutbox.push({ id, type: "development-run-end", status: "pending", payload }); },
    drain(run) { try { for (const effect of run.permanentEffectOutbox || []) { if (effect.status === "applied") continue; if (effect.type === "hall-champion") { options.beforePermanentWrite?.("hall", storage); const s = effect.payload.snapshot; hall.set(s.hallTeamId, structuredClone(s)); run.hallTeamId = s.hallTeamId; } else { options.beforePermanentWrite?.("development", storage); redeemed.add(run.runId); } effect.status = "applied"; c.RunState.save(run); } return { completed: true }; } catch (error) { error.code = error.name === "QuotaExceededError" ? "storage-quota-exceeded" : (error.code || "permanent-effect-failed"); error.stage ||= "permanent-effects"; error.problemSector ||= "hall/development"; return { completed: false, error }; } },
    resumeFinalization(run) { this.enqueueDevelopment(run, { endReason: "victory" }); const result = this.drain(run); if (result.error) return result; run.finalization.status = "complete"; run.phase = "complete"; c.RunState.save(run); return { completed: true }; }
  };
  c.HallOfFameStorage = { archiveKeyFor: s => `${s.runId}::${s.finalBossId}`, stableId: k => `hall-${k}`, getTeam: id => hall.get(id), listSummaries: () => [...hall.values()] };
  c.DevelopmentV2 = { DEVELOPMENT_RESOURCE_ASSETS: { coins: "", cups: "", projects: {} }, COSTS: {}, read: () => ({ redeemedRunIds: [...redeemed], players: {} }), optionsFromUpgrade: () => ({}) };
  c.LevelProgression = { fiveVFiveLevelReward: () => ({ amount: 1, units: 1, text: "1" }), formatLevel: n => String(n || 0) };
  c.DraftEngine = { randomFromSeed: () => () => 0.5, selectCandidates: candidates => candidates.slice(0, 3) };
  c.FormationLayout = { displayRows: () => [] };
  c.RoguelikeRules = { defeatedBossRewardLevel: boss => Number(boss?.bossLevel || 1), resolveDevelopmentEffectiveMetadata: () => ({}), applyEquipment: stats => stats };
  c.RecruitmentPoolRuntime = { choiceDatabase: (_source, db) => db };
  c.InazumaProgression = { getPlayerAtLevel: player => ({ ...player, stats: player?.stats || {}, baseStats: player?.stats || {}, category: player?.category || "Normale", overall: player?.overall || 50 }) };
  c.ProfiledSeasonRuntime = { resolveProfile: (_season, id) => ({ profileId: String(id), playerId: String(id), name: String(id), position: "MF", category: "Normale", overall: 50, stats: {} }) };
  c.SpecialMatchRuntime = { eligibleProfile: () => true };
  c.RunStatistics = { createStableMatchId: () => "match", buildHallOfFameStatisticsSnapshot: () => ({ runStatistics: {}, playerStatistics: {}, matchHistory: [], awards: [] }), snapshotFinalPlayerStats: noop, recordRunAction: noop };
  c.SeasonRegistry = { DEFAULT_SEASON_ID: "ie2", get: id => ({ id, name: id }), sourceForSeason: id => id, isSeasonSource: () => true, setActive: id => ({ id }), loadDatabase: async () => options.seasonDb, playersIndex: () => new Map(), teamsIndex: () => new Map() };
  c.SEASON1_CONFIG = { itemPool: [], maxInventory: 100, formations: [], nodeLabels: {} };
  c.BossGameOverRuntime = {};
  const proxy = new Proxy(c, { get(target, key) { if (key in target) return target[key]; const stub = new Proxy(noop, { get: () => stub, apply: () => null }); target[key] = stub; return stub; } });
  vm.createContext(proxy);
  vm.runInContext(fs.readFileSync("js/boss-gameover-runtime.js", "utf8"), proxy, { filename: "boss-gameover-runtime.js" });
  vm.runInContext(fs.readFileSync("js/app.js", "utf8"), proxy, { filename: "app.js" });
  if (canonical) proxy.__INAZUMA_TERMINAL_FLOW_TEST__.setContext({ run: canonical, seasonDb: options.seasonDb });
  return { context: proxy, seam: proxy.__INAZUMA_TERMINAL_FLOW_TEST__, get canonical() { return structuredClone(canonical); }, hall, redeemed, blockedCalls };
}

module.exports = { load };
