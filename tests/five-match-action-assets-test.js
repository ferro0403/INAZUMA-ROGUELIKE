const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'five-match-action-assets.css'), 'utf8');

const assets = [
  'action-soccer-ball.svg',
  'action-motion-lines.svg',
  'action-tactics-board.svg',
  'action-tactics-pitch.svg',
];

const retiredAssets = [
  'simulate-ball.svg',
  'simulate-motion.svg',
  'tactics-board.svg',
  'tactics-pitch.svg',
];

if (!index.includes('css/five-match-action-assets.css')) {
  throw new Error('index.html must load five-match-action-assets.css');
}

for (const asset of retiredAssets) {
  const absolute = path.join(root, 'assets', 'ui', '5v5', asset);
  if (fs.existsSync(absolute)) throw new Error(`Retired 5v5 action asset still exists: ${asset}`);
  if (css.includes(`url("../assets/ui/5v5/${asset}")`)) {
    throw new Error(`Stylesheet still references retired asset: ${asset}`);
  }
}

if (!fs.existsSync(path.join(root, 'assets', 'ui', '5v5', 'THIRD_PARTY_NOTICES.md'))) {
  throw new Error('Phosphor-derived assets must retain their third-party notice');
}

for (const asset of assets) {
  const absolute = path.join(root, 'assets', 'ui', '5v5', asset);
  if (!fs.existsSync(absolute)) throw new Error(`Missing 5v5 action asset: ${asset}`);
  if (!css.includes(asset)) throw new Error(`5v5 action stylesheet does not reference: ${asset}`);
}

if (css.includes('.five-match-vs')) {
  throw new Error('Custom action artwork must not modify the matchup banner.');
}

console.log('5v5 custom action artwork regression guard passed.');
