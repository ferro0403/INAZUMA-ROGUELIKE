'use strict';
const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

const bossRenderStart = app.indexOf('const userPlayers = userTeamPlayers();');
const bossRenderEnd = app.indexOf('resetRenderedViewScroll();', bossRenderStart);
const bossRender = app.slice(bossRenderStart, bossRenderEnd);
const bossDrawerCall = /fiveMatchComparisonMarkup\(userPlayers, bossPlayers, \{[^}]*contentId: "boss-match-values-content"[^}]*opponentName: meta\.boss\.name[^}]*probability: userProbability/s;

assert.ok(bossRenderStart >= 0 && bossRenderEnd > bossRenderStart, 'boss renderer not found');
assert.match(bossRender, bossDrawerCall, 'boss renderer must pass its complete 11v11 summary');
assert.doesNotMatch(bossRender, /<div><span>La tua forza<\/span>/, 'user strength must not be duplicated outside VALORI');
assert.doesNotMatch(bossRender, /<div class="boss-match-probability">/, 'probability must not be duplicated outside VALORI');
assert.doesNotMatch(bossRender, /<div><span>Forza Boss<\/span>/, 'boss strength must not be duplicated outside VALORI');
assert.match(app, /function fiveMatchComparisonMarkup\(userPlayers, opponentPlayers, summary = \{\}\)/, 'shared drawer must tolerate missing presentation data');
assert.match(app, /const opponentName = summary\.opponentName \|\| "Svincolati"/, 'opponent label must be dynamic');
assert.match(app, /aria-expanded="false" aria-controls="\$\{escapeHtml\(contentId\)\}"/, 'drawer must be closed by default and accessible');
assert.match(app, /if \(run\.activeMatch\.type === "boss" && !run\.activeMatch\.simulation\?\.valid\)/, 'legacy boss matches must rebuild missing derived data');
assert.match(app, /const boss = seasonDb\.bossOrder\[Number\(ui\.match\?\.bossIndex \?\? run\.bossIndex\)\]/, 'saved boss identity must drive resume');
assert.match(app, /route-boss-preview-logo">\$\{bossNodeIconMarkup\(boss\)\}/, 'preview must share the real-logo fallback helper');
assert.match(css, /\.route-boss-preview-logo\.boss-logo-missing \.boss-logo-fallback \{ display: inline; \}/, 'fallback must appear only after image failure');
assert.match(css, /\.route-boss-preview-logo \.boss-node-logo \{[^}]*object-fit: contain[^}]*object-position: center/s, 'real boss logo must remain centered');
assert.match(app, /function recoverInterruptedBossAccess\(\)/, 'resume must reconcile interrupted boss saves');
assert.match(app, /current\.activeMatch = bossMatchFromNode\(currentNode, current\.currentZone\.currentNodeId, current\)/, 'a pending boss node must recover its match snapshot transactionally');
assert.match(app, /dispatchNode\(node, node\.type, \{ previousNodeId \}\)/, 'boss entry must preserve the node before selection');

console.log('boss-flow-test: ok');
