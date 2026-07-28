const assert = require('node:assert/strict');
global.InazumaProgression = require('../js/roguelike_progression.js');
global.ProjectConfig = require('../js/project-config.js');
const Project = require('../js/project-system.js');

const fw = { playerId: 'fa1', name: 'Axel', position: 'FW', category: 'Normale', finalOverall: 74 };
const mf = { playerId: 'fa2', name: 'Jude', position: 'MF', category: 'Normale', finalOverall: 74 };
const teamPlayer = { playerId: 'team1', position: 'FW', category: 'Normale', finalOverall: 74 };
const freeAgents = { players: [fw, mf, { playerId: 'gold', position: 'FW', category: 'Leggenda', finalOverall: 96 }] };
const run = { version: 2, runId: 'run1', roster: [{ playerId: 'fa1' }, { playerId: 'fa2' }, { playerId: 'team1' }, { playerId: 'gold' }], lineup: ['fa1'], initialLives: 2 };
const center = { players: {} };

assert.equal(Project.select(run, fw, { freeAgents, developmentCenter: center }).eligible, true, 'a rostered free agent is selectable');
assert.equal(Project.select(run, teamPlayer, { freeAgents, developmentCenter: center }).eligible, false, 'a normal-team player is rejected');
assert.equal(Project.select(run, freeAgents.players[2], { freeAgents, developmentCenter: center }).eligible, false, 'maximum rarity is rejected');
center.players.fa2 = { pendingStage: {} };
assert.equal(Project.select(run, mf, { freeAgents, developmentCenter: center }).eligible, false, 'pending development is rejected');
delete center.players.fa2;

const first = Project.select(run, fw, { freeAgents, developmentCenter: center });
run.projectSystem.players.fa1.officialWins = 2;
Project.select(run, mf, { freeAgents, developmentCenter: center });
assert.equal(Project.effectiveBoost(run, 'fa1'), 0, 'only the active project receives its boost');
Project.select(run, fw, { freeAgents, developmentCenter: center });
assert.equal(run.projectSystem.players.fa1.officialWins, 2, 'returning preserves personal progress');
assert.notEqual(first.progress, run.projectSystem.players.fa2, 'players have separate progress');

const before = Project.snapshotMatch(run, { matchId: 'before', type: 'five_v_five', lineup: ['fa2'] });
assert.equal(Project.processMatch(run, before, { official: true, completed: true, won: true, goalsFor: 1, goalsAgainst: 0 }).processed, false, 'bench does not count');
const snap = Project.snapshotMatch(run, { matchId: 'm1', type: 'five_v_five', lineup: ['fa1'] });
let result = Project.processMatch(run, snap, { official: true, completed: true, won: true, goalsFor: 2, goalsAgainst: 0, scorers: ['fa1'] });
assert.equal(result.processed, true, 'an official 5v5 counts');
assert.equal(result.progress.rolePoints, 1, 'structured FW goal scores one point');
assert.equal(Project.processMatch(run, snap, { official: true, completed: true, won: true }).processed, false, 'duplicate match is ignored');
const forced = Project.snapshotMatch(run, { matchId: 'forced', type: 'boss', bossId: 'b1', lineup: ['fa1'] });
assert.equal(Project.processMatch(run, forced, { official: true, completed: true, won: true, forced: true }).processed, false, 'safe victory gives no progress');
assert.equal(run.projectSystem.testToolUsed, true, 'test tooling contaminates certification');

function rolePoints(role, data) { return Project.rolePoints({ role, playerId: 'p' }, { won: true, scorers: [], goalsFor: 0, goalsAgainst: 0, matchType: 'five_v_five', ...data }); }
assert.equal(rolePoints('MF', { goalsFor: 2, scorers: ['p'] }), 3, 'MF takes best playmaking tier plus a reliable personal goal');
assert.equal(rolePoints('DF', { goalsAgainst: 0 }), 2, 'DF clean sheet scores solidity');
assert.equal(rolePoints('GK', { goalsAgainst: 1 }), 1, 'GK one-goal win scores protection');
assert.equal(rolePoints('FW', { scorers: [], commentary: 'p segna tre gol' }), 0, 'commentary is never parsed');

const bossRun = { version: 2, runId: 'boss', roster: [{ playerId: 'fa1' }], lineup: ['fa1'] };
Project.select(bossRun, fw, { freeAgents, developmentCenter: center });
for (const [id, won] of [['b1', true], ['b2', false], ['b2', true]]) {
  const s = Project.snapshotMatch(bossRun, { matchId: `${id}-${won}`, type: 'boss', bossId: id, lineup: ['fa1'] });
  Project.processMatch(bossRun, s, { official: true, completed: true, won, goalsFor: won ? 2 : 0, goalsAgainst: won ? 0 : 2 });
}
assert.equal(bossRun.projectSystem.players.fa1.firstAttemptBossWins, 1, 'only the genuine first attempt counts');
assert.equal(bossRun.projectSystem.players.fa1.maxBossWinStreak, 1, 'defeat interrupts streak');
assert.equal(bossRun.projectSystem.players.fa1.defeatsAfterProjectStart, 1, 'defeat remains recorded');

const p = bossRun.projectSystem.players.fa1; p.requiredGrowth = 5; p.officialWins = 2; p.rolePoints = 1; p.bossWins = 1; p.finalConditions.runWon = false;
Project.recalculate(bossRun, p); assert.equal(p.projectBoost, Math.floor(5 * p.progressPercent / 100), 'progressive boost rounds down');
const completeRun = { version: 2, runId: 'complete', roster: [{ playerId: 'fa1' }], lineup: ['fa1'], initialLives: 2 };
Project.select(completeRun, fw, { freeAgents, developmentCenter: center });
const complete = completeRun.projectSystem.players.fa1;
Object.assign(complete, { officialWins: 5, rolePoints: 2, bossWins: 2, maxBossWinStreak: 2 });
Object.assign(complete.finalConditions, { runWon: true, finalRoster: true });
Project.recalculate(completeRun, complete);
assert.equal(complete.progressPercent, 100); assert.equal(complete.projectBoost, complete.requiredGrowth, '100% reaches the exact next-rarity threshold');
const candidates = Project.markRunEnd(completeRun, { won: true, livesRemaining: 2, finalRoster: ['fa1'], finalLineup: ['fa1'] });
Project.prepareCertification(completeRun, candidates.map((candidate) => candidate.playerId));
assert.ok(Project.completeCertification(completeRun, 'fa1', fw));
assert.equal(Project.completeCertification(completeRun, 'fa1', fw), null, 'a run certifies only once');
console.log('project-system-test: ok');
