const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));
const emptyHome = between('function homeEmptyRunMarkup()', 'function homeRunCardMarkup');
const activeHome = between('function homeActiveRunMarkup', 'function homeEmptyRunMarkup');
const teamBanner = between('function homeTeamBannerMarkup', 'function homeActiveRunMarkup');

assert.match(emptyHome, /homeTeamBannerMarkup\(null\)/, 'the empty Home always renders the persistent team identity');
assert.match(teamBanner, /savedRun \?[^:]+: ""/, 'run metadata is omitted when there is no active run');
assert.match(emptyHome, /Scrivi la tua leggenda/i);
assert.match(emptyHome, /Entra nel torneo/i);
assert.doesNotMatch(emptyHome, /Scegli la tua prossima sfida|Scegli la run|Crea la squadra|Affronta i boss/);
assert.doesNotMatch(emptyHome, /La tua squadra|home-roster-preview/);

assert.match(activeHome, /Run in corso/i);
assert.match(activeHome, /Prossimo boss/);
assert.match(activeHome, /Media team/);
assert.match(activeHome, /Formazione/);
assert.match(activeHome, /Progresso zona/);
assert.match(activeHome, /Continua la run/i);
assert.match(activeHome, /La tua squadra/i);
assert.match(activeHome, /Gestisci squadra/i);

for (const label of ['Negozio', 'Centro di Sviluppo', 'Album', 'Albo d’Oro', 'Modalità']) {
  assert.match(app, new RegExp(`label: "${label.replace('’', '’')}"`, 'i'), `${label} is available in the club menu`);
}
assert.match(app, /open-shop-home[^\n]+renderShop\(\)/, 'the Home shop action reuses the existing shop renderer');
assert.doesNotMatch(emptyHome + activeHome, /bottom-nav|Scegli stagion/i);
assert.match(css, /home-club-action--wide \{ grid-column: 1 \/ -1; \}/);
assert.match(css, /inazuma-stadium-mobile-light\.jpeg/);
assert.match(css, /inazuma-stadium-desktop-light\.jpeg/);

console.log('home-hub-redesign-test: ok');
