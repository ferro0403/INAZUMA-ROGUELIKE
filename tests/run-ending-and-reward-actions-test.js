'use strict';

const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/game.css', 'utf8');

function functionSource(name, nextName) {
  const start = app.indexOf(`  function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} exists`);
  const end = nextName ? app.indexOf(`  function ${nextName}(`, start) : app.length;
  assert.notStrictEqual(end, -1, `${nextName} exists after ${name}`);
  return app.slice(start, end);
}

const confirmation = functionSource('openInventoryConfirmation', 'useInventoryItem');
assert.match(confirmation, /let submitting = false/, 'confirmation guards against repeated taps');
assert.match(confirmation, /if \(submitting\) return/, 'a second confirmation cannot run');
assert.match(confirmation, /confirmButton\.disabled = true/, 'confirmation is disabled while saving');
assert.match(confirmation, /catch \(error\)[\s\S]*confirmButton\.disabled = false[\s\S]*toast\([^;]+, "error"\)/, 'failure keeps the modal usable and reports an error');

const unequip = functionSource('unequipPlayerItem', 'renderGameOver');
assert.match(unequip, /run\.inventory\.push\(equippedItem\)[\s\S]*entry\.equippedItem = null[\s\S]*RunState\.save\(run\)/, 'equipment returns to inventory before the saved update');
assert.match(unequip, /catch \(error\)[\s\S]*entry\.equippedItem = equippedItem[\s\S]*run\.inventory\.splice/, 'a failed save rolls inventory and player state back');
assert.match(unequip, /RunState\.save\(run\)[\s\S]*renderInventory[\s\S]*closeModal\(\)[\s\S]*toast\("Oggetto riportato nell'inventario"\)/, 'successful removal updates locally, closes, then toasts');

const pullActions = functionSource('pullChoiceActionPanel', 'updateInlinePullSelection');
assert.match(pullActions, />SÌ<\/button>/, 'candidate keeps the confirm action');
assert.match(pullActions, />SCHEDA<\/button>/, 'candidate keeps the detail action');
assert.doesNotMatch(pullActions, />NO<\/button>|data-pull-action="cancel"/, 'candidate no longer has an individual refusal');
assert.match(css, /\.pull-selection-modal \.pull-choice-action-row \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'candidate actions share two equal columns');
assert.match(app, /id="skip-offer">RINUNCIA/, 'the whole-reward refusal remains available');

const fiveLoss = functionSource('completeFiveMatch', 'completeBossMatch');
const bossLoss = functionSource('completeBossMatch', 'continueAfterMatch');
for (const flow of [fiveLoss, bossLoss]) {
  assert.match(flow, /run\.gameOver \? "Hai perso l'ultima vita\. La run è terminata\."/, 'zero-life defeat has final wording');
  assert.match(flow, /type: run\.gameOver \? "game-over" : "map"/, 'zero lives still route to game over');
}

const gameOver = functionSource('renderGameOver', 'homeHallOfFameMarkup');
for (const text of ['0 VITE RIMASTE', 'RUN TERMINATA', 'La squadra non può più continuare questa run.', 'NUOVA RUN', 'MENU']) {
  assert.ok(gameOver.includes(text), `game over includes ${text}`);
}
assert.match(gameOver, /restart-run[\s\S]*openTeamNameModal/, 'new run keeps its existing flow');
assert.match(gameOver, /getElementById\("home"\)[\s\S]*renderHome/, 'menu keeps its existing flow');

const finalSummary = functionSource('renderFinalSummary', 'playerStatsMarkup');
assert.doesNotMatch(finalSummary, /review-team|Rivedi la squadra/i, 'broken team review action is fully removed');
assert.match(finalSummary, /id="open-current-hall"[\s\S]*id="final-new-run"/, 'Hall of Fame and new-run actions remain');
assert.match(finalSummary, /open-current-hall[\s\S]*renderHallOfFameDetail/, 'Hall of Fame action remains wired');

console.log('run-ending-and-reward-actions-test: ok');
