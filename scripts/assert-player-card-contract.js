const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');
const required = [
  'function compactPlayerCardMarkup',
  'class="player-card player-card-compact tactical-player-card tactical-player-card--desktop tactical-player-card--mobile mini-player',
  'function playerCard',
  'class="player-card player-card-large pull-player-card pull-player-card--desktop pull-player-card--mobile',
  '.player-card {',
  '.player-card-compact, button.player-card-compact',
  '.mini-player, .tactical-player-card',
];
for (const token of required) {
  if (!app.includes(token) && !css.includes(token)) throw new Error(`Player card contract token missing: ${token}`);
}
const mobileV2Css = css.slice(css.indexOf('/* Mobile V2 experimental vertical slice'));
for (const forbidden of ['.mobile-v2 .player-card', '.mobile-v2 .mini-player', '.mobile-v2 .player-card-compact']) {
  if (mobileV2Css.includes(forbidden)) throw new Error(`Mobile V2 must not restyle cards: ${forbidden}`);
}
console.log('Player card contract unchanged: standard playerCard and compactPlayerCardMarkup selectors remain isolated from mobile-v2 CSS.');
