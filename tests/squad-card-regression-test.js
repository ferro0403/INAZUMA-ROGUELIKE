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
assert(appJs.includes('handleSquadSelection(squadPlayer.dataset.squadPlayer);'), 'every squad card click enters direct selection');
assert(!appJs.includes('id="toggle-squad-edit"'), 'separate edit-starters mode is removed');
assert(appJs.includes('swapSquadPlayersInDom(selected, clickedId, firstArea, secondArea);'), 'compatible swaps update only the two existing card nodes');
assert(appJs.includes('[firstList[firstIndex], firstList[secondIndex]] = [firstList[secondIndex], firstList[firstIndex]];'), 'same-area swaps preserve the existing lineup or bench arrays');
assert(appJs.includes('firstList[firstIndex] = clickedId;') && appJs.includes('secondList[secondIndex] = selected;'), 'starter-reserve swaps preserve the existing lineup and bench arrays');
assert(appJs.includes('equipment: player.equipment'), 'equipment remains sourced from the resolved player for compact cards');
assert(appJs.includes('equipmentInFooter: mode === "squad"'), 'Squad cards reserve footer space for equipment without changing other card contexts');
assert(appJs.includes('${itemIcon(equipment)}</span>'), 'Squad cards use the real item image path when imageUrl is available');
assert(!compactRenderer.includes('preferLocal: equipmentInFooter'), 'Squad cards no longer force the recreated local equipment symbol');
assert(appJs.includes('function reconcileSquadRosterState()'), 'legacy roster leftovers are reconciled through one idempotent Squad migration');
assert(appJs.includes('formationValid: !formationIssue'), 'starting-eleven validity is independent from bench completeness');
assert(appJs.includes('rosterComplete: benchCount === 4 && !rosterIssue'), 'bench completeness is reported separately from formation validity');
assert(appJs.includes('Il modulo richiede ${amount} ${role} · presenti ${roleCounts[role]}'), 'invalid formations expose the precise role mismatch');

assert(appJs.includes('const squadSummary = squadValiditySummary();'), 'squad rework uses a view summary without changing gameplay state');
assert(appJs.includes('${squadPitchMarkup()}'), 'squad screen still renders the shared 11v11 pitch markup once');
assert(appJs.includes('${benchMarkup()}'), 'squad screen still renders the shared bench markup once');
assert(appJs.includes('squadFormationOptionsMarkup()'), 'all formations are rendered inside the dedicated selector');
assert(appJs.includes('id="open-squad-formation"'), 'the current module exposes one dedicated edit action');
assert(appJs.includes('id="squad-player-info" disabled'), 'INFO starts disabled without a selection');
assert(appJs.includes('showPlayerDetails(ui.selectedSquadPlayerId)'), 'INFO reuses the standard selected-player detail');

['4-3-3', '4-4-2', '3-4-3', '5-4-1', '4-5-1', '4-2-4'].forEach((formation) => {
  assert(season.formations.eleven.some((item) => item.id === formation), `supported 11v11 formation ${formation} remains available`);
});

assert(css.includes('.squad-screen .squad-content'), 'new squad CSS is scoped to the Squad screen');
assert(css.includes('assets/squad/tactical-pitch.svg'), 'the Squad field uses the local tactical pitch asset');
assert(css.includes('.squad-formation-options'), 'the dedicated formation grid is styled');
assert(css.includes('.squad-screen .squad-player-card.is-compatible'), 'compatible swap destinations have a distinct state');
assert(css.includes('.squad-screen .squad-player-card.is-incompatible'), 'incompatible swap destinations are attenuated');
assert(css.includes('assets/home/inazuma-stadium-mobile-light.jpeg') && css.includes('assets/home/inazuma-stadium-desktop-light.jpeg'), 'Squad reuses both existing responsive stadium assets');
assert(css.includes('.squad-screen .squad-player-card .player-equipment--footer'), 'Squad equipment participates in the card footer layout');
assert(css.includes('.squad-screen .squad-player-card .player-portrait-wrap::after'), 'Squad rarity accent includes a responsive diagonal blade');
assert(css.includes('clip-path: polygon(58% 0, 100% 0, 42% 100%, 0 100%)'), 'Squad rarity diagonal is CSS-only');
assert(css.includes('inset 0 -4px 0 var(--rarity-border'), 'Squad cards preserve a rarity-colored lower edge');
assert(css.includes('.player-equipment--footer .item-icon img'), 'real equipment images are sized inside the Squad footer');
assert(css.includes('.squad-bench-list { grid-template-columns: repeat(2'), 'bench stays in a compact two-column grid');
assert(!css.includes('.squad-screen .player-card {'), 'squad CSS does not globally restyle shared player cards');
assert(!css.includes('.squad-screen .player-portrait'), 'squad CSS does not alter shared portrait sizing/object-fit');

console.log('Squad card regression test passed: direct selection, shared cards and tactical interactions are structurally preserved.');
