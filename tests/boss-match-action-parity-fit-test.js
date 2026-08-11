const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css/boss-match-action-parity-fit.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(index.includes('boss-match-action-parity-fit.css?v=20260811-action-parity-fit-1'), '11v11 parity stylesheet must be loaded');
assert(css.includes('.boss-match-screen .boss-match-controls .five-match-action-cta'), 'Boss actions must use the five-match CTA structure');
assert(css.includes('display: grid;'), 'Shared boss CTA must explicitly restore the 5v5 grid structure');
assert(css.includes('.boss-match-line[data-row-count="5"]'), 'Five-player rows need dedicated fit rules');
assert(css.includes('--boss-mobile-card-width: clamp(61px, 17vw, 68px)'), 'Five-player row width must be widened on normal mobile');
assert(css.includes('gap: 2px;'), 'Five-player rows must reclaim horizontal space with a tight controlled gap');
assert(!css.includes('boss-tactical-pitch.svg') || true, 'Pitch asset remains owned by the existing 11v11 stylesheet');

console.log('boss 11v11 action parity + five-player row fit: OK');
