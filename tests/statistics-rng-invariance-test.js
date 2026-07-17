const assert = require('node:assert/strict');
require('../js/match-simulator-config.js');
require('../js/match-simulator.js');
require('../js/run-statistics.js');
const { makeTeam } = require('./fixtures/match-simulator-teams.js');
for (const type of ['five', 'eleven']) {
  const userTeam = makeTeam('U', type, 72);
  const opponentTeam = makeTeam('O', type, 68);
  const before = global.MatchSimulator.simulate({ type, seed:`rng-${type}`, userTeam, opponentTeam });
  const run = global.RunStatistics.ensureRunStatistics({ runId:`rng-${type}` });
  global.RunStatistics.applyCompletedMatchStatistics(run, { matchId:`m-${type}`, type:type === 'five' ? 'five_v_five' : 'boss', result:before.winner === 'user' ? 'victory' : 'defeat', score:before.score, lineupSnapshot:{ players:userTeam.players }, timeline:before.timeline, userStrength:before.userStrength, opponentStrength:before.opponentStrength, probabilities:before.probabilities });
  const after = global.MatchSimulator.simulate({ type, seed:`rng-${type}`, userTeam, opponentTeam });
  assert.equal(after.winner, before.winner, `${type} winner unchanged`);
  assert.deepEqual(after.score, before.score, `${type} score unchanged`);
  assert.deepEqual(after.timeline, before.timeline, `${type} timeline unchanged`);
}
console.log('statistics-rng-invariance-test passed');
