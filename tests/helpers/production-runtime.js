"use strict";

const fs = require("fs");
const vm = require("vm");

const PRODUCTION_MODULES = [
  "season1-config.js", "persistence-recovery-guard.js", "run-state.js", "gameplay-persistence.js",
  "album-progress.js", "development-v2.js", "hall-of-fame.js",
  "permanent-effects.js", "map-generator.js", "team-emblems.js", "boss-gameover-runtime.js", "app.js",
];

function runModule(context, file) {
  vm.runInContext(fs.readFileSync(`js/${file}`, "utf8"), context, { filename: file });
}

function loadModules(storage, files = ["persistence-recovery-guard.js", "run-state.js", "album-progress.js", "development-v2.js", "hall-of-fame.js"]) {
  const c = { console, localStorage: storage, Date, Math, JSON, structuredClone, TextEncoder, crypto: global.crypto,
    CustomEvent: class { constructor(type, o) { this.type = type; this.detail = o?.detail; } }, dispatchEvent() {}, addEventListener() {},
    SEASON1_CONFIG: { saveKey: "run", saveVersion: 2, startingLives: 2, maxRunLives: 2, legacySaveKeys: [] },
    SeasonRegistry: { normalizeSeasonId: id => ["ie1","ie2","ie1_s2","ie1_s3","orion"].includes(id) ? id : "ie1", activeId: () => "ie1", list: () => ["ie1","ie2","ie1_s2","ie1_s3","orion"].map(id => ({id})), database: () => ({}) } };
  c.globalThis = c; vm.createContext(c);
  for (const file of files) runModule(c, file);
  return c;
}

function element() {
  return { innerHTML: "", textContent: "", disabled: false, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, append() {}, remove() {}, removeAttribute() {}, setAttribute() {}, getAttribute() { return null; }, scrollTo() {},
    querySelector() { return element(); }, querySelectorAll() { return []; }, firstElementChild: null };
}

function load(storage, options = {}) {
  if (Array.isArray(options) || (!options.run && !options.fullRuntime)) return loadModules(storage, Array.isArray(options) ? options : undefined);
  const blockedCalls = [];
  const runtimeSeasonId = options.seasonId || options.run?.seasonId;
  const document = { body: element(), documentElement: element(), scrollingElement: element(), createElement: element,
    getElementById: () => element(), querySelector: () => element(), querySelectorAll: () => [] };
  const listeners = new Map();
  const c = { console, structuredClone, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, TypeError, Promise, Map, Set, WeakMap, WeakSet, Symbol, Intl, parseInt, parseFloat, isNaN, TextEncoder, Uint8Array, crypto: global.crypto, URLSearchParams,
    location: { search: "" }, document, window: null, localStorage: storage, performance: { now: () => 1000 },
    requestAnimationFrame: fn => { fn(2000); return 1; }, cancelAnimationFrame() {}, setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    addEventListener(type, listener) { const values = listeners.get(type) || []; values.push(listener); listeners.set(type, values); },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(event); return true; },
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    __INAZUMA_TEST_MODE__: true, alert() {}, MutationObserver: class { observe() {} } };
  c.window = c; c.globalThis = c;
  const noop = () => null;
  c.RestoreGameplayRoutingGate = { enter: () => true };
  c.LevelProgression = { fiveVFiveLevelReward: () => ({ amount: 1, units: 1, text: "1" }), formatLevel: n => String(n || 0) };
  c.DraftEngine = { randomFromSeed: () => () => 0.5, selectCandidates: candidates => candidates.slice(0, 3) };
  c.FormationLayout = { displayRows: () => [] };
  c.RoguelikeRules = { defeatedBossRewardLevel: boss => Number(boss?.bossLevel || 1), resolveDevelopmentEffectiveMetadata: () => ({}), applyEquipment: stats => stats };
  c.RecruitmentPoolRuntime = { choiceDatabase: (_source, db) => db };
  c.InazumaProgression = { getPlayerAtLevel: player => ({ ...player, stats: player?.stats || {}, baseStats: player?.stats || {}, category: player?.category || "Normale", overall: player?.overall || 50 }) };
  c.DevelopmentRuntime = {
    resolvePlayer: (_run, player) => c.InazumaProgression.getPlayerAtLevel(player),
    resolveRosterPlayer: (_run, player) => c.InazumaProgression.getPlayerAtLevel(player),
    resolveEffectiveMetadata: (_run, player) => ({ ...player, potential: player?.finalOverall, finalOverall: player?.finalOverall }),
    rosterEntryPermanentFields: () => ({ potentialBoost: 0, currentOverallBoost: 0, potentialBoostApplications: [], intensiveTrainingMigrated: true }),
    trainingState: (_run, _player, entry) => { const applications = entry?.potentialBoostApplications || []; const currentLocalBoost = Number(entry?.potentialBoost || 0); return { applications, currentLocalBoost, currentOverallBoost: Number(entry?.currentOverallBoost || 0), maxLocalBoost: 99, remainingBoost: 99 - currentLocalBoost }; },
    planIntensiveTraining: (_run, player, entry, amount) => c.InazumaProgression.planCodexTrainingGrowth?.(player, entry, amount) || { codexDeltas: {} },
  };
  c.ProfiledSeasonRuntime = { resolveProfile: (_season, id) => ({ profileId: String(id), playerId: String(id), name: String(id), position: "MF", category: "Normale", overall: 50, stats: {} }), addLevelUnits: player => player };
  c.MatchSimulator = { simulate: () => ({ score: { user: 1, opponent: 0 }, events: [] }) };
  c.SpecialMatchRuntime = { eligibleProfile: () => true };
  c.RunStatistics = { createStableMatchId: () => "match", buildHallOfFameStatisticsSnapshot: () => ({ runStatistics: {}, playerStatistics: {}, matchHistory: [], awards: [] }), snapshotFinalPlayerStats: noop, recordRunAction: noop };
  const seasonIds = ["ie1", "ie2", "ie1_s2", "ie1_s3", "orion"];
  c.SeasonRegistry = { DEFAULT_SEASON_ID: "ie2", normalizeSeasonId: id => seasonIds.includes(id) ? id : "ie1", activeId: () => options.seasonId || options.run?.seasonId || "ie2", list: () => seasonIds.map(id => ({ id })), database: () => options.seasonDb || {}, get: id => ({ id, name: id }), sourceForSeason: id => id, isSeasonSource: () => true, setActive: id => ({ id }), loadDatabase: async () => options.seasonDb, playersIndex: () => new Map(), teamsIndex: () => new Map() };
  vm.createContext(c);
  for (const file of PRODUCTION_MODULES) runModule(c, file);
  if (options.run) c.RunState.save(structuredClone(options.run));
  const restored = c.RunState.load(runtimeSeasonId);
  if (restored) c.__INAZUMA_TERMINAL_FLOW_TEST__.setContext({ run: restored, seasonDb: options.seasonDb });
  return {
    context: c, seam: c.__INAZUMA_TERMINAL_FLOW_TEST__, blockedCalls,
    get canonical() { const value = c.RunState.load(runtimeSeasonId); return value && structuredClone(value); },
    get hall() { return c.HallOfFameStorage.listTeams(); },
    get redeemed() { return new Set(c.DevelopmentV2.read().redeemedRunIds); },
    destroy() { c.__INAZUMA_TERMINAL_FLOW_TEST__?.setContext({ run: null, seasonDb: null }); },
    reopen(reopenOptions = {}) { this.destroy(); return load(storage, { ...options, ...reopenOptions, fullRuntime: true, run: undefined, seasonId: reopenOptions.seasonId || runtimeSeasonId }); },
  };
}

module.exports = { load, PRODUCTION_MODULES };
