const assert = require('node:assert/strict');
global.SEASON1_CONFIG = { matchSimulation: {} }; global.MatchSimulatorConfig = require('../js/match-simulator-config.js');
require('../js/match-simulator.js');
const simulator = global.MatchSimulator;
assert.equal(typeof simulator.simulate, 'function');
assert.equal(typeof simulator.validateTeam, 'function');
console.log('match-simulator-test: ok');
