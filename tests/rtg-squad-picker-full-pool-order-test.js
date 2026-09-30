const fs = require('fs');
const path = require('path');
const assert = require('assert');

const loader = fs.readFileSync(path.join(__dirname, '..', 'js', 'road-to-glory', 'rtg-squad-view.js'), 'utf8');
const orderView = fs.readFileSync(path.join(__dirname, '..', 'js', 'road-to-glory', 'rtg-squad-view-order.js'), 'utf8');
const runtime = fs.readFileSync(path.join(__dirname, '..', 'js', 'road-to-glory', 'rtg-squad-picker-order-runtime.js'), 'utf8');

assert(loader.includes('rtg-squad-picker-order-runtime.js'), 'picker runtime must load before the controller');
assert(orderView.includes('rtg-picker-overall-order'), 'OVR toggle must request a full-pool reorder');
assert(orderView.includes('__rtgPickerOverallAscending'), 'view must preserve the full-pool order state after reopening');
assert(!orderView.includes('reorderVisibleCards'), 'OVR toggle must not only reorder the currently rendered 24 cards');
assert(runtime.includes('openSquadPlayerPicker(lastTargetId)'), 'runtime must reopen the same picker instead of loading every card');
assert(runtime.includes('rawOverall(b)-rawOverall(a)'), 'runtime must invert the controller candidate comparator for weakest-first mode');
assert(runtime.includes('finally'), 'temporary sort interception must always be restored');

console.log('RTG squad picker full-pool OVR ordering contract OK');
