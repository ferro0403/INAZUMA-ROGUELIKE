const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../js/match-simulator-config.js');
require('../js/match-simulator.js');
const { makeTeam } = require('./fixtures/match-simulator-teams.js');

const sim = global.MatchSimulator;
const expected = {
  '4-3-3': { id: 'balanced_attack', attack: 0.04, speed: 0.03, control: 0.02, defense: -0.02 },
  '4-4-2': { id: 'solid_compact', physical: 0.04, stamina: 0.03, defense: 0.02, control: -0.02 },
  '3-4-3': { id: 'constant_assault', attack: 0.06, speed: 0.04, control: 0.02, defense: -0.06, save: -0.02 },
  '5-4-1': { id: 'defensive_block', defense: 0.06, save: 0.04, physical: 0.02, attack: -0.06, speed: -0.02 },
  '4-5-1': { id: 'possession_control', control: 0.06, stamina: 0.04, defense: 0.02, attack: -0.04 },
  '4-2-4': { id: 'ultra_offensive', attack: 0.08, speed: 0.04, defense: -0.07, control: -0.03 },
};

for (const [formation, data] of Object.entries(expected)) {
  const tactic = sim.formationTactic(formation);
  assert.equal(tactic.id, data.id, `${formation} exposes its tactical identity`);
  assert.deepEqual(tactic.modifiers, Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'id')), `${formation} modifiers match design values`);
}

const base = { attack: 80, control: 70, defense: 75, save: 65, speed: 60, physical: 55, stamina: 50 };
const before = JSON.stringify(base);
const applied = sim.applyFormationTactics(base, '4-2-4');
assert.equal(JSON.stringify(base), before, 'base components are not mutated');
assert.equal(applied.effective.attack, 86.4, 'percentage modifiers are applied to aggregate components');
assert.deepEqual(sim.applyFormationTactics(base, '4-2-4'), applied, 'tactical calculation is deterministic');
assert.equal(sim.formationTactic('unknown').name, 'Bilanciato', 'unknown formation uses fallback identity');
assert.deepEqual(sim.applyFormationTactics(base, 'unknown').modifiers, {}, 'unknown formation has no modifiers');

const team = makeTeam(11, 70);
const userStrength = sim.teamStrength({ name: 'User', players: team.players, formationId: '4-2-4' }, 'eleven');
const bossStrength = sim.teamStrength({ name: 'Boss', players: team.players, formationId: '4-2-4' }, 'eleven');
assert.deepEqual(userStrength.effectiveComponents, bossStrength.effectiveComponents, 'user and Boss use the same tactical helper');
assert.equal(userStrength.final, bossStrength.final, 'same roster and formation have symmetric strength');

const once = sim.teamStrength({ players: team.players, formationId: '4-2-4' }, 'eleven');
const twiceInput = { ...once.effectiveComponents };
const notDoubled = sim.applyFormationTactics(once.baseComponents, '4-2-4');
assert.deepEqual(notDoubled.effective, once.effectiveComponents, 'bonus is represented once from base components');
assert.notDeepEqual(sim.applyFormationTactics(twiceInput, '4-2-4').effective, once.effectiveComponents, 'test would catch double application to effective components');

const solid = sim.teamStrength({ players: team.players, formationId: '4-4-2' }, 'eleven');
assert.notEqual(once.finalRaw, solid.finalRaw, 'changing formation before the match changes effective strength');
const preview = sim.simulate({ type: 'eleven', seed: 'formation-preview', userTeam: { players: team.players, formationId: '4-2-4' }, opponentTeam: { players: team.players, formationId: '5-4-1' } });
assert.equal(preview.valid, true);
assert.deepEqual(preview.probabilities, sim.getMatchWinProbabilities('eleven', preview.userStrength.final, preview.opponentStrength.final), 'shown probability helper matches simulated probability');

const frozen = JSON.parse(JSON.stringify(preview));
const changed = sim.simulate({ type: 'eleven', seed: 'formation-preview', userTeam: { players: team.players, formationId: '5-4-1' }, opponentTeam: { players: team.players, formationId: '5-4-1' } });
assert.deepEqual(frozen.userStrength, preview.userStrength, 'snapshot values remain frozen after simulation');
assert.notDeepEqual(changed.userStrength.effectiveComponents, frozen.userStrength.effectiveComponents, 'refresh can preserve saved tactical snapshot instead of recalculating changed formation');

const five = sim.teamStrength({ players: makeTeam(5, 70).players, formationId: '4-2-4' }, 'five');
assert.equal(five.effectiveComponents, undefined, '5v5 strength remains on the existing path');
assert.equal(five.tacticalIdentity, undefined, '5v5 has no formation tactic identity');
assert.equal(sim.getMatchWinProbabilities('five', 40, 60).userChance, 80, '5v5 probability table is unchanged');

const playerBefore = JSON.stringify(team.players);
sim.teamStrength({ players: team.players, formationId: '3-4-3' }, 'eleven');
assert.equal(JSON.stringify(team.players), playerBefore, 'formation tactics do not mutate permanent player stats');

const dbBefore = fs.readFileSync(path.join(__dirname, '..', 'data', 'IE1_season_compact.json'), 'utf8');
sim.applyFormationTactics(base, '4-3-3');
assert.equal(fs.readFileSync(path.join(__dirname, '..', 'data', 'IE1_season_compact.json'), 'utf8'), dbBefore, 'database files are not mutated');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'game.css'), 'utf8');
assert(appJs.includes('data-tactic-panel'), 'squad and Boss UI render tactic panels');
assert(appJs.includes('tacticPanelMarkup(run.formationId'), 'squad UI shows selected formation identity');
assert(appJs.includes('tacticPanelMarkup(boss.bossFormation'), 'Boss UI shows opponent tactical identity');
assert(css.includes('.tactic-chip-row') && css.includes('flex-wrap: wrap'), 'mobile tactic chips wrap without horizontal overflow');
assert(css.includes('.boss-tactics-grid') && css.includes('grid-template-columns: repeat(2'), 'desktop Boss tactics use side-by-side panels');
assert(css.includes('@media (max-width: 780px)') && css.includes('.boss-tactics-grid { grid-template-columns: 1fr; }'), 'mobile Boss tactics keep one panel per row without duplicate offscreen panels');

console.log('Formation tactics test passed.');
