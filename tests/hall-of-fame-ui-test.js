const assert = require('assert');
const appJs = require('fs').readFileSync('js/app.js', 'utf8');
const css = require('fs').readFileSync('css/game.css', 'utf8');
assert(appJs.includes('function homeHallOfFameMarkup'), 'home renders Hall of Fame summary');
assert(appJs.includes('function renderHallOfFame()'), 'dedicated Hall of Fame page exists');
assert(appJs.includes('function renderHallOfFameDetail'), 'Hall team detail page exists');
assert(css.includes('@media (max-width: 760px)') && css.includes('.final-tabs'), 'mobile tabs are styled separately');
assert(css.includes('grid-template-columns: minmax(0, 1.35fr)'), 'desktop summary uses columns');
console.log('hall-of-fame-ui-test passed');
