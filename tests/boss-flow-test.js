'use strict';
const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const match = fs.readFileSync('js/match/match-controller.js', 'utf8');
const mapController = fs.readFileSync('js/map/run-map-controller.js', 'utf8');
const bossController = fs.readFileSync('js/boss/boss-flow-controller.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

const bossRenderStart = match.indexOf('const userPlayers = userTeamPlayers();');
const bossRenderEnd = match.indexOf('resetRenderedViewScroll();', bossRenderStart);
const bossRender = match.slice(bossRenderStart, bossRenderEnd);
const bossDrawerCall = /fiveMatchComparisonMarkup\(userPlayers, bossPlayers, \{[^}]*contentId: "boss-match-values-content"[^}]*opponentName: meta\.boss\.name[^}]*probability: userProbability/s;

assert.ok(bossRenderStart >= 0 && bossRenderEnd > bossRenderStart, 'boss renderer not found');
assert.match(bossRender, bossDrawerCall, 'boss renderer must pass its complete 11v11 summary');
assert.doesNotMatch(bossRender, /<div><span>La tua forza<\/span>/, 'user strength must not be duplicated outside VALORI');
assert.doesNotMatch(bossRender, /<div class="boss-match-probability">/, 'probability must not be duplicated outside VALORI');
assert.doesNotMatch(bossRender, /<div><span>Forza Boss<\/span>/, 'boss strength must not be duplicated outside VALORI');
assert.match(app, /function fiveMatchComparisonMarkup\(userPlayers, opponentPlayers, summary = \{\}\)/, 'shared drawer must tolerate missing presentation data');
assert.match(app, /const opponentName = summary\.opponentName \|\| "Svincolati"/, 'opponent label must be dynamic');
assert.match(app, /aria-expanded="false" aria-controls="\$\{escapeHtml\(contentId\)\}"/, 'drawer must be closed by default and accessible');
assert.match(match, /const previewMatch = cloneMatchState\(ui\.match\);\s*const simPreview = ensureMatchPreview\(previewMatch, \{ boss \}\)/, 'the Boss renderer must rebuild disposable preview data on a read-only snapshot without a resume save');
assert.match(match, /const boss = seasonDb\.bossOrder\[Number\(ui\.match\?\.bossIndex \?\? run\.bossIndex\)\]/, 'saved boss identity must drive resume');
assert.match(app, /route-boss-preview-logo">\$\{bossNodeIconMarkup\(boss\)\}/, 'preview must share the real-logo fallback helper');
assert.match(css, /\.route-boss-preview-logo\.boss-logo-missing \.boss-logo-fallback \{ display: inline; \}/, 'fallback must appear only after image failure');
assert.match(css, /\.route-boss-preview-logo \.boss-node-logo \{[^}]*object-fit: contain[^}]*object-position: center/s, 'real boss logo must remain centered');
assert.match(app, /function recoverInterruptedBossAccess\(\)/, 'resume must reconcile interrupted boss saves');
assert.match(bossController, /current\.activeMatch = matchFromNode\(currentNode, current\.currentZone\.currentNodeId, current\)/, 'a pending boss node must recover its match snapshot transactionally');
assert.match(mapController, /dispatchNode\(node, node\.type, \{ previousNodeId \}\)/, 'boss entry must preserve the node before selection');

console.log('boss-flow-test: ok');
