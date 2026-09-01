'use strict';
const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
const development = app.slice(app.indexOf('function developmentPlayers()'), app.indexOf('const DEVELOPMENT_RESOURCE_ITEMS'));
const album = app.slice(app.indexOf('function renderAlbumRoster('), app.indexOf('function bindAlbumRosterInteractions'));
const card = app.slice(app.indexOf('function playerCard('), app.indexOf('function permanentRosterFields'));

assert.match(development, /const progress = global\.AlbumProgress\.read\(\)/, 'Development reads Album progress once before indexing');
assert.match(development, /unlockedSet\(collectionId, progress\)/, 'Development unlocked sets reuse pre-read progress');
assert.doesNotMatch(development, /unlockedSet\(collectionId\)\./, 'Development does not trigger storage reads inside the player loop');
assert.match(development, /currentPotential[\s\S]*categoryForPotential/, 'rarity metadata is computed without resolving stats');
assert.match(development, /players\.slice\(0, visibleCount\)\.map\(resolveDevelopmentPlayer\)/, 'only the visible Development page is resolved');

assert.match(album, /rawPlayers\.length > 80 \? pageSize/, 'large Album rosters start with a 60-player page');
assert.match(album, /const pageSize = 60/, 'Album page size is fixed at 60');
assert.match(album, /rawPlayers\.slice\(0, visibleCount\)/, 'Album resolves only visible raw players');
assert.match(album, /visibleCount \+ pageSize/, 'Album load-more grows by 60');
assert.match(album, /const rawById = new Map/, 'Album detail uses an id index');
assert.match(album, /const resolvedById = new Map/, 'Album visible/detail resolutions are cached');
assert.match(album, /showPlayerDetailsFor\(player/, 'delegated tap opens detail directly');
assert.doesNotMatch(album.slice(album.indexOf('bindAlbumRosterInteractions')), /renderAlbumRoster\(/, 'player taps do not rerender the roster');
assert.match(card, /options\.resolvedPlayer \|\|/, 'playerCard accepts a pre-resolved player');
assert.match(album, /resolvedPlayer: player/, 'Album cards avoid a second progression resolution');
assert.match(app, /loading="lazy" decoding="async" \$\{imageFallbackAttributes\(detailVisual\.detailFallbacks\)\}/, 'detail fullbody decodes asynchronously');

assert.match(app, /development-evolution-preview development-squad-card-scope/, 'evolution preview receives the modern Squad card scope');
assert.match(css, /\.shop-grid\{[^}]*grid-template-columns:repeat\(2/, 'mobile shop uses a compact two-column grid');
assert.doesNotMatch(css, /height:\s*1(?:74|80)px;\s*min-height:\s*0/, 'no later 174/180px mobile card height remains');
console.log('rendering-performance-regression-test: bounded Development/Album rendering OK');
