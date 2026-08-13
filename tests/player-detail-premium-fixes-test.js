const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/player-detail-premium-fixes.css', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(index.includes('css/player-detail-premium-fixes.css?v=20260812-overflow-fullbody-1'), 'overflow/fullbody fix stylesheet must be loaded after premium player detail');
assert(css.includes('.player-detail-modal::before'), 'legacy modal inner-border pseudo element must be explicitly neutralized');
assert(css.includes('content: none !important'), 'modal pseudo border must not render over scrolling stats');
assert(css.includes('.player-detail-layout {\n  border: 1px solid var(--pd-ink);'), 'inner border must move to the full scrolling layout');
assert(css.includes('.player-fullbody--fullbody'), 'real fullbody must receive dedicated containment rules');
assert(css.includes('object-fit: contain'), 'fullbody must fit entirely inside its visual zone');
assert(css.includes('max-width: 100%'), 'fullbody width must stay bounded by the visual zone');
assert(css.includes('.player-detail-hero {\n  position: relative;\n  isolation: isolate;\n  overflow: hidden;'), 'hero must clip decorative layers and fullbody to its own area');
assert(css.includes('.player-detail-content {\n  position: relative;\n  z-index: 6;\n  isolation: isolate;'), 'stats/equipment must start a clean stacking context below the hero');
assert(css.includes('.detail-stat {\n  overflow: hidden;'), 'stat cards must clip their own visual layers');

console.log('player detail premium overflow/fullbody fixes: ok');
