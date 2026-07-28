const assert = require('node:assert/strict'); const fs = require('node:fs');
const app = fs.readFileSync('js/app.js', 'utf8'); const css = fs.readFileSync('css/game.css', 'utf8'); const html = fs.readFileSync('index.html', 'utf8');
for (const text of ['CENTRO DI SVILUPPO', 'GIOCATORE PROGETTO', 'CERTIFICAZIONE PROGETTO', 'Nessun giocatore certificato', 'data-project-select', 'data-invest']) assert.ok(app.includes(text), `UI includes ${text}`);
assert.match(app, /class="role-chip"/); assert.match(css, /\.project-selector-card \.role-chip[^}]*background:#fff[^}]*color:#111216/);
assert.match(css, /\.project-selector-card \.player-overall[^}]*background:#ffd51f/);
assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /grid-template-columns:1fr/);
assert.ok(html.includes('project-config.js') && html.includes('development-center.js'), 'new modules are loaded before app');
console.log('project-ui-test: ok');
