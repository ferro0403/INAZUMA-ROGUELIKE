'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
function extractFunction(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} is present`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1).trim();
  }
  throw new Error(`Cannot extract ${name}`);
}

const context = {};
vm.runInNewContext(`${extractFunction('bindAlbumRosterInteractions')}; this.bind = bindAlbumRosterInteractions;`, context);

class FakeNode {
  constructor(dataset = {}, parent = null) { this.dataset = dataset; this.parent = parent; this.listeners = new Map(); }
  addEventListener(type, listener) { const list = this.listeners.get(type) || []; list.push(listener); this.listeners.set(type, list); }
  contains(node) { for (let current = node; current; current = current.parent) if (current === this) return true; return false; }
  closest(selector) {
    const key = selector === '[data-album-player-entry]' ? 'albumPlayerEntry' : selector === '[data-album-player]' ? 'albumPlayer' : null;
    for (let current = this; current; current = current.parent) if (key && current.dataset[key] != null) return current;
    return null;
  }
  click(target = this) {
    const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    (this.listeners.get('click') || []).forEach((listener) => listener(event));
    return event;
  }
}

class MouseEvent { constructor(type, options = {}) { this.type = type; this.bubbles = options.bubbles; } }
const roster = new FakeNode();
const modalRoot = { innerHTML: '' };
const opened = [];
context.bind(roster, (detail) => opened.push(detail.playerId));
context.bind(roster, (detail) => { opened.push(`duplicate:${detail.playerId}`); modalRoot.innerHTML = `<section class=\"album-player-detail-modal\">Harpo Kendrick · ${detail.playerId}</section>`; });
assert.strictEqual(roster.listeners.get('click').length, 1, 'delegated listener is registered only once');

const unlockedEntry = new FakeNode({ albumPlayerEntry: 'player-17', albumUnlocked: 'true' }, roster);
const unlockedButton = new FakeNode({ albumPlayer: 'player-17' }, unlockedEntry);
const unlockedImage = new FakeNode({}, unlockedButton);
assert.strictEqual(roster.click(unlockedImage).defaultPrevented, true);
const click = new MouseEvent('click', { bubbles: true });
assert.equal(click.bubbles, true);
assert.deepStrictEqual(opened, ['duplicate:player-17'], 'an unlocked nested card tap resolves its wrapper player id');
assert.match(modalRoot.innerHTML, /album-player-detail-modal/);
assert.match(modalRoot.innerHTML, /Harpo Kendrick/);

const lockedEntry = new FakeNode({ albumPlayerEntry: 'player-42', albumUnlocked: 'false' }, roster);
const lockedButton = new FakeNode({ albumPlayer: 'player-42' }, lockedEntry);
const lockOverlay = new FakeNode({}, lockedEntry);
roster.click(lockOverlay);
assert.deepStrictEqual(opened, ['duplicate:player-17', 'duplicate:player-42'], 'the NON SBLOCCATO overlay tap opens the correct player');

roster.click(unlockedButton);
assert.deepStrictEqual(opened, ['duplicate:player-17', 'duplicate:player-42', 'duplicate:player-17'], 'the card can be opened again after a prior detail flow');

for (const rarity of ['elite', 'mondiale', 'leggenda']) {
  assert.ok(source.includes(`rarity-${rarity}`), `${rarity} has a distinct detail class`);
}
assert.ok(!source.includes(".replace('data-player-id=', 'data-album-player=')"), 'Album markup no longer mutates attributes with string replacement');
assert.match(source, /ui\.selectedSquadPlayerId = null;\s*run\.phase = "squad";/, 'Squad entry resets transient selection before rendering');
console.log('ui-interaction-dom-test: ok');
