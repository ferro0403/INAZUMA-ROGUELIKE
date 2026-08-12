const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/player-detail-revolution.css', 'utf8');
const bridge = fs.readFileSync('js/player-detail-revolution.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(index.includes('css/player-detail-revolution.css'), 'player detail revolution stylesheet must be loaded');
assert(index.includes('js/player-detail-revolution.js'), 'player detail revolution enhancer must be loaded');
assert(css.includes('.player-detail-visual,\n.player-detail-content {\n  display: contents;'), 'shared existing markup must be recomposed instead of duplicated');
assert(css.includes('grid-template-areas:'), 'new player detail must use an integrated hero grid');
assert(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'mobile statistics must remain two-column');
assert(css.includes('--detail-stat-progress'), 'stat progress visualization must be present');
assert(bridge.includes('MutationObserver'), 'enhancer must handle player detail modals opened after page load');
assert(bridge.includes('normalized / 99'), 'stat progress must derive from the real displayed stat value');
assert(app.includes('function playerDetailMarkup'), 'shared playerDetailMarkup must remain the source of detail content');
assert(app.includes('player-detail-equipment'), 'equipment section must remain in the shared player detail');
assert(app.includes('player-history-stats') || app.includes('playerStatsMarkup'), 'historical player statistics support must remain available');

console.log('player detail revolution regression guard: ok');
