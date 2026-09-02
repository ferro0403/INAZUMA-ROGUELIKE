"use strict";

const fs = require("fs");
const vm = require("vm");

const PRODUCTION_MODULES = [
  "season1-config.js", "persistence-recovery-guard.js", "run-state.js", "gameplay-persistence.js",
  "album-progress.js", "development-v2.js", "hall-of-fame.js",
  "permanent-effects.js", "map-generator.js", "team-emblems.js", "boss-gameover-runtime.js", "boss/boss-flow-controller.js",
  "recruitment/player-identity.js", "recruitment/roster-invariants.js", "recruitment/recruitment-view.js", "recruitment/recruitment-controller.js", "pulls/pull-invariants.js",
  "pulls/pull-pool.js", "pulls/pull-items.js", "pulls/pull-view.js", "pulls/pull-controller.js", "pulls/pull-candidates.js",
  "squad/squad-controller.js", "squad/squad-view.js", "five-v-five/five-v-five-controller.js", "five-v-five/five-v-five-view.js",
  "special-match/special-match-view.js", "special-match/special-match-controller.js", "special-match/special-match-reward-view.js", "special-match/special-match-reward-controller.js", "match/match-controller.js",
  "inventory/inventory-model.js", "inventory/item-presenter.js", "inventory/inventory-controller.js",
  "map/node-router.js", "map/trade-node-controller.js", "map/run-map-controller.js",
  "gameover/gameover-view.js", "gameover/gameover-controller.js", "finalization/finalization-view.js", "finalization/finalization-controller.js", "app.js",
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
  const listeners = new Map();
  const node = { innerHTML: "", textContent: "", disabled: false, dataset: {}, style: {}, parentElement: null, className: "", id: "", classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, listener) { const current = listeners.get(type) || []; current.push(listener); listeners.set(type, current); }, removeEventListener() {},
    dispatchEvent(event) { event.currentTarget = this; for (const listener of [...(listeners.get(event.type) || [])]) listener(event); if (!event.cancelBubble) this.parentElement?.dispatchEvent?.(event); },
    click() { const event = { type: "click", currentTarget: this, target: this, preventDefault() {}, stopPropagation() { this.cancelBubble = true; }, cancelBubble: false }; this.dispatchEvent(event); },
    clickLatest() { const event = { currentTarget: this, target: this, preventDefault() {}, stopPropagation() {} }; const values = listeners.get("click") || []; values.at(-1)?.(event); },
    appendChild() {}, append() {}, remove() {}, removeAttribute(name) { if (name === "disabled") this.disabled = false; }, setAttribute(name, value) { if (name === "disabled") this.disabled = true; this[name] = value; }, getAttribute() { return null; }, scrollTo() {}, scrollIntoView() {}, focus() {},
    matches(selector) { const data = /^\[data-([a-z0-9-]+)(?:="([^"]*)")?\]$/i.exec(selector); if (data) { const key = data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()); return Object.hasOwn(this.dataset, key) && (data[2] === undefined || String(this.dataset[key]) === data[2]); } if (selector.startsWith("#")) return this.id === selector.slice(1); if (selector.startsWith(".")) return this.className.split(/\s+/).includes(selector.slice(1)); return false; },
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest?.(selector) || null; },
    querySelector() { return null; }, querySelectorAll() { return []; }, firstElementChild: null };
  return node;
}

function load(storage, options = {}) {
  if (Array.isArray(options) || (!options.run && !options.fullRuntime)) return loadModules(storage, Array.isArray(options) ? options : undefined);
  const blockedCalls = [];
  const runtimeSeasonId = options.seasonId || options.run?.seasonId;
  const elementsById = new Map();
  const selectorTargets = new Map();
  const document = { body: element(), documentElement: element(), scrollingElement: element(), createElement: element, createDocumentFragment: element,
    getElementById: id => elementsById.get(id) || null,
    querySelector: selector => selectorTargets.get(selector)?.[0] || null,
    querySelectorAll: selector => selectorTargets.get(selector) || [] };
  function registerMarkup(root, markup, delegatedParent = root) {
    for (const values of selectorTargets.values()) values.splice(0);
    for (const id of [...elementsById.keys()]) if (!["app", "modal-root", "toast-root"].includes(id)) elementsById.delete(id);
    const tags = String(markup).match(/<[^/!][^>]*>/g) || [];
    for (const tag of tags) {
      const node = element(); node.parentElement = delegatedParent;
      node.id = /\bid="([^"]+)"/.exec(tag)?.[1] || "";
      node.className = /\bclass="([^"]+)"/.exec(tag)?.[1] || "";
      node.disabled = /\sdisabled(?:\s|>|=)/.test(tag);
      for (const match of tag.matchAll(/data-([a-z0-9-]+)="([^"]*)"/gi)) {
        const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()); node.dataset[key] = match[2];
        const bare = `[data-${match[1]}]`, exact = `[data-${match[1]}="${match[2]}"]`;
        for (const selector of [bare, exact]) { const values = selectorTargets.get(selector) || []; values.push(node); selectorTargets.set(selector, values); }
      }
      for (const match of tag.matchAll(/\bdata-([a-z0-9-]+)(?=\s|>)/gi)) {
        const key = match[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        if (Object.hasOwn(node.dataset, key)) continue;
        node.dataset[key] = ""; const selector = `[data-${match[1]}]`, values = selectorTargets.get(selector) || []; values.push(node); selectorTargets.set(selector, values);
      }
      if (node.id) { elementsById.set(node.id, node); selectorTargets.set(`#${node.id}`, [node]); }
      for (const className of node.className.split(/\s+/).filter(Boolean)) { const selector = `.${className}`, values = selectorTargets.get(selector) || []; values.push(node); selectorTargets.set(selector, values); }
    }
  }
  const appElement = element(), modalElement = element(), toastElement = element(), inventoryContent = element();
  elementsById.set("app", appElement); elementsById.set("modal-root", modalElement); elementsById.set("toast-root", toastElement);
  selectorTargets.set(".inventory-content", [inventoryContent]);
  let appMarkup = "", modalMarkup = "";
  Object.defineProperty(appElement, "innerHTML", { configurable: true, get() { return appMarkup; }, set(value) { appMarkup = String(value ?? ""); registerMarkup(appElement, appMarkup, inventoryContent); selectorTargets.set(".inventory-content", [inventoryContent]); } });
  Object.defineProperty(modalElement, "innerHTML", { configurable: true, get() { return modalMarkup; }, set(value) {
    modalMarkup = String(value ?? ""); registerMarkup(modalElement, modalMarkup, modalElement);
    const workspace = document.querySelector(".inventory-equipment-workspace");
    if (workspace) for (const target of document.querySelectorAll("[data-item-target-player]")) target.parentElement = workspace;
  } });
  appElement.querySelector = selector => selector === "main" ? appElement : document.querySelector(selector);
  appElement.querySelectorAll = selector => document.querySelectorAll(selector);
  modalElement.querySelector = selector => document.querySelector(selector);
  modalElement.querySelectorAll = selector => document.querySelectorAll(selector);
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
  c.RunStatistics = { ACTIONS: { ITEM_USED: "ITEM_USED" }, createStableMatchId: () => "match", buildHallOfFameStatisticsSnapshot: () => ({ runStatistics: {}, playerStatistics: {}, matchHistory: [], awards: [] }), snapshotFinalPlayerStats: noop, recordRunAction: noop };
  const seasonIds = ["ie1", "ie2", "ie1_s2", "ie1_s3", "orion"];
  c.SeasonRegistry = { DEFAULT_SEASON_ID: runtimeSeasonId || "ie2", normalizeSeasonId: id => seasonIds.includes(id) ? id : "ie1", activeId: () => options.seasonId || options.run?.seasonId || "ie2", list: () => seasonIds.map(id => ({ id })), database: () => options.seasonDb || {}, get: id => ({ id, name: id }), sourceForSeason: id => id, isSeasonSource: () => true, setActive: id => ({ id }), loadDatabase: async () => options.seasonDb, player: id => options.seasonDb?.players?.find((player) => String(player.playerId) === String(id)) || null, playersIndex: () => new Map(), teamsIndex: () => new Map() };
  Object.assign(c, options.contextOverrides || {});
  vm.createContext(c);
  if (options.useProductionSpecialMatchRuntime) {
    runModule(c, "profiled-season.js");
    c.ProfiledSeasonRuntime.register(options.seasonDb.seasonId, options.seasonDb);
    runModule(c, "special-match.js");
  }
  for (const file of PRODUCTION_MODULES) runModule(c, file);
  if (options.run) c.RunState.save(structuredClone(options.run));
  const restored = c.RunState.load(runtimeSeasonId);
  if (restored) c.__INAZUMA_TERMINAL_FLOW_TEST__.setContext({ run: restored, seasonDb: options.seasonDb });
  return {
    context: c, seam: c.__INAZUMA_TERMINAL_FLOW_TEST__, blockedCalls,
    get modalMarkup() { return elementsById.get("modal-root")?.innerHTML || ""; },
    query(selector) { return document.querySelector(selector); }, queryAll(selector) { return document.querySelectorAll(selector); },
    get canonical() { const value = c.RunState.load(runtimeSeasonId); return value && structuredClone(value); },
    get hall() { return c.HallOfFameStorage.listTeams(); },
    get redeemed() { return new Set(c.DevelopmentV2.read().redeemedRunIds); },
    destroy() { c.__INAZUMA_TERMINAL_FLOW_TEST__?.setContext({ run: null, seasonDb: null }); },
    reopen(reopenOptions = {}) { this.destroy(); return load(storage, { ...options, ...reopenOptions, fullRuntime: true, run: undefined, seasonId: reopenOptions.seasonId || runtimeSeasonId }); },
  };
}

module.exports = { load, PRODUCTION_MODULES };
