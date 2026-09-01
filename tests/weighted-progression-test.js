const assert = require("assert");
const progression = require("../js/roguelike_progression.js");

const ratings = {
  FW: { attack: 8, control: 7, speed: 8, grit: 7, physical: 7, stamina: 7, defense: 2, save: 1 },
  MF: { attack: 7, control: 8, speed: 7, grit: 7, physical: 6, stamina: 8, defense: 6, save: 1 },
  DF: { attack: 4, control: 6, speed: 7, grit: 7, physical: 8, stamina: 7, defense: 8, save: 1 },
  GK: { attack: 1, control: 6, speed: 6, grit: 7, physical: 7, stamina: 6, defense: 7, save: 8 },
};
const internal = (profile) => Object.fromEntries(Object.entries(profile).map(([stat, value]) => [stat, value * 10]));
const grow = (role, target, profile = ratings[role]) => progression.findBestCodexGrowthProfile({ role, originalRatings: profile, currentRatings: profile, targetOverall: target });

assert.equal(progression.overallForRole("FW", ratings.FW), Math.round(30 + (((8*.5+7*.12+8*.1+7*.08+7*.1+7*.08+2*.02)-1)*69/9)));
for (const [role, primary, excluded] of [["FW","attack","save"],["MF","control","save"],["DF","defense","save"],["GK","save","attack"]]) {
  for (const target of [90, 95]) {
    const result = grow(role, target);
    assert.equal(progression.overallForRole(role, result), target, `${role} reaches an exact ${target}`);
    assert.equal(result[primary] >= (target === 95 ? 10 : 9), true, `${role} primary minimum at ${target}`);
    assert.equal(result[excluded], ratings[role][excluded], `${role} zero-weight stat cannot grow`);
    Object.values(result).forEach((value) => assert(Number.isInteger(value) && value >= 1 && value <= 10));
  }
}

const fw85 = grow("FW", 85);
assert.equal(progression.overallForRole("FW", fw85), 85);
const internal85 = progression.growPlayerStatsToTargetOverall({ role:"FW", originalStats:internal(ratings.FW), currentStats:internal(ratings.FW), currentOverall:83, targetOverall:85 });
Object.values(internal85).forEach((value) => assert.equal(value % 10, 0, "internal growth represents whole Codex units"));
assert.equal(progression.overallForRole("FW", internal85), 85);

const fast = { ...ratings.FW, speed: 9, physical: 6 };
const strong = { ...ratings.FW, speed: 6, physical: 9 };
const fast90 = grow("FW", 90, fast), strong90 = grow("FW", 90, strong);
assert(fast90.speed > fast90.physical, "fast FW retains speed identity");
assert(strong90.physical > strong90.speed, "physical FW retains physical identity");
assert(fast90.defense < 7 && strong90.defense < 7, "weak defense is not used as a shortcut");

const database = { compactFormat: { levelMax: 20, statOrder: Object.keys(ratings.DF) } };
const player = { playerId:"df", position:"DF", finalOverall:87, maxLevel:20, ratings:ratings.DF, category:"Elite" };
const boosted = progression.getPlayerAtLevel(player, 20, database, { potentialBoost:3, currentOverallBoost:3, potentialBoostApplications:[{amount:3,appliedLevel:20}] });
assert.equal(boosted.overall, 90); assert.equal(boosted.potential, 90);
assert.equal(progression.overallForRole("DF", boosted.stats), 90);
assert.equal(progression.effectiveCurrentOverallBoost({ ...player, finalOverall:98 }, { potentialBoost:3 }), 1);
console.log("weighted-progression-test: exact integer InaCodex growth OK");
