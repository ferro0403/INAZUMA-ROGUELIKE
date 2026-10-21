const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const CSS_DIR = path.join(ROOT, 'css');
const ARCH = path.join(ROOT, 'docs', 'RTG_CSS_ARCHITECTURE.md');
assert.ok(fs.existsSync(ARCH), 'RTG CSS architecture contract must exist');

const forbiddenNewLayerName = /(?:^|[-_.])(fix|final|polish|tuning|override|depth|perspective)(?:[-_.]|$)/i;
// This is an in-progress migration: core/base are allowed only while actively
// imported from the production theme. Never allow abandoned legacy files.
const transitionalLayers = [
  {name:'rtg-theme-core.css',parent:'rtg-theme.css'},
  {name:'rtg-theme-base.css',parent:'rtg-theme-core.css'},
];
const retiredDisconnectedLayers = ['rtg-match-final.css','rtg-vending-depth.css','rtg-vending-perspective.css'];
const rtgCssFiles = fs.readdirSync(CSS_DIR).filter(name => /^rtg-.*\.css$/i.test(name));
for (const name of retiredDisconnectedLayers)
  assert.ok(!rtgCssFiles.includes(name), 'Retired RTG stylesheet must stay absent: '+name);
const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const activeThemeLink = /<link\b[^>]*href=["']css\/rtg-theme\.css(?:\?[^"']*)?["']/i.test(html);
for (const layer of transitionalLayers) {
  const exists = rtgCssFiles.includes(layer.name);
  const parentPath = path.join(CSS_DIR,layer.parent);
  const parentCss = fs.existsSync(parentPath) ? fs.readFileSync(parentPath,'utf8') : '';
  const activeImport = parentCss.split(/\r?\n/).some(line =>
    /^\s*@import\b/.test(line) && line.includes('./'+layer.name)
  );
  assert.strictEqual(activeImport,exists,'RTG transitional layer must be imported iff present: '+layer.parent+' -> '+layer.name);
  if(exists) assert.ok(activeThemeLink,'RTG transitional layers must be reachable from index.html: '+layer.name);
}
for (const name of rtgCssFiles) assert.ok(!forbiddenNewLayerName.test(name), `RTG finishing/override layer is forbidden: ${name}`);

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
  // Frozen selector debt from the production baseline ab75a258. The old file
  // may lose selectors as migration progresses, but cannot gain occurrences.
  const baselineOccurrences = {"Vending":[12,4,4,2,2,4,10],"Squad":[20,1,1,2,1,4,24,48,59,50,4,4,6,5,4],"Match":[2,3,4,3,5,9,140,63,4,7,22,33,2,3,8,7,48,15,35,1,21,114,6,91,1,6,2,5,7,5,8,3,10],"Economy":[0,0,0,0,0,0,0,0,6,0,0],"Run":[4,4,9,6,1,9,2,14,1],"Shell":[2,1,1,3,5,14],"Foundation":[3,11],"RunShared":[1,2,1,8,2,12,11]};
  for (const [domain, selectors] of Object.entries(domains)) {
    assert.strictEqual(selectors.length,baselineOccurrences[domain]?.length,'RTG debt inventory changed: '+domain);
    selectors.forEach((selector,index)=>{
      const occurrences=legacyRoad.split(selector).length-1;
      assert.ok(occurrences<=baselineOccurrences[domain][index],
        'Legacy RTG selector debt increased: '+domain+' '+selector+' ('+occurrences+' > '+baselineOccurrences[domain][index]+')');
    });
  }
}

const debtFiles = ['road-to-glory.css','rtg-theme.css','rtg-version-banners.css'].filter(name => fs.existsSync(path.join(CSS_DIR, name)));
const countImportant = source => (source.match(/!important\b/g) || []).length;
const importantDebt = Object.fromEntries(debtFiles.map(name => [name, countImportant(fs.readFileSync(path.join(CSS_DIR, name), 'utf8'))]));
const baselineCeilings = {"road-to-glory.css":976,"rtg-theme.css":867,"rtg-version-banners.css":84}; // Frozen baseline: no increase in !important debt.
for (const [name,count] of Object.entries(importantDebt)) assert.ok(count <= baselineCeilings[name], `${name} !important debt grew to ${count}`);
console.log('RTG CSS architecture guard: PASS');
console.log(JSON.stringify({rtgCssFiles,importantDebt},null,2));
