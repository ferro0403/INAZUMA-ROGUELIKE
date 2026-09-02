const assert=require('assert'),fs=require('fs');
const view=fs.readFileSync('js/run-entry/season-selection-view.js','utf8'),css=fs.readFileSync('css/game.css','utf8');
for(const value of ['ie1_s2','ie1_s3','akibagamers','loading="lazy" decoding="async"','SELEZIONA SEASON']) assert.ok(view.includes(value));
assert.doesNotMatch(view,/CENTRO DI SVILUPPO|open-development/);assert.match(css,/\.season-select-screen \.season-choice-grid \{[^}]*grid-template-columns: repeat\(2/);assert.match(css,/@media \(max-width: 780px\)[\s\S]*\.season-select-screen \.season-choice-grid \{ grid-template-columns: minmax\(0,1fr\)/);console.log('season-select-illustrated-test: covers, focal points and Season-only layout OK');
