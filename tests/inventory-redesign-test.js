'use strict';

const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/inventory-redesign.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const render = app.slice(app.indexOf('function renderInventory'), app.indexOf('function inventoryItemEffect'));
const detail = app.slice(app.indexOf('function inventoryItemDetailMarkup'), app.indexOf('function inventoryPlayerChoice'));
const summary = app.slice(app.indexOf('function inventoryEquipmentSelectionSummary'), app.indexOf('function openInventoryConfirmation'));
const equipment = app.slice(app.indexOf('function chooseEquipmentPlayer'), app.indexOf('function unequipPlayerItem'));
const unequip = app.slice(app.indexOf('function unequipPlayerItem'), app.indexOf('function renderGameOver'));

assert.strictEqual((render.match(/role="tab"/g) || []).length, 2, 'inventory renders exactly two primary tabs');
assert.match(render, />OGGETTI<\/button>/, 'available-items tab exists');
assert.match(render, />EQUIPAGGIATI<\/button>/, 'equipped-items tab exists');
for (const legacy of ['>Tutti<', '>Equip.<', '>Consum.<', '>Speciali<']) assert.ok(!render.includes(legacy), `legacy tab ${legacy} is absent`);
assert.match(render, /groupedInventoryItems\(run\.inventory\)/, 'available items come only from backpack inventory');
assert.match(render, /entry\.equippedItem/, 'assigned equipment comes from roster state');
assert.match(render, /data-unequip-player/, 'equipped rows expose removal');
assert.doesNotMatch(render, /Ogni giocatore può avere un solo equipaggiamento attivo/, 'redundant one-equipment note is absent');
assert.match(render, /Nessun oggetto disponibile\./, 'available empty state exists');
assert.match(render, /Nessun equipaggiamento assegnato\./, 'equipped empty state exists');
assert.match(detail, /openModal\(/, 'item detail is a real modal');
assert.match(detail, /inventory-detail-modal/, 'item detail uses dedicated modal styling');
assert.match(detail, /data-use-item/, 'consumable action remains available in detail');
assert.match(equipment, /inventoryEquipmentPitchMarkup/, 'equipment flow keeps the tactical pitch');
assert.match(equipment, /inventoryEquipmentBenchMarkup/, 'equipment flow keeps the bench');
assert.match(summary, /inventory-stat-preview/, 'selected-player summary has stat preview');
assert.match(equipment, /SOSTITUIRE L’EQUIPAGGIAMENTO\?/, 'existing equipment triggers replacement confirmation');
assert.match(equipment, /removeInventoryItem\(instanceId\)[\s\S]*run\.inventory\.push\(entry\.equippedItem\)[\s\S]*entry\.equippedItem = newEquipment/, 'replacement moves old/new instances without duplication');
assert.match(equipment, /RunState\.save\(run\)/, 'equip and replace persist');
assert.match(equipment, /inventory-success-feedback/, 'successful equipment assignment opens compact feedback');
assert.match(equipment, /data-inventory-success-done>FATTO/, 'success feedback has an explicit completion action');
assert.match(unequip, /run\.inventory\.push\(equippedItem\)[\s\S]*entry\.equippedItem = null[\s\S]*RunState\.save\(run\)/, 'remove restores backpack state and persists');
assert.match(css, /grid-template-columns: 1fr 1fr/, 'tabs remain fully visible');
assert.match(css, /min-height: 44px/, 'compact actions retain touch targets');
assert.match(css, /max-width: 700px/, 'mobile layout is explicit');
assert.match(css, /@media \(max-width: 700px\)[\s\S]*\.inventory-v2-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'mobile inventory remains a compact two-column grid');
assert.match(css, /\.inventory-equipped-list \{ grid-template-columns: 1fr;/, 'equipped entries use compact rows');
assert.match(css, /body:has\(\.inventory-v2-screen\)[\s\S]*inazuma-stadium-desktop-light/, 'page roots continue the stadium background through overscroll');
assert.match(html, /inventory-redesign\.css/, 'inventory stylesheet is loaded');

console.log('inventory-redesign-test: ok');
