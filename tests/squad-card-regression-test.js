const assert = require('assert');
const fs = require('fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
const season = JSON.parse(fs.readFileSync('data/IE1_season_compact.json', 'utf8'));

const compactMatch = appJs.match(/function compactPlayerCardMarkup\([\s\S]*?\n  }\n\n  function playerCard/);
assert(compactMatch, 'shared compact player-card renderer exists');
const compactRenderer = compactMatch[0];

[
  'class="player-card player-card-compact tactical-player-card tactical-player-card--desktop tactical-player-card--mobile mini-player',
  'dataAttr',
  'playerPortraitUrl(player)',
  'player-role',
  'player-overall',
  'player-equipment',
  'player-level',
  'data-player-role',
  'data-player-overall',
  'data-player-level',
].forEach((needle) => assert(compactRenderer.includes(needle), `compact player-card renderer preserves ${needle}`));

assert.equal((appJs.match(/function compactPlayerCardMarkup/g) || []).length, 1, 'compact player-card renderer is not duplicated');
assert.equal((appJs.match(/function tacticalMiniPlayer/g) || []).length, 1, 'squad mini-player adapter is not duplicated');
assert.equal((appJs.match(/function squadPitchMarkup/g) || []).length, 1, '11v11 pitch renderer is not duplicated');
assert.equal((appJs.match(/function benchMarkup/g) || []).length, 1, 'bench renderer is not duplicated');

assert(appJs.includes('data-squad-player="${escapeHtml(id)}" data-area="${area}"'), 'squad cards keep player id and area data attributes');
assert(appJs.includes('ui.squadEditMode\n        ? handleSquadSelection(squadPlayer.dataset.squadPlayer)\n        : showPlayerDetails(squadPlayer.dataset.squadPlayer);'), 'same squad click path opens Player Detail or selection');
assert(appJs.includes('swapSquadPlayersInDom(starterId, benchId);'), 'starter-reserve swaps still update the existing card nodes');
assert(appJs.includes('run.lineup[run.lineup.indexOf(starterId)] = benchId;'), 'starter id is replaced by bench id during swaps');
assert(appJs.includes('run.bench[run.bench.indexOf(benchId)] = starterId;'), 'bench id is replaced by starter id during swaps');
assert(appJs.includes('equipment: player.equipment'), 'equipment remains sourced from the resolved player for compact cards');

assert(appJs.includes('const squadSummary = squadValiditySummary();'), 'squad rework uses a view summary without changing gameplay state');
assert(appJs.includes('${squadPitchMarkup()}'), 'squad screen still renders the shared 11v11 pitch markup once');
assert(appJs.includes('${benchMarkup()}'), 'squad screen still renders the shared bench markup once');
assert(appJs.includes('squadFormationTabsMarkup()'), 'formation tabs are added as an outer selector only');

['4-3-3', '4-4-2', '3-4-3', '5-4-1', '4-5-1', '4-2-4'].forEach((formation) => {
  assert(season.formations.eleven.some((item) => item.id === formation), `supported 11v11 formation ${formation} remains available`);
});

assert(css.includes('.squad-screen .squad-content'), 'new squad CSS is scoped to the Squad screen');
assert(css.includes('.squad-field-panel .pitch::before'), 'polished field lines are applied through the Squad field container');
assert(css.includes('.squad-formation-tabs'), 'mobile-safe horizontal formation tabs are styled');
assert(!css.includes('.squad-screen .player-card {'), 'squad CSS does not globally restyle shared player cards');
assert(!css.includes('.squad-screen .player-portrait'), 'squad CSS does not alter shared portrait sizing/object-fit');

console.log('Squad card regression test passed: shared cards and squad interactions are structurally preserved.');
