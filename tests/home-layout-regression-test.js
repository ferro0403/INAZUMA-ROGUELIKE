'use strict';
const assert = require('assert');
const fs = require('fs');
const view = fs.readFileSync('js/home/home-view.js', 'utf8');
const controller = fs.readFileSync('js/home/home-controller.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

for (const required of ['Nessuna run attiva', 'Scrivi la tua leggenda', 'Entra nel torneo', 'Run in corso', 'Continua la run', 'Il tuo club']) assert.match(view, new RegExp(required, 'i'));
for (const absent of ['Scegli la run', 'Crea la squadra', 'Affronta i boss', 'home-empty-steps']) assert.doesNotMatch(view, new RegExp(absent, 'i'));
for (const absent of ['La tua squadra', 'Gestisci squadra', 'manage-team-home', 'home-roster-section']) assert.doesNotMatch(view, new RegExp(absent, 'i'), `${absent} is absent from Home`);
for (const [id, handler] of [
  ['open-shop-home', 'renderShop'], ['open-development-home', 'renderDevelopmentCenter'],
  ['open-album-home', 'renderAlbumCollections'], ['open-hall-home', 'renderHallOfFame'],
  ['open-rtg-home', 'renderRoadToGlory'], ['open-modes-home', 'renderSeasonSelect'],
]) {
  assert.match(controller, new RegExp(`getElementById\\("${id}"\\)[\\s\\S]*?${handler}`), `${id} reuses ${handler}`);
}
assert.match(view, /savedRun\?\.teamIdentity \|\| profileIdentity \|\| \{\}/, 'team identity is null-safe');
assert.match(view, /savedRun \? `<p>[\s\S]*?` : ""/, 'run metadata is omitted in the empty state');
assert.match(view, /HOME_SECONDARY_ACTIONS = \[[\s\S]*?Negozio[\s\S]*?Centro di Sviluppo[\s\S]*?Album[\s\S]*?Albo d’Oro[\s\S]*?Road to Glory[\s\S]*?Modalità/, 'club actions preserve the approved order');
assert.match(css, /#clean-home \{[\s\S]*inazuma-stadium-mobile-light\.jpeg/);
assert.match(css, /@media \(min-width: 781px\)[\s\S]*inazuma-stadium-desktop-light\.jpeg/);
assert.match(css, /#clean-home \.home-club-actions \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.doesNotMatch(index, /#clean-home \.home-roster-section \{ display: none; \}/, 'the temporary roster preview workaround is removed');
assert.doesNotMatch(view, /bottom-nav|SCEGLI STAGIONE/i);
console.log('home-layout-regression-test: ok');
