'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const simulatorContext = { console };
simulatorContext.globalThis = simulatorContext;
vm.runInNewContext(fs.readFileSync('js/match-simulator-config.js', 'utf8'), simulatorContext);
vm.runInNewContext(fs.readFileSync('js/match-simulator.js', 'utf8'), simulatorContext);

function functionSource(name, nextName) {
  const start = app.indexOf(`  function ${name}`);
  const end = app.indexOf(`  function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} source must exist`);
  return app.slice(start, end);
}

const players = (count, prefix) => Array.from({ length: count }, (_, index) => ({
  playerId: `${prefix}-${index}`,
  name: `${prefix} ${index}`,
  position: index === 0 ? 'GK' : index < 5 ? 'DF' : index < 8 ? 'MF' : 'FW',
  overall: 60 + index,
  attack: 55 + index,
  control: 56 + index,
  defense: 57 + index,
  save: index === 0 ? 75 : 20,
  speed: 58 + index,
  physical: 59 + index,
  stamina: 60 + index,
  grit: 50 + index,
}));
const userPlayers = players(11, 'user');
const opponentPlayers = players(11, 'opponent');
const teamsFixture = {
  type: 'eleven',
  userTeam: { name: 'User', formationId: '4-4-2', players: userPlayers },
  opponentTeam: { name: 'Opponent', formationId: '4-4-2', players: opponentPlayers },
  userSnapshot: {
    name: 'User',
    playerIds: userPlayers.map((player) => player.playerId),
    lineupSignature: userPlayers.map((player) => player.playerId).join('|'),
    players: userPlayers,
  },
};

const simulationSeeds = [];
const lifecycleContext = {
  console,
  run: { runId: 'run123', consecutiveLosses: 0 },
  teamsFixture,
  global: {
    MatchSimulator: {
      simulate(input) {
        simulationSeeds.push(input.seed);
        return simulatorContext.MatchSimulator.simulate(input);
      },
    },
    RunStatistics: { createStableMatchId: (_run, match) => `${match.nodeId}::${match.attemptNumber}::${match.simulation.seed}` },
  },
};
vm.createContext(lifecycleContext);
vm.runInContext(`
  function simulationTeamsForCurrentMatch() { return teamsFixture; }
  ${functionSource('matchSeed', 'normalizedMatchPlayer')}
  ${functionSource('ensureMatchPreview', 'simulationScoreArray')}
  this.matchSeed = matchSeed;
  this.ensureMatchPreview = ensureMatchPreview;
`, lifecycleContext);

const first = { type: 'boss', nodeId: 'zone_1_boss', attemptNumber: 1, state: 'pre-match' };
const preview = lifecycleContext.ensureMatchPreview(first);
assert.strictEqual(simulationSeeds.at(-1), 'run123:boss:zone_1_boss:preview', 'preview uses its non-attempt seed');
assert.strictEqual(preview.seed, null, 'a preview does not persist/freeze its simulator seed');

const realFirst = lifecycleContext.ensureMatchPreview(first, { freeze: true });
assert.strictEqual(simulationSeeds.at(-1), 'run123:boss:zone_1_boss:1', 'freeze must run the simulator with attempt 1 seed');
assert.strictEqual(realFirst.seed, 'run123:boss:zone_1_boss:1');
assert.notStrictEqual(realFirst, preview, 'the real match must not reuse the preview object');

realFirst.state = 'simulating';
const persisted = JSON.parse(JSON.stringify(first));
const callsBeforeResume = simulationSeeds.length;
const resumed = lifecycleContext.ensureMatchPreview(persisted, { freeze: true });
assert.strictEqual(simulationSeeds.length, callsBeforeResume, 'an already-started persisted attempt must not be simulated again');
assert.strictEqual(resumed.seed, realFirst.seed, 'refresh keeps the same real seed');
assert.deepStrictEqual(JSON.parse(JSON.stringify(resumed.score)), JSON.parse(JSON.stringify(realFirst.score)), 'refresh keeps the same score');
assert.deepStrictEqual(JSON.parse(JSON.stringify(resumed.timeline)), JSON.parse(JSON.stringify(realFirst.timeline)), 'refresh keeps the same timeline');

const second = { type: 'boss', nodeId: first.nodeId, attemptNumber: 2, state: 'pre-match' };
lifecycleContext.run.consecutiveLosses = 1;
lifecycleContext.ensureMatchPreview(second);
const realSecond = lifecycleContext.ensureMatchPreview(second, { freeze: true });
assert.strictEqual(realSecond.seed, 'run123:boss:zone_1_boss:2');
assert.notStrictEqual(realSecond.seed, realFirst.seed, 'a retry gets a distinct attempt seed');
assert.ok(realSecond.probabilities.userChance > realFirst.probabilities.userChance, 'loss protection changes probability independently of the seed');

// Boss and 5v5 derive the next attempt from completed, processed match IDs.
const processed = {
  'run123::same-node::boss::1::seed-1': {},
  'run123::same-node::boss::2::seed-2': {},
  'run123::same-node::five_v_five::1::seed-1': {},
  'run123::same-node::five_v_five::2::seed-2': {},
};
const nextAttempt = (type) => Object.keys(processed).filter((id) => id.includes(`::same-node::${type}::`)).length + 1;
assert.strictEqual(nextAttempt('boss'), 3, 'boss retry reaches attempt 3');
assert.strictEqual(nextAttempt('five_v_five'), 3, '5v5 retry reaches attempt 3');
assert.match(functionSource('bossMatchFromNode', 'recoverInterruptedBossAccess'), /processedMatchIds[\s\S]*length \+ 1/, 'boss production flow counts processed attempts');
assert.match(functionSource('createOrLoadFiveMatch', 'fiveOpponentPlayersBySlot'), /processedMatchIds[\s\S]*length \+ 1/, '5v5 production flow counts processed attempts');

// Special matches persist their own counter when each new match snapshot is created.
const specialContext = {
  console,
  InazumaProgression: { getPlayerAtLevel: (player) => ({ ...player }) },
  ProfiledSeasonRuntime: {
    resolveProfile: (_seasonId, profileId) => ({ profileId, playerId: profileId, defaultRoleVariantId: 'base', roleVariants: [{ roleVariantId: 'base' }] }),
  },
};
specialContext.globalThis = specialContext;
vm.runInNewContext(fs.readFileSync('js/special-match.js', 'utf8'), specialContext);
const special = { specialMatchId: 'special-1', teamId: 'team-1', matchLevel: 1, matchFormation: '4-4-2', startingXIProfileIds: Array.from({ length: 11 }, (_, i) => `sp-${i}`) };
const database = { seasonId: 'ie1', specialMatches: [special], players: [] };
const specialRun = { runId: 'run123', specialMatchAttempts: {}, currentZone: { currentNodeId: 'previous' } };
const specialNode = { id: 'same-special-node', type: 'special_match', specialMatchId: special.specialMatchId };
const specialAttempts = [1, 2, 3].map(() => specialContext.SpecialMatchRuntime.fromNode(specialRun, database, specialNode).attemptNumber);
assert.deepStrictEqual(Array.from(specialAttempts), [1, 2, 3], 'special match retries increment their persisted counter');

const fingerprint = (sim) => JSON.stringify({ winner: sim.winner, score: sim.score, timeline: sim.timeline.map(({ minute, type, team, playerId }) => ({ minute, type, team, playerId })) });
const seeds = new Set();
const fingerprints = new Set();
for (let attemptNumber = 1; attemptNumber <= 100; attemptNumber += 1) {
  const seed = `run123:boss:zone_1_boss:${attemptNumber}`;
  seeds.add(seed);
  const input = { type: 'eleven', seed, userTeam: teamsFixture.userTeam, opponentTeam: teamsFixture.opponentTeam, consecutiveLosses: 0 };
  const one = simulatorContext.MatchSimulator.simulate(input);
  const again = simulatorContext.MatchSimulator.simulate(input);
  assert.strictEqual(fingerprint(one), fingerprint(again), `attempt ${attemptNumber} is deterministic`);
  fingerprints.add(fingerprint(one));
}
assert.strictEqual(seeds.size, 100, '100 virtual attempts have distinct seeds');
assert.ok(fingerprints.size > 1, 'distinct attempt seeds do not force one repeated RNG sequence');

console.log('match-retry-seed-regression-test: ok');
