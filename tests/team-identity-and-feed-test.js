const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appJs = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/game.css'), 'utf8');

global.SEASON1_CONFIG = { saveVersion: 1, saveKey: 'inazuma_test_run' };
const store = new Map();
global.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
};
require('../js/run-state.js');

const run = global.RunState.createRun({ name: 'Storm Eleven', logo: 'boss-logo' });
assert.equal(run.teamIdentity.name, 'Storm Eleven');
assert.equal(run.teamIdentity.logo, 'inazuma-lightning', 'user logo stays the fixed lightning logo');
global.RunState.save(run);
const saved = global.RunState.saveProfileTeamIdentity(run.teamIdentity);
assert.equal(saved.name, 'Storm Eleven');
assert.equal(JSON.parse(store.get('inazuma_roguelike_profile')).teamIdentity.name, 'Storm Eleven', 'profile uses separate localStorage key');
global.RunState.remove();
assert.equal(global.RunState.load(), null, 'run can be removed independently');
assert.equal(global.RunState.loadProfile().teamIdentity.name, 'Storm Eleven', 'profile survives run removal/game over');
assert.equal(global.RunState.validTeamName('La tua squadra'), '', 'fallback name is not migrated over a real profile name');

assert(!appJs.includes('toast(`${player.name} entra nella squadra`)'), 'initial starter draft suppresses all per-pick toasts');
assert(appJs.includes('finishNonMatchNode(node, added ? `${player.name} entra nella rosa`'), 'normal pull notifications remain wired');
assert(appJs.includes('function matchEventSideClass(side)'), 'match feed maps structured event side to semantic classes');
assert(appJs.includes('side: ev.team === "user" || ev.team === "opponent" ? ev.team : null'), 'match event side comes from structured team field, not text');
assert(css.includes('.boss-match-log li.match-event--user') && css.includes('#36a9ff'), 'user commentary has blue styling');
assert(css.includes('.boss-match-log li.match-event--opponent') && css.includes('#ff5b6e'), 'opponent commentary has red styling');
assert(css.includes('.boss-match-log li.match-event--neutral'), 'legacy and neutral commentary has neutral styling');
assert(appJs.includes('Modifica nome squadra') && appJs.includes('openEditTeamNameModal'), 'home exposes the team-name edit command');
assert(appJs.includes('Sostituire la run salvata?') && appJs.includes('confirm-new-run'), 'new runs with an existing profile keep only an overwrite confirmation, not a second name prompt');
assert(appJs.includes('migrateTeamIdentityProfile'), 'profile migration is idempotently invoked from home');

console.log('Team identity, draft notification, and match feed static/regression tests passed.');
