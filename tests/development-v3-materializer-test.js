"use strict";

const assert = require("assert");
const progression = require("../js/roguelike_progression.js");
const DevelopmentV3 = require("../js/development-v3.js");

const database = { compactFormat: { levelMax: 20, codeWidth: 2, statOrder: [...DevelopmentV3.STAT_ORDER] } };
const ratings = {
  GK: { attack: 1, control: 5, speed: 4, grit: 6, physical: 6, stamina: 4, defense: 6, save: 7 },
  DF: { attack: 4, control: 6, speed: 6, grit: 7, physical: 7, stamina: 6, defense: 7, save: 1 },
  MF: { attack: 6, control: 7, speed: 7, grit: 7, physical: 6, stamina: 7, defense: 6, save: 1 },
  FW: { attack: 7, control: 6, speed: 7, grit: 6, physical: 6, stamina: 6, defense: 3, save: 1 },
};
const cases = [
  ["GK", 70, 75],
  ["DF", 72, 80],
  ["MF", 74, 85],
  ["FW", 74, 90],
  ["FW", 74, 95],
];

function player(role, finalOverall, suffix) {
  return {
    playerId: `${role.toLowerCase()}-${suffix}`,
    id: `${role.toLowerCase()}-${suffix}`,
    name: `Fixture ${role}`,
    portraitUrl: `https://example.invalid/${role}.png`,
    frontFullbodyUrl: `https://example.invalid/${role}-full.png`,
    description: "immutable database metadata",
    position: role,
    normalizedRole: role,
    element: "Wind",
    teams: ["Fixture"],
    category: progression.categoryForPotential(finalOverall),
    maxLevel: 20,
    finalOverall,
    ratings: ratings[role],
  };
}

function optionsFor(basePlayer, target) {
  const amount = target - basePlayer.finalOverall;
  return { potentialBoost: amount, currentOverallBoost: amount, potentialBoostApplications: [{ amount, appliedLevel: 0, permanent: true }] };
}

function gameplayOutput(resolved) {
  return {
    level: resolved.level,
    overall: resolved.overall,
    potential: resolved.potential,
    category: resolved.category,
    stats: Object.fromEntries(DevelopmentV3.STAT_ORDER.map((stat) => [stat, resolved.stats[stat]])),
    topLevelStats: Object.fromEntries(DevelopmentV3.STAT_ORDER.map((stat) => [stat, resolved[stat]])),
  };
}

for (const [role, baseOverall, target] of cases) {
  const basePlayer = player(role, baseOverall, target);
  const expected = Array.from({ length: 21 }, (_, level) => progression.getPlayerAtLevel(basePlayer, level, database, optionsFor(basePlayer, target)));
  const profile = DevelopmentV3.materializeProfile({ basePlayer, targetPotential: target, database, progression });
  const again = DevelopmentV3.materializeProfile({ basePlayer, targetPotential: target, database, progression });
  assert.equal(JSON.stringify(profile), JSON.stringify(again), `${role}/${target}: deterministic materialization`);
  assert.equal(profile.category, progression.categoryForPotential(target));
  for (let level = 0; level <= 20; level += 1) {
    assert.deepStrictEqual(gameplayOutput(DevelopmentV3.resolveMaterializedPlayer(basePlayer, profile, level)), gameplayOutput(expected[level]), `${role}/${target}/Lv${level}: exact gameplay parity`);
  }
  for (const forbidden of ["playerId", "id", "name", "portraitUrl", "frontFullbodyUrl", "description", "element", "position", "teams", "ratings"]) {
    assert(!Object.prototype.hasOwnProperty.call(profile, forbidden), `profile does not duplicate ${forbidden}`);
    assert(!JSON.stringify(profile.progressionCode).includes(basePlayer[forbidden]), `progression code does not duplicate ${forbidden}`);
  }
}

// Resolution is a decoder only: disable every production progression entry
// point after materialization and prove all 21 levels remain available.
{
  const basePlayer = player("GK", 70, "zero-solver");
  const profile = DevelopmentV3.materializeProfile({ basePlayer, targetPotential: 95, database, progression });
  const expected = Array.from({ length: 21 }, (_, level) => gameplayOutput(DevelopmentV3.resolveMaterializedPlayer(basePlayer, profile, level)));
  const originalGet = progression.getPlayerAtLevel;
  const originalGrow = progression.growPlayerStatsToTargetOverall;
  progression.getPlayerAtLevel = progression.growPlayerStatsToTargetOverall = () => { throw new Error("solver must not run"); };
  try {
    for (let level = 0; level <= 20; level += 1) assert.deepStrictEqual(gameplayOutput(DevelopmentV3.resolveMaterializedPlayer(basePlayer, profile, level)), expected[level]);
  } finally {
    progression.getPlayerAtLevel = originalGet;
    progression.growPlayerStatsToTargetOverall = originalGrow;
  }
}

// The pure schema layer neither reads nor writes storage and never manufactures
// timestamps. BASE is represented by a player chain with zero stored steps.
{
  const previous = global.localStorage;
  global.localStorage = new Proxy({}, { get() { throw new Error("V3 touched storage"); }, set() { throw new Error("V3 touched storage"); } });
  try {
    const raw = { coins: 12, players: { adam: { steps: [] } } };
    const before = JSON.stringify(raw);
    const first = DevelopmentV3.normalize(raw);
    const second = DevelopmentV3.normalize(raw);
    assert.equal(JSON.stringify(raw), before, "normalization does not mutate its input");
    assert.deepStrictEqual(first, second, "normalization is deterministic");
    assert.deepStrictEqual(first.players.adam, { steps: [] });
    assert(!JSON.stringify(first).includes("createdAt"));
  } finally {
    if (previous === undefined) delete global.localStorage;
    else global.localStorage = previous;
  }
}

{
  const malformed = DevelopmentV3.empty();
  malformed.players.adam = { steps: [{ stepId: "bad", rarity: "Normale", fromPotential: 69, toPotential: 70, profile: {}, receipt: {} }] };
  assert.equal(DevelopmentV3.validate(malformed).valid, false, "malformed/uncolored stored step is rejected");
  assert.throws(() => DevelopmentV3.resolveMaterializedPlayer(player("FW", 74, "bad"), {}, 0), /Invalid Development V3 profile/);
}

{
  const basePlayer = player("MF", 74, "bounds");
  const profile = DevelopmentV3.materializeProfile({ basePlayer, targetPotential: 85, database, progression });
  assert.deepStrictEqual(gameplayOutput(DevelopmentV3.resolveMaterializedPlayer(basePlayer, profile, -100)), gameplayOutput(DevelopmentV3.resolveMaterializedPlayer(basePlayer, profile, 0)));
  assert.deepStrictEqual(gameplayOutput(DevelopmentV3.resolveMaterializedPlayer(basePlayer, profile, 100)), gameplayOutput(DevelopmentV3.resolveMaterializedPlayer(basePlayer, profile, 20)));
  assert.deepStrictEqual(gameplayOutput(DevelopmentV3.resolveMaterializedPlayer(basePlayer, profile, 1.6)), gameplayOutput(DevelopmentV3.resolveMaterializedPlayer(basePlayer, profile, 2)));
  assert.throws(() => DevelopmentV3.materializeProfile({ basePlayer, targetPotential: 85, database, maxLevel: 19, progression }), /requires maxLevel 20/);

  const state = DevelopmentV3.empty();
  state.players[basePlayer.playerId] = { steps: [{
    stepId: "mf-buono-1",
    rarity: "Buono",
    fromRarity: "Normale",
    fromPotential: 74,
    toPotential: 85,
    profile,
    receipt: { coinsConsumed: 200, cupsConsumed: 2, cupsConsumedBySource: { ie1: 1, ie1_s2: 1 }, projectsConsumed: 1 },
  }] };
  assert.deepStrictEqual(DevelopmentV3.validate(state), { valid: true, errors: [] });
  for (const forbidden of ["name", "portraitUrl", "frontFullbodyUrl", "description", "element", "position", "teams"]) {
    assert(!Object.prototype.hasOwnProperty.call(state.players[basePlayer.playerId].steps[0], forbidden), `step does not duplicate ${forbidden}`);
  }
}

console.log("development-v3-materializer-test: exact Lv0..20 parity and zero-solver decoding OK");
