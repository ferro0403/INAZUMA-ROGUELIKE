require('../js/match-simulator-config.js');
require('../js/match-simulator.js');
const { makeTeam } = require('../tests/fixtures/match-simulator-teams.js');
const diffs = [0,4,5,8,9,10,14,15,20];
const N = 10000;
for (const type of ['eleven','five']) {
  for (const diff of diffs) {
    for (const strongUser of [true,false]) {
      const userOvr = strongUser ? 60 + diff : 60;
      const oppOvr = strongUser ? 60 : 60 + diff;
      let strongWins=0, weakWins=0, draws=0, goals=0, events=0;
      for (let i=0;i<N;i++) {
        const r = global.MatchSimulator.simulate({ type, seed:`${type}:${diff}:${strongUser}:${i}`, userTeam:makeTeam('U', type, userOvr), opponentTeam:makeTeam('O', type, oppOvr) });
        if (r.score.user === r.score.opponent) draws++;
        const strongWon = strongUser ? r.winner === 'user' : r.winner === 'opponent';
        strongWon ? strongWins++ : weakWins++;
        goals += r.score.user + r.score.opponent;
        events += r.timeline.length;
      }
      const expected = diff <= 4 ? 50 : diff <= 9 ? 60 : diff <= 14 ? 65 : 70;
      const pct = strongWins / N * 100;
      console.log(`${type} diff=${diff} strong=${strongUser?'user':'opponent'} games=${N} strongWins=${strongWins} weakWins=${weakWins} draws=${draws} pct=${pct.toFixed(2)} expected=${expected} avgGoals=${(goals/N).toFixed(2)} avgEvents=${(events/N).toFixed(2)}`);
    }
  }
}
