const assert = require('node:assert/strict');
require('../js/match-simulator-config.js');
require('../js/match-simulator.js');
const { makeTeam } = require('./fixtures/match-simulator-teams.js');
const sim = global.MatchSimulator;

function assertProb(mode, userStrength, opponentStrength, userChance, opponentChance, label) {
  const p = sim.getMatchWinProbabilities(mode, userStrength, opponentStrength);
  assert.equal(p.mode, mode === 'five_v_five' ? 'five' : mode, `${label} normalized mode`);
  assert.equal(p.userChance, userChance, `${label} userChance`);
  assert.equal(p.opponentChance, opponentChance, `${label} opponentChance`);
  assert.equal(p.userChance + p.opponentChance, 100, `${label} sum`);
  assert.equal(p.user, userChance / 100, `${label} engine user decimal`);
  assert.equal(p.opponent, opponentChance / 100, `${label} engine opponent decimal`);
  assert.deepEqual(sim.probabilities(mode, userStrength, opponentStrength), p, `${label} UI and engine share helper result`);
  assert(!('userBonus' in p), `${label} no old +10 bonus field`);
  assert(!('baseUserChance' in p), `${label} no old pre-bonus chance field`);
}

[
  [60, 60, 80, 20, 'same strength'],
  [61, 60, 80, 20, 'user +1'],
  [64, 60, 80, 20, 'user +4'],
  [60, 61, 80, 20, 'user -1'],
  [60, 64, 80, 20, 'user -4'],
  [60, 65, 80, 20, 'user -5'],
  [60, 70, 80, 20, 'user -10'],
  [60, 80, 80, 20, 'user -20'],
  [60, 160, 80, 20, 'user -100'],
  [65, 60, 85, 15, 'user +5'],
  [69, 60, 85, 15, 'user +9'],
  [70, 60, 90, 10, 'user +10'],
  [74, 60, 90, 10, 'user +14'],
  [75, 60, 95, 5, 'user +15'],
  [110, 60, 95, 5, 'user +50'],
].forEach(([u, o, uc, oc, label]) => assertProb('five', u, o, uc, oc, `5v5 ${label}`));

for (let delta = -120; delta <= 120; delta += 1) {
  const p = sim.getMatchWinProbabilities('five', 100 + delta, 100);
  assert(p.userChance >= 80, `5v5 min 80 for delta ${delta}`);
  assert(p.userChance <= 95, `5v5 max 95 for delta ${delta}`);
  assert.equal(p.userChance + p.opponentChance, 100, `5v5 sum for delta ${delta}`);
}
assert.equal(sim.getMatchWinProbabilities('five', 40, 60).userChance, 80, '5v5 no extra +5/+10 bonus when weaker by 20');
assert.equal(sim.getMatchWinProbabilities('five', 65, 60).userChance, 85, '5v5 +5 is exactly 85, not 90/95');
assert.equal(sim.getMatchWinProbabilities('five', 70, 60).userChance, 90, '5v5 +10 is exactly 90, not 95/100');

[
  [60, 60, 70, 30, 'same strength'],
  [61, 60, 70, 30, 'user +1'],
  [64, 60, 70, 30, 'user +4'],
  [60, 61, 70, 30, 'user -1'],
  [60, 64, 70, 30, 'user -4'],
  [65, 60, 80, 20, 'user +5'],
  [70, 60, 88, 12, 'user +10'],
  [75, 60, 94, 6, 'user +15'],
  [80, 60, 97, 3, 'user +20'],
  [60, 65, 60, 40, 'user -5'],
  [60, 70, 55, 45, 'user -10'],
  [60, 75, 50, 50, 'user -15'],
  [60, 80, 45, 55, 'user -20'],
  [60, 85, 40, 60, 'user -25'],
].forEach(([u, o, uc, oc, label]) => assertProb('eleven', u, o, uc, oc, `11v11 ${label}`));
assert.equal(sim.getMatchWinProbabilities('eleven', 60, 85).userChance, 40, '11v11 weaker by 25 is not replaced by 5v5 minimum 80');
assert.equal(sim.getMatchWinProbabilities(60, 85).userChance, 40, 'legacy two-argument helper defaults to 11v11 table');

assert.equal(global.MatchSimulatorConfig.userWinBonus, undefined, 'old +10 userWinBonus removed from config');
assert.equal(global.MatchSimulatorConfig.probabilityBands, undefined, 'old base probability table removed from config');
assert.equal(sim.getFinalWinProbabilities, sim.getMatchWinProbabilities, 'legacy export points at central helper');

for (const [chance, cases] of [
  [80, [[0.00, true], [0.50, true], [0.79, true], [0.80, false], [0.99, false]]],
  [85, [[0.84, true], [0.85, false]]],
  [90, [[0.89, true], [0.90, false]]],
  [95, [[0.94, true], [0.95, false]]],
]) {
  for (const [roll, expected] of cases) {
    assert.equal(sim.determineUserWins(chance, () => roll), expected, `chance ${chance} roll ${roll}`);
  }
}

for (const [type, equalChance, strongChance, weakChance] of [['eleven', 70, 97, 40], ['five', 80, 95, 80]]) {
  const equal = sim.simulate({ type, seed:'prob-equal', userTeam:makeTeam('P', type, 70), opponentTeam:makeTeam('Q', type, 70) });
  assert(equal.valid);
  assert.equal(equal.probabilities.userChance, equalChance, `${type} equal strength expected chance`);
  assert.equal(equal.probabilities.mode, type, `${type} simulation records probability mode`);

  const stronger = sim.simulate({ type, seed:'prob-strong', userTeam:makeTeam('P', type, 80), opponentTeam:makeTeam('Q', type, 60) });
  assert(stronger.valid);
  assert.equal(stronger.probabilities.userChance, strongChance, `${type} user +20 expected chance`);

  const weaker = sim.simulate({ type, seed:'prob-weak', userTeam:makeTeam('P', type, 60), opponentTeam:makeTeam('Q', type, 85) });
  assert(weaker.valid);
  assert.equal(weaker.probabilities.userChance, weakChance, `${type} user -25 expected chance`);
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
}

for (const type of ['five', 'eleven']) {
  const current = makeTeam('SYNC', type, 72);
  const removed = makeTeam('OLD', type, 72);
  const opponent = makeTeam('OPP', type, 65);
  const result = sim.simulate({ type, seed:`sync-${type}`, userTeam:current, opponentTeam:opponent });
  assert(result.valid, `${type} synced lineup simulation must be valid`);
  const currentIds = new Set(current.players.map((p) => String(p.playerId)));
  const removedIds = new Set(removed.players.map((p) => String(p.playerId)));
  assert.equal(result.userPlayerIds.length, type === 'five' ? 5 : 11, `${type} snapshot size`);
  assert.equal(new Set(result.userPlayerIds).size, result.userPlayerIds.length, `${type} no duplicated snapshot ids`);
  for (const event of result.timeline.filter((ev) => ev.team === 'user' && ev.playerId)) {
    assert(currentIds.has(String(event.playerId)), `${type} user protagonist ${event.playerId} belongs to final snapshot`);
    assert(!removedIds.has(String(event.playerId)), `${type} old lineup player ${event.playerId} is not in commentary`);
    if (event.type === 'save') {
      const gk = current.players.find((p) => p.position === 'GK');
      assert.equal(String(event.playerId), String(gk.playerId), `${type} saves use final snapshot GK`);
    }
  }
  assert.equal(sim.validateUserTimeline(result.timeline, current).valid, true, `${type} timeline validates against final snapshot`);
  const invalid = sim.validateUserTimeline([{ minute: 1, type: 'shot', team: 'user', playerId: removed.players[0].playerId }], current);
  assert.equal(invalid.valid, false, `${type} validator rejects removed lineup protagonist`);
}


console.log('Match simulator test passed. Controlled RNG: 80/85/90/95 thresholds verified; 5v5 and 11v11 tables are separate.');
