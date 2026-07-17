const assert = require('node:assert/strict');
const fs = require('node:fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

['--color-night-950', '--color-electric-500', '--color-gold-500', '--color-pitch-600', '--color-elite-500', '--gradient-app', '--radius-xl', '--z-bottom-nav'].forEach((token) => {
  assert(css.includes(token), `design token ${token} is centralized`);
});
['.home-choice-grid', '.home-hub-card', '.stat-card', '.result-banner', '.empty-state', '.home-roster-preview'].forEach((selector) => {
  assert(css.includes(selector), `shared visual component ${selector} is styled`);
});
assert(appJs.includes('function homeRunCardMarkup') && appJs.includes('homeHallOfFameMarkup'), 'home separates RUN and ALBO D’ORO macro cards');
assert(appJs.includes('Road to Raimon') && appJs.includes('Continua la run') && appJs.includes('Apri ultima squadra'), 'home uses premium Italian hub copy and CTAs');
assert(appJs.includes('const TEST_MATCH_CONTROLS_ENABLED = true') && appJs.includes('match-test-tools') && appJs.includes('id="test-win"'), 'temporary match test controls are visible and separated from primary actions');
assert(css.includes('@media (max-width: 780px)') && css.includes('@media (min-width: 781px)'), 'mobile and desktop navigation/layout breakpoints are explicit');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'reduced motion is respected');

console.log('design system static test passed.');
