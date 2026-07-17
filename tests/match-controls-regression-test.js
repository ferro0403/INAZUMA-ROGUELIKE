const assert = require('node:assert/strict');
const fs = require('node:fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

assert(appJs.includes('function handleStartMatchClick(match, options = {})'), 'simulate click has a guarded start wrapper');
assert(appJs.includes('button.disabled = true; button.textContent = "Avvio..."'), 'simulate button is disabled immediately after a valid click');
assert(appJs.includes('console.error("Errore avvio simulazione", error)'), 'simulate startup failures are logged');
assert(appJs.includes('handleStartMatchClick(match);') && appJs.includes('handleStartMatchClick(ui.match, { boss });'), '5v5 and boss screens both bind the guarded simulate handler');
assert(!appJs.includes('document.getElementById("test-win").addEventListener'), 'test-win binding cannot throw when the button is absent');
assert(appJs.includes('document.getElementById("test-win")?.addEventListener'), 'test-win binding is null-safe');
assert(appJs.includes('sim.testControl = true;') && appJs.includes('sim.forcedOutcome = result === "victory" ? "win" : "loss"'), 'forced wins are marked on the match simulation');
assert(appJs.includes('ensureMatchPreview(match, { forceRefresh: !match.simulation?.valid, freeze: true })'), 'forced wins create/reuse a frozen valid snapshot');
assert(css.includes('.map-squad-action') && /@media \(max-width: 780px\)[\s\S]*?\.map-squad-action \{ display:\s*none; \}/.test(css), 'mobile map hides the redundant edit-squad button');
assert(css.includes('.btn-back-compact') && appJs.includes('← Percorso'), '5v5 formation back control is compact and relabeled');

console.log('match controls regression test passed.');
