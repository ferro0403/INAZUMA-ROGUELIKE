const assert = require("assert");
const progression = require("../js/roguelike_progression.js");

const stats = () => ({ attack: 20, control: 20, speed: 20, grit: 20, physical: 20, stamina: 20, defense: 20, save: 20 });
const delta = (before, after) => Object.fromEntries(Object.keys(before).map((stat) => [stat, after[stat] - before[stat]]));
const contribution = (role, changes) => Object.entries(changes).reduce((sum, [stat, amount]) => sum + amount * progression.ROLE_STAT_WEIGHTS[role][stat] / 100, 0);
const boosted = (role, amount, base = stats()) => progression.distributeWeightedStatBoosts(base, { position: role }, amount);

for (const amount of [3, 12]) {
  const before = stats(); const changes = delta(before, boosted("DF", amount, before));
  assert.equal(changes.save, 0); assert(changes.defense > changes.attack); assert(changes.defense > changes.control);
  assert(Math.abs(contribution("DF", changes) - amount) <= 0.5);
  if (amount === 12) assert(changes.defense >= 15);
}
for (const [role, primary, excluded] of [["GK", "save", "attack"], ["FW", "attack", "save"], ["MF", "control", "save"]]) {
  const before = stats(); const changes = delta(before, boosted(role, 3, before));
  assert.equal(changes[excluded], 0); assert.equal(changes[primary], Math.max(...Object.values(changes)));
  assert(Math.abs(contribution(role, changes) - 3) <= 0.5);
}
const capped = stats(); capped.defense = 99;
const cappedChanges = delta(capped, boosted("DF", 3, capped));
assert.equal(cappedChanges.defense, 0); assert(Object.entries(cappedChanges).some(([stat, amount]) => stat !== "defense" && amount > 0));
assert(Math.abs(contribution("DF", cappedChanges) - 3) <= 0.5);

const database = { compactFormat: { levelMax: 20, statOrder: Object.keys(stats()) } };
const player = { playerId: "df", position: "DF", finalOverall: 83, maxLevel: 20, ratings: stats(), category: "Forte" };
const resolve = (amount) => progression.getPlayerAtLevel(player, 20, database, { potentialBoost: amount, currentOverallBoost: amount, potentialBoostApplications: [{ amount, appliedLevel: 0 }] });
const before = resolve(0), once = resolve(3), twice = resolve(6), permanent = resolve(12);
assert.equal(once.overall, before.overall + 3); assert.equal(once.potential, before.potential + 3); assert.notDeepEqual(once.stats, before.stats); assert.equal(once.stats.save, before.stats.save);
assert.equal(twice.overall, before.overall + 6); assert.equal(twice.potential, before.potential + 6);
assert.equal(permanent.potential, 95); assert.equal(permanent.category, "Leggenda"); assert(permanent.stats.defense - before.stats.defense >= 15); assert.equal(permanent.stats.save, before.stats.save);
const at98 = { ...player, finalOverall: 98 }; assert.equal(progression.effectivePotential(at98, { potentialBoost: 3 }), 99);
const at99 = { ...player, finalOverall: 99 }; assert.equal(progression.effectivePotential(at99, { potentialBoost: 3 }), 99); assert.equal(progression.effectiveCurrentOverallBoost(at99, { potentialBoost: 3 }), 0);
console.log("weighted-progression-test: role weights, caps, intensive and permanent boosts OK");
