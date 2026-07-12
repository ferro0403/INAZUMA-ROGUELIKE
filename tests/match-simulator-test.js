const assert = require('node:assert/strict');
require('../js/match-simulator-config.js');
require('../js/match-simulator.js');
const { makeTeam } = require('./fixtures/match-simulator-teams.js');
const sim = global.MatchSimulator;

function assertProb(userStrength, opponentStrength, userChance, opponentChance, label) {
  const p = sim.getMatchWinProbabilities(userStrength, opponentStrength);
  assert.equal(p.userChance, userChance, `${label} userChance`);
  assert.equal(p.opponentChance, opponentChance, `${label} opponentChance`);
  assert.equal(p.userChance + p.opponentChance, 100, `${label} sum`);
  assert.equal(p.user, userChance / 100, `${label} engine user decimal`);
  assert.equal(p.opponent, opponentChance / 100, `${label} engine opponent decimal`);
  assert.deepEqual(sim.probabilities(userStrength, opponentStrength), p, `${label} UI and engine share helper result`);
  assert(!('userBonus' in p), `${label} no old +10 bonus field`);
  assert(!('baseUserChance' in p), `${label} no old pre-bonus chance field`);
}

[
  [60, 60, 70, 30, 'same strength'],
  [61, 60, 70, 30, 'user +1'],
  [64, 60, 70, 30, 'user +4'],
  [60, 61, 70, 30, 'user -1'],
  [60, 64, 70, 30, 'user -4'],
  [65, 60, 80, 20, 'user +5'],
  [69, 60, 80, 20, 'user +9'],
  [70, 60, 88, 12, 'user +10'],
  [74, 60, 88, 12, 'user +14'],
  [75, 60, 94, 6, 'user +15'],
  [79, 60, 94, 6, 'user +19'],
  [80, 60, 97, 3, 'user +20'],
  [110, 60, 97, 3, 'user +50'],
  [60, 65, 60, 40, 'user -5'],
  [60, 69, 60, 40, 'user -9'],
  [60, 70, 55, 45, 'user -10'],
  [60, 74, 55, 45, 'user -14'],
  [60, 75, 50, 50, 'user -15'],
  [60, 79, 50, 50, 'user -19'],
  [60, 80, 45, 55, 'user -20'],
  [60, 84, 45, 55, 'user -24'],
  [60, 85, 40, 60, 'user -25'],
  [60, 110, 40, 60, 'user -50'],
].forEach(([u, o, uc, oc, label]) => assertProb(u, o, uc, oc, label));

assert.equal(global.MatchSimulatorConfig.userWinBonus, undefined, 'old +10 userWinBonus removed from config');
assert.equal(global.MatchSimulatorConfig.probabilityBands, undefined, 'old base probability table removed from config');
assert.equal(sim.getFinalWinProbabilities, sim.getMatchWinProbabilities, 'legacy export points at central helper');

for (const [chance, cases] of [
  [70, [[0.00, true], [0.30, true], [0.69, true], [0.70, false], [0.99, false]]],
  [40, [[0.00, true], [0.39, true], [0.40, false], [0.90, false]]],
  [97, [[0.96, true], [0.97, false]]],
]) {
  for (const [roll, expected] of cases) {
    assert.equal(sim.determineUserWins(chance, () => roll), expected, `chance ${chance} roll ${roll}`);
  }
}

for (const type of ['eleven', 'five']) {
  const equal = sim.simulate({ type, seed:'prob-equal', userTeam:makeTeam('P', type, 70), opponentTeam:makeTeam('Q', type, 70) });
  assert(equal.valid);
  assert.equal(equal.probabilities.userChance, 70, `${type} equal strength uses 70/30`);
  assert.equal(equal.probabilities.opponentChance, 30, `${type} equal strength opponent chance`);

  const stronger = sim.simulate({ type, seed:'prob-strong', userTeam:makeTeam('P', type, 80), opponentTeam:makeTeam('Q', type, 60) });
  assert(stronger.valid);
  assert.equal(stronger.probabilities.userChance, 97, `${type} user +20 uses 97/3`);

  const weaker = sim.simulate({ type, seed:'prob-weak', userTeam:makeTeam('P', type, 60), opponentTeam:makeTeam('Q', type, 85) });
  assert(weaker.valid);
  assert.equal(weaker.probabilities.userChance, 40, `${type} user -25 uses 40/60`);
}

for (const type of ['eleven', 'five']) {
  const a = makeTeam('A', type, 65);
  const b = makeTeam('B', type, 60);
  const r1 = sim.simulate({ type, seed:'same', userTeam:a, opponentTeam:b });
  const r2 = sim.simulate({ type, seed:'same', userTeam:a, opponentTeam:b });
  assert(r1.valid);
  assert.notEqual(r1.score.user, r1.score.opponent, `${type} no draw`);
  assert.equal(r1.winner, r2.winner, `${type} same seed same winner`);
  assert.deepEqual(r1.score, r2.score, `${type} same seed same score`);
  assert.deepEqual(r1.timeline, r2.timeline, `${type} same seed same timeline`);
  assert.equal(r1.winner === 'user', r1.score.user > r1.score.opponent, `${type} score coherent with extracted winner`);
  const goals = r1.timeline.filter(e => e.type === 'goal');
  assert.equal(goals.filter(e => e.team === 'user').length, r1.score.user, `${type} user goals match score`);
  assert.equal(goals.filter(e => e.team === 'opponent').length, r1.score.opponent, `${type} opponent goals match score`);
  assert.equal(goals.some(e => e.team === r1.winner), true, `${type} commentary contains winning side goals`);
  assert.equal(r1.timeline.some(e => e.type === 'first_half_start'), type === 'eleven');
  assert.equal(r1.timeline.some(e => e.type === 'second_half_start'), type === 'eleven');
  const allowed = new Set(global.MatchSimulatorConfig.allowedEventTypes);
  for (const ev of r1.timeline) assert(allowed.has(ev.type), ev.type);
}

console.log('Match simulator test passed. Controlled RNG: 70% rolls 0/0.30/0.69 win and 0.70/0.99 lose; 40% rolls 0/0.39 win and 0.40/0.90 lose; 97% roll 0.96 wins and 0.97 loses.');
