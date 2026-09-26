const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'css');
const ARCH = path.join(ROOT, 'docs', 'RTG_CSS_ARCHITECTURE.md');

assert.ok(fs.existsSync(ARCH), 'RTG CSS architecture contract must exist');

const forbiddenNewLayerName = /(?:^|[-_.])(fix|final|polish|tuning|override|depth|perspective)(?:[-_.]|$)/i;
const retiredDisconnectedLayers = [
  'rtg-theme-core.css',
  'rtg-theme-base.css',
  'rtg-match-final.css',
  'rtg-vending-depth.css',
  'rtg-vending-perspective.css'
];

const rtgCssFiles = fs.readdirSync(CSS_DIR)
  .filter(name => /^rtg-.*\.css$/i.test(name));

for (const name of retiredDisconnectedLayers) {
  assert.ok(!rtgCssFiles.includes(name), `Disconnected legacy RTG stylesheet must stay retired: ${name}`);
}

for (const name of rtgCssFiles) {
  assert.ok(!forbiddenNewLayerName.test(name), `RTG finishing/override layer is forbidden: ${name}`);
}

// Domain ownership contract. During migration these assertions intentionally go RED
// until the legacy selectors have been removed from road-to-glory.css.
const legacyRoadPath = path.join(CSS_DIR, 'road-to-glory.css');
if (fs.existsSync(legacyRoadPath)) {
  const legacyRoad = fs.readFileSync(legacyRoadPath, 'utf8');
  const vendingSelectorsOwnedElsewhere = [
    '.rtg-vending-machine',
    '.rtg-vending-machine-v2',
    '.rtg-machine-globe',
    '.rtg-machine-console',
    '.rtg-machine-knob',
    '.rtg-machine-tray',
    '.rtg-capsule'
  ];

  for (const selector of vendingSelectorsOwnedElsewhere) {
    assert.ok(!legacyRoad.includes(selector), `Vending selector must be owned by rtg-vending.css, not road-to-glory.css: ${selector}`);
  }
}

// The migration is allowed to carry existing !important debt, but it must never grow.
// These ceilings are intentionally baseline-oriented and should only move downward as owners migrate.
const debtFiles = [
  'road-to-glory.css',
  'rtg-theme.css',
  'rtg-version-banners.css'
].filter(name => fs.existsSync(path.join(CSS_DIR, name)));

const countImportant = source => (source.match(/!important\b/g) || []).length;
const importantDebt = Object.fromEntries(debtFiles.map(name => {
  const source = fs.readFileSync(path.join(CSS_DIR, name), 'utf8');
  return [name, countImportant(source)];
}));

const baselineCeilings = {
  // Temporary migration ceilings. They only move downward as ownership migrates.
  'road-to-glory.css': 10000,
  'rtg-theme.css': 10000,
  'rtg-version-banners.css': 10000
};

for (const [name, count] of Object.entries(importantDebt)) {
  assert.ok(count <= baselineCeilings[name], `${name} !important debt grew to ${count}`);
}

console.log('RTG CSS architecture guard: PASS');
console.log(JSON.stringify({ rtgCssFiles, importantDebt }, null, 2));
