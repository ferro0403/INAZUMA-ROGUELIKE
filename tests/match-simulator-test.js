'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

for (const file of ['js/match-simulator-config.js', 'js/match-simulator.js']) {
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
}

const season = JSON.parse(fs.readFileSync('data/IE1_season_compact.json', 'utf8'));
const rampart = season.bossOrder[0];
const players = new Map(season.players.map((player) => [String(player.playerId), player]));
const bossPlayers = rampart.startingXIPlayerIds.map((id) => {
  const player = players.get(String(id));
  return { ...player, overall: player.finalOverall, stats: player.finalStats };
});
const userPlayers = bossPlayers.map((player) => ({ ...player, playerId: `user-${player.playerId}` }));
const seed = `regression:first-boss:${rampart.teamId}:1`;
const input = {
  type: 'eleven',
  seed,
  userTeam: { name: 'Ferro', formationId: '4-4-2', players: userPlayers },
  opponentTeam: { name: rampart.teamName, formationId: rampart.bossFormation, players: bossPlayers },
};

assert.equal(bossPlayers.length, 11, 'first Boss preview keeps all eleven configured players');
assert.deepEqual(bossPlayers.map((player) => String(player.playerId)), rampart.startingXIPlayerIds.map(String), 'first Boss lineup keeps configured order');
const preview = global.MatchSimulator.simulate(input);
assert.equal(preview.valid, true, preview.message);
assert.equal(preview.seed, seed, 'preview keeps the stable match seed');
for (const strength of [preview.userStrength, preview.opponentStrength]) {
  assert.equal(strength.valid, true);
  assert.ok(Number.isFinite(strength.final));
  for (const key of ['attack', 'control', 'defense', 'speed', 'save']) assert.ok(Number.isFinite(strength.effectiveComponents[key]), `${key} missing`);
}
assert.ok(Number.isFinite(preview.probabilities.user));
assert.ok(Number.isFinite(preview.probabilities.opponent));
const reopened = global.MatchSimulator.simulate(input);
assert.deepEqual(reopened, preview, 'refresh/re-entry does not regenerate the Boss or change the outcome seed');
assert.equal(global.MatchSimulator.validateUserTimeline(preview.timeline, input.userTeam).valid, true, 'Boss simulation timeline remains valid');

console.log('match-simulator-test: ok');
