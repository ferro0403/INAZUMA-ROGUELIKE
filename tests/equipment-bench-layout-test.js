'use strict';

const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
const benchRenderer = app.slice(app.indexOf('function inventoryEquipmentBenchMarkup'), app.indexOf('function inventoryEquipmentSelectionSummary'));
const equipmentFlow = app.slice(app.indexOf('function chooseEquipmentPlayer'), app.indexOf('function handleEquipmentTarget'));

assert.match(benchRenderer, /\(run\.bench \|\| \[\]\)\.map/, 'all four saved bench entries remain selectable');
assert.match(benchRenderer, /inventoryEquipmentPlayerCard\(id, item, "bench"/, 'bench cards keep their player selection bindings');
assert.match(equipmentFlow, /<\/aside>\s*<section class="squad-bench-panel inventory-equipment-bench"/, 'bench is outside the narrow action sidebar and follows its buttons');
assert.match(css, /\.inventory-equipment-bench \{[^}]*grid-column: 1 \/ -1;[^}]*width: 100%;/s, 'bench spans the complete workspace');
assert.match(css, /\.inventory-equipment-selector-modal \.inventory-equipment-bench \.squad-bench-list \{[^}]*width: 100%;[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/s, 'bench is one uniform four-card row');
assert.doesNotMatch(css, /inventory-equipment-selector-modal \.squad-bench-list \{[^}]*repeat\(2/, 'assignment bench cannot fall back to two columns');

console.log('equipment-bench-layout-test: ok');
