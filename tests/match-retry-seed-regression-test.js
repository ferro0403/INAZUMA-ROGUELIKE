'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const previewSource = app.slice(app.indexOf('function ensureMatchPreview'), app.indexOf('function simulationScoreArray'));
const startSource = app.slice(app.indexOf('function startMatchSimulation'), app.indexOf('function resumeMatchSimulationIfNeeded'));

// Regression: before this guard existed, freeze:true returned the already valid
// :preview simulation whenever the lineup signature had not changed.
assert.match(previewSource, /if \(!options\.freeze && match\.simulation\?\.valid && existingState === "pre-match"/, 'freezing must bypass the disposable preview shortcut');
assert.match(previewSource, /const seed = options\.freeze \? matchSeed\(match\)/, 'a frozen simulation must use the attempt seed');
assert.match(startSource, /frozenMatch = cloneMatchState\(match\)/, 'starting a match must isolate the uncommitted simulation from live state');
assert.match(startSource, /ensureMatchPreview\(frozenMatch, \{ \.\.\.options, forceRefresh: false, freeze: true \}\)/, 'starting a match must freeze an attempt-specific simulation');
assert.match(startSource, /commitMatchMutation\("match-simulation-start"/, 'the frozen simulation becomes authoritative only through the canonical transaction');
assert.match(app, /return `\$\{run\.runId\}:\$\{match\.type\}:\$\{match\.nodeId\}:\$\{match\.attemptNumber \|\| 1\}`/, 'the real seed must contain attemptNumber');

// Boss and 5v5 attempts are reconstructed from completed, processed matches.
const bossFactory = app.slice(app.indexOf('function bossMatchFromNode'), app.indexOf('function recoverInterruptedBossAccess'));
const fiveFactory = app.slice(app.indexOf('function createOrLoadFiveMatch'), app.indexOf('function fiveOpponentPlayersBySlot'));
assert.match(bossFactory, /processedMatchIds[\s\S]*::\$\{node\.id\}::boss::[\s\S]*length \+ 1/, 'boss retries must advance their attempt number');
assert.match(fiveFactory, /processedMatchIds[\s\S]*::\$\{node\.id\}::five_v_five::[\s\S]*length \+ 1/, '5v5 retries must advance their attempt number');

function processedIds(runId, nodeId, type, count) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [`${runId}::${nodeId}::${type}::${index + 1}::seed-${index + 1}`, true]));
}
function processedAttempt(ids, nodeId, type) {
  return Object.keys(ids).filter((id) => id.includes(`::${nodeId}::${type}::`)).length + 1;
}
for (const type of ['boss', 'five_v_five']) {
  assert.strictEqual(processedAttempt(processedIds('run123', 'node', type, 0), 'node', type), 1);
  assert.strictEqual(processedAttempt(processedIds('run123', 'node', type, 1), 'node', type), 2);
  assert.strictEqual(processedAttempt(processedIds('run123', 'node', type, 2), 'node', type), 3);
}

// Exercise the special-match runtime itself: it owns its persistent counter.
const specialContext = {
  console,
  InazumaProgression: { getPlayerAtLevel: (player) => ({ ...player }) },
  ProfiledSeasonRuntime: { resolveProfile: (_season, profileId) => ({ profileId, playerId: profileId, defaultRoleVariantId: null, roleVariants: [] }) },
};
specialContext.globalThis = specialContext;
vm.runInNewContext(fs.readFileSync('js/special-match.js', 'utf8'), specialContext);
const special = { specialMatchId: 'special-1', teamId: 'team-1', matchLevel: 1, matchFormation: '4-3-3', startingXIProfileIds: Array.from({ length: 11 }, (_, i) => `p${i}`), startingXIPlayerIds: Array.from({ length: 11 }, (_, i) => `p${i}`) };
const database = { seasonId: 'ie1', specialMatches: [special], players: [] };
const specialRun = { runId: 'run123', specialMatchAttempts: {}, currentZone: { currentNodeId: 'start' } };
const specialNode = { id: 'special-node', type: 'special_match', specialMatchId: 'special-1' };
assert.deepStrictEqual([1, 2, 3].map(() => specialContext.SpecialMatchRuntime.fromNode(specialRun, database, specialNode).attemptNumber), [1, 2, 3]);

const simulatorContext = { console };
simulatorContext.globalThis = simulatorContext;
vm.runInNewContext(fs.readFileSync('js/match-simulator-config.js', 'utf8'), simulatorContext);
vm.runInNewContext(fs.readFileSync('js/match-simulator.js', 'utf8'), simulatorContext);
const { simulate, applyConsecutiveLossProtection } = simulatorContext.MatchSimulator;
const roles = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'];
const team = (prefix, delta = 0) => ({ name: prefix, formationId: '4-3-3', players: roles.map((position, i) => ({ playerId: `${prefix}-${i}`, name: `${prefix} ${i}`, position, overall: 60 + delta, attack: 60 + delta, control: 60 + delta, speed: 60 + delta, grit: 60 + delta, physical: 60 + delta, stamina: 60 + delta, defense: 60 + delta, save: position === 'GK' ? 60 + delta : 0 })) });
const userTeam = team('user');
const opponentTeam = team('opponent', 2);
const fingerprint = (simulation) => JSON.stringify({ winner: simulation.winner, score: simulation.score, timeline: simulation.timeline.map(({ minute, type, team: side, playerId }) => [minute, type, side, playerId]) });
const realSeed = (type, attempt) => `run123:${type}:node:${attempt}`;

for (const type of ['boss', 'five_v_five', 'special_match']) {
  assert.notStrictEqual(`run123:${type}:node:preview`, realSeed(type, 1), `${type}: preview and attempt one seeds must differ`);
  assert.notStrictEqual(realSeed(type, 1), realSeed(type, 2), `${type}: retry seed must differ`);
}

// Refresh/resume is anti-reroll: persisted inputs reproduce the exact simulation.
const seed = realSeed('boss', 1);
const first = simulate({ type: 'eleven', seed, userTeam, opponentTeam, consecutiveLosses: 0 });
const restored = simulate({ type: 'eleven', seed: first.seed, userTeam, opponentTeam, consecutiveLosses: 0 });
assert.strictEqual(fingerprint(restored), fingerprint(first), 'same persisted attempt must keep score and timeline');

// Loss protection changes only probability; attemptNumber changes the RNG seed.
const retry = simulate({ type: 'eleven', seed: realSeed('boss', 2), userTeam, opponentTeam, consecutiveLosses: 1 });
assert.strictEqual(first.probabilities.userChance, applyConsecutiveLossProtection(first.probabilities.baseUserChance, 0));
assert.strictEqual(retry.probabilities.userChance, applyConsecutiveLossProtection(retry.probabilities.baseUserChance, 1));
assert.ok(retry.probabilities.userChance > first.probabilities.userChance, 'one loss must retain the existing probability protection');
assert.notStrictEqual(retry.seed, first.seed, 'probability protection must not reuse the previous attempt seed');

// Statistical regression: seeds are unique, every seed is deterministic, and the
// attempt series is not pinned to a single RNG sequence/fingerprint.
const seeds = new Set();
const fingerprints = new Set();
for (let attempt = 1; attempt <= 100; attempt += 1) {
  const attemptSeed = realSeed('boss', attempt);
  const a = simulate({ type: 'eleven', seed: attemptSeed, userTeam, opponentTeam, consecutiveLosses: 0 });
  const b = simulate({ type: 'eleven', seed: attemptSeed, userTeam, opponentTeam, consecutiveLosses: 0 });
  seeds.add(attemptSeed);
  fingerprints.add(fingerprint(a));
  assert.strictEqual(fingerprint(a), fingerprint(b), `attempt ${attempt} must be deterministic`);
}
assert.strictEqual(seeds.size, 100, '100 attempts must have 100 distinct seeds');
assert.ok(fingerprints.size > 1, 'different attempts must produce more than one simulation fingerprint');

console.log('match-retry-seed-regression-test: preview isolation, retries, refresh and all match types OK');
