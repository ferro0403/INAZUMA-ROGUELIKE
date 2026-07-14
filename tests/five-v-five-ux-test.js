const assert = require('node:assert/strict');
const fs = require('node:fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

const fiveControlsMatches = appJs.match(/class="panel five-match-controls"/g) || [];
assert.equal(fiveControlsMatches.length, 1, '5v5 action panel is rendered once');
['Simula partita', 'Modifica squadra', 'Vittoria sicura', 'Sconfitta', '← Torna alla mappa'].forEach((label) => {
  assert(appJs.includes(label), `5v5 action panel keeps ${label}`);
});
assert(appJs.includes('document.getElementById("edit-five-team").addEventListener("click"'), '5v5 edit-team handler remains attached to the single panel');
assert(appJs.includes('document.getElementById("simulate-boss-match").addEventListener("click", (event) => { event.preventDefault(); startMatchSimulation(match); })'), 'simulate action keeps its existing handler');
assert(appJs.includes('document.getElementById("continue-match-result")?.addEventListener("click", continueAfterMatch)'), 'post-simulation continue action keeps its existing handler');
assert(!appJs.includes('class="panel boss-match-controls five-match-controls"'), '11v11 screen does not reuse the 5v5 action-bar class');

assert(appJs.includes('class="btn btn-back" data-nav="map" aria-label="Torna alla mappa"'), '5v5 match header exposes an explicit return-to-map action');
assert(appJs.includes('match-state-badge') && appJs.includes('Preparazione') && appJs.includes('In corso') && appJs.includes('Completata'), '5v5 header shows preparation/in-progress/completed state');
assert(appJs.includes('class="five-match-summary"') && appJs.includes('Probabilità vittoria') && appJs.includes('Dato usato dalla simulazione'), '5v5 match summary separates strength and simulator probability');
assert(appJs.includes('id="five-match-log-panel"') && appJs.includes('id="five-match-result-panel"'), '5v5 chronology and result are separated into addressable panels');
assert(appJs.includes('Vai al risultato'), '5v5 simulation provides a skip-to-result action');
assert(appJs.includes('id="back-five-match-head"') && appJs.includes('← Torna alla partita'), '5v5 editor provides a visible return-to-match action');
assert(appJs.includes('id="cancel-five-edit"') && appJs.includes('Salva formazione'), '5v5 editor distinguishes save and cancel actions');
assert(appJs.includes('back-item-map') && appJs.includes('back-offer-map'), 'item and pull events expose explicit map return controls');
assert(appJs.includes('scrollIntoView({ block: "nearest" })'), '5v5 simulation uses controlled nearest scrolling instead of jumping to top');
assert(!appJs.includes('window.scrollTo(0, 0)'), 'match flow must not force-scroll to the page top');

assert(css.includes('.btn-back') && css.includes('.btn-secondary') && css.includes('.btn-tool'), 'semantic button hierarchy styles are present');
assert(css.includes('.five-match-summary') && css.includes('.five-match-probability'), '5v5 summary/probability styles are present');
assert(css.includes('.five-match-controls { position: sticky;'), 'desktop 5v5 primary controls keep their existing sticky layout');
assert(css.includes('--mobile-five-actions-height'), '5v5 screen defines a dedicated mobile action-bar compensation height');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-content \{[^}]*padding-bottom:\s*calc\(var\(--mobile-five-actions-height\) \+ env\(safe-area-inset-bottom\)\)/.test(css), 'mobile 5v5 content has bottom compensation for the fixed action bar');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-controls \{[^}]*position:\s*fixed[\s\S]*?left:\s*0[\s\S]*?right:\s*0[\s\S]*?bottom:\s*0/.test(css), 'mobile 5v5 controls are fixed to the viewport bottom');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-controls \{[^}]*padding:\s*10px 12px calc\(12px \+ env\(safe-area-inset-bottom\)\)/.test(css), 'mobile 5v5 controls account for iPhone safe area');
assert(!/boss-match-controls[\s\S]{0,120}position:\s*fixed/.test(css), '11v11 boss controls must not receive the mobile fixed 5v5 treatment');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-tabs \{[\s\S]*?position:\s*sticky/.test(css), 'mobile 5v5 tabs are reinforced and sticky in the local 5v5 layer');
assert(css.includes('.five-roster-card.disabled small::after'), 'incompatible 5v5 candidates explain why they are disabled');

console.log('5v5 UX static test passed.');
