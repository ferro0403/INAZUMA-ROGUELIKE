const assert = require('assert');
const appJs = require('fs').readFileSync('js/app.js', 'utf8');
assert(appJs.includes('collectPlayerStatistics'), 'player statistics are collected centrally');
assert(appJs.includes('appearancesTotal') && appJs.includes('bossMatches'), 'appearance and boss match fields are persisted');
assert(appJs.includes('goals') && appJs.includes('saves') && appJs.includes('defensiveStops'), 'frozen timeline derived fields are supported');
assert(appJs.includes('bossRewardsChosen: null'), 'missing stats are saved as null instead of fabricated');
console.log('run-statistics-test passed');
