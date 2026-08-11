const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/five-simulation-polish.css', 'utf8');
const bridge = fs.readFileSync('js/five-simulation-polish.js', 'utf8');

assert(index.includes('css/five-simulation-polish.css'), '5v5 simulation polish stylesheet must be loaded');
assert(index.includes('js/five-simulation-polish.js'), '5v5 simulation polish bridge must be loaded after app.js');
assert(css.includes('.five-simulation-score .five-match-result-row > strong'), 'scoreboard team lockups must be scoped to the 5v5 simulation modal');
assert(css.includes('.five-simulation-emblem'), 'scoreboard must provide image emblem slots');
assert(!css.includes('content: "⚡"') && !css.includes('content: "⚽"'), 'scoreboard must not draw team crests with emoji');
assert(bridge.includes('skipButton.classList.remove("btn-secondary")'), 'Vai al risultato must stop using the secondary grey style');
assert(bridge.includes('skipButton.classList.add("btn-yellow", "btn-primary-action")'), 'Vai al risultato must use the same yellow/gold primary language as the final CTA');
assert(bridge.includes('setTimeout(releaseSimulationModalShell, 0)'), 'final CTA must release the modal shell after app.js applies normal post-match navigation');
assert(!bridge.includes('location.reload('), 'modal return fix must not reload the application');

console.log('five-simulation-polish-test: scoreboard, gold skip CTA and modal release wiring OK');
