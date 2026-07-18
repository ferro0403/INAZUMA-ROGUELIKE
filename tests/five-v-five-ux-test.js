const assert = require('node:assert/strict');
const fs = require('node:fs');

const appJs = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

const fiveControlsMatches = appJs.match(/class="panel five-match-controls five-v-five-mobile-actions"/g) || [];
assert.equal(fiveControlsMatches.length, 1, '5v5 action panel is rendered once');
['Simula partita', 'Modifica squadra', '← Torna al percorso'].forEach((label) => {
  assert(appJs.includes(label), `5v5 action panel keeps ${label}`);
});
assert(appJs.includes('const TEST_MATCH_CONTROLS_ENABLED = true') && appJs.includes('match-test-tools') && appJs.includes('id="test-win"'), '5v5 safe-win test control is visible and separated from primary actions');
assert(appJs.includes('document.getElementById("edit-five-team").addEventListener("click"'), '5v5 edit-team handler remains attached to the single panel');
assert(appJs.includes('document.getElementById("simulate-boss-match").addEventListener("click", (event) => { event.preventDefault(); startMatchSimulation(match); })'), 'simulate action keeps its existing handler');
assert(appJs.includes('document.getElementById("continue-match-result")?.addEventListener("click", continueAfterMatch)'), 'post-simulation continue action keeps its existing handler');
assert(!appJs.includes('class="panel boss-match-controls five-match-controls"'), '11v11 screen does not reuse the 5v5 action-bar class');

assert(appJs.includes('five-match-header-back') && appJs.includes('Torna al percorso'), '5v5 match header exposes one compact mobile-safe return-to-map action');
assert.equal((appJs.match(/aria-label="Torna alla mappa"/g) || []).length, 2, '5v5 markup keeps the existing header return action without adding another duplicate');
assert(appJs.includes('match-state-badge') && appJs.includes('Preparazione') && appJs.includes('In corso') && appJs.includes('Completata'), '5v5 header shows preparation/in-progress/completed state');
assert(appJs.includes('class="five-match-summary"') && appJs.includes('Probabilità vittoria') && appJs.includes('Dato usato dalla simulazione') && appJs.includes('fiveMatchComparisonMarkup'), '5v5 match summary separates strength, simulator probability, and real stat comparison');
assert(appJs.includes('id="five-match-log-panel"') && appJs.includes('id="five-match-result-panel"'), '5v5 chronology and result are separated into addressable panels');
assert(appJs.includes('Vai al risultato'), '5v5 simulation provides a skip-to-result action');
assert(appJs.includes('id="back-five-match-head"') && appJs.includes('← Torna alla partita'), '5v5 editor provides a visible return-to-match action');
assert(appJs.includes('id="cancel-five-edit"') && appJs.includes('Salva formazione'), '5v5 editor distinguishes save and cancel actions');
assert(appJs.includes('back-item-map') && appJs.includes('back-offer-map'), 'item and pull events expose explicit map return controls');
assert(appJs.includes('scrollIntoView({ block: "nearest" })'), '5v5 simulation uses controlled nearest scrolling instead of jumping to top');
assert(!appJs.includes('window.scrollTo(0, 0)'), 'match flow must not force-scroll to the page top');

assert(css.includes('.btn-back') && css.includes('.btn-secondary') && css.includes('.btn-tool'), 'semantic button hierarchy styles are present');
assert(css.includes('.five-match-summary') && css.includes('.five-match-probability'), '5v5 summary/probability styles are present');
assert(css.includes('.five-match-controls { position: static;'), '5v5 primary controls stay in normal document flow on every viewport');
assert(!css.includes('--mobile-five-actions-height'), '5v5 no longer defines fixed-action compensation height');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-content \{[^}]*padding-bottom:\s*20px/.test(css), 'mobile 5v5 content keeps only normal in-flow ending space');
assert(!/\.five-match-content \{[^}]*padding-bottom:\s*calc\(var\(--mobile-five-actions-height\)/.test(css), 'mobile 5v5 content no longer compensates a fixed action bar');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-screen > \.five-v-five-mobile-actions \{[^}]*position:\s*static[\s\S]*?left:\s*auto[\s\S]*?right:\s*auto[\s\S]*?bottom:\s*auto[\s\S]*?z-index:\s*auto/.test(css), 'mobile 5v5 controls are static in the document flow');
assert(!/@media \(max-width: 780px\)[\s\S]*?\.five-match-screen > \.five-v-five-mobile-actions \{[^}]*position:\s*(?:fixed|sticky|absolute)/.test(css), 'mobile 5v5 controls are not fixed, sticky, or absolute');
assert(!/@media \(max-width: 780px\)[\s\S]*?\.five-match-controls \{[^}]*padding:[^;}]*env\(safe-area-inset-bottom\)/.test(css), 'mobile 5v5 controls no longer reserve fixed-bar safe-area padding');
assert(!/boss-match-controls[\s\S]{0,120}position:\s*fixed/.test(css), '11v11 boss controls must not receive the mobile fixed 5v5 treatment');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-tabs \{[\s\S]*?position:\s*sticky/.test(css), 'mobile 5v5 tabs are reinforced and sticky in the local 5v5 layer');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-controls \.button-row \.btn-back \{[^}]*display:\s*none/.test(css), 'mobile 5v5 hides the lower return action so only one map action is visible');
assert(/@media \(max-width: 780px\)[\s\S]*?\.five-match-hero \{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)/.test(css), 'mobile 5v5 header uses an in-flow compact two-column top row');
assert(css.includes('.five-match-back-short { display: none; }') && /@media \(max-width: 780px\)[\s\S]*?\.five-match-back-short \{ display:\s*inline; \}/.test(css), 'mobile 5v5 abbreviates the header return label without losing aria-label');
assert(css.includes('.five-roster-card.disabled small::after'), 'incompatible 5v5 candidates explain why they are disabled');

console.log('5v5 UX static test passed.');

assert(appJs.includes('five-match-scoreline') && appJs.includes('aria-live="polite"'), '5v5 score and chronology expose live regions');
assert(css.includes('.five-match-traits') && css.includes('.five-match-scoreline'), '5v5 real stat comparison and scoreline styles are present');
