const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const appJs = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/game.css'), 'utf8');

assert(appJs.includes('class="route-hero panel"'), 'route screen renders the new hero panel');
assert(appJs.includes('class="route-progress-panel"'), 'route screen renders run progress toward the boss');
assert(appJs.includes('class="route-legend"'), 'route screen renders a compact node legend');
assert(appJs.includes('aria-label="${escapeHtml((isBoss ? boss.teamName : meta.label) + ", " + readableState)}"'), 'route nodes expose accessible state labels');
assert(appJs.includes('class="map-node ${stateClass}${isCurrent ? " current" : ""}${isBoss ? " boss-node" : ""}"'), 'route nodes distinguish current and boss states visually without changing map logic');
assert(appJs.includes('class="${edgeClass}"'), 'route edges expose state classes for visual styling');
assert(!appJs.includes('>Modifica squadra</button>\n          </div>\n          <p class="muted">Puoi selezionare'), 'large top map edit-squad button is no longer present');
assert(css.includes('.route-squad-action { display: none; }'), 'mobile hides the secondary squad action in favor of bottom navigation');
assert(css.includes('.map-lines line.available') && css.includes('@keyframes routeDash'), 'available connections receive a visible animated treatment');
assert(css.includes('.map-node.boss-node .node-icon') && css.includes('bossGlow'), 'boss node gets a dedicated scenic treatment');
assert(/@media \(max-width: 780px\)[\s\S]*?\.route-map[\s\S]*?min-width:\s*0/.test(css), 'mobile route map prevents horizontal overflow');
console.log('Route map presentation test passed.');
