const assert = require('node:assert/strict');
require('../js/match-simulator-config.js');
require('../js/match-simulator.js');
const { makeTeam } = require('./fixtures/match-simulator-teams.js');
const sim = global.MatchSimulator;
const probabilityCases = [
  [0, 60, 40], [4, 60, 40],
  [5, 70, 30], [10, 75, 25], [15, 80, 20], [20, 85, 15], [25, 90, 10], [30, 95, 5], [35, 100, 0], [40, 100, 0],
];
for (const [diff, user, opponent] of probabilityCases) {
  const p = sim.getFinalWinProbabilities(60 + diff, 60);
  assert.equal(p.userChance, user, `user stronger diff ${diff}`);
  assert.equal(p.opponentChance, opponent, `opponent weaker diff ${diff}`);
  assert.equal(p.userBonus, 10, `single fixed bonus diff ${diff}`);
  assert.equal(p.userChance + p.opponentChance, 100, `sum ${diff}`);
  assert.equal(p.user, user / 100, `engine decimal user diff ${diff}`);
}
const weakerCases = [[5, 50, 50], [10, 45, 55], [15, 40, 60], [20, 35, 65], [25, 30, 70], [30, 25, 75], [35, 20, 80], [40, 15, 85]];
for (const [diff, user, opponent] of weakerCases) {
  const p = sim.getFinalWinProbabilities(60, 60 + diff);
  assert.equal(p.userChance, user, `user weaker diff ${diff}`);
  assert.equal(p.opponentChance, opponent, `opponent stronger diff ${diff}`);
  assert.equal(p.userChance + p.opponentChance, 100, `sum weaker ${diff}`);
}
for (const type of ['eleven', 'five']) {
  const r = sim.simulate({ type, seed:'prob-ui', userTeam:makeTeam('P', type, 100), opponentTeam:makeTeam('Q', type, 60) });
  assert(r.valid);
  assert.equal(r.probabilities.user, 1, `${type} uses final clamped 100% user probability`);
  assert.equal(r.probabilities.opponent, 0, `${type} opponent chance is derived from same helper`);
  assert.equal(r.probabilities.userChance, 100, `${type} UI percent equals engine percent`);
}
for (const type of ['eleven', 'five']) {
  const a = makeTeam('A', type, 65);
  const b = makeTeam('B', type, 60);
  const r1 = sim.simulate({ type, seed:'same', userTeam:a, opponentTeam:b });
  const r2 = sim.simulate({ type, seed:'same', userTeam:a, opponentTeam:b });
  assert(r1.valid);
  assert.notEqual(r1.score.user, r1.score.opponent, 'no draw');
  assert.equal(r1.winner, r2.winner);
  assert.deepEqual(r1.score, r2.score);
  assert.deepEqual(r1.timeline, r2.timeline);
  assert(r1.timeline.length >= (type === 'five' ? 8 : 12));
  assert(r1.timeline.length <= (type === 'five' ? 10 : 20));
  assert.equal(r1.timeline.some(e => e.type === 'first_half_start'), type === 'eleven');
  assert.equal(r1.timeline.some(e => e.type === 'second_half_start'), type === 'eleven');
  const goals = r1.timeline.filter(e => e.type === 'goal');
  assert.equal(goals.filter(e => e.team === 'user').length, r1.score.user);
  assert.equal(goals.filter(e => e.team === 'opponent').length, r1.score.opponent);
  const allowed = new Set(global.MatchSimulatorConfig.allowedEventTypes);
  for (const ev of r1.timeline) {
    assert(allowed.has(ev.type), ev.type);
    if (ev.playerId) assert(String(ev.playerId).startsWith(ev.team === 'user' ? 'A_' : 'B_'));
    if (ev.playerId && ev.type !== 'save') assert(!String(ev.playerId).includes('_GK_'));
    if (ev.type === 'save') assert(String(ev.playerId).includes('_GK_'));
  }
  const minutes = r1.timeline.map(e => e.minute);
  assert.deepEqual(minutes, [...minutes].sort((x,y)=>x-y));
  const validScores = new Set(global.MatchSimulatorConfig.scores[type].map(x => x.score.join('-')));
  const winnerScore = r1.winner === 'user' ? [r1.score.user, r1.score.opponent] : [r1.score.opponent, r1.score.user];
  assert(validScores.has(winnerScore.join('-')));
}
console.log('Match simulator test passed.');
