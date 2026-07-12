require('../js/match-simulator-config.js');
require('../js/match-simulator.js');
const { makeTeam } = require('../tests/fixtures/match-simulator-teams.js');

const scenariosByType = {
  five: [0, -4, -10, -25, 4, 5, 10, 15],
  eleven: [0, 4, -4, 5, -5, 10, -10, 15, -15, 20, -20, 25, -25],
};
const N = 20000;
let failures = 0;

for (const type of ['five', 'eleven']) {
  console.log(`\n${type === 'five' ? '5v5' : '11v11'} balance (${N} simulations per scenario)`);
  console.log('mode userStrength opponentStrength expected realPct delta draws userWins opponentWins');
  for (const delta of scenariosByType[type]) {
    const userOvr = 70 + delta;
    const oppOvr = 70;
    const probs = global.MatchSimulator.getMatchWinProbabilities(type, userOvr, oppOvr);
    let userWins = 0, opponentWins = 0, draws = 0;
    for (let i = 0; i < N; i += 1) {
      const r = global.MatchSimulator.simulate({ type, seed:`${type}:${delta}:${i}`, userTeam:makeTeam('U', type, userOvr), opponentTeam:makeTeam('O', type, oppOvr) });
      if (r.score.user === r.score.opponent) draws += 1;
      if (r.winner === 'user') userWins += 1;
      else if (r.winner === 'opponent') opponentWins += 1;
      else failures += 1;
    }
    const realPct = userWins / N * 100;
    const deltaPct = realPct - probs.userChance;
    const ok = Math.abs(deltaPct) <= 1.5 && draws === 0;
    if (!ok) failures += 1;
    console.log(`${type} ${userOvr} ${oppOvr} ${probs.userChance.toFixed(2)}% ${realPct.toFixed(2)}% ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(2)} ${draws} ${userWins} ${opponentWins}${ok ? '' : ' OUT_OF_TOLERANCE'}`);
  }
}
if (failures) {
  console.error(`Balance check failed with ${failures} out-of-tolerance scenario(s).`);
  process.exit(1);
}
console.log('\nBalance check passed. All scenarios are within ±1.5 percentage points and draws are zero.');
