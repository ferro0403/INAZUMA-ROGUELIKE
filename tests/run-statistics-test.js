const assert = require('node:assert/strict');
require('../js/run-statistics.js');
const S = global.RunStatistics;
function p(id, role='FW') { return { playerId:id, name:id, position:role, overall:70, displayLevel:1 }; }
function run() { return S.ensureRunStatistics({ runId:'r1', createdAt:'2026-07-17T00:00:00.000Z', roster:[] }); }
const lineup5 = [p('gk','GK'), p('df','DF'), p('mf','MF'), p('fw1'), p('fw2')];
const r = run();
S.applyCompletedMatchStatistics(r, { matchId:'m1', type:'five_v_five', nodeId:'n1', result:'victory', score:{ user:2, opponent:0 }, lineupSnapshot:{ players:lineup5 }, timeline:[{ type:'goal', team:'user', playerId:'fw1', minute:3 }, { type:'goal', team:'user', playerId:'mf', minute:7 }, { type:'save', team:'user', playerId:'gk', minute:9 }, { type:'defensive_stop', team:'user', playerId:'df', minute:12 }, { type:'post', team:'user', playerId:'fw2', minute:13 }] });
S.applyCompletedMatchStatistics(r, { matchId:'m1', type:'five_v_five', nodeId:'n1', result:'victory', score:{ user:2, opponent:0 }, lineupSnapshot:{ players:lineup5 }, timeline:[] });
assert.equal(r.statistics.matchesTotal, 1, '5v5 counted once');
assert.equal(r.statistics.fiveVFiveWins, 1, '5v5 win counted');
assert.equal(r.statistics.goalsFor, 2, 'team goals come from frozen score');
assert.equal(r.statistics.cleanSheets, 1, 'team clean sheet counted');
assert.equal(Object.values(r.playerStatistics).reduce((sum, ps) => sum + ps.appearances, 0), 5, 'exactly five appearances');
assert.equal(r.playerStatistics.fw1.goals, 1, 'individual goal from event');
assert.equal(r.playerStatistics.gk.saves, 1, 'save assigned to GK');
assert.equal(r.playerStatistics.df.defensiveActions, 1, 'defensive stop assigned to protagonist');
assert.equal(r.playerStatistics.gk.cleanSheets, 1, 'GK clean sheet');
assert.equal(r.playerStatistics.df.cleanSheets, 1, 'DF clean sheet');
assert.equal(r.playerStatistics.fw2.shots, 1, 'post counts as shot');
assert.equal(S.createStableMatchId({ runId:'r' }, { nodeId:'n', type:'five_v_five', attemptNumber:1, simulation:{ seed:'s' } }), 'r::n::five_v_five::1::s');
console.log('run-statistics-test passed');
