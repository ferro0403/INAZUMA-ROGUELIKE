const assert = require('node:assert/strict');
class Storage { constructor() { this.data = new Map(); } get length() { return this.data.size; } key(index) { return [...this.data.keys()][index]; } getItem(key) { return this.data.has(key) ? this.data.get(key) : null; } setItem(key, value) { this.data.set(key, String(value)); } removeItem(key) { this.data.delete(key); } }
global.localStorage = new Storage(); global.location = { search: '?dev=1' };
global.ProjectSystem = { migrateRun(run) { return run.projectSystem; }, recalculate(_run, progress) { return progress; }, emptyState() { return { schemaVersion: 1, activePlayerId: null, testToolUsed: false, players: {}, processedMatchIds: [] }; } };
global.ProjectConfig = { stageForRarity() { return { wins: 5, bossWins: 2, bossStreak: 2, firstAttempts: 1, role: { FW: 2 }, cost: 400 }; } };
const Dev = require('../js/project-dev-tools.js');
assert.equal(Dev.enabled(), true, '?dev=1 activates tools'); Dev.enable(); assert.equal(localStorage.getItem(Dev.ENABLE_KEY), '1'); Dev.disable(); assert.equal(localStorage.getItem(Dev.ENABLE_KEY), null, 'disable removes only its flag');
localStorage.setItem('inazuma_run', '{"run":1}'); localStorage.setItem('unrelated', 'keep'); const backup = Dev.createBackup(); assert.ok(backup.createdAt); localStorage.setItem('inazuma_run', '{"run":2}'); Dev.restoreBackup(); assert.equal(localStorage.getItem('inazuma_run'), '{"run":1}'); assert.equal(localStorage.getItem('unrelated'), 'keep', 'restore leaves unrelated storage untouched');
const run = { projectSystem: { activePlayerId: 'p', testToolUsed: false, players: { p: { playerId: 'p', role: 'FW', permanentRarityAtRunStart: 'Normale', officialWins: 0, bossWins: 0, rolePoints: 0, finalConditions: {} } } } }; const center = { coins: 0, coinLedger: [] };
Dev.addCoins(run, center, 50); assert.equal(center.coins, 50); assert.equal(center.coinLedger[0].isTest, true); assert.equal(center.coinLedger[0].origin, 'devTools'); assert.equal(run.projectSystem.testToolUsed, true, 'every mutation contaminates official certification');
Dev.adjustProject(run, { officialWins: 1 }); assert.equal(run.projectSystem.players.p.officialWins, 1); assert.ok(run.devToolLedger.every((entry) => entry.isTest && entry.origin === 'devTools'));
Dev.resetProject(run); assert.equal(run.projectSystem.activePlayerId, null, 'selective Project reset leaves other saves untouched');
console.log('dev-tools-test: ok');
