const assert = require('node:assert/strict');
require('../js/run-statistics.js');
const S = global.RunStatistics;
const run = S.ensureRunStatistics({ runId:'awards' });
function ps(id, role, patch) { run.playerStatistics[id] = { ...S.createEmptyPlayerStatistics({ playerId:id, position:role, name:id }), role, appearances:3, ratingTotal:20, ratingCount:3, averageRating:6.7, finalOverall:70, ...patch }; }
ps('fw','FW',{ goals:5, finalOverall:75 }); ps('gk','GK',{ saves:9, cleanSheets:2, bossWins:1 }); ps('df','DF',{ defensiveActions:7, cleanSheets:2, bossAppearances:2 }); ps('grow','MF',{ recruitedOverall:50, finalOverall:70, overallGrowth:20, finalLevel:10, recruitedAtLevel:1 }); ps('hero','FW',{ finalAppearances:1, finalMatchRating:8.7, finalMatchGoals:2, goals:2 });
const awards = S.calculateSeasonAwards(run);
const ids = awards.map((a)=>a.awardId);
assert(ids.includes('top_scorer'), 'top scorer award');
assert(ids.includes('best_goalkeeper'), 'best GK award');
assert(ids.includes('defensive_pillar'), 'defensive pillar award');
assert(ids.includes('most_improved'), 'most improved award');
assert(ids.includes('final_hero'), 'final hero award');
assert(ids.includes('mvp'), 'MVP award');
assert.equal(awards.find((a)=>a.awardId === 'top_scorer').playerId, 'fw');
assert.equal(awards.find((a)=>a.awardId === 'final_hero').playerId, 'hero');
console.log('season-awards-test passed');
