'use strict';

const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(app, /function repairBossActiveMatch\(\)/);
assert.match(app, /function bossPlayersForMatch\(match, boss\)/);
assert.match(app, /bossPlayerIds: bossPlayers\.map/);
assert.match(app, /ui\.match\.seed = matchSeed\(ui\.match\)/);
assert.match(app, /const boss = recovery\.boss \|\| seasonDb\.bossOrder/);
assert.match(app, /const bossPlayers = bossPlayersForMatch\(ui\.match, boss\)/);
assert.match(app, /fiveMatchComparisonMarkup\(userPlayers, bossPlayers, bossComparisonSummary\)/);
assert.match(app, /userProfile: simPreview\.userStrength\?\.effectiveComponents/);
assert.match(app, /opponentProfile: simPreview\.opponentStrength\?\.effectiveComponents/);
assert.match(app, /aria-expanded="false"[^>]+five-match-values-content/);
assert.match(app, /five-match-values-content" id="five-match-values-content" hidden/);
assert.match(app, /if \(!summary \|\| typeof summary !== "object"\)/);
assert.match(app, /data-comparison-unavailable="true"/);
assert.match(app, /if \(recovery\.repaired\) global\.RunState\.save\(run\)/);
assert.match(app, /run\.phase === "match" && run\.activeMatch/);
assert.doesNotMatch(app, /fiveMatchComparisonMarkup\(userPlayers, bossPlayers\)/);
assert.doesNotMatch(app, /localStorage\.clear\(\)/);

console.log('boss-match-regression-test: ok');
