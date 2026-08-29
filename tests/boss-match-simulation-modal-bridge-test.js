const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bridge = fs.readFileSync(path.join(root, 'js/boss-match-simulation-modal-bridge.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/boss-match-simulation-modal-bridge.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(bridge.includes('data-five-simulation-modal'), '11v11 bridge must reuse the 5v5 simulation modal state hook');
assert(bridge.includes('five-simulation-modal'), '11v11 bridge must reuse the 5v5 modal class');
assert(bridge.includes('five-simulation-cabin'), '11v11 bridge must reuse the 5v5 cabin structure');
assert(bridge.includes('five-simulation-score'), '11v11 bridge must reuse the 5v5 score component');
assert(bridge.includes('five-simulation-events'), '11v11 bridge must reuse the 5v5 event component');
assert(bridge.includes('skipButton') && bridge.includes('continueButton'), 'Existing live playback controls must be moved into the modal');
assert(bridge.includes('.boss-match-reward-note'), 'Obsolete boss reward banner must be removed by the bridge');
assert(css.includes('.boss-match-screen .boss-match-reward-note') && css.includes('display: none !important'), 'Reward banner must never flash before bridge mounting');
assert(css.includes('.boss-match-screen .boss-match-bottom-grid'), 'Legacy inline playback/result grid must remain hidden');
assert(!bridge.includes('MatchSimulator.simulate'), 'Bridge must not duplicate simulation logic');
assert(!bridge.includes('RunState.save'), 'Bridge must not introduce persistence logic');
assert(!bridge.includes('forceMatchOutcome('), 'Bridge must not duplicate force-result logic');
assert(!bridge.includes('startMatchSimulation('), 'Bridge must not duplicate simulation-start logic');
assert(index.includes('boss-match-simulation-modal-bridge.css?v=20260811-boss-simulation-modal-1'), 'Bridge stylesheet must be loaded');
assert(index.includes('boss-match-simulation-modal-bridge.js?v=20260829-match-hardening-pr363-1'), 'Hardened bridge script must be loaded with the current cache key');

console.log('boss 11v11 reuses 5v5 simulation cabin: OK');
