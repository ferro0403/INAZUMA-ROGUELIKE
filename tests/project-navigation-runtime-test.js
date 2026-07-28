'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/app.js', 'utf8');

class FakeElement {
  constructor() { this.innerHTML = ''; this.dataset = {}; this.classList = { add() {}, remove() {}, toggle() {} }; }
  addEventListener() {}
  append() {}
  remove() {}
  setAttribute() {}
  removeAttribute() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
}

const app = new FakeElement();
const modal = new FakeElement();
const toast = new FakeElement();
const elements = { app, 'modal-root': modal, 'toast-root': toast };
const document = {
  body: new FakeElement(),
  documentElement: new FakeElement(),
  getElementById(id) { return elements[id] || null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return new FakeElement(); },
  addEventListener() {},
};

const seasonDb = { players: [], teams: [], formations: { eleven: [{ id: '4-3-3', name: '4-3-3' }] }, bossOrder: [] };
const emptyProject = { activePlayerId: null, players: {} };
const activeRun = {
  seasonId: 'season1', formationId: '4-3-3', teamIdentity: { name: 'Raimon' }, roster: [], lineup: [], bench: [],
  completedBossIds: [], bossIndex: 0, teamLevel: 0, lives: 2, projectSystem: emptyProject,
};
let savedRun = null;
let toolsEnabled = false;
const developmentState = { version: 1, coins: 25, players: {}, ledger: [], processedTransactions: {} };

const context = {
  console,
  URLSearchParams,
  Map,
  Set,
  Date,
  Math,
  Object,
  Array,
  String,
  Number,
  Boolean,
  document,
  location: { search: '?dev=1' },
  history: { replaceState() {} },
  scrollTo() {},
  requestAnimationFrame(callback) { callback(); },
  MutationObserver: class { observe() {} },
  __INAZUMA_DISABLE_AUTO_INIT__: true,
  ProjectDevTools: { enabled: () => toolsEnabled, enable: () => { toolsEnabled = true; } },
  DevelopmentCenter: { load: () => developmentState, save() {}, invest() {} },
  DevelopmentEconomy: { pendingCoins: () => 0, redeemableCoins: () => 0 },
  ProjectSystem: { migrateRun: (run) => run.projectSystem || emptyProject },
  RunState: {
    latestActiveSave: () => savedRun ? { run: savedRun, season: { id: 'season1' } } : null,
    load: () => savedRun,
    loadProfile: () => ({}),
    saveProfile() {},
    normalizeTeamIdentity: (identity) => identity || { name: 'Raimon' },
    validTeamName: () => true,
    saveProfileTeamIdentity() {},
    save() {},
    isActiveRun: (run) => Boolean(run),
    runLivesLimit: () => 2,
  },
  SeasonRegistry: {
    DEFAULT_SEASON_ID: 'season1',
    setActive: () => ({ id: 'season1', name: 'Season 1' }),
    get: () => ({ id: 'season1', name: 'Season 1' }),
    loadDatabase: async () => seasonDb,
    list: () => [{ id: 'season1', name: 'Season 1' }],
    database: () => seasonDb,
    playersIndex: () => new Map(),
    teamsIndex: () => new Map(),
  },
  RoguelikeRules: { migrateDefeatedBossPlayerLevels: () => 0 },
  InazumaProgression: { getPlayerAtLevel: (player) => player },
  AlbumProgress: { DEFAULT_COLLECTION_ID: 'season1' },
  SEASON1_CONFIG: { formations: seasonDb.formations, itemPool: [] },
};
context.globalThis = context;
context.window = context;
vm.runInNewContext(source, context, { filename: 'js/app.js' });

const ui = context.__INAZUMA_UI_TEST__;
assert.ok(ui, 'runtime UI hooks are available');
assert.equal(toolsEnabled, true, '?dev=1 enables the test tools during initialization');

(async () => {
  savedRun = null;
  await ui.renderHome();
  assert.match(app.innerHTML, /Home senza run attiva/);
  assert.doesNotMatch(app.innerHTML, /development-home-cta|open-development-home/);

  savedRun = activeRun;
  await ui.renderHome();
  assert.match(app.innerHTML, /Home con run attiva/);
  assert.match(app.innerHTML, /GIOCATORE PROGETTO/);
  assert.doesNotMatch(app.innerHTML, /development-home-cta|open-development-home/);

  await ui.renderSeasonSelect();
  assert.match(app.innerHTML, /CENTRO DI SVILUPPO/);
  assert.match(app.innerHTML, /open-development-modes/);

  ui.setRuntimeState({ run: activeRun, seasonDb, developmentCenter: developmentState });
  ui.renderProjectPlayerPage();
  assert.match(app.innerHTML, /GIOCATORE PROGETTO/);
  assert.match(app.innerHTML, /SVILUPPA UNO SVINCOLATO/);

  ui.renderDevelopmentCenter();
  assert.match(app.innerHTML, /Centro di sviluppo/);
  assert.match(app.innerHTML, /Nessun giocatore certificato/);

  ui.installDevToolsAccess();
  assert.equal(toolsEnabled, true, 'test-tool access initializes without missing globals');

  const ids = [
    ...[...source.matchAll(/id="([\w-]+)"/g)].map((match) => match[1]),
    ...[...source.matchAll(/\bid: "([\w-]+)"/g)].map((match) => match[1]),
  ];
  const listeners = [...source.matchAll(/getElementById\("([\w-]+)"\)\??\.addEventListener/g)].map((match) => match[1]);
  for (const id of ['open-modes-home', 'home-primary-cta', 'open-project-home', 'open-development-modes']) {
    assert.ok(ids.includes(id), `navigation listener ${id} has corresponding markup`);
    assert.ok(listeners.includes(id), `navigation markup ${id} has a listener`);
  }
  assert.doesNotMatch(source, /developmentHomeCtaMarkup|open-development-home/);

  console.log('project-navigation-runtime-test: ok');
})().catch((error) => { console.error(error); process.exitCode = 1; });
