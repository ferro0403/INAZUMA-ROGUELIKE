const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'road-to-glory', 'rtg-squad-view.js'), 'utf8');

assert(source.includes('data-rtg-picker-overall-order'), 'replacement picker should expose an overall order toggle');
assert(source.includes('OVR ↓'), 'replacement picker should default to strongest-first label');
assert(source.includes('OVR ↑'), 'replacement picker should expose weakest-first label');
assert(source.includes('pickerOverallAscending'), 'picker view should retain the selected overall order');

console.log('RTG squad picker overall order toggle contract OK');
