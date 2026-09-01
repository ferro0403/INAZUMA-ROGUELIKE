const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

const fiveStart = app.indexOf('if (!isBoss && !isSpecial)');
const fiveEnd = app.indexOf('const userPlayers = userTeamPlayers()', fiveStart);
assert(fiveStart >= 0 && fiveEnd > fiveStart, '5v5 match renderer exists');
const fiveRenderer = app.slice(fiveStart, fiveEnd);

assert.doesNotMatch(fiveRenderer, /five-match-bottom-grid|id="five-match-log-panel"|id="five-match-result-panel"/, 'pre-match renderer contains no commentary or result panels');
assert.match(fiveRenderer, /topbar\("Partita 5v5", "", "match"\)/, '5v5 header uses its run-map root destination');
assert.match(app, /match: \{ destination: "map", label: "Torna alla mappa della run" \}/, 'match back destination is the current run map');
assert.match(app, /if \(destination === "map"\)[\s\S]{0,180}run\.phase = "map";[\s\S]{0,180}renderMap\(\)/, 'header back performs internal map navigation and saves the same run');

const modalStart = app.indexOf('function openFiveMatchSimulationModal');
const modalEnd = app.indexOf('function bossMatchStatusText', modalStart);
const modal = app.slice(modalStart, modalEnd);
assert.match(modal, /data-five-simulation-modal/, 'simulation uses a dedicated modal container');
assert.match(modal, /bossMatchTimeline\(\)/, 'modal renders the already revealed simulator timeline');
assert.match(modal, /simulationScoreArray\(match, resolved\)/, 'modal renders the existing simulation score');
assert.match(fiveRenderer, /openFiveMatchSimulationModal\(match, userName, opponentName\); startMatchSimulation\(match\)/, 'primary CTA opens the modal before starting existing playback');
assert.match(fiveRenderer, /openFiveMatchSimulationModal[\s\S]*forceMatchOutcome\("victory"\)/, 'safe victory uses the same modal and existing forced-outcome control');

const startSimulation = app.slice(app.indexOf('function startMatchSimulation'), app.indexOf('function resumeMatchSimulationIfNeeded'));
assert.match(startSimulation, /ensureMatchPreview\(frozenMatch, \{ \.\.\.options, forceRefresh: false, freeze: true \}\)/, 'start freezes the prepared inputs on an isolated snapshot before commit');
assert.strictEqual((startSimulation.match(/MatchSimulator\.simulate/g) || []).length, 0, 'playback does not invoke the simulator directly');
assert.match(css, /\.five-simulation-modal\.modal[\s\S]*max-height: calc\(100dvh/, 'compact modal is bounded by the viewport');
console.log('five-match-modal-regression-test: preparation, modal, navigation and single-outcome wiring OK');
