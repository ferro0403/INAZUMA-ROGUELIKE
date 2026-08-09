'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}`);
  const end = app.indexOf(`function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} source is available`);
  return app.slice(start, end);
}

const helper = functionSource('compactPlayerCardMarkup', 'playerCard');
const bossRenderer = functionSource('matchFormationCard', 'renderMatchFormation');
const matchRenderer = functionSource('fiveMatchCard', 'fiveMatchField');
const formationRenderer = functionSource('fiveSlotCard', 'fiveRosterCard');
const selectionSync = functionSource('syncFiveSlotSelection', 'renderFiveVFive');
const fiveEditor = functionSource('renderFiveVFive', 'renderInventory');

for (const token of ['player-role', 'player-overall', 'player-title', 'player-equipment--footer']) {
  assert.ok(helper.includes(token), `shared tactical card is missing ${token}`);
}
assert.match(helper, /equipmentDefinition\s*\?/, 'equipment is rendered only when present');
assert.match(helper, /<span class="player-corner player-equipment \$\{equipmentInFooter \? "player-equipment--footer" : ""\}"[^>]*>\$\{itemIcon\(equipment\)\}<\/span>/, 'the item icon is a child of the complete equipment badge');
assert.match(helper, /<div class="player-title"><strong[^>]*>[^<]*\$\{escapeHtml\(player\.name\)\}<\/strong>\$\{equipmentInFooter \? equipmentMarkup : ""\}<\/div>/, 'the shared footer reserves name space only when equipment is present');
for (const renderer of [bossRenderer, formationRenderer]) {
  assert.match(renderer, /compactPlayerCardMarkup\(player/, 'every 5v5 renderer reuses the shared tactical card');
  assert.match(renderer, /equipmentInFooter: true/, 'every 5v5 renderer places equipment in the shared footer');
}
for (const token of ['five-match-card-portrait', 'five-match-card-role', 'aria-pressed="false"', 'player.name']) {
  assert.ok(matchRenderer.includes(token), `the dedicated match half card is missing ${token}`);
}
assert.doesNotMatch(matchRenderer, /compactPlayerCardMarkup/, 'the tactical pitch no longer miniaturizes a complete player card');
assert.match(app, /function fiveMatchPlayerDetail[\s\S]*data-five-detail-close[\s\S]*Scheda completa/, 'the match exposes an in-pitch contextual player detail');
assert.doesNotMatch(app, /fivePlayerEquipmentMarkup/, '5v5 has no position-specific equipment renderer');
assert.doesNotMatch(css, /five-player-equipment/, 'obsolete free-floating 5v5 equipment CSS is removed');

assert.match(css, /:is\(\.five-screen,\.five-match-screen,\.boss-match-screen\) \.run-tactical-card\.tactical-player-card \.player-title strong \{[^}]*min-width: 0;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/s);
assert.match(css, /:is\(\.five-screen,\.five-match-screen,\.boss-match-screen\) \.run-tactical-card\.tactical-player-card \.player-equipment--footer \{[^}]*position: static;[^}]*box-sizing: border-box;[^}]*overflow: hidden;[^}]*border: 2px solid var\(--unified-card-ink\);[^}]*background: var\(--unified-card-yellow\);[^}]*box-shadow: none;/s);
assert.match(css, /\.player-equipment--footer \.item-icon img \{[^}]*object-fit: contain;/s, 'the image remains contained inside the shared badge');
assert.doesNotMatch(css, /\.five-match-screen \.five-match-card\.run-tactical-card \.player-equipment--footer/, 'match cards have no divergent equipment badge override');

for (const token of ['classList.toggle("selected", selected)', 'setAttribute("aria-selected", selected ? "true" : "false")', 'querySelectorAll(".five-slot-selected-label")', 'label.textContent = "SELEZIONATO"']) {
  assert.ok(selectionSync.includes(token), `selection synchronization is missing: ${token}`);
}
assert.match(fiveEditor, /ui\.fiveVFiveSelectedSlot === button\.dataset\.fiveSlot \? null : button\.dataset\.fiveSlot/, 'tapping the selected slot clears selection');
assert.match(fiveEditor, /FiveVFive\.assign[\s\S]*ui\.fiveVFiveSelectedSlot = null;[\s\S]*refreshFiveAfterAssignment/, 'an assignment or swap clears stale selection before the partial refresh');
assert.match(fiveEditor, /FiveVFive\.clearSlot[\s\S]*ui\.fiveVFiveSelectedSlot = null;[\s\S]*refreshFiveAfterAssignment/, 'clearing a slot clears its selection label');
assert.strictEqual((fiveEditor.match(/addEventListener\("click", onFiveSlotClick\)/g) || []).length, 2, 'slot listeners are bound once initially and once to replacement cards');

class FakeSlot {
  constructor(key) {
    this.dataset = { fiveSlot: key };
    this.attributes = {};
    this.labels = [];
    this.classList = { toggle: (name, active) => { this.selected = name === 'selected' && active; } };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelectorAll() { return this.labels.slice(); }
  append(label) { label.parent = this; this.labels.push(label); }
}
const slots = ['GK', 'DF', 'FW'].map((key) => new FakeSlot(key));
const documentStub = {
  querySelectorAll: () => slots,
  createElement: () => ({ remove() { this.parent.labels = this.parent.labels.filter((label) => label !== this); } }),
};
const selectionContext = { ui: { fiveVFiveSelectedSlot: null }, document: documentStub };
vm.runInNewContext(`${selectionSync}; this.sync = syncFiveSlotSelection;`, selectionContext);
for (const key of ['GK', 'DF', 'FW']) {
  selectionContext.ui.fiveVFiveSelectedSlot = key;
  selectionContext.sync(documentStub);
  assert.strictEqual(slots.filter((slot) => slot.labels.length === 1).length, 1, 'three consecutive selections keep exactly one label');
  assert.strictEqual(slots.find((slot) => slot.dataset.fiveSlot === key).attributes['aria-selected'], 'true');
}
selectionContext.ui.fiveVFiveSelectedSlot = null;
selectionContext.sync(documentStub);
assert.strictEqual(slots.filter((slot) => slot.labels.length).length, 0, 'cancelling or completing a swap removes every label');
assert.ok(slots.every((slot) => slot.attributes['aria-selected'] === 'false' && !slot.selected), 'neutral slots expose coherent selection state');

console.log('tactical-player-card-test: ok');
