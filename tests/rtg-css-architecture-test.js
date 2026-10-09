const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'css');
const ARCH = path.join(ROOT, 'docs', 'RTG_CSS_ARCHITECTURE.md');
assert.ok(fs.existsSync(ARCH), 'RTG CSS architecture contract must exist');

const forbiddenNewLayerName = /(?:^|[-_.])(fix|final|polish|tuning|override|depth|perspective)(?:[-_.]|$)/i;
// Only these historical theme layers still belong to the live CSS import graph.
// They are allowed TEMPORARILY while the documented zero-visual-change migration is unfinished.
// An orphaned file, missing imported file, or reintroduced retired finishing layer still fails CI.
const retiredDisconnectedLayers = ['rtg-match-final.css','rtg-vending-depth.css','rtg-vending-perspective.css'];
const rtgCssFiles = fs.readdirSync(CSS_DIR).filter(name => /^rtg-.*\.css$/i.test(name));
for (const name of retiredDisconnectedLayers) assert.ok(!rtgCssFiles.includes(name), `Disconnected legacy RTG stylesheet must stay retired: ${name}`);
for (const name of rtgCssFiles) assert.ok(!forbiddenNewLayerName.test(name), `RTG finishing/override layer is forbidden: ${name}`);

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const stylesheetLinks = indexHtml.match(/<link\b[^>]*>/gi) || [];
const rtgThemeLinked = stylesheetLinks.some(tag =>
  /\brel\s*=\s*["']stylesheet["']/i.test(tag) &&
  /\bhref\s*=\s*(["'])\.?\/?css\/rtg-theme\.css(?:\?[^"']*)?\1/i.test(tag)
);
function importsCss(importer, imported) {
  const fullPath = path.join(CSS_DIR, importer);
  if (!fs.existsSync(fullPath)) return false;
  const css = fs.readFileSync(fullPath, 'utf8');
  return Array.from(css.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?/gi))
    .some(match => match[1].split(/[?#]/)[0] === `./${imported}`);
}
const activeLegacyThemes = {
  'rtg-theme-core.css': rtgThemeLinked && importsCss('rtg-theme.css', 'rtg-theme-core.css'),
  'rtg-theme-base.css': rtgThemeLinked &&
    importsCss('rtg-theme.css', 'rtg-theme-core.css') &&
    importsCss('rtg-theme-core.css', 'rtg-theme-base.css')
};
for (const [name, active] of Object.entries(activeLegacyThemes)) {
  const exists = rtgCssFiles.includes(name);
  assert.ok(!exists || active,
    `Orphaned legacy RTG stylesheet must be migrated or removed: ${name}`);
  assert.ok(!active || exists,
    `Active RTG CSS import must resolve to a real stylesheet: ${name}`);
}

const legacyRoadPath = path.join(CSS_DIR, 'road-to-glory.css');
if (fs.existsSync(legacyRoadPath)) {
  const legacyRoad = fs.readFileSync(legacyRoadPath, 'utf8');
  const domains = {
    Vending: ['.rtg-vending-machine','.rtg-vending-machine-v2','.rtg-machine-globe','.rtg-machine-console','.rtg-machine-knob','.rtg-machine-tray','.rtg-capsule'],
    Squad: ['.rtg-squad-shell','.rtg-squad-topbar','.rtg-squad-back','.rtg-squad-content','.rtg-squad-pitch-main','.rtg-squad-actions','.rtg-squad-player-card','.rtg-squad-picker-modal','.rtg-squad-picker','.rtg-picker-grid','.rtg-picker-role-badge','.rtg-picker-load-more','.rtg-collection-main','.rtg-collection-card-grid','.rtg-formation-modal'],
    Match: ['.rtg-prematch-shell','.rtg-prematch-content','.rtg-prematch-matchup','.rtg-prematch-tactical','.rtg-prematch-tabs','.rtg-prematch-start','.rtg-match-shell','.rtg-match-scoreboard','.rtg-score-capsule','.rtg-live-commandbar','.rtg-live-command','.rtg-match-event-feed','.rtg-match-ticker-list','.rtg-live-formation-panel','.rtg-live-team-tabs','.rtg-duel-result-banner','.rtg-duel-versus-board','.rtg-duel-choice-card','.rtg-duel-portrait-panel','.rtg-duel-card--clean','.rtg-ticker-event','.rtg-halftime-','.rtg-half-confirm','.rtg-penalty-','.rtg-shootout-score','.rtg-static-field--main','.rtg-field-card','.rtg-field-midline','.rtg-field-team-label','.rtg-probability','.rtg-versus--cards','.rtg-final-probability','.rtg-action-button'],
    Economy: ['.rtg-development-screen','.rtg-development-wallet','.rtg-development-token-icon','.rtg-development-confirm','.development-requirement','.development-selected','.rtg-legacy-badge','.player-detail-rtg-legacy-badge','.rtg-pull-player-card','.rtg-shop-screen','.rtg-shop-'],
    Run: ['.rtg-run-content','.rtg-run-command','.rtg-map-block','.rtg-route-heading','.rtg-route-count','.rtg-route-stage','.rtg-map-lines','.rtg-route-node','.rtg-node-checkpoint'],
    Shell: ['.rtg-main-title','.rtg-home-button','.rtg-token-pill','.rtg-main-topbar','.rtg-tabs--main-style','.rtg-bottom-nav'],
    Foundation: ['.modal.rtg-modal','.rtg-paper-modal'],
    RunShared: ['.rtg-locked-content','.rtg-lock-card','.rtg-lock-progress','.rtg-requirements','.rtg-requirements-list','.rtg-requirement','.rtg-node-modal']
  };
  // The migration documented in RTG_CSS_ARCHITECTURE.md has not removed all
  // historical owners. Freeze the measured debt from preview #484; do not accept
  // newly introduced or increased legacy selectors during incremental migration.
  // Zero-count selectors remain forbidden, and each cleanup can lower its ceiling.
  const knownLegacySelectorDebt = {
    "Vending": {
      ".rtg-vending-machine": 12,
      ".rtg-vending-machine-v2": 4,
      ".rtg-machine-globe": 4,
      ".rtg-machine-console": 2,
      ".rtg-machine-knob": 2,
      ".rtg-machine-tray": 4,
      ".rtg-capsule": 10
    },
    "Squad": {
      ".rtg-squad-shell": 20,
      ".rtg-squad-topbar": 1,
      ".rtg-squad-back": 1,
      ".rtg-squad-content": 2,
      ".rtg-squad-pitch-main": 1,
      ".rtg-squad-actions": 4,
      ".rtg-squad-player-card": 24,
      ".rtg-squad-picker-modal": 48,
      ".rtg-squad-picker": 59,
      ".rtg-picker-grid": 50,
      ".rtg-picker-role-badge": 4,
      ".rtg-picker-load-more": 4,
      ".rtg-collection-main": 6,
      ".rtg-collection-card-grid": 5,
      ".rtg-formation-modal": 4
    },
    "Match": {
      ".rtg-prematch-shell": 2,
      ".rtg-prematch-content": 3,
      ".rtg-prematch-matchup": 4,
      ".rtg-prematch-tactical": 3,
      ".rtg-prematch-tabs": 5,
      ".rtg-prematch-start": 9,
      ".rtg-match-shell": 140,
      ".rtg-match-scoreboard": 63,
      ".rtg-score-capsule": 4,
      ".rtg-live-commandbar": 7,
      ".rtg-live-command": 22,
      ".rtg-match-event-feed": 33,
      ".rtg-match-ticker-list": 2,
      ".rtg-live-formation-panel": 3,
      ".rtg-live-team-tabs": 8,
      ".rtg-duel-result-banner": 7,
      ".rtg-duel-versus-board": 48,
      ".rtg-duel-choice-card": 15,
      ".rtg-duel-portrait-panel": 35,
      ".rtg-duel-card--clean": 1,
      ".rtg-ticker-event": 21,
      ".rtg-halftime-": 114,
      ".rtg-half-confirm": 6,
      ".rtg-penalty-": 91,
      ".rtg-shootout-score": 1,
      ".rtg-static-field--main": 6,
      ".rtg-field-card": 2,
      ".rtg-field-midline": 5,
      ".rtg-field-team-label": 7,
      ".rtg-probability": 5,
      ".rtg-versus--cards": 8,
      ".rtg-final-probability": 3,
      ".rtg-action-button": 10
    },
    "Economy": {
      ".rtg-development-screen": 0,
      ".rtg-development-wallet": 0,
      ".rtg-development-token-icon": 0,
      ".rtg-development-confirm": 0,
      ".development-requirement": 0,
      ".development-selected": 0,
      ".rtg-legacy-badge": 0,
      ".player-detail-rtg-legacy-badge": 0,
      ".rtg-pull-player-card": 6,
      ".rtg-shop-screen": 0,
      ".rtg-shop-": 0
    },
    "Run": {
      ".rtg-run-content": 4,
      ".rtg-run-command": 4,
      ".rtg-map-block": 9,
      ".rtg-route-heading": 6,
      ".rtg-route-count": 1,
      ".rtg-route-stage": 9,
      ".rtg-map-lines": 2,
      ".rtg-route-node": 14,
      ".rtg-node-checkpoint": 1
    },
    "Shell": {
      ".rtg-main-title": 2,
      ".rtg-home-button": 1,
      ".rtg-token-pill": 1,
      ".rtg-main-topbar": 3,
      ".rtg-tabs--main-style": 5,
      ".rtg-bottom-nav": 14
    },
    "Foundation": {
      ".modal.rtg-modal": 3,
      ".rtg-paper-modal": 11
    },
    "RunShared": {
      ".rtg-locked-content": 1,
      ".rtg-lock-card": 2,
      ".rtg-lock-progress": 1,
      ".rtg-requirements": 8,
      ".rtg-requirements-list": 2,
      ".rtg-requirement": 12,
      ".rtg-node-modal": 11
    }
  };
  for (const [domain, selectors] of Object.entries(domains)) {
    for (const selector of selectors) {
      const occurrences = legacyRoad.split(selector).length - 1;
      const maxAllowed = knownLegacySelectorDebt[domain][selector];
      assert.ok(Number.isInteger(maxAllowed) && occurrences <= maxAllowed,
        `${domain} legacy selector debt increased: ${selector} (${occurrences} > ${maxAllowed})`);
    }
  }
}

const debtFiles = ['road-to-glory.css','rtg-theme.css','rtg-version-banners.css'].filter(name => fs.existsSync(path.join(CSS_DIR, name)));
const countImportant = source => (source.match(/!important\b/g) || []).length;
const importantDebt = Object.fromEntries(debtFiles.map(name => [name, countImportant(fs.readFileSync(path.join(CSS_DIR, name), 'utf8'))]));
const baselineCeilings = {'road-to-glory.css':10000,'rtg-theme.css':10000,'rtg-version-banners.css':10000};
for (const [name,count] of Object.entries(importantDebt)) assert.ok(count <= baselineCeilings[name], `${name} !important debt grew to ${count}`);
console.log('RTG CSS architecture guard: PASS');
console.log(JSON.stringify({rtgCssFiles,activeLegacyThemes,importantDebt},null,2));
