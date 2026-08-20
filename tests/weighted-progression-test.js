const assert = require("assert");
const progression = require("../js/roguelike_progression.js");

const profiles = {
  FW: { attack: 70, control: 60, speed: 80, grit: 60, physical: 50, stamina: 60, defense: 20, save: 10 },
  MF: { attack: 60, control: 70, speed: 60, grit: 70, physical: 50, stamina: 70, defense: 50, save: 10 },
  DF: { attack: 40, control: 50, speed: 60, grit: 60, physical: 70, stamina: 60, defense: 70, save: 10 },
  GK: { attack: 10, control: 40, speed: 50, grit: 60, physical: 60, stamina: 50, defense: 50, save: 70 },
};

function grow(role, target, currentStats = profiles[role], currentOverall = 70) {
  return progression.growPlayerStatsToTargetOverall({
    role, originalStats: profiles[role], currentStats, originalOverall: 70, currentOverall, targetOverall: target,
  });
}
function calculated(role, stats) {
  return progression.calculateCanonicalOverall(stats, role, profiles[role], 70);
}

const fw80 = grow("FW", 80);
assert.equal(calculated("FW", fw80), 80);
assert(fw80.attack > profiles.FW.attack);
assert.equal(fw80.defense, profiles.FW.defense, "a weak defense must not be a shortcut");
assert(fw80.speed > fw80.defense, "the individual speed strength remains recognizable");

const fw90 = grow("FW", 90);
assert.equal(calculated("FW", fw90), 90);
assert.equal(fw90.attack, 100, "an attack rating of 10 is natural at 90+");
assert.equal(fw90.defense, profiles.FW.defense);
assert(fw90.physical >= 50, "soft bands must never block a necessary secondary-stat increase");

const alternateFw = { ...profiles.FW, attack: 60, control: 70, speed: 50, physical: 80, stamina: 70, defense: 30 };
const alternate90 = progression.growPlayerStatsToTargetOverall({ role: "FW", originalStats: alternateFw, currentStats: alternateFw, originalOverall: 70, currentOverall: 70, targetOverall: 90 });
assert.equal(progression.calculateCanonicalOverall(alternate90, "FW", alternateFw, 70), 90);
assert(alternate90.physical > fw90.physical && alternate90.control > fw90.control, "players with the same role retain different predispositions");
assert(alternate90.defense < 50, "defense is not pumped to avoid attack 10");

for (const [role, primary, excluded] of [["MF", "control", "save"], ["DF", "defense", "save"], ["GK", "save", "attack"]]) {
  const result = grow(role, 90);
  assert.equal(calculated(role, result), 90, `${role} stats must mathematically support 90`);
  assert.equal(result[excluded], profiles[role][excluded], `${role} zero-weight stat must not grow`);
  assert(result[primary] >= profiles[role][primary]);
}

const capped = { ...profiles.FW, attack: 100 };
const cappedResult = progression.growPlayerStatsToTargetOverall({ role: "FW", originalStats: capped, currentStats: capped, originalOverall: 87, currentOverall: 87, targetOverall: 90 });
assert.equal(cappedResult.attack, 100);
assert(Object.keys(cappedResult).some((stat) => stat !== "attack" && cappedResult[stat] > capped[stat]), "growth redistributes after a primary cap");

const database = { compactFormat: { levelMax: 20, statOrder: Object.keys(profiles.DF) } };
const player = { playerId: "df", position: "DF", finalOverall: 87, maxLevel: 20, ratings: Object.fromEntries(Object.keys(profiles.DF).map((stat) => [stat, profiles.DF[stat] / 10])), category: "Elite" };
const resolve = (amount) => progression.getPlayerAtLevel(player, 20, database, { potentialBoost: amount, currentOverallBoost: amount, potentialBoostApplications: amount ? [{ amount, appliedLevel: 20 }] : [] });
const before = resolve(0), once = resolve(3);
assert.equal(once.overall, 90); assert.equal(once.potential, 90);
assert.equal(progression.calculateCanonicalOverall(once.stats, "DF", before.stats, before.overall), 90);
const sequential = grow("FW", 87, grow("FW", 84, profiles.FW, 70), 84);
const sequential90 = grow("FW", 90, sequential, 87);
assert.deepEqual(sequential90, fw90, "84 → 87 → 90 is the same deterministic continuous path");

const at98 = { ...player, finalOverall: 98 };
assert.equal(progression.effectivePotential(at98, { potentialBoost: 3 }), 99);
assert.equal(progression.effectiveCurrentOverallBoost(at98, { potentialBoost: 3 }), 1);
const at99 = { ...player, finalOverall: 99 };
assert.equal(progression.effectiveCurrentOverallBoost(at99, { potentialBoost: 3 }), 0);
console.log("weighted-progression-test: canonical, profile-aware shared growth OK");
