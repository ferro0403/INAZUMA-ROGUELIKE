const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const progression = require("../js/roguelike_progression.js");
const { analyzeLegacyProgression } = require("../scripts/analyze-legacy-progression.js");

const STAT_ORDER = ["attack", "control", "speed", "grit", "physical", "stamina", "defense", "save"];
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const ie1 = read("data/IE1_season_compact.json");
const freeAgents = read("data/FREE_AGENTS_compact.json");
const ares = read("data/IE2_season_compact.json");
const ie1s2 = read("data/IE1_S2_season_compact.json");
const analysis = analyzeLegacyProgression();

assert.strictEqual(analysis.trainPlayers, 1376);
assert.strictEqual(analysis.holdoutPlayers, 345);
for (const sample of [analysis.train, analysis.holdout, analysis.full]) {
  assert(sample.newMAE < sample.oldMAE, "calibrated curve must beat the 60% baseline MAE");
  assert(sample.newMaxError < sample.oldMaxError, "calibrated curve must beat the 60% baseline maximum error");
  assert(sample.newMAE <= 0.35, `calibrated MAE ${sample.newMAE} exceeds target`);
  assert(sample.newMaxError <= 2, `calibrated maximum error ${sample.newMaxError} exceeds target`);
}
assert(analysis.full.newLevel0MAE < analysis.full.oldLevel0MAE);
assert(analysis.full.newLevel0MAE <= 0.35);
assert(analysis.full.newLevel0MaxError <= 2);

function decodedStats(player, database, level) {
  const { statOrder, codeWidth, levelMax } = database.compactFormat;
  return Object.fromEntries(statOrder.map((stat, statIndex) => {
    const offset = (statIndex * (levelMax + 1) + level) * codeWidth;
    return [stat, parseInt(player.progressionCode.slice(offset, offset + codeWidth), 36)];
  }));
}

let legacyValues = 0;
let dynamicMismatch = 0;
let dynamicAbsoluteError = 0;
for (const database of [ie1, freeAgents]) {
  for (const player of database.players.filter((item) => typeof item.progressionCode === "string")) {
    for (let level = 0; level <= 20; level += 1) {
      const expected = decodedStats(player, database, level);
      const resolved = progression.getPlayerAtLevel(player, level, database);
      assert.deepStrictEqual(resolved.stats, expected, `${player.name} legacy level ${level}`);

      const ratingsOnly = { ...player, progressionCode: undefined, ratings: Object.fromEntries(STAT_ORDER.map((stat) => [stat, player.finalStats[stat] / 10])) };
      const dynamic = progression.getPlayerAtLevel(ratingsOnly, level, database).stats;
      for (const stat of STAT_ORDER) {
        legacyValues += 1;
        const error = Math.abs(dynamic[stat] - expected[stat]);
        dynamicAbsoluteError += error;
        if (error) dynamicMismatch += 1;
      }
    }
  }
}

function assertEndpoint(player, database, label = player.name) {
  const resolved = progression.getPlayerAtLevel(player, 20, database);
  for (const stat of STAT_ORDER) {
    assert.strictEqual(resolved.stats[stat], player.ratings[stat] * 10, `${label} ${stat}`);
    assert(Number.isInteger(resolved.stats[stat]));
    assert(resolved.stats[stat] >= 10 && resolved.stats[stat] <= 100);
  }
  return resolved;
}

for (const player of ares.players.filter((item) => item.ratings)) assertEndpoint(player, ares, `Ares ${player.name}`);
for (const player of ie1s2.players.filter((item) => item.ratings)) assertEndpoint(player, ie1s2, `IE1 S2 canonical ${player.name}`);
for (const profile of ie1s2.profiles) {
  if (profile.ratings) assertEndpoint(profile, ie1s2, `profile ${profile.profileId}`);
  for (const variant of profile.roleVariants || []) {
    if (variant.ratings) assertEndpoint(variant, ie1s2, `variant ${profile.profileId}/${variant.roleVariantId}`);
  }
}

const diam = ie1s2.players.find((player) => player.name === "Diam");
assert.deepStrictEqual(assertEndpoint(diam, ie1s2).stats, { attack: 70, control: 80, speed: 80, grit: 60, physical: 70, stamina: 70, defense: 20, save: 10 });
const acker = ares.players.find((player) => player.name === "Acker Reese");
assert.deepStrictEqual(assertEndpoint(acker, ares).stats, { attack: 40, control: 100, speed: 80, grit: 80, physical: 90, stamina: 90, defense: 90, save: 10 });
const snapshot = (player, database) => [0, 5, 10, 15, 20].map((level) => progression.getPlayerAtLevel(player, level, database).stats);
assert.deepStrictEqual(snapshot(diam, ie1s2), [
  { attack: 44, control: 50, speed: 50, grit: 38, physical: 44, stamina: 44, defense: 13, save: 6 },
  { attack: 51, control: 58, speed: 58, grit: 44, physical: 51, stamina: 51, defense: 15, save: 7 },
  { attack: 57, control: 65, speed: 65, grit: 49, physical: 57, stamina: 57, defense: 17, save: 8 },
  { attack: 64, control: 73, speed: 73, grit: 55, physical: 64, stamina: 64, defense: 18, save: 9 },
  { attack: 70, control: 80, speed: 80, grit: 60, physical: 70, stamina: 70, defense: 20, save: 10 },
]);
assert.deepStrictEqual(snapshot(acker, ares), [
  { attack: 28, control: 70, speed: 56, grit: 56, physical: 63, stamina: 63, defense: 63, save: 6 },
  { attack: 31, control: 78, speed: 62, grit: 62, physical: 70, stamina: 70, defense: 70, save: 7 },
  { attack: 34, control: 85, speed: 68, grit: 68, physical: 77, stamina: 77, defense: 77, save: 8 },
  { attack: 37, control: 93, speed: 74, grit: 74, physical: 83, stamina: 83, defense: 83, save: 9 },
  { attack: 40, control: 100, speed: 80, grit: 80, physical: 90, stamina: 90, defense: 90, save: 10 },
]);
const apollo = ie1.players.find((player) => player.name === "Apollo Light");
assert(apollo && typeof apollo.progressionCode === "string");
assert.deepStrictEqual(progression.getPlayerAtLevel(apollo, 20, ie1).stats, { attack: 60, control: 70, speed: 80, grit: 80, physical: 80, stamina: 80, defense: 90, save: 10 });

for (const [name, stat] of [["Mark Evans", "save"], ["Nathan Swift", "speed"]]) {
  const player = ie1.players.find((item) => item.name === name);
  const actual = decodedStats(player, ie1, 0)[stat];
  const ratingsOnly = { ...player, progressionCode: undefined, ratings: Object.fromEntries(STAT_ORDER.map((key) => [key, player.finalStats[key] / 10])) };
  const estimated = progression.getPlayerAtLevel(ratingsOnly, 0, ie1).stats[stat];
  assert.strictEqual(player.finalStats[stat], 100);
  assert(Math.abs(estimated - actual) <= 2, `${name} level-0 ${stat} sentinel`);
}

for (const player of [acker, diam, ...ares.players.filter((item) => item.ratings).slice(0, 8)]) {
  let previous = null;
  for (let level = 0; level <= 20; level += 1) {
    const resolved = progression.getPlayerAtLevel(player, level, player === diam ? ie1s2 : ares);
    if (previous) {
      assert.strictEqual(resolved.overall, previous.overall + 1);
      for (const stat of STAT_ORDER) assert(resolved.stats[stat] >= previous.stats[stat]);
    }
    previous = resolved;
  }
  assert.deepStrictEqual(progression.getPlayerAtLevel(player, -10, ares).stats, progression.getPlayerAtLevel(player, 0, ares).stats);
  assert.deepStrictEqual(progression.getPlayerAtLevel(player, 99, ares).stats, progression.getPlayerAtLevel(player, 20, ares).stats);
}

assert.throws(() => progression.getPlayerAtLevel({ finalOverall: 70, ratings: { attack: 7 } }, 20, {}), /Invalid InaCodex rating/);

const context = { console, globalThis: null };
context.globalThis = context;
context.InazumaProgression = progression;
vm.runInNewContext(fs.readFileSync("js/profiled-season.js", "utf8"), context, { filename: "js/profiled-season.js" });
context.ProfiledSeasonRuntime.register("ie1_s2", ie1s2);
const switchable = ie1s2.profiles.find((profile) => profile.roleVariants?.length > 1 && profile.roleVariants.some((variant, index, variants) => index && JSON.stringify(variant.ratings) !== JSON.stringify(variants[0].ratings)));
assert(switchable, "expected a profile with distinct role variants");
const rawBefore = JSON.stringify(switchable);
const runPlayer = { playerId: switchable.playerId, activeProfileId: switchable.profileId, activeRoleVariantId: switchable.roleVariants[0].roleVariantId, level: 10 };
const first = context.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(runPlayer, { seasonId: "ie1_s2", database: ie1s2 });
runPlayer.activeRoleVariantId = switchable.roleVariants[1].roleVariantId;
const second = context.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(runPlayer, { seasonId: "ie1_s2", database: ie1s2 });
assert.notDeepStrictEqual(first.stats, second.stats, "role switch must resolve the active variant without stale stats");
assert.strictEqual(JSON.stringify(switchable), rawBefore, "profile resolution must not mutate raw data");

for (const [profileId, firstVariant, secondVariant] of [
  ["1070@epsilon_plus", "gk", "fw"],
  ["1162@alpine_ie2", "df", "fw"],
]) {
  const profile = ie1s2.profiles.find((item) => item.profileId === profileId);
  const resolve = (activeRoleVariantId) => context.ProfiledSeasonRuntime.resolveEffectivePlayerAtLevel(
    { playerId: profile.playerId, activeProfileId: profileId, activeRoleVariantId, level: 10 },
    { seasonId: "ie1_s2", database: ie1s2 }
  );
  assert.notDeepStrictEqual(resolve(firstVariant).stats, resolve(secondVariant).stats, `${profile.name} variants must differ at level 10`);
}

const mismatchPercent = (dynamicMismatch * 100 / legacyValues).toFixed(2);
const meanAbsoluteError = (dynamicAbsoluteError / legacyValues).toFixed(3);
console.log(`dynamic-progression-legacy-parity-test: ${legacyValues} legacy values exact through progressionCode; deterministic ratings-only curve mismatch ${dynamicMismatch} (${mismatchPercent}%), MAE ${meanAbsoluteError}; holdout MAE ${analysis.holdout.newMAE.toFixed(3)}, max ${analysis.holdout.newMaxError}; all endpoints exact`);
