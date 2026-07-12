const assert = require('node:assert/strict');
require('../js/match-simulator-config.js');
require('../js/match-simulator.js');
const { makeTeam } = require('./fixtures/match-simulator-teams.js');
const sim = global.MatchSimulator;
const probabilityCases = [[0,.5],[4,.5],[5,.6],[9,.6],[10,.65],[14,.65],[15,.7],[19,.7],[20,.75],[24,.75],[25,.8],[29,.8],[30,.85],[34,.85],[35,.9],[39,.9],[40,.95],[80,.95]];
for (const [diff, expected] of probabilityCases) {
  const p = sim.probabilities(60 + diff, 60);
  assert.equal(p.user, expected, `diff ${diff}`);
  assert.equal(Number((p.user + p.opponent).toFixed(6)), 1, `sum ${diff}`);
  assert(p.user <= .95 && p.opponent <= .95);
  assert(p.user >= .05 && p.opponent >= .05);
  const reverse = sim.probabilities(60, 60 + diff);
  assert.equal(reverse.opponent, expected, `reverse ${diff}`);
  assert.equal(reverse.user, p.opponent, `symmetric user ${diff}`);
}
for (const type of ['eleven', 'five']) {
  const r = sim.simulate({ type, seed:'prob-ui', userTeam:makeTeam('P', type, 100), opponentTeam:makeTeam('Q', type, 60) });
  assert(r.valid);
  assert.equal(r.probabilities.user, .95, `${type} uses capped 95% probability`);
  assert.equal(r.probabilities.opponent, .05, `${type} weak side keeps 5% chance`);
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
