const assert = require('assert');
const appJs = require('fs').readFileSync('js/app.js', 'utf8');
assert(appJs.includes('function persistChampionBeforeFinalUi'), 'final victory must persist champion before UI');
assert(appJs.includes('global.HallOfFameStorage.addChampion(buildChampionSnapshot'), 'final victory uses HallOfFameStorage.addChampion');
assert(appJs.includes('run.phase = "final-celebration"'), 'completed run resumes to final celebration');
assert(appJs.includes('renderFinalSummary'), 'continue opens final summary');
assert(appJs.includes('L’Albo d’Oro e le squadre campioni resteranno salvati'), 'new run warning preserves hall archive');
console.log('final-victory-flow-test passed');
