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

const rtgCssFiles = fs.readdirSync(CSS_DIR).filter(name => /^rtg-.*\.css$/i.test(name));
for (const name of retiredDisconnectedLayers) assert.ok(!rtgCssFiles.includes(name), `Disconnected legacy RTG stylesheet must stay retired: ${name}`);
for (const name of rtgCssFiles) assert.ok(!forbiddenNewLayerName.test(name), `RTG finishing/override layer is forbidden: ${name}`);

const legacyRoadPath = path.join(CSS_DIR, 'road-to-glory.css');
if (fs.existsSync(legacyRoadPath)) {
  const legacyRoad = fs.readFileSync(legacyRoadPath, 'utf8');
  const domains = {
    Vending: ['.rtg-vending-machine','.rtg-vending-machine-v2','.rtg-machine-globe','.rtg-machine-console','.rtg-machine-knob','.rtg-machine-tray','.rtg-capsule'],
    Squad: ['.rtg-squad-shell','.rtg-squad-topbar','.rtg-squad-back','.rtg-squad-content','.rtg-squad-pitch-main','.rtg-squad-actions','.rtg-squad-player-card','.rtg-squad-picker-modal','.rtg-squad-picker','.rtg-picker-grid','.rtg-picker-role-badge','.rtg-picker-load-more','.rtg-collection-main','.rtg-collection-card-grid','.rtg-formation-modal'],
    Match: ['.rtg-prematch-shell','.rtg-prematch-content','.rtg-prematch-matchup','.rtg-prematch-tactical','.rtg-prematch-tabs','.rtg-prematch-start','.rtg-match-shell','.rtg-match-scoreboard','.rtg-score-capsule','.rtg-live-commandbar','.rtg-live-command','.rtg-match-event-feed','.rtg-match-ticker-list','.rtg-live-formation-panel','.rtg-live-team-tabs','.rtg-duel-result-banner','.rtg-duel-versus-board','.rtg-duel-choice-card','.rtg-duel-portrait-panel','.rtg-duel-card--clean']
  };
  for (const [domain, selectors] of Object.entries(domains)) {
    for (const selector of selectors) assert.ok(!legacyRoad.includes(selector), `${domain} selector must not remain in road-to-glory.css: ${selector}`);
  }
}

const debtFiles = ['road-to-glory.css','rtg-theme.css','rtg-version-banners.css'].filter(name => fs.existsSync(path.join(CSS_DIR, name)));
const countImportant = source => (source.match(/!important\b/g) || []).length;
const importantDebt = Object.fromEntries(debtFiles.map(name => [name, countImportant(fs.readFileSync(path.join(CSS_DIR, name), 'utf8'))]));
const baselineCeilings = {'road-to-glory.css':10000,'rtg-theme.css':10000,'rtg-version-banners.css':10000};
for (const [name,count] of Object.entries(importantDebt)) assert.ok(count <= baselineCeilings[name], `${name} !important debt grew to ${count}`);
console.log('RTG CSS architecture guard: PASS');
console.log(JSON.stringify({rtgCssFiles,importantDebt},null,2));
