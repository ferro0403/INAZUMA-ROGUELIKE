'use strict';
const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
const renderer = app.slice(app.indexOf('function homePlayerCardMarkup'), app.indexOf('function homeRosterMarkup'));

for (const [category, className] of Object.entries({
  Scarso: 'rarity-scarso',
  Debole: 'rarity-debole',
  Normale: 'rarity-normale',
  Buono: 'rarity-buono',
  Forte: 'rarity-forte',
  Elite: 'rarity-elite',
  Mondiale: 'rarity-mondiale',
  Leggenda: 'rarity-leggenda',
})) {
  assert.match(app, new RegExp(`${category}: ["']${className}["']`), `${category} keeps its shared rarity class`);
  assert.match(css, new RegExp(`\\.${className} \\{[^}]*--rarity-border:`), `${category} keeps its shared rarity token`);
}

assert.match(renderer, /home-player-card \$\{rarityClass\(player\.category\)\}/, 'the card receives the rarity class');
assert.match(renderer, /<span class="home-player-role">/, 'the role keeps its local neutral class');
assert.doesNotMatch(renderer, /home-player-role[^>]*rarity-|rarity-[^>]*home-player-role/, 'the role receives no rarity class');
assert.match(renderer, /<span class="home-player-overall">/, 'the OVR keeps its local yellow class');
assert.doesNotMatch(renderer, /equippedItem|home-player-equipment|itemIcon|has-equipment/, 'equipment is not rendered in the Home preview');
assert.match(css, /\.home-player-role \{[^}]*border-color: var\(--home-ink\);[^}]*background: var\(--home-paper\);[^}]*color: var\(--home-ink\);/, 'the role badge is opaque, black and white');
assert.match(css, /\.home-player-overall \{[^}]*border-color: var\(--home-ink\);[^}]*background: var\(--home-yellow\);[^}]*color: var\(--home-ink\);/, 'the OVR badge is yellow and black');
assert.match(css, /\.home-player-copy strong \{[^}]*overflow: hidden;[^}]*color: var\(--home-ink\);[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/, 'long player names stay black and truncate');

console.log('home-preview-card-test: ok');
